"""Configuración centralizada cargada desde variables de entorno."""

from __future__ import annotations

from functools import lru_cache

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class AppSettings(BaseSettings):
    """Configuración de la aplicación cargada desde .env o variables de entorno."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    azure_devops_pat: SecretStr


@lru_cache(maxsize=1)
def get_settings() -> AppSettings:
    """Singleton de configuración. Falla al inicio si faltan variables requeridas."""
    return AppSettings()  # type: ignore[call-arg]
