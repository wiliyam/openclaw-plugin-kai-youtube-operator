import { defineToolPlugin } from "./openclaw-tool-plugin.js";
import { createYoutubeTools } from "./tools.js";
export * from "./types.js";
export { YOUTUBE_SCOPES } from "./constants.js";
export { youtubeAnalyticsRequest, youtubeCaptionDownload, youtubeMediaUploadRequest, youtubeMultipartUploadRequest, youtubeRequest } from "./api.js";
export { getOAuthEnvironment, scopesForCapability, createOAuthUrl, exchangeOAuthCode, summarizeToken } from "./oauth.js";
export { assertAllowedDataApiPath, stripUndefined, redactSensitive, approvalGate } from "./safety.js";
export { inferMimeType } from "./mime.js";
export { buildAudioMixArgs, buildGeneratedAudioArgs, buildShortCreateArgs, buildThumbnailExtractArgs, buildThumbnailGenerateArgs, buildVoiceoverArgs } from "./media.js";
export { buildLivePlan, studioCapabilities } from "./studio.js";
export { buildCreateBroadcastBody, buildVideoUpdateBody } from "./youtube-bodies.js";
export { buildManagerBrief, buildProductionChecklist, buildUploadPacketFromContent, createApprovalRequest, createDefaultManagerState, resolveApprovalRequest, triageComments, upsertBrandKit, upsertContentItem, } from "./manager.js";
export default defineToolPlugin({
    id: "kai-youtube-operator",
    name: "Kai YouTube Operator",
    description: "Safe YouTube Studio, channel-manager, video, OAuth, live broadcast, and live chat tools for Kai.",
    tools: createYoutubeTools,
});
