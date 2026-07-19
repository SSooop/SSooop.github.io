# Publishing Checklist

Use this checklist when publishing a new article or updating existing content.

## Site Content

- Create article files under `src/content/blog/[year]/[slug]/`.
- Use `cn.mdx` for Chinese and `en.mdx` for English.
- Draft text first. Add images only after the text-only build passes.
- Run `pnpm images:scaffold` after creating new article folders.
- Keep article images under `src/content/blog/[year]/[slug]/images/`.
- Follow [IMAGE_WORKFLOW.md](./IMAGE_WORKFLOW.md) for cover images, body figures, captions, and
  source metadata.
- Do not add placeholder publication URLs.
- Do not add hand-written citation modules in article bodies.

## Frontmatter

- `title`, `date`, `description`, `lang`, `translationKey`, `translations`, `canonical`, and
  `publications` are required.
- `image`, `imageAlt`, `imageCaption`, `imageSource`, and `imageSourceUrl` are optional, but
  `imageAlt` is required when `image` is present.
- `translationKey` must be `YYYY/slug`.
- `canonical.url` must be the stable site URL path for that language version.
- The `site` publication must be `published`.
- Use WeChat `access: "qr_or_account"` and `account: "智药深瞳"` until a real URL exists.
- Add `x` or `linkedin` only when that full-text surface is actually published or intentionally
  planned.

## Local Verification

Run the production checks before merging:

```bash
pnpm verify
pnpm test:smoke
```

For external publication URLs, use the scheduled audit or run:

```bash
pnpm content:audit:network
pnpm links:check:external
```

External checks can report `needs_review` for 401, 403, 429, timeouts, or bot protection. Treat
those as manual review items, not automatic evidence that the article is wrong.

## Platform Distribution

The repository is visible for GitHub Pages hosting, but platform credentials must never be stored
in source files, issue text, pull request comments, screenshots, build artifacts, or logs.

Use this model for future automation:

- Keep all credentials in GitHub Actions Secrets or Environment Secrets.
- Prefer a protected production environment with manual approval.
- Trigger platform publishing with `workflow_dispatch`, not from untrusted pull requests.
- Use one token per platform with the smallest usable scope.
- Rotate tokens after testing or whenever a platform account changes.
- For WeChat, prefer draft generation or manual review unless the official account API flow is
  fully confirmed.

## Final Review

- The built page opens in both `/zh/` and `/en/` navigation contexts.
- Internal links pass `pnpm links:check`.
- External links are either reachable or documented for manual review.
- Publication metadata matches the surfaces where the full text actually appears.
- No private notes, local agent files, or credentials are committed.
