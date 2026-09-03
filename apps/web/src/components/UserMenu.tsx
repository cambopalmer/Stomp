import { LogOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../lib/auth.js";

export function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  if (!user) return null;
  const initials = user.displayName.split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account: ${user.displayName}`}
        className="grid h-8 w-8 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-fg"
      >
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
        ) : (
          initials
        )}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-48 rounded-md border border-border bg-surface p-1 text-sm shadow-md"
        >
          <div className="px-2 py-1.5">
            <p className="font-medium">{user.displayName}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <div className="my-1 border-t border-border" />
          <button
            role="menuitem"
            onClick={() => logout()}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-surface-2"
          >
            <LogOut size={14} aria-hidden="true" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
