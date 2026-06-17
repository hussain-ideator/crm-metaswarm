# Feature Specification: Notes & Attachments Module

**Feature Branch**: `feat/notes-module`

**Created**: 2026-06-15

**Status**: Draft

**Input**: User description: "Notes & Attachments module — Phase 1, Module 6. Notes and Attachments are generic, attachable to any CRM record (Lead, Contact, Company, Deal). They use the same Django ContentTypes pattern as Activities."

---

## Context & Scope

This spec covers the Notes & Attachments module — the sixth and final entity module in the Phase 1 CRM build. Notes and Attachments both serve the same purpose: allowing sales users to capture free-text commentary and supporting files directly against any CRM record without routing through a specific parent entity. Like Activities, they use Django's ContentTypes framework for a generic polymorphic relation — the same two-column (`content_type` + `object_id`) pattern — rather than a hard foreign key per entity type.

**Two architectural decisions are fixed and must not be re-opened:**

- **Generic relations via ContentTypes** — Notes and Attachments relate to any CRM entity using the same `content_type` + `object_id` pattern as Activities. Valid targets are: Lead, Contact, Company, Deal only. The `content_type` field stores the model reference; `object_id` stores the target record's primary key. Model resolution uses `django_apps.get_model()` — no direct imports from entity apps.
- **Immutable attachments** — Once an attachment is uploaded its file content is fixed. The file, filename, file_size, and mime_type cannot be edited via the API. Only soft delete is available.

**In scope:**

- Note data model: `id`, `body` (mandatory text), `content_type` + `object_id` (generic FK via ContentTypes), `owner_fk` → User, `is_deleted`, `created_at`, `updated_at`.
- Attachment data model: `id`, `file` (uploaded file), `filename`, `file_size`, `mime_type`, `content_type` + `object_id` (generic FK via ContentTypes), `owner_fk` → User, `is_deleted`, `created_at`, `updated_at`.
- Notes REST API: full CRUD (create, retrieve, update, list, soft delete). List filterable by related record via `?content_type=<label>&object_id=<id>`.
- Attachments REST API: upload (`POST multipart/form-data`), retrieve, list, soft delete. No edit endpoint — files are immutable once uploaded.
- File storage: local filesystem using Django's default `MEDIA_ROOT` — no cloud/S3 in Phase 1.
- File validation: maximum 10 MB per attachment; allowed MIME types are a defined allowlist (PDF, common image formats, common office document formats).
- Soft delete for both Note and Attachment — the physical file on disk is **not** removed when an Attachment is soft-deleted (deferred cleanup).
- Frontend: reusable Notes feed widget and reusable Attachments widget, both integrated into Lead, Contact, Company, and Deal detail pages.

**Explicitly out of scope:**

- Hard (permanent) delete of either entity — the database row is never physically removed.
- Physical file deletion from disk on soft delete — deferred to a future cleanup job.
- Cloud/S3 file storage — Phase 2.
- Editing an attachment's file, filename, mime_type, or file_size after upload.
- Attaching a Note or Attachment to more than one CRM record simultaneously — each record has a single generic relation target (or none).
- Role-based record-level visibility — all authenticated users see all non-deleted Notes and Attachments in Phase 1.
- Inline preview or rendering of file content (e.g., PDF viewer).
- Versioning of note body content.
- Note or Attachment feed widget on entity types beyond Lead, Contact, Company, and Deal.
- Bulk operations.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Add a Note to a CRM Record (Priority: P1)

A sales user viewing a Lead, Contact, Company, or Deal record scrolls to the Notes widget, types a note in the inline text area, and saves. The note appears immediately in the Notes feed below the input, attributed to the current user and timestamped.

**Why this priority**: Creating a note attached to a record is the core value of the module. Until notes can be written, nothing else — viewing, editing, or deleting — delivers value. It also proves that the ContentTypes generic relation works end-to-end.

**Independent Test**: On any Lead detail page, type a note body in the Notes widget and save — confirm the note appears in the feed below with the current user's name, a relative timestamp, and the exact body text entered. Navigate away and return — confirm the note persists.

