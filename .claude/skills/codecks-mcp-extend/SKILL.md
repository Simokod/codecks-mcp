---
name: codecks-mcp-extend
description: Add a new tool/capability to this CodecksMCP server. Use this skill whenever the user wants to extend the MCP — e.g. "add support for milestones to the MCP", "I want a tool that lists sprints", "add CRUD for cards/decks/spaces/users/tags/runs/projects/reviewers/etc", "support attaching X to Y in Codecks", "expose <Codecks feature> through the MCP". Trigger even when the user names a Codecks feature without saying "MCP" if cwd is this project. The skill drives the full loop: clarify the entity, research the Codecks API via docs, probe the live API with throwaway tsx scripts to discover required fields, then implement and register the new ToolGroup.
---

# codecks-mcp-extend

This skill extends the **CodecksMCP** server (an MCP that bridges AI assistants to the Codecks task-management API) with new capabilities. It encodes a workflow proven to work for this codebase: research → probe → implement → smoke-test → clean up.

The Codecks API is not exhaustively documented. You will **not** know the dispatch endpoint payload shapes from training data alone. Discovering them by probing the live API is the core of this workflow — do not skip it and do not guess.

## When this skill applies

- The user wants to add a new entity, tool, or capability to this MCP (CRUD for some Codecks model, attaching one entity to another, exposing a Codecks feature, etc.)
- A working `.env` with `CODECKS_AUTH_TOKEN` and `CODECKS_SUBDOMAIN` must exist at the project root — the probe step depends on it. If it's missing, stop and ask the user.

## Quick orientation

Read these files first, in order. They establish the patterns you must follow:

- `src/codecks/client.ts` — the `request` method. Two modes: `request(query)` posts a GraphQL-like body to `https://api.codecks.io/` for reads; `request(payload, endpoint)` posts to `https://api.codecks.io/dispatch/<endpoint>` for actions. Auth headers: `X-Account` (subdomain), `X-Auth-Token`. Existing dispatch endpoints used: `cards/create`, `cards/update`, `decks/create`, `milestones/create|update|delete`.
- `src/tools/ToolGroup.ts` — the base class. `registerTool(name, description, handler, zodSchema, formatter?)` is what every tool uses. Errors are caught and returned as text; you do not need to wrap your handler in try/catch.
- `src/tools/CardTools.ts` — the most complete example. Mirror its patterns for: dynamic Zod schemas from `client.context.metadata`, splitting/joining card content as `${title}\n\n${description}`, conditional spread for optional update fields (`...(args.x !== undefined && { x: args.x })`).
- `src/tools/DeckTools.ts` — minimal example. Good template if your entity has just create/list.
- `src/tools/MilestoneTools.ts` — full CRUD example with a dispatch action endpoint requiring `userId`, `accountId`, and a relation array (`projectIds`).
- `src/codecks/entities.ts` — where API and MCP-facing types live. Split: `CodecksApi<X>` for the raw response shape, `Codecks<X>` for what your tool returns. Const enums (`CardStatus`, `MilestoneColor`) are used both as TS types and Zod enums.
- `src/codecks/APItypes.ts` — response wrapper types per endpoint. Add a `list<X>Response`, a `get<X>Response`, and (for dispatch endpoints) an action response shape if it doesn't already exist.
- `src/server.ts` — register the new ToolGroup here with one `new XTools(server, client).register()` line.

## The workflow

### Step 1 — Clarify the entity

The user may use ambiguous terms ("timelines" = milestones in Codecks). Before researching, confirm what Codecks model the request maps to. Ask with concrete options if it's unclear. Note any related models that are likely to come up (e.g. a card has both `milestoneId` and `sprintId` — knowing which one the user means matters).

If the user wants a relationship/attachment (e.g. "attach a card to X"), the implementation usually lives as an optional field on the existing tools (`create-card`, `update-card`) rather than a separate tool. Plan for both: the new entity's own CRUD, and patches to existing tools to wire up the relation.

### Step 2 — Research via docs

Hit these sources in parallel:

- `https://manual.codecks.io/api-reference/` — model schema (fields, relations). This is authoritative for read-side field names.
- `https://manual.codecks.io/api/` — general API quick-start, auth header conventions.
- `https://gist.github.com/danielberndt/58e14e1f16df043344deb0c8bfbb25fd` — community guide with worked dispatch examples; useful for spotting payload field names like `milestoneId` or `parentCardId`.

