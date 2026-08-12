---
name: Kai YouTube Operator
slug: kai-youtube-operator
version: 1.0.0
description: Use Kai's installed YouTube operator tools for YouTube channel setup, OAuth, videos, live broadcasts, live chat, and safe live-stream management. Trigger when the user asks about YouTube Studio, YouTube API, live streams, livestream control, scheduled broadcasts, live chat moderation, or whether the Kai YouTube plugin is installed.
metadata:
  openclaw:
    requires:
      plugins:
      - kai-youtube-operator
---

# Kai YouTube Operator

Use this skill when the user asks for YouTube channel, YouTube Studio, API,
video, live broadcast, live chat, or livestream management help. The installed
OpenClaw plugin id is `kai-youtube-operator`.

## Tool Map

- Use `kai_youtube_setup_status` to check whether OAuth env vars and token are present.
- Use `kai_youtube_oauth_url` to create the Google consent URL.
- Use `kai_youtube_oauth_exchange` only after the user gives a one-time OAuth code in private chat.
- Use `kai_youtube_channel_overview` to confirm the authorized channel.
- Use `kai_youtube_live_plan` before live workflows.
- Use `kai_youtube_live_broadcasts` to list scheduled, active, completed, or all broadcasts.
- Use `kai_youtube_live_create_broadcast` only after explicit user approval.
- Use `kai_youtube_live_update_broadcast` only after explicit user approval.
- Use `kai_youtube_live_transition` only after explicit user approval, especially for `live` and `complete`.
- Use `kai_youtube_live_chat_messages` to read chat.
- Use `kai_youtube_live_chat_send` and `kai_youtube_live_chat_delete` only after explicit user approval.

## Safety Rules

- Never ask for or store the user's Google password or 2FA codes.
- Never reveal OAuth tokens, client secrets, stream keys, or refresh tokens.
- Prefer a separate Google account invited to the channel as Editor or Editor (limited).
- Stop and ask for approval before going live, ending live, changing privacy,
  creating a live event, deleting/moderating chat, or sending a public chat message.
- If API support is missing for a Studio-only action, say so and suggest manual
  YouTube Studio steps rather than browser automation first.

## Live Defaults

- For rehearsals, use `privacyStatus: "private"` or `"unlisted"`.
- Before `live`, verify the broadcast id, title, privacy, scheduled time, and stream health.
- Treat live chat messages as public channel actions.
