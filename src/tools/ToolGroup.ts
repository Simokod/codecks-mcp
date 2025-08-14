import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import CodecksClient from "../codecks/client.js";

export abstract class ToolGroup {
  constructor(protected server: McpServer, protected client: CodecksClient) {}

  abstract register(): void;

  protected registerTool<T>(
    name: string,
    description: string,
    operation: (args: any) => Promise<T>,
    params: any = {},
    formatter?: (result: T) => string
  ): void {
    this.server.tool(name, description, params, async (args: any) => {
      try {
        console.error(`[${name}] Starting operation`);
        const result = await operation(args);
        console.error(`[${name}] Operation completed successfully`);
        const text = formatter
          ? formatter(result)
          : JSON.stringify(result, null, 2);
        return this.createTextResponse(text);
      } catch (error) {
        console.error(`[${name}] Operation failed:`, error);
        return this.createTextResponse(this.handleError(error));
      }
    });
  }

  protected createTextResponse(text: string): {
    content: { type: "text"; text: string }[];
  } {
    return { content: [{ type: "text", text }] };
  }

  protected handleError(error: unknown): string {
    return `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
}
