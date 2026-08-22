# Writer Studio

Writer Studio is a localhost-only, multi-column writing environment for IntelliPharma Hub. It keeps
unfinished work outside the published Astro content collection while allowing Codex and the browser
editor to work on the same files.

## Start

```powershell
pnpm writer
```

Open `http://127.0.0.1:4321`. On first start, the newest site article is copied byte-for-byte into
`.drafts/blog/` as an editable example. The `.drafts/` directory is intentionally ignored by Git.

Use the column selector to move between IntelliPharma Insights, Economics After AI, and the Gaia
Project. Every column has a private Ideas Inbox under `.drafts/ideas/`; the fixed bilingual article
adapter currently remains exclusive to IntelliPharma Insights.

The article writing workflow is:

```text
$start-article-research → human outline → article-specific style → $draft-from-outline → revision
```

Every new article task contains `TASK.md`, `task.json`, an Agent-maintained `references.md`, a
human-authored `outline.md`, an editable `style.md`, bilingual MDX files, and an `images/` folder.
Inside an article task, Writer Studio deliberately shows only `提纲 → 本篇风格 → 正文`: research
context stays on disk for the Skills, while images are managed inside the body editor instead of as
a separate stage. Legacy `brief.md`, `research.md`, and `image-plan.md` files are preserved but no
longer displayed.

The client auto-saves after a short pause and also provides a manual Save button and `Ctrl/Cmd+S`.
It polls the task directory and reloads external Skill or editor changes when there are no unsaved
local changes. The `$draft-from-outline` control exposes only the explicit Skill invocation for the
active task; Writer Studio itself does not pretend to call a model or hide a generated prompt.

## Published site articles

The sidebar's **站点文章** section lists every published article under `src/content/blog/` with a
search box. Clicking an article opens it directly in the editor as the **site canonical edition**:

- Saves write straight into `src/content/blog/YYYY/slug/{cn,en}.mdx` through the same atomic,
  conflict-checked path as drafts. Going live is still gated by git commit, push, and CI.
- Structural validation runs before every write, and the repository content audit runs after it.
  A write is rolled back only when the saved file itself fails the audit; follow-up work in the
  sibling language file is reported as a toast instead of blocking the save.
- A missing language file opens with a prefilled frontmatter template (title and date carried over
  from the sibling edition) and is created on save. Update the sibling's `translations` afterwards.
- Images upload into the published article's `images/` directory; nothing in `.drafts/` changes.
- When a `.drafts/` copy exists for the same article, a banner warns that the two copies do not
  sync — the site edition being edited is the canonical one.

## Manual distribution package

For an active article, click **平台发布包**. Writer Studio creates platform-specific output without
contacting or signing in to any external service. The package is built from the draft copy while an
article is in progress, and from the published site copy (`src/content/blog/`) for any article
opened from the **站点文章** list — so republishing existing essays never depends on a stale draft.

- WeChat, Xueqiu, Medium, LinkedIn Article, and X Article receive conservative semantic HTML with
  inline styles, plus a plain-text fallback.
- LinkedIn feed posts and X posts receive concise plain-text copy with the canonical site URL.
- Title, canonical URL, body, and each referenced image can be copied separately because platform
  editors use separate fields and do not share one clipboard contract.
- Published article images are read from the site content directory when the seeded draft has no
  private copy. Non-PNG images are converted in the browser when **复制图片** is used; no localhost
  image URL is inserted into the external article.
- MDX-only tables, formulas, custom components, missing images, and legacy HTML are surfaced as
  review warnings instead of being silently dropped. Legacy HTML text is retained without its site
  styles.

Medium's official URL Import remains preferable for an already published article because it handles
canonical metadata and images more reliably. Clipboard formatting is a convenience layer, not an
API guarantee from the destination platforms, so always inspect the pasted draft before publishing.

## Boundaries

- The server binds to `127.0.0.1` only.
- Mutating API requests require a per-process session token and same-origin browser requests.
- Column definitions are explicit; book and research projects cannot accidentally publish through
  the blog adapter.
- Draft identifiers are restricted to `YYYY/kebab-case-slug`.
- The API can write language files under `.drafts/blog/`, publish new articles only into
  `src/content/blog/` (create-only), and edit the language files and images of articles that
  already exist in `src/content/blog/`. It can never create or delete an article directory.
- Uploaded images are restricted to common raster formats, capped at 8 MB, and kept inside the
  active article task.
- The two project Skills live under `.codex/skills/`; neither Skill publishes, commits, pushes, or
  invents missing research evidence.
- Publishing never overwrites an existing site article, runs the repository content audit, and
  rolls back the published copy if that audit fails. It never runs Git or deploy commands.
- Ideas and drafts remain under the Git-ignored `.drafts/` directory. Platform credentials do not
  belong there; future connectors must use an OS keychain or a private secret manager.
- The manual distribution package neither stores credentials nor sends content. Its external-editor
  links navigate only after an explicit click.

See `docs/WRITER_STUDIO_ROADMAP.md` for the content-adapter, distribution-ledger, platform API, and
privacy roadmap.

Run the focused tests with `pnpm writer:test`.
