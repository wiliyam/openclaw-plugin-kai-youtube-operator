import { stripUndefined } from "./safety.js";
import type { JsonObject, PrivacyStatus } from "./types.js";

export function buildCreateBroadcastBody(params: {
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
}) {
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


export function mergeBroadcastUpdate(existing: Record<string, unknown>, params: {
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
}) {
  const snippet = existing.snippet as Record<string, unknown> | undefined;
  const status = existing.status as Record<string, unknown> | undefined;
  const contentDetails = existing.contentDetails as Record<string, unknown> | undefined;

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

export function buildVideoUpdateBody(existing: Record<string, unknown>, params: {
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
}) {
  const snippet = existing.snippet as Record<string, unknown> | undefined;
  const status = existing.status as Record<string, unknown> | undefined;
  const recordingDetails = existing.recordingDetails as Record<string, unknown> | undefined;
  const existingLocation = recordingDetails?.location as Record<string, unknown> | undefined;
  const parts = new Set<string>();
  const body: JsonObject = { id: existing.id };

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

export function buildVideoInsertBody(params: {
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
}) {
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

export function buildChannelBrandingUpdateBody(existing: Record<string, unknown>, params: {
  title?: string;
  description?: string;
  keywords?: string;
  country?: string;
  defaultLanguage?: string;
  trackingAnalyticsAccountId?: string;
  unsubscribedTrailer?: string;
}) {
  const brandingSettings = existing.brandingSettings as Record<string, unknown> | undefined;
  const channel = brandingSettings?.channel as Record<string, unknown> | undefined;
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

export function buildPlaylistBody(params: {
  title: string;
  description?: string;
  privacyStatus?: PrivacyStatus;
  tags?: string[];
  defaultLanguage?: string;
}) {
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

export function mergePlaylistUpdate(existing: Record<string, unknown>, params: {
  title?: string;
  description?: string;
  privacyStatus?: PrivacyStatus;
  tags?: string[];
  defaultLanguage?: string;
}) {
  const snippet = existing.snippet as Record<string, unknown> | undefined;
  const status = existing.status as Record<string, unknown> | undefined;
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

export function buildPlaylistItemUpdate(existing: Record<string, unknown>, params: {
  playlistId?: string;
  videoId?: string;
  position?: number;
  note?: string;
}) {
  const snippet = existing.snippet as Record<string, unknown> | undefined;
  const resourceId = snippet?.resourceId as Record<string, unknown> | undefined;
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

export function buildLiveStreamBody(params: {
  title: string;
  description?: string;
  ingestionType?: "dash" | "hls" | "rtmp";
  resolution?: string;
  frameRate?: string;
  isReusable?: boolean;
}) {
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

export function mergeLiveStreamUpdate(existing: Record<string, unknown>, params: {
  title?: string;
  description?: string;
}) {
  const snippet = existing.snippet as Record<string, unknown> | undefined;
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
