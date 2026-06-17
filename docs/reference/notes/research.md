# Research: Notes & Attachments Module

**Date**: 2026-06-15
**Feature**: Notes & Attachments Module — Phase 1, Module 6

All decisions below were resolved from existing project ADRs, the activities plan (working reference for ContentTypes pattern), the spec, and explicit user directives. The tech stack is fully pinned; no external research was required.

---

## Decision 1: ContentTypes generic relation approach (identical to Activities)

**Decision**: Use Django's built-in `django.contrib.contenttypes` framework — same pattern as Activities. Both Note and Attachment carry two DB columns (`content_type_id` FK → `django_content_type`, `object_id` PositiveIntegerField) plus a virtual `GenericForeignKey` accessor. No separate junction table or per-entity FK columns.

**Rationale**: ContentTypes is the mandated approach (spec FR-016). Already established and validated by the Activities module. A composite index on `(content_type_id, object_id)` makes the widget filter query efficient.

**Alternatives considered**: Same as Activities — four nullable FK columns and django-polymorphic both rejected for identical reasons.

---

## Decision 2: `object_id` is a soft reference — no existence validation (Phase 1)

**Decision**: `object_id` stores the primary key of the related CRM record. No SELECT is issued against the target table to confirm the record exists. This matches the Activities pattern and is explicitly required by the spec (FR-019 / Assumption 7).

**Rationale**: Same reasoning as Activities Decision 2. Import-time coupling from `apps.notes` into entity apps would create circular imports. Runtime existence checks add a query per write for no Phase 1 benefit. `content_object` returns `None` if the target is later deleted — Notes and Attachments survive independently.

**Alternatives considered**: Runtime existence check and direct model import — both rejected (same reasons as Activities).

---

## Decision 3: `owner_fk` replaces `created_by` — deliberate divergence from TimestampedModel convention

**Decision**: Note and Attachment define their own `owner` ForeignKey → User (SET_NULL) as the sole attribution field. They do NOT use or surface `created_by` from `TimestampedModel`. The `created_by` field inherited from `TimestampedModel` is present in the DB schema (it is defined on the abstract base) but is never populated on these two models — `owner` carries all attribution meaning.

**Why this diverges from Activities**: Activity has two distinct user references: `assigned_to` (who is responsible for the activity) and `created_by` (who logged it) — these are frequently different people in a sales team. Notes and Attachments have no assignee concept; the only user relationship is "who added this record." Calling it `created_by` would be technically accurate but the spec explicitly names it `owner_fk`. Using `owner` communicates that the user is the owner/author, which matches the displayed "Posted by" or "Uploaded by" label in the UI.

**Implementation consequence**: In `NoteSerializer` and `AttachmentSerializer`, `created_by` is excluded from all field lists. `owner` is set on `perform_create()` from `request.user`. The `created_by` column exists in the DB (nullable, always null for these models) — this is acceptable technical debt vs. the alternative of removing `created_by` from `TimestampedModel` (which would require changing the base class used by all other modules).

**API surface**: Both serializers expose `owner` as a nested minimal user object (read-only). No `created_by` field appears in any Note or Attachment API response.

---

## Decision 4: `content_type` label resolution in `notes/filters.py` (duplicated, not imported from activities)

**Decision**: `CONTENT_TYPE_LABEL_MAP` and `resolve_content_type_from_label()` are duplicated in `apps/notes/filters.py`. No import from `apps.activities.filters` is used.

**Rationale**: Although notes sits after activities in the dependency chain (core ← … ← activities ← notes), importing from `apps.activities` would create a coupling that the ContentTypes pattern is specifically designed to avoid. Both modules are self-contained. The label map and helper are four lines of code — duplication is the right call here. A future refactor could move the shared utility to `apps/core/contenttypes.py`, but that is out of scope for Phase 1.

**Alternatives considered**:
- Import from `apps.activities.filters` — rejected: creates inter-module coupling; breaks the clean isolation of both modules.
- Move to `apps/core/contenttypes.py` — valid long-term approach; out of scope for Phase 1.

---

## Decision 5: MIME type validation via `python-magic` (server-side content inspection)

**Decision**: Use `python-magic` (Linux/macOS) / `python-magic-bin` (Windows) for server-side MIME type detection by reading the file's magic bytes. The client-supplied `Content-Type` header and the filename extension are NOT trusted for MIME validation.

**Rationale**: Spec FR-013 requires server-side content inspection. A user can rename `malware.exe` to `report.pdf` — only inspecting the actual file bytes can catch this. `python-magic` wraps `libmagic`, the same library used by the `file` command on Unix. On Windows, `python-magic-bin` is used instead because it ships `libmagic.dll` pre-bundled (the pure `python-magic` package requires `libmagic` to be installed separately, which is not the default on Windows).

**Platform handling in `backend/pyproject.toml`**:

```toml
[project.dependencies]
# ... existing deps ...
python-magic = ">=0.4.27"

[project.optional-dependencies]
# On Windows, install python-magic-bin instead of python-magic.
# It bundles the libmagic DLL and is a drop-in replacement.
# pip install "crm-backend[magic-win]"
magic-win = ["python-magic-bin>=0.4.14"]
```

CI/CD on Linux/macOS: install with `pip install .` (picks up `python-magic`).
Windows local dev: install with `pip install ".[magic-win]"` (picks up `python-magic-bin`).

**Usage in the attachment serializer**:

```python
import magic

def validate_file(self, value):
    # Limit: 10 MB
    if value.size > 10 * 1024 * 1024:
        raise serializers.ValidationError('File exceeds the 10 MB limit.')
    # Read first 2048 bytes for magic detection; do not consume the whole upload
    header = value.read(2048)
    value.seek(0)
    detected_mime = magic.from_buffer(header, mime=True)
    if detected_mime not in ALLOWED_MIME_TYPES:
        raise serializers.ValidationError(
            f'File type "{detected_mime}" is not allowed. '
            f'Allowed types: {sorted(ALLOWED_MIME_TYPES)}'
        )
    return value
```

