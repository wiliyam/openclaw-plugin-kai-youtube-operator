import type { OAuthCapability, OAuthEnvironment, StoredToken } from "./types.js";
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
export declare function readStoredToken(): Promise<StoredToken | null>;
export declare function writeStoredToken(token: StoredToken): Promise<void>;
export declare function summarizeToken(token: StoredToken | null, now?: number): {
    present: boolean;
    hasRefreshToken: boolean;
    accessTokenValid: boolean;
    expiresAt: string | null;
    scopes: string[];
};
export declare function parseJsonResponse(response: Response): Promise<Record<string, unknown>>;
export declare function sanitizeError(data: Record<string, unknown>): string;
export declare function exchangeOAuthCode(code: string): Promise<ReturnType<typeof summarizeToken> & {
    savedTo: string;
}>;
export declare function refreshAccessTokenIfNeeded(): Promise<StoredToken>;
