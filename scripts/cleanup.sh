#!/usr/bin/env bash
# scripts/cleanup.sh — one-shot cleanup for the iOS-first redesign.
#
# Why a script: the macOS-mounted sandbox can't unlink files in the repo,
# so the AI assistant generated this script for you to review and run.
# Read it end-to-end before executing. Every step is logged and skippable.
#
# Run from the repo root:
#   chmod +x scripts/cleanup.sh
#   ./scripts/cleanup.sh
#
# Flags:
#   --dry-run     show what would happen without changing anything
#   --skip-opik   keep the Opik observability code in place
#   --skip-docs   keep the heavy planning docs in repo root
#   --skip-test1  keep lecocer-mconnect-test1/

set -euo pipefail

DRY_RUN=0
SKIP_OPIK=0
SKIP_DOCS=0
SKIP_TEST1=0

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --skip-opik) SKIP_OPIK=1 ;;
    --skip-docs) SKIP_DOCS=1 ;;
    --skip-test1) SKIP_TEST1=1 ;;
    *) echo "Unknown flag: $arg"; exit 2 ;;
  esac
done

run() {
  if [[ $DRY_RUN -eq 1 ]]; then
    echo "  DRY: $*"
  else
    echo "  RUN: $*"
    eval "$@"
  fi
}

step() { echo ""; echo "==> $*"; }

if [[ ! -f package.json ]] || ! grep -q "lecoder-mconnect-monorepo" package.json; then
  echo "Run this from the repo root (lecoder-mconnect/)." >&2
  exit 1
fi

# 1. Clear stale git locks (sandbox left them behind).
step "Clearing stale git locks"
for f in .git/index.lock .git/objects/maintenance.lock; do
  if [[ -e "$f" ]]; then run "rm -f \"$f\""; else echo "  ok: $f not present"; fi
done

# 2. Drop the abandoned Xcode prototype.
step "Removing lecocer-mconnect-test1/ (old Xcode prototype)"
if [[ $SKIP_TEST1 -eq 1 ]]; then
  echo "  skipped (--skip-test1)"
elif [[ -d lecocer-mconnect-test1 ]]; then
  run "rm -rf lecocer-mconnect-test1"
else
  echo "  ok: already gone"
fi

# 3. Archive the heavy planning docs that don't reflect current direction.
step "Archiving heavy planning docs to docs/archive/"
if [[ $SKIP_DOCS -eq 1 ]]; then
  echo "  skipped (--skip-docs)"
else
  run "mkdir -p docs/archive"
  for doc in \
    LECODER-AGENT-HUB-PLAN.md \
    PRD-LECODER-AGENTOS.md \
    PLAN-v0.1.2.md \
    SPRINT-PLAN.md \
    HACKATHON.md \
    HACKATHON-SUBMISSION.md \
    DASHBOARD-SETUP.md
  do
    if [[ -f "$doc" ]]; then
      run "git mv \"$doc\" \"docs/archive/$doc\" 2>/dev/null || mv \"$doc\" \"docs/archive/$doc\""
    fi
  done
fi

# 4. Remove Opik observability (CLI + server). Keeps notifications + auth.
step "Removing Opik observability"
if [[ $SKIP_OPIK -eq 1 ]]; then
  echo "  skipped (--skip-opik)"
else
  for path in \
    packages/cli/src/observability \
    packages/cli/src/opik \
    packages/server/src/observability
  do
    if [[ -d "$path" ]]; then run "rm -rf \"$path\""; else echo "  ok: $path not present"; fi
  done

  # Remove opik dep from cli + server package.json (idempotent).
  for pkg in packages/cli/package.json packages/server/package.json; do
    if [[ -f "$pkg" ]] && grep -q '"opik"' "$pkg"; then
      run "node -e \"const p=require('./$pkg');delete (p.dependencies||{}).opik;delete (p.optionalDependencies||{}).opik;require('fs').writeFileSync('./$pkg', JSON.stringify(p,null,2)+'\\n');\""
    fi
  done
fi

# 5. Rewrite ROADMAP.md and CHANGELOG.md mentions of Opik in passing
#    (only safe, automatic edits — anything tricky is left for manual review).
step "Pruning README badge / Opik passes (manual review reminder)"
echo "  README.md was already rewritten by the assistant; double-check before committing."

# 6. Stage everything for review.
step "Staging changes"
if [[ $DRY_RUN -eq 1 ]]; then
  echo "  DRY: git add -A"
else
  git add -A
  echo ""
  echo "Done. Review with:  git status   and   git diff --cached"
  echo "Commit with:        git commit -m \"chore: cleanup for iOS-first redesign\""
fi
