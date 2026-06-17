# Research: Companies Module

**Date**: 2026-06-14 | **Plan**: [plan.md](plan.md)

All design questions were resolved by reading the existing codebase and applying DRF / Next.js best practices. No external blockers remain.

---

## Decision 1 — Pagination style

**Decision**: Use a custom `CompanyPageNumberPagination` class (subclasses DRF `PageNumberPagination`) on the companies viewset, overriding the global `LimitOffsetPagination` default.

**Rationale**: The spec (FR-008) and edge-cases section require `page` (1-based) and `page_size` parameters, with `page=2` reflected in the URL. `LimitOffsetPagination` uses `limit` / `offset` semantics, which does not satisfy the URL-bookmark requirement (FR-012). `PageNumberPagination` maps directly to the spec's language and produces cleaner URLs.

**Alternatives considered**:
- Keep global `LimitOffsetPagination` — rejected: does not match spec's `page` / `page_size` parameter names or 1-based semantics.
- Change the global default — rejected: would break the accounts endpoints that are already using the current default.

**Implementation note**: `CompanyPageNumberPagination` sets `page_size = 25`, `page_size_query_param = "page_size"`, `max_page_size = 100`, `page_query_param = "page"`.

---

## Decision 2 — Search parameter name

**Decision**: Use `q` as the query parameter name for free-text search (FR-009), implemented via a custom `CompanySearchFilter` that overrides DRF's `SearchFilter.search_param = "q"`.

**Rationale**: The spec explicitly says `?q=` (FR-009). DRF's built-in `SearchFilter` defaults to `?search=`. Subclassing and overriding `search_param` is the minimal change that keeps DRF's existing search implementation while matching the spec contract.

**Alternatives considered**:
- Use `?search=` and rename in spec — rejected: the spec is the source of truth.
- Custom queryset filter method — rejected: unnecessary complexity when DRF's mechanism already works.

---

## Decision 3 — Filtering approach

**Decision**: Use `django-filters` `FilterSet` class (`CompanyFilterSet`) with `industry` (case-insensitive exact) and `owner` (exact by user primary key).

**Rationale**: `django-filters` is already installed and configured as a DRF filter backend. A `FilterSet` is the idiomatic, low-boilerplate approach. The spec (FR-010) only requires filtering by `industry` and `owner` in Phase 1; `FilterSet` makes adding more filters trivial later.

**Alternatives considered**:
- Manual queryset overrides in the view — rejected: more code, harder to test, no schema introspection.
- `owner__username` filter — rejected: spec says "owner's user identifier", so filter by PK/UUID.

---

## Decision 4 — Company model base classes

**Decision**: `Company` inherits from both `TimestampedModel` and `SoftDeleteMixin` from `apps.core.models`. Python MRO: `(Company, TimestampedModel, SoftDeleteMixin, Model)`.

**Rationale**: Both mixins already exist and provide the exact fields required by the spec: `created_at`, `updated_at`, `created_by` (FR-005) from `TimestampedModel`; `is_deleted`, `deleted_at` and `.delete()` soft-delete override (FR-013) from `SoftDeleteMixin`. `SoftDeleteMixin` also provides `SoftDeleteQuerySet.alive()` which powers FR-007.

**Alternatives considered**:
- Duplicate mixin fields on Company directly — rejected: defeats the purpose of the shared core layer.
- Only inherit `TimestampedModel`, add is_deleted manually — rejected: `SoftDeleteMixin` already has the tested implementation.

**MRO note**: `SoftDeleteMixin.objects = SoftDeleteQuerySet.as_manager()`. `TimestampedModel` does not define `objects`. `Company.objects` resolves to `SoftDeleteQuerySet` — so `Company.objects.alive()` is available. The `Company.Meta.ordering = ["name"]` overrides `TimestampedModel.Meta.ordering = ["-created_at"]`.

---

## Decision 5 — Owner FK deletion behaviour

**Decision**: `owner = ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)`.

**Rationale**: FR-015 explicitly states that if the referenced user is removed, the `owner` field is set to null and the company record is preserved. `SET_NULL` is the direct Django translation of this requirement.

**Alternatives considered**:
- `PROTECT` — rejected: spec requires the company to survive the user deletion.
- `CASCADE` — rejected: would delete the company, violating FR-015.

---

## Decision 6 — annual_revenue field type

**Decision**: `DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)` with a serializer-level `validate_annual_revenue` that rejects negative values.

**Rationale**: `DecimalField` prevents floating-point rounding errors for financial values. The API rejects formatted strings like `"1,200,000"` (DRF coerces to Decimal, non-numeric strings fail deserialization with a 400). Non-negative constraint enforced in the serializer (not DB), so error messages are friendly and match the DRF validation pattern used in accounts.

**Alternatives considered**:
- `FloatField` — rejected: rounding issues for financial values.
- DB check constraint — not used as primary gate; serializer validation fires first and provides a better error message.

---

## Decision 7 — employee_count field type

**Decision**: `PositiveIntegerField(null=True, blank=True)`. Accepts 0–2147483647. Non-integer or negative values rejected at the DRF serializer level with a 400.

**Rationale**: Django's `PositiveIntegerField` provides DB-level non-negative enforcement (unsigned int in MySQL). The serializer rejects non-integers and negative values before the save, giving descriptive errors.

**Alternatives considered**:
- `IntegerField` with a `MinValueValidator(0)` — equivalent; `PositiveIntegerField` is more self-documenting.

---

## Decision 8 — industry field

**Decision**: `CharField(max_length=100, blank=True, default="")`. Free-text string, no enum.

**Rationale**: The spec assumptions explicitly say "industry is stored as a free-text string; a predefined enumeration may be added in a later iteration." No enum enforcement in Phase 1. Blank/empty string represents "no industry set."

**Alternatives considered**:
- `TextChoices` enum — deferred to a future iteration per spec.

---

## Decision 9 — Frontend URL state management

**Decision**: Encode all list-view state (search `q`, `industry`, `owner`, `ordering`, `page`, `page_size`) in URL query parameters. Use Next.js `useSearchParams` (read) and `useRouter.replace` (write, no history entry) to sync state. TanStack Query's `queryKey` includes all URL params, so navigation/bookmarks trigger correct cache lookups.

**Rationale**: FR-012 requires all active query params to be URL-representable for bookmarking and sharing. `useSearchParams` is the idiomatic Next.js 14+ approach. Using `router.replace` (not `push`) avoids polluting browser history with every filter change.

**Alternatives considered**:
- React state only — rejected: violates FR-012 (not bookmarkable).
- Zustand / Redux store — rejected: overkill for URL-serialisable filter state; adds a dependency.

---

## Decision 10 — Frontend data table

**Decision**: Use `@tanstack/react-table` v8 (already a dependency) for the companies list table with client-side column definitions and server-side data sourced from TanStack Query.

**Rationale**: TanStack Table is already installed. It provides column sorting hooks that integrate cleanly with URL-based `ordering` state. Server-side pagination/filter/sort: query params → API → TanStack Query cache.

**Alternatives considered**:
- Plain `<table>` with manual sort handling — rejected: duplication of what TanStack Table already provides.
- A third-party table library — rejected: unnecessary new dependency.

---

## Resolved: No remaining NEEDS CLARIFICATION items

All design decisions above are settled. Implementation can proceed directly from `data-model.md` and `contracts/`.
