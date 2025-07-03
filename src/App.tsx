import React, { useState, useCallback } from 'react';
import ConnectionManager from './components/ConnectionManager';
import ToolsList from './components/ToolsList';
import ChatInterface from './components/ChatInterface';
import { HttpMcpClient } from './services/HttpMcpClient'; // Use HTTP client for real server
// import { McpClient } from './services/McpClient'; // Old mock client
import { LLMServiceFactory } from './services/LLMServiceFactory';
import { 
  McpTool, 
  McpServerConfig, 
  LLMConfig, 
  ConnectionStatus,
  McpClientInterface,
  LLMServiceInterface,
  SupportedLanguage
} from './types';

const App: React.FC = () => {
  const [mcpClient, setMcpClient] = useState<McpClientInterface | null>(null);
  const [llmService, setLlmService] = useState<LLMServiceInterface | null>(null);
  const [tools, setTools] = useState<McpTool[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>(
    (import.meta.env.VITE_DEFAULT_LANGUAGE as SupportedLanguage) || 'en'
  );

  const handleConnect = useCallback(async (serverConfig: McpServerConfig, llmConfig: LLMConfig) => {
    try {
      setConnectionStatus('connecting');
      setStatusMessage('Connecting to MCP server...');

      // Add language to server config
      const configWithLanguage = {
        ...serverConfig,
        language: selectedLanguage
      };

      // Initialize MCP client (using HTTP client for real server connection)
      const client = new HttpMcpClient();
      await client.connect(configWithLanguage);
      setMcpClient(client);

      // List available tools
      const availableTools = await client.listTools();
      setTools(availableTools);

      // Initialize LLM service based on provider
      const llm = LLMServiceFactory.create(llmConfig, availableTools, client);
      setLlmService(llm);

      setConnectionStatus('connected');
      setStatusMessage(`Connected to server with ${availableTools.length} tools using ${llmConfig.provider}`);
    } catch (error: any) {
      setConnectionStatus('error');
      setStatusMessage(`Connection failed: ${error.message}`);
      console.error('Connection error:', error);
    }
  }, [selectedLanguage]);

  const handleDisconnect = useCallback(async () => {
    try {
      if (mcpClient) {
        await mcpClient.disconnect();
        setMcpClient(null);
      }
      setLlmService(null);
      setTools([]);
      setConnectionStatus('disconnected');
      setStatusMessage('Disconnected from server');
    } catch (error: any) {
      console.error('Disconnect error:', error);
      setStatusMessage(`Disconnect error: ${error.message}`);
    }
  }, [mcpClient]);

  const handleLanguageChange = useCallback((language: SupportedLanguage) => {
    setSelectedLanguage(language);
    
    // Update MCP client language if connected
    if (mcpClient) {
      mcpClient.setLanguage(language);
    }
  }, [mcpClient]);

  return (
    <div className="container">
      <header className="header">
        <h1>MCP React Client</h1>
        <p>Model Context Protocol Client built with TypeScript & React</p>
      </header>

      <ConnectionManager 
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        connectionStatus={connectionStatus}
        statusMessage={statusMessage}
        selectedLanguage={selectedLanguage}
        onLanguageChange={handleLanguageChange}
      />

      {connectionStatus === 'connected' && (
        <>
          <ToolsList tools={tools} language={selectedLanguage} />
          <ChatInterface 
            llmService={llmService}
            mcpClient={mcpClient}
            language={selectedLanguage}
          />
        </>
      )}
    </div>
  );
};

export default App;
