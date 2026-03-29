import { Titlebar } from './titlebar';
import { Sidebar } from './sidebar';
import { useNavStore, type PageId } from '@renderer/stores/nav-store';

interface LayoutProps {
  readonly children: (activePage: PageId) => React.ReactNode;
}

export function Layout({ children }: LayoutProps): React.JSX.Element {
  const { activePage, navigateTo } = useNavStore();

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <Titlebar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar activePage={activePage} onPageChange={navigateTo} />
        <main className="flex flex-1 flex-col overflow-y-auto">
          {children(activePage)}
        </main>
      </div>
    </div>
  );
}
