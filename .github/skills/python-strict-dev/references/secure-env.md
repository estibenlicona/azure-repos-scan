# Manejo Seguro de Variables de Entorno

## Principios

1. Los secretos (tokens, PATs, contraseñas, API keys) NUNCA van en el código fuente
2. Los archivos `.env` NUNCA se commitean — solo `.env.example` con placeholders
3. Toda configuración se valida al iniciar la aplicación, no en tiempo de ejecución disperso
4. Los secretos se leen como `SecretStr` y nunca se imprimen en logs

## Implementación con pydantic-settings

```python
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class AppSettings(BaseSettings):
    """Configuración centralizada de la aplicación."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="APP_",           # Todas las vars empiezan con APP_
        case_sensitive=False,
        extra="ignore",               # Ignorar vars no declaradas
    )

    # --- Configuración general ---
    app_name: str = "MiApp"
    debug: bool = False
    log_level: str = "INFO"

    # --- Secretos (nunca se imprimen en repr/logs) ---
    database_url: SecretStr
    api_token: SecretStr
    pat_token: SecretStr | None = None  # Opcional

    @field_validator("log_level")
    @classmethod
    def validate_log_level(cls, v: str) -> str:
        allowed = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
        upper = v.upper()
        if upper not in allowed:
            msg = f"log_level debe ser uno de {allowed}"
            raise ValueError(msg)
        return upper


@lru_cache(maxsize=1)
def get_settings() -> AppSettings:
    """Singleton de configuración. Falla al inicio si faltan variables."""
    return AppSettings()  # type: ignore[call-arg]
```

## Archivo .env.example

```env
# Copiar a .env y completar con valores reales
# NUNCA commitear .env

APP_APP_NAME=MiApp
APP_DEBUG=false
APP_LOG_LEVEL=INFO

# Secretos — obtener del gestor de secretos o vault
APP_DATABASE_URL=postgresql://user:password@localhost:5432/db
APP_API_TOKEN=tu-api-token-aqui
APP_PAT_TOKEN=tu-pat-aqui
```

## .gitignore — Líneas obligatorias

```gitignore
# Variables de entorno con secretos
.env
.env.local
.env.*.local
!.env.example
```

## Acceso a Secretos en Código

```python
# ✅ CORRECTO — Obtener valor cuando se necesita
settings = get_settings()
headers = {"Authorization": f"Bearer {settings.api_token.get_secret_value()}"}

# ✅ CORRECTO — Log seguro
logger.info("Configuración cargada: %s", settings.app_name)
# SecretStr muestra '**********' automáticamente si se imprime

# ❌ INCORRECTO — Nunca esto
logger.info("Token: %s", settings.api_token.get_secret_value())
print(f"PAT: {settings.pat_token}")  # Expone el valor
```

## Secretos en PyInstaller

Los ejecutables generados con PyInstaller NO deben incluir archivos `.env`. Las opciones son:

1. **Variables de entorno del sistema** — El usuario las configura en su sistema
2. **Archivo .env externo** — El usuario coloca `.env` junto al ejecutable
3. **Prompt al usuario** — La app pide los valores sensibles al iniciar (para UIs)

En la configuración de PyInstaller, NUNCA agregar `.env` en `datas`.
