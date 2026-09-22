import fs from 'node:fs';
import path from 'node:path';

/**
 * Guards the three bottom sheets against the residual dismissal / inset gaps:
 * an Android hardware back button that does nothing (`Modal` with no
 * `onRequestClose`), a backdrop that is a plain `View` so a tap outside cannot
 * dismiss the sheet, and a card whose uniform `padding: spacing.lg` leaves the
 * action row under the navigation bar / home indicator on a device with a large
 * bottom inset.
 *
 * The sheets are inline JSX in their screens, not extractable components, so the
 * contract is asserted structurally against the source — the same approach as
 * `__tests__/components/routine-start-modal.test.ts` and
 * `__tests__/components/session-modal-dismissal.test.ts`. The reference shape is
 * `components/progress/RoutinePickerModal.tsx`.
 *
 * Each gap gets its own test per sheet, so one missing handler fails one
 * assertion instead of the whole file. What this pins: the source arrangement.
 * What it cannot prove: real touch behaviour or the resolved inset value — no
 * static test observes a hit test or a device inset. That is why the return for
 * this change declares a strict-TDD exception.
 */

const ROOT = path.join(__dirname, '..', '..');
const ROUTINES = path.join(ROOT, 'app', '(tabs)', 'routines.tsx');
const FOLDER = path.join(ROOT, 'app', 'routine', 'folder', '[id].tsx');

/**
 * The three bottom sheets, identified by the state that opens each. The move
 * sheet bounds its own state (`showMoveModal` plus `movingRoutineId`); that is
 * the state its backdrop tap and hardware back must close.
 */
const SHEETS = [
  { name: 'Create Folder', file: ROUTINES, marker: 'visible={showCreateModal}' },
  { name: 'Move to Folder', file: ROUTINES, marker: 'visible={showMoveModal}' },
  { name: 'Edit Folder', file: FOLDER, marker: 'visible={showEditModal}' },
] as const;

/** Returns the JSX of the `<Modal>` opened by `marker`, or '' when not found. */
function modalBlock(src: string, marker: string): string {
  const at = src.indexOf(marker);
  if (at === -1) return '';
  const open = src.lastIndexOf('<Modal', at);
  if (open === -1) return '';
  const close = src.indexOf('</Modal>', at);
  if (close === -1) return '';
  return src.slice(open, close);
}

/**
 * Index of the `>` that closes the JSX open tag starting at `start`, skipping
 * `>` characters nested inside attribute braces (`onPress={(e) => …}`).
 */
function tagEnd(src: string, start: number): number {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === '>' && depth === 0) return i;
  }
  return -1;
}

/** Returns the modal's own opening tag (the block starts at `<Modal`). */
function modalOpenTag(block: string): string | null {
  const end = tagEnd(block, 0);
  if (end === -1) return null;
  return block.slice(0, end + 1);
}

/** Returns the full opening tag of the first `<Pressable>` at or after `from`. */
function openTag(src: string, from: number): string | null {
  const at = src.indexOf('<Pressable', from);
  if (at === -1) return null;
  const end = tagEnd(src, at);
  if (end === -1) return null;
  return src.slice(at, end + 1);
}

/** Returns the modal card's opening tag (the element carrying the card fill). */
function cardOpenTag(block: string): string | null {
  const styleAt = block.indexOf('backgroundColor: colors.bg.card');
  if (styleAt === -1) return null;
  const openAt = block.lastIndexOf('<Pressable', styleAt);
  if (openAt === -1) return null;
  const end = tagEnd(block, openAt);
  if (end === -1) return null;
  return block.slice(openAt, end + 1);
}

/**
 * Returns the backdrop's opening tag — the first `Pressable` that renders
 * before the card — or null when the backdrop is not a `Pressable`.
 */
function backdropOpenTag(block: string): string | null {
  const first = openTag(block, 0);
  if (first === null) return null;
  const cardStyleAt = block.indexOf('backgroundColor: colors.bg.card');
  const firstAt = block.indexOf('<Pressable');
  if (cardStyleAt !== -1 && firstAt === block.lastIndexOf('<Pressable', cardStyleAt)) {
    return null;
  }
  return first;
}

describe('bottom sheet containment and dismissal', () => {
  for (const sheet of SHEETS) {
    describe(sheet.name, () => {
      const src = fs.readFileSync(sheet.file, 'utf8');
      const block = modalBlock(src, sheet.marker);

      it('is found in the screen source', () => {
        // Stops a renamed marker from silently disabling the guards below.
        expect(block).not.toBe('');
      });

      it('wires onRequestClose so Android hardware back can dismiss it', () => {
        const tag = modalOpenTag(block);
        expect(tag).not.toBeNull();
        expect(tag).toContain('onRequestClose=');
      });

      it('makes the backdrop a tappable Pressable that dismisses the sheet', () => {
        const backdrop = backdropOpenTag(block);
        expect(backdrop).not.toBeNull();
        expect(backdrop).toContain('onPress=');
        expect(backdrop).toContain('accessibilityLabel=');
        expect(backdrop).toContain('accessibilityRole=');
      });

      it('stops card taps from bubbling to the tappable backdrop', () => {
        const card = cardOpenTag(block);
        expect(card).not.toBeNull();
        expect(card).toContain('onPress={(e) => e.stopPropagation()}');
        expect(card).toContain('accessible={false}');
      });

      it('clears the card bottom inset so the action row stays visible', () => {
        const card = cardOpenTag(block);
        expect(card).not.toBeNull();
        expect(card).toMatch(/paddingBottom:\s*spacing\.xl\s*\+\s*insets\.bottom/);
        // The uniform padding is what put the action row under the bars.
        expect(card).not.toMatch(/\bpadding:\s*spacing\.lg\b/);
      });
    });
  }
});

describe('per-sheet triangulation', () => {
  for (const sheet of SHEETS) {
    describe(sheet.name, () => {
      const src = fs.readFileSync(sheet.file, 'utf8');
      const block = modalBlock(src, sheet.marker);

      it('dismisses the backdrop through the sheet\'s own close handler', () => {
        // Alternate wiring the generic check cannot see: a backdrop pointed at
        // another sheet's handler would close the wrong state. A handler that
        // only exists inline in the backdrop (and is not used by onRequestClose)
        // is rejected for the same reason.
        const requestClose = modalOpenTag(block)?.match(/onRequestClose=\{(\w+)\}/);
        expect(requestClose).not.toBeNull();
        const handlerName = requestClose![1];
        const backdrop = backdropOpenTag(block);
        expect(backdrop).not.toBeNull();
        expect(backdrop).toContain(`onPress={${handlerName}}`);
        expect(src).toContain(`const ${handlerName} =`);
      });
    });
  }

  it('resets the move sheet\'s state pair, not only its visibility', () => {
    // The move sheet owns two pieces of state; closing on the visibility alone
    // would leave a stale `movingRoutineId` that a later open could reuse.
    const src = fs.readFileSync(ROUTINES, 'utf8');
    const block = modalBlock(src, 'visible={showMoveModal}');
    const handlerName = modalOpenTag(block)?.match(/onRequestClose=\{(\w+)\}/)?.[1];
    expect(handlerName).toBeTruthy();
    const declAt = src.indexOf(`const ${handlerName} =`);
    expect(declAt).toBeGreaterThan(-1);
    const body = src.slice(declAt, declAt + 200);
    expect(body).toContain('setShowMoveModal(false)');
    expect(body).toContain('setMovingRoutineId(null)');
  });
});
