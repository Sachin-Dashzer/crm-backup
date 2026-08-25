"use client";

import { createContext, useContext, useEffect, useState } from "react";

// Drives data-theme on the .owner-app root div (see src/app/owner/layout.jsx) so the ported
// CSS's [data-theme="dark"] variable overrides (owner-theme.css) apply across every /owner/*
// page from one shared toggle, not per-page state. Persisted in localStorage so it survives
// navigation and reloads; defaults to "light" (system-preference detection wasn't asked for —
// the prototype's own toggle is a manual light/dark switch, not automatic).
const ThemeContext = createContext({ theme: "light", toggleTheme: () => {} });

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("owner-theme");
      if (stored === "dark" || stored === "light") setTheme(stored);
    } catch {
      // localStorage unavailable — stay on the light default
    }
  }, []);

  const toggleTheme = () => {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("owner-theme", next);
      } catch {
        // localStorage unavailable — theme still switches for this session
      }
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div className="owner-app" data-theme={theme}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
