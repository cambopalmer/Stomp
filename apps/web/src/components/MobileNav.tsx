import { type LucideIcon, Menu, Settings, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

/**
 * Phones / small tablets: a ☰ button that opens the sections as a slide-in
 * drawer. Closes on a link, ×, Escape, the backdrop, or any route change;
 * focus moves into the drawer and back to ☰ afterwards; the page behind
 * doesn't scroll while it's open. Hidden at lg+, where the sidebar shows.
 */
export function MobileNav({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const panelId = useId();
  const { pathname } = useLocation();

  // any navigation closes it
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      closeBtn.current?.focus();
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
      document.addEventListener("keydown", onKey);
      return () => {
        document.body.style.overflow = prev;
        document.removeEventListener("keydown", onKey);
      };
    }
    if (wasOpen.current) button.current?.focus(); // back to where the user was
    wasOpen.current = false;
  }, [open]);

  const link = ({ isActive }: { isActive: boolean }) =>
    `flex min-h-12 items-center gap-3 rounded-md px-3 text-base font-medium ${
      isActive ? "bg-surface-2 text-text border-l-2 border-primary" : "text-muted hover:bg-surface-2 hover:text-text"
    }`;

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls={panelId}
        className="grid h-11 w-11 place-items-center rounded-md border border-border text-text hover:bg-surface-2 lg:hidden"
      >
        <Menu size={20} aria-hidden="true" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div aria-hidden="true" className="absolute inset-0" style={{ background: "rgba(15, 23, 42, 0.45)" }} onClick={() => setOpen(false)} />
          <div
            id={panelId}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-2 overflow-y-auto border-r border-border bg-surface p-3 shadow-xl"
            style={{
              paddingTop: "max(0.75rem, env(safe-area-inset-top))",
              paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
            }}
          >
            <div className="flex items-center justify-between px-1">
              <span className="text-lg font-bold tracking-tight">STOMP</span>
              <button
                ref={closeBtn}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="grid h-11 w-11 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-text"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <nav aria-label="Sections">
              <ul className="flex flex-col gap-1">
                {items.map(({ to, label, icon: Icon, end }) => (
                  <li key={to}>
                    <NavLink to={to} end={end} className={link} onClick={() => setOpen(false)}>
                      <Icon size={20} aria-hidden="true" />
                      {label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="mt-auto border-t border-border pt-2">
              <NavLink to="/settings" className={link} onClick={() => setOpen(false)}>
                <Settings size={20} aria-hidden="true" />
                Settings
              </NavLink>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
