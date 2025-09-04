import { ToolGroup } from "./ToolGroup.js";
import { CodecksSpace } from "../codecks/entities.js";
import { getSpacesResponse } from "../codecks/APItypes.js";

export class ProjectTools extends ToolGroup {
  register(): void {
    this.registerTool(
      "list-spaces",
      "List all available spaces in the project",
      async () => this.listSpaces()
    );
  }

  private async listSpaces(): Promise<CodecksSpace[]> {
    if (!this.client.context.projectId) {
      throw new Error("Context not initialized - project ID not available");
    }

    const query = {
      [`project(${this.client.context.projectId})`]: ["spaces"],
    };

    const response = await this.client.request<getSpacesResponse>(query);

    const projectData = response.project[this.client.context.projectId];
    if (!projectData || !projectData.spaces) {
      throw new Error("No spaces found for project");
    }

    return projectData.spaces;
  }
}