**Acceptance Scenarios**:

1. **Given** a user on a Lead detail page, **When** they type a body and click "Add Note," **Then** a new Note is created linked to that Lead and appears at the top of the Notes feed without a full page reload.
2. **Given** a user who submits with an empty body, **When** they click "Add Note," **Then** a validation error is shown inline and no record is created.
3. **Given** a user who adds a note on a Contact, **When** saved, **Then** the Note's generic relation points to that Contact and the Contact's Notes widget shows it.
4. **Given** a user who adds a note on a Deal, **When** saved, **Then** the note appears in the Deal's Notes feed and not in any other record's feed.
5. **Given** a user who abandons the note form without saving, **When** they navigate away, **Then** no record is created.

---

### User Story 2 — Upload an Attachment to a CRM Record (Priority: P1)

A sales user on a Lead, Contact, Company, or Deal detail page clicks "Upload File," selects a file from their device, and confirms. The attachment is stored and appears immediately in the Attachments widget showing the filename, file type, file size, upload date, and an uploader name.

**Why this priority**: Uploading an attachment is the foundational action of the Attachments feature. Without upload, the list, retrieve, and delete workflows have nothing to operate on.

**Independent Test**: On any Deal detail page, click "Upload File," select a PDF under 10 MB, and confirm — verify the filename, size, and MIME type appear in the Attachments widget. Navigate away and return — confirm the attachment persists.

**Acceptance Scenarios**:

1. **Given** a user on a Deal detail page, **When** they select a valid PDF file and upload it, **Then** the attachment is saved and appears in the Attachments widget with filename, size, type, and uploader.
2. **Given** a user who selects a file larger than 10 MB, **When** they attempt to upload, **Then** an error is shown ("File exceeds 10 MB limit") and no attachment is created.
3. **Given** a user who selects a file with a disallowed MIME type (e.g., `.exe`), **When** they attempt to upload, **Then** an error is shown listing the allowed types and no attachment is created.
4. **Given** a user who uploads a file on a Contact, **When** saved, **Then** the Attachment's generic relation points to that Contact and the Contact's Attachments widget shows it.
5. **Given** a user who uploads a file with a valid MIME type disguised by a wrong extension, **When** the server validates MIME type, **Then** the server-detected MIME type determines acceptance, not the filename extension.
6. **Given** a user who cancels the upload dialog without selecting a file, **When** they dismiss, **Then** no attachment is created and the widget is unchanged.

---

### User Story 3 — View Notes Feed for a CRM Record (Priority: P1)

A sales user on any CRM record detail page sees a Notes widget listing all non-deleted notes for that record — most recent first — so they can review the history of commentary without leaving the record.

**Why this priority**: The Notes feed is the primary consumption surface for notes. It must render correctly for zero, one, and many notes before edit or delete are useful.

**Independent Test**: Open a Contact with 3 existing notes — confirm all 3 appear in the Notes widget sorted by creation date descending. Open a Lead with no notes — confirm an empty-state message ("No notes yet") is shown rather than an error.

**Acceptance Scenarios**:

1. **Given** a user on a Lead detail page with linked notes, **When** the page loads, **Then** all non-deleted notes for that Lead appear sorted by `created_at` descending.
2. **Given** a Lead with no notes, **When** the Notes widget loads, **Then** an empty-state message ("No notes yet") is shown.
3. **Given** a note linked to Lead A, **When** a user views Lead B's Notes widget, **Then** that note does not appear.
4. **Given** a soft-deleted note that was previously linked to a record, **When** the Notes widget loads, **Then** the deleted note does not appear.

---

### User Story 4 — View Attachments for a CRM Record (Priority: P1)

A sales user on any CRM record detail page sees an Attachments widget listing all non-deleted attachments for that record, showing filename, file type, file size, and upload date, with the ability to download each file.

**Why this priority**: Listing and downloading attachments is the primary consumption path. Without a functional list, delete has nothing to operate on.

