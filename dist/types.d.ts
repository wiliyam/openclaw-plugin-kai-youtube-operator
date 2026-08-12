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
export interface OAuthConfig {
    clientId: string;
    clientSecret?: string;
    redirectUri: string;
}
export interface YouTubeApiError {
    error?: {
        code?: number;
        message?: string;
        status?: string;
        errors?: Array<{
            reason?: string;
            message?: string;
        }>;
    };
}
export type QueryValue = string | number | boolean | undefined;
export type QueryParams = Record<string, QueryValue>;
export type JsonObject = Record<string, unknown>;
export interface CommandResult {
    command: string;
    args: string[];
    stdout: string;
    stderr: string;
}
