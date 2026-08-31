/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Tokens defined in src/index.css (design-system/stomp/MASTER.md O2/O8)
      colors: {
        bg: "var(--color-background)",
        surface: "var(--color-card)",
        "surface-2": "var(--color-muted)",
        border: "var(--color-border)",
        text: "var(--color-foreground)",
        muted: "var(--color-muted-foreground)",
        primary: "var(--color-primary)",
        "primary-fg": "var(--color-on-primary)",
        accent: "var(--color-accent)",
        "accent-fg": "var(--color-on-accent)",
        danger: "var(--color-destructive)",
        info: "var(--color-info)",
        success: "var(--color-success)",
        warning: "var(--color-warning)",
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "-apple-system", '"Segoe UI"', "Roboto", "sans-serif"],
      },
      borderRadius: { lg: "8px", md: "6px" },
    },
  },
  plugins: [],
};
