/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#16302B',      // agave night: text, dark surfaces
        paper: '#EEF1EC',    // cool sage paper background
        ticket: '#FFFDF8',   // order ticket stock
        marigold: '#E9A21B', // primary action
        chile: '#C23B22',    // late / at risk
        nopal: '#3F8F4E',    // on time / done
        pacific: '#2D6A8A',  // booked ahead / info
        line: '#D3DAD2',
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"Atkinson Hyperlegible"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
