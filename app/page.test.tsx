import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import Page from './page';
import { api } from '@/lib/api-client';
import { CASES, FLOWS, SKILLS, ACTIVITY } from '@/components/signagent/fixtures';

// Page renders the console, which loads everything from the backend.
jest.mock('@/lib/api-client', () => ({
  ApiError: class ApiError extends Error {},
  api: {
    cases: { list: jest.fn(), get: jest.fn(), approve: jest.fn(), reject: jest.fn() },
    routes: { list: jest.fn(), update: jest.fn(), remove: jest.fn() },
    skills: { list: jest.fn(), toggle: jest.fn() },
    activity: { list: jest.fn() },
  },
}));

const mocked = api as unknown as {
  cases: { list: jest.Mock };
  routes: { list: jest.Mock };
  skills: { list: jest.Mock };
  activity: { list: jest.Mock };
};
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

beforeEach(() => {
  jest.clearAllMocks();
  mocked.cases.list.mockResolvedValue(clone(CASES));
  mocked.routes.list.mockResolvedValue(clone(FLOWS));
  mocked.skills.list.mockResolvedValue(clone(SKILLS));
  mocked.activity.list.mockResolvedValue(clone(ACTIVITY));
});

afterEach(cleanup);

async function renderPage() {
  const utils = render(<Page />);
  await screen.findByText('Approval Overview');
  return utils;
}

describe('Page (ConfigProvider + control bar)', () => {
  it('renders the console with the floating control bar', async () => {
    await renderPage();
    expect(screen.getByText('Low-risk auto')).toBeInTheDocument();
    expect(screen.getByText('Show risk')).toBeInTheDocument();
  });

  it('toggles the "Show risk" prop from the control bar', async () => {
    await renderPage();
    expect(screen.getAllByText('Warning').length).toBeGreaterThan(0);

    // the last two switches belong to the control bar (low-risk auto, show risk)
    const showRisk = screen.getAllByRole('switch').slice(-1)[0];
    fireEvent.click(showRisk);
    expect(screen.queryByText('Warning')).not.toBeInTheDocument();
  });

  it('switches to the dark theme via the segmented control', async () => {
    await renderPage();
    fireEvent.click(screen.getByText('Ant Dark'));
    // dashboard still renders after the theme swap
    expect(screen.getByText('Approval Overview')).toBeInTheDocument();
  });
});
