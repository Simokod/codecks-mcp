# Codecks MCP

A Model Context Protocol (MCP) server for interacting with Codecks task management application. This MCP allows AI assistants to read, create, and manage cards and decks in your Codecks team.

## Features

- **Card Management**: Create, read, update, and delete cards
- **Deck Management**: List and create decks
- **Account Information**: Get account details
- **Filtering**: Filter cards by status, assignee, and type

## Installation

1. Clone this repository:

```bash
git clone https://github.com/yourusername/codecks-mcp.git
cd codecks-mcp
```

2. Install dependencies:

```bash
npm install
```

3. Build the project:

```bash
npm run build
```

## Configuration

The Codecks MCP server is configured through the MCP client configuration file (typically `~/.cursor/mcp.json` or similar). The following environment variables are automatically provided by the MCP client:

### Required Configuration

- `CODECKS_API_TOKEN` - Your Codecks API token
- `CODECKS_TEAM_ID` - Your Codecks team ID

### Example MCP Configuration

```json
{
  "mcpServers": {
    "codecks": {
      "command": "node",
      "args": ["/path/to/codecks-mcp/dist/server.js"],
      "env": {
        "CODECKS_API_TOKEN": "your_actual_api_token",
        "CODECKS_TEAM_ID": "your_actual_team_id"
      }
    }
  }
}
```

### Getting Your Codecks API Token

1. Log in to your Codecks account
2. Go to Settings → API
3. Generate a new API token
4. Copy the token and add it to your MCP configuration

### Getting Your Team ID

1. In Codecks, navigate to your team
2. The team ID is in the URL: `https://codecks.io/teams/{team_id}`
3. Copy the team ID and add it to your MCP configuration

## Usage

### Running the MCP Server

```bash
npm start
```

### Development Mode

```bash
npm run dev
```

## Available Tools

### Account Information

- `get-account-name` - Get the name of the Codecks account

### Card Management

- `get-card` - Get detailed information about a specific card _(TBD)_
- `list-cards` - List cards in a deck with optional filtering
- `create-card` - Create a new card in a deck _(TBD)_
- `update-card` - Update card properties _(TBD)_
- `delete-card` - Delete a card _(TBD)_

### Deck Management

- `list-decks` - List all decks in the account
- `create-deck` - Create a new deck

### Adding New Tools

1. Create a new tool file in `src/tools/` extending `ToolGroup`
2. Implement the `register()` method to register tools
3. Import and register the tool group in `server.ts`
4. Add validation schemas using Zod

## License

MIT License - see LICENSE file for details.
