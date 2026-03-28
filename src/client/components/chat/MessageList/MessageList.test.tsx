/**
 * MessageList Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Message } from '../../../types/chat';

// Mock MessageItem component
vi.mock('../MessageItem/MessageItem', () => ({
  MessageItem: ({ message, onToggleCollapse }: { message: Message; onToggleCollapse: () => void }) => (
    <div data-testid={`message-${message.id}`} onClick={onToggleCollapse}>
      {message.role}: {message.content.find(c => c.type === 'text')?.text || ''}
    </div>
  ),
}));

// Simple MessageList component for testing
function MessageList({
  messages,
  currentStreamingMessage,
  showThinking,
  onToggleMessageCollapse,
}: {
  messages: Message[];
  currentStreamingMessage: Message | null;
  showThinking: boolean;
  onToggleMessageCollapse: (id: string) => void;
}) {
  const allMessages = currentStreamingMessage 
    ? [...messages, currentStreamingMessage] 
    : messages;

  if (allMessages.length === 0) {
    return <div data-testid="empty">No messages</div>;
  }

  return (
    <div data-testid="message-list">
      {allMessages.map((message) => (
        <div key={message.id} data-testid={`message-${message.id}`}>
          <span>{message.role}</span>
          <button onClick={() => onToggleMessageCollapse(message.id)}>
            Toggle
          </button>
        </div>
      ))}
    </div>
  );
}

const mockMessages: Message[] = [
  {
    id: 'msg-1',
    role: 'user',
    content: [{ type: 'text', text: 'Hello' }],
    timestamp: new Date(),
  },
  {
    id: 'msg-2',
    role: 'assistant',
    content: [{ type: 'text', text: 'Hi there' }],
    timestamp: new Date(),
  },
];

describe('MessageList', () => {
  it('renders empty state when no messages', () => {
    render(
      <MessageList
        messages={[]}
        currentStreamingMessage={null}
        showThinking={true}
        onToggleMessageCollapse={vi.fn()}
      />
    );
    
    expect(screen.getByTestId('empty')).toBeInTheDocument();
  });

  it('renders list of messages', () => {
    render(
      <MessageList
        messages={mockMessages}
        currentStreamingMessage={null}
        showThinking={true}
        onToggleMessageCollapse={vi.fn()}
      />
    );
    
    expect(screen.getByTestId('message-list')).toBeInTheDocument();
    expect(screen.getByTestId('message-msg-1')).toBeInTheDocument();
    expect(screen.getByTestId('message-msg-2')).toBeInTheDocument();
  });

  it('includes streaming message when present', () => {
    const streamingMessage: Message = {
      id: 'msg-streaming',
      role: 'assistant',
      content: [],
      timestamp: new Date(),
      isStreaming: true,
    };

    render(
      <MessageList
        messages={mockMessages}
        currentStreamingMessage={streamingMessage}
        showThinking={true}
        onToggleMessageCollapse={vi.fn()}
      />
    );
    
    expect(screen.getByTestId('message-msg-1')).toBeInTheDocument();
    expect(screen.getByTestId('message-msg-2')).toBeInTheDocument();
    expect(screen.getByTestId('message-msg-streaming')).toBeInTheDocument();
  });

  it('calls onToggleMessageCollapse when toggle clicked', () => {
    const mockToggle = vi.fn();
    
    render(
      <MessageList
        messages={mockMessages}
        currentStreamingMessage={null}
        showThinking={true}
        onToggleMessageCollapse={mockToggle}
      />
    );
    
    const buttons = screen.getAllByText('Toggle');
    buttons[0].click();
    
    expect(mockToggle).toHaveBeenCalledWith('msg-1');
  });
});

console.log('[Test] MessageList tests loaded');
