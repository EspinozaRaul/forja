// Layout constants — shared dimensions for consistent UI
// Used across SetLogger, DropSetLogger, PartialSetLogger, SetLoggerHeader

export const SET_LOGGER = {
  // Column widths
  SERIE_WIDTH: 32,
  PREVIOUS_WIDTH: 65,
  INTENSITY_WIDTH: 24,
  CHECK_SIZE: 28,
  DELETE_WIDTH: 80,
} as const;

export const MODAL = {
  WIDTH: 320,
  MAX_WIDTH: 340,
  // Shared ceiling for a modal card. The card is centred, so the remaining 30%
  // is split top and bottom: enough for the status bar / Dynamic Island, the
  // Android navigation bar, and a tappable strip of backdrop to dismiss.
  MAX_HEIGHT: '70%',
  // Secondary limit on a modal's scrollable body, so a dialog with a long list
  // does not grow to fill a tall screen. It is not the containment mechanism: on
  // a viewport too short for the card's fixed chrome plus this cap, the body
  // still has to shrink, and the card's own `MAX_HEIGHT` bound together with the
  // body's `flexShrink: 1` is what keeps the actions on screen. A point value,
  // not a percentage, on purpose: a percentage maxHeight does not resolve
  // reliably against a parent whose own height is content-driven.
  MAX_BODY_HEIGHT: 360,
  HANDLE_HEIGHT: 4,
  HANDLE_WIDTH: 36,
} as const;

export const ICON = {
  SIZE_SM: 16,
  SIZE_XL: 32,
} as const;

export const THUMBNAIL = {
  SIZE_MD: 44,
  SIZE_LG: 48,
  PHOTO_WIDTH: 100,
  PHOTO_HEIGHT: 130,
} as const;

export const CHART = {
  HEIGHT_EMPTY: 120,
  Y_AXIS_WIDTH: 40,
} as const;

export const TIMER = {
  BUTTON_SIZE: 32,
} as const;

export const EMBER_DOT = {
  SIZE: 10,
} as const;

export const NAV_BUTTON = {
  SIZE: 40,
} as const;
