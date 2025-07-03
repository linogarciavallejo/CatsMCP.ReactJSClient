import { LLMConfig, McpTool, LLMServiceInterface, LLMError, McpClientInterface } from '../types';
import { AnthropicService } from './AnthropicService';
import { OpenAIService } from './OpenAIService';
import { OllamaService } from './OllamaService';

/**
 * Factory class for creating LLM service instances based on provider
 */
export class LLMServiceFactory {
  static create(config: LLMConfig, tools: McpTool[] = [], mcpClient: McpClientInterface): LLMServiceInterface {
    switch (config.provider) {
      case 'anthropic':
        if (!config.apiKey) {
          throw new LLMError('API key is required for Anthropic', 'anthropic');
        }
        return new AnthropicService(config, tools, mcpClient);
      
      case 'openai':
        if (!config.apiKey) {
          throw new LLMError('API key is required for OpenAI', 'openai');
        }
        return new OpenAIService(config, tools, mcpClient);
      
      case 'ollama':
        if (!config.baseUrl) {
          throw new LLMError('Base URL is required for Ollama', 'ollama');
        }
        return new OllamaService(config, tools, mcpClient);
      
      default:
        throw new LLMError(`Unsupported LLM provider: ${config.provider}`);
    }
  }
}
