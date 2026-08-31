import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";
const KEY = "stomp.theme";

function read(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* private mode etc. */
  }
  return "system";
}

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(read);

  useEffect(() => {
    apply(theme);
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const cycle = () =>
    setTheme((t) => (t === "system" ? "light" : t === "light" ? "dark" : "system"));

  return { theme, setTheme, cycle };
}
