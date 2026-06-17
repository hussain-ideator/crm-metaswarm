# Feature Specification: Contacts (People) Module

**Feature Branch**: `feat/contacts-module`

**Created**: 2026-06-14

**Status**: Draft

**Input**: User description: "Contacts (People) module — Phase 1, Module 2. Contacts are people who belong to a Company. Full CRUD, list view with pagination/filtering/search/ordering, detail view, create and edit forms, soft delete, company navigation link."

---

## Context & Scope

This spec covers the Contacts module — the second CRM entity module to be built, and a direct dependent of the Companies module. A contact in this system represents an individual person affiliated with a business organisation tracked in the CRM. Contacts carry personal identity information (first name, last name, email, phone, title), a nullable link to a Company record, and an assigned owner from the CRM user base.

**In scope:** contact data model, full CRUD via REST API, list view with pagination / filtering / search / ordering, detail view, create and edit forms, soft delete, frontend pages backed by server-state management, and a navigable company link from the contact detail and list views.

**Explicitly out of scope:**
- Any field or endpoint from the Leads, Deals, or Activities modules — no cross-module imports from those modules in this iteration.
- Hard (permanent) delete — the database record is never physically removed.
- Role-based record-level visibility restrictions — all authenticated users see all active contacts in Phase 1.
- Contact deduplication or merge workflows.
- Reverse navigation from Company to its Contacts (owned by the Companies module; deferred).
- Converting a Contact from a Lead — the conversion workflow is owned by the Leads module.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Browse the Contact List (Priority: P1)

A sales user opens the Contacts section and sees a paginated table of all active contacts. They can search by first name, last name, email, or phone; filter by company or owner; sort by any column; and navigate between pages — all without leaving the page or losing their current view state.

**Why this priority**: The list view is the entry point for every contact interaction. Without it, no other contact workflow is reachable. It also proves that search, filter, and pagination plumbing works correctly before the rest of the module is built.

**Independent Test**: Navigate to the contacts list page as an authenticated user — confirm a table renders with contact rows, a search box, company and owner filter controls, column sort headers, and page navigation. Enter a search term and verify the table updates to matching rows only. Confirm the URL reflects the search/filter state.

**Acceptance Scenarios**:

1. **Given** an authenticated user on the contacts list page, **When** they load the page with no filters applied, **Then** all non-deleted contacts are returned in the default sort order (last name ascending) with pagination controls visible.
2. **Given** a search term entered in the search box, **When** the user submits the search, **Then** only contacts whose first name, last name, email, or phone contains the search term are shown; non-matching contacts are hidden.
3. **Given** a company filter selected, **When** applied, **Then** only contacts linked to that company appear in the table.
4. **Given** an owner filter selected, **When** applied, **Then** only contacts assigned to that owner appear.
5. **Given** a column sort header clicked, **When** the user clicks it, **Then** the table re-orders by that column; a second click reverses the direction.
6. **Given** results spanning multiple pages, **When** the user navigates to page 2, **Then** the next set of results is shown and the URL reflects `page=2`.
7. **Given** active filter/search/page state, **When** the user copies and opens the URL in a new tab, **Then** the exact same filtered view is reproduced.

---

### User Story 2 — Create a Contact (Priority: P1)

A sales user clicks "New Contact," fills out a form (first name and last name are required; all other fields are optional), and submits it. The new contact record appears in the list immediately.

**Why this priority**: Data entry is the foundation of CRM value. Without the ability to create contacts, the system has nothing to display or relate to.

**Independent Test**: Click "New Contact," fill in a first name and last name plus any optional fields, submit the form — confirm the new record appears in the contact list and the detail view is accessible.

**Acceptance Scenarios**:

1. **Given** a user on the create contact form, **When** they submit with a valid first name and last name, **Then** a new contact record is created, the user is redirected to the detail view, and the record appears in the list.
2. **Given** a user who leaves the first name or last name field blank, **When** they attempt to submit, **Then** a validation error is shown on the failing field and the form is not submitted.
3. **Given** a user who selects a company from the company picker, **When** the form is submitted, **Then** the contact is linked to that company and the company name is visible on the detail view.
4. **Given** a user who leaves the company field empty, **When** the form is submitted, **Then** the contact is created with no company association and no error is raised.
5. **Given** a user who abandons the form without saving, **When** they navigate away, **Then** no record is created.

---

### User Story 3 — View Contact Details (Priority: P1)

A user clicks a contact row in the list and is taken to a detail page showing all stored information for that contact, including a clickable link to the associated company (if any).

**Why this priority**: The detail view is required for downstream modules (Deals, Activities will reference contacts) and is the launch point for the edit workflow. The company link is essential for cross-record navigation.

**Independent Test**: Click any contact row in the list — confirm a detail page loads showing all fields (first name, last name, email, phone, title, company link, owner, timestamps). Click the company link — confirm navigation to `/companies/[id]`.

