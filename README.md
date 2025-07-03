# MCP React TypeScript Client

A ReactJS client built with TypeScript for the Model Context Protocol (MCP) that supports multiple LLM providers including Anthropic Claude, OpenAI GPT, and local models via Ollama (like DeepSeek).

## Overview

This React application provides a web-based interface for connecting to MCP servers and interacting with their tools through various LLM providers. It's based on the C# QuickstartClient but implemented in TypeScript/React for web browsers with support for both remote and local AI models.

## Features

- **Multi-LLM Support**: Choose between Anthropic Claude, OpenAI GPT, or local models via Ollama
- **MCP Server Connection**: Connect to MCP servers using stdio transport
- **Tool Discovery**: Automatically discover and display available tools from connected servers
- **AI Integration**: Use function calling to interact with MCP tools through your chosen LLM
- **Real-time Chat**: Interactive chat interface for natural language tool interaction
- **TypeScript**: Fully typed codebase for better development experience
- **Modern UI**: Clean, responsive design with real-time status updates

## Supported LLM Providers

### 🤖 Anthropic Claude
- Claude 3.5 Sonnet
- Claude 3 Haiku
- Claude 3 Opus
- Requires API key from [Anthropic Console](https://console.anthropic.com/)

### 🧠 OpenAI
- GPT-4 Turbo
- GPT-4
- GPT-3.5 Turbo
- Requires API key from [OpenAI Platform](https://platform.openai.com/)

### 🏠 Ollama (Local)
- DeepSeek Coder (recommended)
- Llama 2
- Mistral
- Code Llama
- Any other Ollama-supported model
- Requires [Ollama](https://ollama.ai/) running locally

## Architecture

The application consists of several key components:

### Components (TypeScript)
- **App.tsx**: Main application component managing state and orchestration
- **ConnectionManager.tsx**: Handles MCP server connection and LLM provider configuration
- **ToolsList.tsx**: Displays available tools from the connected server
- **ChatInterface.tsx**: Provides the chat UI for interacting with LLMs + MCP tools

### Services (TypeScript)
- **McpClient.ts**: Manages connection and communication with MCP servers
- **LLMServiceFactory.ts**: Factory for creating LLM service instances
- **AnthropicService.ts**: Handles Claude API integration with function calling
- **OpenAIService.ts**: Handles OpenAI API integration with function calling
- **OllamaService.ts**: Handles local Ollama models with custom function calling

### Types
- **types/index.ts**: Comprehensive TypeScript type definitions for all interfaces

## Setup

### Prerequisites

1. **Node.js** (version 16 or higher)
2. **One of the following**:
   - **Anthropic API Key** - Get one from [Anthropic Console](https://console.anthropic.com/)
   - **OpenAI API Key** - Get one from [OpenAI Platform](https://platform.openai.com/)
   - **Ollama** - Install from [ollama.ai](https://ollama.ai/) for local models
3. **MCP Server** - You'll need an MCP server to connect to

### For Local LLM Setup (Ollama + DeepSeek)

1. Install Ollama from [ollama.ai](https://ollama.ai/)
2. Pull the DeepSeek Coder model:
   ```bash
   ollama pull deepseek-coder
   ```
3. Start Ollama server (usually runs automatically):
   ```bash
   ollama serve
   ```
4. Verify it's running by visiting `http://localhost:11434`

### Installation

1. Navigate to the project directory:
   ```bash
   cd mcp-react-client
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

4. Open your browser to `http://localhost:3000`

## Environment Configuration

You can optionally configure the application using environment variables to avoid entering API keys in the UI every time.

### Setting Up Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your API keys:
   ```bash
   # LLM Provider API Keys
   VITE_ANTHROPIC_API_KEY=your_anthropic_api_key_here
   VITE_OPENAI_API_KEY=your_openai_api_key_here
   
   # Ollama Configuration
   VITE_OLLAMA_BASE_URL=http://localhost:11434
   
   # MCP Server Configuration (optional defaults)
   VITE_DEFAULT_SERVER_COMMAND=python
   VITE_DEFAULT_SERVER_ARGS=../QuickstartWeatherServer/server.py
   
   # Default LLM Provider
   VITE_DEFAULT_LLM_PROVIDER=anthropic
   
   # Default Models
   VITE_DEFAULT_ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
   VITE_DEFAULT_OPENAI_MODEL=gpt-4-turbo-preview
   VITE_DEFAULT_OLLAMA_MODEL=deepseek-coder
   ```

3. Restart the development server after changing environment variables

### Environment Variable Benefits

- **Security**: Keep API keys out of the UI
- **Convenience**: Pre-fill form fields with your preferred settings
- **Team Setup**: Share default configurations without exposing credentials
- **CI/CD**: Easy integration with deployment pipelines

**Note**: When environment variables are set, the UI will show "(loaded from environment)" and you can still override them if needed.

## Usage

### Connecting to an MCP Server

1. **Choose your LLM Provider**:
   - **Anthropic**: Enter your API key
   - **OpenAI**: Enter your API key  
   - **Ollama**: Enter the Ollama server URL (default: `http://localhost:11434`)

2. **Select the Model**:
   - **Anthropic**: Claude 3.5 Sonnet, Claude 3 Haiku, Claude 3 Opus
   - **OpenAI**: GPT-4 Turbo, GPT-4, GPT-3.5 Turbo
   - **Ollama**: DeepSeek Coder, Llama 2, Mistral, Code Llama

3. **Configure the MCP Server**:
   - **Server Type**: Currently supports "stdio" transport
   - **Server Command**: The command to start your MCP server (e.g., `python`, `node`, `dotnet`)
   - **Server Arguments**: Arguments to pass to the command (e.g., `server.py`, `run --project ../server`)

4. **Click Connect** to establish the connection

### Example Server Configurations

#### Python MCP Server
- **LLM Provider**: Anthropic (or your choice)
- **Command**: `python`
- **Arguments**: `path/to/your/server.py`

#### Node.js MCP Server
- **LLM Provider**: OpenAI
- **Command**: `node`
- **Arguments**: `path/to/your/server.js`

#### .NET MCP Server with Local DeepSeek
- **LLM Provider**: Ollama
- **Model**: DeepSeek Coder
- **Command**: `dotnet`
- **Arguments**: `run --project path/to/your/server`

### Using the Chat Interface

Once connected, you can interact with the MCP tools through natural language:

- **Example with Claude**: "What's the weather in San Francisco?"
- **Example with DeepSeek**: "Calculate 15 * 23 + 7"
- **Example with GPT-4**: "Get me a list of cats from the server"
- **Example**: "Echo hello world"

The chosen LLM will automatically determine which tools to use based on your requests and execute them through the MCP server.

## Important Notes

### Browser Limitations

This implementation includes some important limitations due to browser security restrictions:

1. **CORS Issues**: The Anthropic SDK uses `dangerouslyAllowBrowser: true` which is only suitable for development
2. **No Stdio Transport**: Browsers cannot directly execute processes or use stdio transport
3. **Mock Implementation**: The MCP client includes mock responses for demonstration

### Production Considerations

For a production deployment, you would need:

1. **Backend Proxy**: A server-side proxy to handle MCP server communication
2. **WebSocket Transport**: Replace stdio transport with WebSocket-based communication
3. **Secure API Key Handling**: Store API keys securely on the backend
4. **Real MCP Protocol**: Implement the full MCP protocol specification

## Development

### Project Structure

```
src/
├── components/
│   ├── ConnectionManager.tsx
│   ├── ToolsList.tsx
│   └── ChatInterface.tsx
├── services/
│   ├── McpClient.ts
│   ├── LLMServiceFactory.ts
│   ├── AnthropicService.ts
│   ├── OpenAIService.ts
│   └── OllamaService.ts
├── types/
│   └── index.ts
├── App.tsx
├── index.tsx
└── index.css
```

### Key Technologies

- **React 18**: Modern React with hooks and TypeScript
- **TypeScript**: Full type safety and better developer experience
- **Anthropic SDK**: Official SDK for Claude API integration
- **OpenAI SDK**: Official SDK for GPT API integration
- **Axios**: HTTP client for Ollama API communication
- **UUID**: For generating unique message IDs

### Running the Development Server

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm start
   ```

3. Open your browser to `http://localhost:3000`

4. For TypeScript type checking:
   ```bash
   npm run type-check
   ```

## Future Enhancements

- Implement WebSocket-based MCP transport
- Add support for more MCP server types
- Implement real-time streaming responses for all providers
- Add tool execution history and logging
- Support for multiple concurrent MCP connections
- Enhanced error handling and retry logic
- Support for more Ollama models
- Add model switching during conversation
- Implement conversation export/import
- Add dark/light theme toggle

## Contributing

This is a demonstration project showing how to build a web-based MCP client with multi-LLM support. Feel free to extend it with additional features or adapt it for your specific use case.

## Why Local LLMs?

The inclusion of Ollama support with models like DeepSeek Coder provides several advantages:

- **Privacy**: Your conversations stay completely local
- **Cost**: No API fees for usage
- **Speed**: Potentially faster responses depending on your hardware
- **Offline**: Works without internet connectivity
- **Customization**: Fine-tune models for specific use cases

## License

This project is provided as an example implementation for educational and proof-of-concept purposes.
