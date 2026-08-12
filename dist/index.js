import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { chmod, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { Type } from "typebox";
import { defineToolPlugin } from "openclaw/plugin-sdk/tool-plugin";
import { buildManagerBrief, buildProductionChecklist, buildUploadPacketFromContent, createApprovalRequest, MANAGER_STATE_PATH, readManagerState, resolveApprovalRequest, triageComments, upsertAnalyticsPreset, upsertAsset, upsertBrandKit, upsertContentItem, writeManagerState, } from "./manager.js";
export { buildManagerBrief, buildProductionChecklist, buildUploadPacketFromContent, createApprovalRequest, createDefaultManagerState, resolveApprovalRequest, triageComments, upsertBrandKit, upsertContentItem, } from "./manager.js";
const DATA_DIR = path.join(homedir(), "Kai", "youtube");
const TOKEN_PATH = path.join(DATA_DIR, "oauth-token.json");
const DEFAULT_REDIRECT_URI = "http://127.0.0.1:53682/oauth2callback";
const GOOGLE_OAUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3";
const YOUTUBE_UPLOAD_API_URL = "https://www.googleapis.com/upload/youtube/v3";
const YOUTUBE_ANALYTICS_API_URL = "https://youtubeanalytics.googleapis.com/v2";
const MAX_SIMPLE_UPLOAD_BYTES = 512 * 1024 * 1024;
const DEFAULT_SHORTS_DIR = path.join(DATA_DIR, "shorts");
const MAX_SHORT_DURATION_SECONDS = 180;
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
    monetary_analytics: [
        "https://www.googleapis.com/auth/youtube.readonly",
        "https://www.googleapis.com/auth/yt-analytics.readonly",
        "https://www.googleapis.com/auth/yt-analytics-monetary.readonly",
    ],
    full_channel: [
        "https://www.googleapis.com/auth/youtube",
        "https://www.googleapis.com/auth/youtube.force-ssl",
        "https://www.googleapis.com/auth/youtube.upload",
        "https://www.googleapis.com/auth/yt-analytics.readonly",
        "https://www.googleapis.com/auth/yt-analytics-monetary.readonly",
    ],
};
const APPROVAL_ACTIONS = [
    "updating channel branding or profile metadata",
    "creating, updating, uploading, publishing, or deleting videos",
    "making a video public",
    "setting thumbnails or caption files",
    "creating, updating, or deleting playlists",
    "adding, moving, or deleting playlist items",
    "creating, updating, moderating, or deleting comments",
    "creating or updating live broadcasts",
    "binding, creating, updating, or deleting live streams",
    "transitioning a broadcast to testing, live, or complete",
    "changing privacy or scheduled times",
    "sending public live chat messages",
    "deleting or moderating live chat messages, bans, or moderators",
    "reporting videos or rating videos from the authorized account",
];
const SUPPORTED_DATA_API_PATHS = new Set([
    "activities",
    "captions",
    "channels",
    "channelBanners/insert",
    "channelSections",
    "comments",
    "comments/setModerationStatus",
    "commentThreads",
    "guideCategories",
    "i18nLanguages",
    "i18nRegions",
    "liveBroadcasts",
    "liveBroadcasts/bind",
    "liveBroadcasts/cuepoint",
    "liveBroadcasts/transition",
    "liveChat/bans",
    "liveChat/messages",
    "liveChat/moderators",
    "liveStreams",
    "members",
    "membershipsLevels",
    "playlistItems",
    "playlists",
    "search",
    "subscriptions",
    "superChatEvents",
    "videoAbuseReportReasons",
    "videoCategories",
    "videos",
    "videos/getRating",
    "videos/rate",
    "videos/reportAbuse",
    "watermarks/unset",
]);
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
async function authorizedJsonRequest(baseUrl, method, resourcePath, query = {}, body) {
    const token = await refreshAccessTokenIfNeeded();
    const qs = queryString(query);
    const url = `${baseUrl}/${resourcePath}${qs ? `?${qs}` : ""}`;
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
async function youtubeRequest(method, resourcePath, query = {}, body) {
    return authorizedJsonRequest(YOUTUBE_API_URL, method, resourcePath, query, body);
}
async function youtubeAnalyticsRequest(query) {
    return authorizedJsonRequest(YOUTUBE_ANALYTICS_API_URL, "GET", "reports", query);
}
async function youtubeMediaUploadRequest(params) {
    const fileInfo = await stat(params.filePath);
    if (fileInfo.size > MAX_SIMPLE_UPLOAD_BYTES) {
        throw new Error(`File is ${fileInfo.size} bytes. This plugin supports simple uploads up to ${MAX_SIMPLE_UPLOAD_BYTES} bytes; use YouTube Studio or a resumable uploader for larger files.`);
    }
    const token = await refreshAccessTokenIfNeeded();
    const qs = queryString({ ...(params.query ?? {}), uploadType: "media" });
    const url = `${YOUTUBE_UPLOAD_API_URL}/${params.resourcePath}${qs ? `?${qs}` : ""}`;
    const response = await fetch(url, {
        method: params.method,
        headers: {
            authorization: `Bearer ${token.access_token}`,
            "content-type": params.mimeType ?? inferMimeType(params.filePath),
        },
        body: await readFile(params.filePath),
    });
    const data = await parseJsonResponse(response);
    if (!response.ok) {
        throw new Error(`YouTube upload failed: ${sanitizeError(data) || response.statusText}`);
    }
    return redactSensitive(data);
}
async function youtubeMultipartUploadRequest(params) {
    const token = await refreshAccessTokenIfNeeded();
    const boundary = `kai-youtube-${randomBytes(12).toString("hex")}`;
    const metadata = Buffer.from(JSON.stringify(stripUndefined(params.metadata)), "utf8");
    const media = Buffer.isBuffer(params.mediaContent)
        ? params.mediaContent
        : Buffer.from(params.mediaContent, "utf8");
    if (media.byteLength > MAX_SIMPLE_UPLOAD_BYTES) {
        throw new Error(`Media is ${media.byteLength} bytes. This plugin supports simple uploads up to ${MAX_SIMPLE_UPLOAD_BYTES} bytes; use YouTube Studio or a resumable uploader for larger files.`);
    }
    const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n`, "utf8"),
        metadata,
        Buffer.from(`\r\n--${boundary}\r\ncontent-type: ${params.mimeType}\r\n\r\n`, "utf8"),
        media,
        Buffer.from(`\r\n--${boundary}--\r\n`, "utf8"),
    ]);
    const qs = queryString({ ...(params.query ?? {}), uploadType: "multipart" });
    const url = `${YOUTUBE_UPLOAD_API_URL}/${params.resourcePath}${qs ? `?${qs}` : ""}`;
    const response = await fetch(url, {
        method: params.method,
        headers: {
            authorization: `Bearer ${token.access_token}`,
            "content-type": `multipart/related; boundary=${boundary}`,
        },
        body,
    });
    const data = await parseJsonResponse(response);
    if (!response.ok) {
        throw new Error(`YouTube multipart upload failed: ${sanitizeError(data) || response.statusText}`);
    }
    return redactSensitive(data);
}
async function youtubeCaptionDownload(params) {
    const token = await refreshAccessTokenIfNeeded();
    const qs = queryString({
        tfmt: params.tfmt,
        tlang: params.tlang,
    });
    const url = `${YOUTUBE_API_URL}/captions/${encodeURIComponent(params.id)}${qs ? `?${qs}` : ""}`;
    const response = await fetch(url, {
        headers: {
            authorization: `Bearer ${token.access_token}`,
        },
    });
    const text = await response.text();
    if (!response.ok) {
        let parsed = {};
        try {
            parsed = text ? JSON.parse(text) : {};
        }
        catch {
            parsed = { raw: text };
        }
        throw new Error(`Caption download failed: ${sanitizeError(parsed) || response.statusText}`);
    }
    const maxCharacters = params.maxCharacters ?? 20_000;
    return {
        id: params.id,
        contentType: response.headers.get("content-type"),
        truncated: text.length > maxCharacters,
        content: text.slice(0, maxCharacters),
    };
}
export function assertAllowedDataApiPath(resourcePath) {
    if (!/^[A-Za-z]+(?:\/[A-Za-z]+)?$/.test(resourcePath) || !SUPPORTED_DATA_API_PATHS.has(resourcePath)) {
        throw new Error(`Unsupported YouTube Data API path: ${resourcePath}`);
    }
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
        "clientSecret",
        "streamKey",
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
function inferMimeType(filePath) {
    const extension = path.extname(filePath).toLowerCase();
    if (extension === ".jpg" || extension === ".jpeg")
        return "image/jpeg";
    if (extension === ".png")
        return "image/png";
    if (extension === ".webp")
        return "image/webp";
    if (extension === ".gif")
        return "image/gif";
    if (extension === ".mp4" || extension === ".m4v")
        return "video/mp4";
    if (extension === ".mov")
        return "video/quicktime";
    if (extension === ".webm")
        return "video/webm";
    if (extension === ".srt")
        return "application/x-subrip";
    if (extension === ".vtt")
        return "text/vtt";
    return "application/octet-stream";
}
function limitOutput(value, maxCharacters = 12_000) {
    return value.length > maxCharacters ? value.slice(-maxCharacters) : value;
}
function runCommand(command, args, timeoutMs = 15 * 60_000) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            stdio: ["ignore", "pipe", "pipe"],
        });
        let stdout = "";
        let stderr = "";
        const timeout = setTimeout(() => {
            child.kill("SIGTERM");
            reject(new Error(`${command} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stdout.on("data", (chunk) => {
            stdout = limitOutput(stdout + chunk);
        });
        child.stderr.on("data", (chunk) => {
            stderr = limitOutput(stderr + chunk);
        });
        child.on("error", (error) => {
            clearTimeout(timeout);
            reject(error);
        });
        child.on("close", (code) => {
            clearTimeout(timeout);
            const result = { command, args, stdout, stderr };
            if (code === 0) {
                resolve(result);
                return;
            }
            reject(new Error(`${command} exited with code ${code}: ${stderr || stdout}`));
        });
    });
}
async function assertFileExists(filePath) {
    await stat(filePath);
}
async function prepareOutputFile(outputPath, overwrite) {
    await mkdir(path.dirname(outputPath), { recursive: true });
    if (overwrite)
        return;
    try {
        await stat(outputPath);
        throw new Error(`Output file already exists: ${outputPath}. Use overwrite: true or choose a new path.`);
    }
    catch (error) {
        if (error.code === "ENOENT")
            return;
        throw error;
    }
}
function formatSeconds(value) {
    if (!Number.isFinite(value) || value <= 0) {
        throw new Error("durationSeconds must be a positive number.");
    }
    return String(Math.round(value * 1000) / 1000);
}
function validateShortDuration(durationSeconds) {
    if (durationSeconds > MAX_SHORT_DURATION_SECONDS) {
        throw new Error(`durationSeconds must be ${MAX_SHORT_DURATION_SECONDS} seconds or less for short creation.`);
    }
}
function escapeFilterText(value) {
    return value
        .replace(/\\/g, "\\\\")
        .replace(/:/g, "\\:")
        .replace(/'/g, "\\'")
        .replace(/%/g, "\\%")
        .replace(/\n/g, "\\n");
}
function escapeFilterPath(value) {
    return value
        .replace(/\\/g, "\\\\")
        .replace(/:/g, "\\:")
        .replace(/'/g, "\\'");
}
function aspectFilter(aspect, fit) {
    if (aspect === "source")
        return null;
    const [width, height] = aspect === "square_1_1" ? [1080, 1080] : [1080, 1920];
    if (fit === "pad") {
        return `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`;
    }
    return `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
}
function textOverlayFilter(params) {
    const fontFile = params.fontFile ? `:fontfile='${escapeFilterPath(params.fontFile)}'` : "";
    const common = `${fontFile}:fontcolor=white:fontsize=h/20:borderw=4:bordercolor=black@0.75:x=(w-text_w)/2`;
    return [
        params.topText
            ? `drawtext=text='${escapeFilterText(params.topText)}'${common}:y=h*0.08`
            : null,
        params.bottomText
            ? `drawtext=text='${escapeFilterText(params.bottomText)}'${common}:y=h-text_h-h*0.09`
            : null,
    ].filter((value) => Boolean(value));
}
export function buildShortCreateArgs(params) {
    const durationSeconds = params.durationSeconds ?? 60;
    validateShortDuration(durationSeconds);
    const filters = [
        aspectFilter(params.aspect ?? "vertical_9_16", params.fit ?? "crop"),
        ...textOverlayFilter(params),
        params.captionFilePath ? `subtitles='${escapeFilterPath(params.captionFilePath)}'` : null,
    ].filter((value) => Boolean(value));
    return [
        "-hide_banner",
        params.overwrite ? "-y" : "-n",
        ...(params.startTime ? ["-ss", params.startTime] : []),
        "-i",
        params.inputPath,
        "-t",
        formatSeconds(durationSeconds),
        ...(filters.length ? ["-vf", filters.join(",")] : []),
        "-map",
        "0:v:0",
        "-c:v",
        "libx264",
        "-preset",
        params.preset ?? "veryfast",
        "-crf",
        String(params.crf ?? 23),
        "-pix_fmt",
        "yuv420p",
        ...(params.removeAudio ? ["-an"] : ["-map", "0:a?", "-c:a", "aac", "-b:a", "128k"]),
        "-movflags",
        "+faststart",
        params.outputPath,
    ];
}
export function buildThumbnailExtractArgs(params) {
    const width = params.width ?? 1280;
    const height = params.height ?? 720;
    return [
        "-hide_banner",
        params.overwrite ? "-y" : "-n",
        "-ss",
        params.time ?? "00:00:01",
        "-i",
        params.inputPath,
        "-frames:v",
        "1",
        "-vf",
        `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`,
        params.outputPath,
    ];
}
async function probeVideo(filePath) {
    await assertFileExists(filePath);
    const result = await runCommand("ffprobe", [
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        filePath,
    ], 60_000);
    try {
        return JSON.parse(result.stdout);
    }
    catch {
        return {
            raw: result.stdout,
            stderr: result.stderr,
        };
    }
}
async function createShortFromVideo(params) {
    await assertFileExists(params.inputPath);
    if (params.captionFilePath)
        await assertFileExists(params.captionFilePath);
    if (params.fontFile)
        await assertFileExists(params.fontFile);
    await prepareOutputFile(params.outputPath, params.overwrite);
    const args = buildShortCreateArgs(params);
    const result = await runCommand("ffmpeg", args);
    const output = await stat(params.outputPath);
    return {
        inputPath: params.inputPath,
        outputPath: params.outputPath,
        bytes: output.size,
        durationSeconds: params.durationSeconds ?? 60,
        aspect: params.aspect ?? "vertical_9_16",
        fit: params.fit ?? "crop",
        ffmpeg: {
            command: result.command,
            args: result.args,
            stderr: result.stderr,
        },
    };
}
async function extractThumbnail(params) {
    await assertFileExists(params.inputPath);
    await prepareOutputFile(params.outputPath, params.overwrite);
    const args = buildThumbnailExtractArgs(params);
    const result = await runCommand("ffmpeg", args, 120_000);
    const output = await stat(params.outputPath);
    return {
        inputPath: params.inputPath,
        outputPath: params.outputPath,
        bytes: output.size,
        time: params.time ?? "00:00:01",
        ffmpeg: {
            command: result.command,
            args: result.args,
            stderr: result.stderr,
        },
    };
}
function defaultShortOutputPath(inputPath) {
    const parsed = path.parse(inputPath);
    const suffix = randomBytes(4).toString("hex");
    return path.join(DEFAULT_SHORTS_DIR, `${parsed.name}-short-${suffix}.mp4`);
}
function safeFfmpegColor(value, fallback) {
    const color = value ?? fallback;
    if (!/^[A-Za-z0-9#@._-]+$/.test(color)) {
        throw new Error(`Unsafe ffmpeg color value: ${color}`);
    }
    return color;
}
export function buildThumbnailGenerateArgs(params) {
    const width = params.width ?? 1280;
    const height = params.height ?? 720;
    const backgroundColor = safeFfmpegColor(params.backgroundColor, "#111827");
    const fontFile = params.fontFile ? `:fontfile='${escapeFilterPath(params.fontFile)}'` : "";
    const filters = [
        params.inputPath
            ? `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`
            : null,
        "format=yuv420p",
        params.title
            ? `drawtext=text='${escapeFilterText(params.title)}'${fontFile}:fontcolor=white:fontsize=h/10:borderw=6:bordercolor=black@0.8:x=(w-text_w)/2:y=h*0.40-text_h`
            : null,
        params.subtitle
            ? `drawtext=text='${escapeFilterText(params.subtitle)}'${fontFile}:fontcolor=white:fontsize=h/24:borderw=3:bordercolor=black@0.65:x=(w-text_w)/2:y=h*0.55`
            : null,
        params.badge
            ? `drawtext=text='${escapeFilterText(params.badge)}'${fontFile}:fontcolor=black:fontsize=h/28:box=1:boxcolor=white@0.92:boxborderw=18:x=w-text_w-w*0.08:y=h*0.08`
            : null,
    ].filter((value) => Boolean(value));
    return [
        "-hide_banner",
        params.overwrite ? "-y" : "-n",
        ...(params.inputPath
            ? [
                ...(params.time ? ["-ss", params.time] : []),
                "-i",
                params.inputPath,
            ]
            : [
                "-f",
                "lavfi",
                "-i",
                `color=c=${backgroundColor}:s=${width}x${height}:d=1`,
            ]),
        "-frames:v",
        "1",
        "-vf",
        filters.join(","),
        params.outputPath,
    ];
}
async function generateThumbnailCard(params) {
    if (params.inputPath)
        await assertFileExists(params.inputPath);
    if (params.fontFile)
        await assertFileExists(params.fontFile);
    await prepareOutputFile(params.outputPath, params.overwrite);
    const args = buildThumbnailGenerateArgs(params);
    const result = await runCommand("ffmpeg", args, 120_000);
    const output = await stat(params.outputPath);
    return {
        inputPath: params.inputPath ?? null,
        outputPath: params.outputPath,
        bytes: output.size,
        width: params.width ?? 1280,
        height: params.height ?? 720,
        ffmpeg: {
            command: result.command,
            args: result.args,
            stderr: result.stderr,
        },
    };
}
function generatedAudioFilter(style, durationSeconds) {
    const duration = formatSeconds(durationSeconds);
    if (style === "silence")
        return `anullsrc=channel_layout=stereo:sample_rate=44100:d=${duration}`;
    if (style === "white_noise")
        return `anoisesrc=color=white:duration=${duration}:amplitude=0.05`;
    if (style === "clean_tone")
        return `sine=frequency=440:duration=${duration}:sample_rate=44100`;
    if (style === "soft_pulse") {
        return `sine=frequency=176:duration=${duration}:sample_rate=44100,volume=0.20,tremolo=f=2:d=0.45`;
    }
    return `sine=frequency=196:duration=${duration}:sample_rate=44100,volume=0.18,aecho=0.8:0.9:700:0.25,afade=t=in:st=0:d=1,afade=t=out:st=${Math.max(0, durationSeconds - 1)}:d=1`;
}
export function buildGeneratedAudioArgs(params) {
    const style = params.style ?? "ambient_pad";
    const volume = params.volume ?? 0.35;
    const extension = path.extname(params.outputPath).toLowerCase();
    const codec = extension === ".mp3" ? "libmp3lame" : extension === ".wav" ? "pcm_s16le" : "aac";
    return [
        "-hide_banner",
        params.overwrite ? "-y" : "-n",
        "-f",
        "lavfi",
        "-i",
        generatedAudioFilter(style, params.durationSeconds),
        "-filter:a",
        `volume=${volume}`,
        "-c:a",
        codec,
        params.outputPath,
    ];
}
async function generateFreeAudioBed(params) {
    await prepareOutputFile(params.outputPath, params.overwrite);
    const args = buildGeneratedAudioArgs(params);
    const result = await runCommand("ffmpeg", args, 120_000);
    const output = await stat(params.outputPath);
    return {
        outputPath: params.outputPath,
        bytes: output.size,
        durationSeconds: params.durationSeconds,
        style: params.style ?? "ambient_pad",
        license: "Generated locally from ffmpeg audio filters; no third-party copyrighted track is included.",
        ffmpeg: {
            command: result.command,
            args: result.args,
            stderr: result.stderr,
        },
    };
}
export function buildAudioMixArgs(params) {
    const mode = params.mode ?? "mix";
    const originalVolume = params.originalVolume ?? (mode === "duck" ? 0.25 : 1);
    const addedVolume = params.addedVolume ?? 1;
    const common = [
        "-hide_banner",
        params.overwrite ? "-y" : "-n",
        "-i",
        params.inputPath,
        "-i",
        params.audioPath,
        "-map",
        "0:v:0",
    ];
    if (mode === "replace") {
        return [
            ...common,
            "-map",
            "1:a:0",
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-shortest",
            "-movflags",
            "+faststart",
            params.outputPath,
        ];
    }
    return [
        ...common,
        "-filter_complex",
        `[0:a]volume=${originalVolume}[base];[1:a]volume=${addedVolume}[add];[base][add]amix=inputs=2:duration=first:dropout_transition=2[aout]`,
        "-map",
        "[aout]",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-shortest",
        "-movflags",
        "+faststart",
        params.outputPath,
    ];
}
async function addAudioToVideo(params) {
    await assertFileExists(params.inputPath);
    await assertFileExists(params.audioPath);
    await prepareOutputFile(params.outputPath, params.overwrite);
    const args = buildAudioMixArgs(params);
    const result = await runCommand("ffmpeg", args);
    const output = await stat(params.outputPath);
    return {
        inputPath: params.inputPath,
        audioPath: params.audioPath,
        outputPath: params.outputPath,
        mode: params.mode ?? "mix",
        bytes: output.size,
        ffmpeg: {
            command: result.command,
            args: result.args,
            stderr: result.stderr,
        },
    };
}
export function buildVoiceoverArgs(params) {
    return [
        "-w",
        params.outputPath,
        "-v",
        params.voice ?? "en",
        "-s",
        String(params.speedWpm ?? 165),
        "-p",
        String(params.pitch ?? 50),
        params.text,
    ];
}
async function createVoiceover(params) {
    await prepareOutputFile(params.outputPath, params.overwrite);
    const result = await runCommand("espeak-ng", buildVoiceoverArgs(params), 120_000);
    const output = await stat(params.outputPath);
    return {
        outputPath: params.outputPath,
        bytes: output.size,
        voice: params.voice ?? "en",
        speedWpm: params.speedWpm ?? 165,
        pitch: params.pitch ?? 50,
        engine: "espeak-ng",
        note: "Install espeak-ng on the OpenClaw server to use this tool.",
        command: {
            command: result.command,
            args: result.args.slice(0, -1).concat("[text redacted from command echo]"),
            stderr: result.stderr,
        },
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
async function getVideoById(id) {
    const result = await youtubeRequest("GET", "videos", {
        part: "id,snippet,status,recordingDetails,localizations",
        id,
    });
    const item = result.items?.[0];
    if (!item)
        throw new Error(`No video found for id ${id}.`);
    return item;
}
export function buildVideoUpdateBody(existing, params) {
    const snippet = existing.snippet;
    const status = existing.status;
    const recordingDetails = existing.recordingDetails;
    const existingLocation = recordingDetails?.location;
    const parts = new Set();
    const body = { id: existing.id };
    const hasSnippetUpdate = [
        params.title,
        params.description,
        params.tags,
        params.categoryId,
        params.defaultLanguage,
        params.defaultAudioLanguage,
    ].some((value) => value !== undefined);
    if (hasSnippetUpdate) {
        parts.add("snippet");
        body.snippet = stripUndefined({
            title: params.title ?? snippet?.title,
            description: params.description ?? snippet?.description,
            tags: params.tags ?? snippet?.tags,
            categoryId: params.categoryId ?? snippet?.categoryId,
            defaultLanguage: params.defaultLanguage ?? snippet?.defaultLanguage,
            defaultAudioLanguage: params.defaultAudioLanguage ?? snippet?.defaultAudioLanguage,
        });
    }
    const hasStatusUpdate = [
        params.privacyStatus,
        params.publishAt,
        params.embeddable,
        params.license,
        params.publicStatsViewable,
        params.selfDeclaredMadeForKids,
    ].some((value) => value !== undefined);
    if (hasStatusUpdate) {
        parts.add("status");
        body.status = stripUndefined({
            privacyStatus: params.privacyStatus ?? status?.privacyStatus,
            publishAt: params.publishAt ?? status?.publishAt,
            embeddable: params.embeddable ?? status?.embeddable,
            license: params.license ?? status?.license,
            publicStatsViewable: params.publicStatsViewable ?? status?.publicStatsViewable,
            selfDeclaredMadeForKids: params.selfDeclaredMadeForKids ?? status?.selfDeclaredMadeForKids,
        });
    }
    const hasRecordingUpdate = [
        params.recordingDate,
        params.locationDescription,
        params.latitude,
        params.longitude,
        params.altitude,
    ].some((value) => value !== undefined);
    if (hasRecordingUpdate) {
        parts.add("recordingDetails");
        body.recordingDetails = stripUndefined({
            recordingDate: params.recordingDate ?? recordingDetails?.recordingDate,
            locationDescription: params.locationDescription ?? recordingDetails?.locationDescription,
            location: {
                latitude: params.latitude ?? existingLocation?.latitude,
                longitude: params.longitude ?? existingLocation?.longitude,
                altitude: params.altitude ?? existingLocation?.altitude,
            },
        });
    }
    if (params.localizations !== undefined) {
        parts.add("localizations");
        body.localizations = params.localizations;
    }
    if (parts.size === 0) {
        throw new Error("No video metadata updates were provided.");
    }
    return {
        part: [...parts].join(","),
        body: stripUndefined(body),
    };
}
function buildVideoInsertBody(params) {
    const hasRecordingDetails = [
        params.recordingDate,
        params.locationDescription,
        params.latitude,
        params.longitude,
        params.altitude,
    ].some((value) => value !== undefined);
    return {
        part: hasRecordingDetails ? "snippet,status,recordingDetails" : "snippet,status",
        body: stripUndefined({
            snippet: {
                title: params.title,
                description: params.description,
                tags: params.tags,
                categoryId: params.categoryId,
                defaultLanguage: params.defaultLanguage,
                defaultAudioLanguage: params.defaultAudioLanguage,
            },
            status: {
                privacyStatus: params.privacyStatus ?? "private",
                publishAt: params.publishAt,
                embeddable: params.embeddable,
                license: params.license,
                publicStatsViewable: params.publicStatsViewable,
                selfDeclaredMadeForKids: params.selfDeclaredMadeForKids ?? false,
            },
            recordingDetails: hasRecordingDetails ? {
                recordingDate: params.recordingDate,
                locationDescription: params.locationDescription,
                location: {
                    latitude: params.latitude,
                    longitude: params.longitude,
                    altitude: params.altitude,
                },
            } : undefined,
        }),
    };
}
async function getChannelForBrandingUpdate() {
    const result = await youtubeRequest("GET", "channels", {
        part: "id,brandingSettings",
        mine: true,
    });
    const item = result.items?.[0];
    if (!item)
        throw new Error("No authorized channel found.");
    return item;
}
function buildChannelBrandingUpdateBody(existing, params) {
    const brandingSettings = existing.brandingSettings;
    const channel = brandingSettings?.channel;
    return stripUndefined({
        id: existing.id,
        brandingSettings: {
            ...brandingSettings,
            channel: {
                ...channel,
                title: params.title ?? channel?.title,
                description: params.description ?? channel?.description,
                keywords: params.keywords ?? channel?.keywords,
                country: params.country ?? channel?.country,
                defaultLanguage: params.defaultLanguage ?? channel?.defaultLanguage,
                trackingAnalyticsAccountId: params.trackingAnalyticsAccountId ?? channel?.trackingAnalyticsAccountId,
                unsubscribedTrailer: params.unsubscribedTrailer ?? channel?.unsubscribedTrailer,
            },
        },
    });
}
async function getPlaylistById(id) {
    const result = await youtubeRequest("GET", "playlists", {
        part: "id,snippet,status,contentDetails",
        id,
    });
    const item = result.items?.[0];
    if (!item)
        throw new Error(`No playlist found for id ${id}.`);
    return item;
}
function buildPlaylistBody(params) {
    return stripUndefined({
        snippet: {
            title: params.title,
            description: params.description,
            tags: params.tags,
            defaultLanguage: params.defaultLanguage,
        },
        status: {
            privacyStatus: params.privacyStatus ?? "private",
        },
    });
}
function mergePlaylistUpdate(existing, params) {
    const snippet = existing.snippet;
    const status = existing.status;
    return stripUndefined({
        id: existing.id,
        snippet: {
            ...snippet,
            title: params.title ?? snippet?.title,
            description: params.description ?? snippet?.description,
            tags: params.tags ?? snippet?.tags,
            defaultLanguage: params.defaultLanguage ?? snippet?.defaultLanguage,
        },
        status: {
            ...status,
            privacyStatus: params.privacyStatus ?? status?.privacyStatus,
        },
    });
}
async function getPlaylistItemById(id) {
    const result = await youtubeRequest("GET", "playlistItems", {
        part: "id,snippet,contentDetails,status",
        id,
    });
    const item = result.items?.[0];
    if (!item)
        throw new Error(`No playlist item found for id ${id}.`);
    return item;
}
function buildPlaylistItemUpdate(existing, params) {
    const snippet = existing.snippet;
    const resourceId = snippet?.resourceId;
    return stripUndefined({
        id: existing.id,
        snippet: {
            ...snippet,
            playlistId: params.playlistId ?? snippet?.playlistId,
            resourceId: {
                kind: "youtube#video",
                videoId: params.videoId ?? resourceId?.videoId,
            },
            position: params.position ?? snippet?.position,
            note: params.note ?? snippet?.note,
        },
    });
}
async function getLiveStreamById(id) {
    const result = await youtubeRequest("GET", "liveStreams", {
        part: "id,snippet,cdn,status,contentDetails",
        id,
    });
    const item = result.items?.[0];
    if (!item)
        throw new Error(`No live stream found for id ${id}.`);
    return item;
}
function buildLiveStreamBody(params) {
    return stripUndefined({
        snippet: {
            title: params.title,
            description: params.description,
        },
        cdn: {
            ingestionType: params.ingestionType ?? "rtmp",
            resolution: params.resolution ?? "variable",
            frameRate: params.frameRate ?? "variable",
        },
        contentDetails: {
            isReusable: params.isReusable ?? true,
        },
    });
}
function mergeLiveStreamUpdate(existing, params) {
    const snippet = existing.snippet;
    return stripUndefined({
        id: existing.id,
        snippet: {
            ...snippet,
            title: params.title ?? snippet?.title,
            description: params.description ?? snippet?.description,
        },
        cdn: existing.cdn,
        contentDetails: existing.contentDetails,
    });
}
export function studioCapabilities() {
    return {
        apiBacked: [
            "OAuth setup and token refresh",
            "Channel overview and branding metadata updates",
            "Video search, listing, metadata/status updates, simple uploads, ratings, abuse reports, thumbnails, and deletes",
            "Public upload and public publish convenience tools with approval gates",
            "Local short-video creation, thumbnail generation, synthetic audio beds, audio mixing, and voiceovers using ffmpeg/ffprobe/espeak-ng",
            "Playlist and playlist item create/read/update/delete",
            "Comment thread reading, commenting, replies, updates, moderation, and deletes",
            "Caption list, download, text upload/update, and delete",
            "Analytics and monetary analytics reports when the OAuth scopes and channel eligibility allow it",
            "Live broadcast schedule/update/delete/bind/transition/cuepoint",
            "Live stream create/list/update/delete and stream health reads",
            "Live chat reads, sends, deletes, bans, unbans, moderators, and Super Chat event reads",
            "Members, membership levels, subscriptions, categories, regions, languages, and abuse-report reasons",
            "A guarded generic YouTube Data API request for allowlisted official endpoints",
        ],
        notApiBacked: [
            "Some YouTube Studio-only screens, channel monetization setup, copyright dispute workflows, advanced dashboard UI controls, and browser-only account/security settings may not have public API coverage.",
            "Large video uploads should use YouTube Studio or a resumable uploader; this plugin intentionally supports simple uploads only.",
            "Voiceover creation requires espeak-ng to be installed on the OpenClaw server.",
        ],
        safety: [
            "Read actions can run directly after OAuth.",
            "Write, publish, delete, moderate, upload, and live-state actions require approved: true after explicit user approval.",
            "Tokens, stream keys, and client secrets are redacted from tool output.",
        ],
    };
}
const CapabilitySchema = Type.Union([
    Type.Literal("readonly"),
    Type.Literal("upload"),
    Type.Literal("live_control"),
    Type.Literal("analytics"),
    Type.Literal("monetary_analytics"),
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
const RequestMethodSchema = Type.Union([
    Type.Literal("GET"),
    Type.Literal("POST"),
    Type.Literal("PUT"),
    Type.Literal("DELETE"),
]);
const QuerySchema = Type.Optional(Type.Record(Type.String(), Type.Union([
    Type.String(),
    Type.Number(),
    Type.Boolean(),
])));
const JsonObjectSchema = Type.Record(Type.String(), Type.Any());
const OptionalJsonObjectSchema = Type.Optional(JsonObjectSchema);
const LicenseSchema = Type.Union([
    Type.Literal("creativeCommon"),
    Type.Literal("youtube"),
]);
const LiveStreamIngestionSchema = Type.Union([
    Type.Literal("dash"),
    Type.Literal("hls"),
    Type.Literal("rtmp"),
]);
const CommentModerationStatusSchema = Type.Union([
    Type.Literal("heldForReview"),
    Type.Literal("published"),
    Type.Literal("rejected"),
]);
const LiveChatBanTypeSchema = Type.Union([
    Type.Literal("temporary"),
    Type.Literal("permanent"),
]);
const ShortAspectSchema = Type.Union([
    Type.Literal("source"),
    Type.Literal("vertical_9_16"),
    Type.Literal("square_1_1"),
]);
const ShortFitSchema = Type.Union([
    Type.Literal("crop"),
    Type.Literal("pad"),
]);
const AudioMixModeSchema = Type.Union([
    Type.Literal("replace"),
    Type.Literal("mix"),
    Type.Literal("duck"),
]);
const GeneratedAudioStyleSchema = Type.Union([
    Type.Literal("ambient_pad"),
    Type.Literal("soft_pulse"),
    Type.Literal("clean_tone"),
    Type.Literal("white_noise"),
    Type.Literal("silence"),
]);
const ContentFormatSchema = Type.Union([
    Type.Literal("short"),
    Type.Literal("long"),
    Type.Literal("live"),
    Type.Literal("community"),
    Type.Literal("clip"),
]);
const ContentStatusSchema = Type.Union([
    Type.Literal("idea"),
    Type.Literal("script"),
    Type.Literal("recording"),
    Type.Literal("editing"),
    Type.Literal("review"),
    Type.Literal("ready"),
    Type.Literal("scheduled"),
    Type.Literal("published"),
    Type.Literal("archived"),
]);
const AssetTypeSchema = Type.Union([
    Type.Literal("video"),
    Type.Literal("thumbnail"),
    Type.Literal("audio"),
    Type.Literal("voiceover"),
    Type.Literal("caption"),
    Type.Literal("script"),
    Type.Literal("export"),
    Type.Literal("other"),
]);
const ApprovalResolutionSchema = Type.Union([
    Type.Literal("approved"),
    Type.Literal("rejected"),
    Type.Literal("cancelled"),
]);
export default defineToolPlugin({
    id: "kai-youtube-operator",
    name: "Kai YouTube Operator",
    description: "Safe YouTube Studio, channel, video, OAuth, live broadcast, and live chat tools for Kai.",
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
            name: "kai_youtube_studio_capabilities",
            description: "List what YouTube Studio work this plugin can do through official APIs and where manual Studio is still needed.",
            parameters: Type.Object({}),
            execute: async () => studioCapabilities(),
        }),
        tool({
            name: "kai_youtube_manager_status",
            description: "Read Kai's local channel-manager state summary.",
            parameters: Type.Object({}),
            execute: async () => {
                const state = await readManagerState();
                return {
                    statePath: MANAGER_STATE_PATH,
                    brief: buildManagerBrief(state),
                };
            },
        }),
        tool({
            name: "kai_youtube_brand_kit_get",
            description: "Read Kai's saved channel brand kit.",
            parameters: Type.Object({}),
            execute: async () => (await readManagerState()).brandKit,
        }),
        tool({
            name: "kai_youtube_brand_kit_update",
            description: "Update Kai's local channel brand kit and upload defaults.",
            parameters: Type.Object({
                channelName: Type.Optional(Type.String()),
                voice: Type.Optional(Type.String()),
                audience: Type.Optional(Type.String()),
                styleNotes: Type.Optional(Type.Array(Type.String())),
                defaultHashtags: Type.Optional(Type.Array(Type.String())),
                defaultTags: Type.Optional(Type.Array(Type.String())),
                titlePatterns: Type.Optional(Type.Array(Type.String())),
                thumbnailRules: Type.Optional(Type.Array(Type.String())),
                descriptionTemplate: Type.Optional(Type.String()),
                pinnedCommentTemplate: Type.Optional(Type.String()),
                uploadDefaults: Type.Optional(Type.Object({
                    privacyStatus: Type.Optional(PrivacySchema),
                    categoryId: Type.Optional(Type.String()),
                    defaultLanguage: Type.Optional(Type.String()),
                    defaultAudioLanguage: Type.Optional(Type.String()),
                    license: Type.Optional(LicenseSchema),
                    embeddable: Type.Optional(Type.Boolean()),
                    publicStatsViewable: Type.Optional(Type.Boolean()),
                    selfDeclaredMadeForKids: Type.Optional(Type.Boolean()),
                })),
            }),
            execute: async (params) => {
                const state = await readManagerState();
                const next = upsertBrandKit(state, params);
                await writeManagerState(next);
                return next.brandKit;
            },
        }),
        tool({
            name: "kai_youtube_content_calendar_list",
            description: "List Kai's local content calendar items with optional status/format filters.",
            parameters: Type.Object({
                status: Type.Optional(ContentStatusSchema),
                format: Type.Optional(ContentFormatSchema),
                limit: Type.Optional(Type.Number()),
            }),
            execute: async ({ status, format, limit = 50 }) => {
                const state = await readManagerState();
                return state.contentItems
                    .filter((item) => !status || item.status === status)
                    .filter((item) => !format || item.format === format)
                    .slice(0, limit);
            },
        }),
        tool({
            name: "kai_youtube_content_calendar_upsert",
            description: "Create or update a local content calendar item.",
            parameters: Type.Object({
                id: Type.Optional(Type.String()),
                title: Type.Optional(Type.String()),
                format: Type.Optional(ContentFormatSchema),
                status: Type.Optional(ContentStatusSchema),
                summary: Type.Optional(Type.String()),
                scheduledFor: Type.Optional(Type.String()),
                playlistUrl: Type.Optional(Type.String()),
                tags: Type.Optional(Type.Array(Type.String())),
                sourcePaths: Type.Optional(Type.Array(Type.String())),
                outputPaths: Type.Optional(Type.Array(Type.String())),
                thumbnailPath: Type.Optional(Type.String()),
                scriptPath: Type.Optional(Type.String()),
                captionPath: Type.Optional(Type.String()),
                audioPath: Type.Optional(Type.String()),
                voiceoverPath: Type.Optional(Type.String()),
                videoId: Type.Optional(Type.String()),
                liveBroadcastId: Type.Optional(Type.String()),
                notes: Type.Optional(Type.String()),
            }),
            execute: async (params) => {
                const state = await readManagerState();
                const result = upsertContentItem(state, params);
                await writeManagerState(result.state);
                return result.item;
            },
        }),
        tool({
            name: "kai_youtube_asset_library_list",
            description: "List Kai's local asset library with optional content/type filters.",
            parameters: Type.Object({
                contentId: Type.Optional(Type.String()),
                type: Type.Optional(AssetTypeSchema),
                limit: Type.Optional(Type.Number()),
            }),
            execute: async ({ contentId, type, limit = 50 }) => {
                const state = await readManagerState();
                return state.assets
                    .filter((asset) => !contentId || asset.contentId === contentId)
                    .filter((asset) => !type || asset.type === type)
                    .slice(0, limit);
            },
        }),
        tool({
            name: "kai_youtube_asset_register",
            description: "Register a local script, video, thumbnail, caption, audio, voiceover, or export asset.",
            parameters: Type.Object({
                id: Type.Optional(Type.String()),
                type: Type.Optional(AssetTypeSchema),
                path: Type.String(),
                title: Type.Optional(Type.String()),
                contentId: Type.Optional(Type.String()),
                status: Type.Optional(Type.Union([
                    Type.Literal("available"),
                    Type.Literal("draft"),
                    Type.Literal("final"),
                    Type.Literal("archived"),
                ])),
                notes: Type.Optional(Type.String()),
            }),
            execute: async (params) => {
                const state = await readManagerState();
                const result = upsertAsset(state, params);
                await writeManagerState(result.state);
                return result.asset;
            },
        }),
        tool({
            name: "kai_youtube_upload_packet_build",
            description: "Build a YouTube upload packet from a saved content item and brand kit.",
            parameters: Type.Object({
                contentId: Type.String(),
                title: Type.Optional(Type.String()),
                titleVariants: Type.Optional(Type.Array(Type.String())),
                description: Type.Optional(Type.String()),
                tags: Type.Optional(Type.Array(Type.String())),
                filePath: Type.Optional(Type.String()),
                thumbnailPath: Type.Optional(Type.String()),
                privacyStatus: Type.Optional(PrivacySchema),
                categoryId: Type.Optional(Type.String()),
                pinnedComment: Type.Optional(Type.String()),
            }),
            execute: async ({ contentId, ...overrides }) => buildUploadPacketFromContent(await readManagerState(), contentId, overrides),
        }),
        tool({
            name: "kai_youtube_approval_request",
            description: "Create a local approval request for a future channel action.",
            parameters: Type.Object({
                id: Type.Optional(Type.String()),
                action: Type.String(),
                targetType: Type.String(),
                targetId: Type.Optional(Type.String()),
                summary: Type.String(),
                notes: Type.Optional(Type.String()),
            }),
            execute: async (params) => {
                const state = await readManagerState();
                const result = createApprovalRequest(state, params);
                await writeManagerState(result.state);
                return result.request;
            },
        }),
        tool({
            name: "kai_youtube_approval_resolve",
            description: "Resolve a local approval request after the owner approves, rejects, or cancels it.",
            parameters: Type.Object({
                id: Type.String(),
                status: ApprovalResolutionSchema,
                actor: Type.Optional(Type.String()),
                notes: Type.Optional(Type.String()),
            }),
            execute: async ({ id, status, actor, notes }) => {
                const state = await readManagerState();
                const result = resolveApprovalRequest(state, id, status, actor ?? "owner", undefined, notes);
                await writeManagerState(result.state);
                return result.request;
            },
        }),
        tool({
            name: "kai_youtube_audit_log",
            description: "Read Kai's local YouTube manager audit log.",
            parameters: Type.Object({
                limit: Type.Optional(Type.Number()),
            }),
            execute: async ({ limit = 50 }) => (await readManagerState()).auditLog.slice(-limit).reverse(),
        }),
        tool({
            name: "kai_youtube_comment_triage_plan",
            description: "Triage comment text locally using saved channel-manager moderation rules.",
            parameters: Type.Object({
                comments: Type.Array(Type.Object({
                    id: Type.String(),
                    author: Type.Optional(Type.String()),
                    text: Type.String(),
                })),
            }),
            execute: async ({ comments }) => triageComments(await readManagerState(), comments),
        }),
        tool({
            name: "kai_youtube_production_checklist",
            description: "Build a local production checklist for a saved content item.",
            parameters: Type.Object({
                contentId: Type.String(),
            }),
            execute: async ({ contentId }) => buildProductionChecklist(await readManagerState(), contentId),
        }),
        tool({
            name: "kai_youtube_manager_brief",
            description: "Build a channel-manager daily brief from Kai's local manager state.",
            parameters: Type.Object({}),
            execute: async () => buildManagerBrief(await readManagerState()),
        }),
        tool({
            name: "kai_youtube_analytics_preset_list",
            description: "List saved analytics report presets.",
            parameters: Type.Object({}),
            execute: async () => (await readManagerState()).analyticsPresets,
        }),
        tool({
            name: "kai_youtube_analytics_preset_upsert",
            description: "Create or update a saved analytics report preset.",
            parameters: Type.Object({
                id: Type.Optional(Type.String()),
                title: Type.String(),
                metrics: Type.String(),
                dimensions: Type.Optional(Type.String()),
                filters: Type.Optional(Type.String()),
                sort: Type.Optional(Type.String()),
                notes: Type.Optional(Type.String()),
            }),
            execute: async (params) => {
                const state = await readManagerState();
                const result = upsertAnalyticsPreset(state, params);
                await writeManagerState(result.state);
                return result.preset;
            },
        }),
        tool({
            name: "kai_youtube_data_api_request",
            description: "Call an allowlisted YouTube Data API endpoint. Non-GET requests require explicit approval.",
            parameters: Type.Object({
                approved: Type.Optional(Type.Boolean()),
                method: RequestMethodSchema,
                resourcePath: Type.String({ description: "Allowlisted path such as videos, playlists, comments/setModerationStatus, liveBroadcasts/bind, or liveChat/bans." }),
                query: QuerySchema,
                body: OptionalJsonObjectSchema,
            }),
            execute: async ({ approved, method, resourcePath, query = {}, body }) => {
                assertAllowedDataApiPath(resourcePath);
                if (method !== "GET") {
                    const gate = approvalGate(approved, `${method} ${resourcePath}`);
                    if (!gate.ok)
                        return gate;
                }
                return youtubeRequest(method, resourcePath, query, body);
            },
        }),
        tool({
            name: "kai_youtube_analytics_report",
            description: "Run a YouTube Analytics report for the authorized channel.",
            parameters: Type.Object({
                ids: Type.Optional(Type.String({ description: "Defaults to channel==MINE." })),
                startDate: Type.String(),
                endDate: Type.String(),
                metrics: Type.String({ description: "Comma-separated metrics, such as views,estimatedMinutesWatched,likes,subscribersGained." }),
                dimensions: Type.Optional(Type.String()),
                filters: Type.Optional(Type.String()),
                sort: Type.Optional(Type.String()),
                maxResults: Type.Optional(Type.Number()),
                startIndex: Type.Optional(Type.Number()),
                currency: Type.Optional(Type.String()),
                includeHistoricalChannelData: Type.Optional(Type.Boolean()),
            }),
            execute: async ({ ids = "channel==MINE", startDate, endDate, metrics, dimensions, filters, sort, maxResults, startIndex, currency, includeHistoricalChannelData }) => youtubeAnalyticsRequest({
                ids,
                startDate,
                endDate,
                metrics,
                dimensions,
                filters,
                sort,
                maxResults,
                startIndex,
                currency,
                includeHistoricalChannelData,
            }),
        }),
        tool({
            name: "kai_youtube_search",
            description: "Search YouTube for videos, channels, or playlists.",
            parameters: Type.Object({
                q: Type.Optional(Type.String()),
                channelId: Type.Optional(Type.String()),
                type: Type.Optional(Type.String({ description: "Comma-separated resource types: video,channel,playlist." })),
                order: Type.Optional(Type.String()),
                publishedAfter: Type.Optional(Type.String()),
                publishedBefore: Type.Optional(Type.String()),
                regionCode: Type.Optional(Type.String()),
                relevanceLanguage: Type.Optional(Type.String()),
                safeSearch: Type.Optional(Type.String()),
                pageToken: Type.Optional(Type.String()),
                maxResults: Type.Optional(Type.Number()),
            }),
            execute: async ({ q, channelId, type, order, publishedAfter, publishedBefore, regionCode, relevanceLanguage, safeSearch, pageToken, maxResults = 10 }) => youtubeRequest("GET", "search", {
                part: "id,snippet",
                q,
                channelId,
                type,
                order,
                publishedAfter,
                publishedBefore,
                regionCode,
                relevanceLanguage,
                safeSearch,
                pageToken,
                maxResults,
            }),
        }),
        tool({
            name: "kai_youtube_reference_list",
            description: "List YouTube reference data such as video categories, languages, regions, guide categories, or abuse report reasons.",
            parameters: Type.Object({
                resource: Type.Union([
                    Type.Literal("videoCategories"),
                    Type.Literal("i18nLanguages"),
                    Type.Literal("i18nRegions"),
                    Type.Literal("guideCategories"),
                    Type.Literal("videoAbuseReportReasons"),
                ]),
                id: Type.Optional(Type.String()),
                regionCode: Type.Optional(Type.String()),
                hl: Type.Optional(Type.String()),
            }),
            execute: async ({ resource, id, regionCode, hl }) => youtubeRequest("GET", resource, {
                part: "snippet",
                id,
                regionCode,
                hl,
            }),
        }),
        tool({
            name: "kai_youtube_channel_update_branding",
            description: "Update channel branding metadata after explicit user approval.",
            parameters: Type.Object({
                approved: Type.Optional(Type.Boolean()),
                title: Type.Optional(Type.String()),
                description: Type.Optional(Type.String()),
                keywords: Type.Optional(Type.String()),
                country: Type.Optional(Type.String()),
                defaultLanguage: Type.Optional(Type.String()),
                trackingAnalyticsAccountId: Type.Optional(Type.String()),
                unsubscribedTrailer: Type.Optional(Type.String()),
            }),
            execute: async (params) => {
                const gate = approvalGate(params.approved, "updating channel branding metadata");
                if (!gate.ok)
                    return gate;
                const existing = await getChannelForBrandingUpdate();
                return youtubeRequest("PUT", "channels", {
                    part: "brandingSettings",
                }, buildChannelBrandingUpdateBody(existing, params));
            },
        }),
        tool({
            name: "kai_youtube_channel_sections",
            description: "List channel home sections for the authorized channel or a selected channel.",
            parameters: Type.Object({
                mine: Type.Optional(Type.Boolean()),
                channelId: Type.Optional(Type.String()),
                id: Type.Optional(Type.String()),
                hl: Type.Optional(Type.String()),
            }),
            execute: async ({ mine = true, channelId, id, hl }) => youtubeRequest("GET", "channelSections", {
                part: "id,snippet,contentDetails",
                mine: id || channelId ? undefined : mine,
                channelId,
                id,
                hl,
            }),
        }),
        tool({
            name: "kai_youtube_channel_section_create",
            description: "Create a channel home section after explicit user approval.",
            parameters: Type.Object({
                approved: Type.Optional(Type.Boolean()),
                type: Type.String(),
                style: Type.String(),
                title: Type.Optional(Type.String()),
                position: Type.Optional(Type.Number()),
                playlists: Type.Optional(Type.Array(Type.String())),
                channels: Type.Optional(Type.Array(Type.String())),
            }),
            execute: async ({ approved, type, style, title, position, playlists, channels }) => {
                const gate = approvalGate(approved, `creating channel section ${title ?? type}`);
                if (!gate.ok)
                    return gate;
                return youtubeRequest("POST", "channelSections", {
                    part: "snippet,contentDetails",
                }, stripUndefined({
                    snippet: { type, style, title, position },
                    contentDetails: { playlists, channels },
                }));
            },
        }),
        tool({
            name: "kai_youtube_channel_section_update",
            description: "Update a channel home section after explicit user approval.",
            parameters: Type.Object({
                approved: Type.Optional(Type.Boolean()),
                id: Type.String(),
                type: Type.String(),
                style: Type.String(),
                title: Type.Optional(Type.String()),
                position: Type.Optional(Type.Number()),
                playlists: Type.Optional(Type.Array(Type.String())),
                channels: Type.Optional(Type.Array(Type.String())),
            }),
            execute: async ({ approved, id, type, style, title, position, playlists, channels }) => {
                const gate = approvalGate(approved, `updating channel section ${id}`);
                if (!gate.ok)
                    return gate;
                return youtubeRequest("PUT", "channelSections", {
                    part: "snippet,contentDetails",
                }, stripUndefined({
                    id,
                    snippet: { type, style, title, position },
                    contentDetails: { playlists, channels },
                }));
            },
        }),
        tool({
            name: "kai_youtube_channel_section_delete",
            description: "Delete a channel home section after explicit user approval.",
            parameters: Type.Object({
                approved: Type.Optional(Type.Boolean()),
                id: Type.String(),
            }),
            execute: async ({ approved, id }) => {
                const gate = approvalGate(approved, `deleting channel section ${id}`);
                if (!gate.ok)
                    return gate;
                return youtubeRequest("DELETE", "channelSections", { id });
            },
        }),
        tool({
            name: "kai_youtube_videos_list",
            description: "List videos by id/chart/rating, or list uploads from the authorized channel's uploads playlist by default.",
            parameters: Type.Object({
                id: Type.Optional(Type.String()),
                chart: Type.Optional(Type.String()),
                myRating: Type.Optional(Type.String()),
                playlistId: Type.Optional(Type.String()),
                regionCode: Type.Optional(Type.String()),
                pageToken: Type.Optional(Type.String()),
                maxResults: Type.Optional(Type.Number()),
            }),
            execute: async ({ id, chart, myRating, playlistId, regionCode, pageToken, maxResults = 10 }) => {
                if (!id && !chart && !myRating) {
                    let uploadsPlaylistId = playlistId;
                    if (!uploadsPlaylistId) {
                        const channel = await youtubeRequest("GET", "channels", {
                            part: "contentDetails",
                            mine: true,
                        });
                        uploadsPlaylistId = channel.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
                    }
                    if (!uploadsPlaylistId)
                        throw new Error("No uploads playlist found for the authorized channel.");
                    return youtubeRequest("GET", "playlistItems", {
                        part: "id,snippet,contentDetails,status",
                        playlistId: uploadsPlaylistId,
                        maxResults,
                        pageToken,
                    });
                }
                return youtubeRequest("GET", "videos", {
                    part: "id,snippet,status,statistics,contentDetails,recordingDetails,liveStreamingDetails",
                    id,
                    chart,
                    myRating,
                    regionCode,
                    maxResults,
                    pageToken,
                });
            },
        }),
        tool({
            name: "kai_youtube_video_update_metadata",
            description: "Update video metadata, privacy, scheduling, or recording details after explicit user approval.",
            parameters: Type.Object({
                approved: Type.Optional(Type.Boolean()),
                id: Type.String(),
                title: Type.Optional(Type.String()),
                description: Type.Optional(Type.String()),
                tags: Type.Optional(Type.Array(Type.String())),
                categoryId: Type.Optional(Type.String()),
                defaultLanguage: Type.Optional(Type.String()),
                defaultAudioLanguage: Type.Optional(Type.String()),
                privacyStatus: Type.Optional(PrivacySchema),
                publishAt: Type.Optional(Type.String()),
                embeddable: Type.Optional(Type.Boolean()),
                license: Type.Optional(LicenseSchema),
                publicStatsViewable: Type.Optional(Type.Boolean()),
                selfDeclaredMadeForKids: Type.Optional(Type.Boolean()),
                recordingDate: Type.Optional(Type.String()),
                locationDescription: Type.Optional(Type.String()),
                latitude: Type.Optional(Type.Number()),
                longitude: Type.Optional(Type.Number()),
                altitude: Type.Optional(Type.Number()),
                localizations: OptionalJsonObjectSchema,
            }),
            execute: async (params) => {
                const gate = approvalGate(params.approved, `updating video ${params.id}`);
                if (!gate.ok)
                    return gate;
                const existing = await getVideoById(params.id);
                const update = buildVideoUpdateBody(existing, params);
                return youtubeRequest("PUT", "videos", { part: update.part }, update.body);
            },
        }),
        tool({
            name: "kai_youtube_video_upload",
            description: "Upload a local video file with metadata after explicit user approval. Uses simple upload; large files should use Studio/resumable upload.",
            parameters: Type.Object({
                approved: Type.Optional(Type.Boolean()),
                filePath: Type.String(),
                mimeType: Type.Optional(Type.String()),
                title: Type.String(),
                description: Type.Optional(Type.String()),
                tags: Type.Optional(Type.Array(Type.String())),
                categoryId: Type.Optional(Type.String()),
                defaultLanguage: Type.Optional(Type.String()),
                defaultAudioLanguage: Type.Optional(Type.String()),
                privacyStatus: Type.Optional(PrivacySchema),
                publishAt: Type.Optional(Type.String()),
                embeddable: Type.Optional(Type.Boolean()),
                license: Type.Optional(LicenseSchema),
                publicStatsViewable: Type.Optional(Type.Boolean()),
                selfDeclaredMadeForKids: Type.Optional(Type.Boolean()),
                recordingDate: Type.Optional(Type.String()),
                locationDescription: Type.Optional(Type.String()),
                latitude: Type.Optional(Type.Number()),
                longitude: Type.Optional(Type.Number()),
                altitude: Type.Optional(Type.Number()),
            }),
            execute: async (params) => {
                const gate = approvalGate(params.approved, `uploading video file ${params.filePath}`);
                if (!gate.ok)
                    return gate;
                const insert = buildVideoInsertBody(params);
                return youtubeMultipartUploadRequest({
                    method: "POST",
                    resourcePath: "videos",
                    query: { part: insert.part },
                    metadata: insert.body,
                    mediaContent: await readFile(params.filePath),
                    mimeType: params.mimeType ?? inferMimeType(params.filePath),
                });
            },
        }),
        tool({
            name: "kai_youtube_video_upload_public",
            description: "Upload a local video and make it public after explicit user approval.",
            parameters: Type.Object({
                approved: Type.Optional(Type.Boolean()),
                filePath: Type.String(),
                mimeType: Type.Optional(Type.String()),
                title: Type.String(),
                description: Type.Optional(Type.String()),
                tags: Type.Optional(Type.Array(Type.String())),
                categoryId: Type.Optional(Type.String()),
                defaultLanguage: Type.Optional(Type.String()),
                defaultAudioLanguage: Type.Optional(Type.String()),
                embeddable: Type.Optional(Type.Boolean()),
                license: Type.Optional(LicenseSchema),
                publicStatsViewable: Type.Optional(Type.Boolean()),
                selfDeclaredMadeForKids: Type.Optional(Type.Boolean()),
            }),
            execute: async (params) => {
                const gate = approvalGate(params.approved, `uploading video "${params.title}" publicly`);
                if (!gate.ok)
                    return gate;
                const insert = buildVideoInsertBody({
                    title: params.title,
                    description: params.description,
                    tags: params.tags,
                    categoryId: params.categoryId,
                    defaultLanguage: params.defaultLanguage,
                    defaultAudioLanguage: params.defaultAudioLanguage,
                    privacyStatus: "public",
                    embeddable: params.embeddable,
                    license: params.license,
                    publicStatsViewable: params.publicStatsViewable,
                    selfDeclaredMadeForKids: params.selfDeclaredMadeForKids,
                });
                return youtubeMultipartUploadRequest({
                    method: "POST",
                    resourcePath: "videos",
                    query: { part: insert.part },
                    metadata: insert.body,
                    mediaContent: await readFile(params.filePath),
                    mimeType: params.mimeType ?? inferMimeType(params.filePath),
                });
            },
        }),
        tool({
            name: "kai_youtube_video_publish",
            description: "Make an existing YouTube video public after explicit user approval.",
            parameters: Type.Object({
                approved: Type.Optional(Type.Boolean()),
                id: Type.String(),
                publishAt: Type.Optional(Type.String({ description: "Optional scheduled publish time. Omit to make public immediately." })),
                selfDeclaredMadeForKids: Type.Optional(Type.Boolean()),
            }),
            execute: async ({ approved, id, publishAt, selfDeclaredMadeForKids }) => {
                const gate = approvalGate(approved, `${publishAt ? "scheduling public publish for" : "making"} video ${id} public`);
                if (!gate.ok)
                    return gate;
                const existing = await getVideoById(id);
                const update = buildVideoUpdateBody(existing, {
                    privacyStatus: "public",
                    publishAt,
                    selfDeclaredMadeForKids,
                });
                return youtubeRequest("PUT", "videos", { part: update.part }, update.body);
            },
        }),
        tool({
            name: "kai_youtube_video_edit_probe",
            description: "Inspect a local video file with ffprobe before making shorts or uploads.",
            parameters: Type.Object({
                filePath: Type.String(),
            }),
            execute: async ({ filePath }) => probeVideo(filePath),
        }),
        tool({
            name: "kai_youtube_short_create_from_video",
            description: "Create a local short clip from a longer video with ffmpeg. Does not upload to YouTube.",
            parameters: Type.Object({
                inputPath: Type.String(),
                outputPath: Type.String(),
                startTime: Type.Optional(Type.String({ description: "Start timestamp such as 00:01:20.500." })),
                durationSeconds: Type.Optional(Type.Number()),
                aspect: Type.Optional(ShortAspectSchema),
                fit: Type.Optional(ShortFitSchema),
                topText: Type.Optional(Type.String()),
                bottomText: Type.Optional(Type.String()),
                fontFile: Type.Optional(Type.String()),
                captionFilePath: Type.Optional(Type.String()),
                crf: Type.Optional(Type.Number()),
                preset: Type.Optional(Type.String()),
                overwrite: Type.Optional(Type.Boolean()),
                removeAudio: Type.Optional(Type.Boolean()),
            }),
            execute: async (params) => createShortFromVideo(params),
        }),
        tool({
            name: "kai_youtube_short_batch_from_video",
            description: "Create multiple local short clips from one longer video. Does not upload to YouTube.",
            parameters: Type.Object({
                inputPath: Type.String(),
                aspect: Type.Optional(ShortAspectSchema),
                fit: Type.Optional(ShortFitSchema),
                fontFile: Type.Optional(Type.String()),
                captionFilePath: Type.Optional(Type.String()),
                crf: Type.Optional(Type.Number()),
                preset: Type.Optional(Type.String()),
                overwrite: Type.Optional(Type.Boolean()),
                removeAudio: Type.Optional(Type.Boolean()),
                clips: Type.Array(Type.Object({
                    outputPath: Type.String(),
                    startTime: Type.Optional(Type.String()),
                    durationSeconds: Type.Optional(Type.Number()),
                    topText: Type.Optional(Type.String()),
                    bottomText: Type.Optional(Type.String()),
                })),
            }),
            execute: async ({ inputPath, aspect, fit, fontFile, captionFilePath, crf, preset, overwrite, removeAudio, clips }) => {
                const results = [];
                for (const clip of clips) {
                    results.push(await createShortFromVideo({
                        inputPath,
                        outputPath: clip.outputPath,
                        startTime: clip.startTime,
                        durationSeconds: clip.durationSeconds,
                        aspect,
                        fit,
                        topText: clip.topText,
                        bottomText: clip.bottomText,
                        fontFile,
                        captionFilePath,
                        crf,
                        preset,
                        overwrite,
                        removeAudio,
                    }));
                }
                return {
                    inputPath,
                    count: results.length,
                    results,
                };
            },
        }),
        tool({
            name: "kai_youtube_thumbnail_extract",
            description: "Extract a local thumbnail image from a video with ffmpeg. Does not set it on YouTube.",
            parameters: Type.Object({
                inputPath: Type.String(),
                outputPath: Type.String(),
                time: Type.Optional(Type.String()),
                width: Type.Optional(Type.Number()),
                height: Type.Optional(Type.Number()),
                overwrite: Type.Optional(Type.Boolean()),
            }),
            execute: async (params) => extractThumbnail(params),
        }),
        tool({
            name: "kai_youtube_thumbnail_generate_card",
            description: "Generate a YouTube thumbnail image locally from a video frame or colored background with text overlays.",
            parameters: Type.Object({
                outputPath: Type.String(),
                inputPath: Type.Optional(Type.String()),
                time: Type.Optional(Type.String()),
                width: Type.Optional(Type.Number()),
                height: Type.Optional(Type.Number()),
                title: Type.Optional(Type.String()),
                subtitle: Type.Optional(Type.String()),
                badge: Type.Optional(Type.String()),
                backgroundColor: Type.Optional(Type.String()),
                fontFile: Type.Optional(Type.String()),
                overwrite: Type.Optional(Type.Boolean()),
            }),
            execute: async (params) => generateThumbnailCard(params),
        }),
        tool({
            name: "kai_youtube_audio_generate_free_bed",
            description: "Generate a local royalty-free synthetic audio bed with ffmpeg filters.",
            parameters: Type.Object({
                outputPath: Type.String(),
                durationSeconds: Type.Number(),
                style: Type.Optional(GeneratedAudioStyleSchema),
                volume: Type.Optional(Type.Number()),
                overwrite: Type.Optional(Type.Boolean()),
            }),
            execute: async (params) => generateFreeAudioBed(params),
        }),
        tool({
            name: "kai_youtube_video_add_audio",
            description: "Add or mix a local audio track into a local video with ffmpeg.",
            parameters: Type.Object({
                inputPath: Type.String(),
                audioPath: Type.String(),
                outputPath: Type.String(),
                mode: Type.Optional(AudioMixModeSchema),
                originalVolume: Type.Optional(Type.Number()),
                addedVolume: Type.Optional(Type.Number()),
                overwrite: Type.Optional(Type.Boolean()),
            }),
            execute: async (params) => addAudioToVideo(params),
        }),
        tool({
            name: "kai_youtube_voiceover_create",
            description: "Create a local voiceover WAV file from text using espeak-ng. Different voice codes can be selected.",
            parameters: Type.Object({
                text: Type.String(),
                outputPath: Type.String(),
                voice: Type.Optional(Type.String({ description: "espeak-ng voice code, such as en, en-us, en-gb, en+f3, en+m3." })),
                speedWpm: Type.Optional(Type.Number()),
                pitch: Type.Optional(Type.Number()),
                overwrite: Type.Optional(Type.Boolean()),
            }),
            execute: async (params) => createVoiceover(params),
        }),
        tool({
            name: "kai_youtube_video_add_voiceover",
            description: "Create a voiceover from text and add it to a local video.",
            parameters: Type.Object({
                inputPath: Type.String(),
                outputPath: Type.String(),
                text: Type.String(),
                voiceOutputPath: Type.Optional(Type.String()),
                voice: Type.Optional(Type.String()),
                speedWpm: Type.Optional(Type.Number()),
                pitch: Type.Optional(Type.Number()),
                mode: Type.Optional(AudioMixModeSchema),
                originalVolume: Type.Optional(Type.Number()),
                addedVolume: Type.Optional(Type.Number()),
                overwrite: Type.Optional(Type.Boolean()),
            }),
            execute: async ({ inputPath, outputPath, text, voiceOutputPath, voice, speedWpm, pitch, mode = "duck", originalVolume, addedVolume, overwrite }) => {
                const audioPath = voiceOutputPath ?? path.join(DEFAULT_SHORTS_DIR, `voiceover-${randomBytes(4).toString("hex")}.wav`);
                const voiceover = await createVoiceover({
                    text,
                    outputPath: audioPath,
                    voice,
                    speedWpm,
                    pitch,
                    overwrite,
                });
                const video = await addAudioToVideo({
                    inputPath,
                    audioPath,
                    outputPath,
                    mode,
                    originalVolume,
                    addedVolume,
                    overwrite,
                });
                return {
                    voiceover,
                    video,
                };
            },
        }),
        tool({
            name: "kai_youtube_short_create_and_upload",
            description: "Create a short clip from a local video and upload it to YouTube after explicit user approval. Privacy defaults to private.",
            parameters: Type.Object({
                approved: Type.Optional(Type.Boolean()),
                inputPath: Type.String(),
                outputPath: Type.Optional(Type.String()),
                startTime: Type.Optional(Type.String()),
                durationSeconds: Type.Optional(Type.Number()),
                aspect: Type.Optional(ShortAspectSchema),
                fit: Type.Optional(ShortFitSchema),
                topText: Type.Optional(Type.String()),
                bottomText: Type.Optional(Type.String()),
                fontFile: Type.Optional(Type.String()),
                captionFilePath: Type.Optional(Type.String()),
                crf: Type.Optional(Type.Number()),
                preset: Type.Optional(Type.String()),
                overwrite: Type.Optional(Type.Boolean()),
                removeAudio: Type.Optional(Type.Boolean()),
                title: Type.String(),
                description: Type.Optional(Type.String()),
                tags: Type.Optional(Type.Array(Type.String())),
                categoryId: Type.Optional(Type.String()),
                defaultLanguage: Type.Optional(Type.String()),
                defaultAudioLanguage: Type.Optional(Type.String()),
                privacyStatus: Type.Optional(PrivacySchema),
                publishAt: Type.Optional(Type.String()),
                embeddable: Type.Optional(Type.Boolean()),
                license: Type.Optional(LicenseSchema),
                publicStatsViewable: Type.Optional(Type.Boolean()),
                selfDeclaredMadeForKids: Type.Optional(Type.Boolean()),
            }),
            execute: async (params) => {
                const gate = approvalGate(params.approved, `creating and uploading short "${params.title}" from ${params.inputPath}`);
                if (!gate.ok)
                    return gate;
                const outputPath = params.outputPath ?? defaultShortOutputPath(params.inputPath);
                const render = await createShortFromVideo({
                    inputPath: params.inputPath,
                    outputPath,
                    startTime: params.startTime,
                    durationSeconds: params.durationSeconds,
                    aspect: params.aspect,
                    fit: params.fit,
                    topText: params.topText,
                    bottomText: params.bottomText,
                    fontFile: params.fontFile,
                    captionFilePath: params.captionFilePath,
                    crf: params.crf,
                    preset: params.preset,
                    overwrite: params.overwrite,
                    removeAudio: params.removeAudio,
                });
                const insert = buildVideoInsertBody({
                    title: params.title,
                    description: params.description,
                    tags: params.tags,
                    categoryId: params.categoryId,
                    defaultLanguage: params.defaultLanguage,
                    defaultAudioLanguage: params.defaultAudioLanguage,
                    privacyStatus: params.privacyStatus,
                    publishAt: params.publishAt,
                    embeddable: params.embeddable,
                    license: params.license,
                    publicStatsViewable: params.publicStatsViewable,
                    selfDeclaredMadeForKids: params.selfDeclaredMadeForKids,
                });
                const upload = await youtubeMultipartUploadRequest({
                    method: "POST",
                    resourcePath: "videos",
                    query: { part: insert.part },
                    metadata: insert.body,
                    mediaContent: await readFile(outputPath),
                    mimeType: "video/mp4",
                });
                return {
                    render,
                    upload,
                };
            },
        }),
        tool({
            name: "kai_youtube_video_delete",
            description: "Delete a YouTube video after explicit user approval.",
            parameters: Type.Object({
                approved: Type.Optional(Type.Boolean()),
                id: Type.String(),
            }),
            execute: async ({ approved, id }) => {
                const gate = approvalGate(approved, `deleting video ${id}`);
                if (!gate.ok)
                    return gate;
                return youtubeRequest("DELETE", "videos", { id });
            },
        }),
        tool({
            name: "kai_youtube_video_rate",
            description: "Like, dislike, or clear the authorized account's rating for a video after explicit user approval.",
            parameters: Type.Object({
                approved: Type.Optional(Type.Boolean()),
                id: Type.String(),
                rating: Type.Union([Type.Literal("like"), Type.Literal("dislike"), Type.Literal("none")]),
            }),
            execute: async ({ approved, id, rating }) => {
                const gate = approvalGate(approved, `setting rating ${rating} on video ${id}`);
                if (!gate.ok)
                    return gate;
                return youtubeRequest("POST", "videos/rate", { id, rating });
            },
        }),
        tool({
            name: "kai_youtube_video_report_abuse",
            description: "Report a video for abuse after explicit user approval.",
            parameters: Type.Object({
                approved: Type.Optional(Type.Boolean()),
                videoId: Type.String(),
                reasonId: Type.String(),
                secondaryReasonId: Type.Optional(Type.String()),
                comments: Type.Optional(Type.String()),
                language: Type.Optional(Type.String()),
            }),
            execute: async ({ approved, videoId, reasonId, secondaryReasonId, comments, language }) => {
                const gate = approvalGate(approved, `reporting video ${videoId} for abuse`);
                if (!gate.ok)
                    return gate;
                return youtubeRequest("POST", "videos/reportAbuse", {}, stripUndefined({
                    videoId,
                    reasonId,
                    secondaryReasonId,
                    comments,
                    language,
                }));
            },
        }),
        tool({
            name: "kai_youtube_thumbnail_set",
            description: "Set a video's thumbnail from a local image file after explicit user approval.",
            parameters: Type.Object({
                approved: Type.Optional(Type.Boolean()),
                videoId: Type.String(),
                filePath: Type.String(),
                mimeType: Type.Optional(Type.String()),
            }),
            execute: async ({ approved, videoId, filePath, mimeType }) => {
                const gate = approvalGate(approved, `setting thumbnail for video ${videoId}`);
                if (!gate.ok)
                    return gate;
                return youtubeMediaUploadRequest({
                    method: "POST",
                    resourcePath: "thumbnails/set",
                    query: { videoId },
                    filePath,
                    mimeType,
                });
            },
        }),
        tool({
            name: "kai_youtube_playlists_list",
            description: "List playlists for the authorized account, channel, or specific ids.",
            parameters: Type.Object({
                mine: Type.Optional(Type.Boolean()),
                channelId: Type.Optional(Type.String()),
                id: Type.Optional(Type.String()),
                pageToken: Type.Optional(Type.String()),
                maxResults: Type.Optional(Type.Number()),
            }),
            execute: async ({ mine = true, channelId, id, pageToken, maxResults = 10 }) => youtubeRequest("GET", "playlists", {
                part: "id,snippet,status,contentDetails,localizations",
                mine: id || channelId ? undefined : mine,
                channelId,
                id,
                pageToken,
                maxResults,
            }),
        }),
        tool({
            name: "kai_youtube_playlist_create",
            description: "Create a playlist after explicit user approval.",
            parameters: Type.Object({
                approved: Type.Optional(Type.Boolean()),
                title: Type.String(),
                description: Type.Optional(Type.String()),
                privacyStatus: Type.Optional(PrivacySchema),
                tags: Type.Optional(Type.Array(Type.String())),
                defaultLanguage: Type.Optional(Type.String()),
            }),
            execute: async (params) => {
                const gate = approvalGate(params.approved, `creating playlist "${params.title}"`);
                if (!gate.ok)
                    return gate;
                return youtubeRequest("POST", "playlists", {
                    part: "snippet,status",
                }, buildPlaylistBody(params));
            },
        }),
        tool({
            name: "kai_youtube_playlist_update",
            description: "Update a playlist after explicit user approval.",
            parameters: Type.Object({
                approved: Type.Optional(Type.Boolean()),
                id: Type.String(),
                title: Type.Optional(Type.String()),
                description: Type.Optional(Type.String()),
                privacyStatus: Type.Optional(PrivacySchema),
                tags: Type.Optional(Type.Array(Type.String())),
                defaultLanguage: Type.Optional(Type.String()),
            }),
            execute: async (params) => {
                const gate = approvalGate(params.approved, `updating playlist ${params.id}`);
                if (!gate.ok)
                    return gate;
                const existing = await getPlaylistById(params.id);
                return youtubeRequest("PUT", "playlists", {
                    part: "snippet,status",
                }, mergePlaylistUpdate(existing, params));
            },
        }),
        tool({
            name: "kai_youtube_playlist_delete",
            description: "Delete a playlist after explicit user approval.",
            parameters: Type.Object({
                approved: Type.Optional(Type.Boolean()),
                id: Type.String(),
            }),
            execute: async ({ approved, id }) => {
                const gate = approvalGate(approved, `deleting playlist ${id}`);
                if (!gate.ok)
                    return gate;
                return youtubeRequest("DELETE", "playlists", { id });
            },
        }),
        tool({
            name: "kai_youtube_playlist_items",
            description: "List videos/items in a playlist.",
            parameters: Type.Object({
                playlistId: Type.String(),
                pageToken: Type.Optional(Type.String()),
                maxResults: Type.Optional(Type.Number()),
            }),
            execute: async ({ playlistId, pageToken, maxResults = 10 }) => youtubeRequest("GET", "playlistItems", {
                part: "id,snippet,contentDetails,status",
                playlistId,
                pageToken,
                maxResults,
            }),
        }),
        tool({
            name: "kai_youtube_playlist_item_add",
            description: "Add a video to a playlist after explicit user approval.",
            parameters: Type.Object({
                approved: Type.Optional(Type.Boolean()),
                playlistId: Type.String(),
                videoId: Type.String(),
                position: Type.Optional(Type.Number()),
                note: Type.Optional(Type.String()),
            }),
            execute: async ({ approved, playlistId, videoId, position, note }) => {
                const gate = approvalGate(approved, `adding video ${videoId} to playlist ${playlistId}`);
                if (!gate.ok)
                    return gate;
                return youtubeRequest("POST", "playlistItems", {
                    part: "snippet",
                }, stripUndefined({
                    snippet: {
                        playlistId,
                        position,
                        note,
                        resourceId: {
                            kind: "youtube#video",
                            videoId,
                        },
                    },
                }));
            },
        }),
        tool({
            name: "kai_youtube_playlist_item_update",
            description: "Move or update a playlist item after explicit user approval.",
            parameters: Type.Object({
                approved: Type.Optional(Type.Boolean()),
                id: Type.String(),
                playlistId: Type.Optional(Type.String()),
                videoId: Type.Optional(Type.String()),
                position: Type.Optional(Type.Number()),
                note: Type.Optional(Type.String()),
            }),
            execute: async (params) => {
                const gate = approvalGate(params.approved, `updating playlist item ${params.id}`);
                if (!gate.ok)
                    return gate;
                const existing = await getPlaylistItemById(params.id);
                return youtubeRequest("PUT", "playlistItems", {
                    part: "snippet",
                }, buildPlaylistItemUpdate(existing, params));
            },
        }),
        tool({
            name: "kai_youtube_playlist_item_delete",
            description: "Remove a video from a playlist after explicit user approval.",
            parameters: Type.Object({
                approved: Type.Optional(Type.Boolean()),
                id: Type.String(),
            }),
            execute: async ({ approved, id }) => {
                const gate = approvalGate(approved, `deleting playlist item ${id}`);
                if (!gate.ok)
                    return gate;
                return youtubeRequest("DELETE", "playlistItems", { id });
            },
        }),
        tool({
            name: "kai_youtube_comments_list",
            description: "List comment threads or replies for a video/channel/comment.",
            parameters: Type.Object({
                mode: Type.Optional(Type.Union([Type.Literal("threads"), Type.Literal("replies")])),
                videoId: Type.Optional(Type.String()),
                channelId: Type.Optional(Type.String()),
                allThreadsRelatedToChannelId: Type.Optional(Type.String()),
                id: Type.Optional(Type.String()),
                parentId: Type.Optional(Type.String()),
                moderationStatus: Type.Optional(Type.String()),
                order: Type.Optional(Type.String()),
                searchTerms: Type.Optional(Type.String()),
                textFormat: Type.Optional(Type.String()),
                pageToken: Type.Optional(Type.String()),
                maxResults: Type.Optional(Type.Number()),
            }),
            execute: async ({ mode = "threads", videoId, channelId, allThreadsRelatedToChannelId, id, parentId, moderationStatus, order, searchTerms, textFormat, pageToken, maxResults = 20 }) => {
                if (mode === "replies" || parentId) {
                    return youtubeRequest("GET", "comments", {
                        part: "id,snippet",
                        id,
                        parentId,
                        textFormat,
                        pageToken,
                        maxResults,
                    });
                }
                return youtubeRequest("GET", "commentThreads", {
                    part: "id,snippet,replies",
                    videoId,
                    channelId,
                    allThreadsRelatedToChannelId,
                    id,
                    moderationStatus,
                    order,
                    searchTerms,
                    textFormat,
                    pageToken,
                    maxResults,
                });
            },
        }),
        tool({
            name: "kai_youtube_comment_create",
            description: "Create a top-level comment on a video or channel after explicit user approval.",
            parameters: Type.Object({
                approved: Type.Optional(Type.Boolean()),
                textOriginal: Type.String(),
                videoId: Type.Optional(Type.String()),
                channelId: Type.Optional(Type.String()),
            }),
            execute: async ({ approved, textOriginal, videoId, channelId }) => {
                const gate = approvalGate(approved, `creating a public YouTube comment${videoId ? ` on video ${videoId}` : ""}`);
                if (!gate.ok)
                    return gate;
                return youtubeRequest("POST", "commentThreads", {
                    part: "snippet",
                }, stripUndefined({
                    snippet: {
                        videoId,
                        channelId,
                        topLevelComment: {
                            snippet: {
                                textOriginal,
                            },
                        },
                    },
                }));
            },
        }),
        tool({
            name: "kai_youtube_comment_reply",
            description: "Reply to a YouTube comment after explicit user approval.",
            parameters: Type.Object({
                approved: Type.Optional(Type.Boolean()),
                parentId: Type.String(),
                textOriginal: Type.String(),
            }),
            execute: async ({ approved, parentId, textOriginal }) => {
                const gate = approvalGate(approved, `replying to comment ${parentId}`);
                if (!gate.ok)
                    return gate;
                return youtubeRequest("POST", "comments", {
                    part: "snippet",
                }, {
                    snippet: {
                        parentId,
                        textOriginal,
                    },
                });
            },
        }),
        tool({
            name: "kai_youtube_comment_update",
            description: "Update an existing YouTube comment after explicit user approval.",
            parameters: Type.Object({
                approved: Type.Optional(Type.Boolean()),
                id: Type.String(),
                textOriginal: Type.String(),
            }),
            execute: async ({ approved, id, textOriginal }) => {
                const gate = approvalGate(approved, `updating comment ${id}`);
                if (!gate.ok)
                    return gate;
                return youtubeRequest("PUT", "comments", {
                    part: "snippet",
                }, {
                    id,
                    snippet: {
                        textOriginal,
                    },
                });
            },
        }),
        tool({
            name: "kai_youtube_comment_moderate",
            description: "Set moderation status for one or more YouTube comments after explicit user approval.",
            parameters: Type.Object({
                approved: Type.Optional(Type.Boolean()),
                id: Type.Union([Type.String(), Type.Array(Type.String())]),
                moderationStatus: CommentModerationStatusSchema,
                banAuthor: Type.Optional(Type.Boolean()),
            }),
            execute: async ({ approved, id, moderationStatus, banAuthor }) => {
                const ids = Array.isArray(id) ? id.join(",") : id;
                const gate = approvalGate(approved, `setting moderation status ${moderationStatus} for comment(s) ${ids}`);
                if (!gate.ok)
                    return gate;
                return youtubeRequest("POST", "comments/setModerationStatus", {
                    id: ids,
                    moderationStatus,
                    banAuthor,
                });
            },
        }),
        tool({
            name: "kai_youtube_comment_delete",
            description: "Delete a YouTube comment after explicit user approval.",
            parameters: Type.Object({
                approved: Type.Optional(Type.Boolean()),
                id: Type.String(),
            }),
            execute: async ({ approved, id }) => {
                const gate = approvalGate(approved, `deleting comment ${id}`);
                if (!gate.ok)
                    return gate;
                return youtubeRequest("DELETE", "comments", { id });
            },
        }),
        tool({
            name: "kai_youtube_captions_list",
            description: "List caption tracks for a video.",
            parameters: Type.Object({
                videoId: Type.String(),
                id: Type.Optional(Type.String()),
            }),
            execute: async ({ videoId, id }) => youtubeRequest("GET", "captions", {
                part: "id,snippet",
                videoId,
                id,
            }),
        }),
        tool({
            name: "kai_youtube_caption_upload",
            description: "Insert or update a text caption track after explicit user approval.",
            parameters: Type.Object({
                approved: Type.Optional(Type.Boolean()),
                operation: Type.Union([Type.Literal("insert"), Type.Literal("update")]),
                id: Type.Optional(Type.String()),
                videoId: Type.Optional(Type.String()),
                language: Type.String(),
                name: Type.Optional(Type.String()),
                isDraft: Type.Optional(Type.Boolean()),
                content: Type.Optional(Type.String()),
                filePath: Type.Optional(Type.String()),
                mimeType: Type.Optional(Type.String()),
                sync: Type.Optional(Type.Boolean()),
            }),
            execute: async ({ approved, operation, id, videoId, language, name, isDraft, content, filePath, mimeType, sync }) => {
                const target = operation === "update" ? id : videoId;
                const gate = approvalGate(approved, `${operation === "update" ? "updating" : "creating"} caption track for ${target}`);
                if (!gate.ok)
                    return gate;
                if (operation === "update" && !id)
                    throw new Error("Caption id is required for update.");
                if (operation === "insert" && !videoId)
                    throw new Error("videoId is required for insert.");
                const mediaContent = filePath ? await readFile(filePath) : content;
                if (!mediaContent)
                    throw new Error("Provide caption content or filePath.");
                return youtubeMultipartUploadRequest({
                    method: operation === "update" ? "PUT" : "POST",
                    resourcePath: "captions",
                    query: { part: "snippet", sync },
                    metadata: stripUndefined({
                        id,
                        snippet: {
                            videoId,
                            language,
                            name,
                            isDraft,
                        },
                    }),
                    mediaContent,
                    mimeType: mimeType ?? (filePath ? inferMimeType(filePath) : "text/plain"),
                });
            },
        }),
        tool({
            name: "kai_youtube_caption_download",
            description: "Download a caption track as text.",
            parameters: Type.Object({
                id: Type.String(),
                tfmt: Type.Optional(Type.String()),
                tlang: Type.Optional(Type.String()),
                maxCharacters: Type.Optional(Type.Number()),
            }),
            execute: async (params) => youtubeCaptionDownload(params),
        }),
        tool({
            name: "kai_youtube_caption_delete",
            description: "Delete a caption track after explicit user approval.",
            parameters: Type.Object({
                approved: Type.Optional(Type.Boolean()),
                id: Type.String(),
            }),
            execute: async ({ approved, id }) => {
                const gate = approvalGate(approved, `deleting caption track ${id}`);
                if (!gate.ok)
                    return gate;
                return youtubeRequest("DELETE", "captions", { id });
            },
        }),
        tool({
            name: "kai_youtube_members",
            description: "List channel members when the authorized channel and scopes allow it.",
            parameters: Type.Object({
                mode: Type.Optional(Type.String()),
                filterByMemberChannelId: Type.Optional(Type.String()),
                pageToken: Type.Optional(Type.String()),
                maxResults: Type.Optional(Type.Number()),
            }),
            execute: async ({ mode, filterByMemberChannelId, pageToken, maxResults = 10 }) => youtubeRequest("GET", "members", {
                part: "snippet",
                mode,
                filterByMemberChannelId,
                pageToken,
                maxResults,
            }),
        }),
        tool({
            name: "kai_youtube_membership_levels",
            description: "List membership levels for the authorized channel when available.",
            parameters: Type.Object({}),
            execute: async () => youtubeRequest("GET", "membershipsLevels", {
                part: "snippet",
            }),
        }),
        tool({
            name: "kai_youtube_subscriptions",
            description: "List subscriptions for the authorized user or a selected channel.",
            parameters: Type.Object({
                mine: Type.Optional(Type.Boolean()),
                channelId: Type.Optional(Type.String()),
                id: Type.Optional(Type.String()),
                mySubscribers: Type.Optional(Type.Boolean()),
                pageToken: Type.Optional(Type.String()),
                maxResults: Type.Optional(Type.Number()),
            }),
            execute: async ({ mine, channelId, id, mySubscribers, pageToken, maxResults = 10 }) => youtubeRequest("GET", "subscriptions", {
                part: "id,snippet,contentDetails,subscriberSnippet",
                mine,
                channelId,
                id,
                mySubscribers,
                pageToken,
                maxResults,
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
                id: Type.Optional(Type.String()),
                mine: Type.Optional(Type.Boolean()),
                maxResults: Type.Optional(Type.Number()),
            }),
            execute: async ({ broadcastStatus = "upcoming", id, mine, maxResults = 10 }) => youtubeRequest("GET", "liveBroadcasts", {
                part: "id,snippet,status,contentDetails",
                broadcastStatus: id ? undefined : broadcastStatus,
                id,
                mine,
                maxResults,
            }),
        }),
        tool({
            name: "kai_youtube_live_delete_broadcast",
            description: "Delete a YouTube live broadcast after explicit user approval.",
            parameters: Type.Object({
                approved: Type.Optional(Type.Boolean()),
                id: Type.String(),
            }),
            execute: async ({ approved, id }) => {
                const gate = approvalGate(approved, `deleting live broadcast ${id}`);
                if (!gate.ok)
                    return gate;
                return youtubeRequest("DELETE", "liveBroadcasts", { id });
            },
        }),
        tool({
            name: "kai_youtube_live_bind_broadcast",
            description: "Bind or unbind a live broadcast and stream after explicit user approval.",
            parameters: Type.Object({
                approved: Type.Optional(Type.Boolean()),
                id: Type.String({ description: "Live broadcast id." }),
                streamId: Type.Optional(Type.String({ description: "Live stream id. Omit to unbind." })),
            }),
            execute: async ({ approved, id, streamId }) => {
                const gate = approvalGate(approved, `${streamId ? "binding" : "unbinding"} live broadcast ${id}${streamId ? ` to stream ${streamId}` : ""}`);
                if (!gate.ok)
                    return gate;
                return youtubeRequest("POST", "liveBroadcasts/bind", {
                    id,
                    streamId,
                    part: "id,snippet,status,contentDetails",
                });
            },
        }),
        tool({
            name: "kai_youtube_live_cuepoint",
            description: "Insert a live broadcast cuepoint, such as an ad cuepoint, after explicit user approval.",
            parameters: Type.Object({
                approved: Type.Optional(Type.Boolean()),
                id: Type.String({ description: "Live broadcast id." }),
                cuepoint: JsonObjectSchema,
            }),
            execute: async ({ approved, id, cuepoint }) => {
                const gate = approvalGate(approved, `inserting cuepoint into live broadcast ${id}`);
                if (!gate.ok)
                    return gate;
                return youtubeRequest("POST", "liveBroadcasts/cuepoint", {
                    id,
                    part: "id,snippet,status,contentDetails",
                }, cuepoint);
            },
        }),
        tool({
            name: "kai_youtube_live_streams",
            description: "List YouTube live streams and stream health for the authorized channel.",
            parameters: Type.Object({
                id: Type.Optional(Type.String()),
                mine: Type.Optional(Type.Boolean()),
                pageToken: Type.Optional(Type.String()),
                maxResults: Type.Optional(Type.Number()),
            }),
            execute: async ({ id, mine = true, pageToken, maxResults = 10 }) => youtubeRequest("GET", "liveStreams", {
                part: "id,snippet,cdn,status,contentDetails",
                id,
                mine: id ? undefined : mine,
                pageToken,
                maxResults,
            }),
        }),
        tool({
            name: "kai_youtube_live_stream_create",
            description: "Create a reusable live stream after explicit user approval. Stream keys are redacted from output.",
            parameters: Type.Object({
                approved: Type.Optional(Type.Boolean()),
                title: Type.String(),
                description: Type.Optional(Type.String()),
                ingestionType: Type.Optional(LiveStreamIngestionSchema),
                resolution: Type.Optional(Type.String()),
                frameRate: Type.Optional(Type.String()),
                isReusable: Type.Optional(Type.Boolean()),
            }),
            execute: async (params) => {
                const gate = approvalGate(params.approved, `creating live stream "${params.title}"`);
                if (!gate.ok)
                    return gate;
                return youtubeRequest("POST", "liveStreams", {
                    part: "snippet,cdn,contentDetails",
                }, buildLiveStreamBody(params));
            },
        }),
        tool({
            name: "kai_youtube_live_stream_update",
            description: "Update live stream title or description after explicit user approval.",
            parameters: Type.Object({
                approved: Type.Optional(Type.Boolean()),
                id: Type.String(),
                title: Type.Optional(Type.String()),
                description: Type.Optional(Type.String()),
            }),
            execute: async (params) => {
                const gate = approvalGate(params.approved, `updating live stream ${params.id}`);
                if (!gate.ok)
                    return gate;
                const existing = await getLiveStreamById(params.id);
                return youtubeRequest("PUT", "liveStreams", {
                    part: "snippet,cdn,contentDetails",
                }, mergeLiveStreamUpdate(existing, params));
            },
        }),
        tool({
            name: "kai_youtube_live_stream_delete",
            description: "Delete a live stream after explicit user approval.",
            parameters: Type.Object({
                approved: Type.Optional(Type.Boolean()),
                id: Type.String(),
            }),
            execute: async ({ approved, id }) => {
                const gate = approvalGate(approved, `deleting live stream ${id}`);
                if (!gate.ok)
                    return gate;
                return youtubeRequest("DELETE", "liveStreams", { id });
            },
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
        tool({
            name: "kai_youtube_live_chat_ban",
            description: "Ban a user from a live chat after explicit user approval.",
            parameters: Type.Object({
                approved: Type.Optional(Type.Boolean()),
                liveChatId: Type.String(),
                channelId: Type.String({ description: "Channel id of the user to ban." }),
                type: Type.Optional(LiveChatBanTypeSchema),
                banDurationSeconds: Type.Optional(Type.Number()),
            }),
            execute: async ({ approved, liveChatId, channelId, type = "temporary", banDurationSeconds }) => {
                const gate = approvalGate(approved, `banning channel ${channelId} from live chat ${liveChatId}`);
                if (!gate.ok)
                    return gate;
                return youtubeRequest("POST", "liveChat/bans", {
                    part: "snippet",
                }, stripUndefined({
                    snippet: {
                        liveChatId,
                        type,
                        banDurationSeconds: type === "temporary" ? banDurationSeconds : undefined,
                        bannedUserDetails: {
                            channelId,
                        },
                    },
                }));
            },
        }),
        tool({
            name: "kai_youtube_live_chat_unban",
            description: "Remove a live chat ban after explicit user approval.",
            parameters: Type.Object({
                approved: Type.Optional(Type.Boolean()),
                id: Type.String({ description: "Live chat ban id." }),
            }),
            execute: async ({ approved, id }) => {
                const gate = approvalGate(approved, `removing live chat ban ${id}`);
                if (!gate.ok)
                    return gate;
                return youtubeRequest("DELETE", "liveChat/bans", { id });
            },
        }),
        tool({
            name: "kai_youtube_live_chat_moderators",
            description: "List moderators for a live chat.",
            parameters: Type.Object({
                liveChatId: Type.String(),
                pageToken: Type.Optional(Type.String()),
                maxResults: Type.Optional(Type.Number()),
            }),
            execute: async ({ liveChatId, pageToken, maxResults = 10 }) => youtubeRequest("GET", "liveChat/moderators", {
                part: "id,snippet",
                liveChatId,
                pageToken,
                maxResults,
            }),
        }),
        tool({
            name: "kai_youtube_live_chat_moderator_add",
            description: "Add a live chat moderator after explicit user approval.",
            parameters: Type.Object({
                approved: Type.Optional(Type.Boolean()),
                liveChatId: Type.String(),
                channelId: Type.String({ description: "Channel id of the user to make moderator." }),
            }),
            execute: async ({ approved, liveChatId, channelId }) => {
                const gate = approvalGate(approved, `adding channel ${channelId} as live chat moderator`);
                if (!gate.ok)
                    return gate;
                return youtubeRequest("POST", "liveChat/moderators", {
                    part: "snippet",
                }, {
                    snippet: {
                        liveChatId,
                        moderatorDetails: {
                            channelId,
                        },
                    },
                });
            },
        }),
        tool({
            name: "kai_youtube_live_chat_moderator_delete",
            description: "Remove a live chat moderator after explicit user approval.",
            parameters: Type.Object({
                approved: Type.Optional(Type.Boolean()),
                id: Type.String({ description: "Live chat moderator id." }),
            }),
            execute: async ({ approved, id }) => {
                const gate = approvalGate(approved, `removing live chat moderator ${id}`);
                if (!gate.ok)
                    return gate;
                return youtubeRequest("DELETE", "liveChat/moderators", { id });
            },
        }),
        tool({
            name: "kai_youtube_live_super_chats",
            description: "List Super Chat events for the authorized channel's live streams.",
            parameters: Type.Object({
                pageToken: Type.Optional(Type.String()),
                maxResults: Type.Optional(Type.Number()),
            }),
            execute: async ({ pageToken, maxResults = 10 }) => youtubeRequest("GET", "superChatEvents", {
                part: "id,snippet",
                pageToken,
                maxResults,
            }),
        }),
    ],
});
