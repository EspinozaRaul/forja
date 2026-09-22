import fs from 'node:fs';
import path from 'node:path';

/**
 * Guards the §1 rule — "never use a raw `View` as a screen root" — on the
 * screens where its harm is real: the ones that HIDE the native header, so
 * nothing else offsets the content. In a loading, error or not-found state
 * those screens used to early-return a bare `QueryState` / `EmptyState` (or a
 * raw `View`) with no `<Screen>` and no `<ScreenHeader>`: the state lost its
 * container and its way back.
 *
 * The verified header-hidden set is written out literally below, on purpose.
 * This guard does not parse `_layout.tsx` to decide which screens hide the
 * header — it pins the arrangement of the screens a human verified. The set
 * comes from the `headerShown: false` entries: the whole `app/progress` group
 * (`app/progress/_layout.tsx`), `routine/[id]`, `routine/folder/[id]` and
 * `session/[id]` in `app/_layout.tsx`.
 *
 * Verified during this unit, and deliberately absent from the list:
 *   - `app/progress/routine-compare.tsx` hides the header but never early-returns
 *     — its `QueryState` already sits inside `<Screen>`.
 *   - `app/auth/*` and `app/reset-password.tsx` hide the header but render a
 *     single return; they have no state branch to wrap.
 *   - `app/(tabs)/*`, `session/history/*`, `session/new`, `exercise/*` and
 *     `routine/create` KEEP the native header. Their bare early returns are a
 *     consistency item, recorded as backlog, not the §1 hole this guard covers.
 *
 * `app/session/history/[id].tsx` keeps the native header, but its `isNaN`
 * branch is a literal §1 violation (a raw `View` screen root) and is in scope
 * for this unit. It is asserted separately so the distinction stays visible.
 *
 * What this pins: the source arrangement — the root element of each named
 * early return. What it cannot prove: the resolved safe-area inset, or how the
 * screen actually lays out on a device. React Native Testing Library does not
 * expose a real inset here, so this is a source-structural guard by declared
 * exception (strict TDD), matching `routine-start-modal.test.ts`,
 * `bottom-sheet-containment.test.ts`, `custom-rest-modal.test.ts` and
 * `session-modal-dismissal.test.ts`.
 */

const ROOT = path.join(__dirname, '..', '..');

type Branch = { screen: string; guard: string };

/**
 * The header-hidden screens, each with the early-return branches that render a
 * screen state. Every one of these branches must render inside `<Screen>`.
 */
const HEADER_HIDDEN_BRANCHES: Branch[] = [
  { screen: 'app/progress/exercise-detail/[id].tsx', guard: 'if (isLoading || hasError || !exercise)' },
  { screen: 'app/progress/exercises.tsx', guard: 'if (exercisesLoading || exercisesError)' },
  { screen: 'app/progress/statistics.tsx', guard: 'if (isLoading || hasError || !stats)' },
  {
    screen: 'app/progress/measurements.tsx',
    guard: 'if (measurementsLoading || photosLoading || measurementsError || photosError)',
  },
  { screen: 'app/routine/[id].tsx', guard: 'if (isNaN(routineId))' },
  {
    screen: 'app/routine/[id].tsx',
    guard:
      'if (routineLoading || exercisesLoading || allExercisesLoading || routineError || exercisesError || allExercisesError || !routine)',
  },
  { screen: 'app/routine/folder/[id].tsx', guard: 'if (isNaN(folderId))' },
  {
    screen: 'app/routine/folder/[id].tsx',
    guard: 'if (loadingFolder || loadingRoutines || folderError || routinesError || !folder)',
  },
  { screen: 'app/session/[id].tsx', guard: 'if (isNaN(sessionId))' },
  {
    screen: 'app/session/[id].tsx',
    guard: 'if (sessionLoading || exercisesLoading || sessionError || exercisesError || !session)',
  },
];

/**
 * The literal §1 violation: a raw `View` as the `isNaN` screen root of a screen
 * that keeps the native header. Explicitly in scope for this unit; its
 * `QueryState` sibling branch is left as a header-kept consistency item.
 */
const RAW_VIEW_ROOT_BRANCH: Branch = {
  screen: 'app/session/history/[id].tsx',
  guard: 'if (isNaN(sessionId))',
};

/** Returns the body of the `if` block whose guard is `guard`, or '' if absent. */
function guardBlock(src: string, guard: string): string {
  const at = src.indexOf(guard);
  if (at === -1) return '';
  const brace = src.indexOf('{', at);
  if (brace === -1) return '';
  let depth = 0;
  for (let i = brace; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(brace + 1, i);
    }
  }
  return '';
}