**Independent Test**: Open a Company with 2 existing attachments — confirm both appear with filename, size, MIME type, and an uploader. Click one — confirm the file is downloadable. Open a Deal with no attachments — confirm an empty-state message is shown.

**Acceptance Scenarios**:

1. **Given** a user on a Company detail page with linked attachments, **When** the page loads, **Then** all non-deleted attachments appear sorted by `created_at` descending with filename, size, type, and uploader shown.
2. **Given** a Company with no attachments, **When** the widget loads, **Then** an empty-state message ("No attachments yet") is shown.
3. **Given** a user who clicks a filename in the Attachments widget, **When** clicked, **Then** the file is served for download.
4. **Given** a soft-deleted attachment, **When** the Attachments widget loads, **Then** the deleted attachment does not appear.

---

### User Story 5 — Edit a Note (Priority: P2)

A sales user sees a note they own in the Notes feed, clicks the edit action, modifies the body inline, and saves. The updated body replaces the original text in the feed immediately.

**Why this priority**: Notes are free-text and may need correction. Inline editing keeps the user on the record page without a navigation step. P2 because create and read must exist first.

**Independent Test**: Open a Lead, locate a note in the feed, click "Edit," change the body text, and save — confirm the feed now shows the updated body and a "last edited" indicator, and that `updated_at` has advanced.

**Acceptance Scenarios**:

1. **Given** a user who clicks "Edit" on a note in the feed, **When** they update the body and save, **Then** the feed displays the updated body without a full page reload.
2. **Given** a user who clears the body and attempts to save, **When** they submit, **Then** a validation error is shown and the note is not modified.
3. **Given** a user who cancels an in-progress edit, **When** they click "Cancel," **Then** the note body reverts to its previous value and no update is applied.

---

### User Story 6 — Soft Delete a Note (Priority: P2)

A sales user deletes a note from the Notes feed. The note is immediately removed from the feed but the data is preserved in the system.

**Why this priority**: Notes may be posted in error. Soft delete removes them from view while preserving data integrity. P2 because create and list exist first.

**Independent Test**: Delete a note from a Lead's Notes feed — confirm it disappears from the feed immediately. Confirm the note row still exists in the database with `is_deleted = true`.

**Acceptance Scenarios**:

1. **Given** a user who clicks "Delete" on a note and confirms, **Then** the note is marked `is_deleted = true` and is no longer visible in the Notes feed.
2. **Given** a deleted note's API identifier, **When** a client requests it, **Then** a "not found" response is returned.
3. **Given** a soft-deleted note that was linked to a Deal, **When** the Deal's Notes feed loads, **Then** the deleted note does not appear.

---

### User Story 7 — Soft Delete an Attachment (Priority: P2)

A sales user removes an attachment from the Attachments widget. The attachment disappears from the widget immediately. The physical file on disk is not removed (deferred cleanup).

**Why this priority**: Attachments posted in error should be hidden from users. Physical file deletion is deferred to a future cleanup pass. P2 because upload and list exist first.

**Independent Test**: Delete an attachment from a Contact's Attachments widget — confirm it disappears from the widget immediately. Confirm the file still exists on disk. Confirm the attachment row in the database has `is_deleted = true`.

**Acceptance Scenarios**:

1. **Given** a user who clicks "Delete" on an attachment and confirms, **Then** the attachment is marked `is_deleted = true` and is no longer visible in the Attachments widget.
2. **Given** a deleted attachment's API identifier, **When** a client requests it, **Then** a "not found" response is returned.
3. **Given** a soft-deleted attachment, **When** the Attachments widget for that record loads, **Then** the deleted attachment does not appear.
4. **Given** a soft-deleted attachment, **When** the system checks the file on disk, **Then** the physical file is still present (no disk removal on soft delete).

---

### Edge Cases

