import { useEffect, useState, useCallback } from "react";

type Theme = "light" | "dark";
const KEY = "alo-theme";

function getInitial(): Theme {
  if (typeof window === "undefined") return "light";
  const saved = localStorage.getItem(KEY) as Theme | null;
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

// Initialize ASAP to avoid flash
if (typeof window !== "undefined") {
  apply(getInitial());
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => getInitial());

  useEffect(() => {
    apply(theme);
    localStorage.setItem(KEY, theme);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const toggle = useCallback(() => setThemeState((p) => (p === "dark" ? "light" : "dark")), []);

  return { theme, setTheme, toggle };
}
