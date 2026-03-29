import { History, RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@renderer/lib/utils';

interface HistoryPanelProps {
  history: Array<{ date: string; count: number }>;
  onSelect: (date: string) => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

export function HistoryPanel({
  history,
  onSelect,
  onRefresh,
  isLoading,
}: HistoryPanelProps): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Historial</h2>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="rounded-md px-2 py-1 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      <div className="max-h-64 overflow-y-auto">
        {history.length > 0 ? (
          <ul className="space-y-1">
            {history.map((entry) => (
              <li key={entry.date}>
                <button
                  type="button"
                  onClick={() => onSelect(entry.date)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors',
                    'hover:bg-secondary/60',
                  )}
                >
                  <span className="text-foreground">{entry.date}</span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {entry.count}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No hay consultas guardadas
          </p>
        )}
      </div>
    </div>
  );
}
