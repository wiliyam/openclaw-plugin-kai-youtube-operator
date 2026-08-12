import { randomBytes } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { DATA_DIR, DEFAULT_REDIRECT_URI, GOOGLE_OAUTH_URL, GOOGLE_TOKEN_URL, TOKEN_PATH, YOUTUBE_SCOPES } from "./constants.js";
import type { OAuthCapability, OAuthConfig, OAuthEnvironment, StoredToken, YouTubeApiError } from "./types.js";

function getOAuthConfig(env: NodeJS.ProcessEnv = process.env): OAuthConfig {
  return {
    clientId: env.YOUTUBE_CLIENT_ID ?? "",
    clientSecret: env.YOUTUBE_CLIENT_SECRET,
    redirectUri: env.YOUTUBE_REDIRECT_URI ?? DEFAULT_REDIRECT_URI,
  };
}

export function getOAuthEnvironment(env: NodeJS.ProcessEnv = process.env): OAuthEnvironment {
  const config = getOAuthConfig(env);
  return {
    clientIdConfigured: Boolean(config.clientId),
    clientSecretConfigured: Boolean(config.clientSecret),
    redirectUri: config.redirectUri,
  };
}

export function scopesForCapability(capability: OAuthCapability, extraScopes: string[] = []): string[] {
  return [...new Set([...(YOUTUBE_SCOPES[capability] ?? YOUTUBE_SCOPES.readonly), ...extraScopes])];
}

export function createOAuthUrl(params: {
  capability?: OAuthCapability;
  extraScopes?: string[];
  state?: string;
  env?: NodeJS.ProcessEnv;
}) {
  const config = getOAuthConfig(params.env);
  if (!config.clientId) {
    return {
      configured: false,
      error: "YOUTUBE_CLIENT_ID is not configured in the OpenClaw gateway environment.",
      requiredEnv: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YOUTUBE_REDIRECT_URI"],
    };
  }

  const capability = params.capability ?? "live_control";
  const scopes = scopesForCapability(capability, params.extraScopes);
  const state = params.state ?? `kai-youtube-${randomBytes(12).toString("hex")}`;
  const url = new URL(GOOGLE_OAUTH_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);

  return {
    configured: true,
    authUrl: url.toString(),
    redirectUri: config.redirectUri,
    capability,
    scopes,
    state,
    nextStep: "Open the URL, approve access, then copy the one-time code from the redirect URL back to Kai in private chat.",
  };
}

async function ensureDataDir(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true, mode: 0o700 });
}

export async function readStoredToken(): Promise<StoredToken | null> {
  try {
    const raw = await readFile(TOKEN_PATH, "utf8");
    return JSON.parse(raw) as StoredToken;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return null;
    throw error;
  }
}

export async function writeStoredToken(token: StoredToken): Promise<void> {
  await ensureDataDir();
  await writeFile(TOKEN_PATH, `${JSON.stringify(token, null, 2)}\n`, { mode: 0o600 });
  await chmod(TOKEN_PATH, 0o600);
}

export function summarizeToken(token: StoredToken | null, now = Date.now()) {
  if (!token) {
    return {
      present: false,
      hasRefreshToken: false,
      accessTokenValid: false,
      expiresAt: null,
      scopes: [],
    };
  }
  return {
    present: true,
    hasRefreshToken: Boolean(token.refresh_token),
    accessTokenValid: Boolean(token.access_token && token.expiry_date && token.expiry_date > now + 60_000),
    expiresAt: token.expiry_date ? new Date(token.expiry_date).toISOString() : null,
    scopes: token.scope?.split(/\s+/).filter(Boolean) ?? [],
  };
}

function tokenFromResponse(data: Record<string, unknown>, existing: StoredToken | null = null): StoredToken {
  const expiresIn = typeof data.expires_in === "number" ? data.expires_in : 3600;
  return {
    access_token: typeof data.access_token === "string" ? data.access_token : existing?.access_token,
    refresh_token: typeof data.refresh_token === "string" ? data.refresh_token : existing?.refresh_token,
    scope: typeof data.scope === "string" ? data.scope : existing?.scope,
    token_type: typeof data.token_type === "string" ? data.token_type : existing?.token_type,
    expiry_date: Date.now() + Math.max(60, expiresIn - 30) * 1000,
  };
}

export async function parseJsonResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) as Record<string, unknown> : {};
  } catch {
    return { raw: text };
  }
}

export function sanitizeError(data: Record<string, unknown>): string {
  const apiError = data as YouTubeApiError;
  const main = apiError.error?.message;
  const reason = apiError.error?.errors?.map((item) => item.reason).filter(Boolean).join(", ");
  return [main, reason ? `reason: ${reason}` : ""].filter(Boolean).join(" ");
}

export async function exchangeOAuthCode(code: string): Promise<ReturnType<typeof summarizeToken> & { savedTo: string }> {
  const config = getOAuthConfig();
  if (!config.clientId || !config.clientSecret) {
    throw new Error("YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET must be configured before exchanging OAuth codes.");
  }

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: config.redirectUri,
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(`OAuth exchange failed: ${sanitizeError(data) || response.statusText}`);
  }

  const token = tokenFromResponse(data);
  await writeStoredToken(token);
  return {
    ...summarizeToken(token),
    savedTo: TOKEN_PATH,
  };
}

export async function refreshAccessTokenIfNeeded(): Promise<StoredToken> {
  const existing = await readStoredToken();
  if (!existing?.refresh_token) {
    throw new Error("No YouTube OAuth refresh token is saved. Run kai_youtube_oauth_url and kai_youtube_oauth_exchange first.");
  }
  if (existing.access_token && existing.expiry_date && existing.expiry_date > Date.now() + 60_000) {
    return existing;
  }

  const config = getOAuthConfig();
  if (!config.clientId || !config.clientSecret) {
    throw new Error("YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET must be configured to refresh OAuth tokens.");
  }

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: existing.refresh_token,
    grant_type: "refresh_token",
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(`OAuth refresh failed: ${sanitizeError(data) || response.statusText}`);
  }
  const token = tokenFromResponse(data, existing);
  await writeStoredToken(token);
  return token;
}
