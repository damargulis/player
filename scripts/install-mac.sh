#!/bin/bash
# Installs the packaged app into /Applications.
#
# Always copy with ditto from dist/mac rather than extracting dist/*.zip by hand: the zip stores
# correct unix modes, but GUI extractors and mode-ignoring copies strip the executable bit off
# Contents/MacOS/MyMusic, and macOS then reports "The application MyMusic can't be opened".
#
#   --check-only            refuse if the app is running, then exit (used by predeploy-mac,
#                           so a long package step fails fast instead of at the end)
#   MYMUSIC_FORCE_INSTALL=1 install even while the app is running
#   MYMUSIC_INSTALL_DEST    override the destination (used by the tests)
set -euo pipefail

APP_NAME="MyMusic"
SRC="dist/mac/${APP_NAME}.app"
DEST="${MYMUSIC_INSTALL_DEST:-/Applications/${APP_NAME}.app}"
CHECK_ONLY=""
if [ "${1:-}" = "--check-only" ]; then
  CHECK_ONLY="1"
fi

# The main process is named exactly after the binary; helpers are "MyMusic Helper (...)",
# so -x matches the app itself wherever it was launched from.
if pgrep -x "$APP_NAME" >/dev/null 2>&1; then
  if [ "${MYMUSIC_FORCE_INSTALL:-}" = "1" ]; then
    echo "warning: $APP_NAME is running. Installing anyway (MYMUSIC_FORCE_INSTALL=1)." >&2
    echo "         Quit and relaunch it before trusting what you see." >&2
  else
    echo "error: $APP_NAME is currently running (pid $(pgrep -x "$APP_NAME" | tr '\n' ' '))." >&2
    echo "       Quit it with Cmd+Q and run this again, so the bundle isn't replaced" >&2
    echo "       underneath the running app." >&2
    echo "       To install anyway: MYMUSIC_FORCE_INSTALL=1 yarn install-mac" >&2
    exit 1
  fi
fi

if [ -n "$CHECK_ONLY" ]; then
  exit 0
fi

if [ ! -d "$SRC" ]; then
  echo "error: $SRC not found. Run 'yarn electron-pack' first (or use 'yarn deploy-mac')." >&2
  exit 1
fi

rm -rf "$DEST"
ditto "$SRC" "$DEST"

# A copy that silently dropped modes is the whole reason this script exists, so prove it didn't.
BIN="$DEST/Contents/MacOS/$APP_NAME"
if [ ! -x "$BIN" ]; then
  echo "error: installed, but $BIN is not executable — the copy lost its permissions." >&2
  exit 1
fi

echo "Installed $DEST"
