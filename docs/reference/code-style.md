# Code style

## Python

- **Formatter:** ruff format (or black). 100-char line length.
- **Linter:** ruff with rules: `E, F, I, B, UP, SIM, RUF`. Fix on save.
- **Type hints:** required on all function signatures (params + return).
  Internal helpers may skip return hints when obvious.
- **Imports:** sorted by ruff/isort. Order: stdlib, third-party, Django,
  first-party. No relative imports across apps.
- **Docstrings:** Google style. Required on public functions and classes.
- **Naming:** `snake_case` for functions/variables, `PascalCase` for classes,
  `UPPER_SNAKE` for module-level constants.
- **Django models:** explicit `verbose_name`, `verbose_name_plural`, and
  `Meta.ordering`. Always include `created_at`, `updated_at`, `created_by`
  via a `TimestampedModel` mixin in `apps.core`.
- **DRF/adrf serializers:** explicit `fields` list, never `__all__`.
- **Views:** one ViewSet per resource. Use `@action` for non-CRUD endpoints.

## TypeScript / React

- **Formatter:** Prettier. 2-space indent, single quotes, no semicolons.
- **Linter:** ESLint (Next config) + `@typescript-eslint`.
- **Strict TS:** `strict: true`. No `any` without `// eslint-disable-next-line`
  and a reason.
- **Components:** functional, named exports (`export function Foo`).
  Default exports only for Next.js pages and layouts.
- **File naming:** `kebab-case.tsx` for files, `PascalCase` for component
  names, `useCamelCase` for hooks, `camelCase` for utilities.
- **Folder structure:** colocate by feature, not by type. A feature folder
  contains its components, hooks, types, and queries.
- **Forms:** react-hook-form + zod schemas. Never bare `useState` for form
  fields beyond trivial cases.
- **Data fetching:** TanStack Query for everything that hits the API. No
  `fetch` in components directly.

## Git

- **Branches:** `feat/<slug>`, `fix/<slug>`, `chore/<slug>`, `docs/<slug>`.
- **Commits:** Conventional Commits — `feat(leads): add lead source field`.
- **PRs:** every PR must reference a Jira ticket: `[CRM-123] Add lead source`.
  Squash-merge to `main`.
- **No direct commits to `main`.**

## SQL / migrations

- One concern per migration. Never edit a merged migration; create a new one.
- Add indexes in the same migration as the column they index.
- `null=True` only when the field is genuinely optional in the domain.
