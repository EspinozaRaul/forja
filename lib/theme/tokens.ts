// Design system "Forja" (forge) — cold steel monochrome: near-black blues,
// white/grays, one steel-blue accent + one ember accent used with restraint.
// Forja identity: quiet technical steel with a living ember inside — the ember
// only glows where the user's work is honored (PRs, streaks, milestones).

export const colors = {
  // Backgrounds — cold near-black with a blue undertone
  bg: {
    primary: '#101316',
    secondary: '#15181C',
    card: '#1A1E23',
    elevated: '#22272D',
    active: '#1C2530',    // drag/reorder active state (steel tint)
    selected: '#17212C',  // selected item background
  },
  // Text — cold grayscale
  text: {
    primary: '#E9EDF0',
    secondary: '#9AA4AE',
    muted: '#6C7680',
    link: '#7A9AB5',      // steel blue — edit links, info links
  },
  // Accent — steel blue (the only cold hue, used with restraint)
  accent: {
    primary: '#4A6FA5',
    secondary: '#3A587F',
    muted: 'rgba(74, 111, 165, 0.15)',
  },
  // Ember — the forge's warm core. Achievement-only: PRs, streaks, milestones.
  // 5-10% of any screen. Precisely the one warm tone that "fuses" with the
  // cold steel ecosystem (molten metal inside a dark forge).
  ember: {
    primary: '#C77B45',
    deep: '#A05F33',
    muted: 'rgba(199, 123, 69, 0.14)',
  },
  // Status — cold, desaturated; each has one job
  success: '#6E9C8A',     // blue-green sage — completed sets ONLY
  warning: '#C2A05C',     // cold amber
  error: '#C96F6F',       // cold red — destructive / validation
  // Borders — cold hairlines
  border: {
    primary: '#2A3138',   // main border color
    light: '#353D45',     // secondary borders, button outlines
    divider: '#232930',   // thin dividers, separator lines
  },
  // Tags
  tag: {
    muscle: '#22344A',    // muscle group tag background (steel blue family)
    equipment: '#1F332C', // equipment tag background (sage family)
    text: '#7A9AB5',      // tag text color
    equipmentText: '#6E9C8A',
  },
  // Chart colors
  chart: {
    weight: '#4A6FA5',    // steel blue — weight line
    reps: '#82c896',      // green — reps line
  },
  // Overlay variants
  overlay: {
    default: 'rgba(0, 0, 0, 0.7)',
    deep: 'rgba(0, 0, 0, 0.9)',
  },
  // Folders
  folders: [
    '#4A6FA5', '#6E9C8A', '#C77B45', '#C2A05C',
    '#9B7ABF', '#7A9AB5', '#C96F6F', '#8B8B8B',
  ],
  // Status muted (for badges/backgrounds)
  statusMuted: {
    success: 'rgba(110, 156, 138, 0.15)',
    warning: 'rgba(194, 160, 92, 0.15)',
    error: 'rgba(201, 111, 111, 0.15)',
  },
};

export const spacing = {
  xxs: 1,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// Radius — deliberately small, industrial. Authority comes from straight
// edges, not soft curves. Only full stays round (checks, swatches, pills).
export const borderRadius = {
  xs: 2,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  full: 9999,
};

// Typography — Oswald for display numerals (the "load chalkboard" signature),
// Space Grotesk for body. Each weight is its own family (RN pattern).
export const fonts = {
  display: 'Oswald_600SemiBold',
  body: 'SpaceGrotesk_400Regular',
  bodyMedium: 'SpaceGrotesk_500Medium',
  bodySemiBold: 'SpaceGrotesk_600SemiBold',
};

export const fontSizes = {
  xxs: 9,
  xs2: 10,
  xs: 11,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 24,
  xxl: 32,
  display: 40,
};

export const fontWeights = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

export const borderWidths = {
  thin: 1,
  medium: 1.5,
  thick: 2,
};

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
};
