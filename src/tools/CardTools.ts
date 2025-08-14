import { z } from "zod";
import { ToolGroup } from "./ToolGroup.js";
import { CodecksCard } from "../codecks/entities.js";
import {
  listCardsResponse,
  createCardResponse,
  updateCardResponse,
  getCardResponse,
} from "../codecks/APItypes.js";

export class CardTools extends ToolGroup {
  register(): void {
    this.registerTool(
      "create-card",
      "Create a new card in a deck",
      async (args) => this.createCard(args),
      {
        deckId: z.string().describe("The ID of the deck to create the card in"),
        title: z
          .string()
          .min(1, "Title is required")
          .describe("The title of the card"),
        description: z
          .string()
          .optional()
          .describe("The description of the card"),
        type: z
          .enum(["hero", "task", "doc"])
          .default("task")
          .describe("The type of the card"),
        assigneeId: z
          .string()
          .optional()
          .describe("The ID of the user to assign the card to"),
        priority: z
          .enum(["low", "medium", "high"])
          .optional()
          .describe("The priority of the card"),
      }
    );

    this.registerTool(
      "get-card",
      "Get detailed information about a specific card",
      async (args) => this.getCard(args.cardId),
      {
        cardId: z.string().describe("The ID of the card to retrieve"),
      }
    );

    this.registerTool(
      "list-cards",
      "List cards in a deck with optional filtering",
      async (args) => this.listCards(args),
      {
        deckId: z.string().describe("The ID of the deck to list cards from"),
        status: z
          .enum(["open", "done", "archived"])
          .optional()
          .describe("Filter by card status"),
        assigneeId: z.string().optional().describe("Filter by assignee ID"),
        type: z
          .enum(["hero", "task", "doc"])
          .optional()
          .describe("Filter by card type"),
        limit: z
          .number()
          .min(1)
          .max(100)
          .default(20)
          .describe("Maximum number of cards to return"),
      }
    );

    this.registerTool(
      "update-card",
      "Update card properties",
      async (args) => this.updateCard(args),
      {
        cardId: z.string().describe("The ID of the card to update"),
        title: z.string().optional().describe("The new title of the card"),
        description: z
          .string()
          .optional()
          .describe("The new description of the card"),
        assigneeId: z.string().optional().describe("The new assignee ID"),
        priority: z
          .enum(["low", "medium", "high"])
          .optional()
          .describe("The new priority"),
        status: z
          .enum(["open", "done", "archived"])
          .optional()
          .describe("The new status"),
      }
    );

    this.registerTool(
      "delete-card",
      "Delete a card",
      async (args) => this.deleteCard(args.cardId),
      {
        cardId: z.string().describe("The ID of the card to delete"),
      }
    );
  }

  private async createCard(args: {
    deckId: string;
    title: string;
    description?: string;
    type?: "hero" | "task" | "doc";
    assigneeId?: string;
    priority?: "low" | "medium" | "high";
  }): Promise<CodecksCard> {
    if (!this.client.context.isInitialized()) {
      throw new Error("Context not initialized");
    }

    const cardData = {
      title: args.title,
      description: args.description || "",
      type: args.type || "task",
      deckId: args.deckId,
      projectId: this.client.context.projectId,
      userId: this.client.context.userId,
      ...(args.assigneeId && { assigneeId: args.assigneeId }),
      ...(args.priority && { priority: args.priority }),
    };

    const result = await this.client.request<createCardResponse>(
      cardData,
      "cards/create"
    );

    return {
      id: result.id,
      title: result.title,
      description: result.description,
      type: result.type as "hero" | "task" | "doc",
      status: result.status as "open" | "done" | "archived",
      assigneeId: result.assigneeId,
      priority: result.priority as "low" | "medium" | "high",
      deckId: args.deckId,
    };
  }

  private async getCard(cardId: string): Promise<CodecksCard> {
    const query = {
      _root: [
        {
          account: [
            {
              [`cards(${JSON.stringify({ id: cardId })})`]: [
                // "id",
                "title",
                // "description",
                // "type",
                // "status",
                // "assigneeId",
                // "priority",
                // "deckId",
              ],
            },
          ],
        },
      ],
    };

    const response = await this.client.request<getCardResponse>(query);

    const card = response.card[cardId];
    if (!card) {
      throw new Error(`Card with ID ${cardId} not found`);
    }

    return {
      id: card.cardId,
      title: card.title,
      // account: card.account,
      description: "",
      type: "task",
      status: "open",
      assigneeId: "",
      priority: "low",
      deckId: "",
    };
  }

  private async listCards(args: {
    deckId: string;
    status?: "open" | "done" | "archived";
    assigneeId?: string;
    type?: "hero" | "task" | "doc";
    limit?: number;
  }): Promise<CodecksCard[]> {
    const limit = args.limit || 20;

    const cardFilters: Record<string, any> = {
      deckId: args.deckId,
      $order: "createdAt",
      $limit: limit,
    };

    if (args.status) {
      cardFilters.status = args.status;
    }
    if (args.assigneeId) {
      cardFilters.assigneeId = args.assigneeId;
    }
    if (args.type) {
      cardFilters.type = args.type;
    }

    const query = {
      _root: [
        {
          account: [
            {
              [`cards(${JSON.stringify(cardFilters)})`]: ["title"],
            },
          ],
        },
      ],
    };

    const response = await this.client.request<listCardsResponse>(query);

    const cards = Object.values(response.card);

    return cards.map((card) => ({
      id: card.cardId,
      title: card.title,
      account: card.account,
      description: "",
      type: "task",
      status: "open",
      assigneeId: "",
      priority: "low",
      deckId: "",
    }));
  }

  private async updateCard(args: {
    cardId: string;
    title?: string;
    description?: string;
    assigneeId?: string;
    priority?: "low" | "medium" | "high";
    status?: "open" | "done" | "archived";
  }): Promise<CodecksCard> {
    // First get the current card to preserve the deckId
    const currentCard = await this.getCard(args.cardId);

    const updateData = {
      id: args.cardId,
      ...(args.title && { title: args.title }),
      ...(args.description !== undefined && { description: args.description }),
      ...(args.assigneeId !== undefined && { assigneeId: args.assigneeId }),
      ...(args.priority && { priority: args.priority }),
      ...(args.status && { status: args.status }),
    };

    const result = await this.client.request<updateCardResponse>(
      updateData,
      "cards/update"
    );

    return {
      id: result.id,
      title: result.title,
      description: result.description,
      type: result.type as "hero" | "task" | "doc",
      status: result.status as "open" | "done" | "archived",
      assigneeId: result.assigneeId,
      priority: result.priority as "low" | "medium" | "high",
      deckId: currentCard.deckId,
    };
  }

  private async deleteCard(
    cardId: string
  ): Promise<{ success: boolean; message: string }> {
    await this.client.request({ id: cardId }, "cards/delete");
    return { success: true, message: `Card ${cardId} deleted successfully` };
  }
}
