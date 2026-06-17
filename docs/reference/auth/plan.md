# Implementation Plan: JWT Authentication

**Branch**: `chore/speckit-bootstrap` | **Date**: 2026-06-14 | **Spec**: [agent-os/specs/auth/spec.md](./spec.md)

**Input**: Feature specification from `agent-os/specs/auth/spec.md`

## Summary

Implement JWT authentication across the Django backend and Next.js 16 frontend: custom login/refresh/logout endpoints serving access tokens in response bodies and refresh tokens in httpOnly cookies, a MySQL-backed token family tracker for reuse detection and family revocation, a same-origin dev proxy via `next.config.ts` rewrites, and a server-side App Router auth gate that checks the refresh cookie before rendering any protected route.

## Technical Context

**Language/Version**: Python 3.12+ (backend), TypeScript 5.x strict (frontend)

**Primary Dependencies**:
- Backend: Django 5.x, adrf (async DRF), djangorestframework, djangorestframework-simplejwt 5.3+, django-cors-headers, django-environ, drf-spectacular
- Frontend: Next.js 16 (App Router), React 19, TanStack Query v5, react-hook-form + zod, TypeScript

**Storage**: MySQL 8.0 via mysqlclient, Django ORM; simplejwt `token_blacklist` tables + custom family tracking tables in the `accounts` app

**Testing**:
- Backend: pytest + pytest-django + factory_boy; `tests/` package per app (ADR-008)
- Frontend: Vitest + React Testing Library (unit); Playwright (e2e)

**Target Platform**: Web service (Django REST API) + Web app (Next.js 16 App Router, modern browser)

**Project Type**: Full-stack web application — Django REST backend + Next.js 16 frontend, monorepo per ADR-004

**Performance Goals**: Login round-trip < 3 s on standard broadband (SC-001); token renewal imperceptible to user (SC-002)

**Constraints**:
- No Redis / external cache in Phase 1 — revocation list is MySQL-backed only (FR-008)
- Production: `SameSite=Strict`, `Secure`, `HttpOnly` cookie (FR-012)
- Development: same-origin proxy so `SameSite=Lax` works without HTTPS (FR-013)
- CORS must not use wildcard with credentialed requests (FR-014)

**Scale/Scope**: Small CRM team (~10–50 users), Phase 1 MVP; Redis-backed cache deferred to Phase 2

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` contains only unfilled template placeholders — no gates have been ratified. No constitution gates apply.

Post-design re-check: same conclusion — no violations to justify.

## Project Structure

### Documentation (this feature)

```text
agent-os/specs/auth/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── README.md
│   └── openapi.yml
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── apps/
│   └── accounts/
│       ├── models.py          # User (existing) + RefreshTokenFamily + RefreshTokenLineage
│       ├── serializers.py     # LoginSerializer, RefreshResponseSerializer
│       ├── views.py           # LoginView, RefreshView, LogoutView (async, adrf)
│       ├── urls.py            # /api/auth/ URL patterns
│       ├── management/
│       │   └── commands/
│       │       └── purge_expired_tokens.py
│       └── tests/
│           ├── __init__.py
│           ├── factories.py
│           ├── test_models.py
│           └── test_views.py
└── crm/
    ├── urls.py                # Include accounts.urls at /api/auth/
    └── settings.py            # SIMPLE_JWT + CORS already partially configured

frontend/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/
│   │   │       └── page.tsx       # Login page (client component)
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx         # Server-side auth gate (server component)
│   │   │   └── page.tsx           # Dashboard
│   │   └── layout.tsx
│   ├── features/
│   │   └── auth/
│   │       ├── api.ts             # login(), refresh(), logout() fetch calls
│   │       ├── components/
│   │       │   └── LoginForm.tsx
│   │       ├── hooks/
│   │       │   └── useAuth.ts     # Access token memory store + refresh coordination
│   │       └── types.ts
│   └── lib/
│       └── api.ts                 # Extend existing fetch wrapper with auth interceptor
└── next.config.ts                 # /api/* rewrites → backend URL (dev same-origin proxy)
```

**Structure Decision**: Web application layout (backend/ + frontend/ siblings) per ADR-004 monorepo. Auth code lives in `apps/accounts/` (backend) and `src/features/auth/` (frontend).

## Complexity Tracking

> Constitution has no ratified gates — no violations to justify.
