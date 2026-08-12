# Kai YouTube Operator

OpenClaw plugin for Kai, focused on safe YouTube Studio automation, live
production, uploads, comments, captions, analytics, and local short-video
editing.

The plugin uses official YouTube APIs where available and local media tools for
editing. It never asks for a Google password, never returns OAuth secrets, and
requires explicit approval before public, destructive, upload, publish, live, or
moderation actions.

## Status

This project is public and open for contributions. Issues, feature requests,
docs fixes, and pull requests are welcome.

## What It Can Do

- Connect YouTube with OAuth and auto-refresh saved tokens.
- Read channel overview, videos, playlists, comments, captions, members,
  subscriptions, live broadcasts, live streams, live chat, Super Chats, and
  analytics reports.
- Update channel branding, video metadata, playlists, comments, captions,
  broadcast settings, streams, chat moderators, and bans after approval.
- Upload videos privately or publicly after approval.
- Publish existing videos after approval.
- Generate thumbnails locally.
- Create Shorts from longer videos locally.
- Generate synthetic copyright-safe audio beds locally.
- Create voiceover audio with selectable voices when `espeak-ng` is installed.
- Mix/replace/duck audio in a video locally.
- Create a Short and upload it in one approved workflow.
- Call allowlisted YouTube Data API endpoints through a guarded generic tool.
- Maintain a local channel-manager system with brand kit, content calendar,
  asset library, upload packets, approval queue, audit log, analytics presets,
  comment triage, daily brief, and production checklists.

Some YouTube Studio screens are not exposed by public APIs. Monetization setup,
some copyright workflows, account security settings, and some dashboard-only UI
actions may still require manual YouTube Studio use.

## Requirements

- OpenClaw `2026.5.17` or newer.
- Node.js compatible with OpenClaw.
- A Google Cloud OAuth client with YouTube API access.
- `ffmpeg` and `ffprobe` for local video/audio/thumbnail tools.
- `espeak-ng` for local voiceover generation.

On Ubuntu:

```sh
sudo apt-get update
sudo apt-get install -y ffmpeg espeak-ng
```

## Install

Install from GitHub:

```sh
openclaw plugins install git:wiliyam/openclaw-plugin-kai-youtube-operator@main --force
openclaw plugins enable kai-youtube-operator
openclaw gateway restart
```

If you install from a local checkout:

```sh
npm install
npm test
npm run plugin:validate
openclaw plugins install . --force
openclaw plugins enable kai-youtube-operator
openclaw gateway restart
```

## OAuth Setup

Create a Google Cloud OAuth client and configure the OpenClaw gateway
environment:

```sh
YOUTUBE_CLIENT_ID=...
YOUTUBE_CLIENT_SECRET=...
YOUTUBE_REDIRECT_URI=http://127.0.0.1:53682/oauth2callback
```

Do not commit these values. On a server, store them in a private environment
file such as:

```sh
/home/ubuntu/.openclaw/credentials/youtube.env
```

Recommended permissions:

```sh
chmod 600 /home/ubuntu/.openclaw/credentials/youtube.env
```

Then ask Kai to run `kai_youtube_oauth_url`, open the Google consent URL, approve
access, copy only the one-time `code` from the redirect URL, and give that code
to Kai privately. Kai should then run `kai_youtube_oauth_exchange`.

Use a separate Google account invited to the YouTube channel as `Editor` or
`Editor (limited)` when possible. Avoid owner credentials for automation.

## OAuth Capabilities

The OAuth URL tool supports these capability presets:

- `readonly`: YouTube read access.
- `upload`: upload videos.
- `live_control`: live broadcast and live chat control.
- `analytics`: YouTube Analytics read access.
- `monetary_analytics`: analytics plus monetary analytics read access.
- `full_channel`: broad channel, live, upload, and analytics access.

If you add new tools that need a new scope, update `YOUTUBE_SCOPES` in
`src/constants.ts` and document the change here.

## Tool Catalog

### Setup and Discovery

- `kai_youtube_setup_status`: check OAuth environment and saved token status.
- `kai_youtube_oauth_url`: generate a Google OAuth consent URL.
- `kai_youtube_oauth_exchange`: exchange a user-approved OAuth code.
- `kai_youtube_channel_overview`: read the authorized channel summary.
- `kai_youtube_studio_capabilities`: list supported features and known gaps.
- `kai_youtube_data_api_request`: guarded generic Data API request.
- `kai_youtube_analytics_report`: run YouTube Analytics reports.
- `kai_youtube_search`: search videos, channels, and playlists.
- `kai_youtube_reference_list`: list categories, regions, languages, and abuse
  report reasons.

