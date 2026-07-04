import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useSSE, getHistory, removeHistory as removeHistoryItem } from './hooks/useSSE';
import type { HistoryItem } from './hooks/useSSE';
import { InputPanel } from './components/InputPanel';
import { FlowTimeline } from './components/FlowTimeline';
import { ChatMessage, OptionsCard, UserMessage } from './components/ChatMessage';
import { RoleDivider } from './components/RoleDivider';
import { ErrorMessage } from './components/ErrorMessage';
import type { ChatItem, FlowStatus, Phase, PhaseNode, SSEEvent } from './types';
import { t, getLocaleName, toggleLang, onLangChange } from './i18n';
import { Send, Plus, Menu, X, ChevronRight, Clock, Sparkles, MessageSquare, AlertCircle } from 'lucide-react';

// --- Phase nodes (the timeline) ---

const INITIAL_PHASES: PhaseNode[] = [
  { phase: 'discover', status: 'pending' },
  { phase: 'draft', status: 'pending' },
  { phase: 'iterate', status: 'pending' },
];

function phasesFor(current: Phase | null, completed: Set<Phase>): PhaseNode[] {
  return INITIAL_PHASES.map((p) => ({
    ...p,
    status: completed.has(p.phase)
      ? 'completed'
      : current === p.phase
        ? 'running'
        : 'pending',
  }));
}

// --- App state --

interface AppState {
  flowStatus: FlowStatus;
  messages: ChatItem[];
  currentPhase: Phase | null;
  completedPhases: Set<Phase>;
  isHistoryView: boolean;
  sidebarOpen: boolean;
}

const INITIAL_STATE: AppState = {
  flowStatus: 'idle',
  messages: [],
  currentPhase: null,
  completedPhases: new Set(),
  isHistoryView: false,
  sidebarOpen: true,
};

// --- Reducer --

type Action =
  | { type: 'RESET' }
  | { type: 'USER_MESSAGE'; content: string }
  | { type: 'TURN_START' }
  | { type: 'PHASE'; phase: Phase }
  | { type: 'AGENT_START'; agent: string }
  | { type: 'CHUNK'; agent: string; content: string }
  | { type: 'AGENT_END'; agent: string }
  | { type: 'OPTIONS'; choices: { key: string; text: string }[]; canFinish?: boolean }
  | { type: 'SELECT_OPTION'; key: string }
  | { type: 'DONE' }
  | { type: 'ERROR'; message: string }
  | { type: 'RESTORE'; messages: ChatItem[]; phase: Phase | null; completed: Set<Phase> }
  | { type: 'TOGGLE_SIDEBAR' };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'RESET':
      return { ...INITIAL_STATE, completedPhases: new Set(), isHistoryView: false, sidebarOpen: state.sidebarOpen };

    case 'USER_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, { type: 'user', content: action.content }],
      };

    case 'TURN_START':
      return { ...state, flowStatus: 'running' };

    case 'PHASE': {
      const completed = new Set(state.completedPhases);
      if (state.currentPhase && state.currentPhase !== action.phase) {
        completed.add(state.currentPhase);
      }
      return { ...state, currentPhase: action.phase, completedPhases: completed };
    }

    case 'AGENT_START': {
      return {
        ...state,
        messages: [
          ...state.messages,
          { type: 'divider' as const, agent: action.agent },
          { type: 'message' as const, agent: action.agent, status: 'running', content: '' },
        ],
      };
    }

    case 'CHUNK': {
      const msgs = [...state.messages];
      for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i];
        if (m.type === 'message' && m.agent === action.agent && m.status === 'running') {
          msgs[i] = { ...m, content: m.content + action.content };
          break;
        }
      }
      return { ...state, messages: msgs };
    }

    case 'AGENT_END': {
      const msgs = [...state.messages];

      for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i];
        if (m.type === 'message' && m.agent === action.agent && m.status === 'running') {
          let displayContent = m.content
            .replace(/\[READY\]/g, '')
            .replace(/\[PRD_UPDATED\]/g, '')
            .replace(/\[SPEC_UPDATED\]/g, '')
            .trim();

          msgs[i] = { ...m, status: 'completed' as const, content: displayContent };
          break;
        }
      }
      return { ...state, messages: msgs };
    }

    case 'DONE': {
      const hasPendingOptions = state.messages.some(
        (m) => m.type === 'options' && !m.selected
      );
      if (hasPendingOptions) {
        return { ...state, flowStatus: 'idle' };
      }
      const allCompleted = new Set(state.completedPhases);
      if (state.currentPhase) {
        allCompleted.add(state.currentPhase);
      }
      return { ...state, flowStatus: 'completed', completedPhases: allCompleted, currentPhase: null };
    }

    case 'OPTIONS':
      return {
        ...state,
        messages: [...state.messages, { type: 'options' as const, choices: action.choices, canFinish: action.canFinish }],
      };

    case 'SELECT_OPTION': {
      const msgs = [...state.messages];
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].type === 'options' && !(msgs[i] as any).selected) {
          msgs[i] = { ...msgs[i], selected: action.key } as any;
          break;
        }
      }
      return { ...state, messages: msgs };
    }

    case 'ERROR':
      return {
        ...state,
        flowStatus: 'error',
        messages: [
          ...state.messages,
          { type: 'error' as const, text: action.message },
        ],
      };

    case 'RESTORE':
      return {
        ...state,
        flowStatus: 'completed',
        messages: action.messages,
        currentPhase: action.phase,
        completedPhases: action.completed,
        isHistoryView: true,
      };

    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarOpen: !state.sidebarOpen };

    default:
      return state;
  }
}

