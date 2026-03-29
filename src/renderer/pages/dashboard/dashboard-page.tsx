import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Database, FileCode2, Crown, GitBranch, Camera, Loader2, AlertCircle, Inbox } from 'lucide-react';
import { toPng } from 'html-to-image';
import { cn } from '@renderer/lib/utils';
import { getVersionLabel } from '@renderer/lib/version-utils';
import { KpiCard } from '@renderer/components/kpi-card';
import { VersionDonutChart } from './charts/version-donut-chart';
import { BranchDonutChart } from './charts/branch-donut-chart';
import { EvolutionChart } from './charts/evolution-chart';
import { useDashboardStore } from '@renderer/stores/dashboard-store';
import { ipcClient } from '@renderer/lib/ipc-client';
import { toast } from 'sonner';

// ── Dashboard Page ───────────────────────────────────────────────────────────

export function DashboardPage(): React.JSX.Element {
  const store = useDashboardStore();
  const [isExporting, setIsExporting] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);

  // Auto-refresh data when page mounts / navigated to
  useEffect(() => {
    void store.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExport = useCallback(async () => {
    if (!dashboardRef.current) return;

    try {
      setIsExporting(true);

      const filePath = await ipcClient.export.saveDialog({
        title: 'Exportar dashboard como imagen',
        defaultPath: `dashboard-${store.selectedDate || 'export'}.png`,
        filters: [{ name: 'PNG', extensions: ['png'] }],
      });

      if (!filePath) return;

      const imageData = await toPng(dashboardRef.current, {
        backgroundColor: '#0d1117',
        pixelRatio: 2,
      });

      await ipcClient.export.image(imageData, filePath);
      toast.success('Dashboard exportado como imagen');
    } catch {
      toast.error('Error al exportar el dashboard');
    } finally {
      setIsExporting(false);
    }
  }, [store.selectedDate]);

  // Derive KPIs and chart data from loaded state
  const { totalRepos, totalCsprojs, dominantVersion, totalBranches, versionData, branchData } =
    useMemo(() => {
      if (store.loadState.status !== 'loaded') {
        return {
          totalRepos: 0,
          totalCsprojs: 0,
          dominantVersion: '—',
          totalBranches: 0,
          versionData: {} as Record<string, number>,
          branchData: {} as Record<string, number>,
        };
      }

      const { data } = store.loadState;

      // Version distribution: moniker → repo count
      const versionData: Record<string, number> = {};
      for (const [version, repos] of Object.entries(data.reposByVersion)) {
        versionData[version] = repos.length;
      }

      const totalRepos = Object.values(versionData).reduce((a, b) => a + b, 0);

      const dominantKey =
        Object.entries(versionData).sort(([, a], [, b]) => b - a)[0]?.[0] ?? '—';
      const dominantVersion = dominantKey === '—' ? '—' : getVersionLabel(dominantKey);

      // Branch distribution from all repo summaries
      const branchCounts: Record<string, number> = {};
      for (const repos of Object.values(data.reposByVersion)) {
        for (const repo of repos) {
          for (const branch of repo.branches) {
            branchCounts[branch] = (branchCounts[branch] ?? 0) + 1;
          }
        }
      }

      return {
        totalRepos,
        totalCsprojs: data.totalCsprojs,
        dominantVersion,
        totalBranches: data.branchesAvailable.length,
        versionData,
        branchData: branchCounts,
      };
    }, [store.loadState]);

  // Branch filter options: 'all' + branches available from loaded data
  const branchOptions = useMemo(() => {
    if (store.loadState.status !== 'loaded') return ['all'];
    return ['all', ...store.loadState.data.branchesAvailable];
  }, [store.loadState]);

  // ── Loading / idle state ──
  if (store.loadState.status === 'loading' || store.loadState.status === 'idle') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Cargando dashboard…</p>
      </div>
    );
  }

  // ── Error state ──
  if (store.loadState.status === 'error') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <p className="text-sm font-medium text-red-400">Error al cargar el dashboard</p>
        <p className="max-w-md text-center text-sm text-muted-foreground">
          {store.loadState.message}
        </p>
      </div>
    );
  }

  // ── Empty state ──
  if (store.loadState.status === 'empty' || store.availableDates.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
        <Inbox className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No hay datos disponibles. Ejecuta un escaneo primero.
        </p>
      </div>
    );
  }

  return (
    <div ref={dashboardRef} className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Resumen de versiones .NET en la organización
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={store.selectedDate}
            onChange={(e) => void store.selectDate(e.target.value)}
            className={cn(
              'rounded-md border border-border bg-secondary px-3 py-1.5 text-sm text-foreground',
              'focus:outline-none focus:ring-1 focus:ring-ring',
            )}
          >
            {store.availableDates.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <select
            value={store.branchFilter}
            onChange={(e) => void store.setBranchFilter(e.target.value)}
            className={cn(
              'rounded-md border border-border bg-secondary px-3 py-1.5 text-sm text-foreground',
              'focus:outline-none focus:ring-1 focus:ring-ring',
            )}
          >
            {branchOptions.map((b) => (
              <option key={b} value={b}>{b === 'all' ? 'Todas' : b}</option>
            ))}
          </select>

          <button
            onClick={() => void handleExport()}
            disabled={isExporting || store.loadState.status !== 'loaded'}
            className={cn(
              'flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-sm',
              'text-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50',
            )}
          >
            {isExporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Camera className="h-3.5 w-3.5" />
            )}
            Exportar imagen
          </button>
        </div>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          value={String(totalRepos)}
          label="Repositorios"
          icon={<Database className="h-5 w-5" />}
          accentColor="cyan"
        />
        <KpiCard
          value={String(totalCsprojs)}
          label="Proyectos .csproj"
          icon={<FileCode2 className="h-5 w-5" />}
          accentColor="purple"
        />
        <KpiCard
          value={dominantVersion}
          label="Versión Dominante"
          icon={<Crown className="h-5 w-5" />}
          accentColor="cyan"
        />
        <KpiCard
          value={String(totalBranches)}
          label="Branches"
          icon={<GitBranch className="h-5 w-5" />}
          accentColor="blue"
        />
      </div>

      {/* ── Donut Charts ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Distribución por Versión .NET">
          {Object.keys(versionData).length > 0 ? (
            <div className="h-[280px]">
              <VersionDonutChart data={versionData} />
            </div>
          ) : (
            <EmptyState />
          )}
        </ChartCard>

        <ChartCard title="Distribución por Branch">
          {Object.keys(branchData).length > 0 ? (
            <div className="h-[280px]">
              <BranchDonutChart data={branchData} />
            </div>
          ) : (
            <EmptyState />
          )}
        </ChartCard>
      </div>

      {/* ── Evolution Chart ─────────────────────────────────────────── */}
      <ChartCard title="Evolución Mensual">
        {store.evolution.length > 0 ? (
          <div className="h-[320px]">
            <EvolutionChart data={store.evolution} />
          </div>
        ) : (
          <EmptyState />
        )}
      </ChartCard>

    </div>
  );
}

// ── Helper Components ──────────────────────────────────────────────────────────

function ChartCard({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function EmptyState(): React.JSX.Element {
  return (
    <div className="flex h-[280px] items-center justify-center rounded-lg border border-dashed border-border">
      <p className="text-sm text-muted-foreground">Sin datos disponibles</p>
    </div>
  );
}
