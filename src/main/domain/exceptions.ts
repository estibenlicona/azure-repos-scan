/** Domain exceptions for Azure Repos Scan. */

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AuthenticationError extends DomainError {
  constructor(
    message: string = "Autenticación fallida con Azure DevOps",
  ) {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class OrganizationNotFoundError extends DomainError {
  constructor(org: string) {
    super(`Organización no encontrada: ${org}`);
    this.name = "OrganizationNotFoundError";
  }
}

export class ApiError extends DomainError {
  readonly statusCode: number;
  readonly detail: string;

  constructor(statusCode: number, detail: string) {
    super(`Error API (${statusCode}): ${detail}`);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.detail = detail;
  }
}

export class RateLimitError extends DomainError {
  readonly retryAfter: number;

  constructor(retryAfter: number) {
    super(`Rate limit alcanzado. Reintentar en ${retryAfter}s`);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

export class SearchIndexNotReadyError extends DomainError {
  constructor() {
    super(
      "El índice de Code Search no está listo o no está habilitado",
    );
    this.name = "SearchIndexNotReadyError";
  }
}