/** Returns the first `return ( … )` expression in `body`, or '' if absent. */
function returnBlock(body: string): string {
  const ret = body.indexOf('return (');
  if (ret === -1) return '';
  const open = body.indexOf('(', ret);
  let depth = 0;
  for (let i = open; i < body.length; i++) {
    if (body[i] === '(') depth++;
    else if (body[i] === ')') {
      depth--;
      if (depth === 0) return body.slice(open, i + 1);
    }
  }
  return '';
}

/** Returns the name of the JSX element that roots the returned expression. */
function rootElement(jsx: string): string {
  const match = jsx.match(/^\s*\(\s*<([A-Za-z][\w.]*)/);
  return match ? match[1] : '';
}

/** Reads the named branch and returns its returned-JSX block. */
function branchReturn(branch: Branch): string {
  const src = fs.readFileSync(path.join(ROOT, branch.screen), 'utf8');
  return returnBlock(guardBlock(src, branch.guard));
}

describe('header-hidden screens root their state branches in <Screen>', () => {
  for (const branch of HEADER_HIDDEN_BRANCHES) {
    it(`${branch.screen} — ${branch.guard}`, () => {
      const block = branchReturn(branch);
      // Non-vacuous: the guard and its `return (…)` must both be found. A
      // renamed guard would otherwise silently disable this assertion.
      expect(block).not.toBe('');
      expect(rootElement(block)).toBe('Screen');
    });
  }
});

describe('the literal §1 raw-View root', () => {
  it(`${RAW_VIEW_ROOT_BRANCH.screen} — ${RAW_VIEW_ROOT_BRANCH.guard} renders inside <Screen>`, () => {
    const block = branchReturn(RAW_VIEW_ROOT_BRANCH);
    expect(block).not.toBe('');
    expect(rootElement(block)).toBe('Screen');
    // ...and it is no longer a raw View root. This is the literal rule.
    expect(rootElement(block)).not.toBe('View');
  });
});

describe('guard triangulation', () => {
  it('reacts when a real screen branch loses its <Screen> root', () => {
    // Uses the file's real returned block, not the fixture: it proves the
    // assertion is sensitive to the exact property on the actual source.
    const real = branchReturn(HEADER_HIDDEN_BRANCHES[0]);
    expect(rootElement(real)).toBe('Screen');
    expect(rootElement(real.replace('<Screen>', '<View>'))).toBe('View');
  });

  it('gives every header-hidden state branch a way back', () => {
    // The second half of the defect: a bare state loses its way back. Each
    // branch keeps a `<ScreenHeader>` wired to `router.back()`.
    for (const branch of HEADER_HIDDEN_BRANCHES) {
      const block = branchReturn(branch);
      expect(block).toContain('<ScreenHeader');
      expect(block).toMatch(/onBack=\{\(\)\s*=>\s*router\.back\(\)\}/);
    }
  });

  it('does not clear an inset the kept native header already owns', () => {
    // The one native-header screen in scope takes `edges={[]}`, or `Screen`
    // would add a top inset under the header and double-pad it.
    const block = branchReturn(RAW_VIEW_ROOT_BRANCH);
    expect(block).toMatch(/<Screen\s+edges=\{\[\]\}/);
  });

  it('preserves the state copy each branch already had', () => {
    // The unit changes the container, not what the state says.
    const detail = branchReturn(HEADER_HIDDEN_BRANCHES[0]);
    expect(detail).toContain('exerciseDetail.loading');
    expect(detail).toContain('exerciseDetail.notFound');
    expect(branchReturn(RAW_VIEW_ROOT_BRANCH)).toContain('common.invalidId');
  });
});

describe('guard negative control', () => {
  const UNWRAPPED = `
    if (isNaN(sessionId)) {
      return (
        <View style={{ flex: 1, backgroundColor: colors.bg.primary, padding: spacing.md }}>
          <EmptyState title="x" />
        </View>
      );
    }
  `;

  const WRAPPED = `
    if (isNaN(sessionId)) {
      return (
        <Screen>
          <ScreenHeader title="x" onBack={() => router.back()} />
          <EmptyState title="x" />
        </Screen>
      );
    }
  `;

  it('flags an unwrapped early return, so a green run cannot be vacuous', () => {
    const block = returnBlock(guardBlock(UNWRAPPED, 'if (isNaN(sessionId))'));
    expect(block).not.toBe('');
    expect(rootElement(block)).toBe('View');
    expect(rootElement(block)).not.toBe('Screen');
  });

  it('accepts a wrapped early return', () => {
    const block = returnBlock(guardBlock(WRAPPED, 'if (isNaN(sessionId))'));
    expect(rootElement(block)).toBe('Screen');
  });
});
