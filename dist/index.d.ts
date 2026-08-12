export { buildManagerBrief, buildProductionChecklist, buildUploadPacketFromContent, createApprovalRequest, createDefaultManagerState, resolveApprovalRequest, triageComments, upsertBrandKit, upsertContentItem, } from "./manager.js";
export type OAuthCapability = "readonly" | "upload" | "live_control" | "analytics" | "monetary_analytics" | "full_channel";
export type PrivacyStatus = "private" | "unlisted" | "public";
export type BroadcastStatus = "active" | "all" | "completed" | "upcoming";
export type BroadcastTransition = "testing" | "live" | "complete";
export type YouTubeRequestMethod = "GET" | "POST" | "PUT" | "DELETE";
export type ShortAspect = "source" | "vertical_9_16" | "square_1_1";
export type ShortFit = "crop" | "pad";
export type AudioMixMode = "replace" | "mix" | "duck";
export type GeneratedAudioStyle = "ambient_pad" | "soft_pulse" | "clean_tone" | "white_noise" | "silence";
export interface OAuthEnvironment {
    clientIdConfigured: boolean;
    clientSecretConfigured: boolean;
    redirectUri: string;
}
export interface StoredToken {
    access_token?: string;
    refresh_token?: string;
    scope?: string;
    token_type?: string;
    expiry_date?: number;
}
type JsonObject = Record<string, unknown>;
export declare const YOUTUBE_SCOPES: Record<OAuthCapability, string[]>;
export declare function getOAuthEnvironment(env?: NodeJS.ProcessEnv): OAuthEnvironment;
export declare function scopesForCapability(capability: OAuthCapability, extraScopes?: string[]): string[];
export declare function createOAuthUrl(params: {
    capability?: OAuthCapability;
    extraScopes?: string[];
    state?: string;
    env?: NodeJS.ProcessEnv;
}): {
    configured: boolean;
    error: string;
    requiredEnv: string[];
    authUrl?: undefined;
    redirectUri?: undefined;
    capability?: undefined;
    scopes?: undefined;
    state?: undefined;
    nextStep?: undefined;
} | {
    configured: boolean;
    authUrl: string;
    redirectUri: string;
    capability: OAuthCapability;
    scopes: string[];
    state: string;
    nextStep: string;
    error?: undefined;
    requiredEnv?: undefined;
};
export declare function summarizeToken(token: StoredToken | null, now?: number): {
    present: boolean;
    hasRefreshToken: boolean;
    accessTokenValid: boolean;
    expiresAt: string | null;
    scopes: string[];
};
export declare function exchangeOAuthCode(code: string): Promise<ReturnType<typeof summarizeToken> & {
    savedTo: string;
}>;
export declare function assertAllowedDataApiPath(resourcePath: string): void;
export declare function stripUndefined<T>(value: T): T;
export declare function redactSensitive(value: unknown): unknown;
export declare function approvalGate(approved: boolean | undefined, action: string): {
    ok: true;
    blocked?: undefined;
    approvalRequired?: undefined;
    action?: undefined;
    message?: undefined;
    approvalActions?: undefined;
} | {
    ok: false;
    blocked: boolean;
    approvalRequired: boolean;
    action: string;
    message: string;
    approvalActions: string[];
};
export declare function buildShortCreateArgs(params: {
    inputPath: string;
    outputPath: string;
    startTime?: string;
    durationSeconds?: number;
    aspect?: ShortAspect;
    fit?: ShortFit;
    topText?: string;
    bottomText?: string;
    fontFile?: string;
    captionFilePath?: string;
    crf?: number;
    preset?: string;
    overwrite?: boolean;
    removeAudio?: boolean;
}): string[];
export declare function buildThumbnailExtractArgs(params: {
    inputPath: string;
    outputPath: string;
    time?: string;
    width?: number;
    height?: number;
    overwrite?: boolean;
}): string[];
export declare function buildThumbnailGenerateArgs(params: {
    outputPath: string;
    inputPath?: string;
    time?: string;
    width?: number;
    height?: number;
    title?: string;
    subtitle?: string;
    badge?: string;
    backgroundColor?: string;
    fontFile?: string;
    overwrite?: boolean;
}): string[];
export declare function buildGeneratedAudioArgs(params: {
    outputPath: string;
    durationSeconds: number;
    style?: GeneratedAudioStyle;
    volume?: number;
    overwrite?: boolean;
}): string[];
export declare function buildAudioMixArgs(params: {
    inputPath: string;
    audioPath: string;
    outputPath: string;
    mode?: AudioMixMode;
    originalVolume?: number;
    addedVolume?: number;
    overwrite?: boolean;
}): string[];
export declare function buildVoiceoverArgs(params: {
    text: string;
    outputPath: string;
    voice?: string;
    speedWpm?: number;
    pitch?: number;
}): string[];
export declare function buildLivePlan(params: {
    goal: "schedule" | "update" | "go_live" | "end_live" | "chat_moderation" | "status_check";
    title?: string;
    notes?: string;
}): {
    goal: "schedule" | "update" | "go_live" | "end_live" | "chat_moderation" | "status_check";
    title: string | null;
    plan: string[];
    approvalRequiredBefore: string[];
    notes: string;
};
export declare function buildCreateBroadcastBody(params: {
    title: string;
    description?: string;
    scheduledStartTime: string;
    scheduledEndTime?: string;
    privacyStatus?: PrivacyStatus;
    selfDeclaredMadeForKids?: boolean;
    enableAutoStart?: boolean;
    enableAutoStop?: boolean;
    enableDvr?: boolean;
    recordFromStart?: boolean;
    enableMonitorStream?: boolean;
    broadcastStreamDelayMs?: number;
}): {
    snippet: {
        title: string;
        description: string | undefined;
        scheduledStartTime: string;
        scheduledEndTime: string | undefined;
    };
    status: {
        privacyStatus: PrivacyStatus;
        selfDeclaredMadeForKids: boolean;
    };
    contentDetails: {
        enableAutoStart: boolean | undefined;
        enableAutoStop: boolean | undefined;
        enableDvr: boolean;
        recordFromStart: boolean;
        monitorStream: {
            enableMonitorStream: boolean;
            broadcastStreamDelayMs: number | undefined;
        };
    };
};
export declare function buildVideoUpdateBody(existing: Record<string, unknown>, params: {
    title?: string;
    description?: string;
    tags?: string[];
    categoryId?: string;
    defaultLanguage?: string;
    defaultAudioLanguage?: string;
    privacyStatus?: PrivacyStatus;
    publishAt?: string;
    embeddable?: boolean;
    license?: "creativeCommon" | "youtube";
    publicStatsViewable?: boolean;
    selfDeclaredMadeForKids?: boolean;
    recordingDate?: string;
    locationDescription?: string;
    latitude?: number;
    longitude?: number;
    altitude?: number;
    localizations?: Record<string, unknown>;
}): {
    part: string;
    body: JsonObject;
};
export declare function studioCapabilities(): {
    apiBacked: string[];
    notApiBacked: string[];
    safety: string[];
};
declare const _default: import("openclaw/plugin-sdk/tool-plugin").DefinedToolPluginEntry;
export default _default;
