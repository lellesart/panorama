/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: {
          bg: "#F7F4EF",
          card: "#EFECE6",
          hover: "#E5DEC9",
        },
        ink: {
          black: "#141413",
          graphite: "#5C5A55",
        },
        pastel: {
          sage: "#D4E2D4",
          peach: "#F5D5CB",
          lavender: "#DFD8E8",
          butter: "#F3E9C6",
          sky: "#D0E1EB",
          rose: "#F2D6DC",
        },
      },
      fontFamily: {
        serif: ['"Newsreader"', "Georgia", "serif"],
        sans: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      boxShadow: {
        paper: "3px 3px 0px #141413",
        "paper-hover": "5px 5px 0px #141413",
        "paper-sm": "2px 2px 0px #141413",
        "paper-lg": "8px 8px 0px #141413",
      },
    },
  },
  plugins: [],
};
