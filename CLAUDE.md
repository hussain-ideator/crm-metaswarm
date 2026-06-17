# CRM Metaswarm — Project Guide

## Project Overview
Full-stack CRM web application. Next.js frontend, Django (async) backend.

## Tech Stack
- **Frontend**: Next.js + TypeScript
- **Backend**: Python + Django + adrf (async Django REST Framework)
- **Frontend testing**: Vitest + React Testing Library (80% coverage enforced)
- **Backend testing**: pytest + pytest-django
- **CI/CD**: GitHub Actions

## Directory Structure
```
crm-metaswarm/
├── frontend/        # Next.js app
├── backend/         # Django project
├── docs/
├── .github/
│   └── workflows/   # CI/CD pipelines
├── .metaswarm/      # Metaswarm config
└── .claude/
    └── knowledge/   # Project knowledge base
```

## Development Commands
```bash
# Frontend
cd frontend
npm install
npm run dev           # Next.js dev server
npm run test          # Vitest
npm run test:coverage # with coverage report
npm run build

# Backend
cd backend
pip install -r requirements.txt
python manage.py runserver
pytest                # run all tests
pytest --cov=. --cov-report=term-missing
```

## Key Conventions
- TypeScript strict mode on the frontend
- No `any` types without a justification comment
- Prefer named exports over default exports (frontend)
- Django views must be async-compatible (use adrf `AsyncAPIView` / `async_to_sync` where needed)
- All API endpoints documented with DRF schema
- Backend: type-annotate all function signatures (use `from __future__ import annotations`)

## Agent Instructions
When implementing features:
1. Write tests first (TDD)
2. Frontend components: keep small and focused, test with RTL
3. Backend views go in `backend/<app>/views.py`, routes in `backend/<app>/urls.py`
4. Shared API contracts documented in `docs/api/`
5. Run `pytest` (backend) and `npm run test:coverage` (frontend) before marking work done

## Locked Architectural Decisions — Do Not Re-Litigate

Full ADRs are in docs/reference/decisions.md. Agents must cite the relevant ADR
if they disagree. Do not propose alternatives silently.

- ADR-001: Next.js 15 App Router — not plain React, not Vite
- ADR-002: adrf for all API views — async by default, sync only when justified
- ADR-003: JWT auth via djangorestframework-simplejwt — not session auth
- ADR-004: Monorepo with backend/ and frontend/ as siblings
- ADR-005: Lead field set — salutation, first_name, last_name, title, email,
           phone, mobile, company_name, website, industry, no_of_employees,
           source_fk, status, owner_fk, converted_at, converted_deal_fk
- ADR-006: Lead status enum — new/contacted/qualified/unqualified/converted
           The value "lost" is excluded; use "unqualified" instead
- ADR-007: Default pipeline — 6 stages: Qualification, Needs Analysis,
           Proposal, Negotiation, Closed Won, Closed Lost

## App Architecture Rules — Non-Negotiable

- One Django app per business module
- Acyclic dependency graph strictly: core ← accounts ← companies ← contacts ← leads ← deals ← activities
- Cross-app FKs MUST use string references e.g. 'deals.Deal' — never a direct import
- Cross-app imports ONLY inside function bodies in services.py — never at module level
- Business logic lives in services.py — not views.py or serializers.py
- Cross-app side effects via Django signals only
- Per-app file layout: models.py, serializers.py, views.py, urls.py,
  filters.py, services.py, signals.py, tests/

## API Conventions

- REST resource naming: plural nouns (/api/leads/ not /api/lead/)
- All list endpoints must support: pagination, filtering, search (?q=), ordering
- Default permission class: IsAuthenticated
- Every endpoint needs an OpenAPI schema entry via drf-spectacular
- Pagination: default page_size=25, max=100
- Response shape: { count, next, previous, results }

## Frontend Conventions

- Server state: TanStack Query only — no fetch in components directly
- Query keys: [resource, params] e.g. ['leads', { status: 'open' }]
- Forms: react-hook-form + zod — zod schema is source of truth for validation
- Every list view reflects query params in URL
- Loading and error states are first-class — no blank screens
- UI: shadcn/ui + Tailwind CSS
- Tables: TanStack Table v8
- Icons: lucide-react

## Definition of Done

A task is done when:
1. Code matches the spec
2. All architecture rules above are met
3. Tests added and passing
4. CI is green
5. OpenAPI schema regenerated if API changed
6. ERD updated in docs/reference/erd.md if schema changed
7. No direct commits to main

## What NOT to Do

- Do not propose cloud deployment — deferred to Phase 4
- Do not add Celery/Redis — deferred to Phase 2
- Do not use axios — use fetch wrapper
- Do not use __all__ in DRF serializers — explicit fields list always
- Do not hard-delete records — soft delete only (is_deleted=True)
- Do not import from a downstream app at module level
