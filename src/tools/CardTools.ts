import { z } from "zod";
import { ToolGroup } from "./ToolGroup.js";
import {
  CodecksCard,
  CodecksApiCard,
  CardStatus,
  CardType,
  CardVisibility,
} from "../codecks/entities.js";
import {
  listCardsResponse,
  listQueueEntriesResponse,
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
  "milestone",
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
        milestoneId: z
          .string()
          .optional()
          .describe(
            "Optional milestone (timeline) id to attach the new card to"
          ),
        inHand: z
          .boolean()
          .optional()
          .describe("Set to true to immediately add the new card to the authenticated user's hand"),
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
      "list-hand-cards",
      "List cards currently in the authenticated user's hand",
      async (args) => this.listHandCards(args),
      {
        limit: z
          .number()
          .min(1)
          .max(100)
          .default(20)
          .describe("Maximum number of hand cards to return"),
      }
    );

    this.registerTool(
      "update-card",
      "Update card properties",
      async (args) => this.updateCard(args),
      {
        cardId: z.string().describe("The ID of the card to update"),
        deckId: z
          .string()
          .optional()
          .describe("The ID of the deck to move the card to"),
        content: z.string().optional(),
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
        cardType: z
          .enum(CardType)
          .optional()
          .describe(
            "Card type must be one of: " +
              CardType.join(", ") +
              '. Use "hero" for hero cards, "task" for regular tasks.'
          ),
        parentCardId: z
          .string()
          .nullable()
          .optional()
          .describe(
            "The ID of the hero card to nest this card under. Pass null to remove the parent."
          ),
        milestoneId: z
          .string()
          .nullable()
          .optional()
          .describe(
            "The milestone (timeline) id to attach this card to. Pass null to detach from any milestone."
          ),
        inHand: z
          .boolean()
          .optional()
          .describe(
            "Set to true to add the card to the authenticated user's hand, false to remove it."
          ),
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
    milestoneId?: string;
    inHand?: boolean;
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
      ...(args.milestoneId && { milestoneId: args.milestoneId }),
    };

    const result = await this.client.request<createCardResponse>(
      cardData,
      "cards/create"
    );

    console.error("Card created successfully", result);

    if (args.inHand) {
      const { userId, account } = this.client.context;
      const accountId = account?.id;
      if (!userId || !accountId) {
        throw new Error("Context not initialized: userId and accountId required for hand operations");
      }
      const cardId = result.payload.id;
      await this.client.request(
        { cardIds: [cardId], accountId, userId },
        "handQueue/addCardsToHand"
      );
      console.error("Card added to hand");
    }

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

  private async listHandCards(args: { limit?: number }): Promise<CodecksCard[]> {
    if (!this.client.context.isInitialized() || !this.client.context.userId) {
      throw new Error("Context not initialized");
    }

    const limit = args.limit || 20;
    const queueEntriesQueryKey = `queueEntries(${JSON.stringify({
      userId: this.client.context.userId,
      $order: "sortIndex",
      $limit: limit,
    })})`;

    const queueEntriesQuery = {
      _root: [
        {
          account: [
            {
              [queueEntriesQueryKey]: [
                "card",
                "sortIndex",
                "user",
                "cardDoneAt",
                "createdAt",
              ],
            },
          ],
        },
      ],
    };

    const queueEntriesResponse =
      await this.client.request<listQueueEntriesResponse>(queueEntriesQuery);

    const accountData = Object.values(queueEntriesResponse.account)[0];
    const queueEntryIds = accountData[queueEntriesQueryKey] || [];

    if (queueEntryIds.length === 0) {
      return [];
    }

    const handEntries = queueEntryIds
      .map((id) => queueEntriesResponse.queueEntry[id])
      // Active hand entries are not yet done.
      .filter((entry) => !entry?.cardDoneAt)
      .filter(
        (entry): entry is {
          card: string;
          sortIndex: number;
          user: string;
          cardDoneAt?: string | null;
        } =>
          Boolean(entry?.card)
      );

    const orderedCardIds = handEntries.map((entry) => entry.card);

    const cardsQuery = {
      _root: [
        {
          account: [
            {
              [`cards(${JSON.stringify({ cardId: orderedCardIds })})`]:
                cardQueryFields,
            },
          ],
        },
      ],
    };

    const cardsResponse = await this.client.request<listCardsResponse>(cardsQuery);

    return orderedCardIds
      .map((cardId) => cardsResponse.card[cardId])
      .filter((apiCard): apiCard is CodecksApiCard => Boolean(apiCard))
      .map((apiCard) => this.mapApiCardToMCPCard(apiCard));
  }

  private async updateCard(args: {
    cardId: string;
    deckId?: string;
    content?: string;
    assigneeId?: string;
    priority?: string;
    effort?: number;
    status?: CardStatus;
    visibility?: CardVisibility;
    cardType?: CardType;
    parentCardId?: string | null;
    milestoneId?: string | null;
    inHand?: boolean;
  }): Promise<boolean> {
    const hasCardUpdate =
      args.deckId !== undefined ||
      args.content !== undefined ||
      args.assigneeId !== undefined ||
      args.priority !== undefined ||
      args.effort !== undefined ||
      args.status !== undefined ||
      args.visibility !== undefined ||
      args.cardType !== undefined ||
      args.parentCardId !== undefined ||
      args.milestoneId !== undefined;

    if (hasCardUpdate) {
      const updateData = {
        id: args.cardId,
        ...(args.deckId !== undefined && { deckId: args.deckId }),
        ...(args.content !== undefined && { content: args.content }),
        ...(args.assigneeId !== undefined && { assigneeId: args.assigneeId }),
        ...(args.priority && { priority: args.priority }),
        ...(args.effort && { effort: args.effort }),
        ...(args.status && { status: args.status }),
        ...(args.visibility !== undefined && { visibility: args.visibility }),
        ...(args.cardType !== undefined && { cardType: args.cardType }),
        ...(args.parentCardId !== undefined && {
          parentCardId: args.parentCardId,
        }),
        ...(args.milestoneId !== undefined && {
          milestoneId: args.milestoneId,
        }),
      };

      const result = await this.client.request<updateCardResponse>(
        updateData,
        "cards/update"
      );
      console.error("Card updated successfully", result);
    }

    if (args.inHand !== undefined) {
      const { userId, account } = this.client.context;
      const accountId = account?.id;
      if (!userId || !accountId) {
        throw new Error("Context not initialized: userId and accountId required for hand operations");
      }
      if (args.inHand) {
        await this.client.request(
          { cardIds: [args.cardId], accountId, userId },
          "handQueue/addCardsToHand"
        );
        console.error("Card added to hand");
      } else {
        await this.client.request(
          { cardIds: [args.cardId], userId },
          "handQueue/removeCards"
        );
        console.error("Card removed from hand");
      }
    }

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
      milestoneId: apiCard.milestone ?? null,
    };
  }

  private createCardContent(title: string, description?: string): string {
    return description ? `${title}\n\n${description}` : title;
  }
}
