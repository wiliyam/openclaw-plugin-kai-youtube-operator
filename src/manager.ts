import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

export type ManagerPrivacyStatus = "private" | "unlisted" | "public";
export type ContentFormat = "short" | "long" | "live" | "community" | "clip";
export type ContentStatus =
  | "idea"
  | "script"
  | "recording"
  | "editing"
  | "review"
  | "ready"
  | "scheduled"
  | "published"
  | "archived";
export type AssetType = "video" | "thumbnail" | "audio" | "voiceover" | "caption" | "script" | "export" | "other";
export type ApprovalStatus = "pending" | "approved" | "rejected" | "cancelled";
export type CommentAction = "reply" | "like" | "hide_or_review" | "escalate" | "ignore";

const MANAGER_DIR = path.join(homedir(), "Kai", "youtube");
export const MANAGER_STATE_PATH = path.join(MANAGER_DIR, "channel-manager.json");

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

export function createDefaultManagerState(now = new Date().toISOString()): ChannelManagerState {
  return {
    version: 1,
    createdAt: now,
    updatedAt: now,
    brandKit: {
      channelName: "",
      voice: "Clear, helpful, and concise.",
      audience: "",
      styleNotes: [],
      defaultHashtags: [],
      defaultTags: [],
      titlePatterns: [],
      thumbnailRules: [
        "Use readable text at mobile size.",
        "Keep one clear focal point.",
      ],
      descriptionTemplate: "{{summary}}\n\n{{hashtags}}",
      pinnedCommentTemplate: "",
      uploadDefaults: {
        privacyStatus: "private",
        selfDeclaredMadeForKids: false,
        license: "youtube",
        embeddable: true,
        publicStatsViewable: true,
      },
    },
    contentItems: [],
    assets: [],
    approvals: [],
    auditLog: [],
    analyticsPresets: [
      {
        id: "weekly-overview",
        title: "Weekly overview",
        metrics: "views,estimatedMinutesWatched,averageViewDuration,likes,comments,subscribersGained",
        dimensions: "day",
        sort: "day",
        notes: "General weekly channel health.",
        createdAt: now,
        updatedAt: now,
      },
    ],
    commentRules: {
      escalationKeywords: ["sponsor", "copyright", "strike", "legal", "privacy", "brand deal"],
      spamKeywords: ["buy followers", "free subscribers", "telegram me", "whatsapp me", "crypto giveaway"],
      positiveReplyTemplate: "Thanks for watching. Glad it landed.",
      escalationNote: "Needs owner review before replying or moderating.",
    },
  };
}

export function normalizeManagerState(value: unknown, now = new Date().toISOString()): ChannelManagerState {
  if (!value || typeof value !== "object") return createDefaultManagerState(now);
  const incoming = value as Partial<ChannelManagerState>;
  const defaults = createDefaultManagerState(now);
  return {
    ...defaults,
    ...incoming,
    version: 1,
    brandKit: {
      ...defaults.brandKit,
      ...(incoming.brandKit ?? {}),
      uploadDefaults: {
        ...defaults.brandKit.uploadDefaults,
        ...(incoming.brandKit?.uploadDefaults ?? {}),
      },
    },
    commentRules: {
      ...defaults.commentRules,
      ...(incoming.commentRules ?? {}),
    },
    contentItems: incoming.contentItems ?? [],
    assets: incoming.assets ?? [],
    approvals: incoming.approvals ?? [],
    auditLog: incoming.auditLog ?? [],
    analyticsPresets: incoming.analyticsPresets ?? defaults.analyticsPresets,
    createdAt: incoming.createdAt ?? now,
    updatedAt: incoming.updatedAt ?? now,
  };
}

export async function readManagerState(filePath = MANAGER_STATE_PATH): Promise<ChannelManagerState> {
  try {
    const raw = await readFile(filePath, "utf8");
    return normalizeManagerState(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      const state = createDefaultManagerState();
      await writeManagerState(state, filePath);
      return state;
    }
    throw error;
  }
}

