import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

const ChatInterface = ({ anthropicService, mcpClient }) => {
  const [messages, setMessages] = useState([
    {
      id: uuidv4(),
      type: 'system',
      content: 'MCP Client Ready! You can now interact with the connected tools through Claude.',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!inputValue.trim() || isLoading) {
      return;
    }

    const userMessage = {
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
      const response = await anthropicService.sendMessage(userMessage.content);
      
      // Update the assistant message with the response
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, content: response }
          : msg
      ));
    } catch (error) {
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

  const formatTimestamp = (timestamp) => {
    return timestamp.toLocaleTimeString();
  };

  return (
    <div className="chat-section">
      <div className="chat-header">
        <h2>Chat with Claude + MCP Tools</h2>
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
            <span className="loading"></span> Claude is thinking...
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
              placeholder="Ask Claude to use the available tools..."
              disabled={isLoading}
            />
            <button 
              type="submit" 
              className="btn"
              disabled={isLoading || !inputValue.trim()}
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;
