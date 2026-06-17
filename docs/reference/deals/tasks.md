---

description: "Task list for the Deals module implementation"
---

# Tasks: Deals (Opportunities) Module

**Input**: Design documents from `agent-os/specs/deals/`

**Prerequisites**: [plan.md](plan.md) · [spec.md](spec.md)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Exact file paths are included in every description

## Path Conventions

- Backend: `backend/apps/deals/` · `backend/crm/settings.py` · `backend/crm/urls.py`
- Frontend: `frontend/src/features/deals/` · `frontend/src/app/(dashboard)/deals/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Bootstrap the deals app so migrations can run and the router is wired up. No user story can begin until this is done.

- [x] T001 Create deals app skeleton — `backend/apps/deals/__init__.py`, `apps.py`, `admin.py` — and add `'apps.deals'` to `INSTALLED_APPS` in `backend/crm/settings.py`
- [x] T002 Create `backend/apps/deals/tests/__init__.py` to make the tests directory a package

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pipeline and Stage models, Deal model, migrations, seed data, serializers, filters, pagination, viewsets, and URL wiring — everything every user story depends on.

**⚠️ CRITICAL**: Must be complete before Phase 3+

- [x] T003 Define `Pipeline` model (plain `models.Model`; fields: `id`, `name CharField(200)`, `is_default BooleanField`; `db_table='deals_pipeline'`) and `Stage` model (plain `models.Model`; fields: `id`, `pipeline ForeignKey(Pipeline, CASCADE, related_name='stages')`, `name CharField(200)`, `order_index PositiveSmallIntegerField`, `probability PositiveSmallIntegerField`, `is_won BooleanField`, `is_lost BooleanField`; `db_table='deals_stage'`; `unique_together=[('pipeline','order_index')]`; `ordering=['order_index']`) in `backend/apps/deals/models.py`
- [x] T004 Define `Deal` model extending `TimestampedModel` (fields: `name CharField(500)`, `amount DecimalField(15,2) null/blank`, `currency CharField(max_length=3, default='USD')`, `close_date DateField null/blank`, `pipeline ForeignKey('deals.Pipeline', PROTECT, null/blank, related_name='deals')`, `stage ForeignKey('deals.Stage', PROTECT, null/blank, related_name='deals')`, `company_fk ForeignKey('companies.Company', SET_NULL, null/blank, related_name='deals')`, `primary_contact_fk ForeignKey('contacts.Contact', SET_NULL, null/blank, related_name='deals')`, `owner_fk ForeignKey(settings.AUTH_USER_MODEL, SET_NULL, null/blank, related_name='owned_deals')`, `probability PositiveSmallIntegerField null/blank`, `is_deleted BooleanField(default=False, db_index=True)`; `db_table='deals_deal'`; `ordering=['-created_at']`) in `backend/apps/deals/models.py`
- [x] T005 Generate `0001_initial.py` schema migration creating `deals_pipeline`, `deals_stage`, `deals_deal` tables in `backend/apps/deals/migrations/0001_initial.py` (run: `python manage.py makemigrations deals`)
- [x] T006 Write `0002_seed_pipeline.py` data migration seeding `Sales Pipeline` (is_default=True) with 6 stages per ADR-007 (Qualification 10%, Needs Analysis 25%, Proposal 50%, Negotiation 75%, Closed Won 100%/is_won=True, Closed Lost 0%/is_lost=True) via `RunPython(seed_pipeline, unseed_pipeline)` with `get_or_create` in `backend/apps/deals/migrations/0002_seed_pipeline.py`
- [x] T007 Run `python manage.py migrate` and verify both migrations apply cleanly — `GET /api/pipelines/` returns Sales Pipeline with 6 ordered stages (requires T011–T012 to be wired first; run after T012 if URL not yet registered)
- [x] T008 [P] Create `PipelineFactory` (`name` Sequence), `StageFactory` (links to `PipelineFactory`; `probability=10`; `is_won=False`; `is_lost=False`), and `DealFactory` (links to `StageFactory`; `name` Sequence; `currency='USD'`; all nullable FKs defaulting to None) in `backend/apps/deals/tests/factories.py`
- [x] T009 Implement `StageSerializer` (id, name, order_index, probability, is_won, is_lost), `PipelineSerializer` (id, name, is_default, nested `stages = StageSerializer(many=True, read_only=True)`), and `DealSerializer` in `backend/apps/deals/serializers.py` — DealSerializer: FK pairs as write `PrimaryKeyRelatedField` + read nested MinimalSerializer (CompanyMinimalSerializer, ContactMinimalSerializer, UserMinimalSerializer); `is_won = SerializerMethodField` → `obj.stage.is_won if obj.stage_id else False`; `is_lost = SerializerMethodField` → `obj.stage.is_lost if obj.stage_id else False`; `validate()` for probability auto-set (`if 'stage' in attrs and 'probability' not in self.initial_data: attrs['probability'] = attrs['stage'].probability`) and stage/pipeline mismatch check; `validate_amount` rejecting negatives; `validate_probability` rejecting values outside 0–100
- [x] T010 [P] Implement `DealFilter` FilterSet (NumberFilter fields: `stage → stage_id`, `pipeline → pipeline_id`, `owner → owner_fk_id`, `company → company_fk_id`; `Meta: model=Deal, fields=[...]`) in `backend/apps/deals/filters.py`
- [x] T011 [P] Implement `DealPageNumberPagination` subclass (`page`/`page_size`, 1-based, `max_page_size=100`, response shape: `count`/`next`/`previous`/`results`) in `backend/apps/deals/pagination.py`
- [x] T012 Implement `PipelineViewSet` (read-only list + retrieve; `queryset = Pipeline.objects.all().prefetch_related('stages')`; `IsAuthenticated`) and `DealViewSet` base (get_queryset: `Deal.objects.filter(is_deleted=False).select_related('pipeline','stage','company_fk','primary_contact_fk','owner_fk')`; `serializer_class = DealSerializer`; `pagination_class = DealPageNumberPagination`; `filter_backends = [DjangoFilterBackend, OrderingFilter]`; `filterset_class = DealFilter`; `ordering = ['-created_at']`; `ordering_fields = ['name','amount','close_date','probability','created_at','owner_fk']`; `permission_classes = [IsAuthenticated]`) in `backend/apps/deals/views.py`
- [x] T013 Register `PipelineViewSet` (basename `'pipeline'`) and `DealViewSet` (basename `'deal'`) with `DefaultRouter` in `backend/apps/deals/urls.py` (routes: `/api/pipelines/`, `/api/pipelines/{id}/`, `/api/deals/`, `/api/deals/{id}/`)
- [x] T014 Wire deals URLs in `backend/crm/urls.py` — add `path("api/", include("apps.deals.urls"))` (or extend existing `api/` path block to include deals routes alongside existing apps)
- [x] T015 [P] Define `Stage`, `Pipeline`, `Deal`, `PaginatedDeals`, `CreateDealInput`, `UpdateDealInput` TypeScript interfaces in `frontend/src/features/deals/types.ts` (mirror OpenAPI schema: `Deal` includes `is_won: boolean`, `is_lost: boolean`, `is_deleted: boolean`; FK read fields as `stage: Stage | null`, `pipeline: Pipeline | null`, etc.; write fields as `stage_id: number | null`, `pipeline_id: number | null`, etc.)
- [x] T016 [P] Define Zod schema `dealSchema` (name: required non-empty string max 500; amount: optional non-negative number; currency: optional string max 3 chars; probability: optional integer 0–100; close_date: optional date string) and `createDealSchema` / `updateDealSchema` in `frontend/src/features/deals/schemas/deal.ts`

**Checkpoint**: Migrations pass, seed pipeline + 6 stages present, URL registered, factory and TS types ready — story phases can begin

---

## Phase 3: User Story 1 — Browse the Deal List (Priority: P1) 🎯 MVP

**Goal**: Authenticated users see a paginated, searchable, filterable, sortable table of all active deals; URL reflects all query state.

**Independent Test**: Navigate to `/deals` as an authenticated user — confirm rows render with columns (Name, Amount, Stage, Probability, Close Date, Owner, Company). Enter "acme" in search — only matching rows appear. Apply Stage filter — list narrows. Copy URL into a new tab — same filtered view reproduced.

### Implementation for User Story 1

- [x] T017 [US1] Add Q-based free-text search to `DealViewSet.list()` (`q = request.query_params.get('q','').strip()`; if q: `queryset = queryset.filter(Q(name__icontains=q) | Q(company_fk__name__icontains=q))`; `company_fk` already in `select_related` so no N+1) in `backend/apps/deals/views.py`
- [x] T018 [P] [US1] Write list endpoint tests (unauthenticated → 401, returns only non-deleted deals, `?q=` matches deal name, `?q=` matches company name, `?stage=` filter, `?pipeline=` filter, `?owner=` filter, `?company=` filter, combined filters AND logic, `?ordering=name` ascending, default order is `-created_at`, pagination `count`/`next`/`previous`, `page_size=200` → 400, `page=abc` → 400, GET /api/pipelines/ returns Sales Pipeline with 6 stages) in `backend/apps/deals/tests/test_views.py`
- [x] T019 [P] [US1] Implement `fetchDeals(params)` (GET `/api/deals/` with q/stage/pipeline/owner/company/ordering/page/page_size query params) and `fetchPipelines()` (GET `/api/pipelines/`) API functions in `frontend/src/features/deals/api.ts`
- [x] T020 [P] [US1] Implement `useDeals(params)` TanStack Query hook (queryKey includes all filter params; `staleTime: 30_000`) and `useDealsSearchParams` hook (reads/writes `q`, `stage`, `pipeline`, `owner`, `company`, `ordering`, `page`, `page_size` via `useSearchParams` + `router.replace` without page reload) in `frontend/src/features/deals/hooks/useDeals.ts`
- [x] T021 [P] [US1] Implement `usePipelines()` TanStack Query hook (queryKey `['pipelines']`; used by filter dropdowns and form stage selectors; `staleTime: 300_000`) in `frontend/src/features/deals/hooks/usePipelines.ts`
- [x] T022 [P] [US1] Build `DealFilters` component — search input, Stage dropdown (options from selected pipeline's stages), Pipeline dropdown (from `usePipelines`), Owner input, Company input — all wired to `useDealsSearchParams` in `frontend/src/features/deals/components/DealFilters.tsx`
- [x] T023 [US1] Build `DealTable` component (TanStack Table v8; columns: Name (link to `/deals/[id]`), Amount, Stage (`stage.name`), Probability, Close Date, Owner (`owner.full_name`), Company (`company.name`); sortable column headers via `useDealsSearchParams`; won/lost badge from `deal.is_won`/`deal.is_lost` flags, not stage name comparison) in `frontend/src/features/deals/components/DealTable.tsx`
- [x] T024 [US1] Build deals list page composing `DealFilters`, `DealTable`, pagination controls, and "New Deal" button (links to `/deals/new`); all state from `useDealsSearchParams`; empty-state message when `count === 0` in `frontend/src/app/(dashboard)/deals/page.tsx`

**Checkpoint**: US1 fully functional — authenticated user can search by deal name or company name, filter by stage/pipeline/owner/company, sort, and paginate the deal list; URL is bookmarkable

---

## Phase 4: User Story 2 — Create a Deal (Priority: P1)

**Goal**: User clicks "New Deal," fills in name (required), optionally selects pipeline/stage/company/contact/owner/probability, submits — new deal appears in list with probability auto-set from stage unless user overrides.

**Independent Test**: Click "New Deal," enter name, select stage "Proposal" (order_index=3) — confirm probability field auto-populates to 50 without saving. Override to 35. Submit — confirm new deal in list with stage=Proposal and probability=35.

### Implementation for User Story 2

- [x] T025 [US2] Add `create` action to `DealViewSet` (standard `CreateModelMixin.create`; `validate()` in `DealSerializer` handles probability auto-set + stage/pipeline mismatch; `created_by` set from `request.user` via `TimestampedModel`) in `backend/apps/deals/views.py`
- [x] T026 [US2] Write create endpoint tests (valid name-only payload → 201 with `probability=null`, `is_won=false`, `is_lost=false`; with `stage_id` → probability auto-set from stage; with `stage_id + probability` → user value wins; blank name → 400; negative amount → 400; probability=150 → 400; stage from wrong pipeline → 400; unauthenticated → 401) in `backend/apps/deals/tests/test_views.py`
- [x] T027 [P] [US2] Write serializer tests (`validate()` auto-sets probability when stage provided and `probability` absent from `initial_data`; `validate()` preserves user probability when both provided; `validate()` raises on stage/pipeline mismatch; `validate_amount` rejects -1; `validate_probability` rejects 101; `get_is_won` returns `True` when stage.is_won=True; `get_is_lost` returns `True` when stage.is_lost=True; both return `False` when stage_id=None) in `backend/apps/deals/tests/test_serializers.py`
- [x] T028 [P] [US2] Implement `createDeal(input: CreateDealInput)` API function (POST `/api/deals/`) in `frontend/src/features/deals/api.ts`
- [x] T029 [P] [US2] Implement `useCreateDeal()` mutation hook (POST to `/api/deals/`; invalidates deals list on success; returns created deal for redirect) in `frontend/src/features/deals/hooks/useCreateDeal.ts`
- [x] T030 [US2] Build `DealForm` component (react-hook-form bound to `dealSchema` Zod; Pipeline selector from `usePipelines`; Stage selector filtered to selected pipeline's stages; stage `onChange` calls `setValue('probability', stage.probability)` only when `userOverrodeProbability` ref is `false`; probability field `onChange` sets `userOverrodeProbability = true`; shared by create and edit modes via `mode: 'create' | 'edit'` prop; inline validation errors on failing fields before submit) in `frontend/src/features/deals/components/DealForm.tsx`
- [x] T031 [US2] Build create deal page (renders `DealForm` in create mode with `useCreateDeal`; redirects to `/deals/[id]` on success) in `frontend/src/app/(dashboard)/deals/new/page.tsx`

**Checkpoint**: US2 fully functional — deal creation works end-to-end; probability auto-sets from stage; user override wins; all validation errors surface before network request

---

## Phase 5: User Story 3 — View Deal Details (Priority: P1)

**Goal**: User clicks a deal row and sees a detail page with all ERD-specified fields and a won/lost badge driven by stage flags, not stage name.

**Independent Test**: Click any deal row — confirm detail page shows name, amount, currency, close date, pipeline, stage, probability, company, primary contact, owner, `is_won`/`is_lost` badge, `created_at`, `updated_at`. For a Closed Won deal: confirm "Won" badge visible (from `is_won=true`, not stage name comparison). Navigate to a soft-deleted deal URL — confirm 404.

### Implementation for User Story 3

- [x] T032 [US3] Add `retrieve` action to `DealViewSet` (standard `RetrieveModelMixin.retrieve`; `get_object` uses `is_deleted=False` queryset — soft-deleted deals return 404) in `backend/apps/deals/views.py`
- [x] T033 [US3] Write retrieve endpoint tests (exists → 200 with all fields including `is_won`/`is_lost`, `is_won=true` for Closed Won stage, `is_lost=true` for Closed Lost stage, soft-deleted → 404, non-existent → 404, unauthenticated → 401) in `backend/apps/deals/tests/test_views.py`
- [x] T034 [P] [US3] Implement `fetchDeal(id: number)` API function (GET `/api/deals/{id}/`) in `frontend/src/features/deals/api.ts`
- [x] T035 [P] [US3] Implement `useDeal(id: number)` TanStack Query hook (queryKey `['deal', id]`; fetches single deal) in `frontend/src/features/deals/hooks/useDeal.ts`
- [x] T036 [US3] Build deal detail page — display all ERD fields (name, amount, currency, close date, pipeline, stage, probability, company, primary contact, owner, `created_at`, `updated_at`); "Won" badge when `deal.is_won === true`; "Lost" badge when `deal.is_lost === true` (badge driven by API flags, no stage-name string comparison in frontend); "Edit" button linking to `/deals/[id]/edit`; "Delete" placeholder button; 404 redirect on not-found in `frontend/src/app/(dashboard)/deals/[id]/page.tsx`

**Checkpoint**: US3 fully functional — detail page renders all fields; is_won/is_lost badges appear for correct stages (flag-based); soft-deleted deal URL returns 404

---

## Phase 6: User Story 4 — Edit a Deal (Priority: P2)

**Goal**: User edits any deal field; stage change auto-updates probability (overridable); save reflects changes immediately with `updated_at` advanced.

**Independent Test**: Open deal edit page, change stage from Qualification to Proposal — confirm probability field updates to 50 without saving. Override to 45. Save — confirm detail view shows stage=Proposal, probability=45, `updated_at` advanced.

### Implementation for User Story 4

- [x] T037 [US4] Add `update` and `partial_update` actions to `DealViewSet` (standard `UpdateModelMixin`; `validate()` in serializer handles probability auto-set with PATCH fallback: `stage = attrs.get('stage') or (self.instance and self.instance.stage)` / `pipeline = attrs.get('pipeline') or (self.instance and self.instance.pipeline)`; `updated_by` set from `request.user` via `TimestampedModel`) in `backend/apps/deals/views.py`
- [x] T038 [US4] Write update/partial_update tests (valid PUT → 200 with all updated fields; PATCH with stage_id only → probability auto-updated from stage; PATCH with stage_id + probability → user value wins; clear name → 400; negative amount via PATCH → 400; stage from wrong pipeline via PATCH → 400; unauthenticated → 401) in `backend/apps/deals/tests/test_views.py`
- [x] T039 [P] [US4] Implement `updateDeal(id: number, input: UpdateDealInput)` API function (PATCH `/api/deals/{id}/`) in `frontend/src/features/deals/api.ts`
- [x] T040 [P] [US4] Implement `useUpdateDeal()` mutation hook (PATCH to `/api/deals/[id]/`; invalidates `['deal', id]` and deals list on success) in `frontend/src/features/deals/hooks/useUpdateDeal.ts`
- [x] T041 [US4] Build deal edit page (loads deal via `useDeal`; renders `DealForm` in edit mode pre-populated with current values; uses `useUpdateDeal`; `userOverrodeProbability` ref initialised to `true` on load so existing probability is not overwritten until user changes stage; redirects to `/deals/[id]` on success) in `frontend/src/app/(dashboard)/deals/[id]/edit/page.tsx`

**Checkpoint**: US4 fully functional — PATCH with stage_id only auto-sets probability; PATCH with stage_id + probability uses user value; edit page pre-populates correctly; saving redirects to detail with updated values

---

## Phase 7: User Story 5 — Soft Delete a Deal (Priority: P2)

**Goal**: User deletes a deal — it disappears from all default views; the database row is preserved with `is_deleted=True`.

**Independent Test**: Delete a deal from its detail page — confirm redirect to list and deal absent. Navigate to `/deals/[id]` — confirm 404. Check DB row has `is_deleted=True`. Verify lead's `converted_deal_fk` still references the deleted deal (no cascade).

### Implementation for User Story 5

- [x] T042 [US5] Override `DealViewSet.destroy()` to set `is_deleted=True` and `save(update_fields=['is_deleted','updated_at'])` → return `204 No Content` (do NOT call `super().destroy()` — that would hard-delete) in `backend/apps/deals/views.py`
- [x] T043 [US5] Write destroy tests (DELETE → 204; subsequent GET `/api/deals/{id}/` → 404; DB row has `is_deleted=True` and all other fields intact; GET `/api/deals/` list excludes soft-deleted deal; unauthenticated DELETE → 401; DELETE on already-deleted → 404) in `backend/apps/deals/tests/test_views.py`
- [x] T044 [P] [US5] Implement `deleteDeal(id: number)` API function (DELETE `/api/deals/{id}/`) in `frontend/src/features/deals/api.ts`
- [x] T045 [P] [US5] Implement `useDeleteDeal()` mutation hook (DELETE to `/api/deals/[id]/`; invalidates deals list on success; clears `['deal', id]` from query cache) in `frontend/src/features/deals/hooks/useDeleteDeal.ts`
- [x] T046 [US5] Build `DeleteDealButton` component (confirmation dialog before delete; calls `useDeleteDeal`; disabled state during mutation; on success navigates to `/deals`; wire into deal detail page at `frontend/src/app/(dashboard)/deals/[id]/page.tsx`) in `frontend/src/features/deals/components/DeleteDealButton.tsx`

**Checkpoint**: US5 fully functional — soft delete works end-to-end; deleted deal returns 404 from API; list excludes it; DB row preserved

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Model-level tests, seed idempotency, admin registration, OpenAPI regen, and final validation.

- [ ] T047 [P] Write model tests (`Pipeline.is_default` defaults to False; `Stage.ordering` is `['order_index']`; `Stage.unique_together` enforces pipeline+order_index uniqueness; `Deal.is_deleted` defaults to False; `Deal.currency` defaults to `'USD'`; `Deal.ordering` is `['-created_at']`; `Deal.pipeline` FK raises `ProtectedError` when deleted with existing deal; `Deal.stage` FK raises `ProtectedError` when deleted with existing deal; `Deal.company_fk` SET_NULL when company deleted) in `backend/apps/deals/tests/test_models.py`
- [ ] T048 [P] Write seed migration idempotency test (call `seed_pipeline` twice on a clean schema; assert exactly 1 pipeline named 'Sales Pipeline' and exactly 6 stages; assert stage probabilities match ADR-007 values; assert `is_won=True` only on Closed Won; assert `is_lost=True` only on Closed Lost) in `backend/apps/deals/tests/test_seed.py`
- [ ] T049 [P] Register `Pipeline`, `Stage`, and `Deal` in `backend/apps/deals/admin.py` with `list_display` (Deal: name, stage, pipeline, owner_fk, probability, is_deleted) and `list_filter` (is_deleted, stage, pipeline)
- [ ] T050 [P] Add drf-spectacular `@extend_schema` annotations to `PipelineViewSet` and `DealViewSet` (request/response schemas; 400/401/404 response codes documented; `destroy` annotated as soft-delete) in `backend/apps/deals/views.py`
- [x] T051 [P] Add `deals` nav link to the sidebar component in `frontend/src/app/(dashboard)/` layout so the Deals section is accessible from all dashboard pages
- [ ] T052 [P] Regenerate OpenAPI schema (`python manage.py spectacular --file docs/openapi.yaml`) and verify Deals (`/api/deals/`) and Pipelines (`/api/pipelines/`) endpoints are present with correct schemas
- [ ] T053 [P] Update `docs/erd.md` to reflect `deals_pipeline`, `deals_stage`, and `deals_deal` tables as implemented — add FK arrows, note `is_deleted` soft-delete, note `is_won`/`is_lost` as stage-level flags computed at serialisation time

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — **blocks all user story phases**
- **US1, US2, US3 (Phases 3–5)**: All depend on Phase 2; all three are P1 — proceed in priority order or in parallel if staffed
- **US4, US5 (Phases 6–7)**: Depend on Phase 2; US4 and US5 detail-page integration requires US3 detail page; backend tasks within US4–US5 can start as soon as Phase 2 is done
- **Polish (Phase 8)**: Can start once Phases 2–7 are complete; individual tasks are all independent

### User Story Dependencies

| Story | Depends on | Notes |
|---|---|---|
| US1 (Browse List) | Phase 2 | Fully independent — entry point for all deal flows |
| US2 (Create) | Phase 2 | Fully independent; list page (US1) needed for UX navigation only |
| US3 (View Detail) | Phase 2 | Fully independent; list page (US1) needed to navigate to detail |
| US4 (Edit) | US3 | Edit page is a sibling route of detail; `DealForm` is shared from US2 |
| US5 (Soft Delete) | US3 | `DeleteDealButton` lives on detail page; `useDeleteDeal` is independent |

### Within Each User Story

- Backend: models → serializers → filters → viewset action → tests
- Frontend: TypeScript types → Zod schema → API client → hooks → components → page
- Backend and frontend tasks marked `[P]` within a story can run in parallel once their story's backend action task is complete

---

## Parallel Opportunities

### Phase 2 (after T003–T007 complete sequentially)

```
T008 (factories)   ──┐
T009 (serializers) ──┤ serializers block all frontend work; start T010–T016 once T003–T005 done
T010 (filters)     ──┤
T011 (pagination)  ──┤ T010, T011, T015, T016 fully parallel (different files)
T015 (TS types)    ──┤
T016 (Zod schema)  ──┘
```

### Phase 3 (US1 — after T017 complete)

```
T018 (list tests)    ──┐
T019 (api.ts)        ──┤
T020 (useDeals hook) ──┤ all in parallel (different files)
T021 (usePipelines)  ──┤
T022 (DealFilters)   ──┘
```

### Phase 4 (US2 — after T025–T026 complete)

```
T027 (serializer tests) ──┐
T028 (api.ts createDeal) ──┤ parallel
T029 (useCreateDeal)     ──┘
```

### Phase 7 (US5 — after T042 complete)

```
T044 (api.ts deleteDeal) ──┐ parallel
T045 (useDeleteDeal)     ──┘
```

### Phase 8 (all independent)

```
T047  T048  T049  T050  T051  T052  T053  ← all in parallel
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US3 — all P1)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (migrations, seed data, URL wiring, serializers, factories, types)
3. Complete Phase 3: US1 — list view with search/filter/sort
4. Complete Phase 4: US2 — create form with probability auto-set
5. Complete Phase 5: US3 — detail view with won/lost badge
6. **STOP and VALIDATE**: All P1 stories independently functional; seed pipeline visible in form dropdowns
7. Deploy/demo MVP

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → test independently → deploy (users can browse deals)
3. US2 → test independently → deploy (users can create deals)
4. US3 → test independently → deploy (users can view deal details)
5. US4 → test independently → deploy (users can edit deals)
6. US5 → test independently → deploy (users can delete deals)
7. Polish → final QA + OpenAPI regen + ERD update

