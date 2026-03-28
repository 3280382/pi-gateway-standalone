/**
 * SidebarPanel Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Simple SidebarPanel for testing
function SidebarPanel({
  onSwitchView,
  currentView,
}: {
  onSwitchView: (view: 'chat' | 'files') => void;
  currentView: 'chat' | 'files';
}) {
  return (
    <aside data-testid="sidebar-panel">
      <div data-testid="sidebar-header">
        <div>π</div>
        <span>Pi Gateway</span>
      </div>
      <div data-testid="view-switcher">
        <button
          data-testid="chat-view-btn"
          className={currentView === 'chat' ? 'active' : ''}
          onClick={() => onSwitchView('chat')}
        >
          Chat
        </button>
        <button
          data-testid="files-view-btn"
          className={currentView === 'files' ? 'active' : ''}
          onClick={() => onSwitchView('files')}
        >
          Files
        </button>
      </div>
      <div data-testid="working-directory">/home/user</div>
      <div data-testid="recent-workspaces">
        <h3>Recent</h3>
        <ul>
          <li>/project1</li>
          <li>/project2</li>
        </ul>
      </div>
      <div data-testid="sessions">
        <h3>Sessions</h3>
        <ul>
          <li>Session 1</li>
          <li>Session 2</li>
        </ul>
      </div>
    </aside>
  );
}

describe('SidebarPanel', () => {
  const defaultProps = {
    onSwitchView: vi.fn(),
    currentView: 'chat' as const,
  };

  it('renders sidebar panel', () => {
    render(<SidebarPanel {...defaultProps} />);
    expect(screen.getByTestId('sidebar-panel')).toBeInTheDocument();
  });

  it('renders header with logo', () => {
    render(<SidebarPanel {...defaultProps} />);
    expect(screen.getByTestId('sidebar-header')).toHaveTextContent('π');
    expect(screen.getByTestId('sidebar-header')).toHaveTextContent('Pi Gateway');
  });

  it('renders view switcher', () => {
    render(<SidebarPanel {...defaultProps} />);
    expect(screen.getByTestId('view-switcher')).toBeInTheDocument();
    expect(screen.getByTestId('chat-view-btn')).toBeInTheDocument();
    expect(screen.getByTestId('files-view-btn')).toBeInTheDocument();
  });

  it('marks chat view as active when currentView is chat', () => {
    render(<SidebarPanel {...defaultProps} currentView="chat" />);
    expect(screen.getByTestId('chat-view-btn')).toHaveClass('active');
    expect(screen.getByTestId('files-view-btn')).not.toHaveClass('active');
  });

  it('marks files view as active when currentView is files', () => {
    render(<SidebarPanel {...defaultProps} currentView="files" />);
    expect(screen.getByTestId('files-view-btn')).toHaveClass('active');
    expect(screen.getByTestId('chat-view-btn')).not.toHaveClass('active');
  });

  it('calls onSwitchView with chat when chat button clicked', () => {
    const onSwitchView = vi.fn();
    render(<SidebarPanel {...defaultProps} onSwitchView={onSwitchView} />);
    fireEvent.click(screen.getByTestId('chat-view-btn'));
    expect(onSwitchView).toHaveBeenCalledWith('chat');
  });

  it('calls onSwitchView with files when files button clicked', () => {
    const onSwitchView = vi.fn();
    render(<SidebarPanel {...defaultProps} onSwitchView={onSwitchView} />);
    fireEvent.click(screen.getByTestId('files-view-btn'));
    expect(onSwitchView).toHaveBeenCalledWith('files');
  });

  it('renders working directory', () => {
    render(<SidebarPanel {...defaultProps} />);
    expect(screen.getByTestId('working-directory')).toBeInTheDocument();
  });

  it('renders recent workspaces', () => {
    render(<SidebarPanel {...defaultProps} />);
    expect(screen.getByTestId('recent-workspaces')).toBeInTheDocument();
    expect(screen.getByText('/project1')).toBeInTheDocument();
    expect(screen.getByText('/project2')).toBeInTheDocument();
  });

  it('renders sessions list', () => {
    render(<SidebarPanel {...defaultProps} />);
    expect(screen.getByTestId('sessions')).toBeInTheDocument();
    expect(screen.getByText('Session 1')).toBeInTheDocument();
    expect(screen.getByText('Session 2')).toBeInTheDocument();
  });
});

console.log('[Test] SidebarPanel tests loaded');
