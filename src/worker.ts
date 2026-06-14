import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import CodecksClient from "./codecks/client.js";
import { CodecksConfig, validateConfig } from "./validations/config.js";
import { ProjectTools } from "./tools/ProjectTools.js";
import { DeckTools } from "./tools/DeckTools.js";
import { CardTools } from "./tools/CardTools.js";
import { MilestoneTools } from "./tools/MilestoneTools.js";
import { ExploreTools } from "./tools/ExploreTools.js";

interface Env {
  CODECKS_AUTH_TOKEN: string;
  CODECKS_SUBDOMAIN: string;
  MCP_BEARER_TOKEN: string;
}

// ---------------------------------------------------------------------------
// Custom transport — bridges a single Web Request/Response to McpServer
// ---------------------------------------------------------------------------

class SingleRequestTransport implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  private _incoming: JSONRPCMessage;
  private _resolve!: (msg: JSONRPCMessage) => void;
  private _reject!: (err: Error) => void;
  readonly responsePromise: Promise<JSONRPCMessage>;

  constructor(incoming: JSONRPCMessage) {
    this._incoming = incoming;
    this.responsePromise = new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }

  async start(): Promise<void> {
    this.onmessage?.(this._incoming);
  }

  async send(message: JSONRPCMessage): Promise<void> {
    this._resolve(message);
  }

  async close(): Promise<void> {
    this.onclose?.();
  }
}

function buildServer(client: CodecksClient): McpServer {
  const server = new McpServer({ name: "codecks-mcp", version: "1.0.0" });
  new ProjectTools(server, client).register();
  new DeckTools(server, client).register();
  new CardTools(server, client).register();
  new MilestoneTools(server, client).register();
  new ExploreTools(server, client).register();
  return server;
}

// ---------------------------------------------------------------------------
// Crypto helpers (Web Crypto API — available in Workers)
// ---------------------------------------------------------------------------

async function hmacSign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return base64url(new Uint8Array(sig));
}

async function hmacVerify(payload: string, sig: string, secret: string): Promise<boolean> {
  const expected = await hmacSign(payload, secret);
  return expected === sig;
}

async function sha256(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return base64url(new Uint8Array(digest));
}

function base64url(buf: Uint8Array): string {
  return btoa(String.fromCharCode(...buf))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// ---------------------------------------------------------------------------
// OAuth — minimal authorization code + PKCE flow (stateless, no KV needed)
//
// Code structure: base64url(JSON payload) + "." + HMAC signature
// The payload carries everything needed to validate at /token time.
// ---------------------------------------------------------------------------

interface CodePayload {
  cc: string;  // code_challenge (base64url SHA-256 of verifier)
  st: string;  // state
  ru: string;  // redirect_uri
  ex: number;  // expiry unix seconds
}

async function makeCode(payload: CodePayload, secret: string): Promise<string> {
  const p = base64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await hmacSign(p, secret);
  return `${p}.${sig}`;
}

async function verifyCode(
  code: string,
  codeVerifier: string,
  secret: string,
): Promise<CodePayload | null> {
  const [p, sig] = code.split(".");
  if (!p || !sig) return null;
  if (!(await hmacVerify(p, sig, secret))) return null;

  let payload: CodePayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(
      Uint8Array.from(atob(p.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)),
    ));
  } catch {
    return null;
  }

  if (Date.now() / 1000 > payload.ex) return null;

  // PKCE: SHA-256(code_verifier) must equal code_challenge
  if (payload.cc) {
    const hash = await sha256(codeVerifier);
    if (hash !== payload.cc) return null;
  }

  return payload;
}

// ---------------------------------------------------------------------------
// OAuth endpoints
// ---------------------------------------------------------------------------

function oauthMetadata(baseUrl: string) {
  return {
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/oauth/authorize`,
    token_endpoint: `${baseUrl}/oauth/token`,
    registration_endpoint: `${baseUrl}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
  };
}

