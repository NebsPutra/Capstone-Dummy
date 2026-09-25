import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: "#FFF8ED",
          warm: "#F8E8D0",
        },
        orange: {
          DEFAULT: "#F97316",
          dark: "#C2410C",
        },
        ink: "#292524",
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
      },
    },
  },
  plugins: [],
};
export default config;
