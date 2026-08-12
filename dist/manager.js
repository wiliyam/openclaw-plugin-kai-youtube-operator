import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
const MANAGER_DIR = path.join(homedir(), "Kai", "youtube");
export const MANAGER_STATE_PATH = path.join(MANAGER_DIR, "channel-manager.json");
export function createDefaultManagerState(now = new Date().toISOString()) {
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
export function normalizeManagerState(value, now = new Date().toISOString()) {
    if (!value || typeof value !== "object")
        return createDefaultManagerState(now);
    const incoming = value;
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
export async function readManagerState(filePath = MANAGER_STATE_PATH) {
    try {
        const raw = await readFile(filePath, "utf8");
        return normalizeManagerState(JSON.parse(raw));
    }
    catch (error) {
        if (error.code === "ENOENT") {
            const state = createDefaultManagerState();
            await writeManagerState(state, filePath);
            return state;
        }
        throw error;
    }
}
export async function writeManagerState(state, filePath = MANAGER_STATE_PATH) {
    await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
    await writeFile(filePath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
    return state;
}
export function upsertBrandKit(state, patch, now = new Date().toISOString()) {
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
export function upsertContentItem(state, item, now = new Date().toISOString()) {
    const id = item.id ?? createId("content");
    const existing = state.contentItems.find((entry) => entry.id === id);
    const merged = {
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
export function upsertAsset(state, asset, now = new Date().toISOString()) {
    const id = asset.id ?? createId("asset");
    const existing = state.assets.find((entry) => entry.id === id);
    const merged = {
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
export function upsertAnalyticsPreset(state, preset, now = new Date().toISOString()) {
    const id = preset.id ?? createId("analytics");
    const existing = state.analyticsPresets.find((entry) => entry.id === id);
    const merged = {
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
export function buildUploadPacketFromContent(state, contentId, overrides = {}) {
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
export function createApprovalRequest(state, request, now = new Date().toISOString()) {
    const created = {
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
export function resolveApprovalRequest(state, id, status, actor = "owner", now = new Date().toISOString(), notes) {
    const existing = state.approvals.find((entry) => entry.id === id);
    if (!existing)
        throw new Error(`No approval request found for id ${id}.`);
    const resolved = {
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
export function triageComments(state, comments) {
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
export function buildProductionChecklist(state, contentId) {
    const content = requireContent(state, contentId);
    const missing = [
        content.scheduledFor ? null : "scheduledFor",
        content.thumbnailPath ? null : "thumbnailPath",
        content.outputPaths.length || content.videoId || content.liveBroadcastId ? null : "output/video/live id",
    ].filter((value) => Boolean(value));
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
export function buildManagerBrief(state, now = new Date().toISOString()) {
    const pendingApprovals = state.approvals.filter((approval) => approval.status === "pending");
    const readyToPublish = state.contentItems.filter((item) => item.status === "ready");
    const scheduled = state.contentItems.filter((item) => item.status === "scheduled");
    const inProgress = state.contentItems.filter((item) => ["script", "recording", "editing", "review"].includes(item.status));
    const nextActions = [
        pendingApprovals.length ? `Review ${pendingApprovals.length} pending approval request(s).` : null,
        readyToPublish.length ? `Prepare upload packets for ${readyToPublish.length} ready item(s).` : null,
        inProgress.length ? `Move ${inProgress.length} in-progress item(s) toward ready.` : null,
        !pendingApprovals.length && !readyToPublish.length && !inProgress.length ? "Add new ideas or review analytics for the next content bet." : null,
    ].filter((value) => Boolean(value));
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
function requireContent(state, contentId) {
    const content = state.contentItems.find((item) => item.id === contentId);
    if (!content)
        throw new Error(`No content item found for id ${contentId}.`);
    return content;
}
function addAudit(state, entry) {
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
function applyTemplate(template, context) {
    return template.replace(/\{\{(\w+)}}/g, (_, key) => context[key] ?? "");
}
function uniqueStrings(values) {
    return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
function createId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
