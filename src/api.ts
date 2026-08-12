import { randomBytes } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { MAX_SIMPLE_UPLOAD_BYTES, YOUTUBE_ANALYTICS_API_URL, YOUTUBE_API_URL, YOUTUBE_UPLOAD_API_URL } from "./constants.js";
import { inferMimeType } from "./mime.js";
import { parseJsonResponse, refreshAccessTokenIfNeeded, sanitizeError } from "./oauth.js";
import { redactSensitive, stripUndefined } from "./safety.js";
import type { JsonObject, QueryParams, YouTubeRequestMethod } from "./types.js";

export function queryString(query: QueryParams): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  return params.toString();
}

async function authorizedJsonRequest<T>(
  baseUrl: string,
  method: YouTubeRequestMethod,
  resourcePath: string,
  query: QueryParams = {},
  body?: unknown,
): Promise<T> {
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
  return redactSensitive(data) as T;
}

export async function youtubeRequest<T>(
  method: YouTubeRequestMethod,
  resourcePath: string,
  query: QueryParams = {},
  body?: unknown,
): Promise<T> {
  return authorizedJsonRequest<T>(YOUTUBE_API_URL, method, resourcePath, query, body);
}

export async function youtubeAnalyticsRequest<T>(query: QueryParams): Promise<T> {
  return authorizedJsonRequest<T>(YOUTUBE_ANALYTICS_API_URL, "GET", "reports", query);
}

export async function youtubeMediaUploadRequest<T>(params: {
  method: "POST" | "PUT";
  resourcePath: string;
  query?: QueryParams;
  filePath: string;
  mimeType?: string;
}): Promise<T> {
  const fileInfo = await stat(params.filePath);
  if (fileInfo.size > MAX_SIMPLE_UPLOAD_BYTES) {
    throw new Error(
      `File is ${fileInfo.size} bytes. This plugin supports simple uploads up to ${MAX_SIMPLE_UPLOAD_BYTES} bytes; use YouTube Studio or a resumable uploader for larger files.`,
    );
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
  return redactSensitive(data) as T;
}

export async function youtubeMultipartUploadRequest<T>(params: {
  method: "POST" | "PUT";
  resourcePath: string;
  query?: QueryParams;
  metadata: unknown;
  mediaContent: string | Buffer;
  mimeType: string;
}): Promise<T> {
  const token = await refreshAccessTokenIfNeeded();
  const boundary = `kai-youtube-${randomBytes(12).toString("hex")}`;
  const metadata = Buffer.from(JSON.stringify(stripUndefined(params.metadata)), "utf8");
  const media = Buffer.isBuffer(params.mediaContent)
    ? params.mediaContent
    : Buffer.from(params.mediaContent, "utf8");
  if (media.byteLength > MAX_SIMPLE_UPLOAD_BYTES) {
    throw new Error(
      `Media is ${media.byteLength} bytes. This plugin supports simple uploads up to ${MAX_SIMPLE_UPLOAD_BYTES} bytes; use YouTube Studio or a resumable uploader for larger files.`,
    );
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
  return redactSensitive(data) as T;
}

export async function youtubeCaptionDownload(params: {
  id: string;
  tfmt?: string;
  tlang?: string;
  maxCharacters?: number;
}) {
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
    const parsed: JsonObject = (() => {
      try {
        return text ? JSON.parse(text) as JsonObject : {};
      } catch {
        return { raw: text };
      }
    })();
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
