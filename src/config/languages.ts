import { LanguageConfig, SupportedLanguage } from '../types';

export const SUPPORTED_LANGUAGES: LanguageConfig[] = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English'
  },
  {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español'
  }
];

export const UI_TRANSLATIONS = {
  en: {
    // Connection Manager
    serverConnection: 'Server Connection & LLM Configuration',
    mcpServerSettings: 'MCP Server Settings',
    serverType: 'Server Type',
    serverCommand: 'Server Command',
    serverArguments: 'Server Arguments',
    llmSettings: 'LLM Provider Settings',
    llmProvider: 'LLM Provider',
    apiKey: 'API Key',
    model: 'Model',
    baseUrl: 'Base URL',
    language: 'Language',
    connect: 'Connect',
    disconnect: 'Disconnect',
    
    // Tools List
    availableTools: 'Available Tools',
    parameters: 'Parameters',
    
    // Chat Interface
    chatWithLlm: 'Chat with LLM + MCP Tools',
    mcpClientReady: 'MCP Client Ready! You can now interact with the connected tools through your chosen LLM.',
    typeMessage: 'Type your message here...',
    send: 'Send',
    
    // Status Messages
    connecting: 'Connecting to MCP server...',
    connected: 'Connected to server with {count} tools using {provider}',
    disconnected: 'Disconnected from server',
    connectionFailed: 'Connection failed: {error}',
    
    // Tool Descriptions
    getCatsDescription: 'Get a list of all cats from the database',
    getCatDescription: 'Get a specific cat by name'
  },
  es: {
    // Connection Manager
    serverConnection: 'Conexión del Servidor y Configuración LLM',
    mcpServerSettings: 'Configuración del Servidor MCP',
    serverType: 'Tipo de Servidor',
    serverCommand: 'Comando del Servidor',
    serverArguments: 'Argumentos del Servidor',
    llmSettings: 'Configuración del Proveedor LLM',
    llmProvider: 'Proveedor LLM',
    apiKey: 'Clave API',
    model: 'Modelo',
    baseUrl: 'URL Base',
    language: 'Idioma',
    connect: 'Conectar',
    disconnect: 'Desconectar',
    
    // Tools List
    availableTools: 'Herramientas Disponibles',
    parameters: 'Parámetros',
    
    // Chat Interface
    chatWithLlm: 'Chat con LLM + Herramientas MCP',
    mcpClientReady: '¡Cliente MCP Listo! Ahora puedes interactuar con las herramientas conectadas a través de tu LLM elegido.',
    typeMessage: 'Escribe tu mensaje aquí...',
    send: 'Enviar',
    
    // Status Messages
    connecting: 'Conectando al servidor MCP...',
    connected: 'Conectado al servidor con {count} herramientas usando {provider}',
    disconnected: 'Desconectado del servidor',
    connectionFailed: 'Falló la conexión: {error}',
    
    // Tool Descriptions
    getCatsDescription: 'Obtener una lista de todos los gatos de la base de datos',
    getCatDescription: 'Obtener un gato específico por nombre'
  }
};

export function getTranslation(language: SupportedLanguage, key: string, interpolations?: Record<string, string>): string {
  const translations = UI_TRANSLATIONS[language];
  let text = (translations as any)[key] || key;
  
  if (interpolations) {
    Object.entries(interpolations).forEach(([placeholder, value]) => {
      text = text.replace(`{${placeholder}}`, value);
    });
  }
  
  return text;
}

export function getLanguageConfig(code: SupportedLanguage): LanguageConfig {
  return SUPPORTED_LANGUAGES.find(lang => lang.code === code) || SUPPORTED_LANGUAGES[0];
}
