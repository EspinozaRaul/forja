# Forja — UI Standard

> Last updated: 2026-09-21
> Status: v1.3 (Layout foundation + query states + modal containment)

How screens are built in this app. Follow it for every new screen. The shared
components exist so that the correct screen is also the shortest one to write.

## 1. Every screen starts with `<Screen>`

`components/ui/Screen.tsx` applies the device safe areas. Never use a raw `View`
as a screen root: when the native header is hidden, nothing else offsets the
content, and the title ends up underneath the status bar / Dynamic Island.

```tsx
import { Screen } from '../../components/ui/Screen';
import { ScreenHeader } from '../../components/ui/ScreenHeader';

export default function MyNewScreen() {
  const { t } = useTranslation();

  return (
    <Screen>
      <ScreenHeader
        title={t('myScreen.title')}
        icon="barbell"
        onBack={() => router.back()}
        divider
      />
      {/* content */}
    </Screen>
  );
}
```

| Screen type | Root |
| --- | --- |
| Custom header rendered in the content (native header hidden) | `<Screen>` — the default clears the top and the bottom |
| NATIVE header kept (the three tab screens) | `<Screen edges={[]}>` — the header bar and the tab bar already clear the insets |
| Modal / bottom sheet | clears its own bottom inset; see `components/progress/RoutinePickerModal.tsx` |

## 2. Every header is `<ScreenHeader>`

One header design for the whole app: title at `fontSizes.xl`, icons at `size={24}`,
`paddingHorizontal: spacing.lg`. Do not hand-roll a header row.

- `divider` — only on screens whose header stays **fixed** while the content scrolls. If the header lives inside the `ScrollView`, omit it.
- `right` — slot for a right-side action (see `measurements.tsx`).
- Titles render on one line (`numberOfLines={1}`). Long titles truncate on purpose: that keeps a right-side action from being pushed off-screen.

## 3. Space comes from the device, not from a number

The device reports how much room its own chrome needs — the *inset*: ~34pt on a
gesture iPhone, ~48pt with Android 3-button navigation, ~24pt with Android
gestures. `Screen` reads it and adds one small step of breathing room
(`spacing.sm`) on top.

Consequences:

- **Never add a large design padding on top of an inset.** The two add up, and the device with the largest inset looks empty and wrong.
- **Never set the tab bar's `height`** (`app/(tabs)/_layout.tsx`). A fixed height makes react-navigation skip its own inset math and forces the same numbers onto every phone.
- **There is no device-detection code, and there should never be one.** The inset *is* the detection.

## 4. Style values come from tokens

`lib/theme/tokens.ts` is the only source for colours, spacing, font sizes, fonts
and radii. Literal numbers for those are not allowed.

**Colours are chosen by ROLE, not just by hue.** One colour cannot serve as both the fill
under a light label and as text on a dark background, because those two need opposite
luminance — that is how three button variants and the app's most-used text colour ended up
below the 4.5:1 minimum. The tokens now carry the roles:

- `text.muted` is the dimmest text that still clears 4.5:1 on **every** background it is used on. If you need text dimmer than this, it is decoration, not information.
- `text.onAccent` is the foreground for anything sitting on a **coloured surface** (a filled or tinted button, a status chip). Never place `accent.primary` text on `accent.muted`; that pair measures 2.8:1.
- `error` is the light cold red for text, borders and icons on dark; `errorStrong` is the same hue deep enough for a filled destructive button. Use the one that matches the role.

Contrast is checkable without a device: compute the ratio from the two token values
(relative luminance, then `(L1+0.05)/(L2+0.05)`). Text needs 4.5:1, or 3:1 when it is
large (≥18pt, or ≥14pt bold). Anything that is not text — an icon, a border, a chart line —
needs 3:1.

## 5. Every user-facing string goes through i18n

`t('group.key')`, with the key present in **both** `lib/i18n/es.json` and
`lib/i18n/en.json`. `__tests__/lib/i18n/catalog-parity.test.ts` enforces that parity.

## 6. Accessibility labels are translated too

`accessibilityLabel={t('accessibility.something')}` — never a hardcoded Spanish
string. The label must exist in both catalogues like any other string.

## 7. A query-backed screen shows loading, failure and empty — never one for another

A screen whose data comes from react-query must tell those three states apart.
The old pattern — `if (!data) return <EmptyState title="not found" />` — cannot: a
dropped connection, an empty table and a wrong id all render the same "no
encontrado", so the user concludes their data is gone. That is a lie, and it is
the failure this rule exists to prevent.

Route the states through `components/ui/QueryState.tsx`. It takes the query
objects themselves so a screen cannot forget the failure case, and its failure
branch always renders a retry action:

```tsx
import { QueryState } from '../../components/ui/QueryState';

const sessionQuery = useSession(sessionId);
const exercisesQuery = useSessionExercises(sessionId);
const session = sessionQuery.data?.[0];

return (
  <QueryState
    queries={[sessionQuery, exercisesQuery]}
    loadingMessage={t('session.loadingMessage')}
    empty={!session}
    emptyTitle={t('session.notFound')}
  >
    {/* real content — only rendered once every query has data */}
  </QueryState>
);
```

