/**
 * HTTP REST client for connecting to your .NET MCP server
 * Uses the REST API endpoints instead of WebSocket MCP protocol
 */
import { McpClientInterface, McpServerConfig, McpTool, McpToolResult, McpError, SupportedLanguage } from '../types';
import { getTranslation } from '../config/languages';

export class HttpMcpClient implements McpClientInterface {
  private connected: boolean = false;
  private tools: McpTool[] = [];
  private baseUrl: string = 'http://localhost:5000/api';
  private selectedLanguage: SupportedLanguage = 'en';

  async connect(serverConfig: McpServerConfig): Promise<void> {
    try {
      console.log('Connecting to MCP HTTP server:', this.baseUrl);
      
      // Set language from server config
      if (serverConfig.language) {
        this.selectedLanguage = serverConfig.language;
      }
      
      // Test connection and get available tools
      await this.fetchAvailableTools();
      
      this.connected = true;
      console.log('Successfully connected to MCP HTTP server');
    } catch (error: any) {
      throw new McpError(`Failed to connect to MCP server: ${error.message}`, 'CONNECTION_FAILED');
    }
  }

  private async fetchAvailableTools(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/mcp/tools`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // We expect tools data but will use predefined tools for now
      await response.json();
      
      // Convert HTTP API tools to MCP tool format
      this.tools = [
        {
          name: 'GetCats',
          description: getTranslation(this.selectedLanguage, 'getCatsDescription'),
          inputSchema: {
            type: 'object',
            properties: {
              language: {
                type: 'string',
                description: 'Language for the response (en/es)',
                enum: ['en', 'es'],
                default: this.selectedLanguage
              }
            },
            required: []
          }
        },
        {
          name: 'GetCat',
          description: getTranslation(this.selectedLanguage, 'getCatDescription'),
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'The name of the cat to get details for'
              },
              language: {
                type: 'string',
                description: 'Language for the response (en/es)',
                enum: ['en', 'es'],
                default: this.selectedLanguage
              }
            },
            required: ['name']
          }
        }
      ];
      
      console.log('Available tools loaded:', this.tools);
    } catch (error) {
      console.error('Failed to fetch tools:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.tools = [];
    console.log('Disconnected from MCP HTTP server');
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
      console.log(`Calling tool: ${name} with parameters:`, parameters);
      
      // Add language parameter if not provided
      const toolParams = {
        ...parameters,
        language: language || parameters.language || this.selectedLanguage
      };
      
      console.log(`Calling tool with language: ${toolParams.language}`, toolParams);
      
      let result: any;
      
      switch (name) {
        case 'GetCats':
          result = await this.getCats(toolParams.language);
          break;
          
        case 'GetCat':
          if (!parameters.name) {
            throw new Error('Cat name is required');
          }
          result = await this.getCat(parameters.name, toolParams.language);
          break;
          
        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        success: true,
        result: result
      };
    } catch (error: any) {
      console.error('Tool call failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  private async getCats(language: string = 'en'): Promise<any> {
    const url = `${this.baseUrl}/cats${language !== 'en' ? `?language=${language}` : ''}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch cats: ${response.statusText}`);
    }
    return await response.json();
  }

  private async getCat(name: string, language: string = 'en'): Promise<any> {
    const url = `${this.baseUrl}/cats/${encodeURIComponent(name)}${language !== 'en' ? `?language=${language}` : ''}`;
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Cat named '${name}' not found`);
      }
      throw new Error(`Failed to fetch cat: ${response.statusText}`);
    }
    return await response.json();
  }

  setLanguage(language: SupportedLanguage): void {
    this.selectedLanguage = language;
    // Refresh tools with new language descriptions
    if (this.connected) {
      this.fetchAvailableTools().catch(console.error);
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}
