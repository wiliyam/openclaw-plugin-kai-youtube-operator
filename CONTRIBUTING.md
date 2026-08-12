# Contributing

Thanks for helping improve Kai YouTube Operator. This project is open to
community contributions.

## Good Contributions

- Docs and examples.
- Tests for existing tools.
- Safer wrappers for official YouTube API endpoints.
- Better Kai skill instructions.
- Local media workflows using `ffmpeg`, `ffprobe`, or similarly trusted tools.
- Bug fixes for OAuth, redaction, validation, and approval gates.

## Before You Start

1. Fork the repo.
2. Create a branch with a focused name.
3. Install dependencies.
4. Run the test suite before and after your change.

```sh
npm install
npm test
npm run build
npm run plugin:validate
```

## Security Rules

Never commit:

- `.env` or `.env.*`
- OAuth client secrets
- OAuth access tokens or refresh tokens
- YouTube stream keys
- Generated credential files
- Private logs containing request headers

All tools that can publish, upload, delete, moderate, change privacy, change
live state, send public chat messages, or affect channel/account state must
require explicit approval through `approved: true`.

## Pull Request Checklist

- Tests pass with `npm test`.
- TypeScript builds with `npm run build`.
- Plugin validation passes with `npm run plugin:validate`.
- New public tool names are added to `openclaw.plugin.json`.
- README and skill instructions are updated for user-visible behavior.
- No secrets or private generated files are committed.

## Reporting Issues

When opening an issue, include:

- What you asked Kai to do.
- Which tool failed, if known.
- The sanitized error message.
- Your OpenClaw version.
- Whether `ffmpeg`, `ffprobe`, or `espeak-ng` are installed for media features.

Do not paste tokens, OAuth secrets, stream keys, private redirect codes, or raw
authorization headers.
