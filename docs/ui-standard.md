# Forja — UI Standard

> Last updated: 2026-09-13
> Status: v1.1 (Layout foundation + query states)

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

## Checklist for a new screen

- [ ] Root is `<Screen>` (or `<Screen edges={[]}>` under a native header)
- [ ] Header is `<ScreenHeader>`, with `divider` only when the header is fixed
- [ ] No `paddingTop` / `paddingBottom` in `style` fighting the safe area
- [ ] Colours, spacing, fonts and radii come from `tokens.ts`
- [ ] Every string goes through `t()` and exists in both catalogues
- [ ] Query-backed data routes loading / failure / empty through `<QueryState>`
      (failure always offers a retry) — never a bare `!data` fallback
- [ ] `npx tsc --noEmit` is clean and `npx jest` stays green

## Why this file exists

Every rule here comes from something that actually went wrong: titles under the
Dynamic Island, tab labels under the Android navigation bar, five screens with
two different header designs, and a fixed tab bar height that looked wrong on
gesture devices. The standard is the memory of those fixes; the components are
what keeps them from coming back.
