"use client";

import { useTheme } from "./ThemeContext";

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
