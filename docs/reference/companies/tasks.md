# Tasks: Companies (Accounts) Module

**Input**: Design documents from `agent-os/specs/companies/`

**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Data Model**: [data-model.md](data-model.md) | **API Contract**: [contracts/openapi-companies.yaml](contracts/openapi-companies.yaml)

**User Stories**: US1 (P1) Browse List · US2 (P1) Create · US3 (P1) View Details · US4 (P2) Edit · US5 (P2) Soft Delete

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Exact file paths are included in every description

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the companies app skeleton and frontend directory structure so all subsequent tasks have concrete files to edit.

- [ ] T001 Create backend/apps/companies/ package skeleton — `__init__.py`, `apps.py` (AppConfig with `name = "apps.companies"`), `admin.py`, `models.py`, `serializers.py`, `filters.py`, `pagination.py`, `views.py`, `urls.py`, `migrations/__init__.py`, `tests/__init__.py` — all empty/minimal in backend/apps/companies/
- [ ] T002 [P] Create frontend/src/features/companies/ directory structure — empty placeholder files for `api.ts`, `types.ts`, `schemas/company.ts`, `hooks/useCompanies.ts`, `hooks/useCompany.ts`, `hooks/useCreateCompany.ts`, `hooks/useUpdateCompany.ts`, `hooks/useDeleteCompany.ts`, `components/CompanyTable.tsx`, `components/CompanyFilters.tsx`, `components/CompanyForm.tsx`, `components/DeleteCompanyButton.tsx` in frontend/src/features/companies/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement the Company model and all backend plumbing (serializers, filters, pagination, viewset, URLs) plus the shared frontend types, Zod schema, and API module. No user story work can begin until this phase is complete.

**⚠️ CRITICAL**: All Phase 3+ tasks depend on T003–T015 being complete.

- [ ] T003 Register `apps.companies` in the `INSTALLED_APPS` list in backend/crm/settings.py
- [ ] T004 Implement Company model inheriting `TimestampedModel, SoftDeleteMixin` with all fields from data-model.md (name, industry, website, phone, billing_address, shipping_address, annual_revenue, employee_count, owner FK SET_NULL), Meta ordering `["name"]`, and three composite indexes in backend/apps/companies/models.py
- [ ] T005 Run `python manage.py makemigrations companies` and apply with `python manage.py migrate`; verify the generated file in backend/apps/companies/migrations/0001_initial.py
- [ ] T006 [P] Implement `CompanySerializer` (all fields; owner and created_by as PKs; id/created_at/updated_at/created_by read-only) and `CompanyWriteSerializer` (name required, `validate_annual_revenue` rejects negatives, supports `partial=True` for PATCH) in backend/apps/companies/serializers.py
- [ ] T007 [P] Implement `CompanyFilterSet` (FilterSet for django-filters; industry uses `iexact`, owner uses exact by PK) and `CompanySearchFilter` (DRF SearchFilter subclass; `search_param = "q"`; `search_fields = ["name", "website", "phone"]`) in backend/apps/companies/filters.py
- [ ] T008 [P] Implement `CompanyPageNumberPagination` (PageNumberPagination subclass; `page_size = 25`, `page_size_query_param = "page_size"`, `max_page_size = 100`, `page_query_param = "page"`) in backend/apps/companies/pagination.py
- [ ] T009 Implement `CompanyViewSet` (ModelViewSet; `get_queryset` returns `Company.objects.alive()`; `get_serializer_class` returns write serializer for create/update; `perform_create` sets `created_by = request.user`; `filter_backends` includes DjangoFilterBackend + CompanySearchFilter + OrderingFilter; `ordering_fields` = all user-visible columns; `filterset_class = CompanyFilterSet`; `pagination_class = CompanyPageNumberPagination`) in backend/apps/companies/views.py
- [ ] T010 Create `DefaultRouter`, register `CompanyViewSet` at prefix `"companies"`, expose `urlpatterns = router.urls` in backend/apps/companies/urls.py
- [ ] T011 Add `path("api/companies/", include("apps.companies.urls"))` to `urlpatterns` in backend/crm/urls.py
- [ ] T012 [P] Create `CompanyFactory` (DjangoModelFactory; `class Meta: model = Company`; `name = Faker("company")`; `owner` optional sub-factory referencing UserFactory) in backend/apps/companies/tests/factories.py
- [ ] T013 [P] Implement `Company`, `CompanyListResponse`, and `CompanyListParams` TypeScript interfaces per data-model.md §Frontend TypeScript Types in frontend/src/features/companies/types.ts
- [ ] T014 [P] Implement `companySchema` (Zod object schema) and export `CompanyFormValues` type per data-model.md §Zod Schema in frontend/src/features/companies/schemas/company.ts
- [ ] T015 Implement companies API module — `listCompanies(params: CompanyListParams)`, `getCompany(id: number)`, `createCompany(data)`, `updateCompany(id, data)`, `patchCompany(id, data)`, `deleteCompany(id)` — all using `authFetch` from `src/lib/api.ts`; map params to query string for list endpoint in frontend/src/features/companies/api.ts

