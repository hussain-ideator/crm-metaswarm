# Research: JWT Authentication

**Date**: 2026-06-14 | **Feature**: JWT Auth | **Plan**: [plan.md](./plan.md)

---

## RES-001 — Token Family Tracking: Custom Model vs simplejwt Blacklist

**Decision**: Implement custom `RefreshTokenFamily` + `RefreshTokenLineage` models in `apps.accounts`, used alongside (not replacing) simplejwt's `token_blacklist` app.

**Rationale**: simplejwt's `token_blacklist` (already in `INSTALLED_APPS`) records blacklisted tokens by `jti` but has no concept of "family" — a lineage of tokens descended from a single login event. FR-006 requires detecting when a stale (already-rotated) token is reused and revoking the entire family. This requires associating each issued refresh token with its family at issuance time. simplejwt does not do this natively.

Custom models track:
- `RefreshTokenFamily`: one record per login; holds `user`, `created_at`, `is_revoked`
- `RefreshTokenLineage`: one record per issued refresh token, holds `jti`, `family`, `is_active`, `expires_at`

On refresh: look up `jti` in `RefreshTokenLineage`. If `is_active=False` → reuse detected → mark family `is_revoked=True`, deactivate all active lineage members → return 401. If `is_active=True` → rotate: mark old record inactive, issue new simplejwt token, create new lineage record in the same family.

The existing simplejwt `token_blacklist` is kept for its Django admin integration and as a defence-in-depth secondary guard; the custom lineage check runs first.

**Alternatives considered**:
1. Forking/monkey-patching simplejwt's `BlacklistedToken` to add a family FK — rejected: fragile with library upgrades
2. simplejwt blacklist only, no family tracking — rejected: cannot implement FR-006/FR-007 (reuse detection)
3. Redis-backed family store — rejected: no Redis in Phase 1 (constraint)

---

## RES-002 — Refresh Token in httpOnly Cookie: Custom Endpoint Pattern

**Decision**: Write fully custom `LoginView`, `RefreshView`, and `LogoutView` using adrf async views. Do NOT use simplejwt's default `/api/token/` and `/api/token/refresh/` endpoints.

**Rationale**: simplejwt's default endpoints read and write the refresh token in the request/response body. FR-002 requires the refresh token to be stored in a server-set `HttpOnly` cookie, never accessible to JavaScript. Custom views use simplejwt's `RefreshToken` and `AccessToken` classes to generate/validate tokens internally, then:
1. Read the refresh token from `request.COOKIES` (not `request.data`)
2. Set the refresh token as an httpOnly cookie via `response.set_cookie()`
3. Return only the access token in the response body

Cookie settings applied in `RefreshView` and `LoginView`:
```python
response.set_cookie(
    key='refresh_token',
    value=str(refresh),
    httponly=True,
    secure=not settings.DEBUG,          # False in dev (no HTTPS); True in prod
    samesite='Lax' if settings.DEBUG else 'Strict',
    max_age=7 * 24 * 60 * 60,           # 7 days in seconds
    path='/api/auth/refresh/',           # Scope cookie to the refresh endpoint only
)
```

**Alternatives considered**:
1. `dj-rest-auth` or `djangorestframework-simplejwt-cookie` — rejected: adds a dependency for a 3-endpoint feature; cookie handling is ~10 lines
2. Overriding simplejwt views — rejected: the customisation depth required makes a full override cleaner than patching

---

## RES-003 — Same-Origin Dev Proxy: next.config.ts Rewrites

**Decision**: Use `next.config.ts` `rewrites()` to proxy `/api/*` → backend URL in development. No separate `middleware.ts` / `proxy.ts` file is required for this purpose.

**Rationale**: ADR-009 notes "middleware.ts is now proxy.ts (Node runtime only, no edge runtime)" — this reflects the Next.js 16 change where the middleware runtime defaults to Node rather than the edge. For simple API proxying in development, Next.js `rewrites` in `next.config.ts` redirect requests server-side before they leave the Next.js server, making the backend appear same-origin to the browser. The browser then sends the httpOnly `refresh_token` cookie on requests to `/api/auth/refresh/` because from its perspective it is the same origin as the Next.js app.

In production, a reverse proxy (nginx / load balancer) provides the same same-origin routing. The `rewrites` config is gated to `process.env.NODE_ENV === 'development'` so it has no effect in production:

```ts
// next.config.ts (development only)
async rewrites() {
  return process.env.NODE_ENV === 'development'
    ? [{ source: '/api/:path*', destination: `${process.env.NEXT_PUBLIC_API_URL}/api/:path*` }]
    : [];
}
```

