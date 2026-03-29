# Development Skill: Azure Repos Scan (Electron)

## Project Overview

Azure DevOps repository scanner with modern Electron UI. Scans organizations for .NET version usage across repositories and presents results in an interactive dashboard.

## Tech Stack

- **Runtime**: Electron 33+ (Main + Renderer processes)
- **Frontend**: React 19 + TypeScript 5.7+
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **Charts**: Chart.js 4 + react-chartjs-2
- **State Management**: Zustand
- **HTTP Client**: Axios (main process only)
- **Excel Export**: exceljs
- **Build**: Electron Forge + Vite
- **Testing**: Vitest + React Testing Library
- **Linting**: ESLint + Prettier

## Architecture

### Hexagonal Architecture (Ports & Adapters)

```
src/main/           → Electron Main Process (Node.js)
  domain/           → Pure business logic, models, interfaces
  application/      → Use cases, orchestration
  infrastructure/   → External adapters (HTTP, file I/O)

src/renderer/       → Electron Renderer Process (React)
  components/       → Reusable UI components
  pages/            → Page-level components
  stores/           → Zustand state management
  hooks/            → Custom React hooks
  lib/              → Utilities
```

### Key Principles

1. **Domain layer is pure** — No dependencies on frameworks, libraries, or I/O
2. **Ports define contracts** — TypeScript interfaces in `domain/ports.ts`
3. **Adapters implement ports** — Infrastructure code depends on domain, never the reverse
4. **Use cases orchestrate** — Application layer coordinates domain + infrastructure
5. **UI is a thin layer** — Renderer only displays data and captures user input
6. **IPC is the bridge** — All business logic runs in main process; renderer communicates via IPC

### IPC Security Model

- **contextIsolation: true** — Renderer has no access to Node.js APIs
- **nodeIntegration: false** — No `require()` in renderer
- **Preload script** — Exposes typed API via `contextBridge`
- **PAT never in renderer** — Secrets stay in main process
- **Input validation** — Validate all IPC payloads with Zod schemas

## Naming Conventions

### Files & Directories

| Type | Convention | Example |
|---|---|---|
| Directories | kebab-case | `use-cases/`, `kpi-card/` |
| TypeScript files | kebab-case | `azure-devops-client.ts` |
| React components | kebab-case file, PascalCase export | `scanner-page.tsx` → `ScannerPage` |
| Test files | `*.test.ts` or `*.test.tsx` | `models.test.ts` |
| Type definition files | `*.d.ts` | `electron.d.ts` |
| Index files | `index.ts` | Re-export public API |

### Code

| Type | Convention | Example |
|---|---|---|
| Components | PascalCase | `ScannerPage`, `KpiCard` |
| Functions | camelCase | `buildDashboardData`, `searchCode` |
| Variables | camelCase | `selectedVersions`, `isLoading` |
| Constants | UPPER_SNAKE_CASE | `VERSION_COLORS`, `DEFAULT_BRANCHES` |
| Types/Interfaces | PascalCase | `DailyQueryRecord`, `AzureDevOpsClient` |
| Enums | PascalCase name, PascalCase members | `DotNetVersion.Net80` |
| Zustand stores | `use{Name}Store` | `useScannerStore`, `useDashboardStore` |
| Custom hooks | `use{Name}` | `useIpc`, `useTheme` |
| IPC channels | `domain:action` | `scan:start`, `dashboard:load` |

## TypeScript Rules

### Strict Mode — Always

```json
{
  "strict": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "noFallthroughCasesInSwitch": true
}
```

### Type Practices

- **Never use `any`** — Use `unknown` and narrow with type guards
- **Prefer interfaces** for object shapes that may be extended
- **Use type aliases** for unions, intersections, mapped types
- **Explicit return types** on all exported functions
- **Readonly by default** — Use `readonly` for arrays and object properties in domain models
- **Discriminated unions** for complex state (loading | success | error)
- **Zod for runtime validation** — All external data (IPC payloads, API responses, file reads)

### Example — Domain Model

```typescript
// ✅ Good
export interface Project {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly url: string;
}

// ✅ Good — Discriminated union
export type ScanState =
  | { status: 'idle' }
  | { status: 'scanning'; progress: number; message: string }
  | { status: 'complete'; record: DailyQueryRecord }
  | { status: 'error'; message: string };
```

### Example — Use Case

```typescript
// ✅ Good — Injected dependencies, single responsibility
export class ListProjectsUseCase {
  constructor(private readonly client: AzureDevOpsClient) {}

  async execute(): Promise<readonly Project[]> {
    return this.client.listProjects();
  }
}
```

## React Patterns

### Components

- **Functional components only** — No class components
- **Named exports** — `export function ScannerPage()`, never default exports
- **Props interface** — Always define explicit props type
- **Destructure props** — `function KpiCard({ value, label }: KpiCardProps)`
- **No prop drilling** — Use Zustand stores or context for shared state
- **Composition over inheritance** — Use children and render props

### Example — Component

```tsx
// ✅ Good
interface KpiCardProps {
  readonly value: string;
  readonly label: string;
  readonly icon: React.ReactNode;
  readonly accentColor?: 'cyan' | 'purple';
}

export function KpiCard({
  value,
  label,
  icon,
  accentColor = 'cyan',
}: KpiCardProps): React.JSX.Element {
  return (
    <Card className={cn('border-t-2', accentColor === 'cyan' ? 'border-t-accent' : 'border-t-purple-500')}>
      <CardContent className="flex items-center gap-3 p-4">
        {icon}
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
```

