import { cn } from '@renderer/lib/utils';

const ACCENT_MAP = {
  cyan: { border: 'border-t-[#00d4aa]', bg: 'bg-[#00d4aa]/10', text: 'text-[#00d4aa]' },
  purple: { border: 'border-t-[#9f7aea]', bg: 'bg-[#9f7aea]/10', text: 'text-[#9f7aea]' },
  blue: { border: 'border-t-[#58a6ff]', bg: 'bg-[#58a6ff]/10', text: 'text-[#58a6ff]' },
  green: { border: 'border-t-[#3fb950]', bg: 'bg-[#3fb950]/10', text: 'text-[#3fb950]' },
} as const;

interface KpiCardProps {
  readonly value: string;
  readonly label: string;
  readonly icon: React.ReactNode;
  readonly accentColor?: 'cyan' | 'purple' | 'blue' | 'green';
}

export function KpiCard({ value, label, icon, accentColor = 'cyan' }: KpiCardProps): React.JSX.Element {
  const accent = ACCENT_MAP[accentColor];

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card border-t-2',
        accent.border,
        'flex items-center gap-4 px-4 py-5',
      )}
    >
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', accent.bg, accent.text)}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold leading-tight text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
