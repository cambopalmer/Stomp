# Google OAuth setup

Google sign-in is **optional**. Until `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are
set, the `googleOAuth` plugin is a no-op, `/api/auth/google*` routes are not registered,
and the web UI hides the "Continue with Google" button. Email/password auth works
regardless.

This is a one-time setup in the Google Cloud Console by the project owner.

## 1. Create a Google Cloud project

1. Go to <https://console.cloud.google.com/>.
2. Top bar → project picker → **New Project**. Name it e.g. `stomp`. Create, then select it.

## 2. Configure the OAuth consent screen

1. **APIs & Services → OAuth consent screen** (<https://console.cloud.google.com/apis/credentials/consent>).
2. User type: **External**. Create.
3. App information:
   - App name: `STOMP`
   - User support email: your email
   - Developer contact email: your email
4. Scopes: **Add or remove scopes** → tick `.../auth/userinfo.email`,
   `.../auth/userinfo.profile`, and `openid`. Update → Save and continue.
   (These match `scope: ["openid", "email", "profile"]` in
   `apps/api/src/plugins/googleOAuth.ts`.)
5. Test users: while the app is in "Testing" mode only these accounts can sign in.
   **Add** every email that needs access (yours + anyone you share STOMP with).
   Save and continue.
6. Leave publishing status as **Testing** for a private hub. (Do *not* click
   "Publish app" unless you want anyone with a Google account to be able to complete
   the flow — STOMP still gates on `ALLOW_SIGNUP`, but keep the surface small.)

## 3. Create OAuth client credentials

1. **APIs & Services → Credentials** → **Create Credentials → OAuth client ID**.
2. Application type: **Web application**. Name: `stomp-web`.
3. **Authorized redirect URIs** — add one per environment. The path is always
   `/api/auth/google/callback`; the origin must equal `PUBLIC_BASE_URL` (see §5):

   | Environment | Redirect URI |
   |---|---|
   | Local dev (Vite proxies `/api`) | `http://localhost:5173/api/auth/google/callback` |
   | Docker compose / nginx | `http://localhost:8080/api/auth/google/callback` |
   | Production | `https://stomp.example.com/api/auth/google/callback` |

   "Authorized JavaScript origins" is **not** required — the flow is a server-side
   redirect, not a JS SDK.
4. Create. Copy the **Client ID** and **Client secret**.

## 4. Add the secrets to your environment

In `.env` (never commit it — `.env` is git-ignored, `.env.example` is the template):

```dotenv
GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxxxxx
```

## 5. Make `PUBLIC_BASE_URL` match the redirect URI

The callback URL STOMP registers with Google is
`${PUBLIC_BASE_URL}/api/auth/google/callback`
(`apps/api/src/plugins/googleOAuth.ts`). It must **exactly** equal one of the
redirect URIs from §3 — scheme, host, and port.

| Scenario | `.env` |
|---|---|
| Local dev, testing Google end-to-end | `PUBLIC_BASE_URL=http://localhost:5173`<br>`WEB_ORIGIN=http://localhost:5173` |
| Docker compose | `PUBLIC_BASE_URL=http://localhost:8080` (the default) |
| Production | `PUBLIC_BASE_URL=https://stomp.example.com` |

`WEB_ORIGIN` is where the callback sends the browser after a successful sign-in
(`reply.redirect(config.WEB_ORIGIN + "/")`) and is also the CORS origin — point it
at the SPA.

> Local-dev note: `PUBLIC_BASE_URL` defaults to `http://localhost:8080` (the
> container origin). If you leave that default while running `pnpm dev`, the Google
> button will bounce you to `:8080`, which isn't listening. Set it to
> `http://localhost:5173` for dev.

## 6. Restart and test

```bash
# from the repo root, in two terminals (the combined `pnpm dev` hangs the API on Windows)
cd apps/api && pnpm dev
cd apps/web && pnpm dev
```

1. Open the web origin, go to **/login**. The **Continue with Google** button should
   now appear (`GET /api/auth/me` returns `googleEnabled: true`).
2. Click it → Google account chooser → consent → you land back on the hub, signed in.
3. Check `GET /api/auth/me` shows your user with `googleLinked: true`.

### Account linking

- First Google sign-in with an email that already has a password account **links**
  to that account (matched by verified email) and sets `google_id`.
- A brand-new email creates an account, subject to `ALLOW_SIGNUP` (the very first
  user in an empty DB is always allowed).
- Unverified Google emails are rejected (`email_verified === false`).

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `redirect_uri_mismatch` | The URI in §3 doesn't byte-match `${PUBLIC_BASE_URL}/api/auth/google/callback`. Check scheme/host/port and trailing slash. |
| `403: access_denied` | Your email isn't in the consent screen's **Test users** list (Testing mode). |
| Button doesn't appear | `GOOGLE_CLIENT_ID`/`SECRET` not loaded — restart the API, confirm `/api/auth/me` → `googleEnabled: true`. |
| Lands on `:8080` and hangs in dev | `PUBLIC_BASE_URL` still at the default; set it to `http://localhost:5173`. |
| `400: Google sign-in failed` | The userinfo fetch failed — usually a clock skew or a revoked client secret. |
