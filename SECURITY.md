# Security Policy

## Supported Version

Security fixes target the `main` branch and the latest tagged release.

## Reporting a Vulnerability

Open a private vulnerability report on GitHub if available, or contact the
repository owner privately. Do not open a public issue containing secrets,
OAuth codes, refresh tokens, stream keys, server IPs, or exploit details.

## Required GitHub Protections

Enable these repository settings before accepting outside contributions:

- Secret scanning and push protection.
- Dependabot alerts and Dependabot security updates.
- CodeQL code scanning.
- Branch protection or repository rulesets for `main`.

Recommended required checks for `main`:

- `quality`
- `analyze`
- `dependency-review`
- `gitleaks`
- `scorecard`

Recommended branch rules:

- Require a pull request before merging.
- Require at least one approval.
- Require conversation resolution.
- Require branches to be up to date before merging.
- Require status checks to pass.
- Block force pushes and branch deletion.
- Dismiss stale approvals after new commits.

## Local Secret Rules

Never commit:

- `.env` or `.env.*`
- OAuth client secrets
- OAuth access or refresh tokens
- Google redirect URLs containing one-time `code` values
- YouTube live stream keys
- Private server IPs or credential paths with values

## Security Tooling

- `npm run security` audits the full committed dependency graph.
- `npm run security:prod` audits production dependencies only.
- `npm run plugin:validate` verifies the built plugin contract without adding
  the OpenClaw CLI to the committed dependency graph.
- `.github/workflows/dependency-review.yml` blocks vulnerable dependency changes on pull requests.
- `.github/workflows/codeql.yml` runs CodeQL security and quality queries.
- `.github/workflows/secret-scan.yml` scans committed history with Gitleaks.
- `.github/workflows/scorecard.yml` runs OpenSSF Scorecard supply-chain checks.
- `scripts/check-quality.mjs` enforces project-specific guardrails and known secret patterns.
