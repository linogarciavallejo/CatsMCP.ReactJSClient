import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ChatInterfaceProps, ChatMessage } from '../types';
import { getTranslation } from '../config/languages';

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

  return (    <div className="chat-section">
      <div className="chat-header">
        <h2>{getTranslation(language, 'chatWithLlm')}</h2>
      </div>

      <div className="chat-messages">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.type}`}>
            <div className="message-content">
              {message.content}
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
