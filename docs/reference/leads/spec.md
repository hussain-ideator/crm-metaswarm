# Feature Specification: Leads Module

**Feature Branch**: `feat/leads-module`

**Created**: 2026-06-14

**Status**: Draft

**Input**: User description: "Leads module — Phase 1, Module 3. Leads represent unqualified prospects before they become Deals. ADR-005 (field set) and ADR-006 (status enum) are decided. Full CRUD, list with pagination/filtering/search/ordering, convert-to-deal flow, soft delete."

---

## Context & Scope

This spec covers the Leads module — the third CRM entity module, sitting above Contacts and Companies in the dependency chain. A lead in this system represents an unqualified prospect: a person or organisation-level enquiry that has not yet been validated as a sales opportunity. Leads carry personal identity information, raw company text (not a FK to a Company record), an optional source, a lifecycle status, and an assigned owner.

**Two architectural decisions are fixed and must not be re-opened:**

- **ADR-005** — Lead field set: `salutation` (enum), `first_name`, `last_name`, `title`, `email`, `phone`, `mobile`, `company_name` (raw text), `website`, `industry`, `no_of_employees`, `source_fk` → LeadSource (nullable), `status` (enum), `owner_fk`, `converted_at`, `converted_deal_fk` → Deal, plus `TimestampedModel` fields (`created_at`, `updated_at`, `created_by`, `updated_by`).
- **ADR-006** — Status enum: `new`, `contacted`, `qualified`, `unqualified`, `converted`. The value `lost` is explicitly excluded; `unqualified` covers that meaning.

**In scope:**
- Lead data model and LeadSource lookup table (seeded with five common sources).
- Full CRUD REST API with soft delete.
- List endpoint with pagination, filtering by status/source/owner, free-text search, and ordering.
- Convert-to-deal endpoint: creates a Deal stub, Contact, and Company from lead data in one atomic operation.
- Frontend list view, detail/edit view, create form, and convert action button.

**Explicitly out of scope:**
- Any import from the Deals or Activities modules — dependency direction is strictly core ← accounts ← companies ← contacts ← leads.
- Hard (permanent) delete — the database row is never physically removed.
- Full deal editing — the Deal stub created during conversion is edited in the Deals module.
- Role-based record-level visibility restrictions — all authenticated users see all active leads in Phase 1.
- Lead deduplication or merge workflows.
- Converting a lead without also creating the companion Contact and Company records.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Browse the Lead List (Priority: P1)

A sales user opens the Leads section and sees a paginated table of all active leads. They can search by first name, last name, email, company name, or phone; filter by status, source, or owner; sort by any column; and navigate between pages without leaving the view or losing their query state.

**Why this priority**: The list view is the entry point for all lead management. It must exist before any other lead workflow is reachable and proves the search, filter, and pagination plumbing works.

**Independent Test**: Navigate to the leads list page as an authenticated user — confirm a table renders with lead rows, a search box, status/source/owner filter controls, column sort headers, and page navigation. Enter a search term; verify the table updates to matching rows. Confirm the URL reflects current query state.

**Acceptance Scenarios**:

1. **Given** an authenticated user on the leads list page with no filters, **When** the page loads, **Then** all non-deleted leads are returned in the default sort order (created date descending) with pagination controls visible.
2. **Given** a search term entered in the search box, **When** the user submits the search, **Then** only leads whose first name, last name, email, company name, or phone contains the search term are shown.
3. **Given** a status filter selected (e.g., "new"), **When** applied, **Then** only leads with that status appear in the table.
4. **Given** a source filter selected, **When** applied, **Then** only leads with that source appear.
5. **Given** an owner filter selected, **When** applied, **Then** only leads assigned to that owner appear.
6. **Given** a column sort header clicked, **When** the user clicks it, **Then** the table reorders by that column; a second click reverses the direction.
7. **Given** results spanning multiple pages, **When** the user navigates to page 2, **Then** the next set of results is shown and the URL reflects `page=2`.
8. **Given** active filter/search/page/sort state, **When** the user copies and opens the URL in a new tab, **Then** the exact same filtered view is reproduced.

---

