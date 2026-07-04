import type { PhaseNode } from '../types';
import { t } from '../i18n';

interface Props {
  phases: PhaseNode[];
}

const PHASE_META: Record<string, { labelKey: string; color: string }> = {
  discover: { labelKey: 'phase.discover', color: 'var(--agent-pm)' },
  draft: { labelKey: 'phase.draft', color: 'var(--agent-tl)' },
  iterate: { labelKey: 'phase.iterate', color: 'var(--accent-blue)' },
};

export function FlowTimeline({ phases }: Props) {
  return (
    <div className="flex items-center justify-center" style={{ padding: '16px 24px', gap: 0 }}>
      {phases.map((node, i) => {
        const meta = PHASE_META[node.phase];
        const label = t(meta.labelKey);
        const isLast = i === phases.length - 1;
        const isCompleted = node.status === 'completed';
        const isRunning = node.status === 'running';

        return (
          <div key={node.phase} className="flex items-center">
            <div className="flex flex-col items-center" style={{ gap: 6 }}>
              <div
                className="flex items-center justify-center"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 12,
                  border: `2px solid ${
                    isCompleted ? 'var(--accent-green)'
                    : isRunning ? meta.color
                    : 'var(--border)'
                  }`,
                  background: isCompleted ? 'var(--accent-green)' : isRunning ? meta.color : '#2d2d2d',
                  color: isCompleted ? '#fff' : isRunning ? '#fff' : 'var(--text-muted)',
                  fontSize: 12,
                  fontWeight: 700,
                  transition: 'all 0.3s ease',
                  boxShadow: isRunning ? 'var(--shadow-lg)' : 'var(--shadow-sm)',
                }}
              >
                {isCompleted ? '✓' : i + 1}
              </div>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: isCompleted || isRunning ? '#f5f5f7' : '#a1a1a6',
                  transition: 'color 0.3s ease',
                }}
              >
                {label}
              </span>
            </div>

            {!isLast && (
              <div
                style={{
                  width: 52,
                  height: 1,
                  margin: '0 4px',
                  marginBottom: 22,
                  background: isCompleted ? 'var(--accent-green)' : '#3a3a3c',
                  transition: 'background 0.3s ease',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