**Alternatives considered**:
- `python-filetype` — rejected: lighter but less comprehensive than libmagic; misses more edge cases.
- Relying solely on `Content-Type` header — rejected: explicitly disallowed by FR-013.
- Filename extension check — rejected: trivially bypassed; explicitly disallowed by FR-013.

---

## Decision 6: File storage — local filesystem via `MEDIA_ROOT`, structured `upload_to` callable

**Decision**: Attachment files are stored on the local filesystem using Django's default `FileField` with a custom `upload_to` callable. Path format: `attachments/<year>/<month>/<sanitised_filename>`.

**`upload_to` callable**:

```python
import os
from datetime import date

def attachment_upload_path(instance, filename):
    # Strip any directory components to prevent path traversal
    filename = os.path.basename(filename)
    # Replace whitespace and keep only safe characters
    safe_chars = set('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-')
    filename = ''.join(c if c in safe_chars else '_' for c in filename)
    today = date.today()
    return f'attachments/{today.year}/{today.month:02d}/{filename}'
```

**Why `<year>/<month>/`**: Avoids flat-directory performance degradation on filesystems (e.g., ext4 with htree) when thousands of files accumulate. A new subdirectory per month keeps directory entry counts manageable.

**Filename collisions**: Django's `FileField` storage backend appends a random suffix (e.g., `report_a1b2c3d4.pdf`) when a file with the same name already exists in the same directory. This is built-in behaviour — no additional collision handling is required in application code.

**Serving files**: In development, Django serves `MEDIA_ROOT` via `django.conf.urls.static.static()`. In production, files should be served by the web server (nginx) or a CDN directly from `MEDIA_ROOT` — Django should not serve media files in production. This is a deployment concern, not a Phase 1 code concern.

**Soft delete & disk retention**: Soft-deleting an Attachment sets `is_deleted=True` but does NOT remove the file from disk (FR-015). Physical cleanup is deferred to a future management command or cron job. The stored `file` field path remains valid after soft delete.

**Alternatives considered**:
- Flat directory (`attachments/<filename>`) — rejected: performance degradation at scale.
- Per-record directory (`attachments/<content_type>/<object_id>/<filename>`) — rejected: moving an attachment to a different record would require moving the file; content_type/object_id are nullable.
- S3/cloud storage — explicitly deferred to Phase 2.

---

## Decision 7: Attachment is immutable after upload — no PATCH/PUT endpoint

**Decision**: There is no edit endpoint for Attachment. `file`, `filename`, `file_size`, and `mime_type` are all derived at upload time and cannot be changed. The only lifecycle operations are: upload (POST), retrieve (GET), list (GET), soft delete (DELETE).

**Rationale**: Explicitly required by the spec (FR-009). Allowing file replacement would require managing orphaned files on disk (the old file would need to be deleted or retained), complicating the storage layer. In Phase 1, if the wrong file is uploaded, the user soft-deletes it and uploads again.

**Alternatives considered**:
- Allow PATCH of `content_type`/`object_id` (re-linking the attachment to a different record) — rejected: re-linking while keeping the same file is confusing; the spec says no edit endpoint at all.

---

## Decision 8: Soft delete — files not physically removed from disk

**Decision**: `DELETE /api/attachments/{id}/` sets `is_deleted=True` on the DB row. The `file` on disk is NOT deleted. A future cleanup mechanism (management command, periodic task) will handle physical file removal.

**Rationale**: Explicitly required by FR-015. Prevents accidental data loss in Phase 1. Keeps the delete endpoint simple and fast — no filesystem I/O, no error handling for "file already gone" edge cases.

**Alternatives considered**:
- Delete file on soft delete — rejected: irreversible in Phase 1; if `is_deleted` is ever used to mark records for cleanup (not immediate deletion), premature physical removal would be a bug.
- Hard delete (remove DB row and file) — rejected: all entities in Phase 1 are soft-deleted only.

---

## Decision 9: Notes list feed — `created_at` descending, no conditional ordering branch

**Decision**: The Notes list endpoint uses a single sort: `created_at` descending (most recent first). Unlike Activities, there is no secondary "due date" ordering branch — Notes have no `due_at` field.

**Rationale**: Notes are a chronological log. The natural consumption order is most-recent-first. There is no scheduling concept on a Note that would require a different sort for the feed view vs. the global list view.

**Decision 10: Attachments list feed — `created_at` descending**

Same as Notes. Attachments are a chronological list of uploads. No conditional sort branch needed.

---

## Decision 11: Note body — text field, no maximum length enforced at application layer

**Decision**: `body` is a `TextField` with no `max_length` enforced in application code. The database text column has no length limit beyond MySQL's `LONGTEXT` (4 GB effective limit).

**Rationale**: Spec Assumption 1: "body has no enforced maximum length beyond standard database text column constraints." A `CharField(max_length=...)` would require a decision on the limit without clear business justification. `TextField` maps to MySQL `LONGTEXT`.

---

## Decision 12: `owner_fk` SET_NULL on User delete (both Note and Attachment)

**Decision**: Both models define `owner = ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=SET_NULL, related_name='...')`. If the owner User is deleted, the FK is set to null; the Note/Attachment is preserved.

**Rationale**: Spec FR-005, FR-010. Consistent with how `created_by` and `assigned_to` behave across all CRM entities. Deleting a user should not cascade-delete their notes or attachments — that content belongs to the organisational record, not the individual user.
