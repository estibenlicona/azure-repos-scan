import { useState, useCallback } from 'react';
import { Download, ChevronLeft, ChevronRight, Search, Loader2, Inbox, ArrowLeft } from 'lucide-react';
import { cn } from '@renderer/lib/utils';
import { getVersionLabel, getVersionColor } from '@renderer/lib/version-utils';
import { useScannerStore } from '@renderer/stores/scanner-store';
import { useNavStore } from '@renderer/stores/nav-store';
import { ipcClient } from '@renderer/lib/ipc-client';
import { toast } from 'sonner';

const PAGE_SIZES = [10, 25, 50, 100] as const;

export function ResultsPage(): React.JSX.Element {
  const store = useScannerStore();
  const { navigateTo } = useNavStore();
  const [isExporting, setIsExporting] = useState(false);

  const hits = store.filteredHits;
  const totalPages = Math.max(1, Math.ceil(hits.length / store.pageSize));
  const safePage = Math.min(store.currentPage, totalPages - 1);
  const start = safePage * store.pageSize;
  const pageHits = hits.slice(start, start + store.pageSize);

  const allHits = store.scanState.status === 'complete' ? store.scanState.hits : [];
  const uniqueVersions = [...new Set(allHits.map((h) => h.dotnetVersion))].sort();

  const handleExport = useCallback(async () => {
    if (hits.length === 0) return;
    try {
      setIsExporting(true);
      const result = await ipcClient.export.saveDialog({
        title: 'Exportar resultados',
        defaultPath: `scan-results-${new Date().toISOString().slice(0, 10)}.xlsx`,
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      });

      if (result && typeof result === 'string') {
        await ipcClient.export.excel(hits, result);
        toast.success('Exportación completada');
      } else if (result && typeof result === 'object' && 'filePath' in result) {
        const filePath = (result as { filePath?: string }).filePath;
        if (filePath) {
          await ipcClient.export.excel(hits, filePath);
          toast.success('Exportación completada');
        }
      }
    } catch {
      toast.error('Error al exportar');
    } finally {
      setIsExporting(false);
    }
  }, [hits]);

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigateTo('scanner')}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">Resultados</h1>
            <p className="text-sm text-muted-foreground">
              {allHits.length} resultado{allHits.length !== 1 ? 's' : ''} encontrados
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={isExporting || hits.length === 0}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Exportar Excel
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={store.nameFilter}
            onChange={(e) => store.setNameFilter(e.target.value)}
            placeholder="Buscar por nombre de repositorio…"
            className="h-9 w-full rounded-md border border-border bg-input pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={store.versionFilter}
          onChange={(e) => store.setVersionFilter(e.target.value)}
          className="h-9 appearance-none rounded-md border border-border bg-input px-3 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">Todas las versiones</option>
          {uniqueVersions.map((v) => (
            <option key={v} value={v}>
              {getVersionLabel(v)}
            </option>
          ))}
        </select>
        <span className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{hits.length}</span>{' '}
          resultado{hits.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card">
        {pageHits.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Repositorio</th>
                  <th className="px-4 py-2.5 font-medium">Proyecto</th>
                  <th className="px-4 py-2.5 font-medium">Versión .NET</th>
                  <th className="px-4 py-2.5 font-medium">Branch</th>
                  <th className="px-4 py-2.5 font-medium text-right">.csproj</th>
                </tr>
              </thead>
              <tbody>
                {pageHits.map((hit, idx) => {
                  const color = getVersionColor(hit.dotnetVersion);
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
                          style={{ backgroundColor: `${color}20`, color }}
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                          {getVersionLabel(hit.dotnetVersion)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{hit.branch}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">
                        {hit.csprojCount}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Inbox className="mb-2 h-8 w-8 opacity-40" />
            <p className="text-sm">No se encontraron resultados</p>
            {(store.versionFilter !== 'all' || store.nameFilter) && (
              <button
                type="button"
                onClick={() => {
                  store.setVersionFilter('all');
                  store.setNameFilter('');
                }}
                className="mt-2 text-xs text-primary hover:underline"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        )}

        {/* Pagination */}
        {hits.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Filas por página</span>
              <select
                value={store.pageSize}
                onChange={(e) => {
                  store.setPageSize(Number(e.target.value));
                  store.setCurrentPage(0);
                }}
                className="h-7 rounded-md border border-border bg-input px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {PAGE_SIZES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Página {safePage + 1} de {totalPages}
              </span>
              <button
                type="button"
                onClick={() => store.setCurrentPage(safePage - 1)}
                disabled={safePage === 0}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => store.setCurrentPage(safePage + 1)}
                disabled={safePage >= totalPages - 1}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
