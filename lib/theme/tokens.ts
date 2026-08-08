export const colors = {
  // Backgrounds
  bg: {
    primary: '#0A0A0A',
    secondary: '#141414',
    card: '#1A1A1A',
    elevated: '#222222',
    active: '#1A3A1A',    // drag/reorder active state
    selected: '#0A2A1A',  // selected item background
  },
  // Text
  text: {
    primary: '#FFFFFF',
    secondary: '#A0A0A0',
    muted: '#666666',
    link: '#60A5FA',      // edit links, info links
  },
  // Accent (vibrant green like fitness apps)
  accent: {
    primary: '#00F5A0',
    secondary: '#00D9A0',
    muted: 'rgba(0, 245, 160, 0.15)',
  },
  // Status
  success: '#00F5A0',
  warning: '#FFB800',
  error: '#FF3B30',
  // Borders
  border: {
    primary: '#2A2A2A',   // main border color
    light: '#3A3A3A',     // secondary borders, button outlines
    divider: '#333333',   // thin dividers, separator lines
  },
  // Overlay
  overlay: 'rgba(0, 0, 0, 0.7)',
  // Tags
  tag: {
    muscle: '#1E3A5F',    // muscle group tag background
    equipment: '#1E3A2F', // equipment tag background
    text: '#60A5FA',      // tag text color
    equipmentText: '#34D399',
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

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
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
