# Kai YouTube Operator

OpenClaw tool plugin for Kai's YouTube channel and live-stream workflows.

Initial support covers OAuth setup, channel overview, live broadcast planning,
live broadcast listing, live broadcast create/update/transition, and live chat
read/send/delete. It uses official YouTube APIs and never asks for a Google
password.

## Tools

- `kai_youtube_setup_status`: check OAuth environment and saved token status.
- `kai_youtube_oauth_url`: generate a Google OAuth consent URL.
- `kai_youtube_oauth_exchange`: exchange a user-approved OAuth code and save tokens.
- `kai_youtube_channel_overview`: read the authorized channel summary.
- `kai_youtube_live_plan`: produce a safe live-stream management plan.
- `kai_youtube_live_broadcasts`: list active, upcoming, completed, or all broadcasts.
- `kai_youtube_live_create_broadcast`: create a scheduled live broadcast after approval.
- `kai_youtube_live_update_broadcast`: update a broadcast after approval.
- `kai_youtube_live_transition`: transition a broadcast to testing, live, or complete after approval.
- `kai_youtube_live_chat_messages`: read live chat messages.
- `kai_youtube_live_chat_send`: send a live chat message after approval.
- `kai_youtube_live_chat_delete`: delete a live chat message after approval.

## Setup

Create a Google Cloud OAuth client and set these environment variables in the
OpenClaw gateway service environment:

```sh
YOUTUBE_CLIENT_ID=...
YOUTUBE_CLIENT_SECRET=...
YOUTUBE_REDIRECT_URI=http://127.0.0.1:53682/oauth2callback
```

Then ask Kai for a YouTube OAuth link. Open the link, sign in with the Google
account that has YouTube channel permissions, approve access, copy the returned
`code` from the redirect URL, and give that one-time code to Kai in a private
chat.

Use a separate Google account invited to the YouTube channel as `Editor` or
`Editor (limited)`. Avoid Owner access.

## Safety Model

- No Google password collection.
- OAuth tokens are stored under `~/Kai/youtube/oauth-token.json` with private
  file permissions.
- Stream keys, tokens, and client secrets are never returned in tool output.
- Live create/update/transition, chat send, and chat delete require
  `approved: true`.
- Kai should still ask for human approval before going live, ending live,
  changing privacy, deleting/moderating chat, or sending public messages.

## References

- YouTube Data API OAuth: https://developers.google.com/youtube/v3/guides/authentication
- YouTube Live Broadcasts: https://developers.google.com/youtube/v3/live/docs/liveBroadcasts
- YouTube Live Chat: https://developers.google.com/youtube/v3/live/docs/liveChatMessages
- YouTube channel permissions: https://support.google.com/youtube/answer/9481328
