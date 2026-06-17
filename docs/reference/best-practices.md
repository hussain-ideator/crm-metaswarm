# Best practices

Project-wide rules. Agents must verify their output against these before
declaring a task complete.

## API design

- REST resource naming: plural nouns (`/api/leads/`, not `/api/lead/`).
- List endpoints **must** support: pagination (`limit`/`offset` or
  `page`/`page_size`), filtering (`?status=qualified`), search (`?q=...`),
  and ordering (`?ordering=-created_at`).
- All responses follow DRF's pagination shape:
  `{ count, next, previous, results }`.
- Error responses follow DRF default:
  `{ detail: "..." }` for top-level errors,
  `{ field_name: ["error msg"] }` for field validation errors.
- Every endpoint has an OpenAPI schema entry via drf-spectacular.
- Every endpoint has at least one passing test (happy path + auth check).

## Data model invariants

- Every business entity inherits from `apps.core.models.TimestampedModel`
  (provides `created_at`, `updated_at`, `created_by`).
- Soft delete via `is_deleted: BooleanField(default=False)` on entities
  users will want to recover (Leads, Contacts, Deals). Hard delete is
  reserved for true cleanup.
- Foreign keys to `User` use `on_delete=PROTECT` for audit fields,
  `SET_NULL` for assignments (`owner`), `CASCADE` only for tightly
  dependent children (e.g., `Note` → parent record).
- All `CharField` columns specify `max_length` consciously. No 255 defaults
  copy-pasted everywhere.

## Auth & permissions

- Default permission class: `IsAuthenticated`. Anonymous endpoints must
  explicitly override.
- Object-level permissions: a user sees only records they own or that are
  shared via role. Enforced in `get_queryset()`, not at serializer level.
- No secrets in source. All credentials via env vars loaded through
  `django-environ` / `python-decouple`.

## Frontend invariants

- **Next.js 16 is newer than your training data.** APIs, conventions, and
  file structure may differ from what you remember. Read the relevant guide
  in `node_modules/next/dist/docs/` before writing App Router code, and heed
  deprecation notices. Do not assume Next 13/14/15 behavior.
- Server state: TanStack Query only. Query keys follow
  `[resource, params]` shape — e.g., `['leads', { status: 'open' }]`.
- Mutations invalidate the relevant query keys on success.
- Forms: react-hook-form + zod. The zod schema is the single source of
  truth for client-side validation; backend validation must mirror it.
- Loading and error states are first-class. No blank screens during fetch.
- Every list view supports the same query params as the backend (filter,
  search, sort, paginate) and reflects them in the URL.

## Testing

- Backend: pytest. One test file per app, mirroring source layout. Factories
  via factory_boy. Required coverage on PR: any new function/method must
  have at least one test.
- Frontend: Vitest + RTL for components, Playwright for happy-path e2e per
  module.
- CI must pass: ruff, pytest, eslint, tsc, vitest, prettier check.

## Performance

- All list endpoints: `select_related` for FK joins, `prefetch_related` for
  reverse/m2m. Use `django-debug-toolbar` locally to catch N+1.
- Indexes added for every column used in a filter or sort.
- Pagination default page size: 25. Max: 100.

## Observability

- Structured logging via Python's `logging` with JSON formatter in prod.
- Every API request gets a request ID propagated to logs.
- 4xx and 5xx are logged with full context (user, endpoint, payload
  metadata — never PII bodies).

## Definition of Done (per ticket)

A ticket is **done** when:

1. Code matches the spec/plan/tasks in `agent-os/specs/<spec>/`.
2. All standards above are met.
3. Tests added and passing locally.
4. CI is green on the PR.
5. OpenAPI schema regenerated if API changed.
6. ERD updated if schema changed (`docs/erd.md`).
7. PR description references the Jira ticket and the spec folder.
