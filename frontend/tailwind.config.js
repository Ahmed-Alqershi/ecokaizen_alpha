/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#2563eb",
        secondary: "#9333ea",
        neutral: "#f9fafb",
        midgray: "#d1d5db",
        darkgray: "#1f2937",
        success: "#10b981",
        warning: "#f59e0b",
      },
    },
  },
  plugins: [],
}