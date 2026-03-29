import { Download, ChevronLeft, ChevronRight, Search, Loader2 } from 'lucide-react';
import { cn } from '@renderer/lib/utils';

interface Hit {
  repositoryName: string;
  projectName: string;
  dotnetVersion: string;
  branch: string;
}

interface ResultsTableProps {
  hits: Hit[];
  versionFilter: string;
  onVersionFilterChange: (filter: string) => void;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onExport: () => void;
  isExporting?: boolean;
}

const VERSION_COLORS: Record<string, string> = {
  Net31: '#f85149',
  Net50: '#f0883e',
  Net60: '#d29922',
  Net70: '#9f7aea',
  Net80: '#00d4aa',
  Net90: '#58a6ff',
  Net100: '#3fb950',
};

const VERSION_LABELS: Record<string, string> = {
  Net31: '.NET 3.1',
  Net50: '.NET 5.0',
  Net60: '.NET 6.0',
  Net70: '.NET 7.0',
  Net80: '.NET 8.0',
  Net90: '.NET 9.0',
  Net100: '.NET 10.0',
};

const PAGE_SIZES = [10, 25, 50, 100] as const;

export function ResultsTable({
  hits,
  versionFilter,
  onVersionFilterChange,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onExport,
  isExporting,
}: ResultsTableProps): React.JSX.Element {
  const filtered = versionFilter
    ? hits.filter((h) => h.dotnetVersion === versionFilter)
    : hits;

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages - 1);
  const start = safePage * pageSize;
  const pageHits = filtered.slice(start, start + pageSize);

  const uniqueVersions = [...new Set(hits.map((h) => h.dotnetVersion))].sort();

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{filtered.length}</span>{' '}
            resultado{filtered.length !== 1 ? 's' : ''}
          </span>

          {/* Version filter */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <select
              value={versionFilter}
              onChange={(e) => {
                onVersionFilterChange(e.target.value);
                onPageChange(0);
              }}
              className="h-8 appearance-none rounded-md border border-border bg-input pl-8 pr-8 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Todas las versiones</option>
              {uniqueVersions.map((v) => (
                <option key={v} value={v}>
                  {VERSION_LABELS[v] ?? v}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={onExport}
          disabled={isExporting || filtered.length === 0}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Exportar
        </button>
      </div>

      {/* Table */}
      {pageHits.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Repositorio</th>
                <th className="px-4 py-2.5 font-medium">Proyecto</th>
                <th className="px-4 py-2.5 font-medium">Versión .NET</th>
                <th className="px-4 py-2.5 font-medium">Branch</th>
              </tr>
            </thead>
            <tbody>
              {pageHits.map((hit, idx) => {
                const color = VERSION_COLORS[hit.dotnetVersion] ?? '#8b949e';
                return (
                  <tr
                    key={`${hit.repositoryName}-${hit.branch}-${hit.dotnetVersion}-${idx}`}
                    className={cn(
                      'border-b border-border/50 transition-colors hover:bg-secondary/40',
                      idx % 2 === 1 && 'bg-secondary/20',
                    )}
                  >
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      {hit.repositoryName}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{hit.projectName}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: `${color}20`,
                          color,
                        }}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        {VERSION_LABELS[hit.dotnetVersion] ?? hit.dotnetVersion}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{hit.branch}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Search className="mb-2 h-8 w-8 opacity-40" />
          <p className="text-sm">No se encontraron resultados</p>
          {versionFilter && (
            <button
              type="button"
              onClick={() => onVersionFilterChange('')}
              className="mt-2 text-xs text-primary hover:underline"
            >
              Limpiar filtro
            </button>
          )}
        </div>
      )}

      {/* Pagination */}
      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Filas por página</span>
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(0);
              }}
              className="h-7 rounded-md border border-border bg-input px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {PAGE_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Página {safePage + 1} de {totalPages}
            </span>
            <button
              type="button"
              onClick={() => onPageChange(safePage - 1)}
              disabled={safePage === 0}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onPageChange(safePage + 1)}
              disabled={safePage >= totalPages - 1}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
