import fs from 'node:fs';
import path from 'node:path';

/**
 * Guards the custom-rest dialog in `components/session/SessionExerciseItem.tsx`
 * against the three defects that made it unusable at large accessibility text
 * sizes:
 *   1. no scrollable body, so the title, the input row and the actions were all
 *      direct children of the card and the last child (Cancel/Save) was the
 *      overflow with nothing to absorb it;
 *   2. a hard `width: 280` on the card whose `flexDirection: 'row'` child held
 *      two `width: 80` inputs plus three scaled texts with no wrap and no
 *      shrink, so it clipped horizontally before height was ever the issue;
 *   3. no `onRequestClose`, so the Android hardware back button did nothing
 *      while the dialog was open.
 *
 * The dialog is inline JSX in the component, not an extractable component, so
 * the contract is asserted structurally against the source — the same approach
 * as `__tests__/components/routine-start-modal.test.ts`,
 * `__tests__/components/bottom-sheet-containment.test.ts` and
 * `__tests__/components/session-modal-dismissal.test.ts`. A resolved safe-area
 * inset and a real text-scale layout are not observable through React Native
 * Testing Library in this repository, so this guard is source-structural by
 * declared exception, not by preference.
 *
 * The rest-picker block that shares this file (`showRestPicker`) is a second
 * dialog and is deliberately left alone by this unit; these assertions never
 * read it.
 */

const ROOT = path.join(__dirname, '..', '..');
const COMPONENT = path.join(ROOT, 'components', 'session', 'SessionExerciseItem.tsx');
const LAYOUT = path.join(ROOT, 'lib', 'constants', 'layout.ts');

/** Returns the JSX of the custom-rest `<Modal>`, or '' when not found. */
function customRestModalBlock(src: string): string {
  const marker = src.indexOf('visible={showCustomRest}');
  if (marker === -1) return '';
  const open = src.lastIndexOf('<Modal', marker);
  if (open === -1) return '';
  const close = src.indexOf('</Modal>', marker);
  if (close === -1) return '';
  return src.slice(open, close + '</Modal>'.length);
}

/** Returns the opening tag of the nearest enclosing `View` before `marker`. */
function viewOpenTag(block: string, marker: string): string {
  const anchor = block.indexOf(marker);
  expect(anchor).toBeGreaterThan(-1);
  const start = block.lastIndexOf('<View', anchor);
  expect(start).toBeGreaterThan(-1);
  return block.slice(start, block.indexOf('>', start) + 1);
}

