import { z } from "zod";
import { ToolGroup } from "./ToolGroup.js";
import {
  CodecksCard,
  CodecksApiCard,
  CardStatus,
  CardVisibility,
} from "../codecks/entities.js";
import {
  listCardsResponse,
  createCardResponse,
  updateCardResponse,
  getCardResponse,
} from "../codecks/APItypes.js";

const cardQueryFields = [
  "cardId",
  "visibility",
  "isDoc",
  'exists:resolvables({"context":"block","isClosed":false})',
  'exists:resolvables({"context":"review","isClosed":false})',
  "status",
  "derivedStatus",
  'exists:resolvables({"isClosed":true})',
  "lastUpdatedAt",
  "count:attachments",
  "hasBlockingDeps",
  "meta",
  "dueDate",
  "masterTags",
  "title",
  "content",
  "effort",
  "priority",
  "accountSeq",
  "checkboxStats",
];

export class CardTools extends ToolGroup {
  private getDynamicSchemas() {
    const metadata = this.client.context.metadata;

    const effortSchema = metadata?.effortScale
      ? z
          .number()
          .optional()
          .describe(
            "Estimate must be one of the following: " +
              metadata.effortScale.join(", ")
          )
      : z.number().min(0).optional();

    const prioritySchema = metadata?.priorityLabels
      ? z
          .enum(Object.keys(metadata.priorityLabels) as [string, ...string[]])
          .optional()
          .describe(
            `Priority must be one of: ${Object.entries(metadata.priorityLabels)
              .map(([key, label]) => `${key}=${label}`)
              .join(", ")}`
          )
      : z.string().optional().describe("The priority of the card");

    return { effortSchema, prioritySchema };
  }

  register(): void {
    const { effortSchema, prioritySchema } = this.getDynamicSchemas();

    this.registerTool(
      "create-card",
      "Create a new card in a deck",
      async (args) => this.createCard(args),
      {
        deckId: z.string().describe("The ID of the deck to create the card in"),
        title: z.string().describe("The title of the card"),
        description: z
          .string()
          .optional()
          .describe("The content/description of the card"),
        assigneeId: z
          .string()
          .optional()
          .describe("The ID of the user to assign the card to"),
        priority: prioritySchema,
        effort: effortSchema,
      }
    );

    this.registerTool(
      "get-card",
      "Get detailed information about a specific card",
      async (args) => this.getCard(args.cardTitle),
      {
        cardTitle: z.string().describe("The title of the card to retrieve"),
      }
    );

    this.registerTool(
      "list-cards",
      "List cards in a deck with optional filtering",
      async (args) => this.listCards(args),
      {
        deckId: z.string().describe("The ID of the deck to list cards from"),
        status: z
          .enum(CardStatus)
          .optional()
          .describe("Status must be one of: " + CardStatus.join(", ")),
        isArchived: z.boolean().optional().describe("Filter by archived cards"),
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
        content: z.string().optional().describe("The new content of the card"),
        assigneeId: z.string().optional().describe("The new assignee ID"),
        priority: prioritySchema,
        effort: effortSchema,
        status: z
          .enum(CardStatus)
          .optional()
          .describe("Status must be one of: " + CardStatus.join(", ")),
        visibility: z
          .enum(CardVisibility)
          .optional()
          .describe("Visibility must be one of: " + CardVisibility.join(", ")),
      }
    );

    this.registerTool(
      "get-card-options",
      "Get available effort scale and priority labels for creating cards",
      async () => this.getCardOptions(),
      {}
    );
  }

  private async createCard(args: {
    deckId: string;
    title: string;
    description?: string;
    assigneeId?: string;
    priority?: string;
    effort?: number;
  }): Promise<createCardResponse> {
    if (!this.client.context.isInitialized()) {
      throw new Error("Context not initialized");
    }

    const cardData = {
      deckId: args.deckId,
      content: this.createCardContent(args.title, args.description),
      projectId: this.client.context.projectId,
      userId: this.client.context.userId,
      ...(args.assigneeId && { assigneeId: args.assigneeId }),
      ...(args.priority && { priority: args.priority }),
      ...(args.effort && { effort: args.effort }),
    };

    const result = await this.client.request<createCardResponse>(
      cardData,
      "cards/create"
    );

    console.error("Card created successfully", result);
    return result;
  }

