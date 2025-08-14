import { ToolGroup } from "./ToolGroup.js";

export class AccountTools extends ToolGroup {
  register(): void {
    this.registerTool(
      "get-account-name",
      "Get the name of the Codecks account",
      async () => this.getAccountName()
    );
  }

  private async getAccountName(): Promise<string> {
    return this.client.context.account!.name;
  }
}
