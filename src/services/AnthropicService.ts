import Anthropic from '@anthropic-ai/sdk';
import { 
  LLMServiceInterface, 
  McpTool, 
  LLMConfig, 
  AnthropicConfig,
  LLMError 
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

  constructor(config: LLMConfig, tools: McpTool[] = []) {
    if (config.provider !== 'anthropic') {
      throw new LLMError('Invalid provider for AnthropicService', 'anthropic');
    }

    this.config = config as AnthropicConfig;
    this.client = new Anthropic({
      apiKey: this.config.apiKey!,
      // Note: In production, use a backend proxy instead of browser-side API calls
    } as any);
    
    this.tools = tools;
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
          // In a real implementation, this would call the actual MCP client
          const result = await this.mockToolCall(content.name, content.input);
          
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

  private async mockToolCall(toolName: string, parameters: any): Promise<any> {
    // This is a mock implementation - in reality, this would call mcpClient.callTool()
    console.log(`Mock tool call: ${toolName}`, parameters);
    
    // Simulate the tool call delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Return mock responses based on tool name
    switch (toolName) {
      case 'get_weather':
        return {
          location: parameters.location,
          temperature: '72°F',
          condition: 'Sunny',
          humidity: '45%',
          wind: '5 mph NW'
        };
      
      case 'calculate':
        try {
          const result = Function(`"use strict"; return (${parameters.expression})`)();
          return {
            expression: parameters.expression,
            result: result
          };
        } catch (error: any) {
          throw new Error(`Calculation error: ${error.message}`);
        }
      
      case 'mcp_manitasmcp_GetCats':
        return [
          { name: 'Whiskers', breed: 'Persian', age: 3 },
          { name: 'Mittens', breed: 'Siamese', age: 5 },
          { name: 'Shadow', breed: 'Maine Coon', age: 2 }
        ];
      
      case 'mcp_manitasmcp_GetCat':
        return {
          name: parameters.name,
          breed: 'British Shorthair',
          age: 4,
          personality: 'Friendly and playful'
        };
      
      case 'mcp_manitasmcp_Echo':
        return {
          message: parameters.message,
          echoed_at: new Date().toISOString()
        };
      
      case 'echo':
        return {
          message: parameters.message,
          echoed_at: new Date().toISOString()
        };
      
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
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
}
