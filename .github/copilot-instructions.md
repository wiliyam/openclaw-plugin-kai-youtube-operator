# Copilot Instructions

Follow the repository rules in `AGENTS.md` before editing this project.

- Keep `src/index.ts` as a thin OpenClaw entrypoint.
- Add behavior to focused modules and keep tests in matching `test/<module>.test.ts` files.
- Do not introduce loose types: no `any`, `Type.Any`, `as any`, `Record<string, any>`, or `unknown as`.
- Never commit OAuth credentials, refresh tokens, stream keys, `.env` files, Google client secrets, or private server details.
- Preserve approval gates for public, destructive, moderation, upload, publish, live-state, and public-chat actions.
- Prefer official YouTube APIs and local media tools. Avoid browser automation for account or Studio-only actions unless the user explicitly accepts that risk.
- Run `npm run lint`, `npm run quality`, `npm test`, `npm run build`, and `npm run plugin:validate` before opening a pull request.
- Update `README.md`, `AGENTS.md`, and `skills/kai-youtube-operator/SKILL.md` when tools, workflows, or safety rules change.
