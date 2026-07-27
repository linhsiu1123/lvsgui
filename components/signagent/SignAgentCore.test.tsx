import React from 'react';
import { render, screen, fireEvent, within, act, cleanup } from '@testing-library/react';
import SignAgentCore from './SignAgentCore';

// The live activity feed schedules setTimeout chains; drive them deterministically.
beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
  cleanup();
});

function goto(tab: string) {
  fireEvent.click(screen.getByRole('button', { name: tab }));
}

describe('SignAgentCore — Overview dashboard', () => {
  it('renders the approval overview with all pipeline cards and rows', () => {
    render(<SignAgentCore />);
    expect(screen.getByText('Approval Overview')).toBeInTheDocument();
    expect(screen.getByText('QC-2606')).toBeInTheDocument();
    // three pipeline cards, each with its glyph
    ['P1', 'P2', 'P3'].forEach((g) => expect(screen.getByText(g)).toBeInTheDocument());
    expect(screen.getByText('Pipeline1')).toBeInTheDocument();
  });

  it('filters the table when a pipeline card is clicked and clears via "Show all"', () => {
    render(<SignAgentCore />);
    // Click the "P3" (Waiver Request) card — its glyph is unique on the page
    fireEvent.click(screen.getByText('P3'));
    // Filter label switches away from "All types"
    expect(screen.getByText('Show all')).toBeInTheDocument();
    // Rule Deck Change rows should be filtered out
    expect(screen.queryByText(/RD-0981/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Show all'));
    expect(screen.getByText(/RD-0981/)).toBeInTheDocument();
  });

  it('flags only Medium/High cases, leaving low-risk rows unbadged', () => {
    render(<SignAgentCore />);
    // QC-2606/2605 are Medium → "Warning", QC-2604 is High → "Error"
    expect(screen.getAllByText('Warning').length).toBeGreaterThan(0);
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.queryByText(/Low Risk/)).not.toBeInTheDocument();
  });

  it('opens the case detail modal from a status pill and can jump to routing rules', () => {
    render(<SignAgentCore />);
    fireEvent.click(screen.getAllByText('In Review')[0]);
    expect(screen.getByText(/View routing rules/)).toBeInTheDocument();
    // modal shows an approval timeline
    expect(screen.getByText('Document Submitted')).toBeInTheDocument();
    fireEvent.click(screen.getByText(/View routing rules/));
    // now on the routing screen, deep-linked to the pipeline handling this doc type
    expect(screen.getByText('v3 · updated 6/28 · System Admin')).toBeInTheDocument();
    expect(screen.getByText('node1')).toBeInTheDocument();
  });

  it('runs the simulated agent activity feed to completion and appends the new case', () => {
    render(<SignAgentCore />);
    act(() => {
      jest.advanceTimersByTime(12000);
    });
    // final feed event + the newly injected auto-approved case
    expect(screen.getAllByText(/QC-2608/).length).toBeGreaterThan(0);
  });
});

describe('SignAgentCore — Approver flow', () => {
  it('lists pending items and approves the selected multi-level case', () => {
    render(<SignAgentCore />);
    goto('Pending Items');
    expect(screen.getByText(/Awaiting my approval/)).toBeInTheDocument();
    // QC-2606 is selected by default; approve advances it to the next level
    expect(screen.getByText('Agent Pre-review Report')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    // after approving level 1 it leaves the "awaiting me" list → empty-state prompt
    expect(screen.getByText('Select a request from the left')).toBeInTheDocument();
  });

  it('reveals the agent reasoning trace on demand', () => {
    render(<SignAgentCore />);
    goto('Pending Items');
    fireEvent.click(screen.getByText(/Show Agent reasoning/));
    expect(screen.getByText('Risk determination')).toBeInTheDocument();
  });

  it('requires a reason before a rejection is committed', () => {
    render(<SignAgentCore />);
    goto('Pending Items');
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    const confirm = screen.getByRole('button', { name: 'Confirm rejection' });
    // empty reason → no-op, case stays selected
    fireEvent.click(confirm);
    expect(screen.getByText('Agent Pre-review Report')).toBeInTheDocument();
    // provide a reason and confirm
    fireEvent.change(screen.getByPlaceholderText('Rejection reason (required)'), {
      target: { value: 'insufficient evidence' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm rejection' }));
    expect(screen.getByText('Select a request from the left')).toBeInTheDocument();
  });
});

describe('SignAgentCore — Skills', () => {
  it('renders four toggleable skills and flips one off', () => {
    render(<SignAgentCore />);
    goto('Skills');
    expect(screen.getByText('AGENT SKILLS')).toBeInTheDocument();
    const switches = screen.getAllByRole('switch');
    expect(switches.length).toBeGreaterThanOrEqual(4);
    expect(switches[0]).toBeChecked();
    fireEvent.click(switches[0]);
    expect(switches[0]).not.toBeChecked();
  });
});

describe('SignAgentCore — Routing rules canvas', () => {
  function openRoutes() {
    render(<SignAgentCore />);
    goto('Routing Rules');
  }

  it('renders the default three-node chain, each awaiting a skill', () => {
    openRoutes();
    ['node1', 'node2', 'node3'].forEach((n) => expect(screen.getByText(n)).toBeInTheDocument());
    expect(screen.getAllByText('No skill assigned')).toHaveLength(3);
  });

  it('opens the config panel for the selected node', () => {
    openRoutes();
    fireEvent.click(screen.getByText('node2'));
    expect(screen.getByText('Flow node · Pipeline1')).toBeInTheDocument();
    // the panel reports the node's position in the chain
    expect(screen.getByText('2 of 3')).toBeInTheDocument();
  });

  it('renames a node from the config panel', () => {
    openRoutes();
    fireEvent.click(screen.getByText('node1'));
    fireEvent.change(screen.getByDisplayValue('node1'), { target: { value: 'Intake' } });
    expect(screen.getByText('Intake')).toBeInTheDocument();
    expect(screen.queryByText('node1')).not.toBeInTheDocument();
  });

  it('zooms in/out and toggles the whole rule on and off', () => {
    openRoutes();
    expect(screen.getByText('85%')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Zoom in'));
    expect(screen.getByText('100%')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Zoom out'));
    expect(screen.getByText('85%')).toBeInTheDocument();

    expect(screen.getByText('Rule active')).toBeInTheDocument();
    const ruleSwitch = screen.getAllByRole('switch').slice(-1)[0];
    fireEvent.click(ruleSwitch);
    expect(screen.getByText('Disabled')).toBeInTheDocument();
  });

  it('adds a new pipeline and switches between pipeline tabs', () => {
    openRoutes();
    fireEvent.click(screen.getByTitle('Add flow'));
    // new flow enters rename mode with an OK commit button
    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(screen.getByRole('button', { name: 'Pipeline4' })).toBeInTheDocument();
    // switch to another pipeline tab
    fireEvent.click(screen.getByRole('button', { name: 'Pipeline3' }));
    expect(screen.getByText('node1')).toBeInTheDocument();
  });

  it('appends, inserts and deletes chain nodes', () => {
    openRoutes();
    // toolbar button appends to the end of the chain
    fireEvent.click(screen.getByTitle('Add node'));
    expect(screen.getByText('node4')).toBeInTheDocument();
    // panel button inserts directly after the selected node
    fireEvent.click(screen.getByText('node1'));
    fireEvent.click(screen.getByText(/Add node after this/));
    expect(screen.getByText('node5')).toBeInTheDocument();
    // and deleting takes one back out
    fireEvent.click(screen.getByText('node5'));
    fireEvent.click(screen.getByText('Delete node'));
    expect(screen.queryByText('node5')).not.toBeInTheDocument();
  });

  it('flips the per-node human-verify toggle', () => {
    openRoutes();
    fireEvent.click(screen.getByText('node1'));
    expect(screen.getByText('Requires manual confirmation')).toBeInTheDocument();
    // the panel's "Human verify?" switch is the last one on screen
    const verify = screen.getAllByRole('switch').slice(-1)[0];
    fireEvent.click(verify);
    expect(screen.getByText('No confirmation needed')).toBeInTheDocument();
  });

  it('renames the active pipeline', () => {
    openRoutes();
    fireEvent.click(screen.getByTitle('Rename flow'));
    const input = screen.getByDisplayValue('Pipeline1');
    fireEvent.change(input, { target: { value: 'Renamed Flow' } });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(screen.getByRole('button', { name: 'Renamed Flow' })).toBeInTheDocument();
  });

  it('sweeps every edge-selection config panel without crashing', () => {
    const { container } = render(<SignAgentCore />);
    fireEvent.click(screen.getByRole('button', { name: 'Routing Rules' }));
    const edgePaths = Array.from(container.querySelectorAll('path')).filter((p) =>
      (p.getAttribute('style') || '').includes('transparent'),
    );
    expect(edgePaths.length).toBeGreaterThan(0);
    edgePaths.forEach((p) => {
      act(() => {
        fireEvent.click(p);
      });
      // each click opens a "Link · …" panel
      expect(screen.getByText(/Link ·/)).toBeInTheDocument();
    });
  });
});

describe('SignAgentCore — props', () => {
  it('hides alert badges when showRisk is false', () => {
    render(<SignAgentCore showRisk={false} />);
    expect(screen.queryByText('Warning')).not.toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('routes the low-risk case to manual approval when lowRiskAuto is false', () => {
    render(<SignAgentCore lowRiskAuto={false} />);
    goto('Pending Items');
    // QC-2607 (normally auto-approved) now appears as a pending item
    expect(screen.getByText('QC-2607')).toBeInTheDocument();
  });

  it('applies the dark theme palette to the root element', () => {
    const { container } = render(<SignAgentCore direction="Ant Dark" />);
    const root = container.firstChild as HTMLElement;
    expect(root.style.getPropertyValue('--bg')).toBe('#000000');
    expect(root.style.getPropertyValue('--surface')).toBe('#141414');
  });
});