- Pass **every** query the content depends on, not just the first. Six reads
  behind one spinner are six chances to half-load a screen; `QueryState` fails the
  whole view (with a retry) when any one of them errors.
- The empty state keeps the copy it already had. `QueryState` decides *whether* to
  show it, never what it says: `emptyTitle` / `emptyMessage` / `emptyIcon` build the
  same `EmptyState` the screen used before.
- The failure copy and the Retry button come from `common.queryError.title`,
  `common.queryError.message` and `common.retry` in both catalogues. Do not invent
  a second empty or error look.
- When "empty" is a section inside otherwise-valid content (an empty list under a
  working header), keep that inline empty — but still wrap the screen so the
  failure state stays reachable.

## 8. A modal card is height-bounded, and its actions are outside the scroll

**This is the target the repo is being brought to, not the state of every modal.**
Two modals bound their card and their scroll body today: the start-session dialog in
`app/routine/[id].tsx` and the reference `components/progress/RoutinePickerModal.tsx`.
The other modal-bearing files still have no bound at all and are tracked as their own
work unit.

The rule: a modal card takes its height bound from `MODAL.MAX_HEIGHT`, and its
scrollable body takes its own bound from `MODAL.MAX_BODY_HEIGHT`
(`lib/constants/layout.ts`). Without a bound, variable-length content grows past the
viewport; on a centred card the action row is the last child of the column, so it
is pushed off-screen and there is nothing left to scroll. The user is then trapped:
they cannot confirm and they cannot dismiss.

- **Only the action row is outside the scroll region.** The title, the message and
  every other piece of variable-length body content (a list, a set summary) go
  inside the `ScrollView`, which carries `flexShrink: 1` and, as a secondary limit,
  a `maxHeight` of `MODAL.MAX_BODY_HEIGHT`. Containment comes from the card's own
  `maxHeight` plus that `flexShrink`: when the content does not fit, the body is the
  node that gives up height, so the actions keep theirs. The body cap only limits how
  tall the body grows on a tall screen; it is not a containment proof.
- **Why the title and the message must be inside the scroll region.** Text grows with
  the OS accessibility size, and so does every piece of chrome left outside the
  `ScrollView`. Measured on a 667pt viewport: the card's content box is ~383pt, and
  the action row alone is 70pt at the default text size and 185pt at
  `accessibility-extra-extra-extra-large`. With the body's 16pt bottom margin that
  leaves the body about 180pt at the largest size. Any text left outside the scroll region is subtracted
  from the actions' budget, and at that size the title and the message need far more
  than the box has. This is arithmetic, not a rendering detail: fix outside the scroll
  only what must stay visible, and let the body absorb the rest.
- The **actions stay as siblings after** the scroll region, so scrolling the list can
  never carry them away. That placement on its own is not containment: in the
  original defect the actions were already outside any scroll region and were pushed
  off-screen anyway. What keeps them reachable is the card's `maxHeight` plus the
  body's `flexShrink` `1`, described above.
- The bound resolves **against the parent's content box, not the screen.**
  `MODAL.MAX_HEIGHT: '70%'` is a Yoga percentage resolved against the backdrop
  `Pressable`'s content box, not the viewport: on a 667pt device with 24pt of
  backdrop padding the card is capped at `(667 - 2 * 24) * 0.70 ≈ 433pt`, not 467pt.
  The card's real budget is smaller than a naive read of the percentage suggests.
- The bound is also the escape hatch. A centred card capped at 70% leaves a strip of
  backdrop above and below, so tapping outside still dismisses the dialog. Keep
  `onRequestClose` wired for the Android hardware back button.

`components/progress/RoutinePickerModal.tsx` already demonstrates the **principle** —
a bounded body with its actions outside it — and is the shape to follow. It does not
demonstrate the tokens: it uses the literals `'70%'` and `360`, and no `flexShrink`.
Replacing those literals with the shared `MODAL` values belongs to the work unit that
brings the remaining modals onto this rule; following the reference means following
the principle, not copying its structure literally.

## Checklist for a new screen

- [ ] Root is `<Screen>` (or `<Screen edges={[]}>` under a native header)
- [ ] Header is `<ScreenHeader>`, with `divider` only when the header is fixed
- [ ] No `paddingTop` / `paddingBottom` in `style` fighting the safe area
- [ ] Colours, spacing, fonts and radii come from `tokens.ts`
- [ ] Every string goes through `t()` and exists in both catalogues
- [ ] Query-backed data routes loading / failure / empty through `<QueryState>`
      (failure always offers a retry) — never a bare `!data` fallback
- [ ] A modal card is height-bounded (`MODAL.MAX_HEIGHT`), **only its actions** sit
      outside the scroll region, and the title, the message and all variable-length
      content scroll inside `MODAL.MAX_BODY_HEIGHT`
- [ ] `npx tsc --noEmit` is clean and `npx jest` stays green

## Why this file exists

Every rule here comes from something that actually went wrong: titles under the
Dynamic Island, tab labels under the Android navigation bar, five screens with
two different header designs, a fixed tab bar height that looked wrong on
gesture devices, and a start-session dialog whose unbounded exercise list pushed
its buttons off-screen and trapped the user with no way to close it. The standard
is the memory of those fixes; the components are what keeps them from coming back.