describe('custom-rest modal containment', () => {
  const src = fs.readFileSync(COMPONENT, 'utf8');
  const block = customRestModalBlock(src);

  it('finds the custom-rest modal', () => {
    expect(block).not.toBe('');
  });

  it('bounds the dialog card with the shared MODAL.MAX_HEIGHT', () => {
    expect(block).toMatch(/maxHeight:\s*MODAL\.MAX_HEIGHT/);
  });

  it('scrolls the body of the dialog', () => {
    expect(block).toContain('<ScrollView');
    expect(block).toContain('</ScrollView>');
  });

  it('renders the scroll region unconditionally', () => {
    // A guarded region (`{showCustomRest && ( … )}` or similar) would still
    // satisfy the index-based assertions, which is why this property needs
    // its own check: the title and the inputs must always be inside it.
    expect(block).not.toMatch(/\{\s*[\w.]+\s*&&\s*\(\s*<ScrollView/);
  });

  it('bounds the scroll region itself, not just its parent card', () => {
    const scrollStart = block.indexOf('<ScrollView');
    const openTag = block.slice(scrollStart, block.indexOf('>', scrollStart) + 1);
    expect(openTag).toMatch(/maxHeight:\s*MODAL\.MAX_BODY_HEIGHT/);
    // ...and the cap is the shared token, not a literal of its own. A hard
    // `360` would pass the assertion above on a tree that never imports the
    // tokens, which is exactly the divergence this rule exists to end.
    expect(openTag).not.toMatch(/maxHeight:\s*\d/);
  });

  it('lets the scroll region shrink so the actions stay on screen', () => {
    const scrollStart = block.indexOf('<ScrollView');
    const openTag = block.slice(scrollStart, block.indexOf('>', scrollStart) + 1);
    expect(openTag).toMatch(/flexShrink:\s*1\b/);
  });

  it('keeps the title and the input row inside the scroll region', () => {
    const scrollStart = block.indexOf('<ScrollView');
    const scrollEnd = block.indexOf('</ScrollView>');
    expect(scrollStart).toBeGreaterThan(-1);
    expect(scrollEnd).toBeGreaterThan(scrollStart);
    const title = block.indexOf('session.dropSet.title');
    const minutes = block.indexOf('accessibility.customRest.minutes');
    const seconds = block.indexOf('accessibility.customRest.seconds');
    for (const anchor of [title, minutes, seconds]) {
      expect(anchor).toBeGreaterThan(scrollStart);
      expect(anchor).toBeLessThan(scrollEnd);
    }
  });

  it('keeps both actions after the scroll region', () => {
    const scrollEnd = block.indexOf('</ScrollView>');
    expect(scrollEnd).toBeGreaterThan(-1);
    expect(block.indexOf('session.dropSet.cancel')).toBeGreaterThan(scrollEnd);
    expect(block.indexOf('session.dropSet.save')).toBeGreaterThan(scrollEnd);
  });

  it('dismisses on the Android hardware back button', () => {
    const modalStart = block.indexOf('<Modal');
    // The opening tag is one line; slicing to `>` would stop at the arrow in
    // any inline handler, so slice to the line break instead.
    const openTag = block.slice(modalStart, block.indexOf('\n', modalStart));
    expect(openTag).toMatch(/onRequestClose=/);
    // ...and the handler actually closes the dialog. A no-op
    // `onRequestClose={() => {}}` would satisfy the presence check while
    // leaving the back button dead.
    expect(openTag).toMatch(/onRequestClose=\{\(\)\s*=>\s*setShowCustomRest\(false\)\s*\}/);
  });

  it('does not cap the card with a fixed pixel width', () => {
    const card = viewOpenTag(block, 'colors.bg.card');
    // The original defect: `width: 280` clipped the horizontal row before
    // height was ever the issue. A fixed number here must fail.
    expect(card).not.toMatch(/width:\s*\d/);
    expect(card).toMatch(/width:\s*'100%'/);
    expect(card).toMatch(/maxWidth:\s*MODAL\.MAX_WIDTH/);
  });

  it('lets the horizontal input row wrap or shrink instead of clipping', () => {
    const row = viewOpenTag(block, 'customMinutes');
    expect(row).toMatch(/flexWrap:\s*'wrap'|flexShrink:\s*1\b/);
    expect(row).not.toMatch(/width:\s*\d/);
  });

  it('leaves the separate rest-picker block alone', () => {
    // The rest-picker dialog that shares this file (`showRestPicker`) is a
    // second dialog and is out of scope for this unit. The guard must read
    // the custom-rest modal only; this pins that boundary.
    expect(src.indexOf('showRestPicker &&')).toBeGreaterThan(-1);
    expect(block).not.toContain('REST_PRESETS');
  });
});

describe('MODAL layout constant', () => {
  function modalTokens(): string {
    const layout = fs.readFileSync(LAYOUT, 'utf8');
    const start = layout.indexOf('export const MODAL');
    const end = layout.indexOf('as const', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    return layout.slice(start, end);
  }

  it('exposes one shared percentage height bound', () => {
    expect(modalTokens()).toMatch(/MAX_HEIGHT:\s*['"]\d+(\.\d+)?%['"]/);
  });

  it('exposes one shared numeric bound for the scrollable body', () => {
    expect(modalTokens()).toMatch(/MAX_BODY_HEIGHT:\s*\d+/);
  });

  it('exposes a shared maximum card width', () => {
    expect(modalTokens()).toMatch(/MAX_WIDTH:\s*\d+/);
  });
});