### User Story 2 — Create a Lead (Priority: P1)

A sales user clicks "New Lead," fills out the create form (first name and last name are required; all other fields are optional), and submits it. The new lead appears in the list with status `new`.

**Why this priority**: Lead capture is the primary entry point for the sales pipeline. Without create, no other lead workflow delivers value.

**Independent Test**: Click "New Lead," fill in a first name and last name plus any optional fields (e.g., email, source, status), submit the form — confirm the new record appears in the lead list with the correct data and a detail view is accessible.

**Acceptance Scenarios**:

1. **Given** a user on the create lead form, **When** they submit with a valid first name and last name, **Then** a new lead is created with status `new`, the user is redirected to the detail view, and the record appears in the list.
2. **Given** a user who leaves first name or last name blank, **When** they attempt to submit, **Then** a validation error is shown on the failing field and the form is not submitted.
3. **Given** a user who selects a source from the source picker, **When** the form is submitted, **Then** the lead is linked to that source and the source name appears on the detail view.
4. **Given** a user who leaves the source field empty, **When** the form is submitted, **Then** the lead is created with no source association and no error is raised.
5. **Given** a user who sets an explicit status other than `new`, **When** the form is submitted, **Then** the lead is saved with that status.
6. **Given** a user who abandons the form without saving, **When** they navigate away, **Then** no record is created.

---

### User Story 3 — View Lead Details (Priority: P1)

A user clicks a lead row in the list and is taken to a detail page showing all stored information for that lead, including status badge, source, and a "Convert to Deal" action for eligible leads.

**Why this priority**: The detail view is required before editing or conversion. It must display all ADR-005 fields and expose the conversion action clearly.

**Independent Test**: Click any lead row in the list — confirm a detail page loads showing all fields (name, company name, email, phone, mobile, title, website, industry, employee count, source, status, owner, salutation, timestamps). Confirm the "Convert to Deal" button is visible for non-converted leads.

**Acceptance Scenarios**:

1. **Given** a user on the lead list, **When** they click a lead row, **Then** the detail page loads showing all ADR-005 fields for that lead.
2. **Given** a lead with status other than `converted`, **When** the user views the detail page, **Then** a "Convert to Deal" button is visible.
3. **Given** a lead with status `converted`, **When** the user views the detail page, **Then** the form is read-only, the "Convert to Deal" button is absent, and a link to the resulting Deal is shown.
4. **Given** a direct URL to a soft-deleted lead, **When** any user navigates to it, **Then** a "not found" response is returned.
5. **Given** an unauthenticated user navigating to any lead URL, **When** the page loads, **Then** they are redirected to the login page.

---

### User Story 4 — Edit a Lead (Priority: P2)

A user opens a non-converted lead detail page, clicks "Edit," modifies one or more fields, and saves. The updated information is reflected immediately on the detail view.

**Why this priority**: Lead data changes as the sales team learns more. Editing is essential for maintaining data accuracy. P2 because list, create, and detail must exist first.

**Independent Test**: Open a lead detail page, click "Edit," change the status to "contacted" and add a phone number, save — confirm the detail view reflects the updated values and the `updated_at` timestamp has advanced.

**Acceptance Scenarios**:

1. **Given** a user on a non-converted lead detail page, **When** they click "Edit," change the last name, and save, **Then** the detail view shows the updated last name and the `updated_at` timestamp has advanced.
2. **Given** a user editing a lead, **When** they clear the first name or last name and attempt to save, **Then** a validation error is shown and the update is not applied.
3. **Given** a partial update where only the status field is changed, **When** saved, **Then** only the status changes; all other fields retain their previous values.
4. **Given** a lead with status `converted`, **When** any user attempts to access the edit form, **Then** the edit controls are disabled or the edit route returns a read-only view; no changes can be submitted.
5. **Given** a user who changes the source association, **When** saved, **Then** the detail view shows the new source.

---

### User Story 5 — Convert a Lead to a Deal (Priority: P2)

A sales user views a qualified lead and clicks "Convert to Deal." The system atomically creates a Deal stub, a Contact record, and a Company record from the lead's data. The lead is marked `converted` and becomes read-only; the resulting Deal is linked from the lead detail.

