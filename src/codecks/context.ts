import { CodecksAccount, CodecksUser } from "./entities.js";

export class CodecksContext {
  private _account: CodecksAccount | null = null;
  private _userId: string | null = null;
  private _projectId: string | null = null;

  initialize(account: CodecksAccount, userId: string, projectId: string): void {
    this._account = account;
    this._userId = userId;
    this._projectId = projectId;
  }

  get account(): CodecksAccount | null {
    return this._account;
  }

  get userId(): string | null {
    return this._userId;
  }

  get projectId(): string | null {
    return this._projectId;
  }

  isInitialized(): boolean {
    return this._account !== null;
  }
}