**Acceptance Scenarios**:

1. **Given** a user on the contact list, **When** they click a contact row, **Then** the detail page loads showing all fields for that contact.
2. **Given** a contact with an associated company, **When** the user views the detail page, **Then** the company name is shown as a clickable link; clicking it navigates to `/companies/[company_id]`.
3. **Given** a contact with no associated company, **When** the user views the detail page, **Then** the company field is shown as empty with no error or broken link.
4. **Given** a direct URL to a contact detail page, **When** an authenticated user navigates to it, **Then** the detail page loads.
5. **Given** a direct URL to a soft-deleted contact, **When** any user navigates to it, **Then** a "not found" response is returned — the deleted record is not surfaced.
6. **Given** an unauthenticated user navigating to any contact URL, **When** the page loads, **Then** they are redirected to the login page.

---

### User Story 4 — Edit a Contact (Priority: P2)

A user opens a contact detail page, clicks "Edit," modifies one or more fields, and saves. The updated information is reflected immediately.

**Why this priority**: CRM data changes frequently. Without editing, the module has no ongoing maintenance value. P2 because the list and detail views must exist first.

**Independent Test**: Open a contact detail page, click "Edit," change the last name and title, save — confirm the detail view reflects the new values and the `updated_at` timestamp has advanced.

**Acceptance Scenarios**:

1. **Given** a user on the contact detail page, **When** they click "Edit," change the last name to a new valid value, and save, **Then** the detail view shows the updated last name and the `updated_at` timestamp has advanced.
2. **Given** a user editing a contact, **When** they clear the first name or last name field and attempt to save, **Then** a validation error is shown and the update is not applied.
3. **Given** a partial update (PATCH) where only one field is changed, **When** saved, **Then** only that field changes; all other fields retain their previous values.
4. **Given** a user who changes the company association to a different company, **When** saved, **Then** the contact detail shows the new company link.
5. **Given** a user who removes the company association, **When** saved, **Then** the contact has no company link and no error is raised.

---

### User Story 5 — Soft Delete a Contact (Priority: P2)

A user deletes a contact from the detail page. The contact is hidden from all default views but the data is preserved in the system.

**Why this priority**: Data is never permanently destroyed in Phase 1. Soft delete keeps historical integrity while allowing the user to remove stale records from their working view.

**Independent Test**: Delete a contact from its detail page — confirm it no longer appears in the list. Attempt to navigate to its URL — confirm a "not found" response. Confirm the row still exists in the database with `is_deleted = true`.

**Acceptance Scenarios**:

1. **Given** a user on a contact detail page, **When** they confirm deletion, **Then** the contact is marked deleted, the user is returned to the list, and the deleted contact does not appear in the list.
2. **Given** a deleted contact's identifier, **When** a client requests it via the detail URL, **Then** a "not found" response is returned.
3. **Given** the company associated with a contact is soft-deleted, **When** the contact list is viewed, **Then** the contact still appears with its company field empty; the contact itself is not deleted.
4. **Given** the owner of a contact is removed from the system, **When** the contact list is viewed, **Then** the contact still appears with its owner field empty; it is not deleted.

---

### Edge Cases

- What happens when the search query matches no contacts? → An empty list is returned with a count of zero; the UI shows an empty state message rather than an error.
- What if `page` or `page_size` is supplied with a non-integer value? → The API returns a 400 validation error with a descriptive message.
- What if `page_size` exceeds a maximum safe value? → The API caps the page size at a defined maximum (100) or returns a 400 error for out-of-range values.
- What if the owner user is deleted before a contact list is fetched? → The contact still appears in the list with the owner field as null; no error is raised.
- What if the company linked to a contact is soft-deleted? → The contact's `company_fk` is set to null via SET_NULL; the contact remains active and appears in the list without a company link.
- What if two users attempt to edit the same contact simultaneously? → Last-write-wins in Phase 1; optimistic locking is deferred.
- What if the search term contains special regex or SQL characters? → The system treats the query as a plain-text substring match; special characters are safely handled without injection risk.
- What if a contact is created without an email address? → The email field is optional; no validation error is raised and the contact is saved with a null email.
- What if the same email address is used for two contacts? → Email uniqueness is not enforced in Phase 1; duplicate emails are permitted.

---

## Requirements *(mandatory)*

### Functional Requirements

**Contact Record Management**

- **FR-001**: The system MUST allow authenticated users to create a contact record; `first_name` and `last_name` are the only mandatory fields.
- **FR-002**: The system MUST reject a create or update request that leaves `first_name` or `last_name` blank or absent.
- **FR-003**: `email`, `phone`, `title`, and `company_fk` MUST be optional fields; the system MUST accept a contact record with none of them provided.
- **FR-004**: The system MUST automatically set `created_at`, `updated_at`, and `created_by` at record creation; `updated_at` MUST be refreshed on every successful update.
- **FR-005**: The system MUST support full and partial updates to all user-editable fields on an existing contact.

