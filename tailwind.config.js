/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background:     "#0a0a0f",
        surface:        "#111118",
        "surface-raised": "#1a1a24",
        border:         "#2a2a3a",
        foreground:     "#e8e8f0",
        muted:          "#6b6b80",
        accent:         "#3b82f6",
        "accent-dim":   "#1d4ed8",
        success:        "#22c55e",
        warning:        "#f59e0b",
        danger:         "#ef4444",
      },
    },
  },
  plugins: [],
};
