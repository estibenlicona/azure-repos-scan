import { useEffect, useState, useCallback } from 'react';
import { Play, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@renderer/lib/utils';
import { useScannerStore } from '@renderer/stores/scanner-store';
import { ipcClient } from '@renderer/lib/ipc-client';
import { ConfigPanel } from './config-panel';
import { VersionSelector } from './version-selector';
import { BranchSelector } from './branch-selector';
import { ResultsTable } from './results-table';
import { HistoryPanel } from './history-panel';

export function ScannerPage(): React.JSX.Element {
  const store = useScannerStore();
  const [isExporting, setIsExporting] = useState(false);

  const isScanning = store.scanState.status === 'scanning';
  const isComplete = store.scanState.status === 'complete';
  const isError = store.scanState.status === 'error';
  const canScan = store.organization.trim() !== '' && store.pat.trim() !== '' && !isScanning;

  const progress =
    store.scanState.status === 'scanning' && store.scanState.total > 0
      ? Math.round((store.scanState.progress / store.scanState.total) * 100)
      : 0;
  const progressMessage =
    store.scanState.status === 'scanning' ? store.scanState.message : '';

  // Load saved settings on mount
  useEffect(() => {
    const loadSettings = async (): Promise<void> => {
      try {
        const [org, pat] = await Promise.all([
          ipcClient.settings.get('lastOrganization'),
          ipcClient.settings.get('lastPat'),
        ]);
        if (org) store.setOrganization(org as string);
        if (pat) store.setPat(pat as string);
      } catch {
        // Settings unavailable — use defaults
      }
    };
    void loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load history on mount
  useEffect(() => {
    void store.loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScan = useCallback(async () => {
    if (!canScan) return;

    // Save settings before scanning
    try {
      await Promise.all([
        ipcClient.settings.set('lastOrganization', store.organization),
        ipcClient.settings.set('lastPat', store.pat),
      ]);
    } catch {
      // Non-critical — continue scanning
    }

    toast.info('Escaneo iniciado', { description: `Organización: ${store.organization}` });
    await store.startScan();

    // Show result toast after scan completes
    const state = useScannerStore.getState().scanState;
    if (state.status === 'complete') {
      toast.success('Escaneo completado', { description: `${state.hits.length} resultados encontrados` });
    } else if (state.status === 'error') {
      toast.error('Error en el escaneo', { description: state.message });
    }
  }, [canScan, store]);

  const handleExport = useCallback(async () => {
    const hits = store.filteredHits;
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
  }, [store.filteredHits]);

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Escáner</h1>
          <p className="text-sm text-muted-foreground">
            Buscar versiones .NET en repositorios de Azure DevOps
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleScan()}
          disabled={!canScan}
          className={cn(
            'inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50',
          )}
        >
          {isScanning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {isScanning ? 'Escaneando...' : 'Escanear'}
        </button>
      </div>

      {/* Progress / Status banner — always visible right below header */}
      {isScanning && (
        <div className="animate-fade-in rounded-lg border border-border bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm font-medium">Escaneando repositorios…</span>
          </div>
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>{progressMessage || 'Iniciando escaneo...'}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300 ease-in-out"
              style={{ width: `${Math.max(progress, 2)}%` }}
            />
          </div>
        </div>
      )}

      {isComplete && store.filteredHits.length > 0 && (
        <div className="animate-fade-in flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">
            Escaneo completado — {store.filteredHits.length} resultados encontrados
          </span>
        </div>
      )}

      {isError && (
        <div className="animate-fade-in flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <span className="text-sm text-destructive">
            {store.scanState.status === 'error' ? store.scanState.message : 'Error desconocido'}
          </span>
        </div>
      )}

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* Left column */}
        <div className="flex flex-col gap-4">
          <ConfigPanel
            organization={store.organization}
            project={store.project}
            pat={store.pat}
            onOrganizationChange={store.setOrganization}
            onProjectChange={store.setProject}
            onPatChange={store.setPat}
            disabled={isScanning}
          />
          <VersionSelector
            selectedVersions={store.selectedVersions}
            onToggle={(v) => store.toggleVersion(v as import('@renderer/stores/scanner-store').DotNetVersionId)}
            onSelectAll={store.selectAllVersions}
            onSelectNone={store.selectNoVersions}
            disabled={isScanning}
          />
          <BranchSelector
            selectedBranches={store.selectedBranches}
            onToggle={store.toggleBranch}
            onSelectAll={store.selectAllBranches}
            onSelectNone={store.selectNoBranches}
            disabled={isScanning}
          />
        </div>

        {/* Right column */}
        <div>
          <HistoryPanel
            history={store.history}
            onSelect={(date) => void store.loadHistoryRecord(date)}
            onRefresh={() => void store.loadHistory()}
            isLoading={false}
          />
        </div>
      </div>

      {/* Results */}
      <ResultsTable
        hits={store.filteredHits}
        versionFilter={store.versionFilter}
        onVersionFilterChange={store.setVersionFilter}
        currentPage={store.currentPage}
        pageSize={store.pageSize}
        onPageChange={store.setCurrentPage}
        onPageSizeChange={store.setPageSize}
        onExport={() => void handleExport()}
        isExporting={isExporting}
      />
    </div>
  );
}
