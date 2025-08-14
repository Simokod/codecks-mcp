#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import CodecksClient from "./codecks/client.js";
import { CodecksConfig, validateConfig } from "./validations/config.js";
import { AccountTools } from "./tools/AccountTools.js";
import { DeckTools } from "./tools/DeckTools.js";
import { CardTools } from "./tools/CardTools.js";

async function main() {
  const config: CodecksConfig = {
    apiToken: process.env.CODECKS_API_TOKEN || "",
    teamId: process.env.CODECKS_TEAM_ID || "",
    // TODO: Should understand common practices for setting these values - should the user be able to set them?
    apiTimeout: 30000,
    maxRetries: 3,
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

  new AccountTools(server, client).register();
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
