import React, { useState } from 'react';
import { ConnectionManagerProps, McpServerConfig, LLMConfig, LLMProvider, SupportedLanguage } from '../types';
import { SUPPORTED_LANGUAGES, getTranslation } from '../config/languages';

const ConnectionManager: React.FC<ConnectionManagerProps> = ({ 
  onConnect, 
  onDisconnect, 
  connectionStatus, 
  statusMessage,
  selectedLanguage = 'en',
  onLanguageChange
}) => {
  // Get environment variables with fallbacks
  const getEnvApiKey = (provider: LLMProvider): string => {
    switch (provider) {
      case 'anthropic':
        return import.meta.env.VITE_ANTHROPIC_API_KEY || '';
      case 'openai':
        return import.meta.env.VITE_OPENAI_API_KEY || '';
      default:
        return '';
    }
  };

  const [serverType, setServerType] = useState<'stdio' | 'websocket' | 'http'>('http');
  const [serverCommand, setServerCommand] = useState<string>(import.meta.env.VITE_DEFAULT_SERVER_COMMAND || '');
  const [serverArgs, setServerArgs] = useState<string>(import.meta.env.VITE_DEFAULT_SERVER_ARGS || '');
  const [llmProvider, setLlmProvider] = useState<LLMProvider>(
    (import.meta.env.VITE_DEFAULT_LLM_PROVIDER as LLMProvider) || 'anthropic'
  );
  const [apiKey, setApiKey] = useState<string>(getEnvApiKey(llmProvider));
  const [baseUrl, setBaseUrl] = useState<string>(
    import.meta.env.VITE_OLLAMA_BASE_URL || 'http://localhost:11434'
  );
  const [model, setModel] = useState<string>(
    import.meta.env.VITE_DEFAULT_ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022'
  );

  const handleProviderChange = (provider: LLMProvider) => {
    setLlmProvider(provider);
    // Update API key from environment variable
    setApiKey(getEnvApiKey(provider));
    
    // Set default models for each provider
    switch (provider) {
      case 'anthropic':
        setModel(import.meta.env.VITE_DEFAULT_ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022');
        break;
      case 'openai':
        setModel(import.meta.env.VITE_DEFAULT_OPENAI_MODEL || 'gpt-4-turbo-preview');
        break;
      case 'ollama':
        setModel(import.meta.env.VITE_DEFAULT_OLLAMA_MODEL || 'deepseek-coder');
        break;
    }
  };

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if we have an API key (either from input or environment)
    const effectiveApiKey = apiKey.trim() || getEnvApiKey(llmProvider);
    if (llmProvider !== 'ollama' && !effectiveApiKey) {
      alert(`Please enter your ${llmProvider.toUpperCase()} API key or set the VITE_${llmProvider.toUpperCase()}_API_KEY environment variable`);
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
      ...(llmProvider !== 'ollama' && { apiKey: effectiveApiKey }),
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
      <h2>{getTranslation(selectedLanguage, 'serverConnection')}</h2>
      
      {statusMessage && (
        <div className={getStatusClass()}>
          {statusMessage}
        </div>
      )}

      <form onSubmit={handleConnect}>
        {/* LLM Provider Selection */}
        <div className="form-group">
          <label htmlFor="llm-provider">{getTranslation(selectedLanguage, 'llmProvider')}:</label>
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

        {/* Language Selection */}
        <div className="form-group">
          <label htmlFor="language">{getTranslation(selectedLanguage, 'language')}:</label>
          <select
            id="language"
            value={selectedLanguage}
            onChange={(e) => onLanguageChange?.(e.target.value as SupportedLanguage)}
          >
            {SUPPORTED_LANGUAGES.map(lang => (
              <option key={lang.code} value={lang.code}>
                {lang.nativeName} ({lang.name})
              </option>
            ))}
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
            <label htmlFor="api-key">
              {llmProvider.toUpperCase()} API Key:
              {getEnvApiKey(llmProvider) && !apiKey && (
                <span style={{ fontSize: '12px', color: '#666', marginLeft: '8px' }}>
                  (loaded from environment)
                </span>
              )}
            </label>
            <input
              id="api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                getEnvApiKey(llmProvider) 
                  ? `Environment key loaded - override if needed`
                  : `Enter your ${llmProvider.toUpperCase()} API key`
              }
              disabled={connectionStatus === 'connected'}
            />
            {getEnvApiKey(llmProvider) && !apiKey && (
              <small style={{ color: '#666', fontSize: '11px' }}>
                Using API key from VITE_{llmProvider.toUpperCase()}_API_KEY environment variable
              </small>
            )}
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
            onChange={(e) => setServerType(e.target.value as 'stdio' | 'websocket' | 'http')}
            disabled={connectionStatus === 'connected'}
          >
            <option value="stdio">Stdio</option>
            <option value="websocket">WebSocket</option>
            <option value="http">HTTP REST API</option>
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
                <span className="loading"></span> {getTranslation(selectedLanguage, 'connecting')}
              </>
            ) : (
              getTranslation(selectedLanguage, 'connect')
            )}
          </button>
        ) : (
          <button 
            type="button" 
            className="btn"
            onClick={onDisconnect}
          >
            {getTranslation(selectedLanguage, 'disconnect')}
          </button>
        )}
      </form>
    </div>
  );
};

export default ConnectionManager;
