import { Copy, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import { addDaysIso, fmtDayTitle } from "../../lib/planner.js";
import { useCopyDay } from "../../lib/queries.js";
import { Button, Input } from "../ui.js";

/**
 * Copy another day's plan onto this one — for routines ("make today like last
 * Tuesday"), not roll-over (ADR-0006). Defaults to the same weekday last week.
 */
export function CopyDay({ date, onClose }: { date: string; onClose: () => void }) {
  const [from, setFrom] = useState(addDaysIso(date, -7));
  const copy = useCopyDay();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    copy.mutate({ date, fromDate: from });
  };

  return (
    <form
      onSubmit={submit}
      aria-label="Copy a day"
      className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface p-3"
    >
      <label className="flex flex-col gap-1 text-sm font-medium">
        Copy the plan from
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} required max="2100-12-31" />
      </label>
      <Button type="submit" disabled={copy.isPending || !from || from === date}>
        <Copy size={15} aria-hidden="true" /> Copy here
      </Button>
      <Button type="button" variant="ghost" onClick={onClose} aria-label="Close copy">
        <X size={15} aria-hidden="true" />
      </Button>
      <p aria-live="polite" className="basis-full text-xs text-muted">
        {copy.isSuccess
          ? copy.data.copied
            ? `Copied ${copy.data.copied} block${copy.data.copied === 1 ? "" : "s"} from ${fmtDayTitle(from)}.`
            : `Nothing was planned on ${fmtDayTitle(from)}.`
          : copy.isError
            ? copy.error instanceof Error
              ? copy.error.message
              : "Couldn’t copy"
            : "Blocks arrive as planned; done todos and event attachments aren’t carried over."}
      </p>
    </form>
  );
}
