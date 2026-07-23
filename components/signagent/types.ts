import {
  INITIAL_CASES,
  INITIAL_ROUTE_DEFS,
  type CaseItem,
  type RouteDef,
  type Direction,
} from './data';


export interface SignAgentProps {
  direction?: Direction;
  lowRiskAuto?: boolean;
  showRisk?: boolean;
}

export interface FeedItem {
  icon: string;
  chip: 'accent' | 'amber' | 'green';
  text: string;
  sub: string;
  time: string;
}

export interface State {
  role: 'dash' | 'approver' | 'admin' | 'routes';
  dashType: string | null;
  dashModal: string | null;
  cases: CaseItem[];
  selId: string | null;
  rejecting: boolean;
  rejectReason: string;
  feed: FeedItem[];
  feedWorking: string | null;
  traceOpen: boolean;
  skills: { route: boolean; precheck: boolean; auto: boolean; anomaly: boolean };
  nodeSkills: Record<string, string>;
  nodeVerify: Record<string, boolean>;
  routeTab: string;
  routeSel: string | null;
  routeEdgeSel: string | null;
  routeZoom: number;
  routeOn: Record<string, boolean>;
  routeDefs: Record<string, RouteDef>;
  routeRenaming: boolean;
  routeNameDraft: string;
}

export const INITIAL_STATE: State = {
  role: 'dash',
  dashType: null,
  dashModal: null,
  cases: INITIAL_CASES,
  selId: 'QC-2606',
  rejecting: false,
  rejectReason: '',
  feed: [],
  feedWorking: null,
  traceOpen: false,
  skills: { route: true, precheck: true, auto: true, anomaly: true },
  nodeSkills: {},
  nodeVerify: {},
  routeTab: 'Rule Deck Change',
  routeSel: null,
  routeEdgeSel: null,
  routeZoom: 0.85,
  routeOn: { 'Rule Deck Change': true, 'LVS Verification Report': true, 'Waiver Request': true },
  routeDefs: INITIAL_ROUTE_DEFS,
  routeRenaming: false,
  routeNameDraft: '',
};

export type SetState = (patch: Partial<State> | ((prev: State) => Partial<State>)) => void;
