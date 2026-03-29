---
name: python-strict-dev
description: "**WORKFLOW SKILL** — Desarrollar aplicaciones Python con máxima rigurosidad. USE FOR: crear proyectos Python nuevos; agregar módulos con arquitectura hexagonal; escribir código con tipado estricto validado por Pylance; generar pruebas unitarias; configurar pyproject.toml; empaquetar con PyInstaller; manejar secretos y variables de entorno de forma segura; crear interfaces de usuario minimalistas con PySide6. DO NOT USE FOR: scripts simples sin arquitectura; prototipos rápidos sin tipos; proyectos sin empaquetado."
argument-hint: "Describe el módulo, feature o proyecto Python a desarrollar"
---

# Desarrollo Python Estricto

Skill para desarrollar aplicaciones Python de calidad producción con arquitectura hexagonal, tipado estricto, pruebas unitarias, UI moderna y empaquetado seguro.

## Cuándo Usar

- Crear un nuevo proyecto Python desde cero
- Agregar un módulo o feature a un proyecto existente
- Refactorizar código existente hacia arquitectura hexagonal
- Configurar el entorno de desarrollo con tipado estricto
- Empaquetar la aplicación como ejecutable (.exe)
- Integrar manejo seguro de secretos y tokens

## Procedimiento

### Fase 1 — Estructura del Proyecto

Crear o validar la estructura de carpetas siguiendo arquitectura hexagonal:

```
proyecto/
├── pyproject.toml                    # Configuración central (ver template)
├── .env.example                      # Variables de entorno de ejemplo (SIN valores reales)
├── .gitignore                        # Incluir .env, dist/, build/, *.spec
├── src/
│   └── <app_name>/
│       ├── __init__.py
│       ├── __main__.py               # Punto de entrada: from app.main import main; main()
│       ├── main.py                   # Bootstrap: inyección de dependencias y arranque
│       ├── domain/                   # CAPA DOMINIO — sin dependencias externas
│       │   ├── __init__.py
│       │   ├── models.py             # Entidades y value objects (dataclasses/Pydantic)
│       │   ├── ports.py              # Interfaces ABC (repositorios, servicios externos)
│       │   └── exceptions.py         # Excepciones de dominio
│       ├── application/              # CAPA APLICACIÓN — casos de uso
│       │   ├── __init__.py
│       │   └── use_cases.py          # Orquestadores que usan ports, no implementaciones
│       ├── infrastructure/           # CAPA INFRAESTRUCTURA — implementaciones concretas
│       │   ├── __init__.py
│       │   ├── adapters/             # Implementaciones de ports (repos, APIs, etc.)
│       │   │   └── __init__.py
│       │   ├── config.py             # Carga segura de .env y configuración
│       │   └── persistence/          # Base de datos, archivos, etc.
│       │       └── __init__.py
│       └── ui/                       # CAPA UI — presentación
│           ├── __init__.py
│           ├── app.py                # QApplication y ventana principal
│           ├── styles.py             # QSS/estilos centralizados
│           └── widgets/              # Componentes reutilizables
│               └── __init__.py
├── tests/
│   ├── __init__.py
│   ├── conftest.py                   # Fixtures compartidas
│   ├── unit/
│   │   ├── __init__.py
│   │   ├── test_models.py
│   │   └── test_use_cases.py
│   └── integration/
│       └── __init__.py
├── scripts/
│   └── build.py                      # Script de empaquetado PyInstaller
└── dist/                             # Ejecutable generado (gitignored)
```

**Regla fundamental**: La capa `domain/` NUNCA importa de `infrastructure/` ni `ui/`. Los casos de uso en `application/` dependen solo de `domain.ports` (interfaces), nunca de implementaciones concretas.

### Fase 2 — Configuración del Proyecto (pyproject.toml)

Usar el template en [./assets/pyproject.toml.template](./assets/pyproject.toml.template) como base. Ajustar nombre, descripción y dependencias.

Puntos críticos del TOML:
- Configurar `[tool.pyright]` con `typeCheckingMode = "strict"` 
- Incluir `reportMissingTypeStubs = "warning"` para detectar stubs faltantes
- Configurar `[tool.pytest.ini_options]` con cobertura mínima del 80%
- Definir `[project.scripts]` para entry points

### Fase 3 — Tipado Estricto y Validación con Pylance

**Todo el código DEBE cumplir con Pylance en modo strict.** Seguir las reglas en [./references/type-checking.md](./references/type-checking.md).

Después de escribir o modificar cualquier archivo `.py`:

1. Usar la herramienta de diagnóstico de errores para verificar el archivo editado
2. Si hay herramientas MCP de Pylance disponibles, usarlas para obtener diagnósticos detallados
3. Corregir TODOS los errores de tipo antes de continuar
4. No usar `# type: ignore` salvo casos documentados y justificados

