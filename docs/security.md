# Security

## The central guarantee

**A user can never reach another user's records.**

One mechanism enforces it, at one layer:

1. `hooks.server.ts` resolves the session cookie into `event.locals.user`. This is
   the only place a user identity enters the application.
2. Every repository function takes `userId` as its first argument and puts it in
   the `WHERE` clause. There is no method that can read or write without one.
3. A `userId` arriving in a form body, a query string or a JSON payload is never
   read. Not once, anywhere.

Integration tests assert this directly: a second user is handed the first user's
record ids and every read, update and delete comes back empty.

## Authentication

Better Auth, email and password, Drizzle adapter.

| Property        | Setting                                           |
| --------------- | ------------------------------------------------- |
| Session storage | Database-backed, 30-day expiry, refreshed daily   |
| Cookie          | HTTP-only, `SameSite=Lax`, `Secure` in production |
| Cookie prefix   | `wealthscope`                                     |
| Password        | 12 characters minimum, no composition rules       |
| Hashing         | scrypt (Better Auth's default)                    |

Length beats character classes, and rules that fight a password manager make
things worse.

### Account enumeration

Sign-in and registration return one generic message for every failure:

- Sign-in: "That email and password do not match an account."
- Registration: "That account could not be created. If you already have one, sign
  in instead."

Neither distinguishes "no such account" from "wrong password", or "already
registered" from "invalid". The forms cannot be used to discover which addresses
hold accounts.

### Authorization errors

A record belonging to another user is reported as **404, not 403**. Telling an
attacker that an id exists but is not theirs is itself a leak.

## Route protection

Enforced on the server, before any load function runs:

```ts
const PROTECTED_PREFIXES = [
	'/dashboard',
	'/accounts',
	'/assets',
	'/investments',
	'/liabilities',
	'/cashflow',
	'/analyze',
	'/reports',
	'/import',
	'/settings',
	'/welcome',
	'/api/assets',
	'/api/prices',
	'/api/imports',
	'/api/exports'
];
```

Page requests redirect to `/login?redirectTo=…`; API requests get a 401 JSON body.
The `(app)` layout re-asserts the check with `requireUser()`, so a route added
under that group cannot become reachable by forgetting to update the prefix list.

`redirectTo` is filtered by `safeRedirect()`: only same-origin relative paths are
honoured, so the parameter cannot bounce a freshly authenticated visitor off-site.

Client-side guards are convenience. They are never the control.

## Input validation

Every mutation parses through a Zod schema on the server. The same schemas are
imported by the browser where it validates too, so there is one definition and no
drift.

Money fields accept what a user actually types — thousands separators, a currency
symbol, a Unicode minus — and normalise to an exact decimal string. They reject
non-numbers, out-of-range magnitudes and more decimal places than the column
stores.

The database enforces the same rules independently: CHECK constraints on every
enumeration, currency format, non-negativity and range.

## CSRF

SvelteKit's cross-origin form check is on (its default). Every mutation is a POST
to a form action or an endpoint on the same origin; no third-party origin can post
to one. Session cookies are `SameSite=Lax`, which blocks cross-site POSTs from
carrying credentials.

## Content Security Policy

Set on every response in `src/lib/server/security/headers.ts`:

```
default-src 'self'
script-src 'self' 'unsafe-inline'                 (plus 'unsafe-eval' in dev only)
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com
font-src https://fonts.gstatic.com
img-src 'self' data: blob:
connect-src 'self'
worker-src 'self' blob:
object-src 'none'
base-uri 'self'
form-action 'self'
frame-ancestors 'none'
upgrade-insecure-requests
```

`'unsafe-inline'` for scripts is required by SvelteKit's inline hydration payload,
and for styles by the design system's inline `style` attributes. `connect-src
'self'` means the application cannot exfiltrate to any third party even if a
dependency tried to.

Also set: `X-Content-Type-Options: nosniff`, `Referrer-Policy:
strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, a restrictive
`Permissions-Policy`, `Cross-Origin-Opener-Policy: same-origin`, and HSTS in
production.

## Caching

Every response to an authenticated request carries `cache-control: private,
no-store, max-age=0`. Personalised HTML never enters a shared cache.

## File upload

CSV uploads are checked before parsing:

- 5 MB maximum
- 20,000 rows maximum
- Extension or MIME type must look like CSV

The file is parsed in memory and discarded. Its contents are **never** written to
object storage and **never** logged. Only the file name, size and a SHA-256
content hash are recorded, so a repeat import can be flagged.

## CSV export

Cells beginning with `=`, `+`, `-`, `@`, tab or carriage return are executed as
formulas by Excel, Sheets and LibreOffice on open. `sanitiseCell()` prefixes them
with a single quote, which makes them inert while staying readable. Genuine
negative numbers are recognised and left alone, so `-1250.00` stays a number.

Fields containing commas, quotes or newlines are quoted and internal quotes
doubled.

## Logging

`src/lib/server/security/logging.ts` emits structured JSON lines. What is
recorded: the operation, the outcome, a status, a row count, a non-reversible
user reference and a correlation id.

What is never recorded: financial values, CSV row contents, email addresses,
session tokens, passwords.

Unexpected errors are logged with a correlation id and returned to the user as one
safe sentence plus that id. A raw driver message never reaches the browser — those
can carry table names, constraint text and occasionally row values.

## Rate limiting

Named policies in `src/lib/server/security/rate-limit.ts`:

| Policy          | Limit | Window |
| --------------- | ----- | ------ |
| `login`         | 8     | 5 min  |
| `register`      | 5     | 1 hour |
| `passwordReset` | 5     | 1 hour |
| `report`        | 20    | 1 hour |
| `import`        | 15    | 1 hour |
| `mutation`      | 240   | 1 min  |

**The default implementation is in-memory and therefore per-isolate.** In
Cloudflare Workers each isolate has its own memory, so this raises the cost of a
naive attack but is not a cluster-wide guarantee.

To make it one, implement the `RateLimiter` interface and register it once at
startup:

```ts
import { setRateLimiter } from '$lib/server/security/rate-limit';

setRateLimiter({
	async consume(key, limit, windowSeconds) {
		// Cloudflare Rate Limiting binding, a Durable Object, or KV
	}
});
```

No call site changes.

## Password reset

Scaffolded, not wired. No mail transport is configured, so the sign-in page says
so rather than pretending to send an email. To enable it:

1. Add an email provider (Cloudflare Email Routing, Resend, Postmark).
2. Set `emailAndPassword.sendResetPassword` in `src/lib/server/auth/index.ts`.
3. Add `/reset-password` routes consuming Better Auth's token endpoints.
4. Apply the existing `passwordReset` rate-limit policy.
5. Keep the response generic whether or not the address exists.

## Dependency posture

All runtime dependencies are MIT, Apache-2.0 or PostgreSQL-licensed. No GPL,
AGPL, SSPL, BSL, Elastic, Commons Clause or source-available packages. The
lockfile is committed.

No external service is called at runtime. The only cross-origin request any page
makes is the Archivo typeface from Google Fonts, which is why `font-src` and
`style-src` name those hosts and nothing else does.
