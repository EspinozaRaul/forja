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
 * `__tests__/a11y/interactive-elements.test.ts`.
 *
 * What contains that defect is the card's bound plus a single shrinkable node,
 * NOT which node happens to scroll. So the properties pinned here are:
 *   1. the card is height-bounded by the shared `MODAL.MAX_HEIGHT`,
 *   2. there is exactly ONE scroll region, and it is the exercise box — the only
 *      content that grows — with `MODAL.MAX_BODY_HEIGHT` on its container and
 *      `flexShrink: 1` on the box itself,
 *   3. the title and the message are fixed chrome above it,
 *   4. both actions render after it, stacked rather than sharing a row.
 *
 * The previous revision of this file pinned the same incident through a different
 * arrangement: one scroll region holding the title, the message and the list. It
 * was re-pinned deliberately when the scroll moved into the box. One property was
 * dropped with it — "the scroll region renders unconditionally" — because it only
 * existed to keep the title and the message from being stranded outside a guarded
 * region; they are outside it by design now, so the guard cannot strand them.
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

/** Returns the exercise box: the container that holds the scroll region. */
function exerciseBox(block: string): string {
  const start = block.indexOf('{lastSession && (');
  const scrollStart = block.indexOf('<ScrollView', start);
  expect(start).toBeGreaterThan(-1);
  expect(scrollStart).toBeGreaterThan(start);
  return block.slice(start, scrollStart);
}

describe('start-session modal containment', () => {
  const src = fs.readFileSync(SCREEN, 'utf8');
  const block = startSessionModalBlock(src);

  it('bounds the dialog card with the shared MODAL.MAX_HEIGHT', () => {
    expect(block).toMatch(/maxHeight:\s*MODAL\.MAX_HEIGHT/);
  });

  it('has exactly one scroll region', () => {
    // The list scrolls inside its box; the card does not scroll. A second region
    // would nest two same-orientation scroll views, which is the interaction the
    // moved scroll was meant to avoid.
    expect(block.match(/<ScrollView/g)?.length).toBe(1);
    expect(block.match(/<\/ScrollView>/g)?.length).toBe(1);
  });

  it('scrolls the exercise list inside its own bounded box', () => {
    expect(exerciseBox(block)).toMatch(/maxHeight:\s*MODAL\.MAX_BODY_HEIGHT/);
    expect(scrollViewOpenTag(block)).toMatch(/flexShrink:\s*1\b/);
  });

  it('lets the box shrink so the actions stay on screen on a short viewport', () => {
    // The card's bound plus this shrink are what keep the actions reachable at the
    // largest accessibility text size. It is load-bearing on its own, so it gets
    // its own assertion: removing it must fail here, not pass silently.
    expect(exerciseBox(block)).toMatch(/flexShrink:\s*1\b/);
  });

  it('keeps both actions after the scroll region', () => {
    const scrollEnd = block.indexOf('</ScrollView>');
    expect(scrollEnd).toBeGreaterThan(-1);
    expect(block.indexOf('routine.detail.startFresh')).toBeGreaterThan(scrollEnd);
    expect(block.indexOf('routine.detail.continueLast')).toBeGreaterThan(scrollEnd);
  });

  it('keeps the title and the message outside the scroll region', () => {
    const scrollStart = block.indexOf('<ScrollView');
    const scrollEnd = block.indexOf('</ScrollView>');
    expect(scrollEnd).toBeGreaterThan(scrollStart);

    const title = block.indexOf('routine.detail.startSession');
    const message = block.indexOf('routine.detail.previousSessionMessage');
    expect(title).toBeGreaterThan(-1);
    expect(title).toBeLessThan(scrollStart);
    expect(message).toBeGreaterThan(-1);
    expect(message).toBeLessThan(scrollStart);
  });

  it('stacks the two actions instead of sharing a row', () => {
    // Arithmetic, not taste: at half the card's inner width each label gets about
    // 104pt, so both wrap onto two lines and the two-line text does not line up
    // between them. Stacked, each label fits on one line and the tap target grows.
    const actionsStart = block.lastIndexOf('<View', block.indexOf('routine.detail.startFresh'));
    expect(actionsStart).toBeGreaterThan(-1);
    const actionsTag = block.slice(actionsStart, block.indexOf('>', actionsStart) + 1);
    expect(actionsTag).not.toMatch(/flexDirection:\s*'row'/);
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
