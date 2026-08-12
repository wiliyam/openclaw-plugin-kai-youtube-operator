import { youtubeRequest } from "./api.js";
export async function getBroadcastById(id) {
    const result = await youtubeRequest("GET", "liveBroadcasts", {
        part: "id,snippet,status,contentDetails",
        id,
    });
    const item = result.items?.[0];
    if (!item)
        throw new Error(`No live broadcast found for id ${id}.`);
    return item;
}
export async function getVideoById(id) {
    const result = await youtubeRequest("GET", "videos", {
        part: "id,snippet,status,recordingDetails,localizations",
        id,
    });
    const item = result.items?.[0];
    if (!item)
        throw new Error(`No video found for id ${id}.`);
    return item;
}
export async function getChannelForBrandingUpdate() {
    const result = await youtubeRequest("GET", "channels", {
        part: "id,brandingSettings",
        mine: true,
    });
    const item = result.items?.[0];
    if (!item)
        throw new Error("No authorized channel found.");
    return item;
}
export async function getPlaylistById(id) {
    const result = await youtubeRequest("GET", "playlists", {
        part: "id,snippet,status,contentDetails",
        id,
    });
    const item = result.items?.[0];
    if (!item)
        throw new Error(`No playlist found for id ${id}.`);
    return item;
}
export async function getPlaylistItemById(id) {
    const result = await youtubeRequest("GET", "playlistItems", {
        part: "id,snippet,contentDetails,status",
        id,
    });
    const item = result.items?.[0];
    if (!item)
        throw new Error(`No playlist item found for id ${id}.`);
    return item;
}
export async function getLiveStreamById(id) {
    const result = await youtubeRequest("GET", "liveStreams", {
        part: "id,snippet,cdn,status,contentDetails",
        id,
    });
    const item = result.items?.[0];
    if (!item)
        throw new Error(`No live stream found for id ${id}.`);
    return item;
}
