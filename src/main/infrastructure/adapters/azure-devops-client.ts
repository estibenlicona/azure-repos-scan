/** Axios-based implementation of the AzureDevOpsClient port. */

import axios, {
  type AxiosInstance,
  type AxiosResponse,
  isAxiosError,
} from "axios";

import {
  ApiError,
  AuthenticationError,
  OrganizationNotFoundError,
  RateLimitError,
  SearchIndexNotReadyError,
} from "../../domain/exceptions.js";
import type { AzureDevOpsClient } from "../../domain/ports.js";
import {
  ALL_DOTNET_VERSIONS,
  DotNetVersion,
  type CodeSearchFacets,
  type CodeSearchHit,
  type CodeSearchPage,
  type FacetItem,
  type Project,
  ProjectId,
  type Repository,
  RepositoryId,
  getDotNetMoniker,
} from "../../domain/models.js";

const MAX_RETRIES = 3;
const API_BASE = "https://dev.azure.com";
const CODE_SEARCH_BASE = "https://almsearch.dev.azure.com";

/** Promise-based delay for retry back-off. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Extract response body as a string for error messages. */
function responseText(data: unknown): string {
  return typeof data === "string" ? data : JSON.stringify(data);
}

export class AxiosAzureDevOpsClient implements AzureDevOpsClient {
  private readonly organization: string;
  private readonly restClient: AxiosInstance;
  private readonly searchClient: AxiosInstance;

  constructor(organization: string, pat: string) {
    this.organization = organization;

    const encoded = btoa(`:${pat}`);
    const headers = {
      Authorization: `Basic ${encoded}`,
      "Content-Type": "application/json",
    };

    this.restClient = axios.create({
      baseURL: `${API_BASE}/${organization}`,
      headers,
      timeout: 30_000,
      validateStatus: () => true, // handle status codes manually
    });

    this.searchClient = axios.create({
      baseURL: `${CODE_SEARCH_BASE}/${organization}`,
      headers,
      timeout: 60_000,
      validateStatus: () => true,
    });
  }

  // ------------------------------------------------------------------
  // Projects & Repositories
  // ------------------------------------------------------------------

  async listProjects(): Promise<readonly Project[]> {
    const data = await this.request("GET", "/_apis/projects", {
      "api-version": "7.1",
      $top: "500",
    });

    const rawProjects = (data.value ?? []) as Array<Record<string, unknown>>;
    return rawProjects.map(
      (p): Project => ({
        id: new ProjectId(p.id as string),
        name: p.name as string,
        description: (p.description as string) ?? "",
        url: (p.url as string) ?? "",
      }),
    );
  }

  async listRepositories(
    projectName: string,
  ): Promise<readonly Repository[]> {
    const projects = await this.listProjects();
    const project = projects.find((p) => p.name === projectName);
    if (!project) return [];

    const data = await this.request(
      "GET",
      `/${projectName}/_apis/git/repositories`,
      { "api-version": "7.1" },
    );

    const rawRepos = (data.value ?? []) as Array<Record<string, unknown>>;
    return rawRepos.map(
      (r): Repository => ({
        id: new RepositoryId(r.id as string),
        name: r.name as string,
        project,
        defaultBranch: (r.defaultBranch as string) ?? "",
        url: (r.webUrl as string) ?? "",
        sizeBytes: (r.size as number) ?? 0,
      }),
    );
  }

  // ------------------------------------------------------------------
  // Code Search
  // ------------------------------------------------------------------

