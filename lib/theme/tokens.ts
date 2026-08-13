// Design system "Acero frío" — cold monochrome: near-black blues, white/grays,
// one steel-blue accent. Built for a data-entry tool under fatigue: quiet,
// technical, coherent. No warm tones anywhere.

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
  // Accent — steel blue (the only hue, used with restraint)
  accent: {
    primary: '#4A6FA5',
    secondary: '#3A587F',
    muted: 'rgba(74, 111, 165, 0.15)',
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
  // Overlay
  overlay: 'rgba(0, 0, 0, 0.7)',
  // Tags
  tag: {
    muscle: '#22344A',    // muscle group tag background (steel blue family)
    equipment: '#1F332C', // equipment tag background (sage family)
    text: '#7A9AB5',      // tag text color
    equipmentText: '#6E9C8A',
  },
};

export const spacing = {
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
  xs: 11,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 24,
  xxl: 32,
  display: 40,
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
