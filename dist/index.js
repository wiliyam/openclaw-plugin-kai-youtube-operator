import { randomBytes } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { Type } from "typebox";
import { defineToolPlugin } from "openclaw/plugin-sdk/tool-plugin";
const DATA_DIR = path.join(homedir(), "Kai", "youtube");
const TOKEN_PATH = path.join(DATA_DIR, "oauth-token.json");
const DEFAULT_REDIRECT_URI = "http://127.0.0.1:53682/oauth2callback";
const GOOGLE_OAUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3";
export const YOUTUBE_SCOPES = {
    readonly: [
        "https://www.googleapis.com/auth/youtube.readonly",
    ],
    upload: [
        "https://www.googleapis.com/auth/youtube.upload",
    ],
    live_control: [
        "https://www.googleapis.com/auth/youtube.force-ssl",
    ],
    analytics: [
        "https://www.googleapis.com/auth/youtube.readonly",
        "https://www.googleapis.com/auth/yt-analytics.readonly",
    ],
    full_channel: [
        "https://www.googleapis.com/auth/youtube",
        "https://www.googleapis.com/auth/youtube.force-ssl",
        "https://www.googleapis.com/auth/youtube.upload",
        "https://www.googleapis.com/auth/yt-analytics.readonly",
    ],
};
const APPROVAL_ACTIONS = [
    "creating or updating live broadcasts",
    "transitioning a broadcast to testing, live, or complete",
    "changing privacy or scheduled times",
    "sending public live chat messages",
    "deleting or moderating live chat messages",
    "uploading or publishing videos",
];
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
async function readStoredToken() {
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
async function writeStoredToken(token) {
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
async function parseJsonResponse(response) {
    const text = await response.text();
    try {
        return text ? JSON.parse(text) : {};
    }
    catch {
        return { raw: text };
    }
}
function sanitizeError(data) {
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
async function refreshAccessTokenIfNeeded() {
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
function queryString(query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
        if (value !== undefined)
            params.set(key, String(value));
    }
    return params.toString();
}
async function youtubeRequest(method, resourcePath, query = {}, body) {
    const token = await refreshAccessTokenIfNeeded();
    const qs = queryString(query);
    const url = `${YOUTUBE_API_URL}/${resourcePath}${qs ? `?${qs}` : ""}`;
    const response = await fetch(url, {
        method,
        headers: {
            authorization: `Bearer ${token.access_token}`,
            ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(stripUndefined(body)),
    });
    const data = await parseJsonResponse(response);
    if (!response.ok) {
        throw new Error(`YouTube API request failed: ${sanitizeError(data) || response.statusText}`);
    }
    return redactSensitive(data);
}
export function stripUndefined(value) {
    if (Array.isArray(value))
        return value.map((item) => stripUndefined(item));
    if (!value || typeof value !== "object")
        return value;
    const entries = Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, stripUndefined(item)]);
    return Object.fromEntries(entries);
}
export function redactSensitive(value) {
    if (Array.isArray(value))
        return value.map((item) => redactSensitive(item));
    if (!value || typeof value !== "object")
        return value;
    const secretKeys = new Set([
        "access_token",
        "refresh_token",
        "client_secret",
        "streamName",
        "ingestionAddress",
        "backupIngestionAddress",
    ]);
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
        key,
        secretKeys.has(key) ? "[redacted]" : redactSensitive(item),
    ]));
}
export function approvalGate(approved, action) {
    if (approved)
        return { ok: true };
    return {
        ok: false,
        blocked: true,
        approvalRequired: true,
        action,
        message: `Explicit approval is required before ${action}. Call this tool again with approved: true only after the user approves the exact action.`,
        approvalActions: APPROVAL_ACTIONS,
    };
}
export function buildLivePlan(params) {
    const needsApproval = params.goal !== "status_check";
    return {
        goal: params.goal,
        title: params.title ?? null,
        plan: [
            "Confirm the authorized channel and intended broadcast.",
            "Use private or unlisted privacy for rehearsals.",
            "Verify title, description, scheduled time, privacy, audience setting, and stream health.",
            needsApproval
                ? "Stop before changing YouTube state and ask for explicit approval of the exact action."
                : "Read status only; do not change YouTube state.",
        ],
        approvalRequiredBefore: needsApproval ? APPROVAL_ACTIONS : [],
        notes: params.notes ?? "No extra notes supplied.",
    };
}
export function buildCreateBroadcastBody(params) {
    return stripUndefined({
        snippet: {
            title: params.title,
            description: params.description,
            scheduledStartTime: params.scheduledStartTime,
            scheduledEndTime: params.scheduledEndTime,
        },
        status: {
            privacyStatus: params.privacyStatus ?? "private",
            selfDeclaredMadeForKids: params.selfDeclaredMadeForKids ?? false,
        },
        contentDetails: {
            enableAutoStart: params.enableAutoStart,
            enableAutoStop: params.enableAutoStop,
            enableDvr: params.enableDvr ?? true,
            recordFromStart: params.recordFromStart ?? true,
            monitorStream: {
                enableMonitorStream: params.enableMonitorStream ?? true,
                broadcastStreamDelayMs: params.broadcastStreamDelayMs,
            },
        },
    });
}
async function getBroadcastById(id) {
    const result = await youtubeRequest("GET", "liveBroadcasts", {
        part: "id,snippet,status,contentDetails",
        id,
    });
    const item = result.items?.[0];
    if (!item)
        throw new Error(`No live broadcast found for id ${id}.`);
    return item;
}
function mergeBroadcastUpdate(existing, params) {
    const snippet = existing.snippet;
    const status = existing.status;
    const contentDetails = existing.contentDetails;
    return stripUndefined({
        id: existing.id,
        snippet: {
            ...snippet,
            title: params.title ?? snippet?.title,
            description: params.description ?? snippet?.description,
            scheduledStartTime: params.scheduledStartTime ?? snippet?.scheduledStartTime,
            scheduledEndTime: params.scheduledEndTime ?? snippet?.scheduledEndTime,
        },
        status: {
            ...status,
            privacyStatus: params.privacyStatus ?? status?.privacyStatus,
            selfDeclaredMadeForKids: params.selfDeclaredMadeForKids ?? status?.selfDeclaredMadeForKids,
        },
        contentDetails: {
            ...contentDetails,
            enableAutoStart: params.enableAutoStart ?? contentDetails?.enableAutoStart,
            enableAutoStop: params.enableAutoStop ?? contentDetails?.enableAutoStop,
            enableDvr: params.enableDvr ?? contentDetails?.enableDvr,
            recordFromStart: params.recordFromStart ?? contentDetails?.recordFromStart,
        },
    });
}
const CapabilitySchema = Type.Union([
    Type.Literal("readonly"),
    Type.Literal("upload"),
    Type.Literal("live_control"),
    Type.Literal("analytics"),
    Type.Literal("full_channel"),
]);
const PrivacySchema = Type.Union([
    Type.Literal("private"),
    Type.Literal("unlisted"),
    Type.Literal("public"),
]);
const BroadcastStatusSchema = Type.Union([
    Type.Literal("active"),
    Type.Literal("all"),
    Type.Literal("completed"),
    Type.Literal("upcoming"),
]);
const TransitionSchema = Type.Union([
    Type.Literal("testing"),
    Type.Literal("live"),
    Type.Literal("complete"),
]);
export default defineToolPlugin({
    id: "kai-youtube-operator",
    name: "Kai YouTube Operator",
    description: "Safe YouTube channel, OAuth, live broadcast, and live chat tools for Kai.",
    tools: (tool) => [
        tool({
            name: "kai_youtube_setup_status",
            description: "Check YouTube OAuth environment and saved token status without revealing secrets.",
            parameters: Type.Object({}),
            execute: async () => ({
                environment: getOAuthEnvironment(),
                token: summarizeToken(await readStoredToken()),
                tokenPath: TOKEN_PATH,
                requiredEnv: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YOUTUBE_REDIRECT_URI"],
                recommendedChannelRole: "Use a separate Google account invited as YouTube Editor or Editor (limited), not Owner.",
            }),
        }),
        tool({
            name: "kai_youtube_oauth_url",
            description: "Generate a Google OAuth consent URL for YouTube access.",
            parameters: Type.Object({
                capability: Type.Optional(CapabilitySchema),
                extraScopes: Type.Optional(Type.Array(Type.String())),
                state: Type.Optional(Type.String()),
            }),
            execute: async (params) => createOAuthUrl(params),
        }),
        tool({
            name: "kai_youtube_oauth_exchange",
            description: "Exchange a one-time Google OAuth code and save YouTube tokens privately.",
            parameters: Type.Object({
                code: Type.String({ description: "One-time authorization code copied from the Google redirect URL." }),
            }),
            execute: async ({ code }) => exchangeOAuthCode(code),
        }),
        tool({
            name: "kai_youtube_channel_overview",
            description: "Read the authorized YouTube channel overview.",
            parameters: Type.Object({}),
            execute: async () => youtubeRequest("GET", "channels", {
                part: "id,snippet,statistics,status,contentDetails",
                mine: true,
            }),
        }),
        tool({
            name: "kai_youtube_live_plan",
            description: "Generate a safe plan for YouTube live-stream management.",
            parameters: Type.Object({
                goal: Type.Union([
                    Type.Literal("schedule"),
                    Type.Literal("update"),
                    Type.Literal("go_live"),
                    Type.Literal("end_live"),
                    Type.Literal("chat_moderation"),
                    Type.Literal("status_check"),
                ]),
                title: Type.Optional(Type.String()),
                notes: Type.Optional(Type.String()),
            }),
            execute: async (params) => buildLivePlan(params),
        }),
        tool({
            name: "kai_youtube_live_broadcasts",
            description: "List YouTube live broadcasts for the authorized channel.",
            parameters: Type.Object({
                broadcastStatus: Type.Optional(BroadcastStatusSchema),
                maxResults: Type.Optional(Type.Number()),
            }),
            execute: async ({ broadcastStatus = "upcoming", maxResults = 10 }) => youtubeRequest("GET", "liveBroadcasts", {
                part: "id,snippet,status,contentDetails",
                broadcastStatus,
                maxResults,
            }),
        }),
        tool({
            name: "kai_youtube_live_create_broadcast",
            description: "Create a YouTube live broadcast after explicit user approval.",
            parameters: Type.Object({
                approved: Type.Optional(Type.Boolean()),
                title: Type.String(),
                description: Type.Optional(Type.String()),
                scheduledStartTime: Type.String(),
                scheduledEndTime: Type.Optional(Type.String()),
                privacyStatus: Type.Optional(PrivacySchema),
                selfDeclaredMadeForKids: Type.Optional(Type.Boolean()),
                enableAutoStart: Type.Optional(Type.Boolean()),
                enableAutoStop: Type.Optional(Type.Boolean()),
                enableDvr: Type.Optional(Type.Boolean()),
                recordFromStart: Type.Optional(Type.Boolean()),
                enableMonitorStream: Type.Optional(Type.Boolean()),
                broadcastStreamDelayMs: Type.Optional(Type.Number()),
            }),
            execute: async (params) => {
                const gate = approvalGate(params.approved, `creating live broadcast "${params.title}"`);
                if (!gate.ok)
                    return gate;
                return youtubeRequest("POST", "liveBroadcasts", {
                    part: "snippet,status,contentDetails",
                }, buildCreateBroadcastBody(params));
            },
        }),
        tool({
            name: "kai_youtube_live_update_broadcast",
            description: "Update a YouTube live broadcast after explicit user approval.",
            parameters: Type.Object({
                approved: Type.Optional(Type.Boolean()),
                id: Type.String(),
                title: Type.Optional(Type.String()),
                description: Type.Optional(Type.String()),
                scheduledStartTime: Type.Optional(Type.String()),
                scheduledEndTime: Type.Optional(Type.String()),
                privacyStatus: Type.Optional(PrivacySchema),
                selfDeclaredMadeForKids: Type.Optional(Type.Boolean()),
                enableAutoStart: Type.Optional(Type.Boolean()),
                enableAutoStop: Type.Optional(Type.Boolean()),
                enableDvr: Type.Optional(Type.Boolean()),
                recordFromStart: Type.Optional(Type.Boolean()),
            }),
            execute: async (params) => {
                const gate = approvalGate(params.approved, `updating live broadcast ${params.id}`);
                if (!gate.ok)
                    return gate;
                const existing = await getBroadcastById(params.id);
                return youtubeRequest("PUT", "liveBroadcasts", {
                    part: "snippet,status,contentDetails",
                }, mergeBroadcastUpdate(existing, params));
            },
        }),
        tool({
            name: "kai_youtube_live_transition",
            description: "Transition a YouTube live broadcast to testing, live, or complete after explicit user approval.",
            parameters: Type.Object({
                approved: Type.Optional(Type.Boolean()),
                id: Type.String(),
                broadcastStatus: TransitionSchema,
            }),
            execute: async ({ approved, id, broadcastStatus }) => {
                const gate = approvalGate(approved, `transitioning live broadcast ${id} to ${broadcastStatus}`);
                if (!gate.ok)
                    return gate;
                return youtubeRequest("POST", "liveBroadcasts/transition", {
                    id,
                    broadcastStatus,
                    part: "id,snippet,status",
                });
            },
        }),
        tool({
            name: "kai_youtube_live_chat_messages",
            description: "Read messages from a YouTube live chat.",
            parameters: Type.Object({
                liveChatId: Type.String(),
                maxResults: Type.Optional(Type.Number()),
                pageToken: Type.Optional(Type.String()),
            }),
            execute: async ({ liveChatId, maxResults = 50, pageToken }) => youtubeRequest("GET", "liveChat/messages", {
                part: "id,snippet,authorDetails",
                liveChatId,
                maxResults,
                pageToken,
            }),
        }),
        tool({
            name: "kai_youtube_live_chat_send",
            description: "Send a YouTube live chat text message after explicit user approval.",
            parameters: Type.Object({
                approved: Type.Optional(Type.Boolean()),
                liveChatId: Type.String(),
                messageText: Type.String(),
            }),
            execute: async ({ approved, liveChatId, messageText }) => {
                const gate = approvalGate(approved, `sending a public live chat message to ${liveChatId}`);
                if (!gate.ok)
                    return gate;
                return youtubeRequest("POST", "liveChat/messages", {
                    part: "snippet",
                }, {
                    snippet: {
                        liveChatId,
                        type: "textMessageEvent",
                        textMessageDetails: {
                            messageText,
                        },
                    },
                });
            },
        }),
        tool({
            name: "kai_youtube_live_chat_delete",
            description: "Delete a YouTube live chat message after explicit user approval.",
            parameters: Type.Object({
                approved: Type.Optional(Type.Boolean()),
                id: Type.String(),
            }),
            execute: async ({ approved, id }) => {
                const gate = approvalGate(approved, `deleting live chat message ${id}`);
                if (!gate.ok)
                    return gate;
                return youtubeRequest("DELETE", "liveChat/messages", { id });
            },
        }),
    ],
});
