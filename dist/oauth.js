import { randomBytes } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { DATA_DIR, DEFAULT_REDIRECT_URI, GOOGLE_OAUTH_URL, GOOGLE_TOKEN_URL, TOKEN_PATH, YOUTUBE_SCOPES } from "./constants.js";
function getOAuthConfig(env = process.env) {
    return {
        clientId: env.YOUTUBE_CLIENT_ID ?? "",
        clientSecret: env.YOUTUBE_CLIENT_SECRET,
        redirectUri: env.YOUTUBE_REDIRECT_URI ?? DEFAULT_REDIRECT_URI,
    };
}
export function getOAuthEnvironment(env = process.env) {
    const config = getOAuthConfig(env);
    return {
        clientIdConfigured: Boolean(config.clientId),
        clientSecretConfigured: Boolean(config.clientSecret),
        redirectUri: config.redirectUri,
    };
}
export function scopesForCapability(capability, extraScopes = []) {
    return [...new Set([...(YOUTUBE_SCOPES[capability] ?? YOUTUBE_SCOPES.readonly), ...extraScopes])];
}
export function createOAuthUrl(params) {
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
async function ensureDataDir() {
    await mkdir(DATA_DIR, { recursive: true, mode: 0o700 });
}
export async function readStoredToken() {
    try {
        const raw = await readFile(TOKEN_PATH, "utf8");
        return JSON.parse(raw);
    }
    catch (error) {
        const code = error.code;
        if (code === "ENOENT")
            return null;
        throw error;
    }
}
export async function writeStoredToken(token) {
    await ensureDataDir();
    await writeFile(TOKEN_PATH, `${JSON.stringify(token, null, 2)}\n`, { mode: 0o600 });
    await chmod(TOKEN_PATH, 0o600);
}
export function summarizeToken(token, now = Date.now()) {
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
function tokenFromResponse(data, existing = null) {
    const expiresIn = typeof data.expires_in === "number" ? data.expires_in : 3600;
    return {
        access_token: typeof data.access_token === "string" ? data.access_token : existing?.access_token,
        refresh_token: typeof data.refresh_token === "string" ? data.refresh_token : existing?.refresh_token,
        scope: typeof data.scope === "string" ? data.scope : existing?.scope,
        token_type: typeof data.token_type === "string" ? data.token_type : existing?.token_type,
        expiry_date: Date.now() + Math.max(60, expiresIn - 30) * 1000,
    };
}
export async function parseJsonResponse(response) {
    const text = await response.text();
    try {
        return text ? JSON.parse(text) : {};
    }
    catch {
        return { raw: text };
    }
}
export function sanitizeError(data) {
    const apiError = data;
    const main = apiError.error?.message;
    const reason = apiError.error?.errors?.map((item) => item.reason).filter(Boolean).join(", ");
    return [main, reason ? `reason: ${reason}` : ""].filter(Boolean).join(" ");
}
export async function exchangeOAuthCode(code) {
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
export async function refreshAccessTokenIfNeeded() {
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
