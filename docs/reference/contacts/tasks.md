# Tasks: Contacts (People) Module

**Input**: `agent-os/specs/contacts/plan.md` + `agent-os/specs/contacts/spec.md`

**Branch**: `feat/contacts-module` | **Date**: 2026-06-14

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Django app skeleton and registration

- [ ] T001 Create contacts Django app skeleton files (apps.py, __init__.py, migrations/__init__.py, tests/__init__.py) in backend/apps/contacts/
- [ ] T002 Register contacts app in INSTALLED_APPS in backend/crm/settings.py and add api route in backend/crm/urls.py

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 Create Contact model (first_name, last_name, email, phone, title, company_fk nullable FK→Company, owner_fk nullable FK→User, is_deleted, created_at, updated_at, created_by) in backend/apps/contacts/models.py
- [ ] T004 [P] Generate initial Django migration for Contact model in backend/apps/contacts/migrations/0001_initial.py
- [ ] T005 [P] Create ContactFactory (extends CompanyFactory dependency) for test fixtures in backend/apps/contacts/tests/factories.py
- [ ] T006 [P] Define TypeScript Contact and ContactListItem types in frontend/src/features/contacts/types.ts
- [ ] T007 [P] Define Zod contact schema (first_name and last_name required; email, phone, title, company_id, owner_id optional) in frontend/src/features/contacts/schemas/contact.ts

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: US1 — Browse Contact List (Priority: P1) 🎯 MVP

**Goal**: Authenticated users see a paginated, searchable, filterable, sortable contacts table with full URL state persistence.

**Independent Test**: Navigate to `/contacts` as an authenticated user — confirm a table renders with contact rows, a search box, company and owner filter controls, sortable column headers, and page navigation. Enter a search term and verify the table updates to matching rows only. Confirm the URL reflects the search/filter/sort/page state.

- [ ] T008 [US1] Implement ContactSerializer with nested read-only company (id, name) and owner (id, full_name) objects plus writable company_id/owner_id fields in backend/apps/contacts/serializers.py
- [ ] T009 [US1] Implement ContactFilter (company_fk__id exact filter, owner_fk__id exact filter, Q icontains search over first_name/last_name/email/phone via ?q=) in backend/apps/contacts/filters.py
- [ ] T010 [US1] Implement ContactPageNumberPagination (page/page_size 1-based, max page_size=100, response includes count/next/previous) in backend/apps/contacts/pagination.py
- [ ] T011 [US1] Implement ContactViewSet list action (IsAuthenticated, ContactFilter, OrderingFilter default last_name asc, ordering_fields="\_\_all\_\_", pagination) in backend/apps/contacts/views.py
- [ ] T012 [US1] Register ContactViewSet with DRF router and wire into backend/crm/urls.py in backend/apps/contacts/urls.py
- [ ] T013 [P] [US1] Register Contact model in Django admin with list_display and search_fields in backend/apps/contacts/admin.py
- [ ] T014 [P] [US1] Implement contacts API client list() function (builds query string from params object, returns paginated response) in frontend/src/features/contacts/api.ts
- [ ] T015 [P] [US1] Implement useContactsSearchParams hook (reads and writes q, company, owner, ordering, page, page_size to URL via Next.js useSearchParams/router.replace) in frontend/src/features/contacts/hooks/useContactsSearchParams.ts
- [ ] T016 [P] [US1] Implement useContacts hook (TanStack Query v5, reads params from useContactsSearchParams, calls list API) in frontend/src/features/contacts/hooks/useContacts.ts
- [ ] T017 [US1] Build ContactFilters component (company searchable picker querying active companies via companies API, owner picker from users list) in frontend/src/features/contacts/components/ContactFilters.tsx
- [ ] T018 [US1] Build ContactTable component (TanStack Table v8, sortable column headers wired to URL ordering param, company name rendered as Next.js Link to /companies/[id]) in frontend/src/features/contacts/components/ContactTable.tsx
- [ ] T019 [US1] Build contacts list page (wires ContactTable, ContactFilters, search input, pagination controls; all state sourced from useContactsSearchParams) in frontend/src/app/(dashboard)/contacts/page.tsx

**Checkpoint**: US1 fully functional — list renders and responds to search, filter, sort, and pagination with bookmarkable URLs

---

## Phase 4: US2 — Create a Contact (Priority: P1)

**Goal**: Users click "New Contact," complete a form with required first_name and last_name (all other fields optional), and the new record appears in the list immediately after save.

**Independent Test**: Click "New Contact," fill in a first name and last name plus optional fields, submit — confirm the new record appears in the contact list and the detail view is accessible.

