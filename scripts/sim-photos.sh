#!/usr/bin/env bash
# Puts the sample screenshots into the booted simulator's photo library and gives Banter
# full photo access, so "Use latest screenshot" can be tested.
#
# "Newest" means the time the picture was taken (from its own data), not when it was added.
# A file added last is the newest only if it was also taken last. Pass the one you want as
# "latest" last, and make sure it is the most recently taken one:
#   bash scripts/sim-photos.sh samples/IMG_5198.HEIC
# With no argument, every image in samples/ is added in name order.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ $# -gt 0 ]]; then
  FILES=("$@")
else
  shopt -s nullglob nocaseglob
  FILES=(samples/*.heic samples/*.png samples/*.jpg samples/*.jpeg)
fi
if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "No images to add. Put screenshots in samples/ first." >&2
  exit 2
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

for file in "${FILES[@]}"; do
  # The simulator takes JPEG reliably; phone screenshots are often HEIC.
  out="$WORK/$(basename "${file%.*}").jpg"
  sips -s format jpeg -s formatOptions 90 "$file" --out "$out" >/dev/null
  xcrun simctl addmedia booted "$out"
  # A gap, so each photo gets its own creation time and the order is certain.
  sleep 1
done

xcrun simctl privacy booted grant photos com.banterlines.app
echo "Added ${#FILES[@]} image(s). Newest: $(basename "${FILES[${#FILES[@]}-1]}")"