**Checkpoint**: `python manage.py migrate` completes with no errors. `curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/companies/` returns `{"count":0,"next":null,"previous":null,"results":[]}`.

---

## Phase 3: User Story 1 — Browse the Company List (Priority: P1) 🎯 MVP

**Goal**: Authenticated user sees a paginated, searchable, filterable, sortable table of active companies; all active params are encoded in the URL so any view can be bookmarked and reproduced.

**Independent Test**: Navigate to http://localhost:3000/companies — confirm a table renders with company rows, a search box, industry/owner filter controls, column sort headers, and page navigation. Type in search → rows update, URL gains `?q=<term>`. Copy URL, paste in new tab → identical view reproduced.

### Implementation for User Story 1

- [ ] T016 [P] [US1] Implement `useCompanies` hook (`useQuery` with `queryKey: ["companies", params]`; reads all list params from `useSearchParams`; calls `listCompanies(params)`; returns data, isPending, isError) in frontend/src/features/companies/hooks/useCompanies.ts
- [ ] T017 [P] [US1] Implement `CompanyFilters` component (search text input for `q`, industry text input, owner number input; each `onChange` calls `router.replace` updating only that URL param while preserving others; resets page to 1 on any filter change) in frontend/src/features/companies/components/CompanyFilters.tsx
- [ ] T018 [US1] Implement `CompanyTable` component (TanStack Table `useReactTable`; columns: name, industry, website, phone, employee_count, annual_revenue, owner, created_at; clicking a sort header updates `?ordering=<field>` or `?ordering=-<field>` in URL; row click navigates to `/companies/[id]`; pagination controls update `?page=`) in frontend/src/features/companies/components/CompanyTable.tsx
- [ ] T019 [US1] Implement companies list page (reads all query params via `useSearchParams`; passes to `useCompanies`; renders `CompanyFilters` + `CompanyTable`; shows loading skeleton, empty-state message when count=0, and error state) in frontend/src/app/(dashboard)/companies/page.tsx

**Checkpoint**: US1 acceptance scenarios 1–7 from spec.md pass. Quickstart §US1 curl commands all return expected responses.

---

## Phase 4: User Story 2 — Create a Company (Priority: P1)

**Goal**: Authenticated user can create a new company via a form; `name` is mandatory; validation errors (blank name, negative revenue, non-integer employee count) surface inline before submission.

**Independent Test**: Click "New Company" from the list, fill in a name and optional fields, submit → new record appears in the company list and the detail page is accessible at the returned ID.

### Implementation for User Story 2

- [ ] T020 [US2] Implement `CompanyForm` component (React Hook Form; `resolver: zodResolver(companySchema)`; fields: name (required, shows inline error if blank), industry, website, phone, billing_address, shipping_address, annual_revenue, employee_count, owner; accepts `defaultValues` prop and `onSubmit` handler prop so it is reusable for edit) in frontend/src/features/companies/components/CompanyForm.tsx
- [ ] T021 [US2] Implement `useCreateCompany` mutation hook (`useMutation`; calls `createCompany(data)`; on success invalidates `["companies"]` query and returns the new company ID for redirect) in frontend/src/features/companies/hooks/useCreateCompany.ts
- [ ] T022 [US2] Implement new company page (renders `CompanyForm` in create mode with `useCreateCompany`; on success redirects to `/companies/[id]`; "Cancel" navigates back to `/companies`) in frontend/src/app/(dashboard)/companies/new/page.tsx

**Checkpoint**: US2 acceptance scenarios 1–6 from spec.md pass. Blank name submit shows inline validation error without sending a network request.

---

## Phase 5: User Story 3 — View Company Details (Priority: P1)

**Goal**: Authenticated user can view all fields of a specific company; clicking a list row navigates to the detail page; soft-deleted and non-existent company IDs return not-found.

**Independent Test**: Click any company row in the list → detail page loads showing name, industry, website, phone, billing_address, shipping_address, annual_revenue, employee_count, owner, created_at, updated_at. Navigate directly via URL → page loads correctly.

### Implementation for User Story 3