### Channel Manager

- `kai_youtube_manager_status`: read local channel-manager state summary.
- `kai_youtube_manager_brief`: generate a daily-style channel brief.
- `kai_youtube_brand_kit_get`: read the saved brand kit.
- `kai_youtube_brand_kit_update`: update brand voice, defaults, templates, and upload defaults.
- `kai_youtube_content_calendar_list`: list planned content.
- `kai_youtube_content_calendar_upsert`: create or update a content item.
- `kai_youtube_asset_library_list`: list local assets.
- `kai_youtube_asset_register`: register scripts, videos, thumbnails, captions, audio, or exports.
- `kai_youtube_upload_packet_build`: build a title/description/tags/upload packet from brand kit and content state.
- `kai_youtube_approval_request`: create a local approval request.
- `kai_youtube_approval_resolve`: mark a local approval request approved/rejected/cancelled.
- `kai_youtube_audit_log`: read the local manager audit log.
- `kai_youtube_comment_triage_plan`: triage comments using local moderation rules.
- `kai_youtube_production_checklist`: build a checklist for a content item.
- `kai_youtube_analytics_preset_list`: list saved analytics presets.
- `kai_youtube_analytics_preset_upsert`: create or update analytics presets.

Manager state is stored locally at `~/Kai/youtube/channel-manager.json`.

### Channel

- `kai_youtube_channel_update_branding`: update channel branding after approval.
- `kai_youtube_channel_sections`: list channel home sections.
- `kai_youtube_channel_section_create`: create a channel section after approval.
- `kai_youtube_channel_section_update`: update a channel section after approval.
- `kai_youtube_channel_section_delete`: delete a channel section after approval.

### Videos, Uploads, and Publishing

- `kai_youtube_videos_list`: list uploads or videos by id, chart, or rating.
- `kai_youtube_video_update_metadata`: update video metadata/status after approval.
- `kai_youtube_video_upload`: upload a local video after approval.
- `kai_youtube_video_upload_public`: upload and make a video public after approval.
- `kai_youtube_video_publish`: make an existing video public after approval.
- `kai_youtube_video_delete`: delete a video after approval.
- `kai_youtube_video_rate`: like, dislike, or clear a video rating after approval.
- `kai_youtube_video_report_abuse`: report a video after approval.
- `kai_youtube_thumbnail_set`: set a video's thumbnail after approval.

### Local Editing, Shorts, Thumbnails, Sound, and Voice

- `kai_youtube_video_edit_probe`: inspect a local video with `ffprobe`.
- `kai_youtube_short_create_from_video`: create one local short clip.
- `kai_youtube_short_batch_from_video`: create multiple local short clips.
- `kai_youtube_short_create_and_upload`: create a Short and upload it after approval.
- `kai_youtube_thumbnail_extract`: extract a thumbnail from a video frame.
- `kai_youtube_thumbnail_generate_card`: generate a thumbnail card with text.
- `kai_youtube_audio_generate_free_bed`: generate a synthetic audio bed.
- `kai_youtube_video_add_audio`: mix, duck, or replace video audio.
- `kai_youtube_voiceover_create`: create a voiceover file from text.
- `kai_youtube_video_add_voiceover`: create a voiceover and add it to a video.

Local editing output files are not overwritten unless `overwrite: true` is set.
Simple uploads are intentionally limited to 512 MB. Use YouTube Studio or a
resumable uploader for larger files.

### Playlists

- `kai_youtube_playlists_list`: list playlists.
- `kai_youtube_playlist_create`: create a playlist after approval.
- `kai_youtube_playlist_update`: update a playlist after approval.
- `kai_youtube_playlist_delete`: delete a playlist after approval.
- `kai_youtube_playlist_items`: list playlist items.
- `kai_youtube_playlist_item_add`: add a video to a playlist after approval.
- `kai_youtube_playlist_item_update`: move or update a playlist item after approval.
- `kai_youtube_playlist_item_delete`: remove a playlist item after approval.

### Comments and Captions

