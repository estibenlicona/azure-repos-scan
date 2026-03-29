import { cn } from '@renderer/lib/utils';

interface VersionSelectorProps {
  selectedVersions: string[];
  onToggle: (version: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  disabled?: boolean;
}

const VERSIONS = [
  { id: 'Net31', label: '.NET 3.1', moniker: 'net3.1', color: '#f85149' },
  { id: 'Net50', label: '.NET 5.0', moniker: 'net5.0', color: '#f0883e' },
  { id: 'Net60', label: '.NET 6.0', moniker: 'net6.0', color: '#d29922' },
  { id: 'Net70', label: '.NET 7.0', moniker: 'net7.0', color: '#9f7aea' },
  { id: 'Net80', label: '.NET 8.0', moniker: 'net8.0', color: '#00d4aa' },
  { id: 'Net90', label: '.NET 9.0', moniker: 'net9.0', color: '#58a6ff' },
  { id: 'Net100', label: '.NET 10.0', moniker: 'net10.0', color: '#3fb950' },
] as const;

export { VERSIONS };

export function VersionSelector({
  selectedVersions,
  onToggle,
  onSelectAll,
  onSelectNone,
  disabled,
}: VersionSelectorProps): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold text-foreground">Versiones .NET</h2>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
        {VERSIONS.map((v) => {
          const checked = selectedVersions.includes(v.id);
          return (
            <label
              key={v.id}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
                checked
                  ? 'border-ring/50 bg-secondary'
                  : 'border-border hover:bg-secondary/50',
                disabled && 'pointer-events-none opacity-50',
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(v.id)}
                disabled={disabled}
                className="sr-only"
              />
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: v.color }}
              />
              <span className="text-foreground">{v.label}</span>
              {checked && (
                <svg
                  className="ml-auto h-3.5 w-3.5 text-primary"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </label>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onSelectAll}
          disabled={disabled}
          className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
        >
          Seleccionar todo
        </button>
        <button
          type="button"
          onClick={onSelectNone}
          disabled={disabled}
          className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
        >
          Ninguno
        </button>
      </div>
    </div>
  );
}
