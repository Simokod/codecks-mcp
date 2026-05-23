import { z } from "zod";
import { ToolGroup } from "./ToolGroup.js";

/**
 * Low-level escape hatches over the Codecks API for exploration and
 * one-off operations the typed tools don't cover.
 *
 * - `query` is READ-ONLY: it can only hit the query endpoint, never
 *   `/dispatch/`, so it cannot mutate anything. Safe to auto-approve.
 * - `dispatch` CAN mutate (it posts to `/dispatch/<endpoint>`). Review
 *   each call before approving.
 */
export class ExploreTools extends ToolGroup {
  register(): void {
    this.registerTool(
      "query",
      "Run a raw READ-ONLY Codecks query and return the normalized graph " +
        "(entities keyed by id, `_root` points at matching ids). Pass the " +
        "inner object of `{query: ...}`. Cannot mutate data. Examples:\n" +
        '  {"_root":[{"account":[{"decks":["title"]}]}]}\n' +
        '  {"_root":[{"account":[{"cards({\\"deckId\\":\\"<id>\\",\\"$order\\":\\"createdAt\\",\\"$limit\\":300})":["cardId","status","derivedStatus","visibility"]}]}]}\n' +
        "Notes: field selections are arrays of strings; `$limit` requires " +
        "`$order`; scalar columns come back snake_case. A malformed shape " +
        "returns HTTP 500.",
      async (args) => this.client.request(args.query),
      {
        query: z
          .any()
          .describe(
            "The Codecks query object (the inner value of `{query: ...}`)."
          ),
      }
    );

    this.registerTool(
      "dispatch",
      "Run a raw Codecks dispatch action (POST /dispatch/<endpoint>). This " +
        "CAN MUTATE data. Use for actions the typed tools don't cover. " +
        "`endpoint` is e.g. `cards/update`, `handQueue/addCardsToHand`; " +
        "`body` is the action payload. Creates typically need projectId + " +
        "userId; the account/user ids come from the running context.",
      async (args) => this.client.request(args.body ?? {}, args.endpoint),
      {
        endpoint: z
          .string()
          .min(1)
          .describe('Dispatch endpoint, e.g. "cards/update".'),
        body: z
          .record(z.any())
          .optional()
          .describe("The action payload object."),
      }
    );
  }
}
