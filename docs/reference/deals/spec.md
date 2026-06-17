# Feature Specification: Deals (Opportunities) Module

**Feature Branch**: `feat/deals-module`

**Created**: 2026-06-15

**Status**: Draft

**Input**: User description: "Deals (Opportunities) module — Phase 1, Module 4. Deals represent qualified opportunities in a sales pipeline. ADR-007 (default pipeline and stage seed data) is decided. Full CRUD, list with pagination/filtering/search/ordering, Pipeline and Stage models, seed data migration, soft delete."

---

## Context & Scope

This spec covers the Deals module — the fourth CRM entity module, sitting above Contacts, Companies, and Leads in the dependency chain. A deal in this system represents a qualified sales opportunity: a potential transaction that has been accepted into the pipeline and is being actively pursued. Deals are organised into Pipelines and move through Stages, each carrying a probability and terminal flags for won/lost outcomes.

**One architectural decision is fixed and must not be re-opened:**

- **ADR-007** — Deal stage seed data: One default pipeline `Sales Pipeline` (`is_default=true`) is seeded with six stages in order: Qualification (10%), Needs Analysis (25%), Proposal (50%), Negotiation (75%), Closed Won (100%, `is_won=true`), Closed Lost (0%, `is_lost=true`). Won/Lost status is determined by the `is_won`/`is_lost` flags on Stage — not by hardcoded stage names. Seeded via Django data migration.

**In scope:**

- Pipeline and Stage models.
- Seed data migration for the default pipeline and six stages per ADR-007.
- Deal data model with all ERD-specified fields.
- Full CRUD REST API with soft delete.
- List endpoint with pagination, filtering by stage/pipeline/owner/company, free-text search, and ordering.
- Frontend list view, detail/edit view, and create form.

**Explicitly out of scope:**

- Hard (permanent) delete — the database row is never physically removed.
- Kanban board / drag-and-drop pipeline view (Phase 2).
- Multiple pipelines or user-managed stage configuration (Phase 2).
- Activity, Note, and Attachment associations (separate modules).
- Role-based record-level visibility restrictions — all authenticated users see all active deals in Phase 1.
- Deal import/export or bulk operations.
- Forecasting or reporting dashboards.
- Email/calendar integrations.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Browse the Deal List (Priority: P1)

A sales user opens the Deals section and sees a paginated table of all active deals. They can search by deal name or company name; filter by stage, pipeline, owner, or company; sort by any column; and navigate between pages without losing their query state.

**Why this priority**: The list view is the entry point for all deal management. It must exist before any other deal workflow is reachable and proves the search, filter, pagination, and ordering plumbing works.

**Independent Test**: Navigate to the deals list page as an authenticated user — confirm a table renders with deal rows, a search box, filter controls (stage, pipeline, owner, company), column sort headers, and page navigation. Enter a search term; verify the table updates to matching rows. Confirm the URL reflects the current query state.

**Acceptance Scenarios**:

1. **Given** an authenticated user on the deals list page with no filters, **When** the page loads, **Then** all non-deleted deals are returned in the default sort order (created date descending) with pagination controls visible.
2. **Given** a search term entered in the search box, **When** the user submits the search, **Then** only deals whose name or associated company name contains the search term are shown.
3. **Given** a stage filter selected, **When** applied, **Then** only deals at that stage appear in the table.
4. **Given** a pipeline filter selected, **When** applied, **Then** only deals in that pipeline appear.
5. **Given** an owner filter selected, **When** applied, **Then** only deals assigned to that owner appear.
6. **Given** a company filter selected, **When** applied, **Then** only deals linked to that company appear.
7. **Given** multiple filters applied simultaneously, **When** the list loads, **Then** all active filters are combined with AND logic.
8. **Given** a column sort header clicked, **When** the user clicks it, **Then** the table reorders by that column; a second click reverses the direction.
9. **Given** results spanning multiple pages, **When** the user navigates to page 2, **Then** the next set of results is shown and the URL reflects `page=2`.
10. **Given** active filter/search/page/sort state, **When** the user copies and opens the URL in a new tab, **Then** the exact same filtered view is reproduced.

