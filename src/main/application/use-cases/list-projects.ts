/** Use case: list all projects in the organization. */

import type { Project } from "../../domain/models";
import type { AzureDevOpsClient } from "../../domain/ports";

export class ListProjectsUseCase {
  constructor(private readonly client: AzureDevOpsClient) {}

  async execute(): Promise<readonly Project[]> {
    return this.client.listProjects();
  }
}
