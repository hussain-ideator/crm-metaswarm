# Feature Specification: Activities Module

**Feature Branch**: `feat/activities-module`

**Created**: 2026-06-15

**Status**: Draft

**Input**: User description: "Activities module — Phase 1, Module 5. Activities are Tasks, Calls, and Meetings that can be related to any CRM entity (Lead, Contact, Company, Deal) using Django's ContentTypes framework for generic relations."

---

## Context & Scope

This spec covers the Activities module — the fifth CRM entity module and the final leaf in the Phase 1 dependency chain. An activity in this system represents a logged or scheduled sales interaction: a task to complete, a call to make or record, or a meeting to attend. Activities are unique among CRM entities because they are not owned by a single parent — they can be associated with any record type (Lead, Contact, Company, or Deal) through a generic relationship. This design means activities are a cross-cutting concern: they sit above all other modules in the dependency order.

**One architectural decision is fixed and must not be re-opened:**

- **Generic relations via ContentTypes** — Activities relate to any CRM entity using Django's built-in ContentTypes framework (`content_type` + `object_id`). This is a two-column polymorphic relationship that avoids adding a foreign key column per entity type. The `content_type` identifies which model the activity relates to (Lead, Contact, Company, or Deal); `object_id` holds the primary key of that record. Filtering uses `?content_type=lead&object_id=5` syntax.

**In scope:**

- Activity data model with all ERD-specified fields and a ContentTypes generic relation.
- `ActivityType` as a fixed three-value enum (`task`, `call`, `meeting`) — no lookup table.
- Full CRUD REST API with soft delete.
- List endpoint with pagination, filtering by type / assigned user / related object, free-text search across subject and description, and ordering.
- Ability to associate an activity with any single CRM record (Lead, Contact, Company, Deal); the association is optional.
- Marking an activity as complete sets `completed_at` to the current timestamp; clearing it sets `completed_at` to null.
- Frontend list view, detail/edit view, create form, and a reusable activity feed widget that displays activities for a given record.

**Explicitly out of scope:**

- Hard (permanent) delete — the database row is never physically removed.
- Recurring activities or calendar sync (Phase 2).
- Email-linked activity logging (Phase 2).
- Bulk operations on activities.
- Role-based record-level visibility — all authenticated users see all non-deleted activities in Phase 1.
- An activity being linked to more than one CRM record at a time — each activity has exactly one generic relation target (or none).
- Notification or reminder delivery for due activities (Phase 2).
- Note and Attachment modules (separate specs).

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Log a New Activity (Priority: P1)

A sales user clicks "Log Activity," selects the type (task, call, or meeting), fills in the subject, sets an optional due date, optionally assigns it to a team member, and optionally links it to an existing CRM record (Lead, Contact, Company, or Deal). The new activity appears in the activity list immediately after saving.

**Why this priority**: Creating activities is the core value of the module. Without the ability to log an activity, no other workflow (viewing, editing, completing) delivers value. It also proves that the generic relation to any CRM entity works.

**Independent Test**: Click "Log Activity," select type "Call," enter a subject, link it to an existing Lead, and save — confirm the activity appears in the global activity list linked to that Lead, and that the Lead's activity feed widget shows the new entry.

**Acceptance Scenarios**:

1. **Given** a user on the create activity form, **When** they submit with a valid subject and type selected, **Then** a new activity is saved and the user is redirected to its detail view.
2. **Given** a user who leaves the subject blank, **When** they attempt to submit, **Then** a validation error is shown on the subject field and no record is created.
3. **Given** a user who leaves the type unselected, **When** they attempt to submit, **Then** a validation error is shown on the type field and no record is created.
4. **Given** a user who links the activity to a Lead, **When** the form is submitted, **Then** the activity's generic relation points to that Lead and the Lead's activity feed displays it.
5. **Given** a user who does not link the activity to any record, **When** the form is submitted, **Then** the activity is created with no generic relation and no error is raised.
6. **Given** a user who sets a due date, **When** the form is submitted, **Then** `due_at` is stored and displayed on the detail view.
7. **Given** a user who leaves due date empty, **When** the form is submitted, **Then** `due_at` is null and no error is raised.
8. **Given** a user who assigns the activity to a team member, **When** saved, **Then** `assigned_to` references that user on the detail view.
9. **Given** a user who leaves `assigned_to` empty, **When** saved, **Then** the activity has no assignee and no error is raised.
10. **Given** a user who abandons the form without saving, **When** they navigate away, **Then** no record is created.