function authorizeForm(params: URLSearchParams, error?: string): Response {
  const qs = params.toString();
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Codecks MCP — Authorize</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:420px;margin:80px auto;padding:0 20px;color:#1a1a1a}
  h1{font-size:1.3rem;margin-bottom:4px}
  p{color:#555;font-size:.9rem;margin-top:0}
  input{width:100%;padding:10px;font-size:1rem;border:1px solid #ccc;border-radius:6px;box-sizing:border-box}
  button{margin-top:12px;width:100%;padding:10px;background:#0066cc;color:#fff;border:none;border-radius:6px;font-size:1rem;cursor:pointer}
  .err{color:#c00;font-size:.9rem;margin-top:8px}
</style>
</head>
<body>
<h1>Codecks MCP</h1>
<p>Enter your MCP bearer token to authorize Claude.</p>
<form method="POST" action="/oauth/authorize?${qs}">
  <input type="password" name="token" placeholder="Bearer token" autofocus required>
  <button type="submit">Authorize</button>
  ${error ? `<p class="err">${error}</p>` : ""}
</form>
</body>
</html>`;
  return new Response(html, { headers: { "Content-Type": "text/html" } });
}

async function handleOAuth(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const base = `${url.protocol}//${url.host}`;

  // Discovery
  if (url.pathname === "/.well-known/oauth-authorization-server") {
    return json(oauthMetadata(base));
  }
  if (url.pathname === "/.well-known/oauth-protected-resource") {
    return json({
      resource: `${base}/`,
      authorization_servers: [base],
    });
  }

  // Dynamic client registration — accept any client, return static id
  if (url.pathname === "/oauth/register" && request.method === "POST") {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    return json({
      client_id: "codecks-mcp-client",
      client_secret_expires_at: 0,
      redirect_uris: body.redirect_uris ?? [],
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }, 201);
  }

  // Authorization endpoint
  if (url.pathname === "/oauth/authorize") {
    const params = url.searchParams;
    if (request.method === "GET") {
      return authorizeForm(params);
    }
    if (request.method === "POST") {
      const formData = await request.formData();
      const token = formData.get("token")?.toString() ?? "";
      if (token !== env.MCP_BEARER_TOKEN) {
        return authorizeForm(params, "Invalid token. Try again.");
      }
      const redirectUri = params.get("redirect_uri") ?? "";
      const state = params.get("state") ?? "";
      const codeChallenge = params.get("code_challenge") ?? "";

      const payload: CodePayload = {
        cc: codeChallenge,
        st: state,
        ru: redirectUri,
        ex: Math.floor(Date.now() / 1000) + 300, // 5 min expiry
      };
      const code = await makeCode(payload, env.MCP_BEARER_TOKEN);

      const redirect = new URL(redirectUri);
      redirect.searchParams.set("code", code);
      if (state) redirect.searchParams.set("state", state);
      return Response.redirect(redirect.toString(), 302);
    }
  }

  // Token endpoint
  if (url.pathname === "/oauth/token" && request.method === "POST") {
    const formData = await request.formData();
    const code = formData.get("code")?.toString() ?? "";
    const codeVerifier = formData.get("code_verifier")?.toString() ?? "";

    const payload = await verifyCode(code, codeVerifier, env.MCP_BEARER_TOKEN);
    if (!payload) {
      return json({ error: "invalid_grant" }, 400);
    }

    return json({
      access_token: env.MCP_BEARER_TOKEN,
      token_type: "bearer",
      expires_in: 3600 * 24 * 365, // 1 year
    });
  }

  return null; // not an OAuth route
}

// ---------------------------------------------------------------------------
// MCP handler
// ---------------------------------------------------------------------------

async function handleMcp(request: Request, env: Env): Promise<Response> {
  const auth = request.headers.get("Authorization") ?? "";
  if (auth !== `Bearer ${env.MCP_BEARER_TOKEN}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const config: CodecksConfig = {
    authToken: env.CODECKS_AUTH_TOKEN,
    subdomain: env.CODECKS_SUBDOMAIN,
  };
  validateConfig(config);

  let body: JSONRPCMessage;
  try {
    body = (await request.json()) as JSONRPCMessage;
  } catch {
    return errorResponse(null, -32700, "Parse error");
  }

  // Notifications (no id) need no response
  if ((body as { id?: unknown }).id === undefined) {
    return new Response(null, { status: 202 });
  }

  const client = new CodecksClient(config);
  await client.initializeContext();

  const server = buildServer(client);
  const transport = new SingleRequestTransport(body);

  try {
    await server.connect(transport);
    const response = await transport.responsePromise;
    return new Response(JSON.stringify(response), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return errorResponse((body as { id?: unknown }).id ?? null, -32603, msg);
  } finally {
    await server.close();
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const oauthResponse = await handleOAuth(request, env);
    if (oauthResponse) return oauthResponse;
    return handleMcp(request, env);
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(id: unknown, code: number, message: string): Response {
  return json({ jsonrpc: "2.0", id, error: { code, message } });
}
