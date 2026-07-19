# Writer Studio

Writer Studio is a localhost-only writing environment for IntelliPharma Hub. It keeps unfinished
work outside the published Astro content collection while allowing Codex and the browser editor to
work on the same files.

## Start

```powershell
pnpm writer
```

Open `http://127.0.0.1:4321`. On first start, the newest site article is copied byte-for-byte into
`.drafts/blog/` as an editable example. The `.drafts/` directory is intentionally ignored by Git.

The writing workflow is:

```text
$start-article-research → human outline → article-specific style → $draft-from-outline → revision
```

Every new article task contains `TASK.md`, `task.json`, an Agent-maintained `references.md`, a
human-authored `outline.md`, an editable `style.md`, bilingual MDX files, and an `images/` folder.
Writer Studio deliberately shows only `提纲 → 本篇风格 → 正文`: research context stays on disk for
the Skills, while images are managed inside the body editor instead of as a separate stage. Legacy
`brief.md`, `research.md`, and `image-plan.md` files are preserved but no longer displayed.

The client auto-saves after a short pause and also provides a manual Save button and `Ctrl/Cmd+S`.
It polls the task directory and reloads external Skill or editor changes when there are no unsaved
local changes. The `$draft-from-outline` control exposes only the explicit Skill invocation for the
active task; Writer Studio itself does not pretend to call a model or hide a generated prompt.

## Boundaries

- The server binds to `127.0.0.1` only.
- Draft identifiers are restricted to `YYYY/kebab-case-slug`.
- The API can write only language files under `.drafts/blog/` and can publish only into
  `src/content/blog/`.
- Uploaded images are restricted to common raster formats, capped at 8 MB, and kept inside the
  active article task.
- The two project Skills live under `.codex/skills/`; neither Skill publishes, commits, pushes, or
  invents missing research evidence.
- Publishing never overwrites an existing site article, runs the repository content audit, and
  rolls back the published copy if that audit fails. It never runs Git or deploy commands.

Run the focused tests with `pnpm writer:test`.
