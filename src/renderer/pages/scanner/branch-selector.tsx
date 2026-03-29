import { GitBranch } from 'lucide-react';
import { cn } from '@renderer/lib/utils';

interface BranchSelectorProps {
  selectedBranches: string[];
  onToggle: (branch: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  disabled?: boolean;
}

const BRANCHES = ['develop', 'test', 'master'] as const;

export function BranchSelector({
  selectedBranches,
  onToggle,
  onSelectAll,
  onSelectNone,
  disabled,
}: BranchSelectorProps): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <GitBranch className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">Branches</h2>
      </div>

      <div className="flex flex-wrap gap-2">
        {BRANCHES.map((branch) => {
          const checked = selectedBranches.includes(branch);
          return (
            <label
              key={branch}
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
                onChange={() => onToggle(branch)}
                disabled={disabled}
                className="sr-only"
              />
              <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-foreground">{branch}</span>
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
