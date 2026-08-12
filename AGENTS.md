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
- Keep tests modular: every `src/<module>.ts` file must have a matching
  `test/<module>.test.ts` file.
- Run lint, quality, tests, build, plugin validation, and dependency audit
  before claiming a change is ready.

## Repository Shape

- `src/index.ts`: thin plugin entrypoint and public helper re-exports.
- `src/tools.ts`: OpenClaw tool registration and orchestration.
- `src/schemas.ts`: TypeBox tool parameter schemas.
- `src/types.ts`: shared TypeScript types.
- `src/constants.ts`: paths, OAuth scopes, API URLs, approval actions, and
  allowlists.
- `src/oauth.ts`: OAuth URL, exchange, storage, and refresh helpers.
- `src/api.ts`: authorized YouTube API request helpers.
- `src/safety.ts`: approval gates, redaction, undefined stripping, and allowlist
  checks.
- `src/mime.ts`: MIME type inference.
- `src/media.ts`: ffmpeg, ffprobe, and espeak-ng helpers.
- `src/studio.ts`: Studio capability and live-planning helpers.
- `src/youtube-bodies.ts`: YouTube request-body builders and update mergers.
- `src/youtube-resources.ts`: fetch helpers for existing YouTube resources.
- `src/manager.ts`: local channel-manager state and helper functions.
- `test/*.test.ts`: module-level Vitest coverage matching source modules.
- `openclaw.plugin.json`: plugin metadata and advertised tool contracts.
- `skills/kai-youtube-operator/SKILL.md`: instructions Kai receives for using
  the installed plugin.
- `dist/`: built plugin entrypoint. This is intentionally committed because
  OpenClaw git installs need it.
- `.github/workflows/*.yml`: pull-request, merge, security, and release checks.
- `.github/copilot-instructions.md`: GitHub Copilot and coding-agent guardrails.
- `.githooks/`: optional local pre-commit and pre-push checks.

## Development Commands

```sh
npm install
npm run lint
npm run quality
npm test
npm run build
npm run plugin:validate
npm run security
npm run security:prod
npm run hooks:install
```

Use `npm run plugin:validate:openclaw` as an extra runtime check on machines
where the OpenClaw CLI is already installed.

## Adding Tools

When adding a new tool:

1. Add a typed helper in a focused module where useful.
2. Keep `src/index.ts` as a thin entrypoint; put tool wiring in `src/tools.ts`.
3. Add the tool name to `openclaw.plugin.json`.
4. Update `README.md`.
5. Update `skills/kai-youtube-operator/SKILL.md`.
6. Add or update the matching module test file.
7. Run `npm run lint`, `npm run quality`, `npm test`, `npm run build`,
   `npm run plugin:validate`, and `npm run security`.

## YouTube API Guidance

- Read tools can run directly after OAuth.
- Write tools must use `approvalGate`.
- Generic Data API access must stay allowlisted via `SUPPORTED_DATA_API_PATHS`
  in `src/constants.ts`.
- Uploads are simple uploads only and limited to 512 MB.
- Large uploads should use YouTube Studio or a future resumable upload feature.

## Local Media Guidance

- `ffmpeg` and `ffprobe` power local video, audio, Shorts, and thumbnail tools.
- `espeak-ng` powers voiceover generation.
- Use argument arrays with `spawn`; do not build shell command strings.
- Refuse to overwrite local output unless `overwrite: true` is present.
- Generated audio beds should remain synthetic and copyright-safe.

## Channel Manager Guidance

- Keep planning/state logic in `src/manager.ts` or another focused manager
  module.
- The local manager store is `~/Kai/youtube/channel-manager.json`.
- Manager tools do not directly change YouTube; API tools still handle uploads,
  publishing, live changes, and moderation.
- Use the approval queue and audit log before public/destructive API actions.
