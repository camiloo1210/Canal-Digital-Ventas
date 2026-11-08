#!/usr/bin/env bash
# Runs the independent-verifier in a separate Claude Code process with no shared context.
# Usage: .claude/scripts/verify-claims.sh claims.txt     (or pipe claims on stdin)
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

if [ "$#" -ge 1 ]; then
  claims="$(cat "$1")"
else
  claims="$(cat)"
fi

if [ -z "${claims//[[:space:]]/}" ]; then
  echo "No claims provided." >&2
  exit 2
fi

prompt="Audit these claims against the repository. Verify each one yourself.

CLAIMS:
${claims}"

exec claude -p "$prompt" \
  --agent independent-verifier \
  --model opus \
  --no-session-persistence \
  --permission-mode default \
  --allowedTools "Read" "Grep" "Glob" \
    "Bash(git status:*)" "Bash(git diff:*)" "Bash(git log:*)" "Bash(git show:*)" \
    "Bash(pnpm lint)" "Bash(pnpm test)" "Bash(pnpm vitest run:*)" "Bash(pnpm exec tsc:*)" \
  --disallowedTools "Edit" "Write" "NotebookEdit" "Agent"
