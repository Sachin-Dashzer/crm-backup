"use client";

import { useTheme } from "./ThemeContext";
import { useSession } from "next-auth/react";
import { Sun, Moon } from "lucide-react";

export default function OwnerTopbar({ title, subtitle, controls }) {
  const { theme, toggleTheme } = useTheme();
  const { data: session } = useSession();

  const userName = session?.user?.name || session?.user?.email || "Owner";
  const initials = userName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

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
          {theme === "dark" ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-indigo-600" />
          )}
        </button>
        {/* User avatar pill */}
        <div
          title={userName}
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            background: "linear-gradient(135deg,var(--navy),var(--navy2))",
            color: "#fff",
            display: "grid",
            placeItems: "center",
            fontWeight: 900,
            fontSize: 12,
            letterSpacing: 0.5,
            flexShrink: 0,
            cursor: "default",
            border: "2px solid rgba(255,255,255,0.15)",
            boxShadow: "0 4px 12px rgba(7,21,47,0.25)",
            userSelect: "none",
          }}
        >
          {initials}
        </div>
      </div>
    </div>
  );
}