Use WebFetch with a prompt that asks specifically for: model name, fields and types, relations, and any documented endpoints. Quote payload examples verbatim if found.

The docs will give you the **model** and **field names** but rarely the full **dispatch payload** required for create/update. That's what the probe is for.

### Step 3 — Probe the live API

Create `scripts/probe-<entity>.ts` in the project root. **The `scripts/` dir is throwaway — you will delete it in step 6.**

Template (start from this, don't reinvent it):

```ts
import "dotenv/config";

const authToken = process.env.CODECKS_AUTH_TOKEN || "";
const subdomain = process.env.CODECKS_SUBDOMAIN || "";

async function api(query: any, endpoint?: string) {
  const url = endpoint
    ? `https://api.codecks.io/dispatch/${endpoint}`
    : "https://api.codecks.io/";
  const body = endpoint ? JSON.stringify(query) : JSON.stringify({ query });
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "X-Account": subdomain,
      "Content-Type": "application/json",
      "X-Auth-Token": authToken,
    },
    body,
  });
  const text = await res.text();
  console.error(`[${endpoint ?? "query"}] status=${res.status} body=${text.slice(0, 500)}`);
  try { return JSON.parse(text); } catch { return text; }
}

async function main() {
  // 1. Read root + your entity to confirm field names
  const root = await api({
    _root: [{
      account: ["id", { <yourEntityPlural>: ["id", "name", /* known fields */] }],
      loggedInUser: ["id"],
    }],
  });
  const accountId = root._root.account;
  const userId = root._root.loggedInUser;

  // 2. Try a create with a minimal payload — iterate based on 400 errors
  const created = await api(
    { /* start minimal: name, userId, accountId */ },
    "<entityPlural>/create",
  );

  // 3. Read it back to confirm what was stored
  // 4. Try update with each field individually
  // 5. Delete to clean up
}

