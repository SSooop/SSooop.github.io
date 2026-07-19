# SSooop.github.io

Personal GitHub Pages site for Alex Su / SSooop.

The production target is the user page at
[https://ssooop.github.io](https://ssooop.github.io). GitHub Pages therefore requires the canonical
repository name `SSooop.github.io`, with `/` as the public base path.

## What This Is

This repository powers a bilingual personal homepage and long-form blog focused on AI,
software, and the pharmaceutical industry.

Core goals:

- keep the public site buildable as a static Astro site;
- publish Chinese and English essays under stable URLs;
- keep site URL/base-path configuration centralized;
- keep local agent workspaces private while documenting public collaboration rules;
- prefer current upstream package versions and upgrade frequently.

## Runtime

Use the versions declared by the repository:

- Node.js: `24.x`
- pnpm: `11.x`

Version hints are provided in:

- [.nvmrc](./.nvmrc)
- [.node-version](./.node-version)
- [package.json](./package.json)
- [.npmrc](./.npmrc)

Recommended setup:

```bash
nvm use
corepack enable
corepack pnpm install
corepack pnpm exec playwright install chromium
```

## Commands

```bash
pnpm dev           # Start local dev server at http://localhost:3000
pnpm build         # Build static site into dist/
pnpm preview       # Preview the production build
pnpm lint          # Run ESLint
pnpm type-check    # Run TypeScript checks
pnpm links:check   # Check built internal links after pnpm build
pnpm images:scaffold # Create tracked image folders for article and shared assets
pnpm test:smoke    # Build and smoke-test the site with Playwright
pnpm verify        # Run content audit, format check, lint, type-check, build, and links
pnpm deps:update   # Update dependencies to latest versions
```

## Site Configuration

The active public site is:

```text
SITE_URL=https://ssooop.github.io
PUBLIC_BASE=/
```

Configuration is intentionally split by responsibility:

- [astro.config.mjs](./astro.config.mjs) controls Astro's `site` and `base`.
- [src/config/site.ts](./src/config/site.ts) exposes `SITE`, `withBasePath()`, and
  `absoluteUrl()` for application code, sitemap generation, canonical URLs, and structured data.
- [.env.example](./.env.example) documents optional local overrides.

For the current user-page deployment, keep `PUBLIC_BASE=/`. Only set another base path if this
site is later deployed as a GitHub project page.

## Content Model

Blog posts live under:

```text
src/content/blog/[year]/[slug]/
```

Expected files:

```text
cn.mdx  # Chinese version
en.mdx  # English version
```

When drafting new articles, start with text-only MDX and run `pnpm build` before adding images.
Images live in each post's `images/` folder once the text build is stable. See
[docs/IMAGE_WORKFLOW.md](./docs/IMAGE_WORKFLOW.md) for the manual image insertion workflow.

## Dependency Policy

This project follows a latest-first dependency policy:

- package ranges use caret (`^`) versions;
- `pnpm deps:update` is the normal upgrade command;
- Renovate checks dependencies and GitHub Actions weekly;
- `pnpm verify` should pass after dependency updates before merging.

The lockfile is still committed so builds remain reproducible between updates.

## Maintenance Automation

`main` is the production branch for [https://ssooop.github.io](https://ssooop.github.io).

- Feature branches and pull requests run CI but do not deploy.
- Pushes to `main` run production verification and deploy through GitHub Pages Actions.
- External links are checked weekly because some platforms require manual review.

See [docs/MAINTENANCE.md](./docs/MAINTENANCE.md), [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md),
and [docs/PUBLISHING_CHECKLIST.md](./docs/PUBLISHING_CHECKLIST.md).

## Public And Local Files

Public collaboration guidance lives in [AGENTS.md](./AGENTS.md).

Local agent workspaces are intentionally not published:

- `.agents/`

This directory is ignored by git. If it exists locally, it is personal development state, not part
of the public project surface.

## License

This repository may be externally visible for GitHub Pages hosting, but it is not offered as an
open-source project. It is source-available for noncommercial use under the
[PolyForm Noncommercial License 1.0.0](./LICENSE).

Original essays, translations, and personal-brand materials remain copyright Alex Su. Third-party
images and other credited materials are excluded from that claim and remain subject to their
owners' terms. See [THIRD_PARTY_ASSETS.md](./THIRD_PARTY_ASSETS.md) before reusing any asset.
