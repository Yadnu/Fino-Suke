import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        background: "#0f0f11",
        surface: "#1a1a1f",
        border: "#2a2a32",
        gold: {
          DEFAULT: "#f5c842",
          muted: "#f5c84220",
          hover: "#f0bc2e",
        },
        teal: {
          DEFAULT: "#2dd4bf",
          muted: "#2dd4bf20",
          hover: "#25bfab",
        },
        danger: { DEFAULT: "#f87171", muted: "#f8717120" },
        success: { DEFAULT: "#4ade80", muted: "#4ade8020" },
        muted: { DEFAULT: "#71717a", foreground: "#a1a1aa" },
        primary: { DEFAULT: "#f5c842", foreground: "#0f0f11" },
        secondary: { DEFAULT: "#1a1a1f", foreground: "#f4f4f5" },
        card: { DEFAULT: "#1a1a1f", foreground: "#f4f4f5" },
        popover: { DEFAULT: "#1a1a1f", foreground: "#f4f4f5" },
        accent: { DEFAULT: "#2a2a32", foreground: "#f4f4f5" },
        destructive: { DEFAULT: "#f87171", foreground: "#0f0f11" },
        input: "#2a2a32",
        ring: "#f5c842",
        foreground: "#f4f4f5",
      },
      fontFamily: {
        display: ["var(--font-sora)", "sans-serif"],
        body: ["var(--font-dm-sans)", "sans-serif"],
        sans: ["var(--font-dm-sans)", "sans-serif"],
      },
      borderRadius: {
        lg: "12px",
        md: "8px",
        sm: "6px",
        pill: "999px",
      },
      spacing: {
        "1": "4px",
        "2": "8px",
        "3": "12px",
        "4": "16px",
        "5": "20px",
        "6": "24px",
        "8": "32px",
        "10": "40px",
        "12": "48px",
        "16": "64px",
        "20": "80px",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(0,0,0,0.4), 0 1px 2px -1px rgba(0,0,0,0.4)",
        "card-hover":
          "0 4px 12px 0 rgba(0,0,0,0.5), 0 2px 4px -1px rgba(0,0,0,0.4)",
        gold: "0 0 20px rgba(245,200,66,0.15)",
        teal: "0 0 20px rgba(45,212,191,0.15)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.3s ease-out",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        shimmer: "shimmer 2s linear infinite",
        pulse: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