**Why this priority**: Conversion is the key lifecycle event that moves a prospect into the active sales pipeline. It is the primary business output of the Leads module. P2 because the lead detail view (P1) must exist first.

**Independent Test**: Open a lead with status `qualified`, click "Convert to Deal," confirm the lead status changes to `converted` and the detail is read-only. Confirm a new Deal, Contact, and Company exist in the system with data sourced from the lead.

**Acceptance Scenarios**:

1. **Given** a non-converted lead, **When** a user clicks "Convert to Deal" and confirms, **Then** a Deal stub (name derived from lead name, amount=0, close_date=today) is created, a Contact is created from the lead's personal data, a Company is created from `company_name`, the lead status is set to `converted`, `converted_at` is set to the current timestamp, and `converted_deal_fk` points to the new Deal.
2. **Given** the conversion completes, **When** the user views the lead detail, **Then** the lead is read-only and a navigable link to the new Deal is displayed.
3. **Given** a lead with an empty `company_name`, **When** converted, **Then** a Contact is still created; Company creation is skipped (or a blank-named Company stub is created) — the conversion does not fail.
4. **Given** a lead already in status `converted`, **When** a user attempts to convert it again, **Then** the system rejects the request with a descriptive error; no duplicate records are created.
5. **Given** any part of the conversion (Deal, Contact, or Company creation) fails, **When** the failure occurs, **Then** the entire conversion is rolled back; the lead status remains unchanged and no partial records are persisted.
6. **Given** a converted lead, **When** a user attempts to edit any field, **Then** the system rejects the edit; read-only enforcement applies after conversion.

---

### User Story 6 — Soft Delete a Lead (Priority: P2)

A user deletes a non-converted lead from the detail page. The lead is hidden from all default views but the data is preserved in the system.

**Why this priority**: Data is never permanently destroyed in Phase 1. Soft delete keeps historical integrity while allowing the team to clean up invalid or duplicate leads.

**Independent Test**: Delete a lead from its detail page — confirm it no longer appears in the list. Attempt to navigate to its URL — confirm a "not found" response. Confirm the row still exists in the database with `is_deleted = true`.

**Acceptance Scenarios**:

1. **Given** a user on a non-converted lead detail page, **When** they confirm deletion, **Then** the lead is marked deleted, the user is returned to the list, and the deleted lead does not appear in the list.
2. **Given** a deleted lead's identifier, **When** a client requests it via the detail URL, **Then** a "not found" response is returned.
3. **Given** the owner of a lead is removed from the system, **When** the lead list is viewed, **Then** the lead still appears with its owner field empty; it is not deleted.
4. **Given** a lead with status `converted`, **When** a user attempts to delete it, **Then** the system prevents deletion; converted leads are preserved for Deal traceability.

---

### Edge Cases

- What happens when the search query matches no leads? → An empty list is returned with a count of zero; the UI shows an empty state message rather than an error.
- What if `page` or `page_size` is supplied with a non-integer value? → The API returns a 400 validation error with a descriptive message.
- What if `page_size` exceeds a maximum safe value? → The API caps the page size at 100 or returns a 400 error for out-of-range values.
- What if the owner user is deleted before a lead list is fetched? → The lead still appears with the owner field as null; no error is raised.
- What if `company_name` is blank when converting? → The conversion proceeds; Contact is always created; the Company creation step handles the blank gracefully (skip or minimal stub — to be defined in plan).
- What if two users attempt to convert the same lead simultaneously? → The second conversion request is rejected because the lead will already be in `converted` status; no duplicate records are created.
- What if a user submits a conversion but the Deal or Contact creation fails mid-way? → The entire operation is rolled back atomically; the lead status remains unchanged.
- What if a status value outside the ADR-006 enum is submitted? → The API returns a 400 validation error.
- What if `no_of_employees` is submitted as a negative number? → The API returns a 400 validation error; the field must be a non-negative integer.
- What if the search term contains special characters? → The system treats the query as a plain-text substring match; special characters are safely handled without injection risk.

---

## Requirements *(mandatory)*

