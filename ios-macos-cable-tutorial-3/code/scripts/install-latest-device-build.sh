#!/usr/bin/env bash
set -euo pipefail

# Usage: install-latest-device-build.sh OWNER/REPO [COMMIT_SHA]
# Optional: DEVICE_ID for devicectl or a specific USB device;
# DEVICE_BRANCH to choose a branch when COMMIT_SHA is omitted.
if [[ "${1:-}" == "--help" ]]; then
  echo "Usage: $0 OWNER/REPO [COMMIT_SHA]"
  echo "Without SHA: latest available build on the repository default branch."
  echo "Optional environment: DEVICE_ID, DEVICE_BRANCH."
  exit 0
fi
if [[ $# -lt 1 || $# -gt 2 || ! "$1" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
  echo "Usage: $0 OWNER/REPO [COMMIT_SHA]" >&2
  exit 2
fi
REPO="$1"
REQUESTED_COMMIT="${2:-}"
DEVICE="${DEVICE_ID:-}"
if [[ -n "$REQUESTED_COMMIT" && ! "$REQUESTED_COMMIT" =~ ^[0-9a-fA-F]{4,40}$ ]]; then
  echo "COMMIT_SHA must be a short or full hexadecimal commit hash." >&2
  exit 2
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) is required. Install it with: brew install gh"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "GitHub CLI is not authenticated. Run: gh auth login"
  exit 1
fi

# Prefer Apple's devicectl when the active Xcode provides it. Older Xcode versions
# do not include devicectl, so fall back to ios-deploy for USB installation.
HAS_DEVICECTL=false
if command -v xcrun >/dev/null 2>&1 && xcrun --find devicectl >/dev/null 2>&1; then
  HAS_DEVICECTL=true
fi

if [[ "$HAS_DEVICECTL" == false ]] && ! command -v ios-deploy >/dev/null 2>&1; then
  echo "This Mac does not provide devicectl and ios-deploy is not installed."
  echo "Install the lightweight USB installer once with:"
  echo "  brew install ios-deploy"
  exit 1
fi

if [[ "$HAS_DEVICECTL" == true && -z "$DEVICE" ]]; then
  echo "devicectl is available, but no target device was specified."
  echo "Set DEVICE_ID to your iPhone name or identifier."
  echo
  xcrun devicectl list devices
  exit 2
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

find_run_with_device_artifact() {
  local runs_endpoint="$1"
  local run_id
  local artifact_id
  local run_ids
  run_ids="$(gh api --method GET --paginate "$runs_endpoint" "${RUN_FILTER[@]}" --jq '.workflow_runs[].id')" || return 2

  while IFS= read -r run_id; do
    [[ -n "$run_id" ]] || continue

    artifact_id="$(
      gh api \
        "repos/${REPO}/actions/runs/${run_id}/artifacts?per_page=100" \
        --jq '[.artifacts[] | select((.name == "device-app" or (.name | endswith("-device"))) and .expired == false)] | first | .id // empty'
    )" || return 2

    if [[ -n "$artifact_id" ]]; then
      printf '%s\n' "$run_id"
      return 0
    fi
  done <<< "$run_ids"

  return 1
}

RUN_FILTER=()
if [[ -n "$REQUESTED_COMMIT" ]]; then
  # Resolve short or full commit hashes to the canonical SHA first.
  if ! COMMIT_SHA="$(gh api "repos/${REPO}/commits/${REQUESTED_COMMIT}" --jq '.sha')"; then
    echo "Could not resolve commit: $REQUESTED_COMMIT"
    exit 1
  fi

  RUN_FILTER=(-f "head_sha=$COMMIT_SHA")
  if ! RUN_ID="$(find_run_with_device_artifact \
    "repos/${REPO}/actions/workflows/device-build.yml/runs?per_page=100")"; then
    echo "No non-expired device build artifact was found for commit $COMMIT_SHA."
    exit 1
  fi
else
  TARGET_BRANCH="${DEVICE_BRANCH:-}"
  if [[ -z "$TARGET_BRANCH" ]]; then
    TARGET_BRANCH="$(gh api "repos/$REPO" --jq '.default_branch')"
  fi

  RUN_FILTER=(-f "branch=$TARGET_BRANCH")
  if ! RUN_ID="$(find_run_with_device_artifact \
    "repos/${REPO}/actions/workflows/device-build.yml/runs?per_page=100")"; then
    echo "No non-expired device build artifact was found on branch $TARGET_BRANCH."
    exit 1
  fi

  COMMIT_SHA="$(gh api "repos/${REPO}/actions/runs/${RUN_ID}" --jq '.head_sha')"
fi

RUN_CONCLUSION="$(gh api "repos/${REPO}/actions/runs/${RUN_ID}" --jq '.conclusion // "in_progress"')"
if [[ "$RUN_CONCLUSION" != "success" ]]; then
  echo "Workflow conclusion is '$RUN_CONCLUSION'; installing the device artifact anyway."
fi

SHORT_SHA="${COMMIT_SHA:0:9}"
echo "Downloading build for $SHORT_SHA from Actions run $RUN_ID..."

# Support both the generic artifact and older project-device artifacts.
ARTIFACT_NAME="$(gh api "repos/${REPO}/actions/runs/${RUN_ID}/artifacts?per_page=100" \
  --jq '[.artifacts[] | select((.name == "device-app" or (.name | endswith("-device"))) and .expired == false)] | first | .name')"

# GH_REPO avoids relying on the --repo flag, which is missing from some older gh subcommands.
if ! GH_REPO="$REPO" gh run download "$RUN_ID" \
  --name "$ARTIFACT_NAME" \
  --dir "$TMP_DIR"; then
  echo "Could not download the artifact for $SHORT_SHA. It may have expired after the 90-day retention period."
  exit 1
fi

ZIP_PATH="$TMP_DIR/${ARTIFACT_NAME}.zip"
if [[ ! -f "$ZIP_PATH" ]]; then
  echo "$ARTIFACT_NAME.zip was not found in the downloaded Actions artifact."
  exit 1
fi

ditto -x -k "$ZIP_PATH" "$TMP_DIR/app"
APP_PATH="$(find "$TMP_DIR/app" -maxdepth 2 -type d -name '*.app' -print -quit)"

if [[ -z "$APP_PATH" ]]; then
  echo "An .app bundle was not found in the downloaded artifact."
  exit 1
fi

if [[ "$HAS_DEVICECTL" == true ]]; then
  echo "Installing $SHORT_SHA on $DEVICE with devicectl..."
  xcrun devicectl device install app --device "$DEVICE" "$APP_PATH"
else
  # ios-deploy automatically uses the connected iPhone when only one device is attached.
  echo "Installing $SHORT_SHA on the connected iPhone with ios-deploy..."
  if [[ -n "$DEVICE" ]]; then
    ios-deploy --id "$DEVICE" --bundle "$APP_PATH"
  else
    ios-deploy --bundle "$APP_PATH"
  fi
fi

echo "Done."
