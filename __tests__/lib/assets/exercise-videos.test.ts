import fs from 'node:fs';
import path from 'node:path';
import data from '../../../assets/exercises/data.json';

/**
 * Guards lib/assets/exercise-videos.ts against drifting from the bundled MP4s.
 *
 * The map is read as text rather than imported: `require('*.mp4')` is not
 * handled by the Jest asset transformer, and the map is generated code whose
 * only external contract is the id -> file pairing. Parsing the source keeps
 * this guard independent of how Metro resolves video assets while still
 * checking the two things that matter: every exercise with a converted video is
 * in the map, and every mapped file exists on disk.
 */

const ROOT = path.join(__dirname, '..', '..', '..');
const MAP_PATH = path.join(ROOT, 'lib', 'assets', 'exercise-videos.ts');
const MAP_DIR = path.dirname(MAP_PATH);
const VIDEO_DIR = path.join(ROOT, 'assets', 'exercises', 'videos');

const source = fs.readFileSync(MAP_PATH, 'utf8');

function parseConsts(src: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const match of src.matchAll(/const\s+(vid_\w+)\s*=\s*require\('([^']+)'\);/g)) {
    out.set(match[1], match[2]);
  }
  return out;
}

function parseEntries(src: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const match of src.matchAll(/'([^']+)':\s*(vid_\w+),/g)) {
    out.set(match[1], match[2]);
  }
  return out;
}

const consts = parseConsts(source);
const entries = parseEntries(source);

type DataItem = { id: string; gf?: string };

const items = data as DataItem[];

const fileFor = (item: DataItem) => item.gf?.replace(/\.gif$/, '.mp4');

const exercisesWithVideo = items.filter((item) => {
  const file = fileFor(item);
  return Boolean(file && fs.existsSync(path.join(VIDEO_DIR, file)));
});

describe('exercise video asset map', () => {
  it('maps every exercise that has a converted video', () => {
    const missing = exercisesWithVideo.map((item) => item.id).filter((id) => !entries.has(id));
    expect(missing).toEqual([]);
  });

  it('has no entry for an exercise without a converted video', () => {
    const withVideo = new Set(exercisesWithVideo.map((item) => item.id));
    const extra = [...entries.keys()].filter((id) => !withVideo.has(id)).sort();
    expect(extra).toEqual([]);
  });

  it('pairs each id with the exact file derived from data.json', () => {
    const wrong: string[] = [];
    for (const item of exercisesWithVideo) {
      const name = entries.get(item.id);
      const required = name ? consts.get(name) : undefined;
      const expectedFile = fileFor(item);
      if (!required || !expectedFile || !required.endsWith(`/${expectedFile}`)) {
        wrong.push(`${item.id} -> ${required ?? 'missing'}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('points every entry at a file that exists on disk', () => {
    const missing: string[] = [];
    for (const [id, name] of entries) {
      const required = consts.get(name);
      if (!required) {
        missing.push(`${id}: no require() for ${name}`);
      } else if (!fs.existsSync(path.resolve(MAP_DIR, required))) {
        missing.push(`${id}: ${required}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('has as many entries as there are mp4 files on disk', () => {
    const onDisk = fs.readdirSync(VIDEO_DIR).filter((file) => file.endsWith('.mp4'));
    expect(entries.size).toBe(onDisk.length);
  });
});
