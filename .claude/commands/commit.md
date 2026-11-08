---
description: Commit current changes following the repo's Conventional Commits rules
argument-hint: [optional notes about what to include]
---

Use the `committer` agent to commit the current changes.

Pass it this attribution line to end every message with: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

It must stage explicit files, split unrelated changes into separate commits, let the husky hooks run, and never push. Do not run this if the last `/verify` result was `FAIL`; tell the user instead.

Notes from the user: $ARGUMENTS
