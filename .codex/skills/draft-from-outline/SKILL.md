---
name: draft-from-outline
description: Create reviewable Chinese and English first drafts for an IntelliPharma Hub article from its human-authored outline, local research record, editable article-specific style guide, and project house style. Use when the user has completed an outline and asks Codex to turn it into body drafts; treat the output as an imperfect starting point for human revision, never as a finished article.
---

# Draft from outline

Turn a human decision structure into prose without reviving every discarded Agent suggestion. The outline is a content contract; research is a selective evidence pool.

## Resolve inputs and authority

1. Resolve one explicit or unambiguous article ID. Do not guess between multiple drafts.
2. Read repository `AGENTS.md`, then read `.drafts/blog/<id>/TASK.md`, `task.json`, `references.md`, `outline.md`, `style.md`, `cn.mdx`, and `en.mdx`. Read non-empty legacy `brief.md` and `research.md` only as compatibility inputs.
3. Read [house-style.md](references/house-style.md) completely.
4. Apply these precedence rules:

   - Content scope: current user instruction → `outline.md` → selected material from `references.md`.
   - Expression: current user instruction → `style.md` → house style.
   - Factual accuracy: verifiable sources outrank wording in any planning file.

Research is not a checklist to exhaust. Do not restore concepts, examples, or branches the author omitted from the outline, especially items marked `[放弃]`.

## Gate before drafting

- Confirm the outline states a central claim, the relationship between major sections, and a closing direction.
- Ask only about contradictions that would materially change the thesis. Repair ordinary transitions yourself.
- A blank `style.md` means use the house style; it is not a blocker.
- Inspect both MDX bodies. If either already contains substantial human prose, preserve it and integrate around it. Do not replace a human draft wholesale without explicit permission.
- If timely facts, quotations, product capabilities, or numbers lack support, verify them and update `references.md`, or mark the claim unresolved instead of smoothing it into certainty.

## Produce the first draft

1. Draft Chinese first. Preserve frontmatter exactly and edit only the body.
2. Reconstruct the argument as continuous prose; do not mechanically turn every outline bullet into a heading or paragraph. Add only necessary explanation and connective reasoning, not new central claims.
3. Distinguish source fact, analogy, author judgment, and recommendation. State the boundary of external theories instead of claiming that a metaphor proves the scientific argument.
4. Do not fabricate first-person experience, internal company facts, quotations, data, citations, or tool usage.
5. The first pass is text-only. Do not add image references; images belong to later body editing.
6. Self-review against the outline: every core node is represented, each section advances the thesis, discarded research has not returned, unsupported certainty is absent, and AI filler has been removed.
7. Write the English version as an argument-equivalent essay, not a sentence-aligned translation. Preserve qualification and evidence while rewriting syntax, idiom, headings, and cultural references. Scan for all remaining Chinese characters and Chinese punctuation.
8. Save both files, run Writer Studio validation or `pnpm content:audit` as appropriate, and update `task.json` to stage `draft` only after the drafts are valid.

## Boundaries and handoff

- Never modify `outline.md`, `style.md`, or an author's recorded judgments merely to make generation easier.
- Do not publish, create publication claims, add hand-written citation modules, commit, push, or deploy.
- Call the result an initial draft. Report the passages most in need of the author's rewriting, Agent-inferred connections, unresolved facts, and meaningful non-literal choices in the English version.
