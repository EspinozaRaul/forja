# Device scripts

Helpers for driving the physical phone, kept in the repo because they were lost once
already: `/tmp` was wiped by a reboot and with it went a screenshot that was the only
evidence of a bug. A verification tool that cannot survive a restart is not evidence.

Android only, adb only, no test framework — these run against a real device.

## Connecting the phone, with no cable

The phone reaches this machine over wireless debugging:

```bash
adb pair <phone-ip>:<pair-port> <code>   # the port and the code are on the phone's screen
adb devices                              # the mDNS transport usually comes up on its own
```

The pairing port and the code are shown in Developer options → Wireless debugging, and both
change every time the dialog is reopened. If `adb devices` stays empty, `adb mdns services`
lists what is discoverable.

## Two obstacles on MIUI/HyperOS, both worth remembering

- **`input tap` is refused** with `SecurityException: Injecting input events requires the
  caller to have the INJECT_EVENTS permission` even with ordinary USB debugging on. The
  separate **Developer options → "USB debugging (Security settings)"** toggle is what lifts
  it. Without that toggle `input` is dead, while `screencap` and `uiautomator dump` keep
  working — so the screen can still be read, just not touched.
- **`uiautomator dump` fails on the session screen** with *"could not get idle state"*,
  because the timer re-renders every second. There is no fix for that; on any screen that
  never goes idle, a screenshot is the only ground truth:

  ```bash
  adb exec-out screencap -p > /tmp/screen.png
  ```

  Screens that do go idle are far easier to measure with `posdump.js`, which gives numbers
  instead of an image to squint at.

## Navigating without tapping

```bash
adb shell am start -a android.intent.action.VIEW -d "forja://routines"
adb shell am start -a android.intent.action.VIEW -d "forja://settings"
```

A deep link is a substitute for navigation, **not** for reading ids: `forja://routine/2`
answered "Rutina no encontrada" because local routine ids are not `1..3` in list order.

## `posdump.js` — where is each label?

```bash
node scripts/device/posdump.js                  # every labelled node, by vertical position
node scripts/device/posdump.js --grep Peso      # only labels containing "Peso"
node scripts/device/posdump.js --json > a.json  # machine-readable, for a before/after diff
```

Prints `top`, `bottom`, the centre `y` and whether the node is clickable. This is the correct
way to answer "did it scroll, and how far": dump, apply the gesture, dump again, compare the
`top` of the same label. A screenshot shows what it looks like; this shows whether it moved.

## `tap-text.js` — tap a label

```bash
node scripts/device/tap-text.js "Finalizar sesión"
node scripts/device/tap-text.js "Eliminar" --index 1
```

Taps the centre of the node whose label matches exactly. When nothing matches, it lists the
labels that merely contain the text, which is usually enough to see the real label. When the
device refuses the injection, it prints the MIUI toggle instead of a stack trace.

## Gestures

```bash
adb shell input swipe 609 1650 609 1000 400   # scroll up by 650 px over 400 ms
```

Coordinates are physical pixels. This device is 1220x2712, so the reported densities in the
task notes are about 3 dp per pixel.