---

### User Story 2 — Create a Deal (Priority: P1)

A sales user clicks "New Deal," fills out the create form (deal name is the only mandatory field), selects a pipeline/stage, optionally links a company and contact, and submits. The new deal appears in the list with its probability automatically set from the chosen stage.

**Why this priority**: Deal creation is the primary entry point for the sales pipeline. Without create, no other deal workflow delivers value.

**Independent Test**: Click "New Deal," fill in a name, select a stage (e.g., Qualification), optionally set amount and close date, and submit — confirm the new record appears in the deal list with probability auto-populated from the stage, and that the detail view is accessible.

**Acceptance Scenarios**:

1. **Given** a user on the create deal form, **When** they submit with a valid deal name and a stage selection, **Then** a new deal is created with probability auto-set from the stage, the user is redirected to the detail view, and the record appears in the list.
2. **Given** a user who leaves the deal name blank, **When** they attempt to submit, **Then** a validation error is shown on the name field and the form is not submitted.
3. **Given** a user who selects a stage, **When** the stage selection changes, **Then** the probability field is automatically updated to match the stage's probability value but remains editable.
4. **Given** a user who manually overrides the probability after selecting a stage, **When** the form is submitted, **Then** the deal is saved with the user-specified probability, not the stage default.
5. **Given** a user who links a company and a primary contact, **When** the form is submitted, **Then** the deal is linked to both and they appear on the detail view.
6. **Given** a user who leaves company and contact fields empty, **When** the form is submitted, **Then** the deal is created with no company or contact association and no error is raised.
7. **Given** a user who selects the Closed Won stage, **When** the deal is saved, **Then** the deal is marked as won (determined by `is_won=true` on the stage, not by the stage name).
8. **Given** a user who abandons the form without saving, **When** they navigate away, **Then** no record is created.

---

### User Story 3 — View Deal Details (Priority: P1)

A user clicks a deal row in the list and is taken to a detail page showing all stored information for that deal — name, amount, currency, close date, pipeline, stage, probability, linked company, primary contact, and owner.

**Why this priority**: The detail view is required before editing. It must display all ERD-specified fields and make the deal's pipeline position clear.

**Independent Test**: Click any deal row in the list — confirm a detail page loads showing all fields (name, amount, currency, close date, pipeline, stage, probability, company, primary contact, owner, won/lost status badge, timestamps). Confirm the stage's probability is shown alongside any user-overridden value.

**Acceptance Scenarios**:

1. **Given** a user on the deal list, **When** they click a deal row, **Then** the detail page loads showing all ERD-specified fields for that deal.
2. **Given** a deal whose stage has `is_won=true`, **When** the user views the detail page, **Then** a "Won" badge or indicator is visible (determined by the stage flag, not the stage name).
3. **Given** a deal whose stage has `is_lost=true`, **When** the user views the detail page, **Then** a "Lost" badge or indicator is visible.
4. **Given** a direct URL to a soft-deleted deal, **When** any user navigates to it, **Then** a "not found" response is returned.
5. **Given** an unauthenticated user navigating to any deal URL, **When** the page loads, **Then** they are redirected to the login page.

---

### User Story 4 — Edit a Deal (Priority: P2)

A user opens a deal detail page, modifies one or more fields (name, amount, currency, close date, stage, pipeline, company, contact, owner, or probability), and saves. Changing the stage auto-updates probability but the user may override it.

**Why this priority**: Deal data evolves throughout the sales cycle. Editing is essential for keeping pipeline data current. P2 because list, create, and detail must exist first.

**Independent Test**: Open a deal detail page, click "Edit," change the stage from Qualification to Proposal, confirm the probability field updates to 50%, override the probability to 45%, and save — confirm the detail view shows the new stage and the user-specified probability of 45%.

