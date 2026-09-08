import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        graphite: {
          950: "var(--graphite-950)",
          900: "var(--graphite-900)",
          850: "var(--graphite-850)",
          800: "var(--graphite-800)",
          700: "var(--graphite-700)",
          600: "var(--graphite-600)",
        },
        ink: {
          50: "var(--ink-50)",
          200: "var(--ink-200)",
          400: "var(--ink-400)",
          600: "var(--ink-600)",
        },
        signal: {
          400: "var(--signal-400)",
          500: "var(--signal-500)",
          600: "var(--signal-600)",
        },
        verified: {
          400: "var(--verified-400)",
          500: "var(--verified-500)",
        },
        alert: {
          400: "var(--alert-400)",
          500: "var(--alert-500)",
        },
        danger: {
          400: "var(--danger-400)",
          500: "var(--danger-500)",
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
        panel: "var(--shadow-panel)",
        glow: "var(--shadow-glow)",
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
