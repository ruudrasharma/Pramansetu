import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        graphite: {
          950: "#0A0C10",
          900: "#12151A",
          850: "#161A21",
          800: "#1B1F26",
          700: "#242933",
          600: "#323847",
        },
        ink: {
          50: "#F4F5F7",
          200: "#C7CCD6",
          400: "#8B93A1",
          600: "#5B6371",
        },
        signal: {
          400: "#7196F2",
          500: "#5B8DEF",
          600: "#4472D6",
        },
        verified: {
          400: "#4FCB94",
          500: "#34B37A",
        },
        alert: {
          400: "#EFC066",
          500: "#E0A63E",
        },
        danger: {
          400: "#EC6E72",
          500: "#E5484D",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist)", "Inter", "sans-serif"],
        mono: ["var(--font-geist-mono)", "IBM Plex Mono", "monospace"],
      },
      borderRadius: {
        xl: "14px",
        "2xl": "20px",
      },
      boxShadow: {
        panel: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 20px 40px -20px rgba(0,0,0,0.6)",
        glow: "0 0 0 1px rgba(91,141,239,0.25), 0 0 24px rgba(91,141,239,0.12)",
      },
      keyframes: {
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(52,179,122,0.4)" },
          "100%": { boxShadow: "0 0 0 10px rgba(52,179,122,0)" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 1.8s cubic-bezier(0.4,0,0.6,1) infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
