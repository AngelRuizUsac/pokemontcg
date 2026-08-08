import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#101114",
          50: "#F2F1EC",
          100: "#C9CAD2",
          400: "#8B8E98",
          600: "#3A3D46",
          700: "#2C2F38",
          800: "#191B20",
          850: "#15161B",
          900: "#101114",
        },
        gold: {
          DEFAULT: "#F5B942",
          light: "#FFD57E",
          dark: "#C9932A",
        },
        holo: {
          cyan: "#4FE0D8",
          violet: "#B98BFF",
          pink: "#FF8FC7",
        },
        grass: "#3DDC97",
        danger: "#FF6B6B",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
        mono: ["var(--font-mono)"],
      },
      backgroundImage: {
        "holo-gradient":
          "linear-gradient(115deg, #4FE0D8 0%, #B98BFF 45%, #FF8FC7 100%)",
      },
      borderRadius: {
        card: "14px",
      },
    },
  },
  plugins: [],
};
export default config;
