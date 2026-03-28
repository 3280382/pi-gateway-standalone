/**
 * MessageItem Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MessageItem } from './MessageItem';
import type { Message } from '../../../types/chat';

describe('MessageItem', () => {
  const mockMessage: Message = {
    id: 'msg-1',
    role: 'assistant',
    content: [{ type: 'text', text: 'Hello world' }],
    timestamp: new Date(),
    isMessageCollapsed: false,
    isThinkingCollapsed: false,
  };

  const mockUserMessage: Message = {
    id: 'msg-2',
    role: 'user',
    content: [{ type: 'text', text: 'Hi there' }],
    timestamp: new Date(),
  };

  const defaultProps = {
    message: mockMessage,
    showThinking: true,
    onToggleCollapse: vi.fn(),
    onToggleThinking: vi.fn(),
  };

  it('renders assistant message correctly', () => {
    render(<MessageItem {...defaultProps} />);
    expect(screen.getByText('AI')).toBeInTheDocument();
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('renders user message correctly', () => {
    render(<MessageItem {...defaultProps} message={mockUserMessage} />);
    expect(screen.getByText('You')).toBeInTheDocument();
    expect(screen.getByText('Hi there')).toBeInTheDocument();
  });

  it('calls onToggleCollapse when collapse button clicked', () => {
    render(<MessageItem {...defaultProps} />);
    const collapseBtn = screen.getByTitle('Collapse');
    fireEvent.click(collapseBtn);
    expect(defaultProps.onToggleCollapse).toHaveBeenCalled();
  });

  it('renders thinking block when present and showThinking is true', () => {
    const messageWithThinking: Message = {
      ...mockMessage,
      content: [
        { type: 'thinking', thinking: 'Let me think...' },
        { type: 'text', text: 'Result' },
      ],
    };
    render(<MessageItem {...defaultProps} message={messageWithThinking} />);
    expect(screen.getByText('thinking')).toBeInTheDocument();
    expect(screen.getByText('Let me think...')).toBeInTheDocument();
  });

  it('hides thinking block when showThinking is false', () => {
    const messageWithThinking: Message = {
      ...mockMessage,
      content: [
        { type: 'thinking', thinking: 'Let me think...' },
        { type: 'text', text: 'Result' },
      ],
    };
    render(<MessageItem {...defaultProps} message={messageWithThinking} showThinking={false} />);
    expect(screen.queryByText('thinking')).not.toBeInTheDocument();
  });
});