- What happens when a note is submitted with only whitespace in the body? → The system trims leading/trailing whitespace; if the result is empty, a validation error is returned and no record is created.
- What if `content_type` label is invalid (e.g., `?content_type=invoice`)? → The API returns a 400 validation error; only `lead`, `contact`, `company`, and `deal` are accepted.
- What if `object_id` is provided without `content_type` or vice versa on the list filter? → The API returns a 400 validation error; both parameters must be provided together.
- What if an upload request omits the file field entirely? → The API returns a 400 validation error on the `file` field.
- What if two concurrent requests upload the same filename for the same record? → Both are accepted; filenames on disk are disambiguated by the storage backend (e.g., appended hash/counter). Duplicate filenames at the application layer are not an error.
- What if the owner of a note or attachment is deleted from the system? → `owner_fk` is set to null via `SET_NULL`; the note or attachment is preserved and visible with no owner displayed.
- What if the CRM record a note or attachment is linked to is soft-deleted? → The note/attachment is preserved and visible in global API list requests; the widget on the soft-deleted record is no longer accessible via the UI.
- What if `object_id` does not correspond to an existing record of the given `content_type`? → Phase 1 does not validate the target record's existence; the generic relation is stored as provided. The widget will simply show nothing for a non-existent record.
- What if a file upload is interrupted mid-transfer? → The server returns an error and no attachment record is created; no partial file is surfaced.
- What if `page` or `page_size` for the Notes or Attachments list is not an integer? → The API returns a 400 validation error with a descriptive message.

---

## Requirements *(mandatory)*

### Functional Requirements

**Note Record Management**

- **FR-001**: The system MUST define a `Note` entity with fields: `id`, `body` (mandatory text), `content_type` (ContentType FK, nullable, SET_NULL), `object_id` (nullable positive integer), `owner_fk` → User (nullable, SET_NULL on user delete), `is_deleted`, `created_at`, `updated_at`.
- **FR-002**: `body` MUST be mandatory; the system MUST reject any create or update request where `body` is blank, absent, or whitespace-only after trimming.
- **FR-003**: The system MUST support full and partial updates to the `body` field; no other Note field is user-editable after creation.
- **FR-004**: The system MUST automatically populate `created_at` and `updated_at` at creation; `updated_at` MUST be refreshed on every successful update.
- **FR-005**: `owner_fk` MUST be set to the authenticated user at creation and MUST NOT be user-editable. If the owner is deleted from the system, `owner_fk` MUST be set to null (`SET_NULL`) and the Note MUST be preserved.

**Attachment Record Management**

- **FR-006**: The system MUST define an `Attachment` entity with fields: `id`, `file` (stored file reference), `filename` (string, derived from uploaded file), `file_size` (integer, bytes), `mime_type` (string), `content_type` (ContentType FK, nullable, SET_NULL), `object_id` (nullable positive integer), `owner_fk` → User (nullable, SET_NULL on user delete), `is_deleted`, `created_at`, `updated_at`.
- **FR-007**: Attachments MUST be created via a `POST multipart/form-data` request containing the uploaded file and optionally the generic relation target.
- **FR-008**: `filename`, `file_size`, and `mime_type` MUST be derived server-side from the uploaded file at creation time; clients MUST NOT supply these values directly.
- **FR-009**: There MUST be NO edit endpoint for attachments; the file, filename, file_size, and mime_type are immutable once an attachment is created.
- **FR-010**: `owner_fk` MUST be set to the authenticated user at upload time. If the owner is deleted, `owner_fk` MUST be set to null (`SET_NULL`) and the Attachment MUST be preserved.
- **FR-011**: The system MUST enforce a maximum file size of 10 MB per upload; requests exceeding this MUST return a 400 validation error before the file is persisted.
- **FR-012**: The system MUST validate the uploaded file's MIME type against a defined allowlist; requests with disallowed MIME types MUST return a 400 validation error. The allowlist MUST include at minimum: PDF (`application/pdf`), common images (`image/jpeg`, `image/png`, `image/gif`, `image/webp`), and common office formats (`application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/vnd.ms-powerpoint`, `application/vnd.openxmlformats-officedocument.presentationml.presentation`).
- **FR-013**: MIME type validation MUST be performed by inspecting the file's actual content (magic bytes / server-side detection), not solely by trusting the client-provided content type or filename extension.
- **FR-014**: File storage MUST use the local filesystem via Django's default `MEDIA_ROOT` in Phase 1; no cloud or S3 storage is used.
- **FR-015**: Physical file deletion from disk MUST NOT occur on soft delete; the file on disk is preserved for deferred cleanup.

