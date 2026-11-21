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
          DEFAULT: "#1664C0",
          hover: "#0D4E9F",
          light: "#E9F2FF",
          50: "#F2F7FF",
          100: "#E4EFFF",
          200: "#C9DFFF",
          300: "#A6C8F5",
          400: "#72A5E6",
          500: "#3C80D5",
          600: "#1664C0",
          700: "#0D4E9F",
          800: "#123F7E",
          900: "#0C3264",
          950: "#082345",
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
