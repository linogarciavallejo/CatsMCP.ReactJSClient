import OpenAI from 'openai';
import { 
  LLMServiceInterface, 
  McpTool, 
  LLMConfig, 
  OpenAIConfig,
  LLMError,
  McpClientInterface 
} from '../types';

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

    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens || 1000,
        messages: this.conversationHistory,
        tools: this.convertToolsToOpenAIFormat(this.tools),
        tool_choice: this.tools.length > 0 ? 'auto' : undefined
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

    // Get OpenAI's response after tool execution
    const followUpResponse = await this.client.chat.completions.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens || 1000,
      messages: this.conversationHistory,
      tools: this.convertToolsToOpenAIFormat(this.tools),
      tool_choice: this.tools.length > 0 ? 'auto' : undefined
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

  clearHistory(): void {
    this.conversationHistory = [];
  }

  getConversationHistory(): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    return [...this.conversationHistory];
  }
}
