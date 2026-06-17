# Feature Specification: JWT Authentication

**Feature Branch**: `chore/speckit-bootstrap`

**Created**: 2026-06-14

**Status**: Draft

**Input**: User description: "JWT Authentication (warm-up cycle) — resolving open decisions from ADR-003"

---

## Context & Scope

This spec closes the open decisions left by **ADR-003** (JWT with access token in memory, refresh token in httpOnly cookie). ADR-003 settled the architecture but explicitly deferred rotation strategy, revocation, lifetimes, CORS scope, and frontend integration shape. This feature spec captures those decisions as verifiable requirements so implementation can begin.

**In scope:** login, token refresh, logout, session continuity, cookie + CORS configuration, frontend auth gate.

**Explicitly deferred:**
- Password reset flow — punted to a follow-up spec (`agent-os/specs/password-reset/`). The spec will note the dependency.
- Account lockout — punted to MVP+1. No brute-force protection ships in this iteration.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Secure Login (Priority: P1)

A CRM user enters their email and password. The system authenticates them, issues a short-lived access credential held in browser memory and a longer-lived renewal credential stored in a secure, script-inaccessible cookie. The user is taken to the dashboard without being prompted again until the renewal credential expires.

**Why this priority**: Everything else depends on a working login. No other feature is testable without it.

**Independent Test**: Open the login page, submit valid credentials, verify the dashboard loads and a subsequent API call succeeds without user interaction.

**Acceptance Scenarios**:

1. **Given** a valid email and password, **When** the user submits the login form, **Then** they receive an access credential valid for 15 minutes and a renewal cookie valid for 7 days, and the dashboard renders.
2. **Given** an invalid password, **When** the user submits, **Then** they receive a "credentials incorrect" message; no credential is issued.
3. **Given** an unknown email, **When** the user submits, **Then** the error message is identical to the wrong-password case (no account enumeration).
4. **Given** a valid login, **When** the access credential expires after 15 minutes, **Then** the system silently issues a new one using the renewal cookie without requiring the user to log in again.

---

### User Story 2 — Transparent Session Renewal (Priority: P1)

While a logged-in user works in the CRM, their short-lived access credential expires every 15 minutes. The system renews it automatically in the background using the renewal cookie. The user never sees a login prompt mid-session as long as their renewal cookie is still valid.

**Why this priority**: Silent renewal is the fundamental UX contract promised by the two-token architecture. Without it, users are interrupted every 15 minutes.

**Independent Test**: Log in, wait 15+ minutes without interacting, make an API call (e.g., load a lead list) — it succeeds without a redirect to login.

**Acceptance Scenarios**:

1. **Given** a valid renewal cookie and an expired access credential, **When** the client makes any authenticated request, **Then** a new access credential is issued and the original request completes successfully.
2. **Given** a valid renewal cookie, **When** the renewal endpoint is called, **Then** the old renewal token is immediately invalidated and a new one is set in the cookie (rotate on every use).
3. **Given** a renewal cookie that has itself expired (7 days), **When** the client attempts renewal, **Then** the user is redirected to login.

---

### User Story 3 — Secure Logout (Priority: P1)

A user clicks "Log out." Their session is terminated on the server immediately — even if an attacker has a copy of the renewal cookie, they cannot use it after logout.

**Why this priority**: Logout must be trustworthy. Client-side-only logout (just clearing the cookie) leaves a window where a stolen cookie remains usable. Server-side revocation closes that window.

**Independent Test**: Log in, copy the renewal cookie value, click logout, then attempt to use the copied cookie value to renew — confirm renewal is rejected with a 401.

**Acceptance Scenarios**:

1. **Given** a logged-in user, **When** they click logout, **Then** the renewal token is added to the server-side revocation list AND the renewal cookie is cleared from the browser.
2. **Given** a revoked renewal token, **When** any client attempts to use it (e.g., a stolen cookie), **Then** the renewal endpoint returns 401 Unauthorized.
3. **Given** a logged-in user on multiple tabs, **When** they log out in one tab, **Then** the other tabs' next API call results in a 401 and they are redirected to login.

