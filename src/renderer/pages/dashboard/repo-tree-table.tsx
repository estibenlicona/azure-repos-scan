import { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@renderer/lib/utils';

const VERSION_COLORS: Record<string, string> = {
  'net3.1': '#f85149',
  'net5.0': '#f0883e',
  'net6.0': '#d29922',
  'net7.0': '#9f7aea',
  'net8.0': '#00d4aa',
  'net9.0': '#58a6ff',
  'net10.0': '#3fb950',
};

const FALLBACK_COLOR = '#8b949e';

interface RepoSummary {
  repositoryName: string;
  projectName: string;
  oldestVersion: string;
  allVersions: string[];
  branches: string[];
  csprojCount: number;
}

interface RepoTreeTableProps {
  readonly reposByVersion: Record<string, RepoSummary[]>;
}

function VersionBadge({ version }: { readonly version: string }): React.JSX.Element {
  const color = VERSION_COLORS[version] ?? FALLBACK_COLOR;
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{ backgroundColor: `${color}20`, color }}
    >
      {version}
    </span>
  );
}

function BranchBadge({ branch }: { readonly branch: string }): React.JSX.Element {
  return (
    <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
      {branch}
    </span>
  );
}

export function RepoTreeTable({ reposByVersion }: RepoTreeTableProps): React.JSX.Element {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (version: string): void => {
    setExpanded((prev) => ({ ...prev, [version]: !prev[version] }));
  };

  const sortedVersions = Object.keys(reposByVersion).sort();

  if (sortedVersions.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border">
        <p className="text-sm text-muted-foreground">No hay datos de repositorios disponibles</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-secondary/50">
            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Repositorio</th>
            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Proyecto</th>
            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Versiones</th>
            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Branches</th>
            <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">.csproj</th>
          </tr>
        </thead>
        <tbody>
          {sortedVersions.map((version) => {
            const repos = reposByVersion[version];
            const isExpanded = expanded[version] ?? false;
            const color = VERSION_COLORS[version] ?? FALLBACK_COLOR;

            return (
              <GroupRows
                key={version}
                version={version}
                repos={repos}
                isExpanded={isExpanded}
                color={color}
                onToggle={() => toggle(version)}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface GroupRowsProps {
  readonly version: string;
  readonly repos: RepoSummary[];
  readonly isExpanded: boolean;
  readonly color: string;
  readonly onToggle: () => void;
}

function GroupRows({ version, repos, isExpanded, color, onToggle }: GroupRowsProps): React.JSX.Element {
  return (
    <>
      <tr
        className="cursor-pointer border-b border-border transition-colors hover:bg-secondary/30"
        onClick={onToggle}
      >
        <td colSpan={5} className="px-0 py-0">
          <div className="flex items-center gap-3 px-4 py-2.5" style={{ borderLeft: `3px solid ${color}` }}>
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <VersionBadge version={version} />
            <span className="text-sm font-semibold text-foreground">{version}</span>
            <span className="text-xs text-muted-foreground">
              ({repos.length} {repos.length === 1 ? 'repositorio' : 'repositorios'})
            </span>
          </div>
        </td>
      </tr>
      {isExpanded &&
        repos.map((repo) => (
          <tr
            key={`${version}-${repo.repositoryName}-${repo.projectName}`}
            className={cn('border-b border-border/50 transition-colors hover:bg-secondary/20')}
          >
            <td className="py-2 pl-12 pr-4 text-foreground">{repo.repositoryName}</td>
            <td className="px-4 py-2 text-muted-foreground">{repo.projectName}</td>
            <td className="px-4 py-2">
              <div className="flex flex-wrap gap-1">
                {repo.allVersions.map((v) => (
                  <VersionBadge key={v} version={v} />
                ))}
              </div>
            </td>
            <td className="px-4 py-2">
              <div className="flex flex-wrap gap-1">
                {repo.branches.map((b) => (
                  <BranchBadge key={b} branch={b} />
                ))}
              </div>
            </td>
            <td className="px-4 py-2 text-right text-muted-foreground">{repo.csprojCount}</td>
          </tr>
        ))}
    </>
  );
}
