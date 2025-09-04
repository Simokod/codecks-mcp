import { z } from "zod";
import { ToolGroup } from "./ToolGroup.js";
import { CardType, CodecksDeck } from "../codecks/entities.js";
import { getDecksResponse } from "../codecks/APItypes.js";

export class DeckTools extends ToolGroup {
  register(): void {
    this.registerTool("list-decks", "List all decks in the account", async () =>
      this.listDecks()
    );

    this.registerTool(
      "create-deck",
      "Create a new deck",
      async (args) => this.createDeck(args.name, args.spaceId),
      {
        name: z
          .string()
          .min(1, "Name is required")
          .describe("The name of the deck to create"),
        spaceId: z
          .number()
          .describe("The ID of the space to create the deck in"),
      }
    );
  }

  private async listDecks(): Promise<CodecksDeck[]> {
    const query = {
      _root: [
        {
          account: [{ decks: ["title"] }],
        },
      ],
    };
    const response = await this.client.request<getDecksResponse>(query);
    const decks = Object.entries(response.deck).map(([id, deck]) => ({
      id,
      name: deck.title,
    }));

    return decks;
  }

  private async createDeck(
    name: string,
    spaceId: number
  ): Promise<CodecksDeck> {
    if (!this.client.context.isInitialized()) {
      throw new Error("Context not initialized");
    }

    const result = await this.client.request<{
      id: string;
      title: string;
    }>(
      {
        title: name,
        coverFileData: null,
        projectId: this.client.context.projectId,
        userId: this.client.context.userId,
        spaceId,
        allowedCardTypes: CardType,
      },
      "decks/create"
    );

    return {
      id: result.id,
      name: result.title,
    };
  }
}