- [ ] T023 [US3] Implement `useCompany` hook (`useQuery` with `queryKey: ["companies", id]`; calls `getCompany(id)`; enabled when id is defined; 404 errors propagate to the error boundary) in frontend/src/features/companies/hooks/useCompany.ts
- [ ] T024 [US3] Implement company detail page (calls `useCompany(id)`; displays all Company fields in a readable layout; includes "Edit" button linking to `/companies/[id]/edit` and "Delete" placeholder; shows loading state and not-found page on 404) in frontend/src/app/(dashboard)/companies/[id]/page.tsx

**Checkpoint**: US3 acceptance scenarios 1–4 from spec.md pass. Unauthenticated user is redirected to login when navigating directly to any company URL.

---

## Phase 6: User Story 4 — Edit a Company (Priority: P2)

**Goal**: Authenticated user can edit any field on an existing company; form is pre-populated with current values; validation errors surface inline; `updated_at` advances on every successful save.

**Independent Test**: Open a company detail page, click "Edit," change name and industry, save → detail view reflects the new values and `updated_at` has advanced.

### Implementation for User Story 4

- [ ] T025 [US4] Implement `useUpdateCompany` mutation hook (`useMutation` with `updateCompany(id, data)` for PUT; second export `usePatchCompany` with `patchCompany(id, data)` for PATCH; on success invalidates `["companies", id]` and `["companies"]` list query) in frontend/src/features/companies/hooks/useUpdateCompany.ts
- [ ] T026 [US4] Implement edit company page (fetches current company via `useCompany(id)`; passes data as `defaultValues` to `CompanyForm`; uses `useUpdateCompany` (PUT) on submit; on success redirects to `/companies/[id]`; "Cancel" returns to detail page) in frontend/src/app/(dashboard)/companies/[id]/edit/page.tsx
- [ ] T027 [US4] Wire "Edit" button on the company detail page to navigate to `/companies/[id]/edit` in frontend/src/app/(dashboard)/companies/[id]/page.tsx

**Checkpoint**: US4 acceptance scenarios 1–4 from spec.md pass. Clearing the name field shows inline error without saving.

---

## Phase 7: User Story 5 — Soft Delete a Company (Priority: P2)

**Goal**: Authenticated user can delete a company; it disappears from all default list and search views immediately; the database row is preserved with `is_deleted = true`.

**Independent Test**: Delete a company from its detail page → redirected to list; deleted company is absent. Navigate directly to deleted company URL → not-found page. DB shell confirms `is_deleted = True` and `deleted_at` is set.

### Implementation for User Story 5