export async function writeManagerState(state: ChannelManagerState, filePath = MANAGER_STATE_PATH): Promise<ChannelManagerState> {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  await writeFile(filePath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  return state;
}

export function upsertBrandKit(
  state: ChannelManagerState,
  patch: BrandKitPatch,
  now = new Date().toISOString(),
): ChannelManagerState {
  return {
    ...state,
    updatedAt: now,
    brandKit: {
      ...state.brandKit,
      ...patch,
      uploadDefaults: {
        ...state.brandKit.uploadDefaults,
        ...(patch.uploadDefaults ?? {}),
      },
    },
  };
}

export function upsertContentItem(
  state: ChannelManagerState,
  item: Partial<ContentItem> & { title?: string; format?: ContentFormat; status?: ContentStatus },
  now = new Date().toISOString(),
): { state: ChannelManagerState; item: ContentItem } {
  const id = item.id ?? createId("content");
  const existing = state.contentItems.find((entry) => entry.id === id);
  const merged: ContentItem = {
    id,
    title: item.title ?? existing?.title ?? "Untitled content",
    format: item.format ?? existing?.format ?? "short",
    status: item.status ?? existing?.status ?? "idea",
    summary: item.summary ?? existing?.summary,
    scheduledFor: item.scheduledFor ?? existing?.scheduledFor,
    playlistUrl: item.playlistUrl ?? existing?.playlistUrl,
    tags: item.tags ?? existing?.tags ?? [],
    sourcePaths: item.sourcePaths ?? existing?.sourcePaths ?? [],
    outputPaths: item.outputPaths ?? existing?.outputPaths ?? [],
    thumbnailPath: item.thumbnailPath ?? existing?.thumbnailPath,
    scriptPath: item.scriptPath ?? existing?.scriptPath,
    captionPath: item.captionPath ?? existing?.captionPath,
    audioPath: item.audioPath ?? existing?.audioPath,
    voiceoverPath: item.voiceoverPath ?? existing?.voiceoverPath,
    videoId: item.videoId ?? existing?.videoId,
    liveBroadcastId: item.liveBroadcastId ?? existing?.liveBroadcastId,
    notes: item.notes ?? existing?.notes,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  return {
    item: merged,
    state: {
      ...state,
      updatedAt: now,
      contentItems: existing
        ? state.contentItems.map((entry) => entry.id === id ? merged : entry)
        : [...state.contentItems, merged],
    },
  };
}

export function upsertAsset(
  state: ChannelManagerState,
  asset: Partial<AssetItem> & { path: string; type?: AssetType },
  now = new Date().toISOString(),
): { state: ChannelManagerState; asset: AssetItem } {
  const id = asset.id ?? createId("asset");
  const existing = state.assets.find((entry) => entry.id === id);
  const merged: AssetItem = {
    id,
    type: asset.type ?? existing?.type ?? "other",
    path: asset.path,
    title: asset.title ?? existing?.title,
    contentId: asset.contentId ?? existing?.contentId,
    status: asset.status ?? existing?.status ?? "available",
    notes: asset.notes ?? existing?.notes,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  return {
    asset: merged,
    state: {
      ...state,
      updatedAt: now,
      assets: existing
        ? state.assets.map((entry) => entry.id === id ? merged : entry)
        : [...state.assets, merged],
    },
  };
}

export function upsertAnalyticsPreset(
  state: ChannelManagerState,
  preset: Partial<AnalyticsPreset> & { title: string; metrics: string },
  now = new Date().toISOString(),
): { state: ChannelManagerState; preset: AnalyticsPreset } {
  const id = preset.id ?? createId("analytics");
  const existing = state.analyticsPresets.find((entry) => entry.id === id);
  const merged: AnalyticsPreset = {
    id,
    title: preset.title,
    metrics: preset.metrics,
    dimensions: preset.dimensions ?? existing?.dimensions,
    filters: preset.filters ?? existing?.filters,
    sort: preset.sort ?? existing?.sort,
    notes: preset.notes ?? existing?.notes,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  return {
    preset: merged,
    state: {
      ...state,
      updatedAt: now,
      analyticsPresets: existing
        ? state.analyticsPresets.map((entry) => entry.id === id ? merged : entry)
        : [...state.analyticsPresets, merged],
    },
  };
}

export function buildUploadPacketFromContent(
  state: ChannelManagerState,
  contentId: string,
  overrides: Partial<UploadPacket> & { titleVariants?: string[]; tags?: string[] } = {},
): UploadPacket {
  const content = requireContent(state, contentId);
  const defaults = state.brandKit.uploadDefaults;
  const hashtags = state.brandKit.defaultHashtags.join(" ");
  const context = {
    title: content.title,
    summary: content.summary ?? "",
    playlistUrl: content.playlistUrl ?? "",
    hashtags,
    channelName: state.brandKit.channelName,
  };
  const title = overrides.title ?? overrides.titleVariants?.[0] ?? content.title;
  const description = overrides.description
    ?? applyTemplate(state.brandKit.descriptionTemplate, context).trim();
  const pinnedComment = overrides.pinnedComment
    ?? (state.brandKit.pinnedCommentTemplate
      ? applyTemplate(state.brandKit.pinnedCommentTemplate, context).trim()
      : undefined);
  return {
    contentId,
    title,
    description,
    tags: uniqueStrings([...(state.brandKit.defaultTags ?? []), ...(content.tags ?? []), ...(overrides.tags ?? [])]),
    filePath: overrides.filePath ?? content.outputPaths[0] ?? content.sourcePaths[0],
    thumbnailPath: overrides.thumbnailPath ?? content.thumbnailPath,
    privacyStatus: overrides.privacyStatus ?? defaults.privacyStatus,
    categoryId: overrides.categoryId ?? defaults.categoryId,
    defaultLanguage: overrides.defaultLanguage ?? defaults.defaultLanguage,
    defaultAudioLanguage: overrides.defaultAudioLanguage ?? defaults.defaultAudioLanguage,
    license: overrides.license ?? defaults.license,
    embeddable: overrides.embeddable ?? defaults.embeddable,
    publicStatsViewable: overrides.publicStatsViewable ?? defaults.publicStatsViewable,
    selfDeclaredMadeForKids: overrides.selfDeclaredMadeForKids ?? defaults.selfDeclaredMadeForKids,
    pinnedComment,
    approvalReminder: "Ask the owner for explicit approval before upload, publish, public visibility, comment posting, or destructive changes.",
  };
}

export function createApprovalRequest(
  state: ChannelManagerState,
  request: Partial<ApprovalRequest> & { action: string; targetType: string; summary: string },
  now = new Date().toISOString(),
): { state: ChannelManagerState; request: ApprovalRequest } {
  const created: ApprovalRequest = {
    id: request.id ?? createId("approval"),
    action: request.action,
    targetType: request.targetType,
    targetId: request.targetId,
    summary: request.summary,
    status: "pending",
    requestedAt: now,
    notes: request.notes,
  };
  return {
    request: created,
    state: addAudit({
      ...state,
      updatedAt: now,
      approvals: [...state.approvals, created],
    }, {
      action: "approval.requested",
      targetType: created.targetType,
      targetId: created.targetId,
      summary: created.summary,
      createdAt: now,
    }),
  };
}

export function resolveApprovalRequest(
  state: ChannelManagerState,
  id: string,
  status: Exclude<ApprovalStatus, "pending">,
  actor = "owner",
  now = new Date().toISOString(),
  notes?: string,
): { state: ChannelManagerState; request: ApprovalRequest } {
  const existing = state.approvals.find((entry) => entry.id === id);
  if (!existing) throw new Error(`No approval request found for id ${id}.`);
  const resolved: ApprovalRequest = {
    ...existing,
    status,
    resolvedAt: now,
    resolvedBy: actor,
    notes: notes ?? existing.notes,
  };
  const nextState = {
    ...state,
    updatedAt: now,
    approvals: state.approvals.map((entry) => entry.id === id ? resolved : entry),
  };
  return {
    request: resolved,
    state: addAudit(nextState, {
      action: `approval.${status}`,
      targetType: resolved.targetType,
      targetId: resolved.targetId,
      summary: resolved.summary,
      createdAt: now,
      actor,
    }),
  };
}

export function triageComments(state: ChannelManagerState, comments: CommentForTriage[]): CommentTriageResult[] {
  return comments.map((comment) => {
    const text = comment.text.toLowerCase();
    const spamKeyword = state.commentRules.spamKeywords.find((keyword) => text.includes(keyword.toLowerCase()));
    if (spamKeyword) {
      return {
        ...comment,
        recommendedAction: "hide_or_review",
        reason: `Matched spam keyword: ${spamKeyword}`,
      };
    }
    const escalationKeyword = state.commentRules.escalationKeywords.find((keyword) => text.includes(keyword.toLowerCase()));
    if (escalationKeyword) {
      return {
        ...comment,
        recommendedAction: "escalate",
        reason: `Matched escalation keyword: ${escalationKeyword}. ${state.commentRules.escalationNote}`,
      };
    }
    if (/\b(great|love|thanks|amazing|helpful|nice|good)\b/i.test(comment.text)) {
      return {
        ...comment,
        recommendedAction: "reply",
        reason: "Positive/engaged comment.",
        suggestedReply: state.commentRules.positiveReplyTemplate,
      };
    }
    return {
      ...comment,
      recommendedAction: "ignore",
      reason: "No action needed.",
    };
  });
}

export function buildProductionChecklist(state: ChannelManagerState, contentId: string) {
  const content = requireContent(state, contentId);
  const missing = [
    content.scheduledFor ? null : "scheduledFor",
    content.thumbnailPath ? null : "thumbnailPath",
    content.outputPaths.length || content.videoId || content.liveBroadcastId ? null : "output/video/live id",
  ].filter((value): value is string => Boolean(value));
  return {
    contentId,
    title: content.title,
    format: content.format,
    status: content.status,
    missing,
    checkpoints: [
      "Confirm title, description, tags, thumbnail, and audience setting.",
      "Confirm explicit approval before going live or publishing.",
      "Use private/unlisted rehearsal or draft state before public release.",
      "Verify audio levels, captions, thumbnail readability, and upload packet.",
      "After publishing, watch comments and analytics for the first hour.",
    ],
  };
}

export function buildManagerBrief(state: ChannelManagerState, now = new Date().toISOString()) {
  const pendingApprovals = state.approvals.filter((approval) => approval.status === "pending");
  const readyToPublish = state.contentItems.filter((item) => item.status === "ready");
  const scheduled = state.contentItems.filter((item) => item.status === "scheduled");
  const inProgress = state.contentItems.filter((item) => ["script", "recording", "editing", "review"].includes(item.status));
  const nextActions = [
    pendingApprovals.length ? `Review ${pendingApprovals.length} pending approval request(s).` : null,
    readyToPublish.length ? `Prepare upload packets for ${readyToPublish.length} ready item(s).` : null,
    inProgress.length ? `Move ${inProgress.length} in-progress item(s) toward ready.` : null,
    !pendingApprovals.length && !readyToPublish.length && !inProgress.length ? "Add new ideas or review analytics for the next content bet." : null,
  ].filter((value): value is string => Boolean(value));
  return {
    generatedAt: now,
    channelName: state.brandKit.channelName || null,
    totals: {
      contentItems: state.contentItems.length,
      assets: state.assets.length,
      pendingApprovals: pendingApprovals.length,
      scheduled: scheduled.length,
    },
    readyToPublish,
    scheduled,
    inProgress,
    pendingApprovals,
    nextActions,
  };
}

function requireContent(state: ChannelManagerState, contentId: string): ContentItem {
  const content = state.contentItems.find((item) => item.id === contentId);
  if (!content) throw new Error(`No content item found for id ${contentId}.`);
  return content;
}

function addAudit(state: ChannelManagerState, entry: Omit<AuditLogEntry, "id">): ChannelManagerState {
  return {
    ...state,
    auditLog: [
      ...state.auditLog,
      {
        id: createId("audit"),
        ...entry,
      },
    ],
  };
}

function applyTemplate(template: string, context: Record<string, string>): string {
  return template.replace(/\{\{(\w+)}}/g, (_, key: string) => context[key] ?? "");
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
