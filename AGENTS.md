# Agent Instructions

This repository contains the OpenClaw plugin `kai-youtube-operator`.

## Mission

Keep Kai useful for YouTube Studio work while protecting the channel owner.
Prefer official YouTube APIs and local media tools over browser automation.

## Core Rules

- Never commit OAuth credentials, tokens, stream keys, generated private env
  files, or YouTube account secrets.
- Keep `.env`, `.env.*`, and credential files ignored.
- Do not print `access_token`, `refresh_token`, `client_secret`, `streamName`,
  `ingestionAddress`, or `backupIngestionAddress`.
- All public, destructive, moderation, upload, publish, and live-state actions
  must remain approval-gated with `approved: true`.
- Default uploads and rehearsals to `private` unless the user explicitly asks
  for `public` or `unlisted`.
- Use structured request bodies and typed helpers rather than ad hoc string
  manipulation.
- Run tests and build before claiming a change is ready.

## Repository Shape

- `src/index.ts`: plugin implementation and exported helper functions.
- `src/index.test.ts`: Vitest coverage for helpers and safety behavior.
- `openclaw.plugin.json`: plugin metadata and advertised tool contracts.
- `skills/kai-youtube-operator/SKILL.md`: instructions Kai receives for using
  the installed plugin.
- `dist/`: built plugin entrypoint. This is intentionally committed because
  OpenClaw git installs need it.

## Development Commands

```sh
npm install
npm test
npm run build
npm run plugin:validate
```

## Adding Tools

When adding a new tool:

1. Add a typed helper where useful.
2. Add the tool registration in `src/index.ts`.
3. Add the tool name to `openclaw.plugin.json`.
4. Update `README.md`.
5. Update `skills/kai-youtube-operator/SKILL.md`.
6. Add tests for behavior, guardrails, request construction, or redaction.
7. Run `npm test`, `npm run build`, and `npm run plugin:validate`.

## YouTube API Guidance

- Read tools can run directly after OAuth.
- Write tools must use `approvalGate`.
- Generic Data API access must stay allowlisted via `SUPPORTED_DATA_API_PATHS`.
- Uploads are simple uploads only and limited to 512 MB.
- Large uploads should use YouTube Studio or a future resumable upload feature.

## Local Media Guidance

- `ffmpeg` and `ffprobe` power local video, audio, Shorts, and thumbnail tools.
- `espeak-ng` powers voiceover generation.
- Use argument arrays with `spawn`; do not build shell command strings.
- Refuse to overwrite local output unless `overwrite: true` is present.
- Generated audio beds should remain synthetic and copyright-safe.
