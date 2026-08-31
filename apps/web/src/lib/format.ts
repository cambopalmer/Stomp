import type { Priority } from "@stomp/shared";

const dtf = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const tf = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

export const fmtDate = (ms: number) => dtf.format(ms);
export const fmtTime = (ms: number) => tf.format(ms);
export const fmtDateTime = (ms: number) => `${dtf.format(ms)}, ${tf.format(ms)}`;

export function relativeDay(ms: number): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((ms - today.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff < 0) return `${-diff}d overdue`;
  if (diff < 7) return `In ${diff}d`;
  return fmtDate(ms);
}

// Priority colours are deliberately independent of the brand accent (MASTER O2).
export const priorityMeta: Record<Priority, { label: string; className: string }> = {
  none: { label: "None", className: "text-muted" },
  low: { label: "Low", className: "text-[#0284c7] dark:text-[#38bdf8]" },
  medium: { label: "Medium", className: "text-[#b45309] dark:text-[#fbbf24]" },
  high: { label: "High", className: "text-[#c2410c] dark:text-[#fb923c]" },
  urgent: { label: "Urgent", className: "text-[#dc2626] dark:text-[#f87171]" },
};

/** local YYYY-MM-DD -> epoch ms at local midnight */
export const dateInputToMs = (v: string) => (v ? new Date(`${v}T00:00:00`).getTime() : null);
export const msToDateInput = (ms: number | null | undefined) =>
  ms ? new Date(ms).toISOString().slice(0, 10) : "";
