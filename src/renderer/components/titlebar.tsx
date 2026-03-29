import { Minus, Square, X } from 'lucide-react';

export function Titlebar(): React.JSX.Element {
  return (
    <header
      className="flex h-8 shrink-0 items-center justify-between border-b border-border bg-sidebar px-3"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <span className="text-xs font-medium text-muted-foreground">
        Azure Repos Scan
      </span>
      <div
        className="flex items-center gap-0.5"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          className="flex h-6 w-8 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          onClick={() => window.electronAPI?.minimize?.()}
          aria-label="Minimize"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          className="flex h-6 w-8 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          onClick={() => window.electronAPI?.maximize?.()}
          aria-label="Maximize"
        >
          <Square className="h-3 w-3" />
        </button>
        <button
          className="flex h-6 w-8 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-destructive hover:text-white"
          onClick={() => window.electronAPI?.close?.()}
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  );
}
