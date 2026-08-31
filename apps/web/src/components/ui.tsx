import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "accent" | "ghost" | "danger" }) {
  const styles = {
    primary: "bg-primary text-primary-fg hover:opacity-90",
    accent: "bg-accent text-accent-fg hover:opacity-90",
    ghost: "bg-transparent text-text hover:bg-surface-2 border border-border",
    danger: "bg-transparent text-danger hover:bg-danger/10 border border-danger/40",
  }[variant];
  return (
    <button
      className={cx(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer",
        styles,
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cx("rounded-lg border border-border bg-surface p-4", className)}>{children}</div>
  );
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs font-medium",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${htmlFor}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

const inputCls =
  "rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-muted";

export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => (
  <input {...p} className={cx(inputCls, p.className)} />
);
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...p} className={cx(inputCls, "min-h-[80px]", p.className)} />
);
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...p} className={cx(inputCls, p.className)} />
);

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted">
      <p className="font-medium text-text">{title}</p>
      {children && <div className="mt-1">{children}</div>}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="p-8 text-center text-sm text-muted" role="status">
      Loading…
    </div>
  );
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const message = error instanceof Error ? error.message : "Something went wrong";
  return (
    <div
      role="alert"
      className="rounded-lg border border-danger/40 bg-danger/5 p-4 text-sm text-danger"
    >
      <p className="font-medium">Couldn’t load this</p>
      <p className="mt-0.5 text-danger/80">{message}</p>
      {retry && (
        <button onClick={retry} className="mt-2 underline">
          Try again
        </button>
      )}
    </div>
  );
}

/** Loading / error / empty gate for a react-query result. */
export function QueryBoundary<T>({
  query,
  children,
  empty,
}: {
  query: { data: T | undefined; isLoading: boolean; isError: boolean; error: unknown; refetch: () => void };
  children: (data: T) => ReactNode;
  empty?: () => ReactNode;
}) {
  if (query.isLoading) return <Spinner />;
  if (query.isError) return <ErrorState error={query.error} retry={query.refetch} />;
  const data = query.data;
  if (data == null || (Array.isArray(data) && data.length === 0)) {
    return empty ? <>{empty()}</> : <EmptyState title="Nothing here yet" />;
  }
  return <>{children(data)}</>;
}
