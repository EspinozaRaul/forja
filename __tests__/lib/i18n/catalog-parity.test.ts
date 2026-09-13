import fs from 'node:fs';
import path from 'node:path';
import es from '../../../lib/i18n/es.json';
import en from '../../../lib/i18n/en.json';

/**
 * Guards the i18n catalogs against silent divergence.
 *
 * Background: TypeScript cannot validate i18n keys, and i18next fails soft —
 * a key missing in the current language renders the raw key, and a key missing
 * only in the *other* language silently serves the fallback language. Neither
 * shows up in a build, a type check, or a smoke test done in one language.
 * These tests are the only thing standing between a typo and a screen full of
 * `settings.title`.
 */

type Json = { [key: string]: Json | string };

function flatten(node: Json, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(node)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      out.set(full, value);
    } else {
      for (const [k, v] of flatten(value, full)) out.set(k, v);
    }
  }
  return out;
}

const esFlat = flatten(es as Json);
const enFlat = flatten(en as Json);

describe('i18n catalog parity', () => {
  it('defines every es.json key in en.json', () => {
    const missing = [...esFlat.keys()].filter((k) => !enFlat.has(k)).sort();
    expect(missing).toEqual([]);
  });

  it('defines every en.json key in es.json', () => {
    const missing = [...enFlat.keys()].filter((k) => !esFlat.has(k)).sort();
    expect(missing).toEqual([]);
  });

  it('keeps the same top-level groups in both catalogs', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort());
  });
});

/**
 * Scans for static `t('some.key')` calls and asserts each one resolves to a
 * *string* in both catalogs. Catches typo'd keys and the
 * group-called-as-string mistake (e.g. `t('progress.exercises')`, where
 * `progress.exercises` is an object).
 */
describe('i18n usage', () => {
  const ROOTS = ['app', 'components', 'lib'];
  // First argument of t(), single-quoted, followed by `)` or `,` so that both
  // the plain form `t('key')` and the options form `t('key', { count })` are
  // covered. The trailing `[,)]` deliberately ignores concatenations such as
  // `t('a' + b)`, which are not static keys.
  const STATIC_KEY = /(?<![A-Za-z0-9_.])t\(\s*'([A-Za-z][A-Za-z0-9_.]*)'\s*[,)]/g;
  // Template-literal keys `t(`prefix.${x}`)`. Only the literal parts are
  // captured; the base path and the reachability of its children are asserted
  // by the "resolves every template-literal key base" test below.
  const TEMPLATE_KEY = /(?<![A-Za-z0-9_.])t\(\s*`([^`]*)`/g;

  function collectSourceFiles(dir: string): string[] {
    const files: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules') files.push(...collectSourceFiles(full));
      } else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
        files.push(full);
      }
    }
    return files;
  }

  const sourceFiles = (() => {
    const root = path.join(__dirname, '..', '..', '..');
    const files: string[] = [];
    for (const dir of ROOTS) {
      const abs = path.join(root, dir);
      if (fs.existsSync(abs)) files.push(...collectSourceFiles(abs));
    }
    return files;
  })();

  const usedKeys = (() => {
    const keys = new Set<string>();
    for (const file of sourceFiles) {
      for (const match of fs.readFileSync(file, 'utf8').matchAll(STATIC_KEY)) {
        keys.add(match[1]);
      }
    }
    return keys;
  })();

  const templateKeys = (() => {
    const keys: string[] = [];
    for (const file of sourceFiles) {
      for (const match of fs.readFileSync(file, 'utf8').matchAll(TEMPLATE_KEY)) {
        keys.push(match[1]);
      }
    }
    return keys;
  })();

  const isGroup = (catalog: Json, key: string) => {
    let cur: Json | string = catalog;
    for (const part of key.split('.')) {
      if (typeof cur === 'string' || !(part in cur)) return false;
      cur = cur[part];
    }
    return typeof cur !== 'string';
  };

  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  it('uses only keys that exist in es.json', () => {
    const missing = [...usedKeys].filter((k) => !esFlat.has(k)).sort();
    expect(missing).toEqual([]);
  });

  it('uses only keys that exist in en.json', () => {
    const missing = [...usedKeys].filter((k) => !enFlat.has(k)).sort();
    expect(missing).toEqual([]);
  });

  it('never calls a key group as if it were a string', () => {
    const groups = [...usedKeys]
      .filter((key) => isGroup(es as Json, key) || isGroup(en as Json, key))
      .sort();
    expect(groups).toEqual([]);
  });

  it('resolves every template-literal key base to an existing group', () => {
    // `t(`methods.${id}.label`)` cannot be resolved statically, so instead of
    // checking the key itself we check the two things a rename would break:
    // the literal base must exist as a group, and the whole shape must still
    // match at least one real key in both catalogs.
    const dynamic = templateKeys.filter((key) => key.includes('${'));
    const problems: string[] = [];
    for (const template of dynamic) {
      const base = template.slice(0, template.indexOf('${')).replace(/\.$/, '');
      if (base && !(isGroup(es as Json, base) && isGroup(en as Json, base))) {
        problems.push(`base "${base}" of \`${template}\` is not a group in both catalogs`);
        continue;
      }
      const segments = template.split(/\$\{[^}]*\}/);
      let pattern = '^' + escapeRegExp(segments[0]);
      for (let i = 1; i < segments.length; i++) pattern += '.+' + escapeRegExp(segments[i]);
      pattern += '$';
      const shape = new RegExp(pattern);
      if (![...esFlat.keys()].some((key) => shape.test(key))) {
        problems.push(`\`${template}\` matches no key in es.json`);
      }
    }
    expect(problems.sort()).toEqual([]);
  });
});