### State Management (Zustand)

```typescript
// ✅ Good — Typed store with actions
interface ScannerState {
  organization: string;
  selectedVersions: readonly DotNetVersion[];
  scanState: ScanState;
  setOrganization: (org: string) => void;
  toggleVersion: (version: DotNetVersion) => void;
  startScan: () => Promise<void>;
}

export const useScannerStore = create<ScannerState>()((set, get) => ({
  organization: '',
  selectedVersions: [],
  scanState: { status: 'idle' },
  setOrganization: (org) => set({ organization: org }),
  toggleVersion: (version) =>
    set((state) => ({
      selectedVersions: state.selectedVersions.includes(version)
        ? state.selectedVersions.filter((v) => v !== version)
        : [...state.selectedVersions, version],
    })),
  startScan: async () => {
    set({ scanState: { status: 'scanning', progress: 0, message: 'Starting...' } });
    // IPC call to main process
  },
}));
```

## Styling (Tailwind CSS + shadcn/ui)

### Theme

The app uses a dark navy/teal theme:

```css
:root {
  --background: 210 22% 7%;      /* #0d1117 */
  --foreground: 210 29% 93%;     /* #e6edf3 */
  --accent: 163 100% 42%;        /* #00d4aa */
  --muted: 210 12% 30%;
  --muted-foreground: 210 12% 60%;
  --card: 210 22% 10%;
  --border: 210 15% 18%;
}
```

### Rules

- **Use Tailwind classes** — No inline styles, no CSS modules
- **Use design tokens** — `bg-background`, `text-foreground`, `border-border`
- **No arbitrary values** when a token exists — `text-sm` not `text-[14px]`
- **Responsive with Tailwind** — `md:grid-cols-2 lg:grid-cols-4`
- **Use `cn()` utility** for conditional classes (from shadcn/ui lib/utils)
- **shadcn/ui components** as base — Extend with Tailwind, don't rewrite

### Version Colors (Consistent across app)

```typescript
export const VERSION_COLORS: Record<string, string> = {
  'net3.1': '#f85149',  // Red
  'net5.0': '#f0883e',  // Orange
  'net6.0': '#d29922',  // Yellow
  'net7.0': '#9f7aea',  // Purple
  'net8.0': '#00d4aa',  // Cyan (accent)
  'net9.0': '#58a6ff',  // Blue
  'net10.0': '#3fb950', // Green
};
```

## Testing Practices

### Structure

```
tests/
  unit/
    domain/           → Pure logic tests
    application/      → Use case tests with fakes
    infrastructure/   → Adapter tests
  setup.ts            → Global test config
```

### Rules

- **Test behavior, not implementation** — Assert on outputs, not internal state
- **Use fakes, not mocks** — Create fake implementations of ports
- **Descriptive test names** — `it('should deduplicate hits by repository and branch')`
- **Arrange-Act-Assert** — Clear sections in each test
- **80%+ coverage** — Required for CI pass
- **No testing of React internals** — Test what the user sees

### Example

```typescript
describe('SearchDotNetProjectsUseCase', () => {
  it('should deduplicate hits by repository and branch', async () => {
    // Arrange
    const client = new FakeAzureDevOpsClient();
    client.addSearchResult('net8.0', 'repo-a', 'project-1');
    client.addSearchResult('net8.0', 'repo-a', 'project-1'); // duplicate
    const store = new FakeQueryStore();
    const useCase = new SearchDotNetProjectsUseCase(client, store, 'my-org');

    // Act
    const record = await useCase.execute([DotNetVersion.Net80]);

    // Assert
    expect(record.getAllHits()).toHaveLength(1);
  });
});
```

## Error Handling

- **Domain exceptions** — Typed errors extending `DomainError`
- **IPC errors** — Serialize errors across process boundary with error codes
- **React Error Boundaries** — Catch rendering errors gracefully
- **Toast notifications** — User-facing errors shown via sonner
- **Never swallow errors** — Always log or propagate
- **Retry logic** — Rate limits (429) auto-retry with exponential backoff

## Git Conventions

- **Conventional Commits**: `feat:`, `fix:`, `refactor:`, `test:`, `chore:`, `docs:`
- **Scope**: `feat(scanner): add version filter dropdown`
- **Branch**: `feature/electron-migration`
- **No secrets in commits** — `.env` is gitignored
- **Small, focused commits** — One logical change per commit

## Performance

- **Lazy imports** — Use `React.lazy()` for pages
- **Memoization** — `useMemo` for expensive computations, `useCallback` for stable references
- **Virtual scrolling** — For large result tables (1000+ rows)
- **Debounce** — Filter inputs debounced (300ms)
- **IPC batching** — Minimize IPC round-trips, send bulk data

## Security Checklist

- [ ] PAT stored only in main process memory
- [ ] contextIsolation: true
- [ ] nodeIntegration: false
- [ ] CSP headers configured
- [ ] No eval() or Function() in renderer
- [ ] IPC payloads validated with Zod
- [ ] .env never committed
