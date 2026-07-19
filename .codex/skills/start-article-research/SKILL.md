---
name: start-article-research
description: Start or resume the combined conception-and-research phase for an IntelliPharma Hub article. Ensure Writer Studio is running and open in the in-app browser, resolve or create the local article task, and preserve durable ideas, evidence, sources, counterarguments, decisions, and open questions in references.md. Use when the user begins brainstorming, discussing, framing, or researching an article, including when the writing client was not started first.
---

# Start article research

Treat conversation and research as one Agent-supported phase. Make the writing workspace available at the beginning, then leave the human-authored outline and article body untouched.

## Start and open Writer Studio

1. Read the repository `AGENTS.md` and preserve all existing draft files.
2. Tell the user this Skill is checking or starting Writer Studio.
3. From the repository root, run the following in a PTY with a short initial yield and keep the returned execution session alive:

   ```powershell
   node .codex/skills/start-article-research/scripts/ensure-writer-studio.mjs
   ```

   If `node` is not on `PATH`, load the bundled workspace dependencies and invoke the script with the returned Node.js executable. When the server was not already running, the script deliberately remains attached as its supervisor; do not terminate the live session after it prints the ready URL. The script verifies the Writer Studio API before starting anything. If port 4321 belongs to another service, stop and report the collision; never kill or replace that process.

4. Use the `browser:control-in-app-browser` capability to open or focus `http://127.0.0.1:4321/`. Do not launch an external system browser. If in-app browser control is unavailable, give the exact URL and state that it was not opened automatically.

## Resolve the article task

- Prefer an explicit `YYYY/kebab-case-slug` from the user.
- Continue the uniquely matching existing task when the discussion clearly refers to it. Never silently switch to a different draft merely because it was modified recently.
- For a genuinely new article, create the task through Writer Studio once title, year, and slug can be inferred safely. Ask only for information whose choice would materially change the task identity.
- Confirm that `.drafts/blog/<id>/` contains `TASK.md`, `task.json`, `references.md`, `outline.md`, `style.md`, `cn.mdx`, `en.mdx`, and `images/`.
- Keep the task at `ideation` while the question is being framed and researched. Move it to `outline` only when the user says they are ready to write the outline.

## Preserve durable thinking

Read [reference-record.md](references/reference-record.md) completely before editing `references.md`.

- Update the file after each substantial conceptual turn or research batch. Merge with existing notes; never replace user-authored material wholesale.
- Preserve the user's original claims as `[作者判断]`. Mark Agent synthesis, source-backed facts, and unresolved claims separately.
- Save only information that can change the outline or later draft. Do not dump chat transcripts.
- For dates, numbers, quotations, product capabilities, and other verifiable claims, record a direct URL, access date, what the source supports, and what it does not establish. Prefer primary sources.
- Preserve counterexamples, scope conditions, discarded branches, and open questions, not only evidence favorable to the thesis.
- When browsing is required, research first and then write the resulting evidence cards to `references.md` in the same turn.

## Boundaries and handoff

- Do not draft the outline or article body unless the user separately requests that work.
- Do not claim Agent suggestions are the author's ideas.
- Do not publish to `src/content`, generate image references, commit, push, or deploy.
- Do not delete legacy `brief.md`, `research.md`, or `image-plan.md`; they remain compatibility inputs.
- Finish by reporting the task ID, what was added to `references.md`, the main unresolved questions, and whether Writer Studio is open. The handoff should leave the user ready to edit `outline.md` directly.
