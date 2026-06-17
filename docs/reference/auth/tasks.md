# Tasks: JWT Authentication

**Input**: Design documents from `agent-os/specs/auth/`

**Prerequisites**: [plan.md](./plan.md) · [spec.md](./spec.md) · [research.md](./research.md) · [data-model.md](./data-model.md) · [contracts/](./contracts/)

## Format: `[ID] [P?] [Story?] Description — file path`

- **[P]**: Can run in parallel (operates on different files; no dependency on incomplete sibling tasks)
- **[Story]**: Maps to user story from spec.md (US1–US5)
- Every task includes an exact file path

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Structural scaffolding needed before any user story work begins.

- [ ] T001 Replace `backend/apps/accounts/tests.py` with `backend/apps/accounts/tests/__init__.py` package (ADR-008: one module per concern)
- [ ] T002 Create `backend/apps/accounts/tests/factories.py` — `UserFactory` using factory_boy wrapping `apps.accounts.User`
- [ ] T003 [P] Create `backend/apps/accounts/serializers.py` — empty module with `LoginSerializer` stub (email + password `CharField` fields, no logic yet)
- [ ] T004 [P] Create `backend/apps/accounts/urls.py` — empty `urlpatterns = []` list with router comment block for auth endpoints
- [ ] T005 Wire `backend/apps/accounts/urls.py` into `backend/crm/urls.py` — include at path `api/auth/`
- [ ] T006 Add `/api/*` rewrite to `frontend/next.config.ts` — `process.env.NODE_ENV === 'development'` guard, rewrites to `NEXT_PUBLIC_API_URL` (RES-003)

**Checkpoint**: Repo structure matches plan.md; backend URL routing wired; dev proxy rewrite in place.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Data models and frontend token infrastructure that every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T007 Add `RefreshTokenFamily` model to `backend/apps/accounts/models.py` — UUID PK, `user` FK (CASCADE), `created_at`, `is_revoked` (BooleanField, db_index=True); Meta indexes on `(user_id, is_revoked)` and `created_at`
- [ ] T008 Add `RefreshTokenLineage` model to `backend/apps/accounts/models.py` — `jti` CharField PK (max_length=36), `family` FK (CASCADE), `is_active` BooleanField (db_index=True), `issued_at`, `expires_at`, `revoked_at` (null); Meta indexes on `(family_id, is_active)` and `expires_at`
- [ ] T009 Generate and apply migration — run `python manage.py makemigrations accounts` → creates `backend/apps/accounts/migrations/0002_refreshtokenfamily_refreshtokenlineage.py`; run `python manage.py migrate`
- [ ] T010 [P] Create `frontend/src/lib/auth.ts` — module-level `accessToken: string | null` variable, `setAccessToken()`, `getAccessToken()`, `clearAccessToken()`, `isTokenExpired()` helper (decode JWT `exp` claim without a library)
- [ ] T011 [P] Extend `frontend/src/lib/api.ts` — add `authFetch()` wrapper that calls `getAccessToken()` and injects `Authorization: Bearer <token>` header before delegating to `fetch()`; returns raw `Response` for callers to handle

**Checkpoint**: Models migrated in MySQL; frontend has a typed token store; all user story phases can now start.

---

## Phase 3: User Story 1 — Secure Login (Priority: P1) 🎯 MVP

**Goal**: User submits email + password → receives 15-min access token in memory + 7-day refresh cookie → reaches dashboard.

**Independent Test**: `POST /api/auth/login/` with valid credentials returns `{ access: "..." }` and `Set-Cookie: refresh_token=...HttpOnly`; wrong-password and unknown-email return identical error bodies.

### Backend — US1

- [ ] T012 [US1] Implement `LoginSerializer` in `backend/apps/accounts/serializers.py` — `email` EmailField, `password` CharField (write_only); `validate()` calls `authenticate(request, email=..., password=...)`, raises `AuthenticationFailed` with a fixed generic message on failure (FR-004)
- [ ] T013 [US1] Implement `LoginView` (adrf `AsyncAPIView`) in `backend/apps/accounts/views.py` — call `LoginSerializer.validate()`, create `RefreshTokenFamily` + `RefreshTokenLineage` records, generate simplejwt `AccessToken` + `RefreshToken`, return `{ access }` in body, set httpOnly refresh cookie (RES-002 cookie flags)
- [ ] T014 [US1] Register `POST login/` URL in `backend/apps/accounts/urls.py` — map to `LoginView`
- [ ] T015 [P] [US1] Create `backend/apps/accounts/tests/test_models.py` — assert `RefreshTokenFamily` created with `is_revoked=False`; assert `RefreshTokenLineage` created with `is_active=True` and correct `expires_at`
- [ ] T016 [P] [US1] Create `backend/apps/accounts/tests/test_views.py` — `test_login_success` (200, access token, cookie set), `test_login_wrong_password` (401), `test_login_unknown_email` (401), `test_no_account_enumeration` (wrong-password and unknown-email bodies are identical)

