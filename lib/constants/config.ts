// App configuration constants
// Centralized values that were previously hardcoded across components

export const TIMER_CONFIG = {
  // Timer tick intervals (ms)
  MAIN_TIMER_TICK: 1000,
  REST_TIMER_TICK: 500,
  
  // Rest timer presets (seconds)
  REST_PRESETS: [30, 60, 90, 120, 180] as const,
  DEFAULT_REST: 60,
  
  // Adjust step (seconds)
  REST_ADJUST_STEP: 15,
  
  // Vibration pattern
  VIBRATION_PATTERN: [0, 250, 250, 250],
} as const;

export const ANIMATION_CONFIG = {
  // Banner animations (ms)
  BANNER_DISPLAY: 2500,
  BANNER_FADE_IN: 200,
  BANNER_FADE_OUT: 250,
  BANNER_SLIDE: 16,
  
  // List item animations (ms)
  LIST_ITEM_DELAY: 50,
  LIST_ITEM_DURATION: 300,
  
  // Long press threshold (ms)
  LONG_PRESS_DURATION: 500,
} as const;

export const CHART_CONFIG = {
  // Max x-axis labels
  MAX_X_LABELS: 5,
  
  // Scroll threshold (number of data points)
  SCROLL_THRESHOLD: 8,
  
  // Chart padding
  PADDING: {
    top: 20,
    right: 10,
    bottom: 30,
    left: 40,
  },
} as const;

export const AUTH_CONFIG = {
  MIN_PASSWORD_LENGTH: 6,
} as const;
