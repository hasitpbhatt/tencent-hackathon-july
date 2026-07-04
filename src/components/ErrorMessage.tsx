import { AlertCircle } from 'lucide-react';

interface Props {
  text: string;
}

export function ErrorMessage({ text }: Props) {
  return (
    <div className="animate-fade-in" style={{ padding: '12px 0', margin: '8px 0' }}>
      <div
        style={{
          background: 'rgba(255, 69, 58, 0.08)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 18px',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div className="flex items-start" style={{ gap: 10 }}>
          <AlertCircle size={18} color="#FF453A" style={{ flexShrink: 0, marginTop: 1 }} />
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.5,
              color: '#FF453A',
              margin: 0,
              wordBreak: 'break-word',
            }}
          >
            {text}
          </p>
        </div>
      </div>
    </div>
  );
}
