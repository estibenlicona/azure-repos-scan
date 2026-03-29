# Azure Repos Scan

Escáner de repositorios de Azure DevOps con interfaz de escritorio moderna. Busca versiones .NET en repositorios y genera dashboards interactivos con reportes.

![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)

## Características

- 🔍 **Escáner**: Busca versiones .NET (3.1 a 10.0) en repositorios de Azure DevOps usando la API de Code Search
- 📊 **Dashboard**: KPIs, gráficos de donut por versión y branch, evolución mensual, tabla drill-down
- 📁 **Exportar**: Resultados a Excel (.xlsx), dashboard a imagen (PNG) y PDF
- 🕐 **Historial**: Guarda consultas anteriores para consultar y comparar
- 🎨 **UI moderna**: Tema dark navy/teal, diseño minimalista y fluido

## Stack Tecnológico

| Componente | Tecnología |
|---|---|
| Runtime | Electron 33 + Vite |
| Frontend | React 19 + TypeScript 5.7 (strict) |
| Estilos | Tailwind CSS 4 + shadcn/ui |
| Gráficos | Chart.js + react-chartjs-2 |
| Estado | Zustand |
| HTTP | Axios (main process) |
| Excel | exceljs |
| Testing | Vitest + React Testing Library |
| Empaquetado | Electron Forge |

## Requisitos

- [Node.js](https://nodejs.org/) >= 18 (recomendado: 22 LTS)
- Personal Access Token (PAT) de Azure DevOps con scope **Code (Read)**

## Instalación

```bash
git clone <repo-url>
cd azure-repos-scan
npm install
```

## Configuración

Copiar `.env.example` a `.env` y completar con tu PAT:

```bash
cp .env.example .env
```

Editar `.env`:

```env
AZURE_DEVOPS_PAT=tu-pat-aqui
```

## Ejecución

### Modo desarrollo

```bash
npm start
```

Abre la aplicación Electron con hot-reload para el renderer.

### Modo producción

```bash
npm run package
```

Genera el ejecutable en la carpeta `out/`.

### Crear instalador

```bash
npm run make
```

Genera el instalador de Windows (Squirrel) en `out/make/`.

## Tests

```bash
# Ejecutar tests una vez
npm test

# Ejecutar tests en modo watch
npm run test:watch
```

## Linting

```bash
# ESLint
npm run lint

# Prettier
npm run format
```

## Estructura del Proyecto

```
src/
├── main/                          # Electron Main Process (Node.js)
│   ├── index.ts                   # Ventana principal y app lifecycle
│   ├── preload.ts                 # Context bridge (IPC seguro)
│   ├── ipc-handlers.ts            # Handlers de IPC para use cases
│   ├── domain/                    # Capa de dominio (modelos, ports, excepciones)
│   ├── application/               # Capa de aplicación (use cases)
│   └── infrastructure/            # Capa de infraestructura (API client, stores)
│
└── renderer/                      # Electron Renderer (React)
    ├── App.tsx                    # Componente raíz
    ├── globals.css                # Tema y estilos globales
    ├── components/                # Componentes compartidos (sidebar, KPI, etc.)
    ├── pages/                     # Páginas (Dashboard, Scanner)
    ├── stores/                    # Zustand stores
    ├── hooks/                     # Custom hooks
    └── lib/                       # Utilidades
```

## Arquitectura

La aplicación sigue **arquitectura hexagonal** (Ports & Adapters):

- **Domain**: Modelos de negocio, interfaces (ports), excepciones. Sin dependencias externas.
- **Application**: Casos de uso que orquestan dominio + infraestructura.
- **Infrastructure**: Adaptadores reales (Azure DevOps API via Axios, persistencia JSON).
- **UI (Renderer)**: React components que se comunican con el main process via IPC.

### Seguridad

- `contextIsolation: true` — El renderer no tiene acceso a Node.js
- `nodeIntegration: false` — Sin `require()` en el renderer
- El PAT nunca se expone al renderer; toda comunicación API va por el main process

## Licencia

MIT
