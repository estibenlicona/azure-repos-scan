import { describe, it, expect } from "vitest";

import {
  DomainError,
  AuthenticationError,
  OrganizationNotFoundError,
  ApiError,
  RateLimitError,
  SearchIndexNotReadyError,
} from "../../../src/main/domain/exceptions";

describe("DomainError", () => {
  it("is an instance of Error", () => {
    const err = new DomainError("something went wrong");
    expect(err).toBeInstanceOf(Error);
  });

  it("stores the correct message", () => {
    const err = new DomainError("boom");
    expect(err.message).toBe("boom");
  });

  it("has name DomainError", () => {
    const err = new DomainError("x");
    expect(err.name).toBe("DomainError");
  });
});

describe("AuthenticationError", () => {
  it("is an instance of DomainError", () => {
    const err = new AuthenticationError();
    expect(err).toBeInstanceOf(DomainError);
  });

  it("uses default message when none provided", () => {
    const err = new AuthenticationError();
    expect(err.message).toBe("Autenticación fallida con Azure DevOps");
  });

  it("uses custom message when provided", () => {
    const err = new AuthenticationError("custom msg");
    expect(err.message).toBe("custom msg");
  });

  it("has name AuthenticationError", () => {
    const err = new AuthenticationError();
    expect(err.name).toBe("AuthenticationError");
  });
});

describe("OrganizationNotFoundError", () => {
  it("is an instance of DomainError", () => {
    const err = new OrganizationNotFoundError("contoso");
    expect(err).toBeInstanceOf(DomainError);
  });

  it("includes org name in message", () => {
    const err = new OrganizationNotFoundError("contoso");
    expect(err.message).toBe("Organización no encontrada: contoso");
  });

  it("has name OrganizationNotFoundError", () => {
    const err = new OrganizationNotFoundError("x");
    expect(err.name).toBe("OrganizationNotFoundError");
  });
});

describe("ApiError", () => {
  it("is an instance of DomainError", () => {
    const err = new ApiError(500, "Internal Server Error");
    expect(err).toBeInstanceOf(DomainError);
  });

  it("exposes statusCode", () => {
    const err = new ApiError(404, "Not Found");
    expect(err.statusCode).toBe(404);
  });

  it("exposes detail", () => {
    const err = new ApiError(422, "Validation failed");
    expect(err.detail).toBe("Validation failed");
  });

  it("formats message with status code and detail", () => {
    const err = new ApiError(403, "Forbidden");
    expect(err.message).toBe("Error API (403): Forbidden");
  });

  it("has name ApiError", () => {
    const err = new ApiError(500, "oops");
    expect(err.name).toBe("ApiError");
  });
});

describe("RateLimitError", () => {
  it("is an instance of DomainError", () => {
    const err = new RateLimitError(30);
    expect(err).toBeInstanceOf(DomainError);
  });

  it("exposes retryAfter", () => {
    const err = new RateLimitError(60);
    expect(err.retryAfter).toBe(60);
  });

  it("includes retryAfter in message", () => {
    const err = new RateLimitError(45);
    expect(err.message).toBe("Rate limit alcanzado. Reintentar en 45s");
  });

  it("has name RateLimitError", () => {
    const err = new RateLimitError(10);
    expect(err.name).toBe("RateLimitError");
  });
});

describe("SearchIndexNotReadyError", () => {
  it("is an instance of DomainError", () => {
    const err = new SearchIndexNotReadyError();
    expect(err).toBeInstanceOf(DomainError);
  });

  it("has the expected message", () => {
    const err = new SearchIndexNotReadyError();
    expect(err.message).toBe(
      "El índice de Code Search no está listo o no está habilitado",
    );
  });

  it("has name SearchIndexNotReadyError", () => {
    const err = new SearchIndexNotReadyError();
    expect(err.name).toBe("SearchIndexNotReadyError");
  });
});
