import fs from 'node:fs';
import path from 'node:path';

/**
 * Guards the session-screen dialogs against accidental dismissal: a tap on
 * non-interactive card content must not bubble to the backdrop `Pressable` and
 * close the dialog.
 *
 * The dialogs are inline JSX in `app/session/[id].tsx`, not extractable
 * components, so the contract is asserted structurally against the source — the
 * same approach as `__tests__/components/routine-start-modal.test.ts`. The
 * reference implementation is the start-session modal in
 * `app/routine/[id].tsx`, whose card carries `accessible={false}` plus
 * `onPress={(e) => e.stopPropagation()}`.
 *
 * What this pins: the source arrangement — that a card rendered inside a
 * tappable backdrop swallows the tap. What it cannot prove: real touch
 * behaviour. No static test observes event propagation at runtime; it can only
 * show that the handler that stops it is present in the source. The card is
 * checked per modal, so removing one handler fails one assertion rather than
 * every assertion in the file.
 */

const ROOT = path.join(__dirname, '..', '..');
const SCREEN = path.join(ROOT, 'app', 'session', '[id].tsx');

/**
 * The three `<Modal>`s in the screen, identified by the state that opens each.
 * The superset-partner picker has no tappable backdrop today, so its check is
 * inert by design; it stays listed so the guard activates if that changes.
 */
const MODALS = [
  { name: 'superset-partner picker', marker: 'visible={supersetPartnerMode !== null}' },
  { name: 'routine-diff', marker: 'visible={showRoutineDiffModal}' },
  { name: 'cancel/end confirm', marker: 'visible={confirmAction !== null}' },
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
 * Returns the opening tag of the modal card — the element whose style carries
 * the card background colour — or null when there is none. The slice stops at
 * `accessible={false}>`, the exact end of the card tag in the reference
 * pattern, so the returned text contains the whole opening tag and nothing
 * after it.
 */
function cardOpenTag(block: string): string | null {
  const start = block.indexOf('<Pressable style={{ backgroundColor: colors.bg.card');
  if (start === -1) return null;
  const end = block.indexOf('accessible={false}>', start);
  if (end === -1) return null;
  return block.slice(start, end + 'accessible={false}>'.length);
}

/**
 * A modal has a tappable backdrop when a `Pressable` renders before the card
 * and carries an `onPress`. That backdrop is the dismissal path a card tap must
 * not reach.
 */
function hasTappableBackdrop(block: string): boolean {
  const cardStart = block.indexOf('<Pressable style={{ backgroundColor: colors.bg.card');
  const scope = cardStart === -1 ? block : block.slice(0, cardStart);
  return scope.includes('<Pressable') && /\bonPress=/.test(scope);
}

describe('session modal dismissal', () => {
  const src = fs.readFileSync(SCREEN, 'utf8');

  for (const modal of MODALS) {
    describe(modal.name, () => {
      const block = modalBlock(src, modal.marker);

      it('is found in the screen source', () => {
        // Stops a renamed marker from silently disabling the guard below.
        expect(block).not.toBe('');
      });

      it('stops card taps from bubbling to the tappable backdrop', () => {
        if (!hasTappableBackdrop(block)) {
          // No tappable backdrop: a card tap cannot dismiss this dialog.
          return;
        }
        const card = cardOpenTag(block);
        expect(card).not.toBeNull();
        expect(card).toContain('onPress={(e) => e.stopPropagation()}');
      });
    });
  }
});
