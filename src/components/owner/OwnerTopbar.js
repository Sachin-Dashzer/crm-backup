"use client";

import { useTheme } from "./ThemeContext";

// .topbar — title/subtitle on the left, arbitrary controls (selects, search, buttons) on the
// right inside .top-actions, plus a dark-mode toggle every page gets for free (matches the
// prototype's #themeBtn, which lives in the topbar on every screen — not per-page state).
export default function OwnerTopbar({ title, subtitle, controls }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="topbar">
      <div>
        {title && <h1>{title}</h1>}
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="top-actions">
        {controls}
        <button
          className="icon-btn"
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? "☀" : "◐"}
        </button>
      </div>
    </div>
  );
}
