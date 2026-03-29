import { Layout } from './components/layout';
import { ErrorBoundary } from './components/error-boundary';
import { ToastProvider } from './components/toast-provider';
import { DashboardPage } from './pages/dashboard/dashboard-page';
import { ScannerPage } from './pages/scanner/scanner-page';

export function App(): React.JSX.Element {
  return (
    <ErrorBoundary>
      <Layout>
        {(activePage) => {
          switch (activePage) {
            case 'dashboard':
              return <DashboardPage />;
            case 'scanner':
              return <ScannerPage />;
          }
        }}
      </Layout>
      <ToastProvider />
    </ErrorBoundary>
  );
}
