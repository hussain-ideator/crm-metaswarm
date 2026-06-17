# Feature Specification: Companies (Accounts) Module

**Feature Branch**: `feat/companies-module`

**Created**: 2026-06-14

**Status**: Draft

**Input**: User description: "Accounts (Companies) module — Phase 1, Module 1. First CRM entity module. Must be fully working before Contacts (which has company_fk) can begin."

---

## Context & Scope

This spec covers the Companies module — the first CRM entity module to be built. It is a hard prerequisite for the Contacts module, which stores a foreign key to Company. A company in this system represents a business organisation that a sales team tracks: it has identity information (name, industry, website, phone), address information (billing, shipping), financial profile (annual revenue, employee count), and an assigned owner from the CRM user base.

**In scope:** company data model, full CRUD via REST API, list view with pagination / filtering / search / ordering, detail view, create and edit forms, soft delete, and frontend pages backed by server-state management.

**Explicitly out of scope:**
- Any field or endpoint from the Contacts, Leads, or Deals modules — no cross-module imports in this iteration.
- Hard (permanent) delete — the database record is never physically removed.
- Role-based record-level visibility restrictions (e.g., "show only companies I own") — all authenticated users see all active companies in Phase 1.
- Structured address components (city, state, postal code) — addresses are stored as unstructured text in Phase 1.
- Multi-currency support for annual revenue — single implicit currency for Phase 1.
- Company deduplication or merge workflows.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Browse the Company List (Priority: P1)

A sales user opens the Companies section and sees a paginated table of all active companies. They can search by name, website, or phone number; filter by industry or owner; sort by any column; and navigate between pages — all without leaving the page or losing their current view state.

**Why this priority**: The list view is the entry point for every company interaction. Without it, no other company workflow is reachable in the UI. It is also the prerequisite that proves pagination, search, and filter plumbing works before the rest is built.

**Independent Test**: Navigate to the companies list page as an authenticated user — confirm a table renders with company rows, a search box, industry and owner filter controls, column sort headers, and page navigation. Change the search term and verify the table updates to matching rows only. Confirm the URL reflects the search/filter state.

**Acceptance Scenarios**:

1. **Given** an authenticated user on the companies list page, **When** they load the page with no filters applied, **Then** all non-deleted companies are returned in the default sort order (name ascending) with pagination controls visible.
2. **Given** a search term entered in the search box, **When** the user submits the search, **Then** only companies whose name, website, or phone contains the search term are shown; companies that do not match are hidden.
3. **Given** an industry filter selected, **When** applied, **Then** only companies in that industry appear in the table.
4. **Given** an owner filter selected, **When** applied, **Then** only companies assigned to that owner appear.
5. **Given** a column sort header clicked, **When** the user clicks it, **Then** the table re-orders by that column; a second click reverses the direction.
6. **Given** results spanning multiple pages, **When** the user navigates to page 2, **Then** the next set of results is shown and the URL reflects `page=2`.
7. **Given** active filter/search/page state, **When** the user copies and opens the URL in a new tab, **Then** the exact same filtered view is reproduced.

---

### User Story 2 — Create a Company (Priority: P1)

A sales user clicks "New Company," fills out a form, and submits it. The new company record appears in the list immediately.

**Why this priority**: Data entry is the foundation of CRM value. Without the ability to create companies, the system has nothing to display or relate to.

**Independent Test**: Click "New Company," fill in a name and any optional fields, submit the form — confirm the new record appears in the company list and the detail view is accessible.

**Acceptance Scenarios**:

1. **Given** a user on the create company form, **When** they submit with a valid name and optional fields, **Then** a new company record is created, the user is redirected to the detail view, and the record appears in the list.
2. **Given** a user who leaves the name field blank, **When** they attempt to submit, **Then** a validation error is shown on the name field and the form is not submitted.
3. **Given** a non-negative annual revenue entered, **When** submitted, **Then** the value is saved correctly.
4. **Given** a negative annual revenue entered, **When** submitted, **Then** a validation error is shown and the form is not submitted.
5. **Given** a non-integer or negative employee count entered, **When** submitted, **Then** a validation error is shown.
6. **Given** a user who abandons the form without saving, **When** they navigate away, **Then** no record is created.

---

### User Story 3 — View Company Details (Priority: P1)