### Frontend — US1

- [ ] T017 [P] [US1] Create `frontend/src/features/auth/types.ts` — `LoginRequest`, `AccessTokenResponse`, `AuthError` TypeScript interfaces matching [contracts/openapi.yml](./contracts/openapi.yml)
- [ ] T018 [P] [US1] Create `frontend/src/features/auth/api.ts` — `login(email, password): Promise<AccessTokenResponse>` calls `POST /api/auth/login/` via `fetch`, throws `AuthError` on non-200
- [ ] T019 [US1] Create `frontend/src/features/auth/hooks/useAuth.ts` — `useLogin()` TanStack Query mutation calling `login()`, on success calls `setAccessToken(data.access)` then `router.push(next ?? '/')`
- [ ] T020 [US1] Create `frontend/src/features/auth/components/LoginForm.tsx` — react-hook-form + zod schema (email required, password required), renders email/password inputs + submit button, renders inline error from `useLogin().error`, calls `useLogin().mutate()`
- [ ] T021 [US1] Create `frontend/src/app/(auth)/login/page.tsx` — client component, renders `<LoginForm />`, reads `?next` search param and passes to `useLogin()`

**Checkpoint**: User can log in from `http://localhost:3000/login`; DevTools shows `refresh_token` cookie as HttpOnly; Dashboard renders.

---

## Phase 4: User Story 2 — Transparent Session Renewal (Priority: P1)

**Goal**: Expired 15-min access token is silently replaced in the background using the refresh cookie; user never sees a login prompt mid-session.

**Independent Test**: Log in → wait 15+ min (or simulate token expiry) → make any API call → succeeds; Network shows `POST /api/auth/refresh/` followed by the retried request.

### Backend — US2

- [ ] T022 [US2] Implement `RefreshView` (adrf `AsyncAPIView`) in `backend/apps/accounts/views.py` — read `request.COOKIES['refresh_token']`, decode jti via simplejwt, query `RefreshTokenLineage.objects.select_related('family').get(jti=jti)`, verify `is_active=True` (return 401 if not found or `is_active=False`), deactivate old lineage record, generate new simplejwt `RefreshToken` + `AccessToken`, create new `RefreshTokenLineage`, return `{ access }` + set new refresh cookie
- [ ] T023 [US2] Register `POST refresh/` URL in `backend/apps/accounts/urls.py` — map to `RefreshView`
- [ ] T024 [P] [US2] Add to `backend/apps/accounts/tests/test_views.py` — `test_refresh_success` (200, new access, new cookie), `test_refresh_rotates_cookie` (new cookie value ≠ old), `test_refresh_missing_cookie` (401), `test_refresh_expired_token` (401)

### Frontend — US2

- [ ] T025 [US2] Update `frontend/src/lib/auth.ts` — add `refreshAccessToken(): Promise<string>` calling `POST /api/auth/refresh/` (no body; browser sends cookie), updates `accessToken`, throws on 401; add `refreshPromise` singleton gate (RES-005)
- [ ] T026 [US2] Update `frontend/src/lib/api.ts` `authFetch()` — if `isTokenExpired()`, call `getValidAccessToken()` (which calls `refreshAccessToken()` via singleton) before injecting header; on 401 response, retry once with freshly refreshed token

**Checkpoint**: Simulate token expiry → in-flight requests transparently refresh and complete; two simultaneous expired-token requests deduplicate to one refresh call.

---

## Phase 5: User Story 3 — Secure Logout (Priority: P1)

**Goal**: Clicking logout revokes the refresh token server-side before clearing the cookie; a stolen copy of the cookie is rejected after logout.

**Independent Test**: Log in → copy cookie value → click logout → send copied cookie to `/api/auth/refresh/` → receives 401.

### Backend — US3

- [ ] T027 [US3] Implement `LogoutView` (adrf `AsyncAPIView`, `IsAuthenticated` permission) in `backend/apps/accounts/views.py` — read `refresh_token` cookie, decode jti, load `RefreshTokenLineage`, set `is_active=False` + `revoked_at=now()`, set `family.is_revoked=True`, blacklist token in simplejwt `token_blacklist`, delete cookie via `response.delete_cookie()`, return 204
- [ ] T028 [US3] Register `POST logout/` URL in `backend/apps/accounts/urls.py` — map to `LogoutView`
- [ ] T029 [P] [US3] Add to `backend/apps/accounts/tests/test_views.py` — `test_logout_revokes_token` (204, cookie cleared), `test_revoked_token_rejected` (post-logout refresh → 401), `test_logout_requires_auth` (no Bearer → 401)

### Frontend — US3

