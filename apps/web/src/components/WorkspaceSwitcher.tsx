import { Check, ChevronsUpDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useWorkspaces } from "../lib/queries.js";
import { useWorkspace } from "../lib/workspace.js";

export function WorkspaceSwitcher() {
  const { data: workspaces } = useWorkspaces();
  const { active, setActive } = useWorkspace();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Stale id (workspace deleted / access lost / db reseeded) → fall back to Personal.
  useEffect(() => {
    if (active !== null && workspaces && !workspaces.some((w) => w.id === active)) {
      setActive(null);
    }
  }, [active, workspaces, setActive]);

  const activeName =
    active === null ? "Personal" : (workspaces?.find((w) => w.id === active)?.name ?? "Personal");

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm font-medium hover:bg-surface-2"
      >
        {activeName}
        <ChevronsUpDown size={14} className="text-muted" aria-hidden="true" />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute left-0 z-20 mt-1 min-w-[12rem] rounded-md border border-border bg-surface p-1 shadow-md"
        >
          <Option label="Personal" selected={active === null} onSelect={() => { setActive(null); setOpen(false); }} />
          {workspaces?.map((w) => (
            <Option
              key={w.id}
              label={w.name}
              selected={active === w.id}
              onSelect={() => { setActive(w.id); setOpen(false); }}
            />
          ))}
          <li className="my-1 border-t border-border" />
          <li>
            <Link
              to="/workspaces"
              onClick={() => setOpen(false)}
              className="block rounded px-2 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-text"
            >
              Manage workspaces…
            </Link>
          </li>
        </ul>
      )}
    </div>
  );
}

function Option({ label, selected, onSelect }: { label: string; selected: boolean; onSelect: () => void }) {
  return (
    <li>
      <button
        role="option"
        aria-selected={selected}
        onClick={onSelect}
        className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-surface-2"
      >
        {label}
        {selected && <Check size={14} className="text-primary" aria-hidden="true" />}
      </button>
    </li>
  );
}
