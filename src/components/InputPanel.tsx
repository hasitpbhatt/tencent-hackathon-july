import { useState } from 'react';
import { t, getLang } from '../i18n';
import type { HistoryItem } from '../hooks/useSSE';

function getDeployUrl() {
  const deployParams = '?template=crewai-product-planner-starter&from=within&fromAgent=1&agentLang=python';
  const edgeoneDeployUrl = `https://edgeone.ai/makers/new${deployParams}`;
  const cloudDeployUrl = `https://console.cloud.tencent.com/edgeone/makers/new${deployParams}`;

  if (typeof window === 'undefined') return edgeoneDeployUrl;
  return window.location.hostname.endsWith('.edgeone.dev') ? edgeoneDeployUrl : cloudDeployUrl;
}

interface Props {
  /** True if no messages yet — show product-name CTA + examples. */
  isFirstTurn: boolean;
  /** True while a turn is streaming — disable input. */
  isRunning: boolean;
  onSubmit: (text: string) => void;
  history: HistoryItem[];
  onSelectHistory: (id: string) => void;
  onRemoveHistory: (id: string) => void;
  onNewChat: () => void;
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  const zh = getLang() === 'zh';

  if (minutes < 1) return zh ? '刚刚' : 'just now';
  if (minutes < 60) return zh ? `${minutes} 分钟前` : `${minutes}m ago`;
  if (hours < 24) return zh ? `${hours} 小时前` : `${hours}h ago`;
  if (days < 7) return zh ? `${days} 天前` : `${days}d ago`;
  return new Date(timestamp).toLocaleDateString(zh ? 'zh-CN' : 'en-US');
}

/**
 * Sidebar input panel.
 * - First turn: prompts the boss to enter a product name (with quick examples).
 * - Subsequent turns: shows just the history list and a "new chat" button.
 *   The actual chat input lives at the bottom of the main chat column.
 */
export function InputPanel({
  isFirstTurn,
  isRunning,
  onSubmit,
  history,
  onSelectHistory,
  onRemoveHistory,
  onNewChat,
}: Props) {
  const [value, setValue] = useState('');

  const examples = [t('example.1'), t('example.2'), t('example.3')];

  const handleSubmit = () => {
    const name = value.trim();
    if (name && !isRunning) {
      onSubmit(name);
      setValue('');
    }
  };

  return (
    <div className="flex flex-col h-full" style={{ gap: 20 }}>
      {/* ─── Product-name input ─── */}
      <div className="flex flex-col" style={{ gap: 10 }}>
        <label
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '1.2px',
          }}
        >
          {t('input.label')}
        </label>

        <input
          type="text"
          value={value}
          onChange={(e) => !isRunning && setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !isRunning && handleSubmit()}
          placeholder={t('input.placeholder')}
          disabled={isRunning}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-light)',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            fontSize: 13,
            fontFamily: 'inherit',
            outline: 'none',
            opacity: isRunning ? 0.5 : 1,
          }}
        />

        <button
          onClick={handleSubmit}
          disabled={isRunning || !value.trim()}
          className="cursor-pointer"
          style={{
            width: '100%',
            padding: '10px 0',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: isRunning
              ? 'var(--accent-amber)'
              : 'linear-gradient(135deg, #5b93f5 0%, #7c6bf5 100%)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'inherit',
            opacity: isRunning || !value.trim() ? 0.55 : 1,
            cursor: isRunning || !value.trim() ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            boxShadow: isRunning || !value.trim()
              ? 'none'
              : '0 2px 12px rgba(91, 147, 245, 0.25)',
          }}
        >
          {isRunning && (
            <span
              style={{
                width: 13,
                height: 13,
                borderRadius: '50%',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff',
                animation: 'spin 0.8s linear infinite',
                display: 'inline-block',
              }}
            />
          )}
          {isRunning ? t('input.running') : t('input.start')}
        </button>
      </div>

      {/* Quick examples */}
      <div className="flex flex-col" style={{ gap: 10 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '1.2px',
          }}
        >
          {t('input.examples')}
        </span>
        <div className="flex flex-wrap" style={{ gap: 6 }}>
          {examples.map((ex) => (
            <button
              key={ex}
              onClick={() => !isRunning && setValue(ex)}
              disabled={isRunning}
              className="cursor-pointer"
              style={{
                padding: '5px 12px',
                borderRadius: 16,
                border: '1px solid var(--border-light)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
                fontSize: 12,
                fontFamily: 'inherit',
                opacity: isRunning ? 0.4 : 1,
              }}
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      {/* ─── History (scrollable) ─── */}
      {history.length > 0 && (
        <div className="flex flex-col flex-1 min-h-0" style={{ gap: 8 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '1.2px',
            }}
          >
            {t('history.title')}
          </span>
          <div className="flex flex-col overflow-y-auto" style={{ gap: 4 }}>
            {history.map((item) => (
              <div
                key={item.id}
                className="flex items-center"
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--border-light)',
                  background: 'var(--bg-tertiary)',
                  gap: 8,
                }}
              >
                <button
                  onClick={() => onSelectHistory(item.id)}
                  disabled={isRunning}
                  className="cursor-pointer"
                  style={{
                    flex: 1,
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    fontFamily: 'inherit',
                    cursor: isRunning ? 'not-allowed' : 'pointer',
                    opacity: isRunning ? 0.5 : 1,
                  }}
                >
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                    {item.productName}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {formatRelativeTime(item.timestamp)}
                  </div>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onRemoveHistory(item.id); }}
                  disabled={isRunning}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '2px 4px',
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    cursor: isRunning ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                    borderRadius: 4,
                    opacity: isRunning ? 0.5 : 1,
                  }}
                  title={t('history.delete')}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spacer when no history */}
      {history.length === 0 && <div className="flex-1" />}

      {/* ─── Footer: GitHub + Deploy ─── */}
      <div
        className="flex items-center flex-shrink-0"
        style={{
          paddingTop: 12,
          borderTop: '1px solid var(--border-light)',
          gap: 12,
        }}
      >
        <a
          href="https://github.com/TencentEdgeOne/crewai-planner-python"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center transition-colors"
          style={{ gap: 6, fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
        >
          <svg style={{ width: 16, height: 16 }} viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          GitHub
        </a>
        <a
          href={getDeployUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center transition-colors"
          style={{ gap: 6, fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
        >
          <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
            <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
            <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
            <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
          </svg>
          Deploy to Makers
        </a>
      </div>
    </div>
  );
}

