/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'kumbh-orange': '#FF6B35',
        'kumbh-blue': '#004E89',
        'kumbh-gold': '#F7B801',
      },
    },
  },
  plugins: [],
}
