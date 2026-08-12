import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Type } from "typebox";
import type { DefineToolPluginOptions } from "./openclaw-tool-plugin.js";
import { youtubeAnalyticsRequest, youtubeCaptionDownload, youtubeMediaUploadRequest, youtubeMultipartUploadRequest, youtubeRequest } from "./api.js";
import { DEFAULT_SHORTS_DIR, TOKEN_PATH } from "./constants.js";
import { inferMimeType } from "./mime.js";
import { addAudioToVideo, createShortFromVideo, createVoiceover, defaultShortOutputPath, extractThumbnail, generateFreeAudioBed, generateThumbnailCard, probeVideo } from "./media.js";
import { buildManagerBrief, buildProductionChecklist, buildUploadPacketFromContent, createApprovalRequest, MANAGER_STATE_PATH, readManagerState, resolveApprovalRequest, triageComments, upsertAnalyticsPreset, upsertAsset, upsertBrandKit, upsertContentItem, writeManagerState } from "./manager.js";
import { createOAuthUrl, exchangeOAuthCode, getOAuthEnvironment, readStoredToken, summarizeToken } from "./oauth.js";
import { assertAllowedDataApiPath, approvalGate, stripUndefined } from "./safety.js";
import { ApprovalResolutionSchema, AssetTypeSchema, AudioMixModeSchema, BroadcastStatusSchema, CapabilitySchema, CommentModerationStatusSchema, ContentFormatSchema, ContentStatusSchema, GeneratedAudioStyleSchema, JsonObjectSchema, LicenseSchema, LiveChatBanTypeSchema, LiveStreamIngestionSchema, OptionalJsonObjectSchema, PrivacySchema, QuerySchema, RequestMethodSchema, ShortAspectSchema, ShortFitSchema, TransitionSchema } from "./schemas.js";
import { buildLivePlan, studioCapabilities } from "./studio.js";
import type { YouTubeRequestMethod } from "./types.js";
import { buildChannelBrandingUpdateBody, buildCreateBroadcastBody, buildLiveStreamBody, buildPlaylistBody, buildPlaylistItemUpdate, buildVideoInsertBody, buildVideoUpdateBody, mergeBroadcastUpdate, mergeLiveStreamUpdate, mergePlaylistUpdate } from "./youtube-bodies.js";
import { getBroadcastById, getChannelForBrandingUpdate, getLiveStreamById, getPlaylistById, getPlaylistItemById, getVideoById } from "./youtube-resources.js";

type ToolFactory = Parameters<DefineToolPluginOptions["tools"]>[0];
type ToolList = ReturnType<DefineToolPluginOptions["tools"]>;

export function createYoutubeTools(tool: ToolFactory): ToolList {
  return [
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
          if (!gate.ok) return gate;
        }
        return youtubeRequest(method as YouTubeRequestMethod, resourcePath, query, body);
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
        if (!gate.ok) return gate;
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
        if (!gate.ok) return gate;
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
        if (!gate.ok) return gate;
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
        if (!gate.ok) return gate;
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
            const channel = await youtubeRequest<{ items?: Array<{ contentDetails?: { relatedPlaylists?: { uploads?: string } } }> }>("GET", "channels", {
              part: "contentDetails",
              mine: true,
            });
            uploadsPlaylistId = channel.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
          }
          if (!uploadsPlaylistId) throw new Error("No uploads playlist found for the authorized channel.");
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
        if (!gate.ok) return gate;
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
        if (!gate.ok) return gate;
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
        if (!gate.ok) return gate;
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
        if (!gate.ok) return gate;
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
        if (!gate.ok) return gate;
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
        if (!gate.ok) return gate;
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
        if (!gate.ok) return gate;
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
        if (!gate.ok) return gate;
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
        if (!gate.ok) return gate;
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
        if (!gate.ok) return gate;
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
        if (!gate.ok) return gate;
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
        if (!gate.ok) return gate;
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
        if (!gate.ok) return gate;
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
        if (!gate.ok) return gate;
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
        if (!gate.ok) return gate;
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
        if (!gate.ok) return gate;
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
        if (!gate.ok) return gate;
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
        if (!gate.ok) return gate;
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
        if (!gate.ok) return gate;
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
        if (!gate.ok) return gate;
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
        if (!gate.ok) return gate;
        if (operation === "update" && !id) throw new Error("Caption id is required for update.");
        if (operation === "insert" && !videoId) throw new Error("videoId is required for insert.");
        const mediaContent = filePath ? await readFile(filePath) : content;
        if (!mediaContent) throw new Error("Provide caption content or filePath.");
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
        if (!gate.ok) return gate;
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
        if (!gate.ok) return gate;
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
        if (!gate.ok) return gate;
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
        if (!gate.ok) return gate;
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
        if (!gate.ok) return gate;
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
        if (!gate.ok) return gate;
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
        if (!gate.ok) return gate;
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
        if (!gate.ok) return gate;
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
        if (!gate.ok) return gate;
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
        if (!gate.ok) return gate;
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
        if (!gate.ok) return gate;
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
        if (!gate.ok) return gate;
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
        if (!gate.ok) return gate;
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
        if (!gate.ok) return gate;
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
        if (!gate.ok) return gate;
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
        if (!gate.ok) return gate;
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
  ];
}
