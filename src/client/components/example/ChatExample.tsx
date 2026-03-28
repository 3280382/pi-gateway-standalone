/**
 * Chat Example - 展示新架构用法的示例组件
 */

import React, { useState, useCallback } from 'react';
import { Button } from '../ui/Button/Button';
import { Input } from '../ui/Input/Input';
import { Select } from '../ui/Select/Select';
import { chatController } from '../../controllers/chat.controller';
import { useNewChatStore, chatStoreSelectors } from '../../store/new-chat.store';
import { MessageModel } from '../../models/message.model';

export function ChatExample() {
  // 从store获取状态
  const { messages, isStreaming, inputText, setInputText } = useNewChatStore();
  const [selectedModel, setSelectedModel] = useState<string>('kimi-k2.5');
  const [models, setModels] = useState<Array<{ value: string; label: string }>>([]);
  
  // 加载可用模型
  const loadModels = useCallback(async () => {
    try {
      const availableModels = await chatController.getAvailableModels();
      const modelOptions = availableModels.map(model => ({
        value: model.id,
        label: `${model.name} (${model.provider})`
      }));
      setModels(modelOptions);
    } catch (error) {
      console.error('Failed to load models:', error);
    }
  }, []);
  
  // 发送消息
  const handleSend = useCallback(async () => {
    if (!inputText.trim()) return;
    
    try {
      // 设置模型
      await chatController.setCurrentModel(selectedModel);
      
      // 发送消息
      await chatController.sendMessage(inputText);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  }, [inputText, selectedModel]);
  
  // 中止生成
  const handleAbort = useCallback(async () => {
    await chatController.abortGeneration();
  }, []);
  
  // 清除聊天
  const handleClear = useCallback(async () => {
    await chatController.clearChatHistory();
  }, []);
  
  // 输入处理
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
  }, [setInputText]);
  
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);
  
  // 消息渲染
  const renderMessage = useCallback((message: MessageModel) => {
    const isUser = message.role === 'user';
    
    return (
      <div
        key={message.id}
        className={`message ${isUser ? 'message-user' : 'message-assistant'}`}
      >
        <div className="message-header">
          <span className="message-role">{isUser ? '👤 You' : '🤖 AI'}</span>
          <span className="message-time">{message.formatTime()}</span>
        </div>
        <div className="message-content">
          {message.getTextContent()}
        </div>
        {message.hasTools() && (
          <div className="message-tools">
            <span className="tools-badge">Tools used: {message.getToolContent().length}</span>
          </div>
        )}
      </div>
    );
  }, []);
  
  return (
    <div className="chat-example">
      <div className="chat-header">
        <h3>Chat Example</h3>
        <div className="chat-controls">
          <Select
            options={models}
            value={selectedModel}
            onChange={setSelectedModel}
            placeholder="Select model"
            size="small"
            onFocus={loadModels}
          />
          <Button
            variant="ghost"
            size="small"
            onClick={handleClear}
            disabled={messages.length === 0}
          >
            Clear Chat
          </Button>
        </div>
      </div>
      
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="empty-state">
            <p>No messages yet. Start a conversation!</p>
          </div>
        ) : (
          messages.map(msg => renderMessage(new MessageModel(msg)))
        )}
        
        {isStreaming && (
          <div className="streaming-indicator">
            <div className="typing-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <p>AI is thinking...</p>
            <Button
              variant="outline"
              size="small"
              onClick={handleAbort}
              className="abort-button"
            >
              Stop
            </Button>
          </div>
        )}
      </div>
      
      <div className="chat-input-area">
        <Input
          value={inputText}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          placeholder="Type your message here..."
          fullWidth
          rightIcon={
            <Button
              variant="primary"
              onClick={handleSend}
              disabled={!inputText.trim() || isStreaming}
              loading={isStreaming}
            >
              Send
            </Button>
          }
        />
      </div>
      
      <style jsx>{`
        .chat-example {
          display: flex;
          flex-direction: column;
          height: 600px;
          border: 1px solid var(--color-border);
          border-radius: 12px;
          background-color: var(--color-bg);
          overflow: hidden;
        }
        
        .chat-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          border-bottom: 1px solid var(--color-border);
          background-color: var(--color-bg-secondary);
        }
        
        .chat-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
        }
        
        .chat-controls {
          display: flex;
          gap: 12px;
          align-items: center;
        }
        
        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }
        
        .empty-state {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--color-text-secondary);
          font-style: italic;
        }
        
        .message {
          margin-bottom: 16px;
          padding: 12px;
          border-radius: 8px;
          background-color: var(--color-bg-secondary);
        }
        
        .message-user {
          border-left: 4px solid var(--color-primary);
        }
        
        .message-assistant {
          border-left: 4px solid var(--color-success);
        }
        
        .message-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 12px;
          color: var(--color-text-secondary);
        }
        
        .message-role {
          font-weight: 600;
        }
        
        .message-content {
          line-height: 1.5;
          white-space: pre-wrap;
          word-break: break-word;
        }
        
        .message-tools {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid var(--color-border);
        }
        
        .tools-badge {
          display: inline-block;
          padding: 2px 8px;
          background-color: var(--color-primary-alpha);
          border-radius: 12px;
          font-size: 11px;
          font-weight: 500;
        }
        
        .streaming-indicator {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background-color: var(--color-bg-secondary);
          border-radius: 8px;
          border: 1px solid var(--color-primary-alpha);
        }
        
        .typing-dots {
          display: flex;
          gap: 4px;
        }
        
        .typing-dots span {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: var(--color-primary);
          animation: bounce 1.4s infinite ease-in-out both;
        }
        
        .typing-dots span:nth-child(1) {
          animation-delay: -0.32s;
        }
        
        .typing-dots span:nth-child(2) {
          animation-delay: -0.16s;
        }
        
        @keyframes bounce {
          0%, 80%, 100% {
            transform: scale(0);
          }
          40% {
            transform: scale(1.0);
          }
        }
        
        .abort-button {
          margin-left: auto;
        }
        
        .chat-input-area {
          padding: 16px;
          border-top: 1px solid var(--color-border);
          background-color: var(--color-bg-secondary);
        }
      `}</style>
    </div>
  );
}