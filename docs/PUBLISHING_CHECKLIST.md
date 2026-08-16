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
- Do not add hand-written summaries, reading-time labels, AI-friendly statements, distribution
  blocks, or serial links to WeChat Official Account articles. The shared article template owns
  these elements.

## Frontmatter

- `title`, `date`, `description`, `lang`, `translationKey`, `translations`, `canonical`, and
  `publications` are required.
- `image`, `imageAlt`, `imageCaption`, `imageSource`, and `imageSourceUrl` are optional, but
  `imageAlt` is required when `image` is present.
- `translationKey` must be `YYYY/slug`.
- `related` is optional and accepts up to three ordered `YYYY/slug` translation keys. Use it
  instead of adding past-article or related-reading sections to the body.
- `canonical.url` must be the stable site URL path for that language version.
- The `site` publication must be `published`.
- Use WeChat `access: "qr_or_account"` and `account: "智药深瞳"` until a real URL exists.
- Add `x` or `linkedin` only when that full-text surface is actually published or intentionally
  planned.
- Record the real external URL once it exists. The article footer combines publication metadata
  from both language editions, so Chinese and English pages expose the same complete channel list.

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

- Keep authoring and pre-publication payloads in Writer Studio's private runtime, not in public-repo
  CI jobs.
- Store local credentials in the OS keychain. If an always-on scheduler is required, use a separate
  private worker with a managed secret store and KMS; the public repository contains only code and
  secret references.
- Require a preview and explicit approval before the first live action on each platform or account.
- Use one token per platform with the smallest usable scope, and rotate or revoke it after testing
  or whenever an account changes.
- Log content hashes, public remote IDs, timestamps, and redacted error codes only. Never log tokens,
  unpublished bodies, authorization headers, or raw platform responses containing account data.
- For WeChat, prefer draft generation and manual review unless the official account's subject type,
  certification, IP whitelist, and `freepublish` permissions are confirmed.
- Do not automate Medium or Xueqiu through cookies, private endpoints, or browser scripting. Generate
  a reviewable manual publication package instead.

For a manual publication from Writer Studio:

1. Open **平台发布包**, select the destination platform and language, and read its compatibility
   note.
2. Copy the title into the platform's title field, then use **复制带排版正文** for a long-form editor
   or **复制发布文案** for LinkedIn/X feed posts.
3. Replace each numbered image marker by using **复制图片** in order. Do not publish a localhost,
   `blob:`, or `data:` image URL.
4. For Medium, prefer its official URL Import with the published canonical URL. Use rich-text copy
   only as a fallback.
5. Resolve every formula, data-table, MDX-component, missing-image, or legacy-HTML warning before the
   final platform action.
6. Inspect the destination draft before publishing. A successful clipboard write proves only that
   the package was copied; it does not prove the platform preserved every style or uploaded every
   image.

## Final Review

- The built page opens in both `/zh/` and `/en/` navigation contexts.
- Internal links pass `pnpm links:check`.
- External links are either reachable or documented for manual review.
- Publication metadata matches the surfaces where the full text actually appears.
- Both language versions show the same end-of-article distribution list and editorial boundary.
- No private notes, local agent files, or credentials are committed.