A user clicks a company row in the list and is taken to a detail page showing all stored information for that company.

**Why this priority**: The detail view is required for the Contacts module (contacts reference companies) and is the launch point for the edit workflow. It must exist before any dependent module can be built.

**Independent Test**: Click any company row in the list — confirm a detail page loads showing all fields (name, industry, website, phone, both addresses, revenue, employee count, owner, timestamps).

**Acceptance Scenarios**:

1. **Given** a user on the company list, **When** they click a company row, **Then** the detail page loads showing all fields for that company.
2. **Given** a direct URL to a company detail page, **When** an authenticated user navigates to it, **Then** the detail page loads.
3. **Given** a direct URL to a soft-deleted company, **When** any user navigates to it, **Then** a "not found" response is returned — the deleted record is not surfaced.
4. **Given** an unauthenticated user navigating to any company URL, **When** the page loads, **Then** they are redirected to the login page.

---

### User Story 4 — Edit a Company (Priority: P2)

A user opens a company detail page, clicks "Edit," modifies one or more fields, and saves. The updated information is reflected immediately.

**Why this priority**: CRM data changes frequently. Without editing, the module has no ongoing maintenance value. P2 because the list and detail views must exist first.

**Independent Test**: Open a company detail page, click "Edit," change the company name and industry, save — confirm the detail view reflects the new values.

**Acceptance Scenarios**:

1. **Given** a user on the company detail page, **When** they click "Edit" and change the name to a new valid value and save, **Then** the detail view shows the updated name and the updated_at timestamp has advanced.
2. **Given** a user editing a company, **When** they clear the name field and attempt to save, **Then** a validation error is shown and the update is not applied.
3. **Given** a partial update (PATCH) where only one field is changed, **When** saved, **Then** only that field changes; all other fields retain their previous values.
4. **Given** an owner assigned from the user picker, **When** saved, **Then** the company's owner field reflects the new owner.

---

### User Story 5 — Soft Delete a Company (Priority: P2)

A user deletes a company from the detail page or list. The company is hidden from all default views but the data is preserved in the system.

**Why this priority**: Data is never permanently destroyed in Phase 1. Soft delete keeps historical integrity while allowing the user to remove stale records from their working view.

**Independent Test**: Delete a company from its detail page — confirm it no longer appears in the list. Attempt to navigate to its URL — confirm a "not found" response. Confirm the row still exists in the database with is_deleted = true.

**Acceptance Scenarios**:

1. **Given** a user on a company detail page, **When** they confirm deletion, **Then** the company is marked deleted, the user is returned to the list, and the deleted company does not appear in the list.
2. **Given** a deleted company's identifier, **When** a client requests it via the detail URL, **Then** a "not found" response is returned.
3. **Given** the owner of a company is removed from the system, **When** the company list is viewed, **Then** the company still appears with its owner field empty; it is not deleted.

---

### Edge Cases

- What happens when the search query matches no companies? → An empty list is returned with a count of zero; the UI shows an empty state message rather than an error.
- What if `page` or `page_size` is supplied with a non-integer value? → The API returns a 400 validation error with a descriptive message.
- What if `page_size` exceeds a maximum safe value? → The API caps the page size at a defined maximum (e.g., 100) or returns a 400 error for out-of-range values.
- What if the owner user is deleted before a company list is fetched? → The company still appears in the list with the owner field as null; no error is raised.
- What if two users attempt to edit the same company simultaneously? → Last-write-wins in Phase 1; optimistic locking is deferred.
- What if a company's annual revenue is submitted as a formatted string (e.g., "1,200,000")? → The API rejects non-numeric values with a 400 validation error; formatting is the client's responsibility.
- What if the search term contains special regex or SQL characters? → The system treats the query as a plain-text substring match; special characters are safely handled without injection risk.

---

## Requirements *(mandatory)*

### Functional Requirements

**Company Record Management**

- **FR-001**: The system MUST allow authenticated users to create a company record; `name` is the only mandatory field.
- **FR-002**: The system MUST reject a create or update request that leaves the `name` field blank or absent.
- **FR-003**: `annual_revenue`, when provided, MUST be a non-negative numeric value; negative values MUST be rejected with a validation error.
- **FR-004**: `employee_count`, when provided, MUST be a non-negative whole number; negative or non-integer values MUST be rejected.
- **FR-005**: The system MUST automatically set `created_at`, `updated_at`, and `created_by` at record creation; `updated_at` MUST be refreshed on every successful update.
- **FR-006**: The system MUST support full and partial updates to all user-editable fields on an existing company.

