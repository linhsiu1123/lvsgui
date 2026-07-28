import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import SignAgentCore from './SignAgentCore';
import { api } from '@/lib/api-client';
import { CASES, FLOWS, SKILLS, ACTIVITY } from './fixtures';
import type { CaseItem } from './data';

// The console talks to the backend through this client; the client itself is
// covered by lib/api-client.test.ts, so here it is the seam we stub.
jest.mock('@/lib/api-client', () => ({
  ApiError: class ApiError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  },
  api: {
    cases: { list: jest.fn(), get: jest.fn(), approve: jest.fn(), reject: jest.fn() },
    routes: { list: jest.fn(), update: jest.fn(), remove: jest.fn() },
    skills: { list: jest.fn(), toggle: jest.fn() },
    activity: { list: jest.fn() },
  },
}));

// `jest.Mocked` does not reach into the client's nested groups, so describe the
// stub's shape directly.
const mocked = api as unknown as {
  cases: { list: jest.Mock; get: jest.Mock; approve: jest.Mock; reject: jest.Mock };
  routes: { list: jest.Mock; update: jest.Mock; remove: jest.Mock };
  skills: { list: jest.Mock; toggle: jest.Mock };
  activity: { list: jest.Mock };
};
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

beforeEach(() => {
  jest.clearAllMocks();
  mocked.cases.list.mockResolvedValue(clone(CASES));
  mocked.routes.list.mockResolvedValue(clone(FLOWS));
  mocked.skills.list.mockResolvedValue(clone(SKILLS));
  mocked.activity.list.mockResolvedValue(clone(ACTIVITY));
  mocked.routes.update.mockResolvedValue(clone(FLOWS.Pipeline1));
  mocked.routes.remove.mockResolvedValue(null);
});

afterEach(cleanup);

/** Render and wait for the first load to settle. */
async function renderConsole(props: React.ComponentProps<typeof SignAgentCore> = {}) {
  const utils = render(<SignAgentCore {...props} />);
  await screen.findByText('Approval Overview');
  return utils;
}

function goto(tab: string) {
  fireEvent.click(screen.getByRole('button', { name: tab }));
}

