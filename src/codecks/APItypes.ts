import { CodecksAccount, CodecksProject } from "./entities.js";

export type RootData = {
  account: CodecksAccount;
  userId: string;
  projectId: string;
};

export type GetRootDataResponse = {
  _root: {
    account: string;
    loggedInUser: string;
  };
  account: Record<string, CodecksAccount>;
  user: Record<string, { id: string }>;
  project: Record<string, CodecksProject>;
};

export type getDecksResponse = {
  _root: { account: string };
  account: Record<string, { decks: string[] }>;
  deck: Record<string, { title: string; id: string; accountId: string }>;
};

export type getCardResponse = {
  _root: { account: string };
  account: Record<string, { id: string } & Record<string, string[]>>;
  card: Record<string, { title: string; cardId: string; account: string }>;
};

export type listCardsResponse = {
  _root: { account: string };
  account: Record<string, { id: string } & Record<string, string[]>>;
  card: Record<
    string,
    {
      title: string;
      cardId: string;
      account: string;
    }
  >;
};

export type createCardResponse = {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  assigneeId?: string;
  priority?: string;
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
