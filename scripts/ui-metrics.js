#!/usr/bin/env node
'use strict';

/**
 * UI current-state metrics.
 *
 * The point of this script is that the counts quoted in `docs/ui-standard.md`
 * are reported output, not prose. It reads the repository source the same way
 * the a11y and i18n guards do and prints every named count next to the exact
 * predicate it used, so a reader can disagree with the predicate instead of
 * trusting the number.
 *
 * Standard library only. Two consumers:
 *   - `node scripts/ui-metrics.js` prints the report below.
 *   - `__tests__/lib/metrics.test.ts` imports `computeMetrics()` and compares it
 *     against the `ui-metrics` block in `docs/ui-standard.md`.
 *
 * The glyph metric deliberately reports two separate numbers. A sweep for the
 * five named glyphs (`✕ › ← × ↻`) reports a clean tree forever, because the
 * app's surviving arrow glyphs are ASCII `<` and `>` (see `app/(tabs)/progress.tsx`).
 * `glyphActions` counts only standalone named-glyph children; `glyphAsciiCandidates`
 * counts standalone ASCII arrows. They are never folded together.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SOURCE_DIRS = ['app', 'components', 'lib'];
const SOURCE_EXTENSIONS = ['.tsx', '.ts'];

/** The five glyphs the previous sweep declared dead. */
const NAMED_GLYPHS = '✕›←×↻';
/** ASCII arrows the named sweep is structurally blind to. */
const ASCII_ARROWS = ['<', '>'];

/** The three dense files `docs/roadmap.md` audited for button conversions. */
const AUDIT_FILES = [
  'app/(tabs)/routines.tsx',
  'app/session/[id].tsx',
  'components/session/SessionExerciseItem.tsx',
];

/**
 * The stable machine-readable shape written into `docs/ui-standard.md`.
 * The test asserts the parsed block has exactly these keys, so adding or
 * dropping a metric is a deliberate edit to this list, not silent drift.
 */
const MACHINE_BLOCK_KEYS = [
  'modals',
  'buttonCallsites',
  'buttonVariants',
  'buttonVariantFallthroughs',
  'buttonCompactCallsites',
  'pressables',
  'pressableAuditDenominator',
  'bareTouchableOpacityFiles',
  'bareTouchableOpacityTags',
  'ownBackgroundColorFiles',
  'radiusMd',
  'radiusLg',
  'radiusFull',
  'glyphActions',
  'glyphAsciiCandidates',
  'unlabelledInteractive',
  'accessibilityLabelSites',
  'accessibilityHintSites',
  'accessibilityHintKeys',
  'roleHeaderOccurrences',
  'catalogueKeysEs',
  'catalogueKeysEn',
];

// --- source walking (same idiom as __tests__/a11y/interactive-elements.test.ts) ---

function collectSourceFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') files.push(...collectSourceFiles(full));
    } else if (SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext)) && !entry.name.endsWith('.d.ts')) {
      files.push(full);
    }
  }
  return files;
}

/** Returns the source of one JSX opening tag starting at `start`. */
function readOpeningTag(src, start) {
  let i = start;
  let depth = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '{') depth += 1;
    else if (c === '}') depth -= 1;
    else if (c === '>' && depth === 0) break;
    else if (c === '"' || c === "'") {
      const end = src.indexOf(c, i + 1);
      if (end !== -1) i = end;
    }
    i += 1;
  }
  return src.slice(start, i + 1);
}

function rel(abs) {
  return path.relative(ROOT, abs).split(path.sep).join('/');
}

function countMatches(src, pattern) {
  return [...src.matchAll(pattern)].length;
}

function lineOf(src, index) {
  return src.slice(0, index).split('\n').length;
}

/** Flattens a nested i18n catalogue into dotted keys. Mirrors catalog-parity.test.ts. */
function flatten(node, prefix = '') {
  const out = [];
  for (const [key, value] of Object.entries(node)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out.push(full);
    else out.push(...flatten(value, full));
  }
  return out;
}

