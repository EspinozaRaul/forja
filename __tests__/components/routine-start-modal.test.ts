import fs from 'node:fs';
import path from 'node:path';

/**
 * Guards the start-session dialog in `app/routine/[id].tsx` against the modal
 * containment defect: an unbounded card whose variable-length exercise list
 * pushed both actions off-screen with no way to scroll them back, so the user
 * could neither start the session nor close the modal.
 *
 * The dialog is inline JSX in the screen, not an extractable component, so the
 * contract is asserted structurally against the source — the same approach as
 * `__tests__/a11y/interactive-elements.test.ts`. The properties checked are
 * exactly the ones the broken code lacked:
 *   1. the card is height-bounded by the shared `MODAL.MAX_HEIGHT`,
 *   2. the variable-length list lives inside a `ScrollView` that is itself
 *      bounded by `MODAL.MAX_BODY_HEIGHT` and carries `flexShrink: 1`,
 *   3. both actions render after the scroll region, so scrolling can never
 *      push them away.
 */

const ROOT = path.join(__dirname, '..', '..');
const SCREEN = path.join(ROOT, 'app', 'routine', '[id].tsx');
const LAYOUT = path.join(ROOT, 'lib', 'constants', 'layout.ts');

/** Returns the JSX of the start-session `<Modal>`, or '' when not found. */
function startSessionModalBlock(src: string): string {
  const marker = src.indexOf('visible={showStartModal}');
  if (marker === -1) return '';
  const open = src.lastIndexOf('<Modal', marker);
  if (open === -1) return '';
  const close = src.indexOf('</Modal>', marker);
  if (close === -1) return '';
  return src.slice(open, close);
}

/** Returns the opening tag of the modal's first `<ScrollView>`. */
function scrollViewOpenTag(block: string): string {
  const start = block.indexOf('<ScrollView');
  expect(start).toBeGreaterThan(-1);
  return block.slice(start, block.indexOf('>', start) + 1);
}

describe('start-session modal containment', () => {
  const src = fs.readFileSync(SCREEN, 'utf8');
  const block = startSessionModalBlock(src);

  it('bounds the dialog card with the shared MODAL.MAX_HEIGHT', () => {
    expect(block).toMatch(/maxHeight:\s*MODAL\.MAX_HEIGHT/);
  });

  it('scrolls the variable-length exercise list', () => {
    expect(block).toContain('<ScrollView');
    expect(block).toContain('</ScrollView>');
  });

  it('bounds the scroll region itself, not just its parent card', () => {
    // The body cap is a secondary limit, so a dialog does not grow to fill a
    // tall screen. Removing it, or swapping it for an unbounded value, fails here.
    expect(scrollViewOpenTag(block)).toMatch(/maxHeight:\s*MODAL\.MAX_BODY_HEIGHT/);
  });

  it('lets the scroll region shrink so the actions stay on screen', () => {
    // The card's bound plus this shrink are what contain the body on a short
    // viewport. It is load-bearing on its own, so it gets its own assertion:
    // removing it must fail here, not pass silently.
    expect(scrollViewOpenTag(block)).toMatch(/flexShrink:\s*1\b/);
  });

  it('keeps both actions after the scroll region', () => {
    const scrollEnd = block.indexOf('</ScrollView>');
    expect(scrollEnd).toBeGreaterThan(-1);
    expect(block.indexOf('routine.detail.startFresh')).toBeGreaterThan(scrollEnd);
    expect(block.indexOf('routine.detail.continueLast')).toBeGreaterThan(scrollEnd);
  });

  it('keeps the title and message outside the scroll region', () => {
    const scrollStart = block.indexOf('<ScrollView');
    expect(scrollStart).toBeGreaterThan(-1);
    expect(block.indexOf('routine.detail.startSession')).toBeLessThan(scrollStart);
    expect(block.indexOf('routine.detail.previousSessionMessage')).toBeLessThan(scrollStart);
  });
});

describe('MODAL layout constant', () => {
  it('exposes one shared percentage height bound', () => {
    const layout = fs.readFileSync(LAYOUT, 'utf8');
    const start = layout.indexOf('export const MODAL');
    const end = layout.indexOf('as const', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(layout.slice(start, end)).toMatch(/MAX_HEIGHT:\s*['"]\d+(\.\d+)?%['"]/);
  });

  it('exposes one shared numeric bound for the scrollable body', () => {
    const layout = fs.readFileSync(LAYOUT, 'utf8');
    const start = layout.indexOf('export const MODAL');
    const end = layout.indexOf('as const', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(layout.slice(start, end)).toMatch(/MAX_BODY_HEIGHT:\s*\d+/);
  });
});