### Fase 4 — Implementación de Código

Al escribir cualquier módulo, seguir estas reglas:

```python
# ✅ CORRECTO — Tipado explícito en todo
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, final


@final
@dataclass(frozen=True, slots=True)
class UserId:
    """Value object para ID de usuario."""
    value: str

    def __post_init__(self) -> None:
        if not self.value.strip():
            raise ValueError("UserId no puede estar vacío")


class UserRepository(Protocol):
    """Port para persistencia de usuarios."""
    def find_by_id(self, user_id: UserId) -> User | None: ...
    def save(self, user: User) -> None: ...
```

```python
# ❌ INCORRECTO — Sin tipos, sin Protocol, imports concretos en dominio
class UserRepository:
    def find_by_id(self, user_id):
        return db.query(...)  # Dependencia directa a infraestructura
```

**Reglas de implementación:**
- `from __future__ import annotations` en TODOS los archivos
- `@dataclass(frozen=True, slots=True)` para entidades y value objects
- `Protocol` (no ABC) para ports cuando no se necesita implementación base
- `ABC` para ports que comparten lógica base
- `@final` en clases que no deben heredarse
- `Literal`, `TypeAlias`, `TypeVar`, `TypeGuard` cuando aplique
- Nunca `Any` salvo en fronteras de integración documentadas
- `Sequence` en vez de `list` para parámetros de solo lectura
- `Mapping` en vez de `dict` para parámetros de solo lectura

### Fase 5 — Manejo Seguro de Variables de Entorno

Consultar [./references/secure-env.md](./references/secure-env.md) para el procedimiento completo.

Reglas fundamentales:
1. **NUNCA** hardcodear secretos, tokens, PATs o contraseñas en el código
2. **NUNCA** commitear archivos `.env` — solo `.env.example` con placeholders
3. Usar `pydantic-settings` para cargar y validar variables de entorno con tipos
4. Marcar campos sensibles con `SecretStr` de Pydantic
5. En logs, NUNCA imprimir el valor de secretos — usar `repr()` de `SecretStr`

### Fase 6 — Pruebas Unitarias

Consultar [./references/testing.md](./references/testing.md) para el procedimiento completo.

Para cada módulo implementado:
1. Crear tests en `tests/unit/` con nomenclatura `test_<modulo>.py`
2. Usar `pytest` con fixtures tipadas
3. Mockear ports con implementaciones fake (no `MagicMock` para tipos estrictos)
4. Cubrir: caminos exitosos, errores esperados, edge cases
5. Ejecutar tests y verificar que pasen

```python
# Ejemplo: Test con fake adapter (sin MagicMock para compatibilidad de tipos)
@final
class FakeUserRepository:
    """Implementación fake del port para tests."""
    def __init__(self) -> None:
        self._users: dict[UserId, User] = {}

    def find_by_id(self, user_id: UserId) -> User | None:
        return self._users.get(user_id)

    def save(self, user: User) -> None:
        self._users[UserId(user.id)] = user
```

### Fase 7 — Interfaz de Usuario (PySide6)

Consultar [./references/ui-pyside6.md](./references/ui-pyside6.md) para el procedimiento completo.

Principios de UI:
- Minimalista: solo lo necesario, sin decoración excesiva
- Moderna: bordes redondeados, sombras sutiles, paleta contenida
- Responsiva: layouts adaptables con `QVBoxLayout`/`QHBoxLayout`
- Tema oscuro por defecto con colores de acento configurables
- Separación total: la UI no conoce la infraestructura, usa casos de uso

### Fase 8 — Empaquetado con PyInstaller

Consultar [./references/packaging.md](./references/packaging.md) para el procedimiento completo.

Puntos clave:
- Generar `.spec` personalizado, no usar `--onefile` directamente
- Incluir assets y archivos de datos con `datas=[...]`
- Configurar `hiddenimports` para PySide6 y dependencias dinámicas
- El ejecutable debe abrir la interfaz gráfica al iniciar
- NO incluir archivos `.env` en el build — los secretos se leen del entorno del sistema

### Fase 9 — Validación Final

Antes de considerar completo el trabajo:

1. [ ] Todo el código tiene tipos explícitos y pasa Pylance strict sin errores
2. [ ] La arquitectura respeta las capas hexagonales (dominio → aplicación → infra/ui)
3. [ ] Los tests unitarios pasan y cubren los caminos principales
4. [ ] No hay secretos hardcodeados ni archivos `.env` trackeados
5. [ ] El `pyproject.toml` está completo y es funcional  
6. [ ] Si aplica, el build con PyInstaller genera un ejecutable funcional