  async searchCode(
    searchText: string,
    project: string | null,
    skip: number,
    top: number,
    options?: {
      filters?: Record<string, string[]>;
      includeFacets?: boolean;
    },
  ): Promise<CodeSearchPage> {
    const path = project
      ? `/${project}/_apis/search/codesearchresults`
      : "/_apis/search/codesearchresults";

    const body: Record<string, unknown> = {
      searchText,
      $skip: skip,
      $top: top,
    };
    if (options?.filters) body.filters = options.filters;
    if (options?.includeFacets) body.includeFacets = true;

    const data = await this.searchRequest(path, body);

    const infoCode = (data.infoCode as number) ?? 0;
    if (infoCode === 1 || infoCode === 2) {
      throw new SearchIndexNotReadyError();
    }

    const version = AxiosAzureDevOpsClient.detectVersionFromQuery(searchText);
    const rawResults = (data.results ?? []) as Array<
      Record<string, unknown>
    >;

    const hits: CodeSearchHit[] = rawResults.map((r) => {
      const repoInfo = (r.repository as Record<string, unknown>) ?? {};
      const projInfo = (r.project as Record<string, unknown>) ?? {};
      const versionsList = (r.versions as Array<Record<string, unknown>>) ?? [];
      const branch =
        versionsList.length > 0
          ? ((versionsList[0].branchName as string) ?? "")
          : "";
      return {
        repositoryName: (repoInfo.name as string) ?? "",
        projectName: (projInfo.name as string) ?? "",
        dotnetVersion: version,
        branch,
      };
    });

    const totalCount = (data.count as number) ?? 0;

    let facets: CodeSearchFacets | undefined;
    if (options?.includeFacets) {
      const rawFacets =
        (data.facets as Record<string, Array<Record<string, unknown>>>) ?? {};
      facets = {
        projects: (rawFacets.Project ?? []).map(
          (f): FacetItem => ({
            name: f.name as string,
            resultCount: f.resultCount as number,
          }),
        ),
        repositories: (rawFacets.Repository ?? []).map(
          (f): FacetItem => ({
            name: f.name as string,
            resultCount: f.resultCount as number,
          }),
        ),
      };
    }

    return { hits, totalCount, skip, top, facets };
  }

  // ------------------------------------------------------------------
  // Internal helpers
  // ------------------------------------------------------------------

  /** Detect the .NET version from a Code Search query text. */
  static detectVersionFromQuery(
    searchText: string,
  ): DotNetVersion {
    for (const version of ALL_DOTNET_VERSIONS) {
      if (searchText.includes(getDotNetMoniker(version))) {
        return version;
      }
    }
    return DotNetVersion.Net80; // fallback
  }

  /** POST to Code Search endpoint with retry on rate-limit. */
  private async searchRequest(
    path: string,
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      let response: AxiosResponse;
      try {
        response = await this.searchClient.post(path, body, {
          params: { "api-version": "7.1" },
        });
      } catch (error: unknown) {
        if (isAxiosError(error) && !error.response) {
          throw new ApiError(0, error.message);
        }
        throw new ApiError(0, String(error));
      }

      if (response.status === 401) {
        throw new AuthenticationError();
      }
      if (response.status === 404) {
        const text = responseText(response.data);
        if (text.includes(this.organization)) {
          throw new OrganizationNotFoundError(this.organization);
        }
        throw new ApiError(response.status, text);
      }
      if (response.status === 429) {
        const retryAfter = parseInt(
          String(response.headers["retry-after"] ?? "30"),
          10,
        );
        if (attempt < MAX_RETRIES - 1) {
          await delay(retryAfter * 1_000);
          continue;
        }
        throw new RateLimitError(retryAfter);
      }
      if (response.status >= 400) {
        throw new ApiError(response.status, responseText(response.data));
      }

      return response.data as Record<string, unknown>;
    }

    throw new ApiError(0, "Máximo de reintentos alcanzado");
  }

  /** Execute an HTTP request and handle errors. */
  private async request(
    method: string,
    path: string,
    params?: Record<string, string>,
  ): Promise<Record<string, unknown>> {
    let response: AxiosResponse;
    try {
      response = await this.restClient.request({ method, url: path, params });
    } catch (error: unknown) {
      if (isAxiosError(error) && !error.response) {
        throw new ApiError(0, error.message);
      }
      throw new ApiError(0, String(error));
    }

    if (response.status === 401) {
      throw new AuthenticationError();
    }
    if (response.status === 404) {
      const text = responseText(response.data);
      if (text.includes(this.organization)) {
        throw new OrganizationNotFoundError(this.organization);
      }
      throw new ApiError(response.status, text);
    }
    if (response.status >= 400) {
      throw new ApiError(response.status, responseText(response.data));
    }

    return response.data as Record<string, unknown>;
  }
}