---

### User Story 4 — Reuse Detection (Token Family Invalidation) (Priority: P2)

If an attacker steals a renewal token and uses it after the legitimate user has already rotated it (i.e., the original is now stale), the system detects the reuse and immediately invalidates the entire token family — logging out all sessions associated with that account.

**Why this priority**: This is the primary defence against refresh token theft. It converts a subtle, hard-to-detect attack into an automatic, complete revocation.

**Independent Test**: Log in (get token A), use token A to get token B (A is now stale), then attempt to use token A again — confirm the server revokes B as well and the user must re-authenticate.

**Acceptance Scenarios**:

1. **Given** a renewal token that has already been rotated (stale), **When** any client presents it to the renewal endpoint, **Then** the entire token family is revoked and all active sessions for the affected user are terminated.
2. **Given** a user who receives a "your session was invalidated" notice, **When** they log in again, **Then** they get a fresh token family with no connection to the previous one.

---

### User Story 5 — Protected Route Gate (Priority: P1)

Unauthenticated users who navigate directly to any CRM route (e.g., `/leads`, `/deals`) are redirected to the login page. Authenticated users pass through without interruption.

**Why this priority**: Without the gate, all CRM data is accessible without credentials.

**Independent Test**: Open a private/incognito window, navigate to `/leads` — confirm redirect to `/login`. Then log in, navigate to `/leads` — confirm the page loads.

**Acceptance Scenarios**:

1. **Given** no valid session, **When** a user navigates to any authenticated route, **Then** they are redirected to `/login` with the original destination preserved as a `next` parameter.
2. **Given** a valid session, **When** a user navigates to any authenticated route, **Then** the page renders without redirect.
3. **Given** an already-authenticated user, **When** they navigate to `/login`, **Then** they are redirected to the dashboard (no double-login loop).

---

### Edge Cases

- What happens when the renewal cookie is present but the token has been revoked server-side (e.g., post-logout from another device)? → Renewal returns 401; client clears local session state and redirects to login.
- What if renewal and an API call race simultaneously (two concurrent requests both try to renew)? → Only the first renewal succeeds; the second should retry with the new token, not fail the user's action.
- What happens if the MySQL blacklist table grows unbounded? → Expired tokens must be periodically purged. A management command or scheduled task handles this; it is a maintenance concern, not a user-facing one.
- What if the user's browser blocks third-party cookies (dev cross-origin scenario)? → Addressed by the same-origin proxy approach in dev (see CORS requirements below).

---

## Requirements *(mandatory)*

### Functional Requirements

**Authentication**

- **FR-001**: The system MUST authenticate users by email and password and issue both an access credential (15-minute TTL) and a renewal credential (7-day TTL) upon success.
- **FR-002**: The system MUST store the renewal credential exclusively in a server-set, script-inaccessible, same-site cookie — never in browser storage accessible to JavaScript.
- **FR-003**: The system MUST keep the access credential in client memory only (not persisted to localStorage, sessionStorage, or any cookie).
- **FR-004**: Login failure messages MUST be identical for wrong-password and unknown-email cases to prevent account enumeration.

**Token Rotation & Family Tracking**

- **FR-005**: The system MUST rotate the renewal token on every use — each call to the renewal endpoint invalidates the presented token and issues a new one.
- **FR-006**: The system MUST track token families so that presenting a stale (already-rotated) renewal token triggers immediate revocation of all tokens in the same family.
- **FR-007**: Token family revocation MUST log out all active sessions associated with the affected user, not just the one that presented the stale token.

**Revocation / Blacklist**

- **FR-008**: The system MUST maintain a server-side revocation list persisted in the primary database (Phase 1 constraint — no external cache).
- **FR-009**: Revoked renewal tokens MUST be rejected by the renewal endpoint regardless of their expiry date.
- **FR-010**: The revocation list MUST be purgeable of expired entries via an operator-triggered maintenance operation to prevent unbounded growth.

