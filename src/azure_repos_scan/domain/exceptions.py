"""Excepciones del dominio."""

from __future__ import annotations

from typing import final


class DomainError(Exception):
    """Excepción base del dominio."""


@final
class AuthenticationError(DomainError):
    """Error de autenticación con Azure DevOps."""

    def __init__(self, message: str = "Autenticación fallida con Azure DevOps") -> None:
        super().__init__(message)


@final
class OrganizationNotFoundError(DomainError):
    """Organización no encontrada."""

    def __init__(self, org: str) -> None:
        super().__init__(f"Organización no encontrada: {org}")


@final
class ApiError(DomainError):
    """Error genérico de la API de Azure DevOps."""

    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"Error API ({status_code}): {detail}")


@final
class RateLimitError(DomainError):
    """Límite de tasa alcanzado en la API."""

    def __init__(self, retry_after: int) -> None:
        self.retry_after = retry_after
        super().__init__(f"Rate limit alcanzado. Reintentar en {retry_after}s")


@final
class SearchIndexNotReadyError(DomainError):
    """El índice de búsqueda no está listo."""

    def __init__(self) -> None:
        super().__init__("El índice de Code Search no está listo o no está habilitado")