- [ ] T028 [US5] Implement `useDeleteCompany` mutation hook (`useMutation`; calls `deleteCompany(id)`; on success invalidates `["companies"]` list query only — does NOT re-fetch the deleted record's own query) in frontend/src/features/companies/hooks/useDeleteCompany.ts
- [ ] T029 [US5] Implement `DeleteCompanyButton` component (button triggers a confirmation dialog with company name; on confirm calls `useDeleteCompany(id).mutate()`; on success navigates to `/companies`; shows loading state while request is in flight) in frontend/src/features/companies/components/DeleteCompanyButton.tsx
- [ ] T030 [US5] Wire `DeleteCompanyButton` into the company detail page, replacing the "Delete" placeholder button in frontend/src/app/(dashboard)/companies/[id]/page.tsx

**Checkpoint**: US5 acceptance scenarios 1–3 from spec.md pass. Quickstart §US5 DB shell command confirms `is_deleted=True` and `deleted_at` timestamp.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Admin registration, automated tests, and final end-to-end validation of all user stories.

- [ ] T031 [P] Register `Company` in Django admin with `list_display = ("name", "industry", "owner", "is_deleted", "created_at")` and `list_filter = ("is_deleted",)` in backend/apps/companies/admin.py
- [ ] T032 [P] Implement Company model-level tests (soft delete sets `is_deleted=True` and `deleted_at`; `alive()` excludes deleted records; `dead()` returns only deleted; `__str__` returns company name; owner SET_NULL when user deleted) in backend/apps/companies/tests/test_models.py
- [ ] T033 [P] Implement API view tests using `CompanyFactory` and `UserFactory` covering: list returns only alive companies, `?q=` search, `?industry=` filter, `?ordering=` sort, paginated response shape, POST creates and returns 201, POST with blank name returns 400, GET 404 on soft-deleted id, PUT full update, PATCH partial update, DELETE returns 204 and sets is_deleted, 401 on all endpoints when unauthenticated in backend/apps/companies/tests/test_views.py
- [ ] T034 Run quickstart.md validation scenarios for all 5 user stories and edge-case checks against local dev servers; confirm all expected responses are received

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Requires Phase 1 complete — **blocks all story phases**
- **US1 (Phase 3)**: Requires Phase 2 complete — first independently testable MVP delivery
- **US2 (Phase 4)**: Requires Phase 2 complete — can run in parallel with US1 after Phase 2
- **US3 (Phase 5)**: Requires Phase 2 complete — can run in parallel with US1/US2 after Phase 2
- **US4 (Phase 6)**: Requires Phase 5 complete (edit page is accessed from the detail page)
- **US5 (Phase 7)**: Requires Phase 5 complete (delete button lives on the detail page)
- **Polish (Phase 8)**: Requires all story phases complete

### User Story Dependencies

- **US1 (P1)**: No story-level dependency — begins immediately after Phase 2
- **US2 (P1)**: No story-level dependency — can run in parallel with US1
- **US3 (P1)**: No story-level dependency — can run in parallel with US1/US2
- **US4 (P2)**: Depends on US3 (T024 detail page must exist before T026/T027 can wire into it)
- **US5 (P2)**: Depends on US3 (T024 detail page must exist before T029/T030 can wire into it)

### Within Each Phase

- T004 (model) → T005 (migration) → T006, T007, T008 (serializers, filters, pagination can then be parallel)
- T006, T007, T008 → T009 (viewset consumes all three)
- T009, T010 → T011 (URL wiring)
- T015 (api.ts) → T016, T017 (hooks and filters use api.ts)
- T016, T017 → T018 → T019 (table uses filters, page uses table + hook)
- T020, T021 → T022 (form page uses both form component and mutation hook)
- T023 → T024 (detail page uses useCompany hook)
- T024 → T025, T026, T027 (edit/delete depend on detail page)

---

## Parallel Opportunities

### Phase 2 Parallel Group (after T003–T005)

```text
T006  Implement CompanySerializer + CompanyWriteSerializer (serializers.py)
T007  Implement CompanyFilterSet + CompanySearchFilter (filters.py)
T008  Implement CompanyPageNumberPagination (pagination.py)
T012  Create CompanyFactory (tests/factories.py)
T013  Implement TypeScript types (frontend/src/features/companies/types.ts)
T014  Implement Zod schema (frontend/src/features/companies/schemas/company.ts)
```

### Phase 3 Parallel Group (after Phase 2)

```text
T016  useCompanies hook (hooks/useCompanies.ts)
T017  CompanyFilters component (components/CompanyFilters.tsx)
```

### Phase 8 Parallel Group (after all story phases)

```text
T031  Django admin registration (admin.py)
T032  Model-level tests (tests/test_models.py)
T033  API view tests (tests/test_views.py)
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US3 — all P1 stories)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (**CRITICAL** — run `python manage.py migrate` as checkpoint)
3. Complete Phase 3: US1 — verify list, search, filter, sort, pagination, URL state
4. Complete Phase 4: US2 — verify create form, validation, redirect on success
5. Complete Phase 5: US3 — verify detail page, navigation, 404 on deleted
6. **STOP and VALIDATE**: All P1 stories work end-to-end; run quickstart §US1–US3
7. Ready to start Contacts module planning or continue to P2 stories

### Incremental Delivery

1. Setup + Foundational → backend API live and smoke-tested
2. + US1 → list view fully functional
3. + US2 → create form functional
4. + US3 → detail view functional — **P1 MVP complete**
5. + US4 → edit form functional
6. + US5 → soft delete functional — **full Phase 1 feature complete**
7. + Polish → tests pass, admin registered, quickstart validated

### Parallel Team Strategy

With two developers after Phase 2 completes:
- **Developer A**: US1 (Phase 3) → US4 (Phase 6)
- **Developer B**: US2 (Phase 4) + US3 (Phase 5) → US5 (Phase 7)

---

## Notes

- Never call `Company.objects.filter(is_deleted=False)` directly — always use `Company.objects.alive()` from `SoftDeleteQuerySet` (from `apps.core.models.SoftDeleteMixin`)
- `created_by` must be set in `CompanyViewSet.perform_create(self, serializer)` via `serializer.save(created_by=self.request.user)`
- `CompanySearchFilter` and `CompanyFilterSet` are both needed on the viewset's `filter_backends` list simultaneously — they are not mutually exclusive
- DRF `OrderingFilter` must also be in `filter_backends` to honour the `?ordering=` param; `ordering_fields` must list all allowed columns explicitly (do not use `"__all__"`)
- The `CompanyForm` component is shared between create (US2) and edit (US4) — accept `defaultValues` and `onSubmit` as props; the page wires in the correct mutation hook
- `useRouter.replace` (not `push`) is used for URL param updates on filter/sort/page changes so browser history is not polluted with intermediate filter states
- Tests in Phase 8 are regression safety nets — not TDD; they document expected behaviour after implementation is complete