**Generic Relation (ContentTypes)**

- **FR-016**: Both Note and Attachment MUST use Django's ContentTypes framework (`content_type` FK + `object_id`) to associate with a CRM record. Model resolution MUST use `django_apps.get_model()` — no direct model imports from entity apps are permitted.
- **FR-017**: Valid generic relation targets MUST be limited to: Lead, Contact, Company, Deal. Any other label MUST produce a 400 validation error.
- **FR-018**: `content_type` and `object_id` MUST be provided together or both left null; providing only one of the pair MUST result in a 400 validation error.
- **FR-019**: Soft-deleting or hard-deleting the related CRM record MUST NOT cascade to delete any associated Notes or Attachments; both entities are preserved independently.
- **FR-020**: The generic relation on a Note or Attachment MUST be clearable (set both `content_type` and `object_id` to null) without deleting the Note or Attachment.

**Notes API**

- **FR-021**: The Notes API MUST expose: `POST /api/notes/` (create), `GET /api/notes/<id>/` (retrieve), `PATCH /api/notes/<id>/` (partial update), `DELETE /api/notes/<id>/` (soft delete), `GET /api/notes/` (list).
- **FR-022**: The Notes list MUST return only non-deleted notes by default.
- **FR-023**: The Notes list MUST support filtering by related record via `?content_type=<label>&object_id=<id>` (both required together when filtering by record).
- **FR-024**: The Notes list MUST be paginated; the response MUST include total count and next/previous page indicators.
- **FR-025**: Default sort for the Notes list MUST be `created_at` descending (most recent first).

**Attachments API**

- **FR-026**: The Attachments API MUST expose: `POST /api/attachments/` (upload, multipart/form-data), `GET /api/attachments/<id>/` (retrieve metadata), `DELETE /api/attachments/<id>/` (soft delete), `GET /api/attachments/` (list). There is NO update endpoint.
- **FR-027**: The Attachments list MUST return only non-deleted attachments by default.
- **FR-028**: The Attachments list MUST support filtering by related record via `?content_type=<label>&object_id=<id>`.
- **FR-029**: The Attachments list MUST be paginated; the response MUST include total count and next/previous page indicators.
- **FR-030**: Default sort for the Attachments list MUST be `created_at` descending.

**Soft Delete**

- **FR-031**: Deleting a Note or Attachment MUST set `is_deleted = true`; the database row MUST NOT be physically removed.
- **FR-032**: A request to view, update, or operate on a soft-deleted Note or Attachment MUST return a "not found" response identical to a record that never existed.

**Frontend Widgets**

- **FR-033**: The frontend MUST provide a reusable Notes feed widget that accepts `content_type` and `object_id` props and displays all non-deleted notes for that record, sorted `created_at` descending.
- **FR-034**: The Notes feed widget MUST support inline add (text area + save), inline edit (edit button per note that opens the body for editing in place), and inline delete (with confirmation) — all without full page navigation.
- **FR-035**: The Notes feed widget MUST show an empty-state message ("No notes yet") when no notes exist for the given record.
- **FR-036**: The frontend MUST provide a reusable Attachments widget that accepts `content_type` and `object_id` props and displays all non-deleted attachments for that record with filename, file size, MIME type, uploader, and upload date.
- **FR-037**: The Attachments widget MUST support file upload (file picker + upload button) and soft delete (delete button with confirmation) — no edit.
- **FR-038**: The Attachments widget MUST show an empty-state message ("No attachments yet") when no attachments exist for the given record.
- **FR-039**: Both the Notes feed widget and Attachments widget MUST be integrated into the Lead, Contact, Company, and Deal detail pages.

**Access Control**

- **FR-040**: All Notes and Attachments endpoints MUST require an authenticated session; unauthenticated requests MUST receive a 401 response.

**Module Isolation and Dependency Order**

