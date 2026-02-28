/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Pretendard Variable"', 'sans-serif'],
      },
      colors: {
        darkBg: '#0f1115',
        darkCard: '#1a1c23',
      }
    },
  },
  plugins: [],
}
