import fs from 'node:fs';
import path from 'node:path';

/**
 * Guards the accessibility remediation of the interactive elements.
 *
 * A `TouchableOpacity` or `Pressable` without an accessibility label or role is
 * announced as nothing (an icon-only button) or as raw text (a button that does
 * not say it is a button). React Native gives neither component a default role,
 * so this must be declared explicitly. The only accepted exemption is a wrapper
 * whose `onPress` exists only to stop event propagation — it carries no action
 * of its own and is marked `accessible={false}` on purpose.
 *
 * The scanner walks the JSX opening tag (handling multi-line props, braces and
 * string literals) and requires one of:
 *   - accessibilityLabel
 *   - accessibilityRole
 *   - accessible={false}
 */

const ROOTS = ['app', 'components', 'lib'];
const INTERACTIVE = /<(TouchableOpacity|Pressable)\b/;
const ACCEPTED = ['accessibilityLabel', 'accessibilityRole', 'accessible={false}'];

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') files.push(...collectSourceFiles(full));
    } else if (entry.name.endsWith('.tsx')) {
      files.push(full);
    }
  }
  return files;
}

/** Returns the source of one JSX opening tag starting at `start`. */
function readOpeningTag(src: string, start: number): string {
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

describe('interactive element accessibility', () => {
  const root = path.join(__dirname, '..', '..');
  const files = ROOTS.flatMap((dir) => {
    const abs = path.join(root, dir);
    return fs.existsSync(abs) ? collectSourceFiles(abs) : [];
  });

  it('labels or roles every TouchableOpacity / Pressable', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      for (const match of src.matchAll(new RegExp(INTERACTIVE, 'g'))) {
        const tag = readOpeningTag(src, match.index + 1);
        if (!ACCEPTED.some((needle) => tag.includes(needle))) {
          const line = src.slice(0, match.index).split('\n').length;
          offenders.push(`${path.relative(root, file)}:${line}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