- [ ] T030 [US3] Add `logout()` to `frontend/src/features/auth/api.ts` — `POST /api/auth/logout/` via `authFetch()` (sends Bearer token), then calls `clearAccessToken()`; on any response (including 401) clear local token and redirect to `/login`
- [ ] T031 [US3] Create `frontend/src/features/auth/components/LogoutButton.tsx` — client component, calls `logout()` from auth api on click, shows loading state during request
- [ ] T032 [US3] Add `<LogoutButton />` to `frontend/src/app/(dashboard)/layout.tsx` — renders in nav/header alongside dashboard children

**Checkpoint**: Logout from UI clears cookie; stolen cookie value returns 401 from refresh endpoint; other open tabs redirect to login on next API call.

---

## Phase 6: User Story 4 — Reuse Detection / Token Family Invalidation (Priority: P2)

**Goal**: Presenting a stale (already-rotated) refresh token revokes the entire token family and forces re-authentication — a stolen-then-used-late cookie cannot be replayed.

**Independent Test**: Login → get token A → refresh → get token B (A is stale) → present A to `/api/auth/refresh/` → 401; present B → also 401 (family revoked).

### Backend — US4

- [ ] T033 [US4] Add `revoke_family()` method to `RefreshTokenFamily` in `backend/apps/accounts/models.py` — sets `is_revoked=True`, bulk-updates all `RefreshTokenLineage` in the family to `is_active=False, revoked_at=now()`
- [ ] T034 [US4] Update `RefreshView` in `backend/apps/accounts/views.py` — in the `is_active=False` branch (currently returns 401), call `lineage.family.revoke_family()` before returning 401 (FR-006: stale token → full family revocation)
- [ ] T035 [P] [US4] Add to `backend/apps/accounts/tests/test_views.py` — `test_stale_token_triggers_family_revocation` (stale A → 401 + family.is_revoked=True), `test_active_sibling_also_revoked` (B rejected after A presented), `test_fresh_login_creates_new_family` (login after revocation creates independent family)
- [ ] T036 [P] [US4] Add to `backend/apps/accounts/tests/test_models.py` — `test_revoke_family_deactivates_all_lineage`, `test_revoke_family_sets_flag`
- [ ] T037 [US4] Create management command `backend/apps/accounts/management/commands/purge_expired_tokens.py` — deletes `RefreshTokenLineage` where `expires_at < now()`, then deletes `RefreshTokenFamily` with no remaining lineage rows; prints count of deleted rows (FR-010 / RES-006)

**Checkpoint**: Stale token → full family revocation in one round trip; purge command runs without errors; active records untouched by purge.

---

## Phase 7: User Story 5 — Protected Route Gate (Priority: P1)

**Goal**: Unauthenticated users navigating to any dashboard route are redirected to `/login?next=<path>`; authenticated users pass through; authenticated users visiting `/login` are redirected to `/`.

**Independent Test**: Incognito window → `http://localhost:3000/leads` → redirected to `/login?next=%2Fleads`; log in → redirected to `/leads`; navigate to `/login` while logged in → redirected to `/`.

### Frontend — US5

- [ ] T038 [US5] Create `frontend/src/app/(dashboard)/layout.tsx` — async server component; `const cookieStore = await cookies()` from `next/headers`; if `!cookieStore.has('refresh_token')` call `redirect('/login?next=<encoded pathname>')` (FR-015, FR-016)
- [ ] T039 [US5] Create `frontend/src/app/(dashboard)/page.tsx` — server component dashboard placeholder (renders heading + `<LogoutButton />`); this is the protected home route
- [ ] T040 [US5] Update `frontend/src/app/(auth)/login/page.tsx` — add server-side cookie check at top of component: if `refresh_token` cookie present, `redirect('/')` immediately (FR-017, prevents double-login loop)
- [ ] T041 [P] [US5] Update `frontend/src/app/page.tsx` — root page: redirect to `/` (dashboard) if cookie present, else redirect to `/login`; ensures no blank landing page for either auth state

**Checkpoint**: Incognito → `/leads` redirects to `/login?next=%2Fleads`; post-login redirects to original destination; `/login` while authenticated redirects to `/`.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Security hardening, observability, and CI gate validation across all stories.