### Functional Requirements

**Lead Record Management**

- **FR-001**: The system MUST allow authenticated users to create a lead record; `first_name` and `last_name` are the only mandatory fields.
- **FR-002**: The system MUST reject any create or update request that leaves `first_name` or `last_name` blank or absent.
- **FR-003**: All remaining ADR-005 fields (`salutation`, `title`, `email`, `phone`, `mobile`, `company_name`, `website`, `industry`, `no_of_employees`, `source_fk`, `owner_fk`) MUST be optional; the system MUST accept a lead with none of them provided.
- **FR-004**: The system MUST default `status` to `new` when no status is provided at creation.
- **FR-005**: The system MUST automatically populate `created_at`, `updated_at`, and `created_by` at creation; `updated_at` and `updated_by` MUST be refreshed on every successful update.
- **FR-006**: The system MUST support full and partial updates to all user-editable fields on a non-converted lead.
- **FR-007**: A lead with status `converted` MUST be read-only; the system MUST reject any attempt to modify a converted lead's fields.

**LeadSource Lookup**

- **FR-008**: The system MUST maintain a LeadSource lookup table with at minimum the following seeded values: Web, Referral, Cold Call, Email, Social Media.
- **FR-009**: `source_fk` on a Lead MUST be nullable; a lead without a source MUST be valid.
- **FR-010**: The create and edit forms MUST expose a picker of available LeadSource values.

**Status Lifecycle**

- **FR-011**: The lead status field MUST only accept values from the ADR-006 enum: `new`, `contacted`, `qualified`, `unqualified`, `converted`; any other value MUST be rejected with a 400 error.
- **FR-012**: Only the convert endpoint MAY set status to `converted`; direct user edits MUST NOT allow setting status to `converted` through the standard update endpoint.

**List, Search, Filter, and Sort**

- **FR-013**: The list endpoint MUST return only non-deleted leads by default; soft-deleted leads MUST be excluded from all default views.
- **FR-014**: The list MUST be paginated; clients MUST be able to specify `page` and `page_size`; the response MUST include total record count and next/previous page indicators.
- **FR-015**: The system MUST support free-text search via a `?q=` parameter that matches against `first_name`, `last_name`, `email`, `company_name`, and `phone`.
- **FR-016**: The system MUST support filtering the list by `status`, `source` (source identifier), and `owner` (user identifier); filters MUST be combinable.
- **FR-017**: The system MUST support ordering the list by any user-visible column; default ordering is by `created_at` descending.
- **FR-018**: All active query parameters — pagination, filters, search, and ordering — MUST be reflected in the page URL so that a view can be bookmarked or shared.

**Convert-to-Deal Flow**

- **FR-019**: The system MUST expose a convert endpoint (`POST /api/leads/{id}/convert/`) that creates a Deal stub, a Contact record, and a Company record from the lead's data in a single atomic transaction.
- **FR-020**: The Deal stub created by conversion MUST have: a name derived from the lead's name, `amount=0`, `close_date` set to the current date, and an owner matching the lead's owner.
- **FR-021**: The Contact created by conversion MUST carry the lead's `first_name`, `last_name`, `email`, `phone`, `mobile`, and `title`.
- **FR-021a**: If `company_name` is non-empty, the conversion MUST also create a Company record from that name and link the new Contact to it. If `company_name` is blank or absent, no Company record is created and the Contact is saved with no company association; the conversion MUST NOT fail in either branch.
- **FR-022**: On successful conversion, the system MUST set the lead's `status` to `converted`, `converted_at` to the current timestamp, and `converted_deal_fk` to the newly created Deal.
- **FR-023**: The convert endpoint MUST be idempotent in error: if any part of the creation chain fails, the entire operation MUST be rolled back and no partial records persisted.
- **FR-024**: A lead already in `converted` status MUST be rejected by the convert endpoint with a descriptive error; the endpoint MUST NOT create duplicate records.
- **FR-025**: Converted leads MUST NOT be deletable; the system MUST reject delete requests on converted leads.

**Soft Delete**

