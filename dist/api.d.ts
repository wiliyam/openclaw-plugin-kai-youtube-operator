import type { QueryParams, YouTubeRequestMethod } from "./types.js";
export declare function queryString(query: QueryParams): string;
export declare function youtubeRequest<T>(method: YouTubeRequestMethod, resourcePath: string, query?: QueryParams, body?: unknown): Promise<T>;
export declare function youtubeAnalyticsRequest<T>(query: QueryParams): Promise<T>;
export declare function youtubeMediaUploadRequest<T>(params: {
    method: "POST" | "PUT";
    resourcePath: string;
    query?: QueryParams;
    filePath: string;
    mimeType?: string;
}): Promise<T>;
export declare function youtubeMultipartUploadRequest<T>(params: {
    method: "POST" | "PUT";
    resourcePath: string;
    query?: QueryParams;
    metadata: unknown;
    mediaContent: string | Buffer;
    mimeType: string;
}): Promise<T>;
export declare function youtubeCaptionDownload(params: {
    id: string;
    tfmt?: string;
    tlang?: string;
    maxCharacters?: number;
}): Promise<{
    id: string;
    contentType: string | null;
    truncated: boolean;
    content: string;
}>;
