import { BarChart3, Search, Table2 } from 'lucide-react';
import { cn } from '@renderer/lib/utils';
import { useNavStore, type PageId } from '@renderer/stores/nav-store';

interface SidebarProps {
  readonly activePage: PageId;
  readonly onPageChange: (page: PageId) => void;
}

interface NavItem {
  readonly id: PageId;
  readonly label: string;
  readonly section: string;
  readonly icon: React.ReactNode;
}

const NAV_ITEMS: readonly NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', section: 'REPORTES', icon: <BarChart3 className="h-4 w-4" /> },
  { id: 'scanner', label: 'Escáner', section: 'HERRAMIENTAS', icon: <Search className="h-4 w-4" /> },
  { id: 'results', label: 'Resultados', section: 'HERRAMIENTAS', icon: <Table2 className="h-4 w-4" /> },
];

export function Sidebar({ activePage, onPageChange }: SidebarProps): React.JSX.Element {
  const sections = [...new Set(NAV_ITEMS.map((item) => item.section))];

  return (
    <aside className="flex w-52 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="flex h-12 items-center gap-2.5 border-b border-border px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
          <span className="text-xs font-bold text-primary-foreground">AR</span>
        </div>
        <span className="text-sm font-semibold text-foreground">Azure Repos</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {sections.map((section) => (
          <div key={section} className="mb-2">
            <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {section}
            </p>
            {NAV_ITEMS.filter((item) => item.section === section).map((item) => (
              <button
                key={item.id}
                onClick={() => onPageChange(item.id)}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
                  activePage === item.id
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                )}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <p className="text-[10px] text-muted-foreground">v0.1.0</p>
      </div>
    </aside>
  );
}
