import { youtubeRequest } from "./api.js";

export async function getBroadcastById(id: string) {
  const result = await youtubeRequest<{ items?: Array<Record<string, unknown>> }>("GET", "liveBroadcasts", {
    part: "id,snippet,status,contentDetails",
    id,
  });
  const item = result.items?.[0];
  if (!item) throw new Error(`No live broadcast found for id ${id}.`);
  return item;
}

export async function getVideoById(id: string) {
  const result = await youtubeRequest<{ items?: Array<Record<string, unknown>> }>("GET", "videos", {
    part: "id,snippet,status,recordingDetails,localizations",
    id,
  });
  const item = result.items?.[0];
  if (!item) throw new Error(`No video found for id ${id}.`);
  return item;
}

export async function getChannelForBrandingUpdate() {
  const result = await youtubeRequest<{ items?: Array<Record<string, unknown>> }>("GET", "channels", {
    part: "id,brandingSettings",
    mine: true,
  });
  const item = result.items?.[0];
  if (!item) throw new Error("No authorized channel found.");
  return item;
}

export async function getPlaylistById(id: string) {
  const result = await youtubeRequest<{ items?: Array<Record<string, unknown>> }>("GET", "playlists", {
    part: "id,snippet,status,contentDetails",
    id,
  });
  const item = result.items?.[0];
  if (!item) throw new Error(`No playlist found for id ${id}.`);
  return item;
}

export async function getPlaylistItemById(id: string) {
  const result = await youtubeRequest<{ items?: Array<Record<string, unknown>> }>("GET", "playlistItems", {
    part: "id,snippet,contentDetails,status",
    id,
  });
  const item = result.items?.[0];
  if (!item) throw new Error(`No playlist item found for id ${id}.`);
  return item;
}

export async function getLiveStreamById(id: string) {
  const result = await youtubeRequest<{ items?: Array<Record<string, unknown>> }>("GET", "liveStreams", {
    part: "id,snippet,cdn,status,contentDetails",
    id,
  });
  const item = result.items?.[0];
  if (!item) throw new Error(`No live stream found for id ${id}.`);
  return item;
}
