# Owner admin authentication

The admin is a single-owner tool. Credentials belong in server environment settings, never in public content, browser-prefixed variables or GitHub source files. Every protected API handler must call `assertAdminRequest`; hiding the admin navigation is not access control.

## Create credentials

Run this in an interactive terminal:

```sh
node scripts/admin-setup.mjs
```

The command masks password entry, requires confirmation, hashes it with a fresh random salt and generates a separate random session secret. It displays the server settings for copying into Vercel. The original password is not printed or stored. Use a unique password of 12–256 characters and keep it in your password manager.

For local development, this explicit option writes only the two admin settings to the ignored `.env.local` file, preserves other settings and restricts its file permissions:

```sh
node scripts/admin-setup.mjs --write-local
```

Restart the local server after changing environment settings. This command does not configure Vercel. Copying the generated credentials to production is a separate owner action.

| Server variable | Required value |
| --- | --- |
| `ADMIN_PASSWORD_HASH` | Generated `scrypt$131072$8$1$<salt>$<digest>` value. |
| `ADMIN_SESSION_SECRET` | Generated base64url session secret containing at least 32 random bytes. |
| `UPSTASH_REDIS_REST_URL` | Required in production: HTTPS REST endpoint for shared login limits. |
| `UPSTASH_REDIS_REST_TOKEN` | Required in production: server-only, write-capable Redis REST token. |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Complete Vercel Upstash integration alternative when neither explicit `UPSTASH_REDIS_REST_*` variable is defined. Blank, partial, or invalid explicit settings fail closed rather than falling back. |
| `CHAT_TRUSTED_PROXY` | Use `vercel` only on the Vercel deployment; otherwise retain `none` or configure a genuinely trusted proxy as described in [chat-operations.md](chat-operations.md). |

Paste the hash into Vercel as its literal value, without shell quotes or backslash escapes. For local dotenv files, dollar signs need escaping because Next.js performs variable expansion. The setup command handles this and supplies an escaped local-file example. Do not replace existing OpenAI, contact or other settings when adding these values.

## Sessions and login protection

Passwords use Node's built-in scrypt with `N=131072`, `r=8`, `p=1`, a 16-byte random salt and a 32-byte derived digest. The server compares digests in constant time. At most two password checks run concurrently in each process, limiting the approximately 128 MiB working allocation per check. Passwords and credential values are not logged or returned by the API.

Successful sign-in issues a signed, random-nonce session lasting two hours. Production uses the `__Host-portfolio-admin` cookie with `Secure`, `HttpOnly`, `SameSite=Strict` and `Path=/`, and requires HTTPS. Development uses a separate non-secure cookie for localhost. Session signatures are bound to both the password hash and the session secret. Rotating either credential invalidates existing sessions after the deployment/restart receives the new values.

Logout clears the browser cookie. Sessions are stateless; logout does not revoke a copied token on another device. Rotate either server credential to invalidate all tokens before their two-hour expiry.

Production login always uses shared Redis admission controls in a separate `portfolio-admin-login` namespace: five admitted attempts per client bucket in 60 seconds and 100 globally per UTC day. Successful, failed and malformed admitted attempts count. A chat memory-mode override cannot disable production admin protection. Missing settings or backend failures refuse sign-in; there is no fallback to per-process memory in public production. Local development uses bounded process memory, which resets on restart.

These limits reuse the atomic Redis operation and proxy trust rules in [chat-operations.md](chat-operations.md). Without explicit proxy trust, visitors share an anonymous client bucket. The global limit can also prevent owner sign-in after exhaustion; configure host-level abuse controls and monitor service availability. Existing valid sessions do not make a new Redis lookup on each authenticated read, but the required protection settings must remain configured.

All mutations require an exact same-origin `Origin` and reject cross-site/sibling-site fetch metadata. The expected origin uses the request URL's HTTP/HTTPS scheme and the validated `Host` authority, because Next.js development can place its internal `localhost` hostname in the URL while the browser uses `127.0.0.1`. Missing Host falls back to the request URL. Malformed or multi-value authorities are rejected; forwarded host/protocol headers never expand the accepted origin. Vercel documents `Host` as the domain accessed by the client. A custom reverse proxy must preserve the actual host and correctly construct the request's scheme; arbitrary forwarded headers are not authentication. Sign-in bodies are bounded to 4 KiB, passwords to 256 characters, and body reading to five seconds. Every session response uses private/no-store caching and a noindex response header.

## Before configuration

Until the admin is configured, `/admin` and every `/api/admin/*` route answer 404. Configured means a valid `ADMIN_PASSWORD_HASH`, a valid `ADMIN_SESSION_SECRET` and, in production, a valid shared Redis pair. Each API route is wrapped by `whenAdminConfigured` from `app/api/admin/_lib/when-configured.js`. It returns an empty 404 with `Cache-Control: private, no-store` and `X-Robots-Tag: noindex, nofollow`, and it checks the settings on every request, so a later configuration change takes effect without a cached 404. The `/admin` page calls `notFound()` and returns empty metadata in that state, so the response is the site's normal 404 page and does not name the admin. Once configured, the wrapped handlers run unchanged. Wrap any new `/api/admin/*` handler the same way.

## API integration

- `GET /api/admin/session` returns only `{ authenticated, configured }`. Because the route answers 404 before configuration, a response from it always has `configured: true`.
- `POST /api/admin/session` accepts `{ password }`, checks origin and shared admission before password work, then issues the HttpOnly cookie.
- `DELETE /api/admin/session` checks origin and expires the cookie.
- Server routes import `assertAdminRequest(request, { mutation: true })` for writes, or omit `mutation` for authenticated reads. It returns `true` or throws `AdminAuthError` with a safe `status`, `code` and `message`.
- `adminSession(request)` returns a boolean. `getAdminConfiguration()` exposes configuration booleans only. Neither helper returns credentials.
- `requestOrigin(request)` derives the validated HTTP/HTTPS request origin; `assertSameOrigin(request)` applies the mutation check for other same-origin endpoints, including contact archiving.

The test suite covers valid/wrong credentials, shared throttling, expiry, tampering, duplicate cookies, credential rotation, origin rejection, missing configuration, bounded body handling and concurrent password checks. Redis HTTP transport is mocked; live service permissions still require deployment acceptance testing.

Primary references: [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [Next.js environment-variable expansion](https://nextjs.org/docs/app/guides/environment-variables#referencing-other-variables), and [Vercel request headers](https://vercel.com/docs/headers/request-headers).