**Acceptance Scenarios**:

1. **Given** a user on a deal detail page, **When** they click "Edit," change the amount, and save, **Then** the detail view reflects the updated amount and `updated_at` has advanced.
2. **Given** a user editing a deal, **When** they clear the deal name and attempt to save, **Then** a validation error is shown and the update is not applied.
3. **Given** a user who changes the stage, **When** the stage changes, **Then** the probability field is automatically updated to the new stage's probability; the user can still override it before saving.
4. **Given** a user who saves a stage change without overriding probability, **When** the deal is saved, **Then** the deal probability equals the stage's probability.
5. **Given** a user who changes the stage and overrides probability, **When** the deal is saved, **Then** the deal probability equals the user-specified value.
6. **Given** a partial update where only the close date is changed, **When** saved, **Then** only the close date changes; all other fields retain their previous values.
7. **Given** a user who removes the company link, **When** saved, **Then** the deal's company association is cleared and the deal is preserved.

---

### User Story 5 — Soft Delete a Deal (Priority: P2)

A user deletes a deal from the detail page. The deal is hidden from all default views but the data is preserved in the system.

**Why this priority**: Data is never permanently destroyed in Phase 1. Soft delete maintains historical integrity (e.g., for converted leads still linked to this deal).

**Independent Test**: Delete a deal from its detail page — confirm it no longer appears in the list. Attempt to navigate to its URL — confirm a "not found" response. Confirm the row still exists in the database with `is_deleted = true`.

**Acceptance Scenarios**:

1. **Given** a user on a deal detail page, **When** they confirm deletion, **Then** the deal is marked deleted, the user is returned to the list, and the deleted deal does not appear in the list.
2. **Given** a deleted deal's identifier, **When** a client requests it via the detail URL, **Then** a "not found" response is returned.
3. **Given** a deal linked to a converted Lead, **When** the deal is soft-deleted, **Then** the Lead's `converted_deal_fk` still references the deal; the Lead record is not affected.
4. **Given** the owner of a deal is removed from the system, **When** the deal list is viewed, **Then** the deal still appears with its owner field empty; it is not deleted.

---

### Edge Cases

- What happens when the search query matches no deals? → An empty list is returned with a count of zero; the UI shows an empty state message rather than an error.
- What if `page` or `page_size` is supplied with a non-integer value? → The API returns a 400 validation error with a descriptive message.
- What if `page_size` exceeds the maximum safe value? → The API caps the page size at 100 or returns a 400 error for out-of-range values.
- What if the referenced company is soft-deleted after a deal is created? → The deal still exists with the company FK intact; the company link may display a degraded state in the UI.
- What if the referenced pipeline is deleted? → Pipeline deletion is blocked (`PROTECT`) if any deals exist in it; the API returns a descriptive error.
- What if the referenced stage is deleted? → Stage deletion is blocked (`PROTECT`) if any deals reference it; the API returns a descriptive error.
- What if `amount` is submitted as a negative number? → The API returns a 400 validation error; amount must be zero or positive.
- What if `probability` is submitted outside the 0–100 range? → The API returns a 400 validation error.
- What if `close_date` is in the past? → The API accepts it without error; past close dates are valid for historical deals.
- What if two users edit the same deal simultaneously? → Last-write-wins in Phase 1; no optimistic concurrency control is required.
- What if `currency` is not provided? → The system defaults to `USD`; no error is raised.
- What if a stage belongs to a different pipeline than the one selected on the deal? → The API returns a 400 validation error; stage must belong to the deal's pipeline.

---

## Requirements *(mandatory)*

### Functional Requirements

**Pipeline and Stage Management**

