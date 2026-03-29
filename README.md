# Azure Repos Scan

Escáner de repositorios de Azure DevOps con interfaz gráfica (PySide6).

## Requisitos

- Python >= 3.13
- Personal Access Token (PAT) de Azure DevOps

## Instalación

```bash
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
```

## Configuración

Copiar `.env.example` a `.env` y completar con tus credenciales:

```bash
cp .env.example .env
```

## Ejecución

```bash
azure-repos-scan
# o
python -m azure_repos_scan
```

## Tests

```bash
pytest
```
