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
        strength: '#4A6FA5',
        cardio: '#7A9AB5',
        flexibility: '#9AA4AE',
        hiit: '#C2A05C',
        dark: {
          bg: '#101316',
          secondary: '#15181C',
          card: '#1A1E23',
          elevated: '#22272D',
        },
        accent: {
          DEFAULT: '#4A6FA5',
          dark: '#3A587F',
          muted: 'rgba(74, 111, 165, 0.15)',
        },
      },
      fontFamily: {
        display: ['Oswald_600SemiBold'],
        body: ['SpaceGrotesk_400Regular'],
        'body-medium': ['SpaceGrotesk_500Medium'],
        'body-semibold': ['SpaceGrotesk_600SemiBold'],
      },
    },
  },
  plugins: [],
};
