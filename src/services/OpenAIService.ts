import OpenAI from 'openai';
import { 
  LLMServiceInterface, 
  McpTool, 
  LLMConfig, 
  OpenAIConfig,
  LLMError,
  McpClientInterface 
} from '../types';

// Token limits for OpenAI models
const MODEL_TOKEN_LIMITS: { [key: string]: number } = {
  'gpt-3.5-turbo': 16385,
  'gpt-3.5-turbo-16k': 16385,
  'gpt-4': 8192,
  'gpt-4-32k': 32768,
  'gpt-4-turbo': 128000,
  'gpt-4-turbo-preview': 128000,
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000
};

/**
 * OpenAIService - TypeScript implementation for OpenAI API integration
 * Implements function calling to integrate with MCP tools
 */
export class OpenAIService implements LLMServiceInterface {
  private client: OpenAI;
  private tools: McpTool[];
  private conversationHistory: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
  private config: OpenAIConfig;
  private mcpClient: McpClientInterface;

  constructor(config: LLMConfig, tools: McpTool[] = [], mcpClient: McpClientInterface) {
    if (config.provider !== 'openai') {
      throw new LLMError('Invalid provider for OpenAIService', 'openai');
    }

    this.config = config as OpenAIConfig;
    this.client = new OpenAI({
      apiKey: this.config.apiKey!,
      dangerouslyAllowBrowser: true, // Only for demo purposes - in production, use a backend proxy
      baseURL: 'https://api.openai.com/v1' // Explicit base URL
    } as any);
    
    this.tools = tools;
    this.mcpClient = mcpClient;
  }

  updateTools(tools: McpTool[]): void {
    this.tools = tools;
  }

  async sendMessage(message: string): Promise<string> {
    // Add user message to conversation history
    this.conversationHistory.push({
      role: 'user',
      content: message
    });

    // Manage conversation history to avoid token limits
    this.manageConversationHistory();

    try {
      // Create a strong system prompt with current date and instructions
      const systemPrompt = this.generateSystemPrompt();

      // Combine system prompt with conversation history
      const messagesWithSystem = [systemPrompt, ...this.conversationHistory];

      const response = await this.client.chat.completions.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens || 2000,
        messages: messagesWithSystem,
        tools: this.convertToolsToOpenAIFormat(this.tools),
        tool_choice: this.tools.length > 0 ? 'auto' : undefined,
        temperature: 0.1 // Lower temperature for more accurate data handling
      });

      const choice = response.choices[0];
      if (!choice?.message) {
        throw new LLMError('No response from OpenAI', 'openai');
      }

