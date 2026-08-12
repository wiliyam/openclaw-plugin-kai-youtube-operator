import { homedir } from "node:os";
import path from "node:path";
import type { OAuthCapability } from "./types.js";

export const DATA_DIR = path.join(homedir(), "Kai", "youtube");
export const TOKEN_PATH = path.join(DATA_DIR, "oauth-token.json");
export const DEFAULT_REDIRECT_URI = "http://127.0.0.1:53682/oauth2callback";
export const GOOGLE_OAUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3";
export const YOUTUBE_UPLOAD_API_URL = "https://www.googleapis.com/upload/youtube/v3";
export const YOUTUBE_ANALYTICS_API_URL = "https://youtubeanalytics.googleapis.com/v2";
export const MAX_SIMPLE_UPLOAD_BYTES = 512 * 1024 * 1024;
export const DEFAULT_SHORTS_DIR = path.join(DATA_DIR, "shorts");
export const MAX_SHORT_DURATION_SECONDS = 180;

export const YOUTUBE_SCOPES: Record<OAuthCapability, string[]> = {
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

export const APPROVAL_ACTIONS = [
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

export const SUPPORTED_DATA_API_PATHS = new Set([
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
