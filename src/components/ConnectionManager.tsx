import React, { useState } from 'react';
import { ConnectionManagerProps, McpServerConfig, LLMConfig, LLMProvider } from '../types';

const ConnectionManager: React.FC<ConnectionManagerProps> = ({ 
  onConnect, 
  onDisconnect, 
  connectionStatus, 
  statusMessage 
}) => {
  const [serverType, setServerType] = useState<'stdio' | 'websocket'>('stdio');
  const [serverCommand, setServerCommand] = useState<string>('');
  const [serverArgs, setServerArgs] = useState<string>('');
  const [llmProvider, setLlmProvider] = useState<LLMProvider>('anthropic');
  const [apiKey, setApiKey] = useState<string>('');
  const [baseUrl, setBaseUrl] = useState<string>('http://localhost:11434'); // Default Ollama URL
  const [model, setModel] = useState<string>('claude-3-5-sonnet-20241022');

  const handleProviderChange = (provider: LLMProvider) => {
    setLlmProvider(provider);
    // Set default models for each provider
    switch (provider) {
      case 'anthropic':
        setModel('claude-3-5-sonnet-20241022');
        break;
      case 'openai':
        setModel('gpt-4-turbo-preview');
        break;
      case 'ollama':
        setModel('deepseek-coder');
        break;
    }
  };

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (llmProvider !== 'ollama' && !apiKey.trim()) {
      alert(`Please enter your ${llmProvider.toUpperCase()} API key`);
      return;
    }

    if (!serverCommand.trim()) {
      alert('Please enter the server command');
      return;
    }

    const serverConfig: McpServerConfig = {
      type: serverType,
      command: serverCommand,
      arguments: serverArgs.split(' ').filter(arg => arg.trim())
    };

    const llmConfig: LLMConfig = {
      provider: llmProvider,
      model,
      maxTokens: 1000,
      ...(llmProvider !== 'ollama' && { apiKey }),
      ...(llmProvider === 'ollama' && { baseUrl })
    };

    onConnect(serverConfig, llmConfig);
  };

  const getStatusClass = (): string => {
    switch (connectionStatus) {
      case 'connected': return 'status success';
      case 'connecting': return 'status info';
      case 'error': return 'status error';
      default: return '';
    }
  };

  const getModelOptions = () => {
    switch (llmProvider) {
      case 'anthropic':
        return [
          { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
          { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
          { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' }
        ];
      case 'openai':
        return [
          { value: 'gpt-4-turbo-preview', label: 'GPT-4 Turbo' },
          { value: 'gpt-4', label: 'GPT-4' },
          { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' }
        ];
      case 'ollama':
        return [
          { value: 'deepseek-coder', label: 'DeepSeek Coder' },
          { value: 'llama2', label: 'Llama 2' },
          { value: 'mistral', label: 'Mistral' },
          { value: 'codellama', label: 'Code Llama' }
        ];
      default:
        return [];
    }
  };

  return (
    <div className="connection-section">
      <h2>Server Connection & LLM Configuration</h2>
      
      {statusMessage && (
        <div className={getStatusClass()}>
          {statusMessage}
        </div>
      )}

      <form onSubmit={handleConnect}>
        {/* LLM Provider Selection */}
        <div className="form-group">
          <label htmlFor="llm-provider">LLM Provider:</label>
          <select
            id="llm-provider"
            value={llmProvider}
            onChange={(e) => handleProviderChange(e.target.value as LLMProvider)}
            disabled={connectionStatus === 'connected'}
          >
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="openai">OpenAI (GPT)</option>
            <option value="ollama">Ollama (Local)</option>
          </select>
        </div>

        {/* Model Selection */}
        <div className="form-group">
          <label htmlFor="model">Model:</label>
          <select
            id="model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={connectionStatus === 'connected'}
          >
            {getModelOptions().map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* API Key (for remote providers) */}
        {llmProvider !== 'ollama' && (
          <div className="form-group">
            <label htmlFor="api-key">{llmProvider.toUpperCase()} API Key:</label>
            <input
              id="api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={`Enter your ${llmProvider.toUpperCase()} API key`}
              disabled={connectionStatus === 'connected'}
            />
          </div>
        )}

        {/* Base URL (for Ollama) */}
        {llmProvider === 'ollama' && (
          <div className="form-group">
            <label htmlFor="base-url">Ollama Base URL:</label>
            <input
              id="base-url"
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="http://localhost:11434"
              disabled={connectionStatus === 'connected'}
            />
          </div>
        )}

        {/* MCP Server Configuration */}
        <div className="form-group">
          <label htmlFor="server-type">MCP Server Type:</label>
          <select
            id="server-type"
            value={serverType}
            onChange={(e) => setServerType(e.target.value as 'stdio' | 'websocket')}
            disabled={connectionStatus === 'connected'}
          >
            <option value="stdio">Stdio</option>
            <option value="websocket">WebSocket</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="server-command">Server Command:</label>
          <input
            id="server-command"
            type="text"
            value={serverCommand}
            onChange={(e) => setServerCommand(e.target.value)}
            placeholder="e.g., python, node, dotnet"
            disabled={connectionStatus === 'connected'}
          />
        </div>

        <div className="form-group">
          <label htmlFor="server-args">Server Arguments:</label>
          <input
            id="server-args"
            type="text"
            value={serverArgs}
            onChange={(e) => setServerArgs(e.target.value)}
            placeholder="e.g., server.py or run --project ../server"
            disabled={connectionStatus === 'connected'}
          />
        </div>

        {connectionStatus !== 'connected' ? (
          <button 
            type="submit" 
            className="btn"
            disabled={connectionStatus === 'connecting'}
          >
            {connectionStatus === 'connecting' ? (
              <>
                <span className="loading"></span> Connecting...
              </>
            ) : (
              'Connect'
            )}
          </button>
        ) : (
          <button 
            type="button" 
            className="btn"
            onClick={onDisconnect}
          >
            Disconnect
          </button>
        )}
      </form>
    </div>
  );
};

export default ConnectionManager;
