#!/usr/bin/env bash
#
# Convert the bundled exercise GIFs into small H.264 MP4s so the app can play
# the animation offline straight from the bundle instead of fetching a remote
# GIF on every tap.
#
#   source : assets/exercises/gifs/*.gif    (kept in the repo as the source material)
#   output : assets/exercises/videos/*.mp4  (bundled via app.json, referenced by
#                                            lib/assets/exercise-videos.ts)
#
# The conversion is idempotent: any GIF whose .mp4 already exists is skipped, so
# re-running after an interruption only converts what is still missing.
#
# Requires an `ffmpeg` build with libx264. This machine has no system/brew
# ffmpeg; the conversion was done with the static macOS build from
# https://evermeet.cx/ffmpeg/ (ffmpeg 9.0.1-tessus, includes libx264). To get it:
#
#   mkdir -p /tmp/ffmpeg-bin
#   curl -L -o /tmp/ffmpeg-bin/ffmpeg.zip https://evermeet.cx/ffmpeg/getrelease/zip
#   unzip -o /tmp/ffmpeg-bin/ffmpeg.zip -d /tmp/ffmpeg-bin
#   FFMPEG=/tmp/ffmpeg-bin/ffmpeg ./scripts/convert-exercise-gifs.sh
#
# After converting, regenerate the asset map with:
#   node scripts/generate-exercise-videos-map.js
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GIF_DIR="$REPO_ROOT/assets/exercises/gifs"
VIDEO_DIR="$REPO_ROOT/assets/exercises/videos"

# ffmpeg with libx264. Override with FFMPEG=/path/to/ffmpeg when it is not on PATH.
FFMPEG="${FFMPEG:-ffmpeg}"

if ! command -v "$FFMPEG" >/dev/null 2>&1; then
  echo "error: ffmpeg not found (tried '$FFMPEG')." >&2
  echo "       Install a build with libx264, or point FFMPEG at one." >&2
  echo "       Static macOS build: https://evermeet.cx/ffmpeg/" >&2
  exit 1
fi

if [ ! -d "$GIF_DIR" ]; then
  echo "error: GIF source directory not found: $GIF_DIR" >&2
  exit 1
fi

mkdir -p "$VIDEO_DIR"

converted=0
skipped=0

shopt -s nullglob
for gif in "$GIF_DIR"/*.gif; do
  base="$(basename "$gif" .gif)"
  out="$VIDEO_DIR/$base.mp4"
  if [ -f "$out" ]; then
    skipped=$((skipped + 1))
    continue
  fi

  # Validated flags:
  #   -c:v libx264 -pix_fmt yuv420p  broad device/decoder support
  #   -crf 28                        keeps the 180x180 demos tiny with no visible loss
  #   -movflags +faststart           moov atom first, so playback starts immediately
  #   -an                            the demos are silent
  "$FFMPEG" -hide_banner -loglevel error -y \
    -i "$gif" \
    -movflags +faststart \
    -pix_fmt yuv420p \
    -c:v libx264 \
    -crf 28 \
    -an \
    "$out"

  converted=$((converted + 1))
done
shopt -u nullglob

# Size in KB (portable across the BSD du on macOS and GNU du on Linux).
dir_kb() {
  du -sk "$1" 2>/dev/null | awk '{ print $1 }'
}

gif_kb="$(dir_kb "$GIF_DIR")"
video_kb="$(dir_kb "$VIDEO_DIR")"
gif_mb="$(awk -v k="$gif_kb" 'BEGIN { printf "%.1f", k / 1024 }')"
video_mb="$(awk -v k="$video_kb" 'BEGIN { printf "%.1f", k / 1024 }')"

echo ""
echo "Exercise animation conversion summary"
echo "  converted : $converted"
echo "  skipped   : $skipped (mp4 already present)"
echo "  gifs      : ${gif_mb} MB"
echo "  videos    : ${video_mb} MB"
