export interface CodecksConfig {
  apiToken: string;
  teamId: string;
  apiTimeout: number;
  maxRetries: number;
}

// TODO: Is this validation needed? should the timeout and max retries be set by the user?
export function validateConfig(config: CodecksConfig) {
  if (!config.apiToken || !config.teamId) {
    throw new Error("API token and team ID are required");
  }

  if (config.apiTimeout <= 0) {
    throw new Error("API timeout must be greater than 0");
  }

  if (config.maxRetries <= 0) {
    throw new Error("Max retries must be greater than 0");
  }
}
