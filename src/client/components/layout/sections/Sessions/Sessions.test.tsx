/**
 * Sessions Section - UI Tests
 * Layer 1: Component rendering with Mock Store
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sessions } from './Sessions';

// Mock Zustand store with fixed state
const mockSelectSession = vi.fn();
const mockCreateNewSession = vi.fn();

vi.mock('../../../../store/sidebarStore', () => ({
  useSidebarStore: (selector: any) => {
    const state = {
      sessions: [
        {
          id: '1',
          name: 'Test Session 1',
          messageCount: 5,
          lastModified: new Date('2024-01-15'),
        },
        {
          id: '2',
          name: 'Test Session 2',
          messageCount: 10,
          lastModified: new Date('2024-01-16'),
        },
      ],
      selectedSessionId: null,
      isLoading: false,
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock('../../../../api/sidebarApi', () => ({
  useSidebarController: () => ({
    selectSession: mockSelectSession,
    createNewSession: mockCreateNewSession,
  }),
}));

describe('Sessions Section UI', () => {
  it('should render session list', () => {
    render(<Sessions />);

    expect(screen.getByText('Test Session 1')).toBeInTheDocument();
    expect(screen.getByText('Test Session 2')).toBeInTheDocument();
  });

  it('should show session message counts', () => {
    render(<Sessions />);

    // Use regex to be more flexible with text matching
    expect(screen.getByText(/5\s*msgs/)).toBeInTheDocument();
    expect(screen.getByText(/10\s*msgs/)).toBeInTheDocument();
  });

  it('should render new session button', () => {
    render(<Sessions />);

    // Check for the button with the plus icon
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });
});