- [ ] T020 [US2] Add create action to ContactViewSet (IsAuthenticated, validates required fields, returns 201 with serialized contact) in backend/apps/contacts/views.py
- [ ] T021 [P] [US2] Extend contacts API client with create() function in frontend/src/features/contacts/api.ts
- [ ] T022 [P] [US2] Implement useCreateContact mutation hook (TanStack Query v5 mutation, invalidates contacts list on success) in frontend/src/features/contacts/hooks/useCreateContact.ts
- [ ] T023 [US2] Build ContactForm component (React Hook Form 7 + Zod 4 resolver; first_name and last_name required inline errors; company searchable picker showing active companies; owner picker) in frontend/src/features/contacts/components/ContactForm.tsx
- [ ] T024 [US2] Build create contact page (renders ContactForm, calls useCreateContact, redirects to /contacts/[id] on success) in frontend/src/app/(dashboard)/contacts/new/page.tsx

**Checkpoint**: US2 fully functional — new contacts can be created with validation and appear in the list

---

## Phase 5: US3 — View Contact Details (Priority: P1)

**Goal**: Clicking a contact row opens a detail page showing all fields; company name is a clickable link to /companies/[id]; soft-deleted contacts return 404.

**Independent Test**: Click any contact row — confirm detail page loads with all fields. Click company link — confirm navigation to `/companies/[company_id]`.

- [ ] T025 [US3] Add retrieve action to ContactViewSet (IsAuthenticated, returns 404 for is_deleted=True records) in backend/apps/contacts/views.py
- [ ] T026 [P] [US3] Extend contacts API client with retrieve() function in frontend/src/features/contacts/api.ts
- [ ] T027 [P] [US3] Implement useContact hook (TanStack Query v5, single contact by id, surfaces 404 error state) in frontend/src/features/contacts/hooks/useContact.ts
- [ ] T028 [US3] Build contact detail page (renders all fields, company name as Next.js Link to /companies/[id], empty state when no company, Edit button linking to /contacts/[id]/edit, 404 redirect on error) in frontend/src/app/(dashboard)/contacts/[id]/page.tsx

**Checkpoint**: US3 fully functional — contact detail displays all fields with navigable company link

---

## Phase 6: US4 — Edit a Contact (Priority: P2)

**Goal**: Users open the edit form from the detail page, modify one or more fields, and see updated values immediately; partial updates (PATCH) are supported.

**Independent Test**: Open detail page, click "Edit," change last name and title, save — confirm detail view reflects new values and updated_at timestamp has advanced.

- [ ] T029 [US4] Add update (PUT) and partial_update (PATCH) actions to ContactViewSet (IsAuthenticated, same validation as create, updates updated_at) in backend/apps/contacts/views.py
- [ ] T030 [P] [US4] Extend contacts API client with update() function (sends PATCH) in frontend/src/features/contacts/api.ts
- [ ] T031 [P] [US4] Implement useUpdateContact mutation hook (TanStack Query v5 mutation, invalidates contact and contacts list on success) in frontend/src/features/contacts/hooks/useUpdateContact.ts
- [ ] T032 [US4] Build edit contact page (prefills ContactForm with current contact values via useContact, submits PATCH via useUpdateContact, redirects to /contacts/[id] on success) in frontend/src/app/(dashboard)/contacts/[id]/edit/page.tsx

**Checkpoint**: US4 fully functional — contacts can be edited with validation; partial updates preserve unchanged fields

---

## Phase 7: US5 — Soft Delete a Contact (Priority: P2)

**Goal**: Deleting a contact sets is_deleted=true; it disappears from all default views; a company soft-delete nullifies linked contact.company_fk.

**Independent Test**: Delete a contact from its detail page — confirm it no longer appears in the list. Navigate to its URL — confirm 404. Confirm DB row has is_deleted=true.

- [ ] T033 [US5] Add destroy action to ContactViewSet (IsAuthenticated, sets is_deleted=True on the record, returns 204; does NOT hard-delete) in backend/apps/contacts/views.py
- [ ] T034 [US5] Implement company soft-delete signal (post_save on Company: when is_deleted flips True, bulk-update Contact.objects.filter(company_fk=instance) to company_fk=None) in backend/apps/contacts/signals.py
- [ ] T035 [US5] Wire signal registration in ContactsConfig.ready() in backend/apps/contacts/apps.py
- [ ] T036 [P] [US5] Extend contacts API client with delete() function in frontend/src/features/contacts/api.ts
- [ ] T037 [P] [US5] Implement useDeleteContact mutation hook (TanStack Query v5 mutation, invalidates contacts list on success) in frontend/src/features/contacts/hooks/useDeleteContact.ts
- [ ] T038 [US5] Build DeleteContactButton component (confirmation dialog before delete, calls useDeleteContact, redirects to /contacts on success) in frontend/src/features/contacts/components/DeleteContactButton.tsx
- [ ] T039 [US5] Integrate DeleteContactButton into contact detail page in frontend/src/app/(dashboard)/contacts/[id]/page.tsx

