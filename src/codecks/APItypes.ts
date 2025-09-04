import {
  CodecksApiAccount,
  CodecksApiCard,
  CodecksApiProject,
} from "./entities.js";

export type RootData = {
  account: CodecksApiAccount;
  userId: string;
  projectId: string;
};

export type GetRootDataResponse = {
  _root: {
    account: string;
    loggedInUser: string;
  };
  account: Record<string, CodecksApiAccount>;
  user: Record<string, { id: string }>;
  project: Record<string, CodecksApiProject>;
};

export type CodecksMetadata = {
  id: string;
  effortScale: number[];
  priorityLabels: Record<string, string>;
};

export type GetMetadataResponse = {
  _root: { account: string };
  account: Record<
    string,
    {
      id: string;
      effortScale: number[];
      priorityLabels: Record<string, string>;
    }
  >;
};

export type getDecksResponse = {
  _root: { account: string };
  account: Record<string, { decks: string[] }>;
  deck: Record<string, { title: string; id: string; accountId: string }>;
};

export type getCardResponse = {
  _root: { account: string };
  account: Record<string, { id: string } & Record<string, string[]>>;
  card: Record<string, CodecksApiCard>;
};

export type listCardsResponse = {
  _root: { account: string };
  account: Record<string, { id: string } & Record<string, string[]>>;
  card: Record<string, CodecksApiCard>;
};

export type createCardResponse = {
  payload: {
    id: string;
  };
  actionId: string;
};

export type updateCardResponse = {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  assigneeId?: string;
  priority?: string;
};

export type getSpacesResponse = {
  project: Record<
    string,
    {
      spaces: Array<{
        id: number;
        name: string | null;
        defaultAllowedCardTypes: string[];
      }>;
      id: string;
    }
  >;
};
