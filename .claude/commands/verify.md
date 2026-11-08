---
description: Have an independent Claude process fact-check what the agents reported
argument-hint: [extra claims or leave empty to use the last agent report]
---

Run the independent verification. It must happen in a **separate Claude process**, not in this session and not through the Agent tool.

1. Collect the claims to check. Use the claims from the most recent agent report in this conversation, plus anything in the arguments below. Write each as one plain, checkable sentence (what was changed, which tests pass, which rules are respected). Copy the agents' wording faithfully; do not improve or soften it.
2. Save them to a file in the session scratchpad directory, one claim per line.
3. Run `.claude/scripts/verify-claims.sh <that file>` with Bash and wait for it to finish.
4. Show the verifier's table and its `OVERALL:` line exactly as returned. Do not summarize away any `FALSE`, `PARTIAL`, or `UNVERIFIABLE`.
5. If the result is `FAIL`, say which agent's claim failed and stop. Do not fix anything or commit until the user decides.

Extra claims: $ARGUMENTS
