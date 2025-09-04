[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/simokod-codecks-mcp-badge.png)](https://mseep.ai/app/simokod-codecks-mcp)

# Codecks MCP

A simple Model Context Protocol (MCP) server for Codecks task management. This MCP provides essential card and deck manipulation capabilities for AI assistants like Cursor, Claude, and other MCP-compatible tools.

## Features

- **Manage Cards**: Create, view, update, and organize your task cards
- **Organize Decks**: Create new decks and browse existing ones
- **Smart Filtering**: Find cards by status and archive state

## Configuration

The Codecks MCP server is configured through the MCP client configuration file (typically `~/.cursor/mcp.json` or similar). You need to set the following environment variables:

### Required Configuration

- `CODECKS_AUTH_TOKEN` - Your Codecks authentication token
- `CODECKS_SUBDOMAIN` - Your Codecks subdomain

### Example MCP Configuration

```json
{
  "mcpServers": {
    "codecks": {
      "command": "node",
      "args": ["/path/to/codecks-mcp/dist/server.js"],
      "env": {
        "CODECKS_AUTH_TOKEN": "your_actual_auth_token",
        "CODECKS_SUBDOMAIN": "your_actual_subdomain"
      }
    }
  }
}
```

### Getting Your Codecks API Token

1. Log in to your Codecks account
2. Open your browser's Developer Tools (F12)
3. Go to the Network tab
4. Make any request to Codecks (refresh the page)
5. Look for requests to `https://api.codecks.io`
6. Find the `at` cookie in the request headers - this is your API token
7. Copy the token and add it to your MCP configuration

> **Important**: This token allows full access to your account. Keep it secure and don't share it with others.

### Getting Your Subdomain

1. Look at your Codecks URL: `https://[SUBDOMAIN].codecks.io`
2. The subdomain part is what you need
3. For example, if your URL is `https://myteam.codecks.io`, your subdomain is `myteam`
4. Copy the subdomain and add it to your MCP configuration

## Available Tools

### Project Information

- `list-spaces` - List all available spaces in the project

### Card Management

- `get-card` - Get detailed information about a specific card
- `list-cards` - List cards in a deck with optional filtering
- `create-card` - Create a new card in a deck
- `update-card` - Update card properties
- `get-card-options` - Get available effort scale and priority labels for creating cards

### Deck Management

- `list-decks` - List all decks in the account
- `create-deck` - Create a new deck

### Adding New Tools

1. Create a new tool file in `src/tools/` extending `ToolGroup`
2. Implement the `register()` method to register tools
3. Import and register the tool group in `server.ts`
4. Add validation schemas using Zod

## 📝 License

MIT License
