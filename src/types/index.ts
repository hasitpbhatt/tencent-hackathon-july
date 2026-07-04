// --- SSE Event Types ---
export interface SSEEvent {
  type: 'flow_start' | 'phase' | 'agent_start' | 'agent_end' | 'chunk' | 'options' | 'error' | 'done';
  agent?: string;
  content?: string;
  product_name?: string;
  message?: string;
  status?: string;
  // Phase event
  phase?: Phase;
  // Options event
  question?: string;
  choices?: { key: string; text: string }[];
  canFinish?: boolean;
}

// --- Phase ---
export type Phase = 'discover' | 'draft' | 'iterate';

// --- Agent Config ---
export interface AgentConfig {
  initials: string;
  color: string;
  crewTagKey: string;
  shortNameKey: string;  // i18n key for short display name
}

export const AGENT_CONFIG: Record<string, AgentConfig> = {
  'Senior Product Manager': {
    initials: 'PM',
    color: 'var(--agent-pm)',
    crewTagKey: 'crew.pm.tag',
    shortNameKey: 'agent.pm',
  },
  'Senior Tech Lead': {
    initials: 'TL',
    color: 'var(--agent-tl)',
    crewTagKey: 'crew.tl.tag',
    shortNameKey: 'agent.dev',
  },
  'Product Designer': {
    initials: 'DS',
    color: 'var(--agent-designer)',
    crewTagKey: 'crew.des.tag',
    shortNameKey: 'agent.des',
  },
};

// --- App State ---
export type FlowStatus = 'idle' | 'running' | 'completed' | 'error';

// --- Chat items rendered in the message stream ---
export type ChatItem =
  | { type: 'error'; text: string }
  | { type: 'user'; content: string }
  | { type: 'divider'; agent: string }
  | {
      type: 'message';
      agent: string;
      status: 'running' | 'completed';
      content: string;
    }
  | {
      type: 'options';
      choices: { key: string; text: string }[];
      selected?: string;  // key of selected choice, undefined = not yet chosen
      canFinish?: boolean; // show "done" button only when true
    };

// --- Phase timeline node (replaces the old per-agent timeline) ---
export interface PhaseNode {
  phase: Phase;
  status: 'pending' | 'running' | 'completed';
}