**Checkpoint**: US5 fully functional — soft delete works; company soft-delete cascade nullifies contact FK

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T040 [P] Add "Contacts" navigation entry and "New Contact" button to dashboard sidebar/layout
- [ ] T041 [P] Add empty-state message ("No contacts found") and loading skeleton to contacts list page in frontend/src/app/(dashboard)/contacts/page.tsx
- [ ] T042 [P] Add drf-spectacular @extend_schema annotations to ContactViewSet for OpenAPI docs in backend/apps/contacts/views.py
- [ ] T043 [P] Add 404 error handling (redirect to /contacts on not-found) to contact detail and edit pages in frontend/src/app/(dashboard)/contacts/[id]/page.tsx and frontend/src/app/(dashboard)/contacts/[id]/edit/page.tsx

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — **BLOCKS all user stories**
- **US1 (Phase 3)**: After Phase 2 — no story dependencies
- **US2 (Phase 4)**: After Phase 2 — no story dependencies (can run in parallel with US1)
- **US3 (Phase 5)**: After Phase 2 — no story dependencies (can run in parallel with US1 and US2)
- **US4 (Phase 6)**: After US3 (Phase 5) — edit page integrates with detail page
- **US5 (Phase 7)**: After US3 (Phase 5) — delete button lives on detail page
- **Polish (Phase 8)**: After all user stories complete

### User Story Dependencies

- **US1**: After Foundation — no story dependencies
- **US2**: After Foundation — shares Zod schema from T007
- **US3**: After Foundation — navigated to from US1 list rows
- **US4**: After US3 — edit page linked from detail page (T028)
- **US5**: After US3 — DeleteContactButton integrated into detail page (T039)

### Within Each User Story

- Backend: serializer/filter → viewset action → URL registration
- Frontend: API client → hooks (parallel) → components → page
- ContactViewSet grows incrementally — each phase adds HTTP actions to the same file

### Parallel Opportunities

- T004, T005, T006, T007 — all run in parallel after T003 (model complete)
- T013, T014, T015, T016 — run in parallel after T012 (URL registered, US1)
- T021, T022 — run in parallel after T020 (create action added, US2)
- T026, T027 — run in parallel after T025 (retrieve action added, US3)
- T030, T031 — run in parallel after T029 (update action added, US4)
- T034, T035 — run sequentially (signal then wire), T036 and T037 in parallel after T033

---

## Parallel Example: User Story 1

```bash
# After T007 (Foundation complete), run these in parallel:
Task T008: ContactSerializer in backend/apps/contacts/serializers.py
Task T009: ContactFilter in backend/apps/contacts/filters.py
Task T010: ContactPageNumberPagination in backend/apps/contacts/pagination.py

# After T012 (URL registered), run these in parallel:
Task T013: Register Contact in admin
Task T014: API client list() in frontend/src/features/contacts/api.ts
Task T015: useContactsSearchParams hook
Task T016: useContacts hook
```

---

## Implementation Strategy

### MVP First (P1 Stories: US1 + US2 + US3)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks everything)
3. Complete Phase 3: US1 — Browse List
4. Complete Phase 4: US2 — Create Contact
5. Complete Phase 5: US3 — View Detail
6. **STOP and VALIDATE**: All three P1 stories pass acceptance tests
7. Deploy / demo if ready

### Incremental Delivery

1. Setup + Foundational → app skeleton and model ready
2. Add US1 → list view functional (MVP browsing)
3. Add US2 → create flow functional
4. Add US3 → detail view and company link functional → **P1 MVP complete**
5. Add US4 → edit flow functional
6. Add US5 → soft delete + company signal functional → **All stories complete**

### Parallel Team Strategy

With multiple developers, after Phase 2:

1. Team completes Setup + Foundational together
2. Once Foundation is done:
   - Developer A: US1 (list) + US3 (detail) — sequential
   - Developer B: US2 (create) — independent
3. Once US3 is done, converge on US4 and US5

---

## Notes

- [P] tasks target different files and have no blocking dependency on incomplete tasks
- [Story] label maps each task to a specific user story for traceability
- No test tasks generated — tests not explicitly requested in spec.md
- ContactViewSet in `views.py` accumulates actions across phases (list → create → retrieve → update → destroy); each addition is safe because earlier actions are already tested
- The company soft-delete signal (T034–T035) is a critical correctness requirement from FR-017 and the design decision in plan.md — it must not be skipped
- The Zod schema (T007) is shared between the create form (US2) and the edit form (US4)
- The company picker on ContactForm must query only non-deleted companies (active) per design decisions in plan.md
