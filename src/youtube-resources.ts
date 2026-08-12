import { youtubeRequest } from "./api.js";
import type { QueryParams, YouTubeRequestMethod } from "./types.js";

type YouTubeRequester = <T>(
  method: YouTubeRequestMethod,
  resourcePath: string,
  query?: QueryParams,
  body?: unknown,
) => Promise<T>;

export async function getBroadcastById(id: string, request: YouTubeRequester = youtubeRequest) {
  const result = await request<{ items?: Array<Record<string, unknown>> }>("GET", "liveBroadcasts", {
    part: "id,snippet,status,contentDetails",
    id,
  });
  const item = result.items?.[0];
  if (!item) throw new Error(`No live broadcast found for id ${id}.`);
  return item;
}

export async function getVideoById(id: string, request: YouTubeRequester = youtubeRequest) {
  const result = await request<{ items?: Array<Record<string, unknown>> }>("GET", "videos", {
    part: "id,snippet,status,recordingDetails,localizations",
    id,
  });
  const item = result.items?.[0];
  if (!item) throw new Error(`No video found for id ${id}.`);
  return item;
}

export async function getChannelForBrandingUpdate(request: YouTubeRequester = youtubeRequest) {
  const result = await request<{ items?: Array<Record<string, unknown>> }>("GET", "channels", {
    part: "id,brandingSettings",
    mine: true,
  });
  const item = result.items?.[0];
  if (!item) throw new Error("No authorized channel found.");
  return item;
}

export async function getPlaylistById(id: string, request: YouTubeRequester = youtubeRequest) {
  const result = await request<{ items?: Array<Record<string, unknown>> }>("GET", "playlists", {
    part: "id,snippet,status,contentDetails",
    id,
  });
  const item = result.items?.[0];
  if (!item) throw new Error(`No playlist found for id ${id}.`);
  return item;
}

export async function getPlaylistItemById(id: string, request: YouTubeRequester = youtubeRequest) {
  const result = await request<{ items?: Array<Record<string, unknown>> }>("GET", "playlistItems", {
    part: "id,snippet,contentDetails,status",
    id,
  });
  const item = result.items?.[0];
  if (!item) throw new Error(`No playlist item found for id ${id}.`);
  return item;
}

export async function getLiveStreamById(id: string, request: YouTubeRequester = youtubeRequest) {
  const result = await request<{ items?: Array<Record<string, unknown>> }>("GET", "liveStreams", {
    part: "id,snippet,cdn,status,contentDetails",
    id,
  });
  const item = result.items?.[0];
  if (!item) throw new Error(`No live stream found for id ${id}.`);
  return item;
}