  private async getCard(cardTitle: string): Promise<CodecksCard> {
    const query = {
      _root: [
        {
          account: [
            {
              [`cards({"title":{"op":"contains","value":"${cardTitle}"}})`]:
                cardQueryFields,
            },
          ],
        },
      ],
    };

    const response = await this.client.request<getCardResponse>(query);

    const accountData = Object.values(response.account)[0];
    const cardIds =
      accountData[`cards({"title":{"op":"contains","value":"${cardTitle}"}})`];

    if (!cardIds || cardIds.length === 0) {
      throw new Error(`No card found with title containing "${cardTitle}"`);
    }

    const cardId = cardIds[0];
    const apiCard = response.card[cardId];

    if (!apiCard) {
      throw new Error(`Card with ID ${cardId} not found`);
    }

    return this.mapApiCardToMCPCard(apiCard);
  }

  private async listCards(args: {
    deckId: string;
    status?: CardStatus;
    assigneeId?: string;
    limit?: number;
    isArchived?: boolean;
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
    if (args.isArchived) {
      cardFilters.visibility = "archived";
    }

    const query = {
      _root: [
        {
          account: [
            {
              [`cards(${JSON.stringify(cardFilters)})`]: cardQueryFields,
            },
          ],
        },
      ],
    };

    const response = await this.client.request<listCardsResponse>(query);

    const apiCards = Object.values(response.card);

    return apiCards.map((apiCard) => this.mapApiCardToMCPCard(apiCard));
  }

  private async updateCard(args: {
    cardId: string;
    content?: string;
    assigneeId?: string;
    priority?: string;
    effort?: number;
    status?: CardStatus;
    visibility?: CardVisibility;
  }): Promise<boolean> {
    const updateData = {
      id: args.cardId,
      ...(args.content !== undefined && { content: args.content }),
      ...(args.assigneeId !== undefined && { assigneeId: args.assigneeId }),
      ...(args.priority && { priority: args.priority }),
      ...(args.effort && { effort: args.effort }),
      ...(args.status && { status: args.status }),
      ...(args.visibility !== undefined && {
        visibility: args.visibility,
      }),
    };

    const result = await this.client.request<updateCardResponse>(
      updateData,
      "cards/update"
    );

    console.error("Card updated successfully", result);
    return true;
  }

  private async getCardOptions(): Promise<{
    effortScale: number[];
    priorityLabels: Record<string, string>;
  }> {
    const metadata = this.client.context.metadata;
    if (!metadata) {
      return {
        effortScale: [],
        priorityLabels: {},
      };
    }

    return {
      effortScale: metadata.effortScale,
      priorityLabels: metadata.priorityLabels,
    };
  }

  private mapApiCardToMCPCard(apiCard: CodecksApiCard): CodecksCard {
    return {
      id: apiCard.cardId,
      title: apiCard.title,
      content: apiCard.content,
      type: apiCard.isDoc ? "doc" : "task",
      status: apiCard.status as CardStatus | undefined,
      assigneeId: apiCard.assigneeId,
      priority: apiCard.priority,
      deckId: apiCard.deckId,
      visibility: apiCard.visibility,
      derivedStatus: apiCard.derivedStatus,
      lastUpdatedAt: apiCard.lastUpdatedAt,
      countAttachments: apiCard.countAttachments,
      hasBlockingDeps: apiCard.hasBlockingDeps,
      meta: apiCard.meta,
      dueDate: apiCard.dueDate,
      masterTags: apiCard.masterTags,
      effort: apiCard.effort,
      accountSeq: apiCard.accountSeq,
      checkboxStats: apiCard.checkboxStats,
    };
  }

  private createCardContent(title: string, description?: string): string {
    return description ? `${title}\n\n${description}` : title;
  }
}
