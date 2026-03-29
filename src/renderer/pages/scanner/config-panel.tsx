import { Settings2 } from 'lucide-react';
import { cn } from '@renderer/lib/utils';

interface ConfigPanelProps {
  organization: string;
  project: string;
  pat: string;
  onOrganizationChange: (value: string) => void;
  onProjectChange: (value: string) => void;
  onPatChange: (value: string) => void;
  disabled?: boolean;
}

const inputClass =
  'h-9 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

export function ConfigPanel({
  organization,
  project,
  pat,
  onOrganizationChange,
  onProjectChange,
  onPatChange,
  disabled,
}: ConfigPanelProps): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-4 flex items-center gap-2">
        <Settings2 className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">Configuración</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1.5">
          <label htmlFor="cfg-org" className="text-sm font-medium text-foreground">
            Organización <span className="text-destructive">*</span>
          </label>
          <input
            id="cfg-org"
            type="text"
            value={organization}
            onChange={(e) => onOrganizationChange(e.target.value)}
            placeholder="mi-organizacion"
            disabled={disabled}
            className={cn(inputClass)}
          />
          <p className="text-xs text-muted-foreground">
            Nombre de la organización en Azure DevOps
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="cfg-pat" className="text-sm font-medium text-foreground">
            PAT <span className="text-destructive">*</span>
          </label>
          <input
            id="cfg-pat"
            type="password"
            value={pat}
            onChange={(e) => onPatChange(e.target.value)}
            placeholder="••••••••••••"
            disabled={disabled}
            className={cn(inputClass)}
          />
          <p className="text-xs text-muted-foreground">Personal Access Token con permisos de lectura</p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="cfg-project" className="text-sm font-medium text-foreground">
            Proyecto
          </label>
          <input
            id="cfg-project"
            type="text"
            value={project}
            onChange={(e) => onProjectChange(e.target.value)}
            placeholder="(todos los proyectos)"
            disabled={disabled}
            className={cn(inputClass)}
          />
          <p className="text-xs text-muted-foreground">Dejar vacío para escanear todos</p>
        </div>
      </div>
    </div>
  );
}
