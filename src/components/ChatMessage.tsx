import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeRaw from 'rehype-raw';
import { AGENT_CONFIG } from '../types';
import { t } from '../i18n';

interface Props {
  agent: string;
  status: 'running' | 'completed';
  content: string;
}

const AVATAR_STYLES: Record<string, { bg: string; border: string }> = {
  'Senior Product Manager': { bg: 'var(--agent-pm-bg)', border: 'var(--agent-pm-border)' },
  'Senior Tech Lead': { bg: 'var(--agent-tl-bg)', border: 'var(--agent-tl-border)' },
  'Product Designer': { bg: 'var(--agent-designer-bg)', border: 'var(--agent-designer-border)' },
};

export function ChatMessage({ agent, status, content }: Props) {
  const config = AGENT_CONFIG[agent] || { initials: 'AI', color: 'var(--text-muted)', crewTagKey: '', shortNameKey: '' };
  const shortName = config.shortNameKey ? t(config.shortNameKey) : agent;
  const avatarStyle = AVATAR_STYLES[agent] || { bg: 'rgba(10,132,255,0.08)', border: 'rgba(10,132,255,0.18)' };

  const [rendered, setRendered] = useState(content);
  useEffect(() => {
    if (status === 'completed') {
      setRendered(content);
      return;
    }
    const timer = setTimeout(() => setRendered(content), 80);
    return () => clearTimeout(timer);
  }, [content, status]);

  const crewTag = config.crewTagKey ? t(config.crewTagKey) : '';
  const isRunning = status === 'running';

  return (
    <div className="flex animate-fade-in-up" style={{ gap: 12, padding: '16px 0' }}>
      {/* ─── Avatar ─── */}
      <div style={{ flexShrink: 0 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: avatarStyle.bg,
            border: `1px solid ${avatarStyle.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            fontWeight: 700,
            color: config.color,
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {config.initials}
        </div>
      </div>

      {/* ─── Body ─── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Meta row */}
        <div className="flex items-baseline" style={{ gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: config.color }}>{shortName}</span>
          {crewTag && (
            <span
              style={{
                fontSize: 12,
                padding: '2px 8px',
                borderRadius: 'var(--radius-xs)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-muted)',
              }}
            >
              {crewTag}
            </span>
          )}
        </div>

        {/* Content bubble */}
        <div
          style={{
            background: '#2d2d2d',
            borderRadius: 14,
            padding: '16px 18px',
            fontSize: 15,
            lineHeight: 1.5,
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {rendered ? (
            <div className={isRunning ? 'cursor-blink' : ''}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkBreaks]}
                rehypePlugins={[rehypeRaw]}
                components={{
                  h1: ({ children }) => <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', margin: '16px 0 8px' }}>{children}</h1>,
                  h2: ({ children }) => <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: '14px 0 6px' }}>{children}</h2>,
                  h3: ({ children }) => <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', margin: '12px 0 5px' }}>{children}</h3>,
                  h4: ({ children }) => <h4 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: '10px 0 4px' }}>{children}</h4>,
                  p: ({ children }) => <p style={{ color: 'var(--text-secondary)', margin: '4px 0' }}>{children}</p>,
                  ul: ({ children }) => <ul style={{ color: 'var(--text-secondary)', listStyle: 'none', padding: 0, margin: '4px 0' }}>{children}</ul>,
                  ol: ({ children }) => <ol style={{ color: 'var(--text-secondary)', paddingLeft: 18, margin: '4px 0' }}>{children}</ol>,
                  li: ({ children }) => (
                    <li style={{ paddingLeft: 14, position: 'relative', marginBottom: 2 }}>
                      <span style={{ position: 'absolute', left: 2, color: 'var(--text-muted)' }}>•</span>
                      {children}
                    </li>
                  ),
                  strong: ({ children }) => <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{children}</strong>,
                  code: ({ children }) => (
                    <code style={{ padding: '1px 5px', borderRadius: 4, fontSize: 13, background: 'var(--bg-tertiary)', color: 'var(--accent-amber)' }}>
                      {children}
                    </code>
                  ),
                  table: ({ children }) => (
                    <div style={{ overflowX: 'auto', margin: '8px 0' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>{children}</table>
                    </div>
                  ),
                  thead: ({ children }) => <thead style={{ borderBottom: '1.5px solid var(--border)' }}>{children}</thead>,
                  th: ({ children }) => <th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-primary)', fontWeight: 600, whiteSpace: 'nowrap' }}>{children}</th>,
                  td: ({ children }) => <td style={{ padding: '5px 10px', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>{children}</td>,
                }}
              >
                {rendered}
              </ReactMarkdown>
            </div>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>{t('msg.thinking')}</span>
          )}
        </div>
      </div>
    </div>
  );
}


// ─── Options card ───

interface OptionsCardProps {
  choices: { key: string; text: string }[];
  selected?: string;
  onSelect: (key: string, text: string) => void;
  onDone?: () => void;
}

export function OptionsCard({ choices, selected, onSelect, onDone }: OptionsCardProps) {
  const [customText, setCustomText] = useState('');
  const [expanded, setExpanded] = useState(!selected);

  useEffect(() => {
    if (selected) setExpanded(false);
  }, [selected]);

  const handleCustomSubmit = () => {
    const v = customText.trim();
    if (v && !selected) {
      onSelect('custom', v);
    }
  };

  const isDisabled = !!selected;

  if (isDisabled && !expanded) {
    const selectedChoice = selected === 'custom'
      ? { key: '✏️', text: customText }
      : selected === 'done'
        ? { key: '✓', text: t('options.done') }
        : choices.find((c) => c.key === selected);
    return (
      <div style={{ padding: '2px 0 6px', marginLeft: 50 }}>
        <button
          onClick={() => setExpanded(true)}
          className="cursor-pointer flex items-center"
          style={{
            gap: 6,
            padding: '6px 12px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-secondary)',
            fontSize: 12,
            fontFamily: 'inherit',
            fontWeight: 400,
            cursor: 'pointer',
            maxWidth: '70%',
            transition: 'background-color 0.2s ease, opacity 0.2s ease',
          }}
        >
          <span style={{ fontSize: 12, flexShrink: 0 }}>{selectedChoice?.key || '?'}</span>
          <span style={{ opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(selectedChoice?.text || '').replace(/\*\*(.+?)\*\*/g, '$1')}</span>
          <span style={{ fontSize: 10, flexShrink: 0, opacity: 0.5 }}>▾</span>
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up" style={{ padding: isDisabled ? '4px 0 8px' : '8px 0 12px', marginLeft: 50 }}>
      <div className="flex flex-col" style={{ gap: isDisabled ? 8 : 10 }}>
        {isDisabled && (
          <button
            onClick={() => setExpanded(false)}
            className="cursor-pointer"
            style={{
              alignSelf: 'flex-end',
              padding: '4px 10px',
              borderRadius: 'var(--radius-xs)',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 12,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            {t('doc.collapse')}
          </button>
        )}

        {choices.map((c) => {
          const isSelected = selected === c.key;
          const muted = isDisabled;
          return (
            <button
              key={c.key}
              onClick={() => !isDisabled && onSelect(c.key, c.text)}
              disabled={isDisabled}
              className="cursor-pointer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: muted ? '10px 16px' : '12px 16px',
                borderRadius: 'var(--radius-md)',
                border: isSelected && !muted
                  ? '1.5px solid var(--accent-blue)'
                  : '1px solid var(--border)',
                background: isSelected && !muted
                  ? 'rgba(10, 132, 255, 0.08)'
                  : '#3a3a3c',
                color: muted
                  ? isSelected ? 'var(--text-secondary)' : 'var(--text-muted)'
                  : isSelected ? 'var(--accent-blue)' : 'var(--text-secondary)',
                fontSize: muted ? 13 : 14,
                fontFamily: 'inherit',
                fontWeight: isSelected ? 500 : 400,
                textAlign: 'left',
                cursor: isDisabled ? 'default' : 'pointer',
                opacity: muted && !isSelected ? 0.4 : muted ? 0.85 : 1,
                transition: 'opacity 0.2s ease, background-color 0.2s ease',
              }}
            >
              <span
                style={{
                  width: muted ? 20 : 24,
                  height: muted ? 20 : 24,
                  borderRadius: '50%',
                  border: isSelected && !muted
                    ? '2px solid var(--accent-blue)'
                    : '1.5px solid var(--border)',
                  background: isSelected && !muted ? 'var(--accent-blue)' : 'transparent',
                  color: isSelected && !muted ? '#fff' : 'var(--text-muted)',
                  fontSize: 12,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {c.key}
              </span>
              <span>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => <>{children}</>,
                    strong: ({ children }) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
                  }}
                >
                  {c.text}
                </ReactMarkdown>
              </span>
            </button>
          );
        })}

        {/* Inline custom input */}
        {!isDisabled && (
          <div
            className="flex items-center"
            style={{
              gap: 10,
              padding: '10px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--border)',
              background: 'var(--bg-secondary)',
            }}
          >
            <span style={{ fontSize: 14, color: 'var(--text-muted)', flexShrink: 0 }}>✏️</span>
            <input
              type="text"
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
              placeholder={t('options.custom')}
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                color: 'var(--text-primary)',
                fontSize: 14,
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
            {customText.trim() && (
              <button
                onClick={handleCustomSubmit}
                className="cursor-pointer"
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  background: '#0A84FF',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  transition: 'opacity 0.2s ease',
                }}
              >
                {t('chat.send')}
              </button>
            )}
          </div>
        )}
        {selected === 'custom' && (
          <div
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              background: 'var(--bg-secondary)',
              fontSize: 13,
              color: 'var(--text-secondary)',
              fontWeight: 400,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              opacity: 0.85,
            }}
          >
            <span style={{ fontSize: 13 }}>✏️</span>
            <span>{customText || '...'}</span>
          </div>
        )}

        {/* Done button */}
        {!isDisabled && onDone && (
          <button
            onClick={onDone}
            className="cursor-pointer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              background: '#3a3a3c',
              color: 'var(--text-secondary)',
              fontSize: 13,
              fontFamily: 'inherit',
              cursor: 'pointer',
              marginTop: 4,
              transition: 'opacity 0.2s ease, background-color 0.2s ease',
            }}
          >
            <span style={{ fontSize: 14 }}>✓</span>
            <span>{t('options.done')}</span>
          </button>
        )}
        {isDisabled && selected === 'done' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              fontSize: 13,
              opacity: 0.85,
              marginTop: 4,
            }}
          >
            <span style={{ fontSize: 14 }}>✓</span>
            <span>{t('options.done')}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── User message bubble ───

interface UserMsgProps {
  content: string;
}

export function UserMessage({ content }: UserMsgProps) {
  return (
    <div className="flex animate-fade-in-up" style={{ justifyContent: 'flex-end', padding: '12px 0' }}>
      <div
        style={{
          maxWidth: '78%',
          padding: '10px 16px',
          background: '#0A84FF',
          color: '#fff',
          fontSize: 15,
          lineHeight: 1.5,
          borderRadius: 14,
          wordBreak: 'break-word',
        }}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkBreaks]}
          rehypePlugins={[rehypeRaw]}
          components={{
            p: ({ children }) => <p style={{ margin: 0 }}>{children}</p>,
            strong: ({ children }) => <strong style={{ fontWeight: 700 }}>{children}</strong>,
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
