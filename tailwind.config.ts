// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/client/**/*.{js,ts,jsx,tsx}", "./src/client/index.html"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Primary colors - using CSS variables for easy theming
        primary: {
          50: "var(--color-primary-50)",
          100: "var(--color-primary-100)",
          200: "var(--color-primary-200)",
          300: "var(--color-primary-300)",
          400: "var(--color-primary-400)",
          500: "var(--color-primary-500)",
          600: "var(--color-primary-600)",
          700: "var(--color-primary-700)",
          800: "var(--color-primary-800)",
          900: "var(--color-primary-900)",
          950: "var(--color-primary-950)",
        },
        // Surface colors for backgrounds
        surface: {
          DEFAULT: "var(--color-surface)",
          secondary: "var(--color-surface-secondary)",
          tertiary: "var(--color-surface-tertiary)",
          hover: "var(--color-surface-hover)",
          active: "var(--color-surface-active)",
        },
        // Text colors
        content: {
          DEFAULT: "var(--color-content)",
          secondary: "var(--color-content-secondary)",
          tertiary: "var(--color-content-tertiary)",
          inverse: "var(--color-content-inverse)",
        },
        // Border colors
        border: {
          DEFAULT: "var(--color-border)",
          secondary: "var(--color-border-secondary)",
          focus: "var(--color-border-focus)",
        },
        // Accent colors for actions
        accent: {
          DEFAULT: "var(--color-accent)",
          hover: "var(--color-accent-hover)",
          active: "var(--color-accent-active)",
        },
        // Status colors
        success: {
          DEFAULT: "var(--color-success)",
          surface: "var(--color-success-surface)",
        },
        warning: {
          DEFAULT: "var(--color-warning)",
          surface: "var(--color-warning-surface)",
        },
        error: {
          DEFAULT: "var(--color-error)",
          surface: "var(--color-error-surface)",
        },
        info: {
          DEFAULT: "var(--color-info)",
          surface: "var(--color-info-surface)",
        },
      },
      fontFamily: {
        sans: ["var(--font-family-sans)"],
        mono: ["var(--font-family-mono)"],
      },
      fontSize: {
        xs: ["var(--font-size-xs)", { lineHeight: "var(--line-height-xs)" }],
        sm: ["var(--font-size-sm)", { lineHeight: "var(--line-height-sm)" }],
        base: [
          "var(--font-size-base)",
          { lineHeight: "var(--line-height-base)" },
        ],
        lg: ["var(--font-size-lg)", { lineHeight: "var(--line-height-lg)" }],
        xl: ["var(--font-size-xl)", { lineHeight: "var(--line-height-xl)" }],
        "2xl": [
          "var(--font-size-2xl)",
          { lineHeight: "var(--line-height-2xl)" },
        ],
      },
      spacing: {
        sidebar: "var(--sidebar-width)",
        header: "var(--header-height)",
      },
      boxShadow: {
        subtle: "var(--shadow-subtle)",
        medium: "var(--shadow-medium)",
        elevated: "var(--shadow-elevated)",
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
      },
      transitionDuration: {
        fast: "var(--transition-fast)",
        normal: "var(--transition-normal)",
        slow: "var(--transition-slow)",
      },
      animation: {
        "fade-in": "fadeIn var(--transition-normal) ease-out",
        "slide-up": "slideUp var(--transition-normal) ease-out",
        "slide-down": "slideDown var(--transition-normal) ease-out",
        "scale-in": "scaleIn var(--transition-fast) ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideDown: {
          "0%": { opacity: "0", transform: "translateY(-10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
