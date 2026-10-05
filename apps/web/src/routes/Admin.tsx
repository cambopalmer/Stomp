import type { AdminUser } from "@stomp/shared";
import { useState } from "react";
import { Badge, Button, EmptyState, ErrorState, Input, Select, Spinner } from "../components/ui.js";
import { useAuth } from "../lib/auth.js";
import { fmtDate } from "../lib/format.js";
import {
  useAdminDeleteUser,
  useAdminResetPassword,
  useAdminUpdateUser,
  useAdminUsers,
} from "../lib/queries.js";

/**
 * User management. Account metadata only — an admin never sees anyone's items
 * (the API has no route for that), so this page can't leak private data.
 */
export function Admin() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const list = useAdminUsers(isAdmin);

  if (!isAdmin) {
    return <EmptyState title="Admins only">Ask an admin if you need an account changed.</EmptyState>;
  }
  if (list.isLoading) return <Spinner />;
  if (list.isError) return <ErrorState error={list.error} retry={list.refetch} />;

  const all = list.data ?? [];
  const live = all.filter((u) => u.deletedAt == null);
  const deleted = all.filter((u) => u.deletedAt != null);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">Users</h1>
        <p className="mt-1 text-sm text-muted">
          Manage accounts on this hub. Admins can change roles, disable sign-in, set a new password, or
          delete an account — they can’t see anyone’s todos, events or references.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="whitespace-nowrap bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-semibold">User</th>
              <th scope="col" className="px-3 py-2 font-semibold">Role</th>
              <th scope="col" className="px-3 py-2 font-semibold">Status</th>
              <th scope="col" className="px-3 py-2 font-semibold">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {live.map((u) => (
              <UserRow key={u.id} u={u} isMe={u.id === user.id} />
            ))}
          </tbody>
        </table>
      </div>

      {deleted.length > 0 && (
        <details className="text-sm text-muted">
          <summary className="cursor-pointer">Deleted accounts ({deleted.length})</summary>
          <p className="mt-1">
            Kept as “Deleted user” so items they shared still have an author. No email, password or
            sign-in remains.
          </p>
          <ul className="mt-1 list-disc pl-5">
            {deleted.map((u) => (
              <li key={u.id} className="tnum">
                deleted {fmtDate(u.deletedAt!)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

type Panel = null | "password" | "delete";

function UserRow({ u, isMe }: { u: AdminUser; isMe: boolean }) {
  const update = useAdminUpdateUser();
  const reset = useAdminResetPassword();
  const del = useAdminDeleteUser();
  const [panel, setPanel] = useState<Panel>(null);
  const [password, setPassword] = useState("");
  const [done, setDone] = useState<string | null>(null);

  const error = update.error ?? reset.error ?? del.error;
  const disabled = u.disabledAt != null;

  return (
    <>
      <tr className="border-t border-border align-middle" data-testid={`user-${u.email}`}>
        <td className="px-3 py-2">
          <div className="font-medium">
            {u.displayName}
            {isMe && <span className="ml-1 text-xs font-normal text-muted">(you)</span>}
          </div>
          <div className="text-xs text-muted">{u.email}</div>
          <div className="tnum text-xs text-muted">
            Last sign-in {u.lastLoginAt ? fmtDate(u.lastLoginAt) : "never"}
          </div>
        </td>
        <td className="px-3 py-2">
          <Select
            aria-label={`Role for ${u.email}`}
            value={u.role}
            disabled={update.isPending}
            onChange={(e) =>
              update.mutate({ id: u.id, role: e.target.value as AdminUser["role"] }, { onSuccess: () => setDone(null) })
            }
            className="w-28"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </Select>
        </td>
        <td className="px-3 py-2">
          {disabled ? (
            <Badge className="border-danger/40 text-danger">Disabled</Badge>
          ) : (
            <Badge>Active</Badge>
          )}
        </td>
        <td className="px-3 py-2">
          <div className="flex justify-end gap-1.5 whitespace-nowrap">
            <Button
              variant="ghost"
              className="px-2 py-1 text-xs"
              disabled={isMe || update.isPending}
              title={isMe ? "You can't disable yourself" : undefined}
              onClick={() => update.mutate({ id: u.id, disabled: !disabled })}
            >
              {disabled ? "Enable" : "Disable"}
            </Button>
            <Button
              variant="ghost"
              className="px-2 py-1 text-xs"
              aria-expanded={panel === "password"}
              onClick={() => setPanel(panel === "password" ? null : "password")}
            >
              Set password
            </Button>
            <Button
              variant="danger"
              className="px-2 py-1 text-xs"
              disabled={isMe}
              title={isMe ? "You can't delete yourself here" : undefined}
              aria-expanded={panel === "delete"}
              onClick={() => setPanel(panel === "delete" ? null : "delete")}
            >
              Delete
            </Button>
          </div>
        </td>
      </tr>

      {(panel || error || done) && (
        <tr className="bg-surface-2/40">
          <td colSpan={4} className="px-3 py-2">
            {error && (
              <p role="alert" className="mb-2 text-sm text-danger">
                {error instanceof Error ? error.message : "Something went wrong"}
              </p>
            )}
            {done && (
              <p role="status" className="mb-2 text-sm text-success">
                {done}
              </p>
            )}

            {panel === "password" && (
              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  reset.mutate(
                    { id: u.id, password },
                    {
                      onSuccess: () => {
                        setPassword("");
                        setPanel(null);
                        setDone(`New password set for ${u.email}. Their other sessions were signed out.`);
                      },
                    },
                  );
                }}
              >
                <label className="flex flex-col gap-1 text-xs font-medium">
                  New password for {u.email}
                  <Input
                    type="text"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-64"
                  />
                </label>
                <Button type="submit" disabled={reset.isPending || password.length < 8}>
                  Save password
                </Button>
                <span className="text-xs text-muted">8+ characters. Hand it over yourself — no email is sent.</span>
              </form>
            )}

            {panel === "delete" && (
              <div className="flex flex-col gap-2 text-sm">
                <p>
                  <strong>Delete {u.displayName}?</strong> Their private items are deleted. Anything shared
                  with others stays, shown as “Deleted user”. They’re signed out and can’t sign in again.
                  This can’t be undone.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="danger"
                    disabled={del.isPending}
                    onClick={() => del.mutate(u.id, { onSuccess: () => setPanel(null) })}
                  >
                    Delete account
                  </Button>
                  <Button variant="ghost" onClick={() => setPanel(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
