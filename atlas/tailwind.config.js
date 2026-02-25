/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        copernicus: {
          bg: '#050505',
          phosphor: '#4ADE80',
          steel: '#3F3F46',
        },
      },
      textShadow: {
        'phosphor-glow': '0 0 2px rgba(74, 222, 128, 0.8), 0 0 8px rgba(74, 222, 128, 0.4)',
      },
      height: {
        'header': '18px',
      },
      borderWidth: {
        'hairline': '0.5px',
      }
    },
  },
  plugins: [],
}
