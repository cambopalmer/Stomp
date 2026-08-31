import {
  CalendarDays,
  FolderKanban,
  GraduationCap,
  Home,
  Inbox,
  ListTodo,
  Monitor,
  Moon,
  Sun,
  Users,
} from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import { NavLink } from "react-router-dom";
import { useQuickCapture } from "../lib/queries.js";
import { useTheme } from "../lib/theme.js";
import { Button, Input } from "./ui.js";
import { HotSidebar } from "./HotSidebar.js";
import { NotificationsBell } from "./NotificationsBell.js";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher.js";

const nav = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/todos", label: "Todos", icon: ListTodo },
  { to: "/incoming", label: "Incoming", icon: Inbox },
  { to: "/learn", label: "Learn", icon: GraduationCap },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/shared", label: "Shared with me", icon: Users },
];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

const themeIcon = { system: Monitor, light: Sun, dark: Moon };

export function AppShell({ children }: { children: ReactNode }) {
  const [capture, setCapture] = useState("");
  const quick = useQuickCapture();
  const { theme, cycle } = useTheme();
  const ThemeIcon = themeIcon[theme];

  const submitCapture = (e: FormEvent) => {
    e.preventDefault();
    if (!capture.trim()) return;
    quick.mutate(capture.trim(), { onSuccess: () => setCapture("") });
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-7xl flex-col px-4">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:rounded focus:bg-primary focus:px-3 focus:py-1 focus:text-primary-fg"
      >
        Skip to main content
      </a>

      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold tracking-tight">STOMP</span>
          <WorkspaceSwitcher />
          <span className="hidden text-sm text-muted lg:inline">
            {greeting()} · <span className="tnum">{new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date())}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <form onSubmit={submitCapture} className="flex items-center gap-2">
            <label htmlFor="quick-add" className="sr-only">
              Quick add to Incoming
            </label>
            <Input
              id="quick-add"
              value={capture}
              onChange={(e) => setCapture(e.target.value)}
              placeholder="Quick add…"
              className="w-40 sm:w-56"
            />
            <Button variant="accent" type="submit" disabled={quick.isPending}>
              Add
            </Button>
          </form>
          <NotificationsBell />
          <button
            onClick={cycle}
            aria-label={`Theme: ${theme}. Click to change.`}
            title={`Theme: ${theme}`}
            className="rounded-md border border-border p-2 text-muted hover:text-text"
          >
            <ThemeIcon size={16} aria-hidden="true" />
          </button>
          <NavLink to="/signup" className="hidden text-sm text-muted underline hover:text-text sm:inline">
            Create account
          </NavLink>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-6 py-6 lg:flex-row">
        <nav aria-label="Sections" className="lg:w-44 lg:shrink-0">
          <ul className="flex flex-wrap gap-1 lg:flex-col">
            {nav.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-surface-2 text-text border-l-2 border-primary"
                        : "text-muted hover:bg-surface-2 hover:text-text"
                    }`
                  }
                >
                  <Icon size={18} aria-hidden="true" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>

        <aside aria-label="Hot and relevant" className="lg:w-72 lg:shrink-0">
          <HotSidebar />
        </aside>
      </div>
    </div>
  );
}
