import { Link } from "react-router-dom";
import { Card } from "../components/ui.js";

export function Signup() {
  return (
    <div className="mx-auto max-w-md">
      <Card>
        <h1 className="text-xl font-bold">Create an account</h1>
        <p className="mt-2 text-sm text-muted">
          Accounts and sign-in arrive in <strong>Phase 3</strong>. For now STOMP runs as a single
          seeded user. The data model already supports multiple users, workspaces, and sharing — see
          the plan in <code>planning/</code>.
        </p>
        <Link to="/" className="mt-4 inline-block text-sm text-primary underline">
          ← Back to the hub
        </Link>
      </Card>
    </div>
  );
}
