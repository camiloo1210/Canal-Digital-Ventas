---
description: One command - run the whole agent team on a task, self-review in nested layers, then independent verification
argument-hint: <what you want done> [--commit]
---

Run the full pipeline below on this request: $ARGUMENTS

## Pipeline

1. **Plan and delegate (layer 1).** Use the `orchestrator` agent with the request. It splits the work into independent parts and sends each to the right implementer (`core-implementer`, `frontend-implementer`, `qa-e2e`) with a self-contained brief. Dependent steps run in order; independent ones run in parallel.
2. **Nested self-review (layers 2 and 3).** Each implementer spawns `architecture-guardian`, and `security-reviewer` when the change touches auth, tenants, orders, payments, migrations, or workers, on its own diff, and fixes what they report.
3. **Orchestrator checks.** It runs `pnpm lint` and `pnpm test` itself and ends its report with a plain list of checkable claims.
4. **Independent verification (separate process).** Save those claims to a file in the session scratchpad and run `.claude/scripts/verify-claims.sh <file>` with Bash. Show the verifier's table and its `OVERALL:` line exactly as returned.
5. **Decision.**
   - `OVERALL: FAIL`: report which claims failed and stop. Fix nothing and commit nothing until the user decides.
   - `OVERALL: PASS`: report the outcome. Commit only if the request contains `--commit`, using the `committer` agent with the attribution line `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Otherwise ask whether to commit.

## Rules

- Nesting depth is three layers (orchestrator, implementers, reviewers). Nothing deeper.
- No more than 4 agents at once. Never let two agents edit the same file.
- The independent verifier never runs through the Agent tool.
- Do not push.
