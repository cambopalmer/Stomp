import { AlarmClock, Bell, CalendarClock, UserPlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  type NotificationItem,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "../lib/queries.js";

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
function when(ms: number) {
  const mins = Math.round((ms - Date.now()) / 60_000);
  if (Math.abs(mins) < 60) return rtf.format(mins, "minute");
  const hrs = Math.round(mins / 60);
  if (Math.abs(hrs) < 48) return rtf.format(hrs, "hour");
  return rtf.format(Math.round(hrs / 24), "day");
}

const icon: Record<string, typeof Bell> = {
  share_invite: UserPlus,
  assignment: UserPlus,
  past_due: AlarmClock,
  event_reminder: CalendarClock,
};

function href(n: NotificationItem): string | null {
  if (!n.entityId) return null;
  if (n.entityType === "todo") return `/todos/${n.entityId}`;
  if (n.entityType === "event") return `/calendar/${n.entityId}`;
  if (n.entityType === "reference") return `/learn/${n.entityId}`;
  return null;
}

export function NotificationsBell() {
  const { data } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const unread = data?.unread ?? 0;

  const activate = (n: NotificationItem) => {
    if (!n.transient) markRead.mutate(n.id);
    const to = href(n);
    setOpen(false);
    if (to) nav(to);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        className="relative rounded-md border border-border p-2 text-muted hover:text-text"
      >
        <Bell size={16} aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-fg tnum">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-80 rounded-md border border-border bg-surface p-1 shadow-md">
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-sm font-semibold">Notifications</span>
            {unread > 0 && (
              <button
                onClick={() => markAll.mutate()}
                className="text-xs text-muted underline hover:text-text"
              >
                Mark all read
              </button>
            )}
          </div>
          {!data?.items.length ? (
            <p className="px-2 py-4 text-center text-sm text-muted">Nothing new.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {data.items.map((n) => {
                const Icon = icon[n.type] ?? Bell;
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => activate(n)}
                      className={`flex w-full items-start gap-2 rounded px-2 py-2 text-left text-sm hover:bg-surface-2 ${
                        n.read ? "text-muted" : ""
                      }`}
                    >
                      <Icon size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block">{n.title}</span>
                        <span className="tnum text-xs text-muted">{when(n.createdAt)}</span>
                      </span>
                      {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
