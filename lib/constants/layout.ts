// Layout constants — shared dimensions for consistent UI
// Used across SetLogger, DropSetLogger, PartialSetLogger, SetLoggerHeader

export const SET_LOGGER = {
  // Column widths
  SERIE_WIDTH: 32,
  PREVIOUS_WIDTH: 65,
  INTENSITY_WIDTH: 24,
  CHECK_SIZE: 28,
  DELETE_WIDTH: 80,
  // Input widths
  WEIGHT_INPUT: 65,
  REPS_INPUT: 45,
  PARTIAL_INPUT: 45,
} as const;

export const MODAL = {
  WIDTH: 320,
  MAX_WIDTH: 340,
  HANDLE_HEIGHT: 4,
  HANDLE_WIDTH: 36,
} as const;

export const ICON = {
  SIZE_SM: 16,
  SIZE_MD: 20,
  SIZE_LG: 24,
  SIZE_XL: 32,
  CHECK_SIZE: 28,
} as const;

export const THUMBNAIL = {
  SIZE_SM: 36,
  SIZE_MD: 44,
  SIZE_LG: 48,
  SIZE_XL: 80,
  PHOTO_WIDTH: 100,
  PHOTO_HEIGHT: 130,
} as const;

export const CHART = {
  HEIGHT_DEFAULT: 180,
  HEIGHT_EMPTY: 120,
  BUBBLE_COLUMN_WIDTH: 48,
  TOOLTIP_WIDTH: 180,
  Y_AXIS_WIDTH: 40,
} as const;

export const TIMER = {
  BUTTON_SIZE: 32,
  DISPLAY_SIZE: 22,
} as const;

export const TAB_BAR = {
  HEIGHT: 88,
} as const;

export const EMBER_DOT = {
  SIZE: 10,
} as const;

export const NAV_BUTTON = {
  SIZE: 40,
} as const;

export const DOT_INDICATOR = {
  SIZE: 4,
} as const;