      // Handle tool calls in the response
      if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
        return await this.handleToolCalls(choice.message);
      } else {
        // Regular text response
        const textContent = choice.message.content || '';

        // Add assistant response to conversation history
        this.conversationHistory.push({
          role: 'assistant',
          content: textContent
        });

        return textContent;
      }
    } catch (error: any) {
      console.error('OpenAI API error:', error);
      
      // Check if it's a context length error
      if (error.message?.includes('context_length_exceeded') || 
          error.message?.includes('maximum context length') ||
          error.status === 400 && error.message?.includes('tokens')) {
        
        // Try to recover by clearing some history
        console.log('Context length exceeded, attempting to clear conversation history...');
        this.clearHistory();
        
        // Add just the current message back
        this.conversationHistory.push({
          role: 'user',
          content: message
        });
        
        // Try again with fresh context
        try {
          const retrySystemPrompt = this.generateSystemPrompt();

          const retryResponse = await this.client.chat.completions.create({
            model: this.config.model,
            max_tokens: this.config.maxTokens || 1000,
            messages: [retrySystemPrompt, ...this.conversationHistory],
            tools: this.convertToolsToOpenAIFormat(this.tools),
            tool_choice: this.tools.length > 0 ? 'auto' : undefined
          });
          
          const retryChoice = retryResponse.choices[0];
          if (retryChoice?.message?.content) {
            this.conversationHistory.push({
              role: 'assistant',
              content: retryChoice.message.content
            });
            
            return retryChoice.message.content + '\n\n*Note: Conversation history was cleared due to context length limits.*';
          }
        } catch (retryError: any) {
          console.error('Retry after clearing history also failed:', retryError);
        }
        
        throw new LLMError(
          `Context length exceeded for model ${this.config.model}. Consider using a model with a larger context window like GPT-4 Turbo (128k tokens) or GPT-4o (128k tokens).`,
          'openai'
        );
      }
      
      throw new LLMError(`OpenAI API error: ${error.message}`, 'openai');
    }
  }

  private async handleToolCalls(message: OpenAI.Chat.Completions.ChatCompletionMessage): Promise<string> {
    // Add the assistant's response with tool calls to conversation history
    this.conversationHistory.push({
      role: 'assistant',
      content: message.content,
      tool_calls: message.tool_calls
    });

    const toolResults: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
    
    if (message.tool_calls) {
      for (const toolCall of message.tool_calls) {
        try {
          // Parse the function arguments
          const functionArgs = JSON.parse(toolCall.function.arguments);
          
          // Call the real MCP client
          const mcpResult = await this.mcpClient.callTool(toolCall.function.name, functionArgs);
          
          // Handle the MCP result format
          let result;
          if (mcpResult.success) {
            result = mcpResult.result;
          } else {
            throw new Error(mcpResult.error || 'Tool call failed');
          }
          
          toolResults.push({
            role: 'tool',
            content: JSON.stringify(result, null, 2),
            tool_call_id: toolCall.id
          });
        } catch (error: any) {
          toolResults.push({
            role: 'tool',
            content: `Error calling tool: ${error.message}`,
            tool_call_id: toolCall.id
          });
        }
      }
    }

    // Add tool results to conversation history
    this.conversationHistory.push(...toolResults);

    // Manage conversation history again after adding tool results
    this.manageConversationHistory();

    // Get OpenAI's response after tool execution
    const systemPrompt = this.generateSystemPrompt();
    const messagesWithSystem = [systemPrompt, ...this.conversationHistory];

    const followUpResponse = await this.client.chat.completions.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens || 2000,
      messages: messagesWithSystem,
      tools: this.convertToolsToOpenAIFormat(this.tools),
      tool_choice: this.tools.length > 0 ? 'auto' : undefined,
      temperature: 0.1 // Lower temperature for more accurate data handling
    });

    const finalChoice = followUpResponse.choices[0];
    if (!finalChoice?.message?.content) {
      throw new LLMError('No follow-up response from OpenAI', 'openai');
    }

    // Add the final response to conversation history
    this.conversationHistory.push({
      role: 'assistant',
      content: finalChoice.message.content
    });

    return finalChoice.message.content;
  }

  private generateSystemPrompt(): OpenAI.Chat.Completions.ChatCompletionMessageParam {
    return {
      role: 'system',
      content: `CRITICAL INSTRUCTIONS:
- Today's date is ${new Date().toLocaleDateString('en-US', { 
  year: 'numeric', 
  month: 'long', 
  day: 'numeric' 
})} (${new Date().toISOString().split('T')[0]}).
- This is ${new Date().toISOString().split('T')[0]} - use this EXACT date for ALL time-based calculations.
- NEVER use any other reference date.
- ALWAYS call tools to get fresh, current data before making calculations.
- When calculating time differences, use the current date: ${new Date().toISOString().split('T')[0]}.
- Be precise with date calculations and show your work.
- If you have fresh data from tools, use it for accurate calculations.`
    };
  }

  private convertToolsToOpenAIFormat(mcpTools: McpTool[]): OpenAI.Chat.Completions.ChatCompletionTool[] {
    return mcpTools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema
      }
    }));
  }

  /**
   * Estimate token count for a message (rough approximation)
   * OpenAI uses tiktoken, but for simplicity we'll use a basic heuristic
   */
  private estimateTokenCount(message: OpenAI.Chat.Completions.ChatCompletionMessageParam): number {
    let content = '';
    
    if (typeof message.content === 'string') {
      content = message.content;
    } else if (Array.isArray(message.content)) {
      content = message.content.map(c => typeof c === 'string' ? c : JSON.stringify(c)).join(' ');
    }
    
    // More conservative estimation: ~3 characters per token (was 4)
    let tokens = Math.ceil(content.length / 3);
    
    // Add tokens for message structure
    tokens += 15; // Role, metadata, etc. (increased from 10)
    
    // Add tokens for tool calls if present
    if ('tool_calls' in message && message.tool_calls) {
      tokens += message.tool_calls.length * 100; // Increased from 50 for tool call structure
    }
    
    return tokens;
  }

  /**
   * Estimate tokens for all tools/functions
   */
  private estimateToolTokens(): number {
    if (!this.tools.length) return 0;
    
    const toolsJson = JSON.stringify(this.convertToolsToOpenAIFormat(this.tools));
    // Tools are sent with every request, so they need careful token estimation
    return Math.ceil(toolsJson.length / 3); // More conservative estimation (3 chars per token)
  }

  /**
   * Manage conversation history to stay within token limits
   */
  private manageConversationHistory(): void {
    const modelLimit = MODEL_TOKEN_LIMITS[this.config.model] || 4096;
    const reserveTokens = (this.config.maxTokens || 2000) + 1500; // Increased buffer for system prompt
    const toolTokens = this.estimateToolTokens();
    const systemPromptTokens = this.estimateTokenCount(this.generateSystemPrompt());
    const availableTokens = modelLimit - reserveTokens - toolTokens - systemPromptTokens;
    
    if (availableTokens <= 0) {
      throw new LLMError(`Model ${this.config.model} doesn't have enough context for tools and response`, 'openai');
    }
    
    // Calculate current token usage
    let currentTokens = 0;
    for (const message of this.conversationHistory) {
      currentTokens += this.estimateTokenCount(message);
    }
    
    // If we're over the limit, trim the conversation history intelligently
    if (currentTokens > availableTokens) {
      console.log(`Token limit exceeded: ${currentTokens} > ${availableTokens}. Trimming conversation history intelligently.`);
      
      // Strategy: Keep the most recent messages and all tool results
      const toolMessages = this.conversationHistory.filter(msg => 
        msg.role === 'tool' || ('tool_calls' in msg && msg.tool_calls)
      );
      
      // Keep last 4 messages (2 exchanges) to maintain context
      const recentMessages = this.conversationHistory.slice(-4);
      
      // Combine important messages, removing duplicates
      const messagesToKeep = new Set([...toolMessages, ...recentMessages]);
      let trimmedHistory = Array.from(messagesToKeep);
      
      // Calculate tokens for these messages
      let tokensUsed = 0;
      for (const message of trimmedHistory) {
        tokensUsed += this.estimateTokenCount(message);
      }
      
      // If still too many tokens, keep only the absolute essentials
      if (tokensUsed > availableTokens * 0.8) {
        // Keep last tool results and last 2 messages
        const recentToolMessages = toolMessages.slice(-2);
        const lastTwoMessages = this.conversationHistory.slice(-2);
        
        trimmedHistory = Array.from(new Set([...recentToolMessages, ...lastTwoMessages]));
      }
      
      // Sort messages by their original order to maintain conversation flow
      const originalIndices = new Map();
      this.conversationHistory.forEach((msg, index) => {
        originalIndices.set(msg, index);
      });
      
      trimmedHistory.sort((a, b) => {
        const indexA = originalIndices.get(a) ?? 0;
        const indexB = originalIndices.get(b) ?? 0;
        return indexA - indexB;
      });
      
      console.log(`Trimmed conversation history from ${this.conversationHistory.length} to ${trimmedHistory.length} messages`);
      
      // Recalculate tokens
      tokensUsed = 0;
      for (const message of trimmedHistory) {
        tokensUsed += this.estimateTokenCount(message);
      }
      
      console.log(`Estimated tokens: ${currentTokens} -> ${tokensUsed} (limit: ${availableTokens})`);
      
      this.conversationHistory = trimmedHistory;
    }
  }

  clearHistory(): void {
    this.conversationHistory = [];
  }

  getConversationHistory(): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    return [...this.conversationHistory];
  }

  /**
   * Get conversation statistics for debugging
   */
  getConversationStats(): {
    messageCount: number;
    estimatedTokens: number;
    toolTokens: number;
    modelLimit: number;
    availableTokens: number;
  } {
    const messageCount = this.conversationHistory.length;
    const estimatedTokens = this.conversationHistory.reduce((sum, msg) => sum + this.estimateTokenCount(msg), 0);
    const toolTokens = this.estimateToolTokens();
    const modelLimit = MODEL_TOKEN_LIMITS[this.config.model] || 4096;
    const reserveTokens = (this.config.maxTokens || 1000) + 500;
    const availableTokens = modelLimit - reserveTokens - toolTokens;
    
    return {
      messageCount,
      estimatedTokens,
      toolTokens,
      modelLimit,
      availableTokens
    };
  }
}