**Logout**

- **FR-011**: Logout MUST add the user's current renewal token to the revocation list (server-side) before clearing the renewal cookie (client-side). Both operations are required; client-side-only logout is not acceptable.

**Cookie & Cross-Origin Configuration**

- **FR-012**: In production, the renewal cookie MUST be set with `Secure`, `HttpOnly`, and `SameSite=Strict`.
- **FR-013**: In development (non-HTTPS, cross-port origins), the API MUST be reachable through a same-origin proxy so the renewal cookie can use `SameSite=Lax` without requiring `Secure`. The client app MUST NOT require `SameSite=None` in development.
- **FR-014**: CORS configuration MUST explicitly allowlist the frontend origin and must not use wildcard (`*`) origins in conjunction with credentialed requests.

**Frontend Auth Gate**

- **FR-015**: All authenticated routes MUST be protected at the server-side routing layer so that unauthenticated requests are intercepted before any page renders — no protected content reaches the client without a valid session.
- **FR-016**: The routing layer auth check MUST redirect unauthenticated users to `/login` while preserving the originally-requested URL as a `next` query parameter.
- **FR-017**: The `/login` route MUST redirect already-authenticated users to the dashboard to prevent redirect loops.

**Out of Scope (explicit punts)**

- **FR-018 (DEFERRED)**: Password reset — email-token-based single-use flow with TTL. Tracked for follow-up spec (`agent-os/specs/password-reset/`).
- **FR-019 (MVP+1)**: Account lockout after repeated failed login attempts. Not in scope for this iteration.

### Key Entities

- **Access Credential**: Short-lived proof of identity held in client memory; 15-minute TTL; stateless (not stored server-side).
- **Renewal Credential**: Long-lived token family member stored in an httpOnly cookie; 7-day TTL; tracked server-side per family.
- **Token Family**: A lineage of renewal tokens issued from a single login event. One active member at a time; stale-member reuse invalidates all.
- **Revocation Record**: A server-side entry marking a renewal token (or family) as permanently invalid before its natural expiry.
- **Auth Session** (logical): The user's continuous authenticated state, spanning multiple access credential renewals, from login to logout or expiry.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can complete login and reach the dashboard in under 3 seconds on a standard broadband connection.
- **SC-002**: Access credential renewal is imperceptible to the user — no visible loading state or interruption for in-progress actions.
- **SC-003**: After logout, a stolen renewal cookie is unusable within the same request cycle (server-side revocation is synchronous with the logout response).
- **SC-004**: A stale-token reuse event triggers complete family revocation and forces re-authentication within one renewal-endpoint round trip.
- **SC-005**: Zero unauthenticated requests reach any protected CRM route — the auth gate operates at the routing layer before any data fetch begins.
- **SC-006**: The revocation list purge operation runs to completion without user-facing downtime.

---

## Assumptions

- Users access the CRM via a modern browser that supports httpOnly cookies and enforces `SameSite` policy.
- The development environment runs the backend API and frontend app on different local ports; a local same-origin proxy bridges them so the renewal cookie behaves as first-party — no HTTPS certificate is required locally.
- Production deployment places the API and frontend app under configurations where `SameSite=Strict` is achievable (same registrable domain or same-origin via reverse proxy).
- No Redis or external cache is available until Phase 2; the revocation list is MySQL-backed for all Phase 1 work.
- Background token-family cleanup (purging expired revocation records) is handled by a periodic maintenance command, not a real-time process.
- Multi-device simultaneous sessions are permitted; reuse detection targets stolen tokens, not concurrent legitimate sessions from different devices.
- The `accounts` Django app is the home for auth models and endpoints; no new top-level app is needed.
- Email delivery infrastructure (required for password reset) is out of scope for this spec and will be addressed in the password-reset follow-up.
