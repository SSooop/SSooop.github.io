# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

IntelliPharma Hub is a bilingual (Chinese/English) personal blog built with Astro and React. It publishes articles about AI in pharmaceutical industry (AIDD - AI Drug Discovery).

## Commands

```bash
pnpm dev             # Start development server at localhost:3000
pnpm build           # Build for production
pnpm preview         # Preview production build
pnpm lint            # Run ESLint
pnpm type-check      # Run TypeScript checks
pnpm content:audit   # Validate blog frontmatter, translations, links, and local images
pnpm verify          # Run content audit, lint, type-check, and build
pnpm format          # Format code with Prettier
```

## Blog Content Structure

Blog articles are stored in `src/content/blog/[year]/[slug]/`:

- `[slug]/cn.mdx` - Chinese version
- `[slug]/en.mdx` - English version
- Images go in the same folder (optional, can be added later)

**注意：创建新文章时先不要添加图片引用**，先用纯文本内容构建验证通过后，再单独添加图片。

### Content Schema (src/content.config.ts)

Each article frontmatter requires:

- `title`: Article title
- `date`: Publication date (YYYY-MM-DD format in frontmatter)
- `description`: SEO description
- `lang`: "en" or "zh"
- `translationKey`: Shared bilingual article key, e.g. `"2025/article-slug"`
- `translations`: Validated map of available versions, e.g. `zh` -> `"2025/article-slug/cn"`
- `canonical`: The stable site URL for this exact language version
- `publications`: Structured list of full-text publication surfaces
- `related`: Optional ordered list of up to three bilingual `translationKey` values
- `keywords`: Optional SEO keyword list

### Adding New Bilingual Articles

1. Create folder: `src/content/blog/[year]/[slug]/`
2. Create `cn.mdx` (Chinese) and `en.mdx` (English)
3. Use this frontmatter template:

```yaml
---
title: 'Article Title'
date: 2025-08-04
description: 'SEO description'
lang: 'zh'
translationKey: '2025/article-slug'
translations:
  zh: '2025/article-slug/cn'
  en: '2025/article-slug/en'
canonical:
  url: '/zh/blog/2025/article-slug/cn'
  role: 'version_home'
publications:
  - platform: 'site'
    mode: 'full_text'
    status: 'published'
  - platform: 'wechat'
    mode: 'full_text'
    status: 'published'
    access: 'qr_or_account'
    account: '智药深瞳'
---
```

For `en.mdx`, set `lang: "en"`, `canonical.url: "/en/blog/[year]/[slug]/en"`, and
`translations.en: "[year]/[slug]/en"`.

Do not add placeholder publication URLs. WeChat can be represented by `access:
"qr_or_account"` and `account` until a real article URL exists. Medium is not part of the
current content schema. Add `x` or `linkedin` only when that full-text surface is actually
published or intentionally planned.

4. Keep article bodies focused on the article itself. Do not add hand-written opening summaries,
   reading-time labels, AI-friendly statements, platform distribution blocks, or serial links to
   WeChat Official Account articles. The shared blog template renders the description, calculated
   reading metrics, editorial boundary, and the complete bilingual distribution list at the end of
   each article.

Publication surfaces are rendered from the combined Chinese and English frontmatter for the
translation group. Keep platform claims out of article body copy unless the article itself is
discussing that platform.

Put intentionally curated past-article relationships in `related`, never in the article body.
The end-of-article related-post module shows those entries first and fills any remaining slots,
up to three, with the default recommendation behavior.

Citation blocks are rendered automatically from frontmatter and canonical metadata. Do not add
hand-written citation modules to article bodies.

5. Run `pnpm content:audit` and `pnpm build` to verify
6. Commit and push

### Commit and Push Process

```bash
git add src/content/blog/[year]/[slug]/
git commit -m "feat: 添加 [文章标题] 文章

新增中英文双语博客文章，探讨...

Co-Authored-By: Codex <noreply@openai.com>"
git push
```

## Key Files

- `src/content.config.ts` - Content collection schema
- `src/i18n/ui.ts` - Internationalization strings
- `src/config/constants.ts` - Site colors and constants
- `src/layouts/Layout.astro` - Main layout with CSP
