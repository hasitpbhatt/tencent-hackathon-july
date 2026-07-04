import { AGENT_CONFIG } from '../types';
import { t } from '../i18n';

interface Props {
  agent: string;
}

export function RoleDivider({ agent }: Props) {
  const config = AGENT_CONFIG[agent];
  const color = config?.color || 'var(--text-muted)';
  const shortName = config?.shortNameKey ? t(config.shortNameKey) : agent;

  return (
    <div className="flex items-center animate-fade-in" style={{ gap: 10, padding: '14px 0 4px', marginTop: 4 }}>
      <div
        style={{
          flex: 1,
          height: 1,
          background: '#3a3a3c',
        }}
      />
      <div
        className="flex items-center"
        style={{
          gap: 6,
          padding: '4px 12px',
          borderRadius: 'var(--radius-sm)',
          background: '#2d2d2d',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: color }} />
        <span style={{ fontSize: 13, fontWeight: 500, color: '#a1a1a6' }}>
          {shortName} {t('msg.speaking')}
        </span>
      </div>
      <div
        style={{
          flex: 1,
          height: 1,
          background: '#3a3a3c',
        }}
      />
    </div>
  );
}
