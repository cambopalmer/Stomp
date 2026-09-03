import { zodResolver } from "@hookform/resolvers/zod";
import { credentials, signupInput } from "@stomp/shared";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useLocation } from "react-router-dom";
import type { z } from "zod";
import { Button, Card, Field, Input } from "../components/ui.js";
import { useAuth } from "../lib/auth.js";

export function Login({ mode }: { mode: "login" | "signup" }) {
  const auth = useAuth();
  const loc = useLocation();
  const [err, setErr] = useState<string | null>(null);

  if (auth.user) return <Navigate to="/" replace />;

  return (
    <div className="mx-auto mt-16 max-w-sm">
      <h1 className="mb-1 text-center text-2xl font-bold tracking-tight">STOMP</h1>
      <p className="mb-6 text-center text-sm text-muted">
        {mode === "login" ? "Sign in to your hub" : "Create your hub"}
      </p>

      <Card>
        {mode === "login" ? (
          <LoginForm onError={setErr} />
        ) : (
          <SignupForm onError={setErr} disabled={!auth.signupOpen} />
        )}

        {err && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {err}
          </p>
        )}

        {auth.googleEnabled && (
          <>
            <div className="my-4 flex items-center gap-3 text-xs text-muted">
              <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
            </div>
            <a
              href="/api/auth/google"
              className="flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-surface-2"
            >
              Continue with Google
            </a>
          </>
        )}
      </Card>

      <p className="mt-4 text-center text-sm text-muted">
        {mode === "login" ? (
          <>
            No account?{" "}
            <Link to="/signup" state={loc.state} className="text-primary underline">
              Sign up
            </Link>
          </>
        ) : (
          <>
            Have an account?{" "}
            <Link to="/login" className="text-primary underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

function LoginForm({ onError }: { onError: (m: string | null) => void }) {
  type V = z.infer<typeof credentials>;
  const auth = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<V>({ resolver: zodResolver(credentials) });

  return (
    <form
      onSubmit={handleSubmit(async (v) => {
        onError(null);
        try {
          await auth.login(v);
        } catch (e) {
          onError((e as Error).message);
        }
      })}
      className="flex flex-col gap-3"
    >
      <Field label="Email" htmlFor="l-email" error={errors.email?.message}>
        <Input id="l-email" type="email" autoComplete="email" autoFocus {...register("email")} />
      </Field>
      <Field label="Password" htmlFor="l-pw" error={errors.password?.message}>
        <Input id="l-pw" type="password" autoComplete="current-password" {...register("password")} />
      </Field>
      <Button type="submit" disabled={isSubmitting} className="mt-1 justify-center">
        Sign in
      </Button>
    </form>
  );
}

function SignupForm({
  onError,
  disabled,
}: {
  onError: (m: string | null) => void;
  disabled: boolean;
}) {
  type V = z.infer<typeof signupInput>;
  const auth = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<V>({ resolver: zodResolver(signupInput) });

  if (disabled) {
    return (
      <p className="text-sm text-muted">
        Sign-ups are closed. Ask an existing member to add you to a workspace, then sign in.
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(async (v) => {
        onError(null);
        try {
          await auth.signup(v);
        } catch (e) {
          onError((e as Error).message);
        }
      })}
      className="flex flex-col gap-3"
    >
      <Field label="Name" htmlFor="s-name" error={errors.displayName?.message}>
        <Input id="s-name" autoComplete="name" autoFocus {...register("displayName")} />
      </Field>
      <Field label="Email" htmlFor="s-email" error={errors.email?.message}>
        <Input id="s-email" type="email" autoComplete="email" {...register("email")} />
      </Field>
      <Field label="Password" htmlFor="s-pw" error={errors.password?.message} hint="8+ characters">
        <Input id="s-pw" type="password" autoComplete="new-password" {...register("password")} />
      </Field>
      <Button type="submit" disabled={isSubmitting} className="mt-1 justify-center">
        Create account
      </Button>
    </form>
  );
}
