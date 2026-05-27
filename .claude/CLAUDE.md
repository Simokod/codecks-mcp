# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build   # Compile TypeScript to dist/
npm run dev     # Run server directly with tsx (no build needed)
npm start       # Run compiled server from dist/
```

No test or lint scripts are configured.

## Architecture

CodecksMCP is an MCP server that bridges AI assistants to the Codecks task management API. The server communicates over stdio and exposes tools for managing cards, decks, and spaces.

### Layers

**`src/server.ts`** — Entry point. Initializes `CodecksClient`, calls `initializeContext()`, then creates tool groups and registers them with the MCP server.

**`src/codecks/`** — API integration:
- `client.ts` — All HTTP calls to Codecks. Two modes: GraphQL-like queries (default endpoint) and dispatch commands (`/dispatch/{endpoint}`). Auth via `X-Auth-Token` + `X-Account` headers.
- `context.ts` — Holds session state (accountId, userId, projectId, metadata) populated once at startup.
- `entities.ts` — Types for both raw API responses (`CodecksApi*` prefix) and simplified MCP-facing types.
- `APItypes.ts` — Response shapes for each API endpoint.

**`src/tools/`** — Tool implementations:
- `ToolGroup.ts` — Abstract base class. `registerTool()` wraps handlers with error handling and formats responses as `{ content: [{ type: "text", text }] }`.
- `ProjectTools.ts`, `DeckTools.ts`, `CardTools.ts` — Each implements `register()` calling `registerTool()` for each exposed MCP tool.

**`src/validations/config.ts`** — Validates `CODECKS_AUTH_TOKEN` and `CODECKS_SUBDOMAIN` env vars at startup.

### Key patterns

**Two-phase initialization:** `client.getRootData()` bootstraps account/user/project IDs, then `client.getMetadata()` fetches effort scale and priority labels for dynamic Zod schema validation in card tools.

**Adding a new tool:** Extend `ToolGroup`, implement `register()`, call `registerTool(name, description, handler, zodSchema, formatter?)`, then instantiate in `server.ts`.

**Codecks query syntax:** GraphQL-like with field selection arrays. Nested entities use `account(accountId)` wrapper. Filters inline: `cards({"deckId":"..."})`. Computed fields use `exists:` or `count:` prefixes.

**Normalized graph — filtered vs unfiltered reads:** Codecks can side-load
related entities of the same type into the response graph even when a filter
was applied. For example, `resp.queueEntry` may contain entries for other users
even if the query filtered by `userId`. Never iterate `Object.values(resp.X)`
to read filtered results. Instead, read the ordered ID list from the parent
account entity under the exact filter-key string, then look up those IDs:

```ts
const accountData = Object.values(response.account)[0];
const ids = accountData[filterKeyString] ?? [];
const results = ids.map((id) => response.queueEntry[id]).filter(Boolean);
```

This is the proven pattern — see `listHandCards` in `CardTools.ts` as the
reference implementation. The mobile app mirrors this via a `filteredEntities`
helper in its `client.ts`.

**Card content:** The Codecks API stores title+description as a single `content` field formatted as `"${title}\n\n${description}"`. Tools split/join this on read/write.

### Required environment variables

```
CODECKS_AUTH_TOKEN   # From the `at` cookie in Codecks API requests
CODECKS_SUBDOMAIN    # Subdomain from https://[subdomain].codecks.io
```
