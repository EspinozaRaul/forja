# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## UI STANDARD

Before creating, restructuring or restyling any screen, read `docs/ui-standard.md`.

New screens are built with `components/ui/Screen.tsx` and `components/ui/ScreenHeader.tsx`,
which apply the device safe areas and the app's single header design. Safe-area spacing
comes from the device inset plus one small step — never from a fixed number.
