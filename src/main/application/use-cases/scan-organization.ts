/** Use case: scan all projects and repositories in an organization. */

import type { Repository, ScanResult } from "../../domain/models";
import { OrganizationName } from "../../domain/models";
import type { AzureDevOpsClient } from "../../domain/ports";

export class ScanOrganizationUseCase {
  constructor(private readonly client: AzureDevOpsClient) {}

  async execute(organization: string): Promise<ScanResult> {
    const projects = await this.client.listProjects();
    const allRepos: Repository[] = [];

    for (const project of projects) {
      const repos = await this.client.listRepositories(project.name);
      allRepos.push(...repos);
    }

    return {
      organization: new OrganizationName(organization),
      projects,
      repositories: allRepos,
      scannedAt: new Date(),
      totalRepos: allRepos.length,
      totalProjects: projects.length,
    };
  }
}