/** Reads an i18n catalogue, reporting a broken file instead of an opaque stack. */
function readCatalogue(lang) {
  const file = path.join(ROOT, 'lib/i18n', `${lang}.json`);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read i18n catalogue ${rel(file)}: ${error.message}`);
  }
}

/** Counting helpers for the two JSX-child glyph shapes. */
function glyphChildMatches(src, chars) {
  const hits = [];
  const raw = new RegExp(`>\\s*([${chars}])\\s*<`, 'g');
  for (const m of src.matchAll(raw)) hits.push({ char: m[1], index: m.index });
  const literal = new RegExp(`\\{\\s*['"]([${chars}])['"]\\s*\\}`, 'g');
  for (const m of src.matchAll(literal)) hits.push({ char: m[1], index: m.index });
  return hits;
}

// --- the metrics ---------------------------------------------------------

function computeMetrics() {
  const files = SOURCE_DIRS.flatMap((dir) => {
    const abs = path.join(ROOT, dir);
    return fs.existsSync(abs) ? collectSourceFiles(abs) : [];
  });
  const sources = new Map(files.map((file) => [rel(file), fs.readFileSync(file, 'utf8')]));

  // modals — `<Modal` opening tags.
  let modals = 0;
  // buttons — `<Button` opening tags, and how many carry `variant=`.
  let buttonCallsites = 0;
  let buttonVariants = 0;
  let buttonCompactCallsites = 0;
  // pressables — `<Pressable` + `<TouchableOpacity` per file.
  const pressablesByFile = new Map();
  // bare TouchableOpacity files and their tag total.
  const bareTouchables = new Map();
  // radii.
  let radiusMd = 0;
  let radiusLg = 0;
  let radiusFull = 0;
  // glyphs.
  let glyphActions = 0;
  let glyphOccurrences = 0;
  const glyphActionSites = [];
  const glyphAsciiSites = [];
  // a11y.
  let unlabelledInteractive = 0;
  let accessibilityLabelSites = 0;
  let accessibilityHintSites = 0;
  const accessibilityHintKeys = new Set();
  let roleHeaderOccurrences = 0;

  for (const [file, src] of sources) {
    modals += countMatches(src, /<Modal\b/g);

    for (const m of src.matchAll(/<Button\b/g)) {
      buttonCallsites += 1;
      const tag = readOpeningTag(src, m.index + 1);
      if (/\bvariant=/.test(tag)) buttonVariants += 1;
      if (/\bcompact\b/.test(tag)) buttonCompactCallsites += 1;
    }

    const pressableCount = countMatches(src, /<Pressable\b/g);
    const touchableCount = countMatches(src, /<TouchableOpacity\b/g);
    if (pressableCount + touchableCount > 0) {
      pressablesByFile.set(file, pressableCount + touchableCount);
    }
    if (touchableCount > 0) {
      bareTouchables.set(file, touchableCount);
    }

    radiusMd += countMatches(src, /borderRadius\.md\b/g);
    radiusLg += countMatches(src, /borderRadius\.lg\b/g);
    radiusFull += countMatches(src, /borderRadius\.full\b/g);

    const namedTotal = countMatches(src, new RegExp(`[${NAMED_GLYPHS}]`, 'g'));
    glyphOccurrences += namedTotal;
    for (const hit of glyphChildMatches(src, NAMED_GLYPHS)) {
      glyphActions += 1;
      glyphActionSites.push(`${file}:${lineOf(src, hit.index)}`);
    }
    for (const hit of glyphChildMatches(src, ASCII_ARROWS.join(''))) {
      glyphAsciiSites.push(`${file}:${lineOf(src, hit.index)} '${hit.char}'`);
    }

    for (const m of src.matchAll(/<(TouchableOpacity|Pressable)\b/g)) {
      const tag = readOpeningTag(src, m.index + 1);
      const accepted =
        tag.includes('accessibilityLabel') ||
        tag.includes('accessibilityRole') ||
        tag.includes('accessible={false}');
      if (!accepted) unlabelledInteractive += 1;
    }

    accessibilityLabelSites += countMatches(src, /accessibilityLabel=/g);
    accessibilityHintSites += countMatches(src, /accessibilityHint=/g);
    for (const m of src.matchAll(/accessibilityHint=\{t\('([^']+)'/g)) {
      accessibilityHintKeys.add(m[1]);
    }
    roleHeaderOccurrences += countMatches(src, /(?:accessibilityRole|role)=["']header["']/g);
  }

  const esKeys = flatten(readCatalogue('es'));
  const enKeys = flatten(readCatalogue('en'));

  const pressableAuditDenominator = AUDIT_FILES.reduce(
    (sum, file) => sum + (pressablesByFile.get(file) || 0),
    0,
  );

  const metrics = {
    modals,
    buttonCallsites,
    buttonVariants,
    buttonVariantFallthroughs: buttonCallsites - buttonVariants,
    buttonCompactCallsites,
    pressables: [...pressablesByFile.values()].reduce((a, b) => a + b, 0),
    pressableAuditDenominator,
    bareTouchableOpacityFiles: bareTouchables.size,
    bareTouchableOpacityTags: [...bareTouchables.values()].reduce((a, b) => a + b, 0),
    ownBackgroundColorFiles: [...bareTouchables.keys()].filter((file) =>
      /backgroundColor/.test(sources.get(file)),
    ).length,
    radiusMd,
    radiusLg,
    radiusFull,
    glyphActions,
    glyphAsciiCandidates: glyphAsciiSites.length,
    unlabelledInteractive,
    accessibilityLabelSites,
    accessibilityHintSites,
    accessibilityHintKeys: accessibilityHintKeys.size,
    roleHeaderOccurrences,
    catalogueKeysEs: esKeys.length,
    catalogueKeysEn: enKeys.length,
  };

  return {
    metrics,
    details: {
      pressablesByFile: [...pressablesByFile.entries()].sort((a, b) => b[1] - a[1]),
      glyphOccurrences,
      glyphActionSites,
      glyphAsciiSites,
      auditFiles: AUDIT_FILES,
    },
  };
}

/** Serializes the measured scalars as `key = value` lines for the doc block. */
function formatMachineBlock(metrics) {
  return MACHINE_BLOCK_KEYS.map((key) => `${key} = ${metrics[key]}`).join('\n');
}

/** The predicates each scalar was computed with, printed for the reader. */
const PREDICATES = {
  modals: '<Modal\\b opening tags',
  buttonCallsites: '<Button\\b opening tags (excludes <ButtonVariant>)',
  buttonVariants: 'the same opening tags, containing variant=',
  buttonVariantFallthroughs: 'buttonCallsites - buttonVariants',
  buttonCompactCallsites: 'the same opening tags, containing the compact prop',
  pressables: '<Pressable\\b + <TouchableOpacity\\b opening tags, all files',
  pressableAuditDenominator: `Pressable + TouchableOpacity tags across the three audit files (${AUDIT_FILES.join(', ')})`,
  bareTouchableOpacityFiles: 'files with at least one <TouchableOpacity\\b tag',
  bareTouchableOpacityTags: 'total <TouchableOpacity\\b opening tags',
  ownBackgroundColorFiles: 'bare TouchableOpacity files whose source contains backgroundColor',
  radiusMd: `borderRadius\\.md\\b`,
  radiusLg: `borderRadius\\.lg\\b`,
  radiusFull: `borderRadius\\.full\\b`,
  glyphActions: `standalone JSX children of [${NAMED_GLYPHS}] (>g< or {'g'})`,
  glyphAsciiCandidates: `standalone JSX children of ASCII < or > (>g< or {'g'})`,
  unlabelledInteractive: 'TouchableOpacity/Pressable opening tags without accessibilityLabel, accessibilityRole or accessible={false}',
  accessibilityLabelSites: 'accessibilityLabel= occurrences',
  accessibilityHintSites: 'accessibilityHint= occurrences',
  accessibilityHintKeys: "distinct t('key') behind accessibilityHint",
  roleHeaderOccurrences: 'accessibilityRole="header" or role="header" occurrences',
  catalogueKeysEs: 'flattened leaf keys in lib/i18n/es.json',
  catalogueKeysEn: 'flattened leaf keys in lib/i18n/en.json',
};

function printReport() {
  const { metrics, details } = computeMetrics();
  const lines = [];
  lines.push('Forja UI metrics');
  lines.push(`root: ${ROOT}`);
  lines.push('');
  lines.push('Named counts, each with the exact predicate used:');
  for (const key of MACHINE_BLOCK_KEYS) {
    lines.push(`  ${key} = ${metrics[key]}`);
    lines.push(`      <- ${PREDICATES[key]}`);
  }
  lines.push('');
  lines.push('pressablesByFile (Pressable + TouchableOpacity tags):');
  for (const [file, count] of details.pressablesByFile) {
    lines.push(`  ${count}\t${file}`);
  }
  lines.push('');
  lines.push(`glyph occurrences (all contexts, named set [${NAMED_GLYPHS}]): ${details.glyphOccurrences}`);
  lines.push(`glyph action sites: ${details.glyphActionSites.length ? details.glyphActionSites.join(', ') : '(none)'}`);
  lines.push('');
  lines.push('ASCII arrow glyph candidates (reported separately, never folded in):');
  if (details.glyphAsciiSites.length === 0) lines.push('  (none)');
  for (const site of details.glyphAsciiSites) lines.push(`  ${site}`);
  lines.push('');
  lines.push('Machine-readable block for docs/ui-standard.md:');
  lines.push('<!-- ui-metrics:begin -->');
  lines.push(formatMachineBlock(metrics));
  lines.push('<!-- ui-metrics:end -->');
  return lines.join('\n');
}

module.exports = { computeMetrics, formatMachineBlock, MACHINE_BLOCK_KEYS, printReport, ROOT };

if (require.main === module) {
  process.stdout.write(printReport() + '\n');
}
