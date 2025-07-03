/**
 * WebSocket-based MCP Client for connecting to your .NET MCP server
 * Implements the full MCP JSON-RPC protocol over WebSocket
 */
import { McpClientInterface, McpServerConfig, McpTool, McpToolResult, McpError, SupportedLanguage } from '../types';

export class WebSocketMcpClient implements McpClientInterface {
  private ws: WebSocket | null = null;
  private connected: boolean = false;
  private tools: McpTool[] = [];
  private messageId: number = 0;
  private pendingRequests = new Map<number, { resolve: Function; reject: Function }>();
  private serverUrl: string = '';
  private selectedLanguage: SupportedLanguage = 'en';

  async connect(serverConfig: McpServerConfig): Promise<void> {
    try {
      // For WebSocket connection, we'll use a fixed URL to your .NET server
      this.serverUrl = 'ws://localhost:5000/mcp';
      
      // Set language from server config
      if (serverConfig.language) {
        this.selectedLanguage = serverConfig.language;
      }
      
      console.log('Connecting to MCP WebSocket server:', this.serverUrl);
      
      await this.connectWebSocket();
      await this.initializeConnection();
      
      this.connected = true;
      console.log('Successfully connected to MCP WebSocket server');
    } catch (error: any) {
      throw new McpError(`Failed to connect to MCP server: ${error.message}`, 'CONNECTION_FAILED');
    }
  }

  private connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.serverUrl);
      
      this.ws.onopen = () => {
        console.log('WebSocket connection established');
        resolve();
      };
      
      this.ws.onmessage = (event) => {
        try {
          const response = JSON.parse(event.data);
          console.log('Received MCP response:', response);
          
          if (response.id !== undefined) {
            const request = this.pendingRequests.get(response.id);
            if (request) {
              this.pendingRequests.delete(response.id);
              if (response.error) {
                request.reject(new Error(response.error.message));
              } else {
                request.resolve(response.result);
              }
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };
      
      this.ws.onclose = () => {
        console.log('WebSocket connection closed');
        this.connected = false;
      };
    });
  }

  private async initializeConnection(): Promise<void> {
    // Initialize the MCP connection
    try {
      await this.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {
          roots: { listChanged: true },
          sampling: {}
        },
        clientInfo: {
          name: 'cats-mcp-react-client',
          version: '1.0.0'
        }
      });
      
      // List available tools
      const toolsResponse = await this.sendRequest('tools/list');
      this.tools = toolsResponse.tools || [];
      console.log('Available tools:', this.tools);
    } catch (error) {
      console.error('Failed to initialize MCP connection:', error);
      throw error;
    }
  }

  private async sendRequest(method: string, params: any = {}): Promise<any> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    const id = ++this.messageId;
    const message = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    console.log('Sending MCP request:', message);

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.ws!.send(JSON.stringify(message));
      
      // Set timeout for requests
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000); // 30 second timeout
    });
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.tools = [];
    this.pendingRequests.clear();
    console.log('Disconnected from MCP WebSocket server');
  }

  async listTools(): Promise<McpTool[]> {
    if (!this.connected) {
      throw new McpError('Not connected to MCP server', 'NOT_CONNECTED');
    }
    return this.tools;
  }

  async callTool(name: string, parameters: Record<string, any>, language?: SupportedLanguage): Promise<McpToolResult> {
    if (!this.connected) {
      throw new McpError('Not connected to MCP server', 'NOT_CONNECTED');
    }

    try {
      // Add language parameter if not provided
      const toolParams = {
        ...parameters,
        language: language || parameters.language || this.selectedLanguage
      };
      
      console.log(`Calling tool: ${name} with parameters:`, toolParams);
      
      const result = await this.sendRequest('tools/call', {
        name,
        arguments: toolParams
      });

      // Parse the result content if it's JSON
      let parsedResult = result;
      if (result.content && result.content[0] && result.content[0].text) {
        try {
          parsedResult = JSON.parse(result.content[0].text);
        } catch (e) {
          // If not JSON, use the text as-is
          parsedResult = result.content[0].text;
        }
      }

      return {
        success: true,
        result: parsedResult
      };
    } catch (error: any) {
      console.error('Tool call failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  setLanguage(language: SupportedLanguage): void {
    this.selectedLanguage = language;
  }
}
