import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#24634F",
          hover: "#193E33",
          light: "#DDEBDF",
          50: "#F0F6EE",
          100: "#DDEBDF",
          200: "#C4DBC6",
          300: "#9EC5A6",
          400: "#79AC89",
          500: "#488868",
          600: "#24634F",
          700: "#193E33",
          800: "#183D30",
          900: "#122F25",
          950: "#0C2119",
        },
        navy: {
          DEFAULT: "#0F172A",
          sidebar: "#0F172A",
          hover: "#1E293B",
          dark: "#020617",
          light: "#334155",
        },
        surface: {
          bg: "#F8FAFC",
          card: "#FFFFFF",
          border: "#E2E8F0",
          text: "#334155",
          muted: "#64748B",
        },
        status: {
          success: "#16A34A",
          warning: "#EAB308",
          error: "#DC2626",
          info: "#2563EB",
        }
      },
    },
  },
  plugins: [],
};
export default config;
