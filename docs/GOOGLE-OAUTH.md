# Google OAuth setup

Google sign-in is **optional**. Until `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are
set, the `googleOAuth` plugin is a no-op, `/api/auth/google*` routes are not registered,
and the web UI hides the "Continue with Google" button. Email/password auth works
regardless.

This is a one-time setup in the Google Cloud Console by the project owner.

## 1. Create a Google Cloud project

1. Go to <https://console.cloud.google.com/>.
2. Top bar → project picker → **New Project**. Name it e.g. `stomp`. Create, then select it.

## 2. Set up the app in Google Auth Platform

> Google reorganised this area in 2025: the old "OAuth consent screen" wizard is now
> **Google Auth Platform**, split into *Branding*, *Audience*, *Data Access* and
> *Clients* pages. Labels below are as of 2026-10; Google renames things often.

1. **APIs & Services → OAuth consent screen** — this now opens **Google Auth Platform**.
   Click **Get started**.
2. App information: name `STOMP`, support email = yours.
3. Audience: **External**. (*Internal* only exists for Google Workspace orgs, not
   personal Gmail.)
4. Contact email = yours → agree → **Create**.
5. **Audience → Test users**: add every Google account that should be able to sign in
   (yours + anyone you share STOMP with). Leave publishing status on **Testing** for
   sign-in — see §7 before Phase 4.
6. Scopes: nothing to add for sign-in. `openid`, `email` and `profile` are
   non-sensitive and requested at runtime (`scope: ["openid", "email", "profile"]` in
   `apps/api/src/plugins/googleOAuth.ts`).

## 3. Create OAuth client credentials

1. **Google Auth Platform → Clients → Create client**.
2. Application type: **Web application**. Name: `stomp-dev` (one client per environment
   is fine, or one client with several redirect URIs).
3. **Authorized redirect URIs** — **two per environment**: sign-in (`/api/auth/google/callback`)
   and connecting Gmail / Calendar (`/api/integrations/google/callback`, Phase 4). The origin
   must equal `PUBLIC_BASE_URL` (see §5):

   | Environment | Redirect URIs |
   |---|---|
   | Local dev (Vite proxies `/api`) | `http://localhost:5173/api/auth/google/callback`<br>`http://localhost:5173/api/integrations/google/callback` |
   | Docker compose / nginx | `http://localhost:8080/api/auth/google/callback`<br>`http://localhost:8080/api/integrations/google/callback` |
   | Production | `https://stomp.example.com/api/auth/google/callback`<br>`https://stomp.example.com/api/integrations/google/callback` |

   "Authorized JavaScript origins" is **not** required — the flow is a server-side
   redirect, not a JS SDK.
4. **Create**, then copy the **Client ID** and **Client secret** straight away — newer
   consoles may only show the secret once (you can always add a new secret later).

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
- A brand-new Google account is a **member**, not an admin (only the first account on an
  install is admin). Promote it from **Manage users** (`/admin`) while signed in as an admin.

## 7. Before Phase 4 (Gmail / Calendar)

Sign-in only needs the steps above. The Phase 4 integrations add more:

- **Enable the APIs**: *APIs & Services → Library* → **Gmail API** and **Google Calendar API**.
- **Encryption key**: set `INTEGRATION_ENC_KEY` (32 random bytes, base64 — the command is in
  `.env.example`). Integrations stay off until it's set; losing it means everyone reconnects.
- **Scopes** (*Data Access* → *Manually add scopes*, full URLs):
  `https://www.googleapis.com/auth/gmail.readonly` and
  `https://www.googleapis.com/auth/calendar.readonly`. `gmail.readonly` is a **restricted** scope and
  `calendar.readonly` is **sensitive**. They're requested at connect time from Settings,
  separately from sign-in.
- **Testing mode expires refresh tokens after 7 days** for these scopes, which would
  break background sync weekly. For a private hub the usual fix is **Audience → Publish
  app** to *In production* **without** submitting for verification: users see a
  "Google hasn't verified this app" warning when connecting, and the app is capped at
  100 users. Full verification (and a security assessment for restricted scopes) is
  only needed beyond that.
- Publishing doesn't open STOMP to strangers: sign-up is still gated by `ALLOW_SIGNUP`,
  and an admin can disable accounts.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `redirect_uri_mismatch` | The URI in §3 doesn't byte-match `${PUBLIC_BASE_URL}/api/auth/google/callback`. Check scheme/host/port and trailing slash. |
| `403: access_denied` | Your email isn't in the consent screen's **Test users** list (Testing mode). |
| Button doesn't appear | `GOOGLE_CLIENT_ID`/`SECRET` not loaded — restart the API, confirm `/api/auth/me` → `googleEnabled: true`. |
| Lands on `:8080` and hangs in dev | `PUBLIC_BASE_URL` still at the default; set it to `http://localhost:5173`. |
| `400: Google sign-in failed` | The userinfo fetch failed — usually a clock skew or a revoked client secret. |
