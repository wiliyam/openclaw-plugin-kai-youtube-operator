import type { JsonObject, PrivacyStatus } from "./types.js";
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
export declare function mergeBroadcastUpdate(existing: Record<string, unknown>, params: {
    title?: string;
    description?: string;
    scheduledStartTime?: string;
    scheduledEndTime?: string;
    privacyStatus?: PrivacyStatus;
    selfDeclaredMadeForKids?: boolean;
    enableAutoStart?: boolean;
    enableAutoStop?: boolean;
    enableDvr?: boolean;
    recordFromStart?: boolean;
}): {
    id: unknown;
    snippet: {
        title: unknown;
        description: unknown;
        scheduledStartTime: unknown;
        scheduledEndTime: unknown;
    };
    status: {
        privacyStatus: unknown;
        selfDeclaredMadeForKids: unknown;
    };
    contentDetails: {
        enableAutoStart: unknown;
        enableAutoStop: unknown;
        enableDvr: unknown;
        recordFromStart: unknown;
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
export declare function buildVideoInsertBody(params: {
    title: string;
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
}): {
    part: string;
    body: {
        snippet: {
            title: string;
            description: string | undefined;
            tags: string[] | undefined;
            categoryId: string | undefined;
            defaultLanguage: string | undefined;
            defaultAudioLanguage: string | undefined;
        };
        status: {
            privacyStatus: PrivacyStatus;
            publishAt: string | undefined;
            embeddable: boolean | undefined;
            license: "youtube" | "creativeCommon" | undefined;
            publicStatsViewable: boolean | undefined;
            selfDeclaredMadeForKids: boolean;
        };
        recordingDetails: {
            recordingDate: string | undefined;
            locationDescription: string | undefined;
            location: {
                latitude: number | undefined;
                longitude: number | undefined;
                altitude: number | undefined;
            };
        } | undefined;
    };
};
export declare function buildChannelBrandingUpdateBody(existing: Record<string, unknown>, params: {
    title?: string;
    description?: string;
    keywords?: string;
    country?: string;
    defaultLanguage?: string;
    trackingAnalyticsAccountId?: string;
    unsubscribedTrailer?: string;
}): {
    id: unknown;
    brandingSettings: {
        channel: {
            title: unknown;
            description: unknown;
            keywords: unknown;
            country: unknown;
            defaultLanguage: unknown;
            trackingAnalyticsAccountId: unknown;
            unsubscribedTrailer: unknown;
        };
    };
};
export declare function buildPlaylistBody(params: {
    title: string;
    description?: string;
    privacyStatus?: PrivacyStatus;
    tags?: string[];
    defaultLanguage?: string;
}): {
    snippet: {
        title: string;
        description: string | undefined;
        tags: string[] | undefined;
        defaultLanguage: string | undefined;
    };
    status: {
        privacyStatus: PrivacyStatus;
    };
};
export declare function mergePlaylistUpdate(existing: Record<string, unknown>, params: {
    title?: string;
    description?: string;
    privacyStatus?: PrivacyStatus;
    tags?: string[];
    defaultLanguage?: string;
}): {
    id: unknown;
    snippet: {
        title: unknown;
        description: unknown;
        tags: unknown;
        defaultLanguage: unknown;
    };
    status: {
        privacyStatus: unknown;
    };
};
export declare function buildPlaylistItemUpdate(existing: Record<string, unknown>, params: {
    playlistId?: string;
    videoId?: string;
    position?: number;
    note?: string;
}): {
    id: unknown;
    snippet: {
        playlistId: unknown;
        resourceId: {
            kind: string;
            videoId: unknown;
        };
        position: unknown;
        note: unknown;
    };
};
export declare function buildLiveStreamBody(params: {
    title: string;
    description?: string;
    ingestionType?: "dash" | "hls" | "rtmp";
    resolution?: string;
    frameRate?: string;
    isReusable?: boolean;
}): {
    snippet: {
        title: string;
        description: string | undefined;
    };
    cdn: {
        ingestionType: "dash" | "hls" | "rtmp";
        resolution: string;
        frameRate: string;
    };
    contentDetails: {
        isReusable: boolean;
    };
};
export declare function mergeLiveStreamUpdate(existing: Record<string, unknown>, params: {
    title?: string;
    description?: string;
}): {
    id: unknown;
    snippet: {
        title: unknown;
        description: unknown;
    };
    cdn: unknown;
    contentDetails: unknown;
};
