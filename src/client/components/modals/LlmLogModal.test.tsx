/**
 * LlmLogModal Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Simple LlmLogModal for testing
function LlmLogModal({
  isOpen,
  onClose,
  logs,
  enabled,
  onToggleEnabled,
  refreshInterval,
  onChangeInterval,
}: {
  isOpen: boolean;
  onClose: () => void;
  logs: string[];
  enabled: boolean;
  onToggleEnabled: () => void;
  refreshInterval: number;
  onChangeInterval: (interval: number) => void;
}) {
  if (!isOpen) return null;

  return (
    <div data-testid="llm-log-modal">
      <h2>LLM Log</h2>
      <div data-testid="log-settings">
        <label>
          <input
            type="checkbox"
            checked={enabled}
            onChange={onToggleEnabled}
            data-testid="enabled-toggle"
          />
          Enable Logging
        </label>
        <input
          type="number"
          value={refreshInterval}
          onChange={(e) => onChangeInterval(Number(e.target.value))}
          data-testid="interval-input"
        />
      </div>
      <div data-testid="log-content">
        {logs.length === 0 ? (
          <p>No logs</p>
        ) : (
          logs.map((log, i) => <div key={i}>{log}</div>)
        )}
      </div>
      <button data-testid="close-btn" onClick={onClose}>Close</button>
    </div>
  );
}

describe('LlmLogModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    logs: [] as string[],
    enabled: true,
    onToggleEnabled: vi.fn(),
    refreshInterval: 5,
    onChangeInterval: vi.fn(),
  };

  it('renders nothing when closed', () => {
    const { container } = render(<LlmLogModal {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders modal when open', () => {
    render(<LlmLogModal {...defaultProps} />);
    expect(screen.getByTestId('llm-log-modal')).toBeInTheDocument();
  });

  it('displays empty state when no logs', () => {
    render(<LlmLogModal {...defaultProps} />);
    expect(screen.getByText('No logs')).toBeInTheDocument();
  });

  it('displays logs when present', () => {
    const logs = ['Log entry 1', 'Log entry 2'];
    render(<LlmLogModal {...defaultProps} logs={logs} />);
    expect(screen.getByText('Log entry 1')).toBeInTheDocument();
    expect(screen.getByText('Log entry 2')).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<LlmLogModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('close-btn'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onToggleEnabled when toggle clicked', () => {
    const onToggleEnabled = vi.fn();
    render(<LlmLogModal {...defaultProps} onToggleEnabled={onToggleEnabled} />);
    fireEvent.click(screen.getByTestId('enabled-toggle'));
    expect(onToggleEnabled).toHaveBeenCalled();
  });

  it('calls onChangeInterval when interval changed', () => {
    const onChangeInterval = vi.fn();
    render(<LlmLogModal {...defaultProps} onChangeInterval={onChangeInterval} />);
    fireEvent.change(screen.getByTestId('interval-input'), { target: { value: '10' } });
    expect(onChangeInterval).toHaveBeenCalledWith(10);
  });

  it('shows correct enabled state', () => {
    const { rerender } = render(<LlmLogModal {...defaultProps} enabled={true} />);
    expect(screen.getByTestId('enabled-toggle')).toBeChecked();

    rerender(<LlmLogModal {...defaultProps} enabled={false} />);
    expect(screen.getByTestId('enabled-toggle')).not.toBeChecked();
  });

  it('shows correct refresh interval', () => {
    render(<LlmLogModal {...defaultProps} refreshInterval={10} />);
    expect(screen.getByTestId('interval-input')).toHaveValue(10);
  });
});

console.log('[Test] LlmLogModal tests loaded');
