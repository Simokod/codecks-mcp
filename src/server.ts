#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import CodecksClient from "./codecks/client.js";
import { CodecksConfig, validateConfig } from "./validations/config.js";
import { ProjectTools } from "./tools/ProjectTools.js";
import { DeckTools } from "./tools/DeckTools.js";
import { CardTools } from "./tools/CardTools.js";

async function main() {
  const config: CodecksConfig = {
    authToken: process.env.CODECKS_AUTH_TOKEN || "",
    subdomain: process.env.CODECKS_SUBDOMAIN || "",
  };

  try {
    validateConfig(config);
  } catch (error) {
    console.error("Configuration error:", error);
    process.exit(1);
  }

  const client = new CodecksClient(config);

  try {
    console.error("Initializing Codecks context...");
    await client.initializeContext();
    console.error("Codecks context initialized successfully");
  } catch (error) {
    console.error("Failed to initialize context:", error);
    process.exit(1);
  }

  const server = new McpServer({
    name: "codecks-mcp",
    version: "1.0.0",
  });

  new ProjectTools(server, client).register();
  new DeckTools(server, client).register();
  new CardTools(server, client).register();

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("Codecks MCP server started");
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