---

## Notes

- `[P]` tasks target different files with no blocking dependencies — safe to run simultaneously
- `[US#]` label maps each task to its user story for traceability and MVP scoping
- `is_won` and `is_lost` are **never stored on the Deal row** — they are computed in `DealSerializer.get_is_won` / `get_is_won` from `deal.stage.is_won` and `deal.stage.is_lost`; no stage-name string comparison anywhere in backend or frontend
- `select_related('company_fk')` on the base queryset covers the `company_fk__name` JOIN used in the `?q=` search — no extra query per row (N+1 prevented by design)
- `DealForm.userOverrodeProbability` ref: initialised `false` on create, `true` on edit; stage `onChange` checks this before calling `setValue('probability', ...)` — ensures edit pre-populated probability is not silently overwritten until user changes stage
- On PATCH, `validate()` falls back to `self.instance.stage` / `self.instance.pipeline` for whichever FK is absent from the payload — stage/pipeline mismatch is caught even on partial updates
- `leads/0003_add_converted_deal_fk` migration depends on `('deals', '0001_initial')` — it lives in the leads app, not here; once deals is installed and migrated, that leads migration can run automatically
- Soft-delete queryset filter (`is_deleted=False`) is set at the ViewSet level in `get_queryset`; never bypass it with `Deal.objects.all()`
- `currency` stores any 3-character string as-is; no ISO 4217 validation or currency conversion in Phase 1
