export interface CodecksConfig {
  authToken: string;
  subdomain: string;
}

export function validateConfig(config: CodecksConfig) {
  if (!config.authToken || !config.subdomain) {
    throw new Error("Auth token and subdomain are required");
  }
}
