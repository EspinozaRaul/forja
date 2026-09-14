// Regenerates lib/assets/exercise-videos.ts from assets/exercises/data.json.
//
// The map pairs every exercise's `originalId` with the bundled MP4 produced by
// scripts/convert-exercise-gifs.sh. Entries whose .mp4 is missing on disk are
// skipped, so the map only ever points at files that actually exist.
//
// Usage: node scripts/generate-exercise-videos-map.js
//
// Run it after convert-exercise-gifs.sh brings in new clips. The guard test
// __tests__/lib/assets/exercise-videos.test.ts fails if this map and the files
// on disk drift apart.

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'assets', 'exercises', 'data.json');
const VIDEO_DIR = path.join(ROOT, 'assets', 'exercises', 'videos');
const OUT_PATH = path.join(ROOT, 'lib', 'assets', 'exercise-videos.ts');

const items = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

const entries = [];
for (const item of items) {
  if (!item.id || !item.gf) continue;
  const file = item.gf.replace(/\.gif$/, '.mp4');
  if (!fs.existsSync(path.join(VIDEO_DIR, file))) continue;
  entries.push({ id: item.id, file });
}

const constLines = entries
  .map((entry) => `const vid_${entry.id} = require('../../assets/exercises/videos/${entry.file}');`)
  .join('\n');

const mapLines = entries
  .map((entry) => `  '${entry.id}': vid_${entry.id},`)
  .join('\n');

const output = `// Auto-generated — DO NOT EDIT

${constLines}

export const EXERCISE_VIDEOS: Record<string, any> = {
${mapLines}
};
`;

fs.writeFileSync(OUT_PATH, output);

console.log(`Wrote ${entries.length} entries to ${path.relative(ROOT, OUT_PATH)}`);
