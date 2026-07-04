import { useState } from 'react';
import { t, getLang } from '../i18n';
import { Send, Plus, Clock, X } from 'lucide-react';
import type { HistoryItem } from '../hooks/useSSE';

interface Props {
  isFirstTurn: boolean;
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

  const handleSubmit = () => {
    const name = value.trim();
    if (name && !isRunning) {
      onSubmit(name);
      setValue('');
    }
  };

  return (
    <div className="flex flex-col h-full" style={{ gap: 24 }}>
      {/* Product name input */}
      <div className="flex flex-col" style={{ gap: 12 }}>
        <label
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--text-secondary)',
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
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            fontSize: 14,
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
            padding: '12px 0',
            borderRadius: 9999,
            border: 'none',
            background: isRunning
              ? 'var(--accent-amber)'
              : '#0A84FF',
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            fontFamily: 'inherit',
            opacity: isRunning || !value.trim() ? 0.55 : 1,
            cursor: isRunning || !value.trim() ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: isRunning || !value.trim()
              ? 'none'
              : '0 2px 8px rgba(10, 132, 255, 0.3)',
            transition: 'opacity 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease',
          }}
        >
          {isRunning ? (
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff',
                animation: 'spin 0.8s linear infinite',
                display: 'inline-block',
              }}
            />
          ) : (
            <Send size={16} />
          )}
          {isRunning ? t('input.running') : t('input.start')}
        </button>
      </div>

      {/* Conversation history */}
      {history.length > 0 && (
        <div className="flex flex-col flex-1 min-h-0" style={{ gap: 12 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--text-secondary)',
            }}
          >
            {t('history.title')}
          </span>
          <div className="flex flex-col overflow-y-auto" style={{ gap: 8 }}>
            {history.map((item) => (
              <div
                key={item.id}
                className="flex items-center"
                style={{
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-secondary)',
                  gap: 12,
                  transition: 'background-color 0.2s ease, opacity 0.2s ease',
                }}
              >
                <Clock size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
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
                  <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                    {item.productName}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {formatRelativeTime(item.timestamp)}
                  </div>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onRemoveHistory(item.id); }}
                  disabled={isRunning}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 2,
                    color: 'var(--text-muted)',
                    cursor: isRunning ? 'not-allowed' : 'pointer',
                    opacity: isRunning ? 0.5 : 0.8,
                  }}
                  title={t('history.delete')}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {history.length === 0 && <div className="flex-1" />}

      {/* New chat button — subtle, text-based */}
      {!isFirstTurn && (
        <button
          onClick={onNewChat}
          disabled={isRunning}
          style={{
            width: '100%',
            padding: '10px 0',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: 13,
            fontWeight: 500,
            fontFamily: 'inherit',
            opacity: isRunning ? 0.4 : 0.8,
            cursor: isRunning ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            transition: 'opacity 0.2s ease, background-color 0.2s ease',
          }}
        >
          <Plus size={14} />
          {t('input.start')}
        </button>
      )}
    </div>
  );
}
