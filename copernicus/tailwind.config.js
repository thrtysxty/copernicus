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
          bg: '#050505',     // Deep black
          phosphor: 'rgb(var(--copernicus-phosphor-rgb) / <alpha-value>)', // VT420 Green
          steel: '#3F3F46',  // Cold dividers
        },
      },
      textShadow: {
        'phosphor-glow': '0 0 2px rgba(var(--copernicus-phosphor-rgb), 0.8), 0 0 8px rgba(var(--copernicus-phosphor-rgb), 0.4)',
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
