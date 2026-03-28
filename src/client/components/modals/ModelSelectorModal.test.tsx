/**
 * ModelSelectorModal Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

interface Model {
  id: string;
  name: string;
  provider: string;
}

// Simple ModelSelectorModal for testing
function ModelSelectorModal({
  isOpen,
  onClose,
  models,
  currentModel,
  onSelectModel,
}: {
  isOpen: boolean;
  onClose: () => void;
  models: Model[];
  currentModel: string | null;
  onSelectModel: (modelId: string) => void;
}) {
  if (!isOpen) return null;

  return (
    <div data-testid="model-selector-modal">
      <h2>Select Model</h2>
      <div data-testid="model-list">
        {models.map((model) => (
          <div
            key={model.id}
            data-testid={`model-${model.id}`}
            onClick={() => onSelectModel(model.id)}
            style={{ fontWeight: currentModel === model.id ? 'bold' : 'normal' }}
          >
            <span>{model.name}</span>
            <span>{model.provider}</span>
            {currentModel === model.id && <span data-testid="selected">✓</span>}
          </div>
        ))}
      </div>
      <button data-testid="close-btn" onClick={onClose}>Close</button>
    </div>
  );
}

const mockModels: Model[] = [
  { id: 'gpt-4', name: 'GPT-4', provider: 'OpenAI' },
  { id: 'claude-3', name: 'Claude 3', provider: 'Anthropic' },
  { id: 'kimi', name: 'Kimi', provider: 'Moonshot' },
];

describe('ModelSelectorModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    models: mockModels,
    currentModel: null as string | null,
    onSelectModel: vi.fn(),
  };

  it('renders nothing when closed', () => {
    const { container } = render(<ModelSelectorModal {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders modal when open', () => {
    render(<ModelSelectorModal {...defaultProps} />);
    expect(screen.getByTestId('model-selector-modal')).toBeInTheDocument();
  });

  it('displays all models', () => {
    render(<ModelSelectorModal {...defaultProps} />);
    expect(screen.getByTestId('model-gpt-4')).toHaveTextContent('GPT-4');
    expect(screen.getByTestId('model-claude-3')).toHaveTextContent('Claude 3');
    expect(screen.getByTestId('model-kimi')).toHaveTextContent('Kimi');
  });

  it('shows provider for each model', () => {
    render(<ModelSelectorModal {...defaultProps} />);
    expect(screen.getByTestId('model-gpt-4')).toHaveTextContent('OpenAI');
    expect(screen.getByTestId('model-claude-3')).toHaveTextContent('Anthropic');
  });

  it('marks current model as selected', () => {
    render(<ModelSelectorModal {...defaultProps} currentModel="gpt-4" />);
    expect(screen.getByTestId('model-gpt-4')).toContainElement(screen.getByTestId('selected'));
  });

  it('calls onSelectModel when model clicked', () => {
    const onSelectModel = vi.fn();
    render(<ModelSelectorModal {...defaultProps} onSelectModel={onSelectModel} />);
    fireEvent.click(screen.getByTestId('model-claude-3'));
    expect(onSelectModel).toHaveBeenCalledWith('claude-3');
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<ModelSelectorModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('close-btn'));
    expect(onClose).toHaveBeenCalled();
  });

  it('handles empty model list', () => {
    render(<ModelSelectorModal {...defaultProps} models={[]} />);
    expect(screen.getByTestId('model-list')).toBeEmptyDOMElement();
  });

  it('does not show selected mark for non-selected models', () => {
    render(<ModelSelectorModal {...defaultProps} currentModel="gpt-4" />);
    expect(screen.getByTestId('model-claude-3')).not.toContainElement(
      screen.queryByTestId('selected')
    );
  });
});

console.log('[Test] ModelSelectorModal tests loaded');