- **FR-001**: The system MUST define a `Pipeline` entity with fields: `id`, `name`, `is_default`.
- **FR-002**: The system MUST define a `Stage` entity with fields: `id`, `pipeline_fk`, `name`, `order_index`, `probability` (0–100), `is_won` (boolean), `is_lost` (boolean).
- **FR-003**: The system MUST seed one default pipeline `Sales Pipeline` (`is_default=true`) with six stages per ADR-007 via a Django data migration.
- **FR-004**: Won/Lost status on a deal MUST be determined by the `is_won`/`is_lost` flags on the deal's current stage; hardcoded stage-name checks are explicitly prohibited.
- **FR-005**: Deleting a pipeline that has associated deals MUST be blocked; the system MUST return a descriptive error.
- **FR-006**: Deleting a stage that has associated deals MUST be blocked; the system MUST return a descriptive error.

**Deal Record Management**

- **FR-007**: The system MUST allow authenticated users to create a deal record; `name` is the only mandatory field.
- **FR-008**: The system MUST reject any create or update request that leaves `name` blank or absent.
- **FR-009**: All remaining fields (`amount`, `currency`, `close_date`, `pipeline_fk`, `stage_fk`, `company_fk`, `primary_contact_fk`, `owner_fk`, `probability`) MUST be optional; the system MUST accept a deal with none of them provided.
- **FR-010**: When a stage is set or changed, the system MUST automatically set `probability` to the stage's `probability` value unless the user explicitly provides a different probability in the same request.
- **FR-011**: The system MUST allow the user to override `probability` to any integer value in the range 0–100, independent of the stage's default probability.
- **FR-012**: `probability` MUST be rejected if outside the range 0–100; the system MUST return a 400 validation error.
- **FR-013**: `amount` MUST be rejected if negative; the system MUST return a 400 validation error.
- **FR-014**: `stage_fk` MUST reference a stage that belongs to the deal's `pipeline_fk`; a mismatch MUST result in a 400 validation error.
- **FR-015**: The system MUST automatically populate `created_at`, `updated_at`, and `created_by` at creation; `updated_at` and `updated_by` MUST be refreshed on every successful update.
- **FR-016**: The system MUST support full and partial updates to all user-editable fields.

**Relationship Constraints**

- **FR-017**: `company_fk` MUST be nullable; if the referenced company is removed or soft-deleted, `company_fk` MUST be set to null (`SET_NULL`) and the deal MUST be preserved.
- **FR-018**: `primary_contact_fk` MUST be nullable; if the referenced contact is removed or soft-deleted, `primary_contact_fk` MUST be set to null (`SET_NULL`) and the deal MUST be preserved.
- **FR-019**: `owner_fk` MUST be nullable; if the referenced user is removed, `owner_fk` MUST be set to null (`SET_NULL`) and the deal MUST be preserved.
- **FR-020**: `pipeline_fk` uses `PROTECT` on delete; removing a pipeline with existing deals MUST be blocked.
- **FR-021**: `stage_fk` uses `PROTECT` on delete; removing a stage with existing deals MUST be blocked.

**List, Search, Filter, and Sort**

- **FR-022**: The list endpoint MUST return only non-deleted deals by default; soft-deleted deals MUST be excluded from all default views.
- **FR-023**: The list MUST be paginated; clients MUST be able to specify `page` and `page_size`; the response MUST include total record count and next/previous page indicators.
- **FR-024**: The system MUST support free-text search via a `?q=` parameter that matches across deal `name` and associated company name.
- **FR-025**: The system MUST support filtering the list by `stage`, `pipeline`, `owner`, and `company`; filters MUST be combinable.
- **FR-026**: The system MUST support ordering the list by any user-visible column; default ordering is by `created_at` descending.
- **FR-027**: All active query parameters — pagination, filters, search, and ordering — MUST be reflected in the page URL so that a view can be bookmarked or shared.

**Soft Delete**

- **FR-028**: Deleting a deal MUST set `is_deleted = true` on the record; the underlying database row MUST NOT be removed.
- **FR-029**: A request to view, edit, or operate on a soft-deleted deal MUST return a "not found" response identical to a record that never existed.