- `kai_youtube_comments_list`: list comment threads or replies.
- `kai_youtube_comment_create`: create a top-level comment after approval.
- `kai_youtube_comment_reply`: reply to a comment after approval.
- `kai_youtube_comment_update`: update a comment after approval.
- `kai_youtube_comment_moderate`: set moderation status after approval.
- `kai_youtube_comment_delete`: delete a comment after approval.
- `kai_youtube_captions_list`: list caption tracks.
- `kai_youtube_caption_upload`: upload or update a caption track after approval.
- `kai_youtube_caption_download`: download a caption track as text.
- `kai_youtube_caption_delete`: delete a caption track after approval.

### Memberships and Subscriptions

- `kai_youtube_members`: list channel members when available.
- `kai_youtube_membership_levels`: list channel membership levels when available.
- `kai_youtube_subscriptions`: list subscriptions or subscribers where the API
  allows.

### Live Production

- `kai_youtube_live_plan`: produce a safe live-stream management plan.
- `kai_youtube_live_broadcasts`: list broadcasts.
- `kai_youtube_live_create_broadcast`: create a broadcast after approval.
- `kai_youtube_live_update_broadcast`: update a broadcast after approval.
- `kai_youtube_live_delete_broadcast`: delete a broadcast after approval.
- `kai_youtube_live_bind_broadcast`: bind or unbind a broadcast and stream.
- `kai_youtube_live_cuepoint`: insert a live cuepoint after approval.
- `kai_youtube_live_transition`: transition testing/live/complete after approval.
- `kai_youtube_live_streams`: list live streams and stream health.
- `kai_youtube_live_stream_create`: create a live stream after approval.
- `kai_youtube_live_stream_update`: update a live stream after approval.
- `kai_youtube_live_stream_delete`: delete a live stream after approval.
- `kai_youtube_live_chat_messages`: read live chat messages.
- `kai_youtube_live_chat_send`: send a live chat message after approval.
- `kai_youtube_live_chat_delete`: delete a live chat message after approval.
- `kai_youtube_live_chat_ban`: ban a user from live chat after approval.
- `kai_youtube_live_chat_unban`: remove a live chat ban after approval.
- `kai_youtube_live_chat_moderators`: list live chat moderators.
- `kai_youtube_live_chat_moderator_add`: add a moderator after approval.
- `kai_youtube_live_chat_moderator_delete`: remove a moderator after approval.
- `kai_youtube_live_super_chats`: list Super Chat events.

## Agent Playbook

Agents using this plugin should follow this order:

1. Run `kai_youtube_setup_status`.
2. If OAuth is missing, run `kai_youtube_oauth_url` and wait for the user to
   provide the one-time OAuth code privately.
3. Run `kai_youtube_oauth_exchange`.
4. Confirm the channel with `kai_youtube_channel_overview`.
5. Use read-only tools first to inspect state.
6. For write actions, summarize the exact action and ask the user to approve it.
7. Only call write tools with `approved: true` after explicit approval.
8. Never print tokens, refresh tokens, client secrets, stream keys, or private
   credential paths that contain values.

For video creation:

1. Use `kai_youtube_video_edit_probe` to inspect the source.
2. Use `kai_youtube_short_create_from_video` or
   `kai_youtube_short_batch_from_video` to render local clips.
3. Use `kai_youtube_thumbnail_generate_card` or
   `kai_youtube_thumbnail_extract` for thumbnails.
4. Use `kai_youtube_audio_generate_free_bed`,
   `kai_youtube_voiceover_create`, `kai_youtube_video_add_audio`, or
   `kai_youtube_video_add_voiceover` for audio.
5. Upload privately first unless the user explicitly asks for public publishing.
6. Use `kai_youtube_video_publish` only after explicit approval.

For live workflows:

1. Use `kai_youtube_live_plan`.
2. Read broadcasts and streams.
3. Confirm broadcast id, stream id, title, privacy, scheduled time, and stream
   health.
4. Ask before binding, transitioning live, ending live, deleting, sending chat,
   banning users, or changing moderators.

## Safety Model

- No Google password collection.
- OAuth tokens are stored under `~/Kai/youtube/oauth-token.json` with private
  file permissions.
- Stream keys, tokens, and client secrets are redacted from tool output.
- Write, upload, publish, delete, moderation, and live-state actions require
  `approved: true`.
