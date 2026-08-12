import { stripUndefined } from "./safety.js";
export function buildCreateBroadcastBody(params) {
    return stripUndefined({
        snippet: {
            title: params.title,
            description: params.description,
            scheduledStartTime: params.scheduledStartTime,
            scheduledEndTime: params.scheduledEndTime,
        },
        status: {
            privacyStatus: params.privacyStatus ?? "private",
            selfDeclaredMadeForKids: params.selfDeclaredMadeForKids ?? false,
        },
        contentDetails: {
            enableAutoStart: params.enableAutoStart,
            enableAutoStop: params.enableAutoStop,
            enableDvr: params.enableDvr ?? true,
            recordFromStart: params.recordFromStart ?? true,
            monitorStream: {
                enableMonitorStream: params.enableMonitorStream ?? true,
                broadcastStreamDelayMs: params.broadcastStreamDelayMs,
            },
        },
    });
}
export function mergeBroadcastUpdate(existing, params) {
    const snippet = existing.snippet;
    const status = existing.status;
    const contentDetails = existing.contentDetails;
    return stripUndefined({
        id: existing.id,
        snippet: {
            ...snippet,
            title: params.title ?? snippet?.title,
            description: params.description ?? snippet?.description,
            scheduledStartTime: params.scheduledStartTime ?? snippet?.scheduledStartTime,
            scheduledEndTime: params.scheduledEndTime ?? snippet?.scheduledEndTime,
        },
        status: {
            ...status,
            privacyStatus: params.privacyStatus ?? status?.privacyStatus,
            selfDeclaredMadeForKids: params.selfDeclaredMadeForKids ?? status?.selfDeclaredMadeForKids,
        },
        contentDetails: {
            ...contentDetails,
            enableAutoStart: params.enableAutoStart ?? contentDetails?.enableAutoStart,
            enableAutoStop: params.enableAutoStop ?? contentDetails?.enableAutoStop,
            enableDvr: params.enableDvr ?? contentDetails?.enableDvr,
            recordFromStart: params.recordFromStart ?? contentDetails?.recordFromStart,
        },
    });
}
export function buildVideoUpdateBody(existing, params) {
    const snippet = existing.snippet;
    const status = existing.status;
    const recordingDetails = existing.recordingDetails;
    const existingLocation = recordingDetails?.location;
    const parts = new Set();
    const body = { id: existing.id };
    const hasSnippetUpdate = [
        params.title,
        params.description,
        params.tags,
        params.categoryId,
        params.defaultLanguage,
        params.defaultAudioLanguage,
    ].some((value) => value !== undefined);
    if (hasSnippetUpdate) {
        parts.add("snippet");
        body.snippet = stripUndefined({
            title: params.title ?? snippet?.title,
            description: params.description ?? snippet?.description,
            tags: params.tags ?? snippet?.tags,
            categoryId: params.categoryId ?? snippet?.categoryId,
            defaultLanguage: params.defaultLanguage ?? snippet?.defaultLanguage,
            defaultAudioLanguage: params.defaultAudioLanguage ?? snippet?.defaultAudioLanguage,
        });
    }
    const hasStatusUpdate = [
        params.privacyStatus,
        params.publishAt,
        params.embeddable,
        params.license,
        params.publicStatsViewable,
        params.selfDeclaredMadeForKids,
    ].some((value) => value !== undefined);
    if (hasStatusUpdate) {
        parts.add("status");
        body.status = stripUndefined({
            privacyStatus: params.privacyStatus ?? status?.privacyStatus,
            publishAt: params.publishAt ?? status?.publishAt,
            embeddable: params.embeddable ?? status?.embeddable,
            license: params.license ?? status?.license,
            publicStatsViewable: params.publicStatsViewable ?? status?.publicStatsViewable,
            selfDeclaredMadeForKids: params.selfDeclaredMadeForKids ?? status?.selfDeclaredMadeForKids,
        });
    }
    const hasRecordingUpdate = [
        params.recordingDate,
        params.locationDescription,
        params.latitude,
        params.longitude,
        params.altitude,
    ].some((value) => value !== undefined);
    if (hasRecordingUpdate) {
        parts.add("recordingDetails");
        body.recordingDetails = stripUndefined({
            recordingDate: params.recordingDate ?? recordingDetails?.recordingDate,
            locationDescription: params.locationDescription ?? recordingDetails?.locationDescription,
            location: {
                latitude: params.latitude ?? existingLocation?.latitude,
                longitude: params.longitude ?? existingLocation?.longitude,
                altitude: params.altitude ?? existingLocation?.altitude,
            },
        });
    }
    if (params.localizations !== undefined) {
        parts.add("localizations");
        body.localizations = params.localizations;
    }
    if (parts.size === 0) {
        throw new Error("No video metadata updates were provided.");
    }
    return {
        part: [...parts].join(","),
        body: stripUndefined(body),
    };
}
export function buildVideoInsertBody(params) {
    const hasRecordingDetails = [
        params.recordingDate,
        params.locationDescription,
        params.latitude,
        params.longitude,
        params.altitude,
    ].some((value) => value !== undefined);
    return {
        part: hasRecordingDetails ? "snippet,status,recordingDetails" : "snippet,status",
        body: stripUndefined({
            snippet: {
                title: params.title,
                description: params.description,
                tags: params.tags,
                categoryId: params.categoryId,
                defaultLanguage: params.defaultLanguage,
                defaultAudioLanguage: params.defaultAudioLanguage,
            },
            status: {
                privacyStatus: params.privacyStatus ?? "private",
                publishAt: params.publishAt,
                embeddable: params.embeddable,
                license: params.license,
                publicStatsViewable: params.publicStatsViewable,
                selfDeclaredMadeForKids: params.selfDeclaredMadeForKids ?? false,
            },
            recordingDetails: hasRecordingDetails ? {
                recordingDate: params.recordingDate,
                locationDescription: params.locationDescription,
                location: {
                    latitude: params.latitude,
                    longitude: params.longitude,
                    altitude: params.altitude,
                },
            } : undefined,
        }),
    };
}
export function buildChannelBrandingUpdateBody(existing, params) {
    const brandingSettings = existing.brandingSettings;
    const channel = brandingSettings?.channel;
    return stripUndefined({
        id: existing.id,
        brandingSettings: {
            ...brandingSettings,
            channel: {
                ...channel,
                title: params.title ?? channel?.title,
                description: params.description ?? channel?.description,
                keywords: params.keywords ?? channel?.keywords,
                country: params.country ?? channel?.country,
                defaultLanguage: params.defaultLanguage ?? channel?.defaultLanguage,
                trackingAnalyticsAccountId: params.trackingAnalyticsAccountId ?? channel?.trackingAnalyticsAccountId,
                unsubscribedTrailer: params.unsubscribedTrailer ?? channel?.unsubscribedTrailer,
            },
        },
    });
}
export function buildPlaylistBody(params) {
    return stripUndefined({
        snippet: {
            title: params.title,
            description: params.description,
            tags: params.tags,
            defaultLanguage: params.defaultLanguage,
        },
        status: {
            privacyStatus: params.privacyStatus ?? "private",
        },
    });
}
export function mergePlaylistUpdate(existing, params) {
    const snippet = existing.snippet;
    const status = existing.status;
    return stripUndefined({
        id: existing.id,
        snippet: {
            ...snippet,
            title: params.title ?? snippet?.title,
            description: params.description ?? snippet?.description,
            tags: params.tags ?? snippet?.tags,
            defaultLanguage: params.defaultLanguage ?? snippet?.defaultLanguage,
        },
        status: {
            ...status,
            privacyStatus: params.privacyStatus ?? status?.privacyStatus,
        },
    });
}
export function buildPlaylistItemUpdate(existing, params) {
    const snippet = existing.snippet;
    const resourceId = snippet?.resourceId;
    return stripUndefined({
        id: existing.id,
        snippet: {
            ...snippet,
            playlistId: params.playlistId ?? snippet?.playlistId,
            resourceId: {
                kind: "youtube#video",
                videoId: params.videoId ?? resourceId?.videoId,
            },
            position: params.position ?? snippet?.position,
            note: params.note ?? snippet?.note,
        },
    });
}
export function buildLiveStreamBody(params) {
    return stripUndefined({
        snippet: {
            title: params.title,
            description: params.description,
        },
        cdn: {
            ingestionType: params.ingestionType ?? "rtmp",
            resolution: params.resolution ?? "variable",
            frameRate: params.frameRate ?? "variable",
        },
        contentDetails: {
            isReusable: params.isReusable ?? true,
        },
    });
}
export function mergeLiveStreamUpdate(existing, params) {
    const snippet = existing.snippet;
    return stripUndefined({
        id: existing.id,
        snippet: {
            ...snippet,
            title: params.title ?? snippet?.title,
            description: params.description ?? snippet?.description,
        },
        cdn: existing.cdn,
        contentDetails: existing.contentDetails,
    });
}
