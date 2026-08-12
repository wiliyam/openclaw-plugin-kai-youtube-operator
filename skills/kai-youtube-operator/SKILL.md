---
name: Kai YouTube Operator
slug: kai-youtube-operator
version: 2.0.0
description: Use Kai's installed YouTube operator tools for YouTube Studio, OAuth, uploads, publishing, videos, Shorts, thumbnails, audio, voiceovers, playlists, comments, captions, analytics, live streams, live chat, and safe channel management.
metadata:
  openclaw:
    requires:
      plugins:
      - kai-youtube-operator
---

# Kai YouTube Operator

Use this skill when the user asks for YouTube, YouTube Studio, uploads,
publishing, video editing, Shorts, thumbnails, voiceover, audio, analytics,
playlists, comments, captions, live streams, live chat, or channel management.

The installed OpenClaw plugin id is `kai-youtube-operator`.

## First Steps

1. Use `kai_youtube_setup_status` to check OAuth env vars and token status.
2. If auth is missing, use `kai_youtube_oauth_url`, then wait for the user to
   provide the one-time code privately.
3. Use `kai_youtube_oauth_exchange` only for that one-time code.
4. Use `kai_youtube_channel_overview` to confirm the authorized channel.
5. Use read tools before write tools.
6. Ask for explicit approval before public, destructive, upload, publish,
   moderation, live-state, or public chat actions.

## Setup and Discovery Tools

- `kai_youtube_setup_status`
- `kai_youtube_oauth_url`
- `kai_youtube_oauth_exchange`
- `kai_youtube_channel_overview`
- `kai_youtube_studio_capabilities`
- `kai_youtube_data_api_request`
- `kai_youtube_analytics_report`
- `kai_youtube_search`
- `kai_youtube_reference_list`

## Channel Tools

- `kai_youtube_channel_update_branding`
- `kai_youtube_channel_sections`
- `kai_youtube_channel_section_create`
- `kai_youtube_channel_section_update`
- `kai_youtube_channel_section_delete`

## Video, Upload, Publish, and Local Editing Tools

- `kai_youtube_videos_list`
- `kai_youtube_video_update_metadata`
- `kai_youtube_video_upload`
- `kai_youtube_video_upload_public`
- `kai_youtube_video_publish`
- `kai_youtube_video_delete`
- `kai_youtube_video_rate`
- `kai_youtube_video_report_abuse`
- `kai_youtube_thumbnail_set`
- `kai_youtube_video_edit_probe`
- `kai_youtube_short_create_from_video`
- `kai_youtube_short_batch_from_video`
- `kai_youtube_short_create_and_upload`
- `kai_youtube_thumbnail_extract`
- `kai_youtube_thumbnail_generate_card`
- `kai_youtube_audio_generate_free_bed`
- `kai_youtube_video_add_audio`
- `kai_youtube_voiceover_create`
- `kai_youtube_video_add_voiceover`

For local editing, prefer this workflow:

1. Probe the source with `kai_youtube_video_edit_probe`.
2. Create a clip with `kai_youtube_short_create_from_video` or batch clips with
   `kai_youtube_short_batch_from_video`.
3. Make a thumbnail with `kai_youtube_thumbnail_generate_card` or
   `kai_youtube_thumbnail_extract`.
4. Add sound with `kai_youtube_audio_generate_free_bed`,
   `kai_youtube_video_add_audio`, `kai_youtube_voiceover_create`, or
   `kai_youtube_video_add_voiceover`.
5. Upload privately first unless the user clearly approves public upload.

## Playlist Tools

- `kai_youtube_playlists_list`
- `kai_youtube_playlist_create`
- `kai_youtube_playlist_update`
- `kai_youtube_playlist_delete`
- `kai_youtube_playlist_items`
- `kai_youtube_playlist_item_add`
- `kai_youtube_playlist_item_update`
- `kai_youtube_playlist_item_delete`

## Comment and Caption Tools

- `kai_youtube_comments_list`
- `kai_youtube_comment_create`
- `kai_youtube_comment_reply`
- `kai_youtube_comment_update`
- `kai_youtube_comment_moderate`
- `kai_youtube_comment_delete`
- `kai_youtube_captions_list`
- `kai_youtube_caption_upload`
- `kai_youtube_caption_download`
- `kai_youtube_caption_delete`

## Membership and Subscription Tools

- `kai_youtube_members`
- `kai_youtube_membership_levels`
- `kai_youtube_subscriptions`

## Live Tools

- `kai_youtube_live_plan`
- `kai_youtube_live_broadcasts`
- `kai_youtube_live_create_broadcast`
- `kai_youtube_live_update_broadcast`
- `kai_youtube_live_delete_broadcast`
- `kai_youtube_live_bind_broadcast`
- `kai_youtube_live_cuepoint`
- `kai_youtube_live_transition`
- `kai_youtube_live_streams`
- `kai_youtube_live_stream_create`
- `kai_youtube_live_stream_update`
- `kai_youtube_live_stream_delete`
- `kai_youtube_live_chat_messages`
- `kai_youtube_live_chat_send`
- `kai_youtube_live_chat_delete`
- `kai_youtube_live_chat_ban`
- `kai_youtube_live_chat_unban`
- `kai_youtube_live_chat_moderators`
- `kai_youtube_live_chat_moderator_add`
- `kai_youtube_live_chat_moderator_delete`
- `kai_youtube_live_super_chats`

## Safety Rules

- Never ask for or store the user's Google password or 2FA codes.
- Never reveal OAuth tokens, client secrets, stream keys, or refresh tokens.
- Prefer a separate Google account invited as Editor or Editor (limited).
- Stop and ask for approval before uploading, publishing, making a video public,
  going live, ending live, changing privacy, deleting, moderating, sending chat,
  creating live events, binding streams, or changing moderators.
- Call write tools with `approved: true` only after explicit user approval of
  the exact action.
- For rehearsals and draft uploads, use `privacyStatus: "private"` or
  `"unlisted"`.
- If API support is missing for a Studio-only action, say so and suggest manual
  YouTube Studio steps rather than browser automation first.
- Local media tools require `ffmpeg`/`ffprobe`; voiceover requires `espeak-ng`.
