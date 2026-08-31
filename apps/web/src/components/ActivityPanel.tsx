import { useActivity } from "../lib/queries.js";

const verb: Record<string, string> = {
  created: "created",
  updated: "updated",
  deleted: "deleted",
  completed: "completed",
  shared: "shared",
  triaged: "triaged",
  synced: "synced",
};

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
function ago(ms: number) {
  const diff = ms - Date.now();
  const mins = Math.round(diff / 60_000);
  if (Math.abs(mins) < 60) return rtf.format(mins, "minute");
  const hrs = Math.round(mins / 60);
  if (Math.abs(hrs) < 24) return rtf.format(hrs, "hour");
  return rtf.format(Math.round(hrs / 24), "day");
}

export function ActivityPanel({ entityType, entityId }: { entityType: string; entityId: string }) {
  const activity = useActivity(entityType, entityId);
  if (!activity.data?.length) return null;

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Activity</h2>
      <ul className="flex flex-col gap-1 text-sm text-muted">
        {activity.data.map((a) => (
          <li key={a.id} className="flex justify-between gap-3">
            <span>
              {a.actor ?? "Someone"} {verb[a.action] ?? a.action} this
            </span>
            <span className="tnum shrink-0">{ago(a.createdAt)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
