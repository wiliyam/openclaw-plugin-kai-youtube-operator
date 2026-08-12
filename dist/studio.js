import { APPROVAL_ACTIONS } from "./constants.js";
export function buildLivePlan(params) {
    const needsApproval = params.goal !== "status_check";
    return {
        goal: params.goal,
        title: params.title ?? null,
        plan: [
            "Confirm the authorized channel and intended broadcast.",
            "Use private or unlisted privacy for rehearsals.",
            "Verify title, description, scheduled time, privacy, audience setting, and stream health.",
            needsApproval
                ? "Stop before changing YouTube state and ask for explicit approval of the exact action."
                : "Read status only; do not change YouTube state.",
        ],
        approvalRequiredBefore: needsApproval ? APPROVAL_ACTIONS : [],
        notes: params.notes ?? "No extra notes supplied.",
    };
}
export function studioCapabilities() {
    return {
        apiBacked: [
            "OAuth setup and token refresh",
            "Channel overview and branding metadata updates",
            "Video search, listing, metadata/status updates, simple uploads, ratings, abuse reports, thumbnails, and deletes",
            "Public upload and public publish convenience tools with approval gates",
            "Local short-video creation, thumbnail generation, synthetic audio beds, audio mixing, and voiceovers using ffmpeg/ffprobe/espeak-ng",
            "Playlist and playlist item create/read/update/delete",
            "Comment thread reading, commenting, replies, updates, moderation, and deletes",
            "Caption list, download, text upload/update, and delete",
            "Analytics and monetary analytics reports when the OAuth scopes and channel eligibility allow it",
            "Live broadcast schedule/update/delete/bind/transition/cuepoint",
            "Live stream create/list/update/delete and stream health reads",
            "Live chat reads, sends, deletes, bans, unbans, moderators, and Super Chat event reads",
            "Members, membership levels, subscriptions, categories, regions, languages, and abuse-report reasons",
            "A guarded generic YouTube Data API request for allowlisted official endpoints",
        ],
        notApiBacked: [
            "Some YouTube Studio-only screens, channel monetization setup, copyright dispute workflows, advanced dashboard UI controls, and browser-only account/security settings may not have public API coverage.",
            "Large video uploads should use YouTube Studio or a resumable uploader; this plugin intentionally supports simple uploads only.",
            "Voiceover creation requires espeak-ng to be installed on the OpenClaw server.",
        ],
        safety: [
            "Read actions can run directly after OAuth.",
            "Write, publish, delete, moderate, upload, and live-state actions require approved: true after explicit user approval.",
            "Tokens, stream keys, and client secrets are redacted from tool output.",
        ],
    };
}