main().catch((e) => { console.error(e); process.exit(1); });
```

Run with the project-local tsx (`npm run dev` uses tsx too, so it's installed): `./node_modules/.bin/tsx scripts/probe-<entity>.ts 2>&1 | tail -60`

**The discovery loop:**

The Codecks API returns very informative 400 errors like `"body must have property 'projectIds'"` or `"field 'color' in body must be equal to one of the allowed values"`. Use them as the feedback loop:

1. POST a minimal payload.
2. Read the error. Add the missing field. Re-run.
3. Repeat until 200. Then probe enum-valued fields by sending a likely-invalid value to surface the allowed set.
4. Read the entity back with the same field selection your tool will use, to confirm response shape.
5. Update it. Delete it. Confirm cleanup with another read.

**Mutation safety:** probes can create/update/delete in the user's real account but must always delete what they create. Use a recognisable name prefix like `mcp-probe-` so leftover entities are easy to spot. If a probe fails before cleanup, surface the leaked id to the user so they can delete it manually.

**Common required fields for dispatch create endpoints** (learned from cards/decks/milestones — your entity probably follows the same pattern): `userId`, `accountId`, and a relation array or scalar like `projectId` / `projectIds` / `deckId`. Try these first if the error message is vague.

### Step 4 — Implement

Touch these files in order:

1. **`src/codecks/entities.ts`** — add `CodecksApi<X>` (matches the probe's read-back shape) and `Codecks<X>` (your tool's return shape). If there are enum-valued fields, export them as `as const` arrays so they can serve as both TS types and `z.enum(...)` schemas. Mirror how `CardStatus` and `MilestoneColor` are defined.

2. **`src/codecks/APItypes.ts`** — add `list<X>Response`, `get<X>Response`, and an action response type if the existing `createCardResponse` / `milestoneActionResponse` shapes don't fit. The list/get shapes follow `{ _root, account: Record<string, {...}>, <entity>: Record<string, CodecksApi<X>> }`.

3. **`src/tools/<X>Tools.ts`** — new ToolGroup. Conventions to follow:
   - Define a `<entity>QueryFields` array (the field selection used by both list and get) at the top of the file.
   - `register()` calls `this.registerTool(name, description, handler, zodSchema)` once per tool. Kebab-case tool names: `list-<entities>`, `get-<entity>`, `create-<entity>`, `update-<entity>`, `delete-<entity>`.
   - Use a private `mapApi<X>` method to convert the API shape to the MCP shape.
   - For create handlers that need session context, check `this.client.context.isInitialized()` and pull `accountId`, `userId`, `projectId` from `this.client.context`.
   - For update handlers, build the patch with conditional spread on `args.x !== undefined` so callers can clear nullable fields by passing `null`.
   - For dynamic schemas (effort scale, priority labels, etc.), follow the `getDynamicSchemas()` pattern in `CardTools.ts`.

4. **`src/server.ts`** — add the import and the registration line. Order: ProjectTools, DeckTools, CardTools, MilestoneTools, then yours.

5. **Patches to existing tools** for any relations the user asked for. For card⇄entity links, add an optional `<entity>Id` field to `create-card` and a nullable optional `<entity>Id` to `update-card`. Pass it through to the dispatch body conditionally; `null` is a valid value (it detaches).

### Step 5 — Build and smoke-test

```bash
npm run build
```

Then write `scripts/probe-<entity>-smoke.ts` (or reuse the probe script) that exercises the full path the user cares about: create the entity, attach a card to it if relevant, read back, mutate, detach/delete, confirm. Use the same `api()` helper. The goal is to catch shape mismatches between your TS types and reality before the user runs the MCP.

If something fails, fix the code (not the test) and re-run.

### Step 6 — Clean up

```bash
rm scripts/probe-*.ts && rmdir scripts 2>/dev/null
```

The `scripts/` directory is throwaway. Don't commit it. Also do not leave the temporary probe entities lying around in the user's Codecks account — if cleanup in the probe failed, delete them now via a one-off dispatch call.

### Step 7 — Report

Summarise what shipped:
- New tool group, list of registered tool names with one-line descriptions.
- Any patches to existing tools (e.g. new optional fields).
- One line on verification: "probed live API end-to-end, build clean".

## Patterns and gotchas

**Dispatch response shapes vary.** Create returns `{ payload: { id, accountSeq }, actionId }`. Update/delete often return `{ payload: null, actionId }`. Don't assume `payload.id` is always present in your action response type — make it `payload: { id: string; ... } | null`.

**Relation join tables.** Some relations (e.g. `milestoneProjects`) appear as join entities in reads but are sent as a flat ID array in writes (`projectIds: [...]`). Probe both sides.

**The `content` split.** Cards store title and description as a single `content` field: `"${title}\n\n${description}"`. If your entity does the same, mirror the `createCardContent` helper and split on read.

**Date fields.** Codecks uses `YYYY-MM-DD` for date-only fields (no time). Validate with a regex Zod schema; the API rejects ISO timestamps.

**Enum probing.** When the API rejects an enum value, the error doesn't list valid options. Try common values (colors: `blue|green|red|yellow|gray|purple|orange`; statuses: `not_started|done`; visibilities: `default|archived`) or check the manual.

**Soft delete.** Entities like milestones have `isDeleted: boolean`. List tools should filter these out by default and offer an `includeDeleted` flag.

**Account scoping.** Almost every read query is wrapped in `account: [...]`. The account id comes from `_root.account` in the response. Initialize this once via `client.initializeContext()` — never hard-code.

**Don't write tests.** This repo has no test or lint scripts. The smoke probe is the test. Don't add Jest, Vitest, or a test script unless the user explicitly asks.

**Don't commit `.env` or probe scripts.** `.gitignore` already covers `.env`; add `scripts/` to your mental gitignore — but the cleanest move is to delete it before reporting done.

## Anti-patterns

- Guessing dispatch payload shapes without probing. The API has quirks (`projectIds` vs `projectId`, required `userId`+`accountId`, color enums) you will not infer correctly.
- Writing TypeScript types from docs alone and skipping the read-back step. Field names in reads sometimes differ from writes (e.g. card relation is named `milestone` in reads, set via `milestoneId` in writes).
- Adding error handling around dispatch calls. `ToolGroup.registerTool` already catches and formats errors; extra try/catch just buries the original message.
- Creating documentation files. The project's `CLAUDE.md` covers architecture; don't add READMEs unless asked.
- Leaving probe scripts behind. They contain hard-coded ids from the user's account and shouldn't be checked in.
