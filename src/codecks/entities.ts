// ============================================================================
// Codecks API Response Types (as returned by the Codecks API)
// ============================================================================

export const CardType = ["hero", "task", "doc"] as const;
export const CardStatus = ["not_started", "done"] as const;
export const CardVisibility = ["default", "archived"] as const;

export type CardType = (typeof CardType)[number];
export type CardStatus = (typeof CardStatus)[number];
export type CardVisibility = (typeof CardVisibility)[number];

export type CodecksApiAccount = {
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

export type CodecksApiProject = {
  id: string;
  name: string;
  accountId: string;
};

export type CodecksApiCard = {
  cardId: string;
  title: string;
  content?: string;
  visibility?: string;
  isDoc?: boolean;
  status?: string;
  derivedStatus?: string;
  lastUpdatedAt?: string;
  countAttachments?: number;
  hasBlockingDeps?: boolean;
  meta?: any;
  dueDate?: string;
  masterTags?: string[];
  effort?: number;
  priority?: string;
  accountSeq?: number;
  checkboxStats?: any;
  assigneeId?: string;
  deckId?: string;
  accountId: string;
  // Additional fields from actual API
  sessionId?: string;
  subscribeCreator?: boolean;
  putInQueue?: boolean;
  addAsBookmark?: boolean;
  milestoneId?: string | null;
  sprintId?: string | null;
  attachments?: any[];
  childCards?: string[];
  inDeps?: string[];
  outDeps?: string[];
  parentCardId?: string | null;
  userId?: string;
  fakeCoverFileId?: string | null;
};

// ============================================================================
// MCP Representation Types (as returned by our MCP tools)
// ============================================================================

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

export type CodecksDeck = {
  id: string;
  name: string;
};

export type CodecksSpace = {
  id: number;
  name: string | null;
  defaultAllowedCardTypes: string[];
};

export type CodecksCard = {
  id: string;
  title: string;
  description?: string;
  content?: string;
  type: CardType;
  status?: CardStatus;
  assigneeId?: string;
  priority?: string;
  deckId?: string;
  visibility?: string;
  derivedStatus?: string;
  lastUpdatedAt?: string;
  countAttachments?: number;
  hasBlockingDeps?: boolean;
  meta?: any;
  dueDate?: string;
  masterTags?: string[];
  effort?: number;
  accountSeq?: number;
  checkboxStats?: any;
  isDoc?: boolean;
  subscribeCreator?: boolean;
  putInQueue?: boolean;
  addAsBookmark?: boolean;
  milestoneId?: string | null;
  sprintId?: string | null;
  attachments?: any[];
  childCards?: string[];
  inDeps?: string[];
  outDeps?: string[];
  parentCardId?: string | null;
  userId?: string;
  fakeCoverFileId?: string | null;
};
