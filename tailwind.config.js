/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        rose: {
          brand: "#d63384",
          light: "#fff0f7",
          line:  "#f4d6e8",
        },
      },
    },
  },
  plugins: [],
};