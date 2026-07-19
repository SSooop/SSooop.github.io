# Maintenance Automation

This site treats `main` as the production branch for `https://ssooop.github.io`.

## Branch Model

- `main` is deployable production.
- Feature branches run validation but do not deploy.
- Pull requests to `main` should prove that the site still builds and renders.

## Workflows

- `CI` runs on pull requests to `main`, pushes to non-`main` branches, and manual dispatch.
- `Deploy GitHub Pages` runs on pushes to `main` and manual dispatch.
- `External Link Audit` runs weekly and can be triggered manually.

## Required Local Checks

Install the local Playwright browser once per machine:

```bash
pnpm exec playwright install chromium
```

```bash
pnpm verify
pnpm test:smoke
```

`pnpm verify` runs content audit, format check, lint, type-check, production build, and internal
link checks. `pnpm test:smoke` builds the site and opens key pages with Playwright.

## Dependency Updates

Renovate is the single dependency automation path. It groups ecosystem updates and maintains the
lockfile weekly. Dependabot is intentionally not used to avoid duplicate dependency pull requests.

Do not enable dependency automerge until Renovate pull requests have been stable for several
weeks.

## External Links

External links are audited separately because many platforms block HEAD requests, bots, or
unauthenticated access.

The external audit distinguishes:

- `broken`: hard failures such as 404 or 410.
- `needs_review`: auth blocks, bot protection, rate limits, timeouts, or transient server errors.
- `ok`: successful responses.

Manual review is expected for `needs_review`.
