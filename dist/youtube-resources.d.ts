import type { QueryParams, YouTubeRequestMethod } from "./types.js";
type YouTubeRequester = <T>(method: YouTubeRequestMethod, resourcePath: string, query?: QueryParams, body?: unknown) => Promise<T>;
export declare function getBroadcastById(id: string, request?: YouTubeRequester): Promise<Record<string, unknown>>;
export declare function getVideoById(id: string, request?: YouTubeRequester): Promise<Record<string, unknown>>;
export declare function getChannelForBrandingUpdate(request?: YouTubeRequester): Promise<Record<string, unknown>>;
export declare function getPlaylistById(id: string, request?: YouTubeRequester): Promise<Record<string, unknown>>;
export declare function getPlaylistItemById(id: string, request?: YouTubeRequester): Promise<Record<string, unknown>>;
export declare function getLiveStreamById(id: string, request?: YouTubeRequester): Promise<Record<string, unknown>>;
export {};