describe('SignAgentCore — loading and failure', () => {
  it('shows a loading state until every resource has arrived', async () => {
    let release!: (v: CaseItem[]) => void;
    mocked.cases.list.mockReturnValue(new Promise((res) => (release = res)));

    render(<SignAgentCore />);
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
    expect(screen.queryByText('Approval Overview')).not.toBeInTheDocument();

    release(clone(CASES));
    expect(await screen.findByText('Approval Overview')).toBeInTheDocument();
  });

  it('surfaces a failed load and can retry', async () => {
    mocked.cases.list.mockRejectedValueOnce(new Error('backend unreachable'));

    render(<SignAgentCore />);
    expect(await screen.findByText('Could not load the approval console')).toBeInTheDocument();
    expect(screen.getByText('backend unreachable')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Approval Overview')).toBeInTheDocument();
  });

  it('requests all four resources exactly once on mount', async () => {
    await renderConsole();
    expect(mocked.cases.list).toHaveBeenCalledTimes(1);
    expect(mocked.routes.list).toHaveBeenCalledTimes(1);
    expect(mocked.skills.list).toHaveBeenCalledTimes(1);
    expect(mocked.activity.list).toHaveBeenCalledTimes(1);
  });
});

describe('SignAgentCore — Overview dashboard', () => {
  it('renders server documents in the pipeline cards and the table', async () => {
    await renderConsole();
    expect(screen.getByText('QC-2606')).toBeInTheDocument();
    ['P1', 'P2', 'P3'].forEach((g) => expect(screen.getByText(g)).toBeInTheDocument());
    expect(screen.getByText('Pipeline1')).toBeInTheDocument();
  });

  it('flags only Medium/High documents', async () => {
    await renderConsole();
    expect(screen.getAllByText('Warning').length).toBeGreaterThan(0);
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.queryByText(/Low Risk/)).not.toBeInTheDocument();
  });

  it('filters by pipeline card and clears again', async () => {
    await renderConsole();
    fireEvent.click(screen.getByText('P3'));
    expect(screen.getByText('Show all')).toBeInTheDocument();
    expect(screen.queryByText(/RD-0981/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Show all'));
    expect(screen.getByText(/RD-0981/)).toBeInTheDocument();
  });

  it('renders the activity feed from the server', async () => {
    await renderConsole();
    expect(screen.getByText('QC-2602 approved by Wang')).toBeInTheDocument();
  });

  it('opens the detail modal and deep-links to the pipeline', async () => {
    await renderConsole();
    fireEvent.click(screen.getAllByText('In Review')[0]);
    expect(screen.getByText('Document Submitted')).toBeInTheDocument();
    fireEvent.click(screen.getByText(/View routing rules/));
    expect(screen.getByText('v3 · updated 6/28 · System Admin')).toBeInTheDocument();
  });
});

describe('SignAgentCore — Approver flow', () => {
  it('preselects the first queued document', async () => {
    await renderConsole();
    goto('Pending Items');
    expect(screen.getByText('Agent Pre-review Report')).toBeInTheDocument();
    expect(screen.getByText(/Awaiting my approval \(2\)/)).toBeInTheDocument();
  });

  it('approves through the API and takes the server result', async () => {
    const advanced: CaseItem = {
      ...clone(CASES[1]),
      routeIdx: 1,
      currentLevel2: true,
      route: [{ name: 'Verification Dep. Mgr. Lin', state: 'done' }, { name: 'Design Center Assoc. Mgr. Wang' }],
    };
    mocked.cases.approve.mockResolvedValue(advanced);

    await renderConsole();
    goto('Pending Items');
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    await waitFor(() => expect(mocked.cases.approve).toHaveBeenCalledWith('QC-2606'));
    // It left this approver's queue, so the detail pane empties.
    expect(await screen.findByText('Select a request from the left')).toBeInTheDocument();
    // and the feed is refreshed so the decision shows up
    await waitFor(() => expect(mocked.activity.list).toHaveBeenCalledTimes(2));
  });

  it('requires a reason before rejecting, then posts it', async () => {
    mocked.cases.reject.mockResolvedValue({ ...clone(CASES[1]), status: 'rejected' });

    await renderConsole();
    goto('Pending Items');
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));

    fireEvent.click(screen.getByRole('button', { name: 'Confirm rejection' }));
    expect(mocked.cases.reject).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText('Rejection reason (required)'), {
      target: { value: 'insufficient evidence' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm rejection' }));
    await waitFor(() =>
      expect(mocked.cases.reject).toHaveBeenCalledWith('QC-2606', 'insufficient evidence'),
    );
  });

  it('warns without losing the console when a decision fails', async () => {
    mocked.cases.approve.mockRejectedValue(new Error('backend exploded'));

    await renderConsole();
    goto('Pending Items');
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    expect(await screen.findByText('backend exploded')).toBeInTheDocument();
    // still usable
    expect(screen.getByRole('button', { name: 'Overview' })).toBeInTheDocument();
  });

  it('reveals the agent reasoning trace on demand', async () => {
    await renderConsole();
    goto('Pending Items');
    fireEvent.click(screen.getByText(/Show Agent reasoning/));
    expect(screen.getByText('Risk determination')).toBeInTheDocument();
  });
});

describe('SignAgentCore — Skills', () => {
  it('renders the skills the server returned', async () => {
    await renderConsole();
    goto('Skills');
    expect(screen.getByText('AGENT SKILLS')).toBeInTheDocument();
    expect(screen.getByText('Anomaly Detection')).toBeInTheDocument();
  });

  it('toggles optimistically and PATCHes the change', async () => {
    mocked.skills.toggle.mockResolvedValue({ ...SKILLS[0], enabled: false });

    await renderConsole();
    goto('Skills');
    const first = screen.getAllByRole('switch')[0];
    expect(first).toBeChecked();

    fireEvent.click(first);
    expect(first).not.toBeChecked(); // optimistic, before the request settles
    await waitFor(() => expect(mocked.skills.toggle).toHaveBeenCalledWith('route', false));
  });

  it('rolls the switch back when the server rejects the toggle', async () => {
    mocked.skills.toggle.mockRejectedValue(new Error('nope'));

    await renderConsole();
    goto('Skills');
    const first = screen.getAllByRole('switch')[0];
    fireEvent.click(first);

    await waitFor(() => expect(first).toBeChecked());
    expect(screen.getByText('nope')).toBeInTheDocument();
  });
});

describe('SignAgentCore — Routing rules canvas', () => {
  async function openRoutes() {
    await renderConsole();
    goto('Routing Rules');
  }

  it('renders the chain from the server flow', async () => {
    await openRoutes();
    ['node1', 'node2', 'node3'].forEach((n) => expect(screen.getByText(n)).toBeInTheDocument());
    expect(screen.getAllByText('No skill assigned')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Pipeline1' })).toBeInTheDocument();
  });

  it('opens the config panel for the selected node', async () => {
    await openRoutes();
    fireEvent.click(screen.getByText('node2'));
    expect(screen.getByText('Flow node · Pipeline1')).toBeInTheDocument();
    expect(screen.getByText('2 of 3')).toBeInTheDocument();
  });

  it('persists a node rename', async () => {
    await openRoutes();
    fireEvent.click(screen.getByText('node1'));
    fireEvent.change(screen.getByDisplayValue('node1'), { target: { value: 'Intake' } });

    expect(screen.getAllByText('Intake')).toHaveLength(2);
    await waitFor(() =>
      expect(mocked.routes.update).toHaveBeenCalledWith(
        'Pipeline1',
        expect.objectContaining({ chain: ['Intake', 'node2', 'node3'] }),
      ),
    );
  });

  it('collapses a burst of edits into a single save', async () => {
    await openRoutes();
    fireEvent.click(screen.getByText('node1'));
    const input = screen.getByDisplayValue('node1');
    fireEvent.change(input, { target: { value: 'I' } });
    fireEvent.change(screen.getByDisplayValue('I'), { target: { value: 'In' } });
    fireEvent.change(screen.getByDisplayValue('In'), { target: { value: 'Int' } });

    await waitFor(() => expect(mocked.routes.update).toHaveBeenCalled());
    expect(mocked.routes.update).toHaveBeenCalledTimes(1);
    expect(mocked.routes.update).toHaveBeenCalledWith(
      'Pipeline1',
      expect.objectContaining({ chain: ['Int', 'node2', 'node3'] }),
    );
  });

  it('adds and deletes chain nodes, persisting each', async () => {
    await openRoutes();
    fireEvent.click(screen.getByTitle('Add node'));
    expect(screen.getByText('node4')).toBeInTheDocument();

    fireEvent.click(screen.getByText('node4'));
    fireEvent.click(screen.getByText('Delete node'));
    expect(screen.queryByText('node4')).not.toBeInTheDocument();

    await waitFor(() =>
      expect(mocked.routes.update).toHaveBeenLastCalledWith(
        'Pipeline1',
        expect.objectContaining({ chain: ['node1', 'node2', 'node3'] }),
      ),
    );
  });

  it('persists the per-node human-verify toggle', async () => {
    await openRoutes();
    fireEvent.click(screen.getByText('node1'));
    expect(screen.getByText('Requires manual confirmation')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('switch').slice(-1)[0]);
    expect(screen.getByText('No confirmation needed')).toBeInTheDocument();
    await waitFor(() =>
      expect(mocked.routes.update).toHaveBeenCalledWith(
        'Pipeline1',
        expect.objectContaining({ nodeVerify: { n0: false } }),
      ),
    );
  });

  it('persists the rule-active switch', async () => {
    await openRoutes();
    expect(screen.getByText('Rule active')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('switch').slice(-1)[0]);
    expect(screen.getByText('Disabled')).toBeInTheDocument();
    await waitFor(() =>
      expect(mocked.routes.update).toHaveBeenCalledWith('Pipeline1', expect.objectContaining({ enabled: false })),
    );
  });

  it('creates a new pipeline on the server', async () => {
    await openRoutes();
    fireEvent.click(screen.getByTitle('Add flow'));
    expect(screen.getByRole('button', { name: 'Pipeline4' })).toBeInTheDocument();

    await waitFor(() =>
      expect(mocked.routes.update).toHaveBeenCalledWith(
        'Pipeline4',
        expect.objectContaining({ chain: ['node1', 'node2', 'node3'] }),
      ),
    );
  });

  it('renames a pipeline by re-creating it and removing the old one', async () => {
    await openRoutes();
    fireEvent.click(screen.getByTitle('Rename flow'));
    fireEvent.change(screen.getByDisplayValue('Pipeline1'), { target: { value: 'Renamed Flow' } });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    expect(screen.getByRole('button', { name: 'Renamed Flow' })).toBeInTheDocument();
    await waitFor(() => expect(mocked.routes.update).toHaveBeenCalledWith('Renamed Flow', expect.anything()));
    await waitFor(() => expect(mocked.routes.remove).toHaveBeenCalledWith('Pipeline1'));
  });

  it('zooms without touching the server', async () => {
    await openRoutes();
    expect(screen.getByText('85%')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Zoom in'));
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(mocked.routes.update).not.toHaveBeenCalled();
  });

  it('sweeps every link panel without crashing', async () => {
    const { container } = render(<SignAgentCore />);
    await screen.findByText('Approval Overview');
    goto('Routing Rules');

    const edgePaths = Array.from(container.querySelectorAll('path')).filter((p) =>
      (p.getAttribute('style') || '').includes('transparent'),
    );
    expect(edgePaths.length).toBeGreaterThan(0);
    edgePaths.forEach((p) => {
      fireEvent.click(p);
      expect(screen.getByText(/Link ·/)).toBeInTheDocument();
    });
  });
});

describe('SignAgentCore — props', () => {
  it('hides alert badges when showRisk is false', async () => {
    await renderConsole({ showRisk: false });
    expect(screen.queryByText('Warning')).not.toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('routes the low-risk document to manual approval when lowRiskAuto is false', async () => {
    await renderConsole({ lowRiskAuto: false });
    goto('Pending Items');
    expect(screen.getByText('QC-2607')).toBeInTheDocument();
  });

  it('applies the dark theme palette to the root element', async () => {
    const { container } = render(<SignAgentCore direction="Ant Dark" />);
    await screen.findByText('Approval Overview');
    const root = container.firstChild as HTMLElement;
    expect(root.style.getPropertyValue('--bg')).toBe('#000000');
    expect(root.style.getPropertyValue('--surface')).toBe('#141414');
  });
});
