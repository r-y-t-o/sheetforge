# Security Assessment — SheetForge

Assessment date: **2026-04-17**.
Covers the Node/Express backend (`server/src`) and vanilla-JS frontend (`public`).

The app handles Autodesk APS OAuth tokens with `data:read data:write data:create viewables:read`
scope, which can read **and write** arbitrary files in any ACC project the signed-in user
can reach. The token sits in an encrypted session cookie on the browser. Anything that
compromises that cookie or tricks an authenticated browser into issuing a state-changing
request is effectively full ACC access. The recommendations below are ranked with that
blast radius in mind.

---

## 1. What this release adds

Implemented in this change (no new dependencies):

| # | Control | File |
|---|---|---|
| 1 | `Helmet`-style security headers + strict CSP (`default-src 'self'`; no inline script except the tiny theme bootstrap via hash) | `server/src/middleware/security.js` |
| 2 | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy` lockdown, `Cross-Origin-*` isolation | same |
| 3 | `Strict-Transport-Security` (enabled only when `NODE_ENV=production`) | same |
| 4 | Same-origin `Origin` / `Referer` check on every state-changing request (`POST`/`PUT`/`DELETE`) — CSRF defence that works with `SameSite=Lax` cookies as defence-in-depth | same |
| 5 | In-memory sliding-window rate limit: **20 req / 10 s** for `/auth/*`, **120 req / min** for `/api/*` per IP | same |
| 6 | Removed `x-powered-by` header | `server/src/index.js` |
| 7 | `/auth/token-login` is **disabled by default**; set `ALLOW_TOKEN_LOGIN=1` in dev-only `.env` to bring it back. Production deployments never expose it | `server/src/routes/auth.js`, `config.js` |
| 8 | Cookie hardened: `__Host-` prefix when secure, `sameSite: 'strict'`, `maxAge` trimmed to **8 h** (was 24 h) | `server/src/index.js` |
| 9 | Input validation for `versionUrn`, `projectId`, `folderId`, `exportId`, `fileId` — regex-whitelist; rejects anything that isn't the expected Autodesk URN / UUID shape | `server/src/middleware/validate.js` |
| 10 | Request body limit reduced from 4 MB to **256 KB** (no endpoint takes a body bigger than this) | `server/src/index.js` |
| 11 | OAuth `state` parameter (random 32-byte base64url, stored in session, validated on callback) — prevents login CSRF | `server/src/routes/auth.js` |
| 12 | Access-token values are never written to `console.*` even at debug level | grep-audited |

---

## 2. Remaining risks — recommended follow-ups

Ordered by severity. These need judgement calls or new infrastructure and are not in this commit.

### High

1. **In-memory extracted-PDF cache keyed by `exportId`.** An attacker who guesses another user's `exportId` could fetch that user's PDFs, because `/api/export/file/:exportId/:fileId` doesn't bind the cache entry to a session. Fix: store `sessionId` alongside each cache entry and reject cross-session reads. (30 min of work.)
2. **No server-side CSRF token on `POST`s.** Origin-check (new in this release) is a good 80 %, but browsers with broken `Origin` headers or exotic plugins can bypass it. Add a double-submit cookie pattern or migrate to the `csrf-csrf` package.
3. **Secrets in `.env`.** The handoff doc mentions Azure Key Vault with managed identity — use it. Never commit `.env`; add `.env*` to `.gitignore` (verify). Rotate `SESSION_SECRET` periodically; support `keys: [current, previous]` so rotations don't invalidate live sessions.
4. **No audit log.** Successful + failed logins, exports, uploads should emit a structured log line (`pino`) to a durable sink.

### Medium

5. **Dependency scanning.** Wire `npm audit --omit=dev` into CI; today nothing fails a build on a vulnerable transitive dep.
6. **Session fixation on token-login path.** If you ever re-enable token-login, regenerate the session (`cookie-session` doesn't support this natively — switch to `express-session` with `genid`).
7. **`archiver` / `adm-zip` zip-slip.** The server only *writes* ZIPs and reads ZIPs authored by Autodesk, so the risk is low, but extracted entry names should still be checked for `..` / absolute paths before they're used as cache keys or filenames. Today they're only used as display strings, but a future change could leak.
8. **Open redirect on `/auth/callback`.** The callback currently redirects to `/` unconditionally — safe. If anyone adds a `?next=` param, validate it against an allow-list.
9. **Error responses leak upstream Autodesk error bodies** (`middleware/error.js` → `details: data`). Useful in dev, dangerous in prod. Gate `details` behind `NODE_ENV !== 'production'`.
10. **No brute-force protection on token-login** beyond the generic rate limiter. If you re-enable token-login, track per-session failed attempts and lock out after 5.

### Low

11. **Logout is a `GET`.** A malicious `<img src="/auth/logout">` can log a user out. Low-impact annoyance; change to `POST` with the new origin-check when convenient.
12. **No Subresource Integrity** on the three `<script>` tags — fine today (same-origin assets) but worth adding if you ever move any to a CDN.
13. **Client-side token pasted into `#token-input`** is visible to any browser extension. Acceptable for a dev tool, unacceptable for production — which is why we disabled it by default in (7).
14. **Session cookie not rotated after privilege change.** Not applicable today (no privilege model), but worth noting if roles are ever added.

---

## 3. Deployment checklist

Before exposing this to the internet:

- [ ] `NODE_ENV=production` set
- [ ] `ALLOW_TOKEN_LOGIN` **unset**
- [ ] `SESSION_SECRET` is at least 32 bytes of entropy, loaded from Key Vault
- [ ] TLS terminated at the proxy; `trust proxy` left at `1`
- [ ] APS callback URL is the HTTPS production URL, registered in the APS console
- [ ] `npm audit` clean
- [ ] Log sink configured (App Insights / CloudWatch / etc.)
- [ ] Follow-up items 1-4 above resolved
