/**
 * TopBar Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TopBar } from './TopBar';
import * as modalStore from '../../../store/modalStore';

// Mock the modal store
vi.mock('../../../store/modalStore', () => ({
  useModalStore: vi.fn(),
}));

// Mock sidebar store
vi.mock('../../../store/sidebarStore', () => ({
  useSidebarStore: vi.fn((selector) => {
    const state = {
      searchQuery: '',
      searchFilters: { user: true, assistant: true, thinking: true, tools: true },
    };
    return selector ? selector(state) : state;
  }),
}));

// Mock sidebar api
vi.mock('../../../api/sidebarApi', () => ({
  useSidebarController: vi.fn(() => ({
    setSearchQuery: vi.fn(),
    setSearchFilters: vi.fn(),
  })),
}));

describe('TopBar', () => {
  const defaultProps = {
    workingDir: '/home/user/project',
    connectionStatus: 'connected' as const,
    pid: 12345,
  };

  const mockOpenSystemPrompt = vi.fn();
  const mockOpenModelSelector = vi.fn();
  const mockOpenThinkingLevel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(modalStore.useModalStore).mockReturnValue({
      openSystemPrompt: mockOpenSystemPrompt,
      openModelSelector: mockOpenModelSelector,
      openThinkingLevel: mockOpenThinkingLevel,
    } as any);
  });

  it('renders search input', () => {
    render(<TopBar {...defaultProps} />);
    expect(screen.getByPlaceholderText('Search messages...')).toBeInTheDocument();
  });

  it('opens system prompt modal when document button clicked', () => {
    render(<TopBar {...defaultProps} />);
    const docBtn = screen.getByTitle('System Prompt');
    fireEvent.click(docBtn);
    expect(mockOpenSystemPrompt).toHaveBeenCalled();
  });

  it('opens model selector when model button clicked', () => {
    render(<TopBar {...defaultProps} />);
    const modelBtn = screen.getByTitle('Model');
    fireEvent.click(modelBtn);
    expect(mockOpenModelSelector).toHaveBeenCalled();
  });

  it('opens thinking level selector when thinking button clicked', () => {
    render(<TopBar {...defaultProps} />);
    const thinkBtn = screen.getByTitle('Thinking');
    fireEvent.click(thinkBtn);
    expect(mockOpenThinkingLevel).toHaveBeenCalled();
  });

  it('shows connected status', () => {
    render(<TopBar {...defaultProps} />);
    const statusDot = screen.getByTitle('Status: connected');
    expect(statusDot).toBeInTheDocument();
  });

  it('shows filter toggle button', () => {
    render(<TopBar {...defaultProps} />);
    expect(screen.getByTitle('Toggle Filters')).toBeInTheDocument();
  });
});
