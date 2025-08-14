export type CodecksAccount = {
  id: string;
  name: string;
  subdomain: string;
  activeProjectCount?: number;
  billingEmail?: string;
  billingName?: string;
  createdAt?: string;
  isDisabled?: boolean;
  seats?: number;
  staffPermission?: string;
  projects: string[];
};

export type CodecksUser = {
  id: string;
  name: string;
  email?: string;
  sessionId?: string;
  fullName?: string;
  cdxRole?: string;
  createdAt?: string;
  timezone?: string;
};

export type CodecksProject = {
  id: string;
  name: string;
  accountId: string;
};

export type CodecksDeck = {
  id: string;
  name: string;
};

export type CodecksCard = {
  id: string;
  title: string;
  description?: string;
  type: "hero" | "task" | "doc";
  status: "open" | "done" | "archived";
  assigneeId?: string;
  priority?: "low" | "medium" | "high";
  deckId: string;
};
