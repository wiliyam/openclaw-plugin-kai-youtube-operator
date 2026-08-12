import { youtubeRequest } from "./api.js";
export async function getBroadcastById(id, request = youtubeRequest) {
    const result = await request("GET", "liveBroadcasts", {
        part: "id,snippet,status,contentDetails",
        id,
    });
    const item = result.items?.[0];
    if (!item)
        throw new Error(`No live broadcast found for id ${id}.`);
    return item;
}
export async function getVideoById(id, request = youtubeRequest) {
    const result = await request("GET", "videos", {
        part: "id,snippet,status,recordingDetails,localizations",
        id,
    });
    const item = result.items?.[0];
    if (!item)
        throw new Error(`No video found for id ${id}.`);
    return item;
}
export async function getChannelForBrandingUpdate(request = youtubeRequest) {
    const result = await request("GET", "channels", {
        part: "id,brandingSettings",
        mine: true,
    });
    const item = result.items?.[0];
    if (!item)
        throw new Error("No authorized channel found.");
    return item;
}
export async function getPlaylistById(id, request = youtubeRequest) {
    const result = await request("GET", "playlists", {
        part: "id,snippet,status,contentDetails",
        id,
    });
    const item = result.items?.[0];
    if (!item)
        throw new Error(`No playlist found for id ${id}.`);
    return item;
}
export async function getPlaylistItemById(id, request = youtubeRequest) {
    const result = await request("GET", "playlistItems", {
        part: "id,snippet,contentDetails,status",
        id,
    });
    const item = result.items?.[0];
    if (!item)
        throw new Error(`No playlist item found for id ${id}.`);
    return item;
}
export async function getLiveStreamById(id, request = youtubeRequest) {
    const result = await request("GET", "liveStreams", {
        part: "id,snippet,cdn,status,contentDetails",
        id,
    });
    const item = result.items?.[0];
    if (!item)
        throw new Error(`No live stream found for id ${id}.`);
    return item;
}