- [ ] T042 [P] Verify CORS config in `backend/crm/settings.py` — confirm `CORS_ALLOWED_ORIGINS` is an explicit list (not `*`), `CORS_ALLOW_CREDENTIALS = True`, and headers include `Access-Control-Allow-Origin` in dev response (FR-014)
- [ ] T043 [P] Extract cookie-flag helper in `backend/apps/accounts/views.py` — `_refresh_cookie_kwargs(settings)` returns dict with `httponly`, `secure`, `samesite`, `max_age`, `path`; used by `LoginView`, `RefreshView`, `LogoutView` to avoid duplication (FR-012 / FR-013)
- [ ] T044 Regenerate and review OpenAPI schema — `cd backend && python manage.py spectacular --color --file /tmp/schema.yml`; confirm `auth_login`, `auth_refresh`, `auth_logout` operations match [contracts/openapi.yml](./contracts/openapi.yml)
- [ ] T045 Update `docs/erd.md` to include `RefreshTokenFamily` and `RefreshTokenLineage` entities with fields and relationships (best-practices.md Definition of Done §6)
- [ ] T046 Run all five quickstart.md validation scenarios manually and confirm each passes (best-practices.md Definition of Done §2)
- [ ] T047 [P] Backend CI gate — `ruff check backend/apps/accounts/` + `ruff format --check backend/apps/accounts/` + `pytest backend/apps/accounts/tests/ -v` all green
- [ ] T048 [P] Frontend CI gate — `tsc --noEmit` + `eslint` + `vitest run` all green in `frontend/`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Requires Phase 1 complete — **BLOCKS all user story phases**
- **Phase 3 (US1 — Login)**: Requires Phase 2; no dependency on US2–US5
- **Phase 4 (US2 — Renewal)**: Requires Phase 2; depends on T013 (`LoginView`) to issue the initial token
- **Phase 5 (US3 — Logout)**: Requires Phase 2; depends on T013 (LoginView) and T022 (RefreshView) being wired
- **Phase 6 (US4 — Reuse)**: Requires Phase 2; depends on T022 (`RefreshView`) being implemented; T034 modifies RefreshView
- **Phase 7 (US5 — Gate)**: Requires Phase 2; depends on T021 (`login/page.tsx`) existing for redirect target
- **Phase 8 (Polish)**: Requires all desired story phases complete

### User Story Dependencies

| Story | Depends on | Can start after |
|-------|-----------|----------------|
| US1 — Login | Phase 2 | T009 (migration applied) |
| US2 — Renewal | Phase 2 + T013 | LoginView exists to create tokens |
| US3 — Logout | Phase 2 + T013 + T022 | LoginView + RefreshView wired |
| US4 — Reuse Detection | Phase 2 + T022 | RefreshView handles basic rotation |
| US5 — Route Gate | Phase 2 + T021 | Login page exists as redirect target |

### Within Each Phase

- Backend tasks (views → serializers → models) are sequential within a story
- Frontend tasks (types → api → hooks → components → pages) are sequential within a story
- Backend and frontend tasks for the **same story** are parallelizable across developers
- Tests for any story can be written in parallel with implementation (write first, run last)

---

## Parallel Opportunities

### Phase 1
T003 (serializers.py) and T004 (urls.py) — different files, no dependency

### Phase 2
T010 (frontend auth.ts) and T011 (extend api.ts) — write skeletons in parallel; T011 depends on T010's export signature being known (coordinate interface first)

### Phase 3 (US1)
Backend group in parallel with frontend group:
```
# Parallel stream A (backend)
T012 → T013 → T014 → T015, T016

# Parallel stream B (frontend)
T017, T018 → T019 → T020 → T021
```

### Phase 6 (US4)
T033 (model method) and T034 (view update) are sequential (T033 must exist before T034 calls it); T035, T036 (tests) run in parallel after T034.

---

## Implementation Strategy

### MVP First (US1 + US5 minimum viable auth)

1. Complete Phase 1 + Phase 2 (setup + models + migration)
2. Complete Phase 3 (US1 — Login): user can log in, get tokens, reach dashboard
3. Complete Phase 7 (US5 — Gate): unauthenticated users can't reach dashboard
4. **STOP and VALIDATE** using quickstart.md Scenarios 1 and 5
5. Ship MVP: users can log in and protected routes work

### Incremental Delivery

| Milestone | Stories complete | What users can do |
|-----------|-----------------|------------------|
| MVP | US1 + US5 | Log in; routes protected |
| + Renewal | + US2 | Stay logged in indefinitely |
| + Logout | + US3 | Log out securely |
| + Security | + US4 | Replay attacks rejected |

### Parallel Team Strategy (2 developers)

Once Phase 1 + 2 are done:
- **Developer A** — Backend: US1 (T012–T016) → US2 (T022–T024) → US3 (T027–T029) → US4 (T033–T037)
- **Developer B** — Frontend: US1 (T017–T021) → US5 (T038–T041) → US2 (T025–T026) → US3 (T030–T032)

---

## Notes

- [P] = operates on a different file than its siblings; no blocking dependency
- [USN] label enables traceability: each task maps to a verifiable acceptance scenario
- Write tests before implementing views (tests confirm 401 before the view logic is added)
- `python manage.py migrate` must be run after T009 before any view test can hit the database
- `NEXT_PUBLIC_API_URL` env var must be set in `frontend/.env.local` for the dev proxy to work
- Cookie value is accessible in DevTools (Application tab) for manual testing even though JS cannot read it
