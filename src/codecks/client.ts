import {
  GetMetadataResponse,
  GetRootDataResponse,
  RootData,
} from "./APItypes.js";
import { CodecksConfig } from "../validations/config.js";
import { CodecksContext } from "./context.js";

class CodecksClient {
  public context: CodecksContext;

  constructor(private config: CodecksConfig) {
    this.context = new CodecksContext();
  }

  public async initializeContext(): Promise<void> {
    const rootData = await this.getRootData();
    this.context.initialize(
      rootData.account,
      rootData.userId,
      rootData.projectId
    );

    const metadata = await this.getMetadata();
    this.context.setMetadata(metadata.account[rootData.account.id]);
  }

  public async request<T>(query: any, endpoint?: string): Promise<T> {
    const isDispatch = !!endpoint;

    const url = isDispatch
      ? `https://api.codecks.io/dispatch/${endpoint}`
      : "https://api.codecks.io/";

    const body = isDispatch ? JSON.stringify(query) : JSON.stringify({ query });

    console.error(
      `[CodecksClient] Making ${isDispatch ? "dispatch " : ""}request:`,
      JSON.stringify(query, null, 2)
    );

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "X-Account": this.config.subdomain,
          "Content-Type": "application/json",
          "X-Auth-Token": this.config.authToken,
        },
        body,
      });

      if (!response.ok) {
        console.error(`[CodecksClient] Response status: ${response.status}`);
        const errorText = await response.text();
        throw new Error(
          `HTTP error! status: ${response.status}, body: ${errorText}`
        );
      }

      const result = await response.json();
      console.error(
        "[CodecksClient] Response received:",
        JSON.stringify(result, null, 2)
      );
      return result;
    } catch (error) {
      console.error("[CodecksClient] Request failed:", error);
      throw error;
    }
  }

  async getRootData(): Promise<RootData> {
    try {
      const response = await this.request<GetRootDataResponse>({
        _root: [
          {
            account: [
              "id",
              "name",
              "subdomain",
              "activeProjectCount",
              "billingEmail",
              "billingName",
              "createdAt",
              "isDisabled",
              "seats",
              "staffPermission",
              {
                projects: ["name"],
              },
            ],
            loggedInUser: ["id"],
          },
        ],
      });

      console.error("[CodecksClient] Root data response:", response);

      const accountId = response._root.account;
      const account = response.account[accountId];
      const userId = response.user[response._root.loggedInUser].id;
      const projectId = account.projects[0];

      return {
        account,
        userId,
        projectId,
      };
    } catch (error) {
      console.error("[CodecksClient] Failed to get root data:", error);
      throw error;
    }
  }

  async getMetadata() {
    if (!this.context.account) {
      throw new Error("Context not initialized - account not available");
    }

    const query = {
      [`account(${this.context.account.id})`]: [
        "effortScale",
        "priorityLabels",
      ],
    };

    const response = await this.request<GetMetadataResponse>(query);

    return response;
  }
}

export default CodecksClient;
