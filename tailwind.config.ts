import type { Config } from "tailwindcss";

// Colors are CSS variables (RGB channels) defined in globals.css, so the same
// class names work in light and dark mode: `.dark` just redefines them.
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: token("cream"),
          warm: token("cream-warm"),
        },
        orange: {
          DEFAULT: token("orange"),
          dark: token("orange-dark"), // text/links: readable on the page background
          deep: "#C2410C", // filled buttons: white text on it passes WCAG AA (5.2:1)
          deeper: "#9A3412", // hover state for filled buttons
        },
        ink: token("ink"),
        surface: token("surface"), // cards, inputs, panels
        // Status colors: `text-danger`, `bg-danger-soft`, `bg-danger-solid` (white text), etc.
        success: { DEFAULT: token("success"), soft: token("success-soft"), solid: token("success-solid") },
        warning: { DEFAULT: token("warning"), soft: token("warning-soft"), solid: token("warning-solid") },
        danger: { DEFAULT: token("danger"), soft: token("danger-soft"), solid: token("danger-solid") },
        info: { DEFAULT: token("info"), soft: token("info-soft"), solid: token("info-solid") },
        muted: { DEFAULT: token("muted"), soft: token("muted-soft") },
      },
      fontFamily: {
        sans: ["var(--font-plus-jakarta)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
      },
      boxShadow: {
        soft: "0 4px 20px -4px rgba(194,65,12,0.12)",
        lift: "0 12px 32px -8px rgba(194,65,12,0.22)",
      },
      keyframes: {
        "page-in": { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "none" } },
        "pop-in": { from: { opacity: "0", transform: "scale(0.96)" }, to: { opacity: "1", transform: "none" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        float: { "0%, 100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-6px)" } },
      },
      animation: {
        "page-in": "page-in 220ms ease-out both",
        "pop-in": "pop-in 180ms ease-out both",
        "fade-in": "fade-in 200ms ease-out both",
        float: "float 5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
