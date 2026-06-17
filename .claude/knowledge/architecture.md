# Architecture Overview

## Frontend (Next.js + TypeScript)
- Lives in `frontend/`
- Next.js App Router (prefer Server Components where possible)
- Vitest + React Testing Library for component/unit tests
- No `any` types; define shared API response types in `frontend/types/`

## Backend (Django + adrf)
- Lives in `backend/`
- Django apps per domain (e.g. `contacts`, `deals`, `users`)
- Async views using adrf `AsyncAPIView` or `@api_view` with `async_to_sync`
- Route handlers: `backend/<app>/views.py`
- URL routing: `backend/<app>/urls.py` → aggregated in `backend/config/urls.py`
- Business logic in `backend/<app>/services.py`
- ORM queries in `backend/<app>/repositories.py` (keep views thin)

## API Contract
- RESTful JSON API consumed by Next.js frontend
- Schema documented in `docs/api/`
- adrf enables async ORM queries without blocking the event loop

## Testing Strategy
- **Backend**: pytest + pytest-django; 80% coverage enforced via `--cov-fail-under=80`
- **Frontend**: Vitest + RTL; 80% coverage enforced in CI
- Integration tests: Django test client against real SQLite (test DB)
- Component tests: RTL with mocked API responses (MSW recommended)