**Access Control**

- **FR-030**: All deal endpoints (list, create, retrieve, update, delete) MUST require an authenticated session; unauthenticated requests MUST receive a 401 response.

**Module Isolation and Dependency Order**

- **FR-031**: The deals app MUST be installable and migratable before the leads app; specifically, the `leads/0003_add_converted_deal_fk` migration depends on the deals app being present.
- **FR-032**: The dependency order MUST be: core ← accounts ← companies ← contacts ← leads ← deals. No circular imports are permitted.

### Key Entities

- **Pipeline**: Represents a named sales pipeline workflow. Has one default pipeline (`Sales Pipeline`) seeded at deploy time. Pipelines have an ordered set of stages.
- **Stage**: A named step within a pipeline. Carries an `order_index` for display ordering, a `probability` (0–100) indicating the default win likelihood at that stage, and boolean flags `is_won` / `is_lost` to mark terminal stages. No two stages in the same pipeline may share the same `order_index`.
- **Deal**: A qualified sales opportunity actively being pursued. Links to a Pipeline, a Stage (which drives probability), optionally a Company, an optional primary Contact, and an optional owning User. Tracks the financial value (`amount`, `currency`) and target close date. Soft-deleted via `is_deleted`; never physically removed.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can locate a specific deal by name or company name using the search box and see results within 2 seconds on a standard broadband connection.
- **SC-002**: The deal list view updates to reflect new search terms, filters, or sort selections without a full page reload.
- **SC-003**: Creating a new deal from the form takes no more than 3 user actions from the list page (click "New Deal," fill required fields, click "Save").
- **SC-004**: Changing the stage on the create or edit form immediately updates the probability field in the UI without a round-trip to the server.
- **SC-005**: A newly created deal appears in the deal list within the same page load after form submission; no stale state is shown.
- **SC-006**: Navigating to a shared URL that encodes search/filter/page/sort parameters reproduces the exact same deal list view for any authenticated user.
- **SC-007**: A soft-deleted deal is invisible in all default list and search views within the same request cycle as the delete action.
- **SC-008**: All deal form validations surface descriptive inline errors on the failing field before any request is sent to the server.
- **SC-009**: The list view renders correctly for 0 results (empty-state message), 1 result, and results spanning multiple pages; no UI breakage occurs at boundary conditions.
- **SC-010**: The default seed pipeline and six stages are present in every freshly migrated environment without any manual data entry.

---

## Assumptions

- Deal `name` is not required to be unique; duplicate names across deals are permitted.
- `currency` defaults to `USD` when not provided; no currency conversion or multi-currency arithmetic is performed in Phase 1.
- `probability` is an integer (0–100); decimal probabilities are not supported in Phase 1.
- `close_date` is a date (not datetime); no timezone adjustment is applied.
- `amount` is a decimal number (up to 2 decimal places); it must be zero or positive.
- `created_by` and `updated_by` are populated automatically from the authenticated session and are not editable by users.
- All authenticated CRM users have read and write access to all deal records in Phase 1; record-level permission scoping is deferred.
- The maximum page size for list requests is capped at 100 records per page.
- Concurrent edit conflicts are resolved by last-write-wins in Phase 1; no optimistic concurrency control is required.
- The seed data migration is idempotent: running it on a database that already has the default pipeline does not create duplicates.
- In Phase 1 only the single seeded pipeline is active; pipeline management UI is deferred to Phase 2.
- A stage's `order_index` uniqueness is enforced per pipeline, not globally.
- The `converted_deal_fk` back-reference on Lead will be resolved by `leads/0003_add_converted_deal_fk` once the deals app is present; this migration is not part of this module's scope but is unblocked by it.
- Won/Lost are visual indicators driven by `stage.is_won` / `stage.is_lost`; no special deal-level lock or read-only enforcement is applied to won/lost deals in Phase 1 (deferred to Phase 2 workflow rules).
