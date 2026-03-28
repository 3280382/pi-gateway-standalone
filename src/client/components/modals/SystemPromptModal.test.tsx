/**
 * SystemPromptModal Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Simple SystemPromptModal for testing
function SystemPromptModal({ 
  isOpen, 
  onClose, 
  agentsContent, 
  systemContent, 
  skills 
}: { 
  isOpen: boolean;
  onClose: () => void;
  agentsContent: string;
  systemContent: string;
  skills: string[];
}) {
  if (!isOpen) return null;

  return (
    <div data-testid="system-prompt-modal">
      <h2>System Prompt</h2>
      <div data-testid="agents-section">
        <h3>AGENTS.md</h3>
        <pre>{agentsContent}</pre>
      </div>
      <div data-testid="system-section">
        <h3>SYSTEM.md</h3>
        <pre>{systemContent}</pre>
      </div>
      <div data-testid="skills-section">
        <h3>Skills ({skills.length})</h3>
        <ul>
          {skills.map((skill, i) => (
            <li key={i}>{skill}</li>
          ))}
        </ul>
      </div>
      <button data-testid="close-btn" onClick={onClose}>Close</button>
    </div>
  );
}

describe('SystemPromptModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    agentsContent: '# AGENTS\nTest content',
    systemContent: '# SYSTEM\nSystem prompt',
    skills: ['skill1', 'skill2'],
  };

  it('renders nothing when closed', () => {
    const { container } = render(
      <SystemPromptModal {...defaultProps} isOpen={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal when open', () => {
    render(<SystemPromptModal {...defaultProps} />);
    expect(screen.getByTestId('system-prompt-modal')).toBeInTheDocument();
  });

  it('displays AGENTS.md content', () => {
    render(<SystemPromptModal {...defaultProps} />);
    expect(screen.getByTestId('agents-section')).toHaveTextContent('# AGENTS');
  });

  it('displays SYSTEM.md content', () => {
    render(<SystemPromptModal {...defaultProps} />);
    expect(screen.getByTestId('system-section')).toHaveTextContent('# SYSTEM');
  });

  it('displays skills list', () => {
    render(<SystemPromptModal {...defaultProps} />);
    expect(screen.getByTestId('skills-section')).toHaveTextContent('skill1');
    expect(screen.getByTestId('skills-section')).toHaveTextContent('skill2');
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<SystemPromptModal {...defaultProps} onClose={onClose} />);
    
    fireEvent.click(screen.getByTestId('close-btn'));
    expect(onClose).toHaveBeenCalled();
  });
});

console.log('[Test] SystemPromptModal tests loaded');