**Alternatives considered**:
1. Custom Next.js route handler at `app/api/[...path]/route.ts` that manually proxies — rejected: more boilerplate; rewrites accomplish the same thing in two lines
2. CORS with `SameSite=None` + `Secure` in dev — rejected explicitly by FR-013

---

## RES-004 — Next.js 16 Server-Side Auth Gate

**Decision**: Implement the auth gate as a Server Component `layout.tsx` inside a route group `(dashboard)`. Use `await cookies()` from `next/headers` to check for presence of the `refresh_token` httpOnly cookie; redirect unauthenticated users with `redirect()` from `next/navigation`.

**Rationale**: In Next.js 16 App Router, Server Components (including layouts) execute on the server and have access to request cookies via `await cookies()` from `next/headers`. Since the refresh cookie is `HttpOnly`, JavaScript cannot read it, but the Next.js server can. The auth gate logic:

```ts
// app/(dashboard)/layout.tsx
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({ children, params }) {
  const cookieStore = await cookies();
  const pathname = (await params).pathname ?? '/';
  if (!cookieStore.has('refresh_token')) {
    redirect(`/login?next=${encodeURIComponent(pathname)}`);
  }
  return <>{children}</>;
}
```

The access token lives in client memory only (FR-003) and is unavailable server-side, so cookie presence is the server-side session indicator. Full token validity is verified by the API server on every API call. If the cookie is present but the token is revoked, the first API call returns 401 and the client clears state and redirects to login.

The `/login` page sits outside the `(dashboard)` route group (under `(auth)/login/`), so it is never guarded. It checks for a valid cookie and redirects authenticated users to `/` (FR-017).

**Alternatives considered**:
1. JWT validation in layout using the access token — rejected: access token is in client memory only, not available server-side
2. A dedicated session cookie alongside the refresh cookie — rejected: unnecessary complexity for Phase 1
3. Full edge middleware — rejected for Phase 1: `next.config.ts` rewrites handle dev proxying; edge middleware adds complexity without benefit at this scale

---

## RES-005 — Concurrent Refresh Request Handling

**Decision**: Gate concurrent refresh calls on the client using a singleton Promise stored in a module-level variable in `src/lib/auth.ts`. All in-flight API calls that encounter a 401 wait for the single active refresh call to resolve before retrying with the new access token.

**Rationale**: When the 15-minute access token expires, multiple simultaneous requests may each receive a 401 and independently attempt to refresh. Because simplejwt's `ROTATE_REFRESH_TOKENS = True` and `BLACKLIST_AFTER_ROTATION = True` are enabled, only the first refresh call succeeds — the token is immediately rotated and the old one blacklisted. Any concurrent second refresh call with the same (now-stale) cookie would trigger reuse detection and revoke the entire family, logging the user out incorrectly.

Pattern in `src/lib/auth.ts`:
```ts
let refreshPromise: Promise<string> | null = null;

export async function getValidAccessToken(): Promise<string> {
  if (isExpired(accessToken)) {
    if (!refreshPromise) {
      refreshPromise = callRefreshEndpoint().finally(() => {
        refreshPromise = null;
      });
    }
    accessToken = await refreshPromise;
  }
  return accessToken;
}
```

All authenticated fetch calls go through the wrapper in `src/lib/api.ts`, which calls `getValidAccessToken()` before setting the `Authorization: Bearer` header. This collapses N concurrent refresh attempts into one.

**Alternatives considered**:
1. TanStack Query deduplication — not applicable: token refresh is not a Query-managed request
2. BroadcastChannel for cross-tab coordination — deferred to Phase 2; cross-tab logout (FR-007) is handled server-side by family revocation, which causes the next API call from any tab to return 401

---

## RES-006 — Revocation List Purge Strategy

**Decision**: Implement a Django management command `purge_expired_tokens` that hard-deletes expired `RefreshTokenLineage` records (and orphaned `RefreshTokenFamily` records). Run via operator-triggered cron or manually (FR-010).

**Rationale**: Expired tokens (where `expires_at < now()`) are by definition unusable — JWT expiry is checked before any database lookup — so deleting them is safe and changes no observable behaviour. The command deletes `RefreshTokenLineage` records where `expires_at < now()`, then deletes `RefreshTokenFamily` records with no remaining lineage rows. simplejwt's own `flushexpiredtokens` command handles the `token_blacklist` tables; both commands run together in the same scheduled job.

**Alternatives considered**:
1. MySQL 8 scheduled events — rejected: disabled by default in many hosted environments; management command is more portable
2. Celery periodic task — deferred to Phase 2 when Celery (tech-stack.md: "Phase 2+") is introduced
