import { describe, expect, it } from "vitest";
import type { QueryParams, YouTubeRequestMethod } from "../src/types.js";
import {
  getBroadcastById,
  getChannelForBrandingUpdate,
  getLiveStreamById,
  getPlaylistById,
  getPlaylistItemById,
  getVideoById,
} from "../src/youtube-resources.js";

type RequestCall = {
  method: YouTubeRequestMethod;
  resourcePath: string;
  query?: QueryParams;
};

function createFakeRequester(item: Record<string, unknown> | null, calls: RequestCall[]) {
  return async <T>(method: YouTubeRequestMethod, resourcePath: string, query?: QueryParams): Promise<T> => {
    calls.push({ method, resourcePath, query });
    return { items: item ? [item] : [] } as T;
  };
}

describe("youtube resource fetch helpers", () => {
  it("fetches existing resources through the injected requester", async () => {
    const calls: RequestCall[] = [];
    const request = createFakeRequester({ id: "resource-1" }, calls);

    await expect(getBroadcastById("broadcast-1", request)).resolves.toEqual({ id: "resource-1" });
    await expect(getVideoById("video-1", request)).resolves.toEqual({ id: "resource-1" });
    await expect(getChannelForBrandingUpdate(request)).resolves.toEqual({ id: "resource-1" });
    await expect(getPlaylistById("playlist-1", request)).resolves.toEqual({ id: "resource-1" });
    await expect(getPlaylistItemById("playlist-item-1", request)).resolves.toEqual({ id: "resource-1" });
    await expect(getLiveStreamById("stream-1", request)).resolves.toEqual({ id: "resource-1" });

    expect(calls.map((call) => call.resourcePath)).toEqual([
      "liveBroadcasts",
      "videos",
      "channels",
      "playlists",
      "playlistItems",
      "liveStreams",
    ]);
    expect(calls[2].query).toMatchObject({ mine: true });
  });

  it("throws clear not-found errors", async () => {
    const request = createFakeRequester(null, []);

    await expect(getVideoById("missing-video", request)).rejects.toThrow("No video found");
    await expect(getChannelForBrandingUpdate(request)).rejects.toThrow("No authorized channel");
  });
});
