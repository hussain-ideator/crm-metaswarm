# Quickstart: JWT Authentication Validation

**Date**: 2026-06-14 | **Feature**: JWT Auth | **Plan**: [plan.md](./plan.md) | **Contracts**: [contracts/](./contracts/)

---

## Prerequisites

```sh
# Backend
cd backend
python manage.py migrate
python manage.py runserver          # http://localhost:8000

# Frontend (separate terminal)
cd frontend
npm run dev                         # http://localhost:3000
```

A test user must exist. Either:
```sh
# Option A: Django superuser
cd backend && python manage.py createsuperuser

# Option B: via factory (once test factories exist)
cd backend && python manage.py shell -c "
from apps.accounts.tests.factories import UserFactory
UserFactory(email='test@example.com', password='testpass123')
"
```

---

## Scenario 1 — Secure Login (User Story 1, FR-001–004)

1. Open a browser → navigate to `http://localhost:3000`
2. **Expected**: redirect to `http://localhost:3000/login` (auth gate fired)
3. Enter valid email and password → submit login form
4. **Expected**: redirect to dashboard at `/`; no further login prompt

**Verify in DevTools**:
- Network → `POST /api/auth/login/` → Response body: `{ "access": "eyJ..." }`
- Application → Cookies → `refresh_token` cookie present, `HttpOnly` flag set, not readable by JS

**Invalid credentials test**:
- Enter wrong password → **Expected**: same error message as entering an unknown email (no account enumeration, FR-004)

**Access token TTL**:
- Decode the access token at [jwt.io](https://jwt.io) → confirm `exp` is ~15 minutes from now

---

## Scenario 2 — Transparent Session Renewal (User Story 2, FR-005–006)

1. Log in to get a session
2. Open DevTools Network → filter by `/api/auth/refresh/`
3. Wait 15+ minutes (or simulate expiry: clear the in-memory `accessToken` by hard-refreshing the Next.js app without clearing cookies)
4. Perform any authenticated action (navigate to a list view, load dashboard data)
5. **Expected**: action succeeds; Network shows `POST /api/auth/refresh/` followed by the retried request — no login redirect

**Verify token rotation**:
- Network → `/api/auth/refresh/` response headers → `Set-Cookie: refresh_token=<new_value>...`
- The new cookie value differs from the one set at login (token was rotated, FR-005)

---

## Scenario 3 — Secure Logout (User Story 3, FR-011, SC-003)

1. Log in
2. Copy the `refresh_token` cookie value from DevTools (Application → Cookies → right-click → copy value)
3. Click logout in the UI
4. **Expected**: redirect to `/login`; `refresh_token` cookie cleared from DevTools

**Verify server-side revocation** (FR-009):
```sh
curl -s -X POST http://localhost:8000/api/auth/refresh/ \
  -H "Cookie: refresh_token=<COPIED_VALUE>" | python -m json.tool
```
**Expected**: `{ "detail": "Token is invalid or expired" }` (HTTP 401)

---

## Scenario 4 — Reuse Detection / Family Revocation (User Story 4, FR-006–007, SC-004)

1. Log in → note the `refresh_token` cookie value (Token A)
2. Wait for or force a token refresh → note the new `refresh_token` value (Token B); Token A is now stale
3. Attempt to use the stale Token A:
```sh
curl -s -X POST http://localhost:8000/api/auth/refresh/ \
  -H "Cookie: refresh_token=<TOKEN_A>" | python -m json.tool
```
4. **Expected**: HTTP 401 (Token A is stale)
5. Now attempt to use Token B (which should also be revoked due to family revocation):
```sh
curl -s -X POST http://localhost:8000/api/auth/refresh/ \
  -H "Cookie: refresh_token=<TOKEN_B>" | python -m json.tool
```
6. **Expected**: HTTP 401 — the entire token family was revoked when the stale token was presented

---

## Scenario 5 — Protected Route Gate (User Story 5, FR-015–017)

1. Open a private/incognito window
2. Navigate directly to `http://localhost:3000/leads` (or any dashboard URL)
3. **Expected**: redirect to `http://localhost:3000/login?next=%2Fleads`

4. Log in → **Expected**: redirect to `/leads` (original destination restored from `next` param, FR-016)

5. While still logged in, navigate to `http://localhost:3000/login`
6. **Expected**: redirect to `/` — no double-login loop (FR-017)

---

## Backend Tests

```sh
cd backend
python -m pytest apps/accounts/tests/ -v
```

Key modules and what they cover:

| Module | Coverage |
|--------|----------|
| `tests/test_models.py` | `RefreshTokenFamily` and `RefreshTokenLineage` state transitions |
| `tests/test_views.py` | Login success/failure, refresh rotation, logout revocation, reuse detection, concurrent refresh race |

---

## Frontend Tests

```sh
cd frontend
npm run test           # Vitest unit tests (LoginForm, auth hooks)
npm run test:e2e       # Playwright e2e (requires backend running on port 8000)
```

Key e2e scenarios:
- Login → dashboard → logout → confirm redirect to `/login`
- Unauthenticated navigation to dashboard route → confirm redirect with `next` param

---

## Token Purge (FR-010)

```sh
cd backend
python manage.py purge_expired_tokens     # custom: cleans RefreshTokenLineage + orphan Families
python manage.py flushexpiredtokens       # simplejwt built-in: cleans token_blacklist tables
```

Safe to run at any time — expired tokens are already unusable.