**List, Search, Filter, and Sort**

- **FR-006**: The list endpoint MUST return only non-deleted contacts by default; soft-deleted contacts MUST be excluded unless a future admin filter is added.
- **FR-007**: The list MUST be paginated; clients MUST be able to specify `page` (1-based) and `page_size`; the response MUST include total record count and next/previous page indicators.
- **FR-008**: The system MUST support free-text search via a `?q=` parameter that matches against contact `first_name`, `last_name`, `email`, and `phone` fields.
- **FR-009**: The system MUST support filtering the list by `company` (company identifier) and by `owner` (owner's user identifier).
- **FR-010**: The system MUST support ordering the list by any user-visible column; default ordering is by `last_name` ascending.
- **FR-011**: All active query parameters — pagination, filters, search, and ordering — MUST be represented in the page URL so that a view can be bookmarked, shared, or restored on browser refresh.

**Company Navigation**

- **FR-012**: When a contact is associated with a company, the contact detail page and list view MUST display the company name as a navigable link to `/companies/[company_id]`.
- **FR-013**: When a contact has no company association, the company field MUST render as empty without error or broken link.

**Soft Delete**

- **FR-014**: Deleting a contact MUST set `is_deleted = true` on the record; the underlying database row MUST NOT be removed.
- **FR-015**: A request to view, edit, or operate on a soft-deleted contact by its identifier MUST return a "not found" response identical to a record that never existed.

**Ownership and Company Association**

- **FR-016**: The `owner_fk` field MUST reference a CRM user and MUST be nullable; if the referenced user is removed from the system, `owner_fk` MUST be set to null and the contact record MUST be preserved.
- **FR-017**: The `company_fk` field MUST reference a Company record and MUST be nullable; if the referenced company is soft-deleted or removed, `company_fk` MUST be set to null and the contact record MUST be preserved.
- **FR-018**: The `owner_fk` field MUST be user-assignable from a picker of active CRM users.
- **FR-019**: The `company_fk` field MUST be user-assignable from a searchable picker of active Company records.

**Access Control**

- **FR-020**: All contact endpoints (list, create, retrieve, update, delete) MUST require an authenticated session; unauthenticated requests MUST receive a 401 response.

**Module Isolation**

- **FR-021**: The contacts module MUST have no import-time or runtime dependency on the leads, deals, or activities modules; dependency direction is strictly core ← accounts ← companies ← contacts.

### Key Entities

- **Contact**: A person tracked in the CRM. Stores personal identity details (first name, last name, email, phone, title), an optional link to a Company, an optional assigned owner (CRM user), and lifecycle state (soft-delete flag, creation/modification timestamps and actor). A contact may be party to Deals and related to Activities — those relationships are owned by the respective modules.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can locate a specific contact by name, email, or phone using the search box and see results within 2 seconds on a standard broadband connection.
- **SC-002**: The contact list view updates to reflect new search terms, filters, or sort selections without a full page reload.
- **SC-003**: Creating a new contact from the form takes no more than 3 user actions from the list page (e.g., click "New Contact," fill required fields, click "Save").
- **SC-004**: Navigating to a shared or bookmarked URL that encodes search/filter/page/sort parameters reproduces the exact same list view for any authenticated user.
- **SC-005**: A soft-deleted contact is invisible in all default list and search views within the same request cycle as the delete action — no stale data is shown.
- **SC-006**: The list view renders correctly for 0 results (empty-state message), 1 result, and results spanning multiple pages; no UI breakage occurs at boundary conditions.
- **SC-007**: All contact form validations surface descriptive inline errors on the failing field before a request is sent to the server.
- **SC-008**: Clicking a company link on a contact detail or list view navigates the user to the correct Company detail page in under 1 second.

---

## Assumptions

- Contact first name and last name are not required to be unique in combination — two contacts may share the same full name.
- Email uniqueness is not enforced at the database level in Phase 1; deduplication is a future concern.
- The `title` field is a free-text string (e.g., "VP of Sales," "Engineer"); no predefined enumeration is enforced.
- `created_by` is populated automatically from the authenticated session at creation time and is not editable by users.
- All authenticated CRM users have read and write access to all contact records in Phase 1; record-level permission scoping is deferred.
- The maximum page size for list requests is capped at 100 records per page.
- Concurrent edit conflicts are resolved by last-write-wins in Phase 1; no optimistic concurrency control is required.
- The company picker on the contact form shows only non-deleted (active) companies.
- Phone number format is stored as a free-text string; no formatting validation or normalisation is applied in Phase 1.
- The contacts module is a dependency for Deals (via `primary_contact_fk`) and Activities (via generic relation); those modules will not be started until this module passes acceptance testing.
