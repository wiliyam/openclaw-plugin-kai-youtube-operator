export type ManagerPrivacyStatus = "private" | "unlisted" | "public";
export type ContentFormat = "short" | "long" | "live" | "community" | "clip";
export type ContentStatus = "idea" | "script" | "recording" | "editing" | "review" | "ready" | "scheduled" | "published" | "archived";
export type AssetType = "video" | "thumbnail" | "audio" | "voiceover" | "caption" | "script" | "export" | "other";
export type ApprovalStatus = "pending" | "approved" | "rejected" | "cancelled";
export type CommentAction = "reply" | "like" | "hide_or_review" | "escalate" | "ignore";
export declare const MANAGER_STATE_PATH: string;
export interface UploadDefaults {
    privacyStatus: ManagerPrivacyStatus;
    categoryId?: string;
    defaultLanguage?: string;
    defaultAudioLanguage?: string;
    license?: "creativeCommon" | "youtube";
    embeddable?: boolean;
    publicStatsViewable?: boolean;
    selfDeclaredMadeForKids: boolean;
}
export interface BrandKit {
    channelName: string;
    voice: string;
    audience: string;
    styleNotes: string[];
    defaultHashtags: string[];
    defaultTags: string[];
    titlePatterns: string[];
    thumbnailRules: string[];
    descriptionTemplate: string;
    pinnedCommentTemplate: string;
    uploadDefaults: UploadDefaults;
}
export type BrandKitPatch = Omit<Partial<BrandKit>, "uploadDefaults"> & {
    uploadDefaults?: Partial<UploadDefaults>;
};
export interface ContentItem {
    id: string;
    title: string;
    format: ContentFormat;
    status: ContentStatus;
    summary?: string;
    scheduledFor?: string;
    playlistUrl?: string;
    tags: string[];
    sourcePaths: string[];
    outputPaths: string[];
    thumbnailPath?: string;
    scriptPath?: string;
    captionPath?: string;
    audioPath?: string;
    voiceoverPath?: string;
    videoId?: string;
    liveBroadcastId?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}
export interface AssetItem {
    id: string;
    type: AssetType;
    path: string;
    title?: string;
    contentId?: string;
    status: "available" | "draft" | "final" | "archived";
    notes?: string;
    createdAt: string;
    updatedAt: string;
}
export interface ApprovalRequest {
    id: string;
    action: string;
    targetType: string;
    targetId?: string;
    summary: string;
    status: ApprovalStatus;
    requestedAt: string;
    resolvedAt?: string;
    resolvedBy?: string;
    notes?: string;
}
export interface AuditLogEntry {
    id: string;
    action: string;
    targetType?: string;
    targetId?: string;
    summary: string;
    createdAt: string;
    actor?: string;
}
export interface AnalyticsPreset {
    id: string;
    title: string;
    metrics: string;
    dimensions?: string;
    filters?: string;
    sort?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}
export interface CommentRules {
    escalationKeywords: string[];
    spamKeywords: string[];
    positiveReplyTemplate: string;
    escalationNote: string;
}
export interface ChannelManagerState {
    version: 1;
    createdAt: string;
    updatedAt: string;
    brandKit: BrandKit;
    contentItems: ContentItem[];
    assets: AssetItem[];
    approvals: ApprovalRequest[];
    auditLog: AuditLogEntry[];
    analyticsPresets: AnalyticsPreset[];
    commentRules: CommentRules;
}
export interface UploadPacket {
    contentId: string;
    title: string;
    description: string;
    tags: string[];
    filePath?: string;
    thumbnailPath?: string;
    privacyStatus: ManagerPrivacyStatus;
    categoryId?: string;
    defaultLanguage?: string;
    defaultAudioLanguage?: string;
    license?: "creativeCommon" | "youtube";
    embeddable?: boolean;
    publicStatsViewable?: boolean;
    selfDeclaredMadeForKids: boolean;
    pinnedComment?: string;
    approvalReminder: string;
}
export interface CommentForTriage {
    id: string;
    author?: string;
    text: string;
}
export interface CommentTriageResult extends CommentForTriage {
    recommendedAction: CommentAction;
    reason: string;
    suggestedReply?: string;
}
export declare function createDefaultManagerState(now?: string): ChannelManagerState;
export declare function normalizeManagerState(value: unknown, now?: string): ChannelManagerState;
export declare function readManagerState(filePath?: string): Promise<ChannelManagerState>;
export declare function writeManagerState(state: ChannelManagerState, filePath?: string): Promise<ChannelManagerState>;
export declare function upsertBrandKit(state: ChannelManagerState, patch: BrandKitPatch, now?: string): ChannelManagerState;
export declare function upsertContentItem(state: ChannelManagerState, item: Partial<ContentItem> & {
    title?: string;
    format?: ContentFormat;
    status?: ContentStatus;
}, now?: string): {
    state: ChannelManagerState;
    item: ContentItem;
};
export declare function upsertAsset(state: ChannelManagerState, asset: Partial<AssetItem> & {
    path: string;
    type?: AssetType;
}, now?: string): {
    state: ChannelManagerState;
    asset: AssetItem;
};
export declare function upsertAnalyticsPreset(state: ChannelManagerState, preset: Partial<AnalyticsPreset> & {
    title: string;
    metrics: string;
}, now?: string): {
    state: ChannelManagerState;
    preset: AnalyticsPreset;
};
export declare function buildUploadPacketFromContent(state: ChannelManagerState, contentId: string, overrides?: Partial<UploadPacket> & {
    titleVariants?: string[];
    tags?: string[];
}): UploadPacket;
export declare function createApprovalRequest(state: ChannelManagerState, request: Partial<ApprovalRequest> & {
    action: string;
    targetType: string;
    summary: string;
}, now?: string): {
    state: ChannelManagerState;
    request: ApprovalRequest;
};
export declare function resolveApprovalRequest(state: ChannelManagerState, id: string, status: Exclude<ApprovalStatus, "pending">, actor?: string, now?: string, notes?: string): {
    state: ChannelManagerState;
    request: ApprovalRequest;
};
export declare function triageComments(state: ChannelManagerState, comments: CommentForTriage[]): CommentTriageResult[];
export declare function buildProductionChecklist(state: ChannelManagerState, contentId: string): {
    contentId: string;
    title: string;
    format: ContentFormat;
    status: ContentStatus;
    missing: string[];
    checkpoints: string[];
};
export declare function buildManagerBrief(state: ChannelManagerState, now?: string): {
    generatedAt: string;
    channelName: string | null;
    totals: {
        contentItems: number;
        assets: number;
        pendingApprovals: number;
        scheduled: number;
    };
    readyToPublish: ContentItem[];
    scheduled: ContentItem[];
    inProgress: ContentItem[];
    pendingApprovals: ApprovalRequest[];
    nextActions: string[];
};
