# Image Workflow

This project keeps article-owned images beside each article. The source web pages for many
original figures are not agent-accessible, so the image files are expected to be placed manually.

## Folder Layout

```text
src/content/blog/[year]/[slug]/
  cn.mdx
  en.mdx
  images/
    cover.webp
    inline-01.webp
    inline-02.webp

src/assets/site/
  Reusable images imported by Astro pages or components.

src/assets/og/
  Reusable Open Graph image sources imported by Astro code.

public/images/
  Static files that need a stable public URL.
```

Run this after adding new article folders:

```bash
pnpm images:scaffold
```

## Naming

- Use `cover.webp` for the article cover.
- Use `inline-01.webp`, `inline-02.webp`, etc. for body figures.
- Use descriptive names only when the figure has a stable identity, for example
  `chai-2-antibody-design.webp`.
- Prefer `.webp` for screenshots and article figures. Use `.png` for sharp diagrams when WebP
  introduces visible artifacts.
- Keep article images inside `./images/` unless the image is truly shared across pages.

## Add A Cover Image

1. Place the file here:

   ```text
   src/content/blog/[year]/[slug]/images/cover.webp
   ```

2. Add this to the article frontmatter. The path must be relative to the MDX file.

   ```yaml
   image: ./images/cover.webp
   imageAlt: 'Short, specific description of the cover image'
   imageCaption: 'Optional caption shown under the article hero'
   imageSource: 'Optional source name'
   imageSourceUrl: 'https://example.com/original-source'
   ```

3. If both `cn.mdx` and `en.mdx` exist, add the same `image` path to both files. Translate
   `imageAlt` and `imageCaption` when useful.

The cover is used automatically by the article page, blog index cards, home latest-post cards,
related posts, Open Graph meta tags, and BlogPosting structured data.

## Add A Body Figure

1. Place the file in the article image folder:

   ```text
   src/content/blog/[year]/[slug]/images/inline-01.webp
   ```

2. Import the reusable component and the image near the top of the MDX body, after frontmatter:

   ```mdx
   import ArticleImage from '../../../../components/blog/ArticleImage.astro';
   import figure01 from './images/inline-01.webp';
   ```

3. Insert the figure where it should appear:

   ```mdx
   <ArticleImage
     src={figure01}
     alt="Specific description for screen readers and search"
     caption="Human-readable caption shown below the image"
     source="Nature Reviews Drug Discovery"
     sourceUrl="https://example.com/original-source"
     variant="wide"
     aspect="16:9"
   />
   ```

Supported `variant` values:

- `default`: normal article-width figure.
- `wide`: wider than the text column on desktop.
- `full`: widest editorial figure for diagrams or dense visuals.
- `compact`: small figure, logo, or narrow screenshot.

Supported `aspect` values:

- `auto`
- `16:9`
- `4:3`
- `1:1`
- `21:9`

## Replace Remote Markdown Images

Old content may contain remote Markdown images like this:

```mdx
![Figure title](https://example.com/image.jpg)
```

Replace them with local files and `ArticleImage`:

```mdx
import ArticleImage from '../../../../components/blog/ArticleImage.astro';
import figure01 from './images/inline-01.webp';

<ArticleImage
  src={figure01}
  alt="Figure title"
  caption="Figure title"
  source="Original source"
  sourceUrl="https://example.com/original-page"
  variant="wide"
/>
```

## Verify

Run the local checks after every batch of image work:

```bash
pnpm content:audit
pnpm build
```

`content:audit` will fail when a frontmatter cover points to a missing local file or lacks
`imageAlt`. It will warn about remote body images so they can be replaced gradually.
