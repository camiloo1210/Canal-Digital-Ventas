---
description: Run a task with the orchestrator and its specialist agents
argument-hint: <task to accomplish>
---

Use the `orchestrator` agent for this task. Give it the full task text below and require it to follow its own rules: split only independent work, write self-contained briefs, run `architecture-guardian` and `security-reviewer` on the result, and run `pnpm lint` and `pnpm test` itself.

When it finishes, list every claim in its report as a short bullet list so it can be passed to `/verify`. Do not commit.

Task: $ARGUMENTS
