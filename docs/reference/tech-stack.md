# Tech stack

Pinned choices. Agents must NOT propose alternatives without an ADR in
`decisions.md`.

## Backend

| Concern              | Choice                                    |
|----------------------|-------------------------------------------|
| Language             | Python 3.12+                              |
| Framework            | Django 5.x                                |
| API layer            | adrf (async DRF)                          |
| Database             | MySQL 8.0                                 |
| ORM                  | Django ORM                                |
| Migrations           | Django migrations                         |
| Auth                 | djangorestframework-simplejwt (JWT)       |
| API docs             | drf-spectacular (OpenAPI 3)               |
| Filtering            | django-filter                             |
| Background jobs      | Celery + Redis (Phase 2+)                 |
| Linting              | ruff                                      |
| Formatting           | ruff format (or black)                    |
| Type checking        | mypy (gradual)                            |
| Testing              | pytest + pytest-django + factory_boy      |
| Env management       | python-decouple or django-environ         |
| DB driver            | mysqlclient                               |

## Frontend

| Concern              | Choice                                    |
|----------------------|-------------------------------------------|
| Framework            | Next.js 16 (App Router)                   |
| Language             | TypeScript 5.x (strict mode)              |
| UI components        | shadcn/ui (copy-paste, owned in repo)     |
| Styling              | Tailwind CSS                              |
| Forms                | react-hook-form + zod                     |
| Server state         | TanStack Query (React Query) v5           |
| Client state         | Zustand (only where needed)               |
| Tables / data grids  | TanStack Table v8                         |
| Icons                | lucide-react                              |
| HTTP client          | fetch wrapper (no axios unless justified) |
| Testing              | Vitest + React Testing Library + Playwright (e2e) |
| Linting              | ESLint (Next config)                      |
| Formatting           | Prettier                                  |

## Tooling

| Concern              | Choice                                    |
|----------------------|-------------------------------------------|
| Workflow framework   | SpecKit (`spec-kit`)                      |
| Standards framework  | Agent OS                                  |
| AI coding agent      | Claude Code                               |
| Version control      | Git, GitHub                               |
| Issue tracking       | Jira                                      |
| CI                   | GitHub Actions                            |
| Container runtime    | Docker (optional locally)                 |

## Versions

Lock these in `backend/pyproject.toml` and `frontend/package.json` after
initial install. Update via PR with reasoning.
