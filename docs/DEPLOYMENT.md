# Deployment

The current production target is the GitHub Pages user site:

```text
https://ssooop.github.io
```

This means the active base path is `/`, not `/intellipharma-hub`.

GitHub serves a user site at this root URL only from the repository named
`SSooop.github.io`. The public-transition workflow must rename the current private repository to
that canonical name before enabling Pages.

## Required Configuration

The default configuration is:

```text
SITE_URL=https://ssooop.github.io
PUBLIC_BASE=/
```

These defaults are represented in:

- `astro.config.mjs`
- `src/config/site.ts`
- `.env.example`

Do not set `PUBLIC_BASE=/intellipharma-hub` unless the site is intentionally moved back to a
GitHub project-page deployment.

## Local Verification

Before publishing or merging deployment-related changes:

```bash
pnpm exec playwright install chromium
pnpm verify
pnpm test:smoke
```

For a local production preview:

```bash
pnpm build
pnpm preview
```

## GitHub Pages

In the GitHub repository settings:

1. Open **Settings** > **Pages**.
2. Use **GitHub Actions** as the build and deployment source when a deployment workflow exists.
3. Keep the final site URL aligned with `https://ssooop.github.io`.

The deployment workflow can bootstrap Pages through `actions/configure-pages` when a
`PAGES_SETUP_TOKEN` secret exists. GitHub does not allow `GITHUB_TOKEN` to enable Pages for a
repository that has no Pages site yet. For a first-time bootstrap without using the Settings UI,
create a repository secret named `PAGES_SETUP_TOKEN` with one of these token types:

- a fine-grained personal access token with Pages write access to this repository;
- a classic personal access token with `repo` scope;
- a GitHub App token with `administration:write` and `pages:write`.

After Pages is enabled once, the normal `GITHUB_TOKEN` permissions in the workflow are enough for
subsequent deploys, and the setup secret can be deleted or left unused.

The `Deploy GitHub Pages` workflow treats `main` as production:

- feature branches and pull requests validate but do not deploy;
- pushes to `main` run verification, smoke tests, and deploy `dist/`;
- manual dispatch can redeploy the current `main` state.

The workflow uses GitHub's Pages artifact deployment actions and should not require repository
secrets for normal site builds.

## Future Project-Page Deployment

If the site is intentionally moved to a project-page repository later, update all of the following
in one change:

- `PUBLIC_BASE`
- `SITE_URL` if the host changes
- canonical URL checks
- sitemap output
- README deployment notes

## Visibility And License

This repository may be externally visible to support GitHub Pages hosting. Visibility does not
grant an open-source license beyond the license file. Keep private credentials, unpublished notes,
and local agent workspaces out of the repository.
