"use client";

import { useState, useEffect } from "react";

/** Accessible theme toggle button with visual state feedback and keyboard support. */
export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const isDarkMode = document.documentElement.getAttribute("data-theme") === "dark";
    setIsDark(isDarkMode);
  }, []);

  const toggle = () => {
    const html = document.documentElement;
    const current = html.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    html.setAttribute("data-theme", next);
    localStorage.setItem("jashn-theme", next);
    setIsDark(next === "dark");
  };

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      aria-pressed={isDark}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      style={{
        background: "none",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius)",
        cursor: "pointer",
        padding: "0.375rem 0.5rem",
        fontSize: "1rem",
        minHeight: 44,
        minWidth: 44,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--color-text)",
      }}
    >
      <span aria-hidden="true">{isDark ? "☀️" : "🌙"}</span>
    </button>
  );
}
