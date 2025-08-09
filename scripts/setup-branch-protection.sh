#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/setup-branch-protection.sh <owner/repo>
# Requires: gh auth login

REPO=${1:-}
if [[ -z "$REPO" ]]; then
  echo "Usage: $0 <owner/repo>" >&2
  exit 1
fi

echo "Applying branch protection to $REPO: main"

# Basic PR requirements
gh api -X PUT \
  -H "Accept: application/vnd.github+json" \
  repos/$REPO/branches/main/protection \
  -f required_status_checks.strict=true \
  --raw-field required_status_checks.contexts='["build","test","STDIO zh smoke"]' \
  -f enforce_admins=true \
  -f required_pull_request_reviews.dismiss_stale_reviews=true \
  -f required_pull_request_reviews.require_code_owner_reviews=true \
  -f required_pull_request_reviews.required_approving_review_count=1 \
  -f restrictions=''

echo "Restricting direct push to main (allow only GitHub Actions)"
gh api -X PATCH \
  -H "Accept: application/vnd.github+json" \
  repos/$REPO/branches/main/protection/restrictions \
  --raw-field users='[]' \
  --raw-field teams='[]' \
  --raw-field apps='["github-actions"]'

echo "Done."