- Generated audio beds are synthetic local audio, not third-party music.
- Local commands use argument arrays rather than shell command strings.
- Generic Data API calls are restricted to an allowlist of official YouTube
  paths.

## Development

Install dependencies:

```sh
npm install
```

Run checks:

```sh
npm run lint
npm run quality
npm test
npm run build
npm run plugin:validate
npm run security:prod
```

Build the plugin package:

```sh
npm run plugin:build
```

Install local git hooks for this checkout:

```sh
npm run hooks:install
```

The repo intentionally includes `dist/` because OpenClaw git installs need the
built entrypoint.

## Code Structure

- `src/index.ts`: thin OpenClaw entrypoint and public re-exports.
- `src/tools.ts`: tool registration and wiring, grouped around imported helpers.
- `src/schemas.ts`: TypeBox schemas for tool parameters.
- `src/types.ts`: shared TypeScript types.
- `src/constants.ts`: paths, API URLs, OAuth scopes, approval action text, and
  allowlisted Data API paths.
- `src/oauth.ts`: OAuth URL generation, token exchange, token storage, and token
  refresh.
- `src/api.ts`: authorized YouTube Data, Upload, Caption, and Analytics API
  requests.
- `src/safety.ts`: approval gates, redaction, undefined stripping, and generic
  API allowlist checks.
- `src/mime.ts`: local MIME inference.
- `src/media.ts`: ffmpeg, ffprobe, and espeak-ng local media helpers.
- `src/studio.ts`: capability descriptions and live planning helpers.
- `src/youtube-bodies.ts`: structured YouTube request-body builders and update
  mergers.
- `src/youtube-resources.ts`: small fetch helpers for existing YouTube
  resources.
- `src/manager.ts`: local channel-manager state, brand kit, calendar, approvals,
  upload packets, audit log, comment triage, and checklists.
- `test/*.test.ts`: module-level Vitest files matching the source modules.

New large features should be added as focused modules instead of growing
`src/index.ts` or adding unrelated logic to `src/tools.ts`.

## CI/CD and Security

GitHub Actions are configured for pull requests and merges to `main`:

- `CI`: lint, project quality rules, tests, TypeScript build, OpenClaw plugin
  validation, GitHub workflow linting, production dependency audit, and
  generated-file drift checks.
- `CodeQL`: JavaScript/TypeScript static analysis with the
  `security-and-quality` query suite.
- `Dependency Review`: blocks pull requests that introduce high-severity
  vulnerable dependencies.
- `Secret Scan`: runs Gitleaks against pull requests and `main`.
- `OpenSSF Scorecard`: checks supply-chain security posture and uploads SARIF
  to code scanning.
- `Release Artifact`: validates and uploads a plugin package when a `v*` tag is
  pushed.

Dependabot is configured for weekly npm and GitHub Actions updates.

For GitHub-side enforcement, enable branch protection or repository rulesets on
`main` and require these checks: `quality`, `analyze`, `dependency-review`, and
`gitleaks`. Also enable GitHub secret scanning, push protection, Dependabot
alerts, Dependabot security updates, CodeQL code scanning, and OpenSSF
Scorecard in repository security settings.

GitHub Copilot or other coding agents should follow `AGENTS.md`,
`.github/copilot-instructions.md`, and the `Agent task` issue template.

## Contributing

Contributions are welcome. Good first contributions include docs fixes, new
tests, wrappers for official YouTube API endpoints, improved examples, safer
media workflows, and better skill instructions for Kai.

Before opening a pull request:

1. Do not commit `.env`, OAuth secrets, tokens, stream keys, or generated private
   credential files.
2. Add or update tests for behavior changes.
3. Run `npm run lint`, `npm run quality`, `npm test`, `npm run build`,
   `npm run plugin:validate`, and `npm run security:prod`.
4. Keep destructive or public actions approval-gated.
5. Update this README and `skills/kai-youtube-operator/SKILL.md` when tool names
   or workflows change.

## References

- YouTube Data API OAuth: https://developers.google.com/youtube/v3/guides/authentication
- YouTube Data API Reference: https://developers.google.com/youtube/v3/docs
- YouTube Live Streaming API: https://developers.google.com/youtube/v3/live
- YouTube Analytics API: https://developers.google.com/youtube/analytics
- YouTube channel permissions: https://support.google.com/youtube/answer/9481328