// --- App --

export default function App() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  const handleSSEEvent = useCallback((event: SSEEvent) => {
    switch (event.type) {
      case 'flow_start':
        dispatch({ type: 'TURN_START' });
        break;
      case 'phase':
        if (event.phase) dispatch({ type: 'PHASE', phase: event.phase });
        break;
      case 'agent_start':
        if (event.agent) dispatch({ type: 'AGENT_START', agent: event.agent });
        break;
      case 'chunk':
        if (event.agent && event.content) dispatch({ type: 'CHUNK', agent: event.agent, content: event.content });
        break;
      case 'agent_end':
        if (event.agent) dispatch({ type: 'AGENT_END', agent: event.agent });
        break;
      case 'options':
        if (event.choices) dispatch({ type: 'OPTIONS', choices: event.choices, canFinish: event.canFinish });
        break;
      case 'done':
        dispatch({ type: 'DONE' });
        break;
      case 'error':
        dispatch({ type: 'ERROR', message: event.message || 'Unknown error' });
        break;
    }
  }, []);

  const { send, loadHistory, resetConversation } = useSSE(handleSSEEvent);

  const [history, setHistory] = useState<HistoryItem[]>(getHistory);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (loadError) {
      const timer = setTimeout(() => setLoadError(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [loadError]);

  const refreshHistory = useCallback(() => setHistory(getHistory()), []);

  const handleRemoveHistory = useCallback((id: string) => {
    removeHistoryItem(id);
    refreshHistory();
  }, [refreshHistory]);

  const [, setLangTick] = useState(0);
  useEffect(() => {
    return onLangChange(() => setLangTick((n) => n + 1));
  }, []);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    isNearBottomRef.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 80;
  }, []);

  useEffect(() => {
    if (isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [state.messages]);

  const isFirstTurn = state.messages.length === 0;

  const handleSubmit = useCallback((text: string) => {
    if (!isFirstTurn) {
      dispatch({ type: 'RESET' });
      resetConversation();
    }
    dispatch({ type: 'USER_MESSAGE', content: text });
    dispatch({ type: 'TURN_START' });
    isNearBottomRef.current = true;
    send(text, getLocaleName(), { isFirstTurn: true });
    setTimeout(refreshHistory, 100);
  }, [send, isFirstTurn, resetConversation, refreshHistory]);

  const handleNewChat = useCallback(() => {
    dispatch({ type: 'RESET' });
    resetConversation();
  }, [resetConversation]);

  const handleSelectOption = useCallback((key: string, text: string) => {
    dispatch({ type: 'SELECT_OPTION', key });
    dispatch({ type: 'USER_MESSAGE', content: text });
    dispatch({ type: 'TURN_START' });
    isNearBottomRef.current = true;
    send(text, getLocaleName(), { isFirstTurn: false });
  }, [send]);

  const handleDone = useCallback(() => {
    const text = t('options.finalize');
    dispatch({ type: 'SELECT_OPTION', key: 'done' });
    dispatch({ type: 'USER_MESSAGE', content: text });
    dispatch({ type: 'TURN_START' });
    isNearBottomRef.current = true;
    send(text, getLocaleName(), { isFirstTurn: false });
  }, [send]);

  const handleSelectHistory = useCallback(async (id: string) => {
    setIsLoadingHistory(true);
    dispatch({ type: 'RESET' });

    try {
      const messages = await loadHistory(id);

      const restored: ChatItem[] = [];
      let lastPhase: Phase | null = null;
      const completed = new Set<Phase>();

      for (const msg of messages) {
        const meta = (msg.metadata || {}) as Record<string, unknown>;
        const agent = meta.agent as string | undefined;
        const phase = meta.phase as Phase | undefined;

        if (msg.role === 'user') {
          restored.push({ type: 'user', content: msg.content });
          continue;
        }

        if (phase) {
          if (lastPhase && lastPhase !== phase) completed.add(lastPhase);
          lastPhase = phase;
        }

        if (agent) {
          if (agent === 'Product Reviewer') continue;
          restored.push({ type: 'divider', agent });
          restored.push({
            type: 'message',
            agent,
            status: 'completed',
            content: msg.content,
          });
        }
      }

      if (lastPhase) completed.delete(lastPhase);

      dispatch({
        type: 'RESTORE',
        messages: restored,
        phase: lastPhase,
        completed,
      });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unknown error');
    }
    setIsLoadingHistory(false);
  }, [loadHistory]);

  const hasAutoLoaded = useRef(false);
  useEffect(() => {
    if (hasAutoLoaded.current) return;
    hasAutoLoaded.current = true;
    const urlId = new URLSearchParams(window.location.search).get('id');
    if (urlId) {
      handleSelectHistory(urlId);
    }
  }, [handleSelectHistory]);

  const phaseNodes = phasesFor(state.currentPhase, state.completedPhases);

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      {/* Top Bar */}
      <header
        className="flex items-center justify-between flex-shrink-0"
        style={{
          height: 64,
          padding: '0 24px',
          borderBottom: '1px solid var(--border)',
          background: 'rgba(29, 29, 31, 0.8)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center"
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #0A84FF 0%, #BF5AF2 100%)',
              fontSize: 14,
              fontWeight: 700,
              color: '#fff',
            }}
          >
            S
          </div>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
            ShipKit
          </span>
          <div className="flex items-center gap-1.5" style={{ marginLeft: 4 }}>
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background:
                  state.flowStatus === 'running' ? 'var(--accent-amber)'
                  : state.flowStatus === 'completed' ? 'var(--accent-green)'
                  : state.flowStatus === 'error' ? 'var(--accent-red)'
                  : 'var(--text-muted)',
                animation: state.flowStatus === 'running' ? 'blink 1.2s infinite' : 'none',
              }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
              {t(`status.${state.flowStatus}`)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Mobile sidebar toggle */}
          <button
            onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
            className="cursor-pointer hidden md:flex"
            style={{
              background: 'none',
              border: 'none',
              padding: 4,
              color: 'var(--text-secondary)',
            }}
          >
            <Menu size={18} />
          </button>

          <button
            onClick={toggleLang}
            className="cursor-pointer"
            style={{
              padding: '4px 12px',
              borderRadius: 'var(--radius-xs)',
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 12,
              fontWeight: 500,
              fontFamily: 'inherit',
            }}
          >
            {t('lang.switch')}
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Floating error toast */}
        {loadError && (
          <div className="absolute top-4 inset-x-0 flex justify-center z-50 animate-fade-in">
            <div className="flex items-center gap-2.5" style={{
              borderRadius: 'var(--radius-md)',
              background: '#2d2d2d',
              padding: '10px 16px',
              boxShadow: 'var(--shadow-md)',
              border: '1px solid rgba(255, 69, 58, 0.2)',
            }}>
              <AlertCircle size={16} color="#FF453A" />
              <span style={{ fontSize: 14, color: '#FF453A' }}>
                {loadError === 'empty' ? t('history.empty') : `${t('history.failed')}: ${loadError}`}
              </span>
              <button
                onClick={() => setLoadError(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 2,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Sidebar */}
        <aside
          className="flex-shrink-0 overflow-hidden"
          style={{
            width: 300,
            padding: 24,
            borderRight: '1px solid var(--border)',
            background: 'var(--bg-secondary)',
            // Responsive: on small screens, overlay
            position: 'relative',
          }}
        >
          <InputPanel
            isFirstTurn={isFirstTurn}
            isRunning={!isFirstTurn && state.flowStatus !== 'completed'}
            onSubmit={handleSubmit}
            history={history}
            onSelectHistory={handleSelectHistory}
            onRemoveHistory={handleRemoveHistory}
            onNewChat={handleNewChat}
          />
        </aside>

        {/* Right Content */}
        <main className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
          {/* Phase timeline */}
          {!isFirstTurn && (
            <div
              className="flex-shrink-0"
              style={{
                borderBottom: '1px solid var(--border)',
                background: 'var(--bg-secondary)',
              }}
            >
              <FlowTimeline phases={phaseNodes} />
            </div>
          )}

          {/* Messages area */}
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto"
          >
            {isLoadingHistory ? (
              <div
                className="h-full flex flex-col items-center justify-center"
                style={{ padding: '0 24px' }}
              >
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    border: '3px solid var(--border)',
                    borderTopColor: 'var(--accent-blue)',
                    animation: 'spin 0.8s linear infinite',
                    display: 'inline-block',
                    marginBottom: 12,
                  }}
                />
                <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                  {t('history.loading')}
                </span>
              </div>
            ) : isFirstTurn ? (
              /* Empty state — clean text-based */
              <div
                className="h-full flex flex-col items-center justify-center animate-fade-in"
                style={{ padding: '0 24px' }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 'var(--radius-lg)',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 24,
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <Sparkles size={28} color="var(--accent-blue)" />
                </div>
                <h3 style={{ fontSize: 28, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 24 }}>
                  {t('empty.title')}
                </h3>
                <div className="flex flex-col" style={{ gap: 0, maxWidth: 340 }}>
                  {['empty.step1', 'empty.step2', 'empty.step3'].map((key, i, arr) => (
                    <div key={key} className="flex items-stretch" style={{ gap: 16 }}>
                      <div className="flex flex-col items-center" style={{ width: 24 }}>
                        <span
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            border: '1.5px solid var(--accent-blue)',
                            background: 'transparent',
                            color: 'var(--accent-blue)',
                            fontSize: 11,
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {i + 1}
                        </span>
                        {i < arr.length - 1 && (
                          <div style={{ width: 1, flex: 1, background: 'var(--border)', margin: '4px 0' }} />
                        )}
                      </div>
                      <span style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.5, paddingBottom: i < arr.length - 1 ? 16 : 0, paddingTop: 2 }}>
                        {t(key)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Message stream */
              <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 28px 32px' }}>
                {state.messages.map((item, i) => {
                  if (item.type === 'user') return <UserMessage key={i} content={item.content} />;
                  if (item.type === 'divider') return <RoleDivider key={i} agent={item.agent} />;
                  if (item.type === 'error') return <ErrorMessage key={i} text={item.text} />;
                  if (item.type === 'options') {
                    return (
                      <OptionsCard
                        key={i}
                        choices={item.choices}
                        selected={item.selected}
                        onSelect={handleSelectOption}
                        onDone={item.canFinish ? handleDone : undefined}
                      />
                    );
                  }
                  if (item.type === 'message') {
                    return (
                      <ChatMessage
                        key={i}
                        agent={item.agent}
                        status={item.status}
                        content={item.content}
                      />
                    );
                  }
                  return null;
                })}
                {state.flowStatus === 'running' && !state.messages.some(
                  (m) => m.type === 'message' && m.status === 'running'
                ) && !state.messages.some(
                  (m) => m.type === 'options' && !m.selected
                ) && (
                  <div className="flex items-center" style={{ gap: 4, padding: '16px 0', marginLeft: 50 }}>
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: 'var(--accent-blue)',
                          opacity: 0.5,
                          animation: `fadeIn 0.5s ease ${i * 0.15}s infinite alternate`,
                        }}
                      />
                    ))}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Conversation ended / history hint */}
          {((state.isHistoryView) || (!isFirstTurn && !state.isHistoryView && state.flowStatus === 'completed' && !state.messages.some(
            (m) => m.type === 'options' && !m.selected
          ))) && (
            <div
              className="flex items-center justify-center"
              style={{
                padding: '12px 24px',
                borderTop: '1px solid var(--border)',
                background: 'var(--bg-secondary)',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {t('msg.ended')}
              </span>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
