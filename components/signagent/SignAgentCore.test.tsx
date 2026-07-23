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
  it('renders the approval overview with all product-type cards and rows', () => {
    render(<SignAgentCore />);
    expect(screen.getByText('Approval Overview')).toBeInTheDocument();
    expect(screen.getByText('QC-2606')).toBeInTheDocument();
    // three type cards, each with its glyph
    ['RD', 'VR', 'WV'].forEach((g) => expect(screen.getByText(g)).toBeInTheDocument());
  });

  it('filters the table when a product-type card is clicked and clears via "Show all"', () => {
    render(<SignAgentCore />);
    // Click the "WV" type card (its glyph is unique; the name also appears in table rows)
    fireEvent.click(screen.getByText('WV'));
    // Filter label switches away from "All types"
    expect(screen.getByText('Show all')).toBeInTheDocument();
    // Rule Deck Change rows should be filtered out
    expect(screen.queryByText(/RD-0981/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Show all'));
    expect(screen.getByText(/RD-0981/)).toBeInTheDocument();
  });

  it('opens the case detail modal from a status pill and can jump to routing rules', () => {
    render(<SignAgentCore />);
    fireEvent.click(screen.getAllByText('In Review')[0]);
    expect(screen.getByText(/View routing rules/)).toBeInTheDocument();
    // modal shows an approval timeline
    expect(screen.getByText('Document Submitted')).toBeInTheDocument();
    fireEvent.click(screen.getByText(/View routing rules/));
    // now on the routing screen, deep-linked to the risk-grading branch node's panel
    expect(screen.getByText('Branch node · Rule Deck Change')).toBeInTheDocument();
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

  it('renders the flow graph nodes and risk branch labels', () => {
    openRoutes();
    expect(screen.getByText('Document Submitted')).toBeInTheDocument();
    expect(screen.getByText('Agent Pre-review')).toBeInTheDocument();
    expect(screen.getByText('Agent Auto-approve')).toBeInTheDocument();
    expect(screen.getAllByText('Low Risk').length).toBeGreaterThan(0);
  });

  it('opens the config panel for each node kind', () => {
    openRoutes();
    // switch (branch) node
    fireEvent.click(screen.getByText('Risk Grading'));
    expect(screen.getByText('Branch node · Rule Deck Change')).toBeInTheDocument();
    // trigger node
    fireEvent.click(screen.getByText('Document Submitted'));
    expect(screen.getByText('Trigger node · Rule Deck Change')).toBeInTheDocument();
    // agent node
    fireEvent.click(screen.getByText('Agent Pre-review'));
    expect(screen.getByText('Agent node · Rule Deck Change')).toBeInTheDocument();
    // auto node
    fireEvent.click(screen.getByText('Agent Auto-approve'));
    expect(screen.getByText('Auto-approve · Rule Deck Change')).toBeInTheDocument();
    // human node (first "Verification Dep. Mgr." in the canvas)
    fireEvent.click(screen.getAllByText('Verification Dep. Mgr.')[0]);
    expect(screen.getByText('Manual approval · Rule Deck Change')).toBeInTheDocument();
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

  it('adds a new flow and switches product-type tabs', () => {
    openRoutes();
    fireEvent.click(screen.getByTitle('Add flow'));
    // new flow enters rename mode with an OK commit button
    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    // switch to another product type tab
    fireEvent.click(screen.getByRole('button', { name: 'Waiver Request' }));
    expect(screen.getByText('Risk Grading')).toBeInTheDocument();
  });

  it('edits branch stages and flips the per-node human-verify toggle', () => {
    openRoutes();
    fireEvent.click(screen.getByText('Risk Grading'));
    // add a Medium-risk stage (Medium starts at 2 → becomes 3)
    fireEvent.click(screen.getByText(/Medium Risk add a stage/));
    expect(screen.queryByText(/Medium Risk add a stage/)).not.toBeInTheDocument(); // capped at 3
    // remove a stage again via the ✕ stage controls
    fireEvent.click(screen.getAllByTitle('Remove this stage')[0]);
    expect(screen.getByText(/Medium Risk add a stage/)).toBeInTheDocument();
    // toggle the panel's "Human verify?" switch (last switch on screen)
    const verify = screen.getAllByRole('switch').slice(-1)[0];
    const before = (verify as HTMLInputElement).getAttribute('aria-checked');
    fireEvent.click(verify);
    expect((verify as HTMLInputElement).getAttribute('aria-checked')).not.toBe(before);
  });

  it('deletes a node and restores it from the removed-chip', () => {
    openRoutes();
    fireEvent.click(screen.getByText('Document Submitted'));
    fireEvent.click(screen.getByText('Delete node'));
    // node is gone; a restore chip appears in the toolbar
    const chip = screen.getByText(/↺ Document Submitted/);
    expect(chip).toBeInTheDocument();
    fireEvent.click(chip);
    expect(screen.getByText('Document Submitted')).toBeInTheDocument();
  });

  it('renames the active flow', () => {
    openRoutes();
    fireEvent.click(screen.getByTitle('Rename flow'));
    const input = screen.getByDisplayValue('Rule Deck Change');
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
  it('hides risk badges when showRisk is false', () => {
    render(<SignAgentCore showRisk={false} />);
    expect(screen.queryByText('Medium Risk')).not.toBeInTheDocument();
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