**List, Search, Filter, and Sort**

- **FR-007**: The list endpoint MUST return only non-deleted companies by default; soft-deleted companies MUST be excluded unless a future admin filter is added.
- **FR-008**: The list MUST be paginated; clients MUST be able to specify `page` (1-based) and `page_size`; the response MUST include total record count and next/previous page indicators.
- **FR-009**: The system MUST support free-text search via a `?q=` parameter that matches against company `name`, `website`, and `phone` fields.
- **FR-010**: The system MUST support filtering the list by `industry` and by `owner` (owner's user identifier).
- **FR-011**: The system MUST support ordering the list by any user-visible column; default ordering is by `name` ascending.
- **FR-012**: All active query parameters — pagination, filters, search, and ordering — MUST be represented in the page URL so that a view can be bookmarked, shared, or restored on browser refresh.

**Soft Delete**

- **FR-013**: Deleting a company MUST set `is_deleted = true` on the record; the underlying database row MUST NOT be removed.
- **FR-014**: A request to view, edit, or operate on a soft-deleted company by its identifier MUST return a "not found" response identical to a record that never existed.

**Ownership**

- **FR-015**: The `owner` field MUST reference a CRM user and MUST be nullable; if the referenced user is removed from the system, the `owner` field MUST be set to null and the company record MUST be preserved.
- **FR-016**: The `owner` field MUST be user-assignable from a picker of active CRM users.

**Access Control**

- **FR-017**: All company endpoints (list, create, retrieve, update, delete) MUST require an authenticated session; unauthenticated requests MUST receive a 401 response.

**Module Isolation**

- **FR-018**: The companies module MUST have no import-time or runtime dependency on the contacts, leads, or deals modules; dependency direction is strictly core ← accounts ← companies.

### Key Entities

- **Company**: A business organisation tracked in the CRM. Stores identity details (name, industry, website, phone), location (billing address, shipping address), financial profile (annual revenue, employee count), ownership (assigned CRM user), and lifecycle state (soft-delete flag, creation/modification timestamps and actor). A company can employ Contacts and be party to Deals — those relationships are owned by the respective modules.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can locate a specific company by name using the search box and see results within 2 seconds on a standard broadband connection.
- **SC-002**: The company list view updates to reflect new search terms, filters, or sort selections without a full page reload.
- **SC-003**: Creating a new company from the form takes no more than 3 user actions from the list page (e.g., click "New," fill name, click "Save").
- **SC-004**: Navigating to a shared or bookmarked URL that encodes search/filter/page/sort parameters reproduces the exact same list view for any authenticated user.
- **SC-005**: A soft-deleted company is invisible in all default list and search views within the same request cycle as the delete action — no stale data is shown.
- **SC-006**: The list view renders correctly for 0 results (empty-state message), 1 result, and results spanning multiple pages; no UI breakage occurs at boundary conditions.
- **SC-007**: All company form validations surface descriptive inline errors on the failing field before a request is sent to the server.

---

## Assumptions

- Company names are not required to be unique — multiple records with the same name are permitted (e.g., regional offices). No server-side deduplication is enforced in Phase 1.
- The `industry` field is stored as a free-text string; a predefined enumeration of industry values may be added in a later iteration but is not required for Phase 1.
- `billing_address` and `shipping_address` are unstructured text fields (single string per address); structured address parsing (city, state, postal code) is deferred.
- `annual_revenue` is stored as a decimal number in a single implicit currency; multi-currency denomination is out of scope.
- The `created_by` field is populated automatically from the authenticated session at creation time and is not editable by users.
- All authenticated CRM users have read and write access to all company records in Phase 1; record-level permission scoping (e.g., restricting visibility to owned records) is deferred.
- The maximum page size for list requests is capped at 100 records per page.
- Concurrent edit conflicts are resolved by last-write-wins in Phase 1; no optimistic concurrency control is required.
- The companies module is the dependency for Contacts (via `company_fk`) and Deals (via `company_fk`); those modules will not be started until this module passes acceptance testing.