- **FR-041**: The notes app MUST NOT be installed before Activities; the dependency order MUST be: core ← accounts ← companies ← contacts ← leads ← deals ← activities ← notes. No circular imports are permitted.

### Key Entities

- **Note**: A free-text comment attached to a CRM record. Has a mandatory body, an optional generic relation to one CRM record (Lead, Contact, Company, or Deal), and an owner (the creating user). Soft-deleted via `is_deleted`; never physically removed.
- **Attachment**: An uploaded file attached to a CRM record. Has a stored file reference, filename, file_size, and mime_type — all derived at upload time and immutable thereafter. Has an optional generic relation to one CRM record and an owner. Soft-deleted via `is_deleted`; the physical file is NOT removed on soft delete.
- **Generic Relation Target**: Any one of Lead, Contact, Company, or Deal. Notes and Attachments store a `content_type` (which model) and `object_id` (which record). The relationship is non-owning: the target record's lifecycle does not affect the Note or Attachment.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can add a note to any CRM record in no more than 3 user actions from that record's detail page (click the note field, type a body, click "Add Note") — without navigating away.
- **SC-002**: A user can upload an attachment to any CRM record in no more than 3 user actions (click "Upload File," select a file, confirm upload) — without navigating away.
- **SC-003**: Notes and Attachments added to a record appear in the respective widget on that record's detail page within the same request cycle as the save/upload action — no stale state is shown.
- **SC-004**: The Notes feed and Attachments widget render correctly for 0 items (empty-state message), 1 item, and many items — no UI breakage at boundary conditions.
- **SC-005**: Files that exceed the 10 MB limit or have a disallowed MIME type are rejected with a user-readable error message before any data is persisted.
- **SC-006**: A soft-deleted Note or Attachment is invisible in all widgets and API list responses within the same request cycle as the delete action.
- **SC-007**: A user can edit a note body inline and see the updated text in the feed without navigating away from the record page.
- **SC-008**: Deleting an owner user does not remove any Notes or Attachments they created — those records remain visible (with no owner attributed).
- **SC-009**: The Notes feed widget and Attachments widget are functionally identical in behaviour across the Lead, Contact, Company, and Deal detail pages — no record-type-specific code paths needed in the widget themselves.
- **SC-010**: All validation errors (empty note body, file too large, disallowed type) are presented as descriptive inline messages before or immediately after form submission — no raw server errors are shown to users.

---

## Assumptions

- `body` on Note has no enforced maximum length beyond standard database text column constraints; very long notes are accepted.
- `filename` stored on Attachment is the original filename from the upload; it is sanitised server-side to prevent path traversal or injection risks.
- `file_size` is stored in bytes as an integer; display formatting (KB, MB) is handled by the frontend.
- MIME type detection is performed server-side using file content inspection (e.g., `python-magic` or equivalent); client-provided Content-Type headers are not trusted for validation.
- An Attachment can have `content_type` and `object_id` set to null (no linked record) — valid for orphan uploads, though the widgets only display attachments linked to a specific record.
- `object_id` is a positive integer matching the primary key of the target entity; no referential integrity against the target record's existence is enforced at the database level in Phase 1 — the relation is a soft reference resolved at application layer.
- All authenticated CRM users have read and write access to all Notes and Attachments in Phase 1; per-record ownership scoping is deferred.
- The Notes feed and Attachments widgets call the standard `/api/notes/` and `/api/attachments/` endpoints filtered by `?content_type=<label>&object_id=<id>` — no dedicated widget-specific API endpoints are added.
- Maximum page size for list requests is capped at 100 records per page.
- Files are stored under `MEDIA_ROOT` with a structured subdirectory (e.g., `attachments/<year>/<month>/`) to avoid flat-directory performance issues.
- Concurrent uploads of identically named files for the same record are both accepted; the storage backend disambiguates filenames.
- `created_by` is not a separate field — `owner_fk` serves this purpose for both Note and Attachment; it is set at creation and is not user-editable.
- The physical file cleanup job (removing files for soft-deleted Attachments from disk) is out of scope for Phase 1 and is not specified here.
