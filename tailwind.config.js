/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './lib/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        strength: '#EF4444',
        cardio: '#3B82F6',
        flexibility: '#8B5CF6',
        hiit: '#F59E0B',
        dark: {
          bg: '#0A0A0A',
          secondary: '#141414',
          card: '#1A1A1A',
          elevated: '#222222',
        },
        accent: {
          DEFAULT: '#00F5A0',
          dark: '#00D9A0',
          muted: 'rgba(0, 245, 160, 0.15)',
        },
      },
    },
  },
  plugins: [],
};
