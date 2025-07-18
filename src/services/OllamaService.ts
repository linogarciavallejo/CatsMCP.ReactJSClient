import axios, { AxiosInstance } from 'axios';
import { 
  LLMServiceInterface, 
  McpTool, 
  LLMConfig, 
  OllamaConfig,
  LLMError,
  McpClientInterface 
} from '../types';

/**
 * OllamaService - TypeScript implementation for Ollama API integration
 * Implements function calling to integrate with MCP tools using local models like DeepSeek
 */
export class OllamaService implements LLMServiceInterface {
  private client: AxiosInstance;
  private tools: McpTool[];
  private conversationHistory: Array<{ role: string; content: string }> = [];
  private config: OllamaConfig;
  private mcpClient: McpClientInterface;

  constructor(config: LLMConfig, tools: McpTool[] = [], mcpClient: McpClientInterface) {
    if (config.provider !== 'ollama') {
      throw new LLMError('Invalid provider for OllamaService', 'ollama');
    }

    this.config = config as OllamaConfig;
    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: 60000, // 60 seconds timeout for local models
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
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
      // For Ollama, we need to construct a prompt that includes tool descriptions
      // and handle function calling manually since Ollama doesn't have built-in function calling
      const systemPrompt = this.buildSystemPrompt();
      const fullPrompt = this.buildFullPrompt(systemPrompt, message);

      const response = await this.client.post('/api/generate', {
        model: this.config.model,
        prompt: fullPrompt,
        stream: false,
        options: {
          num_predict: this.config.maxTokens || 1000,
          temperature: 0.7
        }
      });

      if (!response.data?.response) {
        throw new LLMError('No response from Ollama', 'ollama');
      }

      const assistantResponse = response.data.response;

      // Check if the response contains a tool call (simple pattern matching)
      const toolCallMatch = this.extractToolCall(assistantResponse);
      
      if (toolCallMatch) {
        return await this.handleToolCall(toolCallMatch);
      } else {
        // Regular text response
        this.conversationHistory.push({
          role: 'assistant',
          content: assistantResponse
        });

        return assistantResponse;
      }
    } catch (error: any) {
      console.error('Ollama API error:', error);
      throw new LLMError(`Ollama API error: ${error.response?.data?.error || error.message}`, 'ollama');
    }
  }

  private buildSystemPrompt(): string {
    if (this.tools.length === 0) {
      return "You are a helpful AI assistant.";
    }

    const toolDescriptions = this.tools.map(tool => {
      const params = tool.inputSchema.properties ? 
        Object.entries(tool.inputSchema.properties)
          .map(([name, schema]: [string, any]) => `${name}: ${schema.description || schema.type}`)
          .join(', ') : 'none';
      
      return `- ${tool.name}: ${tool.description}. Parameters: ${params}`;
    }).join('\n');

    return `You are a helpful AI assistant with access to the following tools:

${toolDescriptions}

When you need to use a tool, respond with a JSON object in this exact format:
{
  "tool_name": "tool_name_here",
  "parameters": {
    "param1": "value1",
    "param2": "value2"
  }
}

If you don't need to use a tool, respond normally with text.`;
  }

  private buildFullPrompt(systemPrompt: string, userMessage: string): string {
    const historyText = this.conversationHistory
      .slice(-10) // Keep last 10 messages to avoid context overflow
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    return `${systemPrompt}

${historyText}

user: ${userMessage}
assistant:`;
  }

  private extractToolCall(response: string): { name: string; parameters: any } | null {
    try {
      // Look for JSON patterns in the response
      const jsonMatch = response.match(/\{[\s\S]*?\}/);
      if (!jsonMatch) return null;

      const jsonStr = jsonMatch[0];
      const parsed = JSON.parse(jsonStr);
      
      if (parsed.tool_name && parsed.parameters) {
        return {
          name: parsed.tool_name,
          parameters: parsed.parameters
        };
      }
    } catch (error) {
      // Not a valid tool call
    }
    
    return null;
  }

  private async handleToolCall(toolCall: { name: string; parameters: any }): Promise<string> {
    try {
      // Execute the real tool call via MCP client
      const mcpResult = await this.mcpClient.callTool(toolCall.name, toolCall.parameters);
      
      // Handle the MCP result format
      let result;
      if (mcpResult.success) {
        result = mcpResult.result;
      } else {
        throw new Error(mcpResult.error || 'Tool call failed');
      }
      
      // Add the tool call and result to conversation history
      this.conversationHistory.push({
        role: 'assistant',
        content: `I'll use the ${toolCall.name} tool to help you.`
      });

      // Generate a follow-up response with the tool result
      const followUpPrompt = `Tool "${toolCall.name}" returned: ${JSON.stringify(result, null, 2)}

Please provide a helpful response to the user based on this tool result.`;

      const followUpResponse = await this.client.post('/api/generate', {
        model: this.config.model,
        prompt: this.buildFullPrompt("You are a helpful AI assistant.", followUpPrompt),
        stream: false,
        options: {
          num_predict: this.config.maxTokens || 1000,
          temperature: 0.7
        }
      });

      const finalResponse = followUpResponse.data?.response || 'Tool executed successfully.';
      
      this.conversationHistory.push({
        role: 'assistant',
        content: finalResponse
      });

      return finalResponse;
    } catch (error: any) {
      const errorMessage = `Error executing tool ${toolCall.name}: ${error.message}`;
      this.conversationHistory.push({
        role: 'assistant',
        content: errorMessage
      });
      return errorMessage;
    }
  }

  clearHistory(): void {
    this.conversationHistory = [];
  }

  getConversationHistory(): Array<{ role: string; content: string }> {
    return [...this.conversationHistory];
  }
}
