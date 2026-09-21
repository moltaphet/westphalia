import type { Config } from "tailwindcss";
import containerQueries from "@tailwindcss/container-queries";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Tactical Cyber-Geopolitical palette
        canvas: "#09090b", // zinc-950
        panel: "#0f172a", // slate-900
        alliance: "#10b981", // emerald-500
        allianceCyan: "#22d3ee", // cyan-400
        dispute: "#f59e0b", // amber-500
        containment: "#ef4444", // crimson / red-500
        neutral: "#64748b", // slate-500
      },
      fontFamily: {
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "Liberation Mono",
          "Courier New",
          "monospace",
        ],
      },
      boxShadow: {
        hud: "0 0 0 1px rgba(148,163,184,0.15), 0 8px 40px rgba(0,0,0,0.55)",
      },
      keyframes: {
        pulseGlow: {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
        scan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
      },
      animation: {
        pulseGlow: "pulseGlow 2.4s ease-in-out infinite",
        scan: "scan 6s linear infinite",
      },
    },
  },
  plugins: [
    // Tailwind v3 has no container queries in core -- `@container` and the
    // `@md:`/`@lg:` variants compile to nothing without this plugin, silently
    // leaving a `grid` with no column count. The bilateral matrix needs them:
    // it is mounted both in a 672px modal and in a 344px inspector rail, and
    // viewport breakpoints cannot tell those two apart.
    containerQueries,
  ],
};

export default config;
