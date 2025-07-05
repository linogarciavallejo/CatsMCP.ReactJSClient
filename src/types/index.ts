// Language Support
export type SupportedLanguage = 'en' | 'es';

export interface LanguageConfig {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
}

// Core MCP Types
export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface McpServerConfig {
  type: 'stdio' | 'websocket' | 'http';
  command?: string;
  arguments?: string[];
  url?: string;
  language?: SupportedLanguage;
}

export interface McpToolCall {
  name: string;
  parameters: Record<string, any>;
}

export interface McpToolResult {
  success: boolean;
  result?: any;
  error?: string;
}

// LLM Provider Types
export type LLMProvider = 'anthropic' | 'openai' | 'ollama';

export interface LLMConfig {
  provider: LLMProvider;
  apiKey?: string;
  baseUrl?: string;
  model: string;
  maxTokens?: number;
}

export interface AnthropicConfig extends LLMConfig {
  provider: 'anthropic';
  model: 'claude-3-5-sonnet-20241022' | 'claude-3-haiku-20240307' | 'claude-3-opus-20240229';
}

export interface OpenAIConfig extends LLMConfig {
  provider: 'openai';
  model: 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4-turbo' | 'gpt-4-turbo-preview' | 'gpt-4' | 'gpt-3.5-turbo';
}

export interface OllamaConfig extends LLMConfig {
  provider: 'ollama';
  baseUrl: string; // Required for Ollama
  model: 'deepseek-coder' | 'llama2' | 'mistral' | string;
}

// Chat Message Types
export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  toolCalls?: McpToolCall[];
  toolResults?: McpToolResult[];
}

// Connection Status
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// Component Props Types
export interface ConnectionManagerProps {
  onConnect: (serverConfig: McpServerConfig, llmConfig: LLMConfig) => Promise<void>;
  onDisconnect: () => Promise<void>;
  connectionStatus: ConnectionStatus;
  statusMessage: string;
  selectedLanguage?: SupportedLanguage;
  onLanguageChange?: (language: SupportedLanguage) => void;
}

export interface ToolsListProps {
  tools: McpTool[];
  language?: SupportedLanguage;
}

export interface ChatInterfaceProps {
  llmService: LLMServiceInterface | null;
  mcpClient?: McpClientInterface | null;
  language?: SupportedLanguage;
}

// Service Interfaces
export interface McpClientInterface {
  connect(config: McpServerConfig): Promise<void>;
  disconnect(): Promise<void>;
  listTools(): Promise<McpTool[]>;
  callTool(name: string, parameters: Record<string, any>, language?: SupportedLanguage): Promise<McpToolResult>;
  isConnected(): boolean;
  setLanguage(language: SupportedLanguage): void;
}

export interface LLMServiceInterface {
  sendMessage(message: string): Promise<string>;
  updateTools(tools: McpTool[]): void;
  clearHistory(): void;
  getConversationHistory(): any[];
  getConversationStats?(): {
    messageCount: number;
    estimatedTokens: number;
    toolTokens: number;
    modelLimit: number;
    availableTokens: number;
  };
}

// Error Types
export class McpError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'McpError';
  }
}

export class LLMError extends Error {
  constructor(message: string, public provider?: LLMProvider) {
    super(message);
    this.name = 'LLMError';
  }
}
