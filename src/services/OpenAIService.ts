import OpenAI from 'openai';
import { 
  LLMServiceInterface, 
  McpTool, 
  LLMConfig, 
  OpenAIConfig,
  LLMError 
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

  constructor(config: LLMConfig, tools: McpTool[] = []) {
    if (config.provider !== 'openai') {
      throw new LLMError('Invalid provider for OpenAIService', 'openai');
    }

    this.config = config as OpenAIConfig;
    this.client = new OpenAI({
      apiKey: this.config.apiKey!,
      dangerouslyAllowBrowser: true // Only for demo purposes - in production, use a backend proxy
    });
    
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
          
          // In a real implementation, this would call the actual MCP client
          const result = await this.mockToolCall(toolCall.function.name, functionArgs);
          
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
