/** Use case: list repositories for a given project. */

import type { Repository } from "../../domain/models";
import type { AzureDevOpsClient } from "../../domain/ports";

export class ListRepositoriesUseCase {
  constructor(private readonly client: AzureDevOpsClient) {}

  async execute(projectName: string): Promise<readonly Repository[]> {
    return this.client.listRepositories(projectName);
  }
}
