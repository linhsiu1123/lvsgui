import type { Direction } from './data';

export interface SignAgentProps {
  direction?: Direction;
  lowRiskAuto?: boolean;
  showRisk?: boolean;
}

/**
 * Purely visual state: which screen is open, what is selected, canvas zoom.
 *
 * Everything the backend owns — documents, routing flows, skills, the activity
 * feed — lives in `useSignAgentData` instead, so there is exactly one place
 * that can go out of sync with the server.
 */
export interface State {
  role: 'dash' | 'approver' | 'admin' | 'routes';
  dashType: string | null;
  dashModal: string | null;
  selId: string | null;
  rejecting: boolean;
  rejectReason: string;
  traceOpen: boolean;
  /** Empty until the flows load; resolves to the first pipeline. */
  routeTab: string;
  routeSel: string | null;
  routeEdgeSel: string | null;
  routeZoom: number;
  routeRenaming: boolean;
  routeNameDraft: string;
}

export const INITIAL_STATE: State = {
  role: 'dash',
  dashType: null,
  dashModal: null,
  selId: null,
  rejecting: false,
  rejectReason: '',
  traceOpen: false,
  routeTab: '',
  routeSel: null,
  routeEdgeSel: null,
  routeZoom: 0.85,
  routeRenaming: false,
  routeNameDraft: '',
};

export type SetState = (patch: Partial<State> | ((prev: State) => Partial<State>)) => void;
