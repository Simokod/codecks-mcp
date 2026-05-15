import { z } from "zod";
import { ToolGroup } from "./ToolGroup.js";
import {
  CodecksApiMilestone,
  CodecksMilestone,
  MilestoneColor,
} from "../codecks/entities.js";
import {
  getMilestoneResponse,
  listMilestonesResponse,
  milestoneActionResponse,
} from "../codecks/APItypes.js";

const milestoneQueryFields = [
  "id",
  "name",
  "date",
  "startDate",
  "color",
  "description",
  "isGlobal",
  "isDeleted",
  "accountSeq",
  "createdAt",
];

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");

export class MilestoneTools extends ToolGroup {
  register(): void {
    this.registerTool(
      "list-milestones",
      "List milestones (timelines) in the account. By default excludes deleted milestones.",
      async (args) => this.listMilestones(args),
      {
        includeDeleted: z
          .boolean()
          .optional()
          .describe("Include soft-deleted milestones (default false)"),
      }
    );

    this.registerTool(
      "get-milestone",
      "Get a single milestone by id",
      async (args) => this.getMilestone(args.id),
      {
        id: z.string().describe("The milestone id"),
      }
    );

    this.registerTool(
      "create-milestone",
      "Create a new milestone (timeline)",
      async (args) => this.createMilestone(args),
      {
        name: z.string().min(1).describe("The milestone name"),
        date: dateString.describe(
          "Target/delivery date in YYYY-MM-DD format"
        ),
        startDate: dateString
          .optional()
          .describe("Optional start date in YYYY-MM-DD format"),
        color: z
          .enum(MilestoneColor)
          .optional()
          .describe(
            "Display color. One of: " + MilestoneColor.join(", ")
          ),
        description: z.string().optional(),
        isGlobal: z
          .boolean()
          .optional()
          .describe(
            "Whether the milestone applies to all projects (default true)"
          ),
        projectIds: z
          .array(z.string())
          .optional()
          .describe(
            "Project ids to link the milestone to. Defaults to the active project."
          ),
      }
    );

    this.registerTool(
      "update-milestone",
      "Update milestone properties",
      async (args) => this.updateMilestone(args),
      {
        id: z.string().describe("The milestone id to update"),
        name: z.string().optional(),
        date: dateString.optional().describe("Target date YYYY-MM-DD"),
        startDate: dateString
          .nullable()
          .optional()
          .describe("Start date YYYY-MM-DD, or null to clear"),
        color: z.enum(MilestoneColor).optional(),
        description: z.string().nullable().optional(),
        isGlobal: z.boolean().optional(),
      }
    );

    this.registerTool(
      "delete-milestone",
      "Delete a milestone",
      async (args) => this.deleteMilestone(args.id),
      {
        id: z.string().describe("The milestone id to delete"),
      }
    );
  }

  private async listMilestones(args: {
    includeDeleted?: boolean;
  }): Promise<CodecksMilestone[]> {
    const query = {
      _root: [
        {
          account: ["id", { milestones: milestoneQueryFields }],
        },
      ],
    };

    const response = await this.client.request<listMilestonesResponse>(query);
    const milestones = Object.values(response.milestone ?? {}).map((m) =>
      this.mapApiMilestone(m)
    );

    return args.includeDeleted
      ? milestones
      : milestones.filter((m) => !m.isDeleted);
  }

  private async getMilestone(id: string): Promise<CodecksMilestone> {
    const query = {
      [`milestone(${id})`]: milestoneQueryFields,
    };

    const response = await this.client.request<getMilestoneResponse>(query);
    const apiMilestone = response.milestone?.[id];
    if (!apiMilestone) {
      throw new Error(`Milestone ${id} not found`);
    }
    return this.mapApiMilestone(apiMilestone);
  }

  private async createMilestone(args: {
    name: string;
    date: string;
    startDate?: string;
    color?: string;
    description?: string;
    isGlobal?: boolean;
    projectIds?: string[];
  }): Promise<{ id: string; accountSeq?: number }> {
    if (
      !this.client.context.isInitialized() ||
      !this.client.context.account ||
      !this.client.context.userId ||
      !this.client.context.projectId
    ) {
      throw new Error("Context not initialized");
    }

    const projectIds = args.projectIds?.length
      ? args.projectIds
      : [this.client.context.projectId];

    const body = {
      name: args.name,
      date: args.date,
      isGlobal: args.isGlobal ?? true,
      ...(args.startDate !== undefined && { startDate: args.startDate }),
      ...(args.color !== undefined && { color: args.color }),
      ...(args.description !== undefined && { description: args.description }),
      userId: this.client.context.userId,
      accountId: this.client.context.account.id,
      projectIds,
    };

    const result = await this.client.request<milestoneActionResponse>(
      body,
      "milestones/create"
    );

    if (!result.payload?.id) {
      throw new Error("Milestone creation returned no id");
    }

    return {
      id: result.payload.id,
      accountSeq: result.payload.accountSeq,
    };
  }

  private async updateMilestone(args: {
    id: string;
    name?: string;
    date?: string;
    startDate?: string | null;
    color?: string;
    description?: string | null;
    isGlobal?: boolean;
  }): Promise<boolean> {
    const body = {
      id: args.id,
      ...(args.name !== undefined && { name: args.name }),
      ...(args.date !== undefined && { date: args.date }),
      ...(args.startDate !== undefined && { startDate: args.startDate }),
      ...(args.color !== undefined && { color: args.color }),
      ...(args.description !== undefined && { description: args.description }),
      ...(args.isGlobal !== undefined && { isGlobal: args.isGlobal }),
    };

    await this.client.request<milestoneActionResponse>(
      body,
      "milestones/update"
    );

    return true;
  }

  private async deleteMilestone(id: string): Promise<boolean> {
    await this.client.request<milestoneActionResponse>(
      { id },
      "milestones/delete"
    );
    return true;
  }

  private mapApiMilestone(api: CodecksApiMilestone): CodecksMilestone {
    return {
      id: api.id,
      name: api.name,
      date: api.date,
      startDate: api.startDate,
      color: api.color,
      description: api.description,
      isGlobal: api.isGlobal,
      isDeleted: api.isDeleted,
      accountSeq: api.accountSeq,
      createdAt: api.createdAt,
    };
  }
}