---

### User Story 2 — Browse the Activity List (Priority: P1)

A sales user opens the Activities section and sees a paginated list of all non-deleted activities. They can search by subject or description, filter by type, assigned user, or linked record, sort by any column, and navigate between pages without losing their query state.

**Why this priority**: The list view is the primary surface for reviewing logged and upcoming activities across the organisation. It proves that search, filter, pagination, and ordering plumbing all work correctly.

**Independent Test**: Navigate to the activities list as an authenticated user — confirm a list renders with activity rows, a search box, filter controls (type, assigned to, linked record), column sort headers, and page navigation. Enter a search term; verify the table updates to matching rows. Confirm the URL reflects the current query state.

**Acceptance Scenarios**:

1. **Given** an authenticated user on the activities list with no filters, **When** the page loads, **Then** all non-deleted activities are returned in the default sort order (created date descending) with pagination controls visible.
2. **Given** a search term entered in the search box, **When** the user submits, **Then** only activities whose subject or description contains the search term are shown.
3. **Given** a type filter selected (e.g., "task"), **When** applied, **Then** only activities of that type appear.
4. **Given** an assigned-to filter selected, **When** applied, **Then** only activities assigned to that user appear.
5. **Given** a content-type + object-id pair provided (e.g., lead #5), **When** applied, **Then** only activities linked to that record appear.
6. **Given** multiple filters applied simultaneously, **When** the list loads, **Then** all active filters are combined with AND logic.
7. **Given** a column sort header clicked, **When** the user clicks it, **Then** the list reorders by that column; a second click reverses direction.
8. **Given** results spanning multiple pages, **When** the user navigates to page 2, **Then** the next set of results is shown and the URL reflects `page=2`.
9. **Given** no results match the current search/filter, **When** the list renders, **Then** an empty-state message is shown rather than an error.
10. **Given** active filter/search/page/sort state, **When** the user copies and opens the URL in a new tab, **Then** the exact same filtered view is reproduced.

---

### User Story 3 — View Activity Details (Priority: P1)

A user clicks an activity in the list and is taken to a detail page showing all stored information: type badge, subject, description, due date, completion status, assigned user, linked CRM record (if any), and timestamps.

**Why this priority**: The detail view is required before editing. It must display all ERD-specified fields and make the activity's completion state and related record clear.

**Independent Test**: Click any activity row in the list — confirm a detail page loads showing type, subject, description, due date, `completed_at` (or "Not completed"), assigned user, the linked record with its type label (e.g., "Lead: John Smith"), created-by, and timestamps.

**Acceptance Scenarios**:

1. **Given** a user on the activity list, **When** they click an activity row, **Then** the detail page loads showing all ERD-specified fields for that activity.
2. **Given** an activity with `completed_at` set, **When** the user views the detail page, **Then** the activity is displayed as "Completed" with the completion timestamp visible.
3. **Given** an activity with `completed_at = null`, **When** the user views the detail page, **Then** the activity is displayed as "Not completed."
4. **Given** an activity linked to a Lead, **When** the user views the detail page, **Then** the linked record is shown with its entity type label and a clickable link to that Lead's detail page.
5. **Given** an activity with no linked record, **When** the user views the detail page, **Then** no related record section is shown (or it shows "No linked record").
6. **Given** a direct URL to a soft-deleted activity, **When** any user navigates to it, **Then** a "not found" response is returned.
7. **Given** an unauthenticated user navigating to any activity URL, **When** the page loads, **Then** they are redirected to the login page.

---

### User Story 4 — Mark an Activity as Complete (Priority: P2)

A user views an activity detail page and clicks "Mark as Complete." The activity's completion timestamp is set to the current time and the UI reflects the completed state immediately. The user can also unmark it.

**Why this priority**: Completion tracking is the primary lifecycle event for activities. Without it, activities cannot be closed out and pipeline hygiene suffers. P2 because list, create, and detail must exist first.

**Independent Test**: Open an incomplete task activity detail page, click "Mark as Complete," confirm the `completed_at` field is now set to the current timestamp and a "Completed" badge appears. Click "Unmark" (or equivalent), confirm `completed_at` is cleared and the badge reverts.

**Acceptance Scenarios**:

1. **Given** a user on an incomplete activity's detail page, **When** they click "Mark as Complete," **Then** `completed_at` is set to the current timestamp and the UI shows "Completed."
2. **Given** a user on a completed activity's detail page, **When** they click to unmark it, **Then** `completed_at` is cleared (set to null) and the UI reverts to "Not completed."
3. **Given** a user on the activity list, **When** they complete or uncomplete an activity inline (if inline toggle exists), **Then** the list reflects the updated state without a full page reload.
4. **Given** a completed activity, **When** the user edits other fields and saves, **Then** `completed_at` retains its value unless explicitly changed.

---

### User Story 5 — Edit an Activity (Priority: P2)

A user opens an activity detail page, modifies any field (type, subject, description, due date, assigned user, or linked record), and saves. Changes are reflected immediately on the detail view.

**Why this priority**: Activity details change — calls get rescheduled, tasks get reassigned. Editing is essential for keeping activity data accurate. P2 because list, create, and detail must exist first.

**Independent Test**: Open a task activity, click "Edit," change the type to "Meeting," update the subject, re-assign to a different user, and save — confirm the detail view reflects all three changes and `updated_at` has advanced.

**Acceptance Scenarios**:

1. **Given** a user on an activity detail page, **When** they click "Edit," change the subject, and save, **Then** the detail view reflects the updated subject and `updated_at` has advanced.
2. **Given** a user editing an activity, **When** they clear the subject and attempt to save, **Then** a validation error is shown and no update is applied.
3. **Given** a user who changes the linked record to a different entity, **When** saved, **Then** the generic relation is updated to the new entity and the previous link is removed.
4. **Given** a user who removes the linked record entirely, **When** saved, **Then** the activity has no generic relation and no error is raised.
5. **Given** a partial update where only the due date is changed, **When** saved, **Then** only the due date changes; all other fields retain their previous values.
6. **Given** a user who reassigns `assigned_to` to a different user, **When** saved, **Then** `assigned_to` reflects the new user.
7. **Given** a user who clears `assigned_to`, **When** saved, **Then** `assigned_to` is null and no error is raised.

---

### User Story 6 — View Activities for a CRM Record (Priority: P2)

A sales user viewing a Lead, Contact, Company, or Deal detail page sees an "Activity Feed" widget listing all activities linked to that record — sorted by due date or created date — so they can review the history of interactions without leaving the record.

**Why this priority**: The activity feed widget provides contextual visibility directly on each CRM record. It is the primary way users will consume activity data day-to-day, turning isolated logs into a coherent engagement timeline. P2 because the list and detail views must exist first.

**Independent Test**: Open a Lead's detail page — confirm an activity feed section appears. Log a new task linked to that Lead; navigate back to the Lead detail — confirm the task appears in the feed with type badge, subject, due date, and completion status. Open a Lead with no activities — confirm the feed shows an empty-state message.

**Acceptance Scenarios**:

1. **Given** a user on a Lead detail page with linked activities, **When** the page loads, **Then** the activity feed lists all non-deleted activities for that Lead, sorted by due date ascending (overdue first) with a fallback to created date descending.
2. **Given** a Lead with no linked activities, **When** the page loads, **Then** the activity feed shows an empty-state message ("No activities yet") rather than an error.
3. **Given** a user who logs a new activity linked to a Contact, **When** they return to that Contact's detail page, **Then** the new activity appears in the feed without a full page reload.
4. **Given** a Deal detail page, **When** the feed loads, **Then** only activities linked specifically to that Deal appear (not activities linked to its associated Company or Contact).
5. **Given** a completed activity in the feed, **When** the user clicks "Mark as Complete" inline in the feed, **Then** the activity is marked complete and the feed updates immediately.

---

### User Story 7 — Soft Delete an Activity (Priority: P3)

A user deletes an activity from its detail page. The activity is hidden from all default views but the data is preserved in the system.

**Why this priority**: Data is never permanently destroyed in Phase 1. Soft delete maintains historical integrity. P3 because create, view, and edit are prerequisites.

**Independent Test**: Delete an activity from its detail page — confirm it no longer appears in the global activity list or in any linked record's activity feed. Navigate to its direct URL — confirm a "not found" response. Confirm the row still exists in the database with `is_deleted = true`.

**Acceptance Scenarios**:

1. **Given** a user on an activity detail page, **When** they confirm deletion, **Then** the activity is marked deleted, the user is returned to the list, and the deleted activity does not appear in the list.
2. **Given** a deleted activity's identifier, **When** a client requests it via the detail URL, **Then** a "not found" response is returned.
3. **Given** a deleted activity that was linked to a Lead, **When** the Lead's activity feed loads, **Then** the deleted activity does not appear.
4. **Given** a soft-deleted Lead whose activities still exist, **When** the activity list loads without any record filter, **Then** the activities are still visible (activities outlive their related records).

---

### Edge Cases

- What happens when the search query matches no activities? → An empty list is returned with a count of zero; the UI shows an empty-state message rather than an error.
- What if `page` or `page_size` is supplied with a non-integer value? → The API returns a 400 validation error with a descriptive message.
- What if `page_size` exceeds the maximum safe value? → The API caps the page size at 100 or returns a 400 error for out-of-range values.
- What if a Lead linked to an activity is soft-deleted? → The activity is preserved; the linked record reference remains but the Lead's record is no longer accessible. The activity feed on that Lead will not be visible, but the activity remains in the global list.
- What if the assigned user is deleted from the system? → `assigned_to` is set to null via `SET_NULL`; the activity is preserved and visible with no assigned user.
- What if an invalid `content_type` label is provided in the filter (e.g., `?content_type=invoice`)? → The API returns a 400 validation error; only valid CRM entity types (lead, contact, company, deal) are accepted.
- What if `object_id` is provided without `content_type` or vice versa? → The API returns a 400 validation error; both parameters are required together to identify a related record.
- What if `due_at` is in the past? → The API accepts it without error; past due dates are valid for historical activities.
- What if two users edit the same activity simultaneously? → Last-write-wins in Phase 1; no optimistic concurrency control is required.
- What if `completed_at` is submitted directly on create or update? → The API accepts an explicit `completed_at` value; the system also provides a dedicated "mark complete" action that sets it to the current timestamp.
- What if `type` is submitted with a value outside the three allowed options? → The API returns a 400 validation error.

---

## Requirements *(mandatory)*

### Functional Requirements

**Activity Record Management**

- **FR-001**: The system MUST define an `Activity` entity with fields: `id`, `type` (enum: task / call / meeting), `subject`, `description` (optional), `due_at` (optional datetime), `completed_at` (optional datetime), `assigned_to_fk` → User (nullable), `content_type` (ContentType FK, nullable), `object_id` (nullable positive integer), `is_deleted`, `created_at`, `updated_at`, `created_by_fk` → User.
- **FR-002**: `type` MUST be a fixed three-value enumeration (`task`, `call`, `meeting`) stored as a string field; it MUST NOT be implemented as a separate lookup table.
- **FR-003**: `subject` MUST be mandatory; the system MUST reject any create or update request where `subject` is blank or absent.
- **FR-004**: `type` MUST be mandatory; the system MUST reject any create or update request where `type` is absent or not one of the three allowed values.
- **FR-005**: All other fields (`description`, `due_at`, `completed_at`, `assigned_to_fk`, `content_type`, `object_id`) MUST be optional; the system MUST accept an activity with none of them provided.
- **FR-006**: The system MUST automatically populate `created_at`, `updated_at`, and `created_by` at creation; `updated_at` MUST be refreshed on every successful update.
- **FR-007**: The system MUST support full and partial updates to all user-editable fields.

**Completion Lifecycle**

- **FR-008**: When `completed_at` is null, the activity MUST be considered incomplete.
- **FR-009**: A "mark as complete" action MUST set `completed_at` to the current server timestamp; no client-provided timestamp is required for this action.
- **FR-010**: Clearing `completed_at` (setting it to null) MUST be allowed and MUST revert the activity to incomplete status.
- **FR-011**: `completed_at` MUST also be settable directly via create or update requests where the caller provides an explicit timestamp.

**Generic Relation (ContentTypes)**

- **FR-012**: An activity MAY be associated with at most one CRM record via a generic relation using `content_type` (Django ContentType reference) and `object_id` (the target record's primary key).
- **FR-013**: Valid target entity types for the generic relation MUST be limited to: Lead, Contact, Company, Deal.
- **FR-014**: `content_type` and `object_id` MUST be provided together or both left null; providing only one of the pair MUST result in a 400 validation error.
- **FR-015**: Deleting or soft-deleting the related CRM record (Lead, Contact, Company, or Deal) MUST NOT cascade to delete any associated activities; the activity is preserved independently.
- **FR-016**: The generic relation MUST be clearable (set both `content_type` and `object_id` to null) without deleting the activity.

**Relationship Constraints**

- **FR-017**: `assigned_to_fk` MUST be nullable; if the assigned user is removed from the system, `assigned_to_fk` MUST be set to null (`SET_NULL`) and the activity MUST be preserved.
- **FR-018**: `created_by_fk` MUST be nullable with `SET_NULL` on user delete, consistent with the project convention on all business entities.

**List, Search, Filter, Sort, and Pagination**

- **FR-019**: The list endpoint MUST return only non-deleted activities by default; soft-deleted activities MUST be excluded from all default views.
- **FR-020**: The list MUST be paginated; clients MUST be able to specify `page` and `page_size`; the response MUST include total record count and next/previous page indicators.
- **FR-021**: The system MUST support free-text search via a `?q=` parameter that matches across activity `subject` and `description`.
- **FR-022**: The system MUST support filtering the list by `type`, `assigned_to`, and related object (`content_type` label + `object_id`); all filters MUST be combinable.
- **FR-023**: The system MUST support ordering the list by any user-visible column; default ordering is by `created_at` descending.
- **FR-024**: All active query parameters — pagination, filters, search, and ordering — MUST be reflected in the page URL so that a view can be bookmarked or shared.
- **FR-025**: Filtering by related object MUST accept a human-readable `content_type` label (e.g., `lead`, `contact`, `company`, `deal`) rather than a raw ContentType integer ID.

**Soft Delete**

- **FR-026**: Deleting an activity MUST set `is_deleted = true` on the record; the underlying database row MUST NOT be removed.
- **FR-027**: A request to view, edit, or operate on a soft-deleted activity MUST return a "not found" response identical to a record that never existed.

**Activity Feed Widget**

- **FR-028**: The frontend MUST provide a reusable activity feed widget that accepts a `content_type` and `object_id` and displays all non-deleted activities linked to that specific record.
- **FR-029**: The activity feed MUST be sorted by `due_at` ascending (overdue first, nulls last) with a secondary sort by `created_at` descending.
- **FR-030**: The activity feed widget MUST support inline completion toggling (mark complete / unmark) without navigating away from the parent record's page.
- **FR-031**: The activity feed widget MUST show an empty-state message when no activities exist for a given record.

**Access Control**

- **FR-032**: All activity endpoints (list, create, retrieve, update, delete) MUST require an authenticated session; unauthenticated requests MUST receive a 401 response.

**Module Isolation and Dependency Order**

- **FR-033**: The activities app MUST NOT be installed before Deals; the dependency order MUST be: core ← accounts ← companies ← contacts ← leads ← deals ← activities. No circular imports are permitted.

### Key Entities

- **Activity**: A logged or scheduled sales interaction. Has a fixed type (task, call, or meeting), a mandatory subject, an optional description and due date, an optional assigned user, and an optional generic link to one CRM record. Tracks whether it has been completed via `completed_at`. Soft-deleted via `is_deleted`; never physically removed.
- **ActivityType** *(enum, not a table)*: The three allowed activity classifications — `task`, `call`, `meeting` — stored as a string choice field on the Activity model.
- **Generic Relation Target**: Any one of Lead, Contact, Company, or Deal. The activity stores a `content_type` (which model) and `object_id` (which record). The relationship is non-owning: the target record's lifecycle does not affect the activity.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can log a new activity linked to a CRM record in no more than 4 user actions from that record's detail page (open feed, click "Log Activity," fill subject + type, click "Save").
- **SC-002**: The activity list view updates to reflect new search terms, filters, or sort selections without a full page reload.
- **SC-003**: A user can locate all activities for a specific CRM record (e.g., a Lead) by navigating to that record's detail page — the activity feed renders within the same page load.
- **SC-004**: Marking an activity as complete reflects the updated state in the UI (badge + timestamp) without a full page reload.
- **SC-005**: A newly created activity appears in the global activity list and in the relevant record's activity feed within the same page load after form submission; no stale state is shown.
- **SC-006**: Navigating to a shared URL that encodes search/filter/page/sort parameters reproduces the exact same activity list view for any authenticated user.
- **SC-007**: A soft-deleted activity is invisible in all default list views and activity feed widgets within the same request cycle as the delete action.
- **SC-008**: All activity form validations surface descriptive inline errors on the failing field before any request is sent to the server.
- **SC-009**: The activity feed widget renders correctly for 0 activities (empty-state message), 1 activity, and many activities; no UI breakage occurs at boundary conditions.
- **SC-010**: Activities linked to a soft-deleted CRM record remain visible in the global activity list and are not themselves soft-deleted.

---

## Assumptions

- `subject` is not required to be unique; duplicate subjects across activities are permitted.
- `description` is a free-text field with no enforced length limit beyond standard database constraints.
- `due_at` is a datetime (with timezone); the system stores and displays times in UTC and relies on the client to present local time.
- `completed_at` is a datetime (with timezone); it is set by the server on "mark as complete," not by the client.
- An activity may have a `due_at` in the past — past due dates are valid for historical records.
- `object_id` is a positive integer matching the primary key of the target entity; no validation against the target record's actual existence is enforced in Phase 1 (the relation is a soft reference).
- `created_by` and `updated_by` (if tracked) are populated automatically from the authenticated session and are not user-editable.
- All authenticated CRM users have read and write access to all activity records in Phase 1; record-level permission scoping is deferred.
- The maximum page size for list requests is capped at 100 records per page.
- Concurrent edit conflicts are resolved by last-write-wins in Phase 1; no optimistic concurrency control is required.
- The activity feed widget is a frontend-only composition: it calls the standard `/api/activities/?content_type=<label>&object_id=<id>` endpoint — no dedicated feed endpoint is added to the API.
- The reusable activity feed widget will be integrated into the Lead, Contact, Company, and Deal detail pages; integration into those pages is in scope for this module.
- `assigned_to` defaults to null (unassigned) when not provided; there is no rule automatically assigning the activity to the creator.
- Activities with a null generic relation (no linked record) are valid and will appear in the global activity list but will not surface in any record-level activity feed.
