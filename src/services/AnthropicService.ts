import Anthropic from '@anthropic-ai/sdk';
import { 
  LLMServiceInterface, 
  McpTool, 
  LLMConfig, 
  AnthropicConfig,
  LLMError,
  McpClientInterface 
} from '../types';

/**
 * AnthropicService - TypeScript implementation for Claude API integration
 * Implements function calling to integrate with MCP tools
 */
export class AnthropicService implements LLMServiceInterface {
  private client: Anthropic;
  private tools: McpTool[];
  private conversationHistory: Anthropic.Messages.MessageParam[] = [];
  private config: AnthropicConfig;
  private mcpClient: McpClientInterface;

  constructor(config: LLMConfig, tools: McpTool[] = [], mcpClient: McpClientInterface) {
    if (config.provider !== 'anthropic') {
      throw new LLMError('Invalid provider for AnthropicService', 'anthropic');
    }

    this.config = config as AnthropicConfig;
    this.client = new Anthropic({
      apiKey: this.config.apiKey!,
      // Note: In production, use a backend proxy instead of browser-side API calls
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
      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens || 1000,
        messages: this.conversationHistory,
        tools: this.convertToolsToAnthropicFormat(this.tools)
      });

      // Handle tool use in the response
      if (response.content.some(content => content.type === 'tool_use')) {
        return await this.handleToolUse(response);
      } else {
        // Regular text response
        const textContent = response.content
          .filter(content => content.type === 'text')
          .map(content => content.text)
          .join('');

        // Add assistant response to conversation history
        this.conversationHistory.push({
          role: 'assistant',
          content: response.content
        });

        return textContent;
      }
    } catch (error: any) {
      console.error('Anthropic API error:', error);
      throw new LLMError(`Claude API error: ${error.message}`, 'anthropic');
    }
  }

  private async handleToolUse(response: Anthropic.Messages.Message): Promise<string> {
    // Add the assistant's response with tool use to conversation history
    this.conversationHistory.push({
      role: 'assistant',
      content: response.content
    });

    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
    
    for (const content of response.content) {
      if (content.type === 'tool_use') {
        try {
          // Call the real MCP client
          const mcpResult = await this.mcpClient.callTool(content.name, content.input as Record<string, any>);
          
          // Handle the MCP result format
          let result;
          if (mcpResult.success) {
            result = mcpResult.result;
          } else {
            throw new Error(mcpResult.error || 'Tool call failed');
          }
          
          toolResults.push({
            type: 'tool_result',
            tool_use_id: content.id,
            content: JSON.stringify(result, null, 2)
          });
        } catch (error: any) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: content.id,
            content: `Error calling tool: ${error.message}`,
            is_error: true
          });
        }
      }
    }

    // Add tool results to conversation history
    this.conversationHistory.push({
      role: 'user',
      content: toolResults
    });

    // Get Claude's response after tool execution
    const followUpResponse = await this.client.messages.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens || 1000,
      messages: this.conversationHistory,
      tools: this.convertToolsToAnthropicFormat(this.tools)
    });

    // Add the final response to conversation history
    this.conversationHistory.push({
      role: 'assistant',
      content: followUpResponse.content
    });

    const finalTextContent = followUpResponse.content
      .filter(content => content.type === 'text')
      .map(content => content.text)
      .join('');

    return finalTextContent;
  }

  private convertToolsToAnthropicFormat(mcpTools: McpTool[]): Anthropic.Messages.Tool[] {
    return mcpTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: "object" as const,
        properties: tool.inputSchema.properties,
        required: tool.inputSchema.required
      }
    }));
  }

  clearHistory(): void {
    this.conversationHistory = [];
  }

  getConversationHistory(): Anthropic.Messages.MessageParam[] {
    return [...this.conversationHistory];
  }

  getConversationStats(): {
    messageCount: number;
    estimatedTokens: number;
    toolTokens: number;
    modelLimit: number;
    availableTokens: number;
  } {
    const messageCount = this.conversationHistory.length;
    // Claude models typically have larger context windows
    const modelLimit = 200000; // Claude 3.5 Sonnet has 200k tokens
    const estimatedTokens = this.conversationHistory.reduce((sum, msg) => {
      const content = Array.isArray(msg.content) 
        ? msg.content.map(c => typeof c === 'string' ? c : JSON.stringify(c)).join(' ')
        : typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      return sum + Math.ceil(content.length / 4);
    }, 0);
    const toolTokens = this.tools.length * 50; // Rough estimate
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
