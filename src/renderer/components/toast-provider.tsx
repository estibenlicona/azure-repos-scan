import { Toaster } from 'sonner';

export function ToastProvider(): React.JSX.Element {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: '#161b22',
          border: '1px solid #30363d',
          color: '#e6edf3',
        },
      }}
      theme="dark"
    />
  );
}