- **FR-026**: Deleting a lead MUST set `is_deleted = true` on the record; the underlying database row MUST NOT be removed.
- **FR-027**: A request to view, edit, or operate on a soft-deleted lead MUST return a "not found" response identical to a record that never existed.

**Ownership**

- **FR-028**: `owner_fk` MUST reference a CRM user and MUST be nullable; if the referenced user is removed, `owner_fk` MUST be set to null and the lead record MUST be preserved.
- **FR-029**: `owner_fk` MUST be user-assignable from a picker of active CRM users.

**Access Control**

- **FR-030**: All lead endpoints (list, create, retrieve, update, delete, convert) MUST require an authenticated session; unauthenticated requests MUST receive a 401 response.

**Module Isolation**

- **FR-031**: The leads module MUST have no import-time or runtime dependency on the deals or activities modules; dependency direction is strictly core ← accounts ← companies ← contacts ← leads.

### Key Entities

- **Lead**: An unqualified prospect record. Carries personal identity details (salutation, first name, last name, title, email, phone, mobile), raw organisation text (`company_name`, `website`, `industry`, `no_of_employees`), an optional source link, a lifecycle status, an optional assigned owner, and conversion outcome fields (`converted_at`, `converted_deal_fk`). Once converted, a Lead is read-only and linked to the Deal, Contact, and Company records it produced.
- **LeadSource**: A simple lookup table of prospect origin labels (e.g., Web, Referral, Cold Call). Referenced by Lead via a nullable FK. Seeded at deploy time; not user-editable in Phase 1.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can locate a specific lead by name, email, company name, or phone using the search box and see results within 2 seconds on a standard broadband connection.
- **SC-002**: The lead list view updates to reflect new search terms, filters, or sort selections without a full page reload.
- **SC-003**: Creating a new lead from the form takes no more than 3 user actions from the list page (click "New Lead," fill required fields, click "Save").
- **SC-004**: The convert-to-deal action completes — creating Deal, Contact, and Company — within 3 seconds of user confirmation on a standard broadband connection.
- **SC-005**: A converted lead is immediately read-only and displays a link to the resulting Deal within the same page load after conversion; no stale state is shown.
- **SC-006**: Navigating to a shared URL that encodes search/filter/page/sort parameters reproduces the exact same lead list view for any authenticated user.
- **SC-007**: A soft-deleted lead is invisible in all default list and search views within the same request cycle as the delete action.
- **SC-008**: All lead form validations surface descriptive inline errors on the failing field before any request is sent to the server.
- **SC-009**: The list view renders correctly for 0 results (empty-state message), 1 result, and results spanning multiple pages; no UI breakage occurs at boundary conditions.

---

## Assumptions

- Lead `first_name` and `last_name` are not required to be unique in combination; duplicate names are permitted.
- Email uniqueness is not enforced at the database level in Phase 1; deduplication is a future concern.
- `company_name` is a free-text field on the Lead; it does not reference the Companies table. The Companies table entry is created only at conversion time.
- `salutation` is a predefined enum with exactly these values: `Mr.`, `Ms.`, `Mrs.`, `Dr.`, `Mx.`, `None`.
- `industry` is a free-text string in Phase 1; no predefined enumeration is enforced.
- `no_of_employees` is a non-negative integer; negative values are rejected.
- `created_by` and `updated_by` are populated automatically from the authenticated session and are not editable by users.
- All authenticated CRM users have read and write access to all lead records in Phase 1; record-level permission scoping is deferred.
- The maximum page size for list requests is capped at 100 records per page.
- Concurrent edit conflicts are resolved by last-write-wins in Phase 1; no optimistic concurrency control is required.
- The source picker on the lead form shows only the seeded LeadSource values; end-user management of sources is deferred.
- When converting a lead with a blank `company_name`, Company creation is skipped and the Contact is saved with no company association (per FR-021a).
- The Deal stub's name is derived as `"{first_name} {last_name}"` or a similar convention; the exact name template is defined in the implementation plan.
- LeadSource values are seeded via a data migration and are not exposed for user creation/editing in this module.
- The convert endpoint is accessible only to authenticated users; no additional role restriction is applied in Phase 1.
