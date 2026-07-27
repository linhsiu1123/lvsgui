import React from 'react';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import Page from './page';

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
  cleanup();
});

describe('Page (ConfigProvider + control bar)', () => {
  it('renders the console with the floating control bar', () => {
    render(<Page />);
    expect(screen.getByText('Approval Overview')).toBeInTheDocument();
    expect(screen.getByText('Low-risk auto')).toBeInTheDocument();
    expect(screen.getByText('Show risk')).toBeInTheDocument();
  });

  it('toggles the "Show risk" prop from the control bar', () => {
    render(<Page />);
    expect(screen.getAllByText('Warning').length).toBeGreaterThan(0);
    // the last two switches belong to the control bar (low-risk auto, show risk)
    const switches = screen.getAllByRole('switch');
    const showRisk = switches.slice(-1)[0];
    fireEvent.click(showRisk);
    expect(screen.queryByText('Warning')).not.toBeInTheDocument();
  });

  it('switches to the dark theme via the segmented control', () => {
    render(<Page />);
    fireEvent.click(screen.getByText('Ant Dark'));
    // dashboard still renders after the theme swap
    expect(screen.getByText('Approval Overview')).toBeInTheDocument();
  });
});
