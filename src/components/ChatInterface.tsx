import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import { ChatInterfaceProps, ChatMessage } from '../types';
import { getTranslation } from '../config/languages';

// Import highlight.js CSS for syntax highlighting
import 'highlight.js/styles/github.css';

const ChatInterface: React.FC<ChatInterfaceProps> = ({ llmService, language = 'en' }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uuidv4(),
      type: 'system',
      content: getTranslation(language, 'mcpClientReady'),
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showDebugPanel, setShowDebugPanel] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputValue.trim() || isLoading || !llmService) {
      return;
    }

    const userMessage: ChatMessage = {
      id: uuidv4(),
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Add a placeholder for the assistant message
      const assistantMessageId = uuidv4();
      setMessages(prev => [...prev, {
        id: assistantMessageId,
        type: 'assistant',
        content: '',
        timestamp: new Date()
      }]);

      // Stream the response
      const response = await llmService.sendMessage(userMessage.content);
      
      // Update the assistant message with the response
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, content: response }
          : msg
      ));
    } catch (error: any) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        id: uuidv4(),
        type: 'system',
        content: `Error: ${error.message}`,
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimestamp = (timestamp: Date): string => {
    return timestamp.toLocaleTimeString();
  };

  const clearHistory = () => {
    if (llmService) {
      llmService.clearHistory();
      setMessages([{
        id: uuidv4(),
        type: 'system',
        content: getTranslation(language, 'mcpClientReady'),
        timestamp: new Date()
      }]);
    }
  };

  const getConversationStats = () => {
    if (llmService && 'getConversationStats' in llmService) {
      return (llmService as any).getConversationStats();
    }
    return null;
  };

  const stats = getConversationStats();

  return (
    <div className="chat-section">
      <div className="chat-header">
        <h2>{getTranslation(language, 'chatWithLlm')}</h2>
        <div className="chat-controls" style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => setShowDebugPanel(!showDebugPanel)}
            className="btn"
            style={{ fontSize: '0.8em', padding: '5px 10px' }}
          >
            {showDebugPanel ? 'Hide Debug' : 'Show Debug'}
          </button>
          <button 
            onClick={clearHistory}
            className="btn"
            style={{ fontSize: '0.8em', padding: '5px 10px' }}
          >
            Clear History
          </button>
        </div>
      </div>

      {showDebugPanel && stats && (
        <div className="debug-panel" style={{
          backgroundColor: '#f5f5f5',
          padding: '10px',
          margin: '10px 0',
          borderRadius: '5px',
          fontSize: '0.9em'
        }}>
          <h4>Conversation Statistics</h4>
          <div>Messages: {stats.messageCount}</div>
          <div>Estimated Tokens: {stats.estimatedTokens}</div>
          <div>Tool Tokens: {stats.toolTokens}</div>
          <div>Model Limit: {stats.modelLimit}</div>
          <div>Available Tokens: {stats.availableTokens}</div>
          <div>Usage: {Math.round((stats.estimatedTokens / stats.availableTokens) * 100)}%</div>
        </div>
      )}

      <div className="chat-messages">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.type}`}>
            <div className="message-content">
              {message.type === 'assistant' ? (
                <ReactMarkdown
                  rehypePlugins={[rehypeHighlight]}
                  components={{
                    // Custom components for better styling
                    h1: ({ children }) => <h1 style={{ fontSize: '1.5em', marginBottom: '0.5em', color: '#2c3e50' }}>{children}</h1>,
                    h2: ({ children }) => <h2 style={{ fontSize: '1.3em', marginBottom: '0.5em', color: '#34495e' }}>{children}</h2>,
                    h3: ({ children }) => <h3 style={{ fontSize: '1.1em', marginBottom: '0.5em', color: '#7f8c8d' }}>{children}</h3>,
                    p: ({ children }) => <p style={{ marginBottom: '1em', lineHeight: '1.6' }}>{children}</p>,
                    ul: ({ children }) => <ul style={{ marginLeft: '1.5em', marginBottom: '1em' }}>{children}</ul>,
                    ol: ({ children }) => <ol style={{ marginLeft: '1.5em', marginBottom: '1em' }}>{children}</ol>,
                    li: ({ children }) => <li style={{ marginBottom: '0.5em' }}>{children}</li>,
                    strong: ({ children }) => <strong style={{ color: '#2c3e50', fontWeight: 'bold' }}>{children}</strong>,
                    em: ({ children }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
                    code: ({ children, className }) => {
                      const isInline = !className;
                      return isInline ? (
                        <code style={{ 
                          backgroundColor: '#f8f9fa', 
                          padding: '2px 4px', 
                          borderRadius: '3px', 
                          fontSize: '0.9em',
                          color: '#e74c3c'
                        }}>{children}</code>
                      ) : (
                        <code className={className}>{children}</code>
                      );
                    },
                    pre: ({ children }) => (
                      <pre style={{ 
                        backgroundColor: '#f8f9fa', 
                        padding: '1em', 
                        borderRadius: '5px', 
                        overflow: 'auto',
                        marginBottom: '1em',
                        border: '1px solid #e9ecef'
                      }}>{children}</pre>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote style={{ 
                        borderLeft: '4px solid #3498db', 
                        marginLeft: '0', 
                        paddingLeft: '1em', 
                        color: '#7f8c8d',
                        fontStyle: 'italic'
                      }}>{children}</blockquote>
                    ),
                    table: ({ children }) => (
                      <table style={{ 
                        width: '100%', 
                        borderCollapse: 'collapse', 
                        marginBottom: '1em',
                        border: '1px solid #dee2e6'
                      }}>{children}</table>
                    ),
                    th: ({ children }) => (
                      <th style={{ 
                        border: '1px solid #dee2e6', 
                        padding: '0.5em', 
                        backgroundColor: '#f8f9fa',
                        fontWeight: 'bold'
                      }}>{children}</th>
                    ),
                    td: ({ children }) => (
                      <td style={{ 
                        border: '1px solid #dee2e6', 
                        padding: '0.5em'
                      }}>{children}</td>
                    ),
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              ) : (
                message.content
              )}
            </div>
            <div className="message-time" style={{ 
              fontSize: '0.8rem', 
              opacity: 0.7, 
              marginTop: '0.5rem' 
            }}>
              {formatTimestamp(message.timestamp)}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="message assistant">
            <span className="loading"></span> LLM is thinking...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="chat-input">
        <form onSubmit={handleSubmit}>
          <div className="input-container">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={getTranslation(language, 'typeMessage')}
              disabled={isLoading}
            />
            <button 
              type="submit" 
              className="btn"
              disabled={isLoading || !inputValue.trim()}
            >
              {getTranslation(language, 'send')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;
