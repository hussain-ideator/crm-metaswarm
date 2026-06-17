# Data Model: Notes & Attachments Module

**Date**: 2026-06-15
**Feature**: Notes & Attachments Module — Phase 1, Module 6

---

## Entities

### Note

Business entity. Tracks creation and update timestamps via `TimestampedModel`. Polymorphic relation to any CRM record via ContentTypes. Attribution via `owner` (not `created_by` — see divergence note below).

| Field          | Type                              | Constraints                                                             |
|----------------|-----------------------------------|-------------------------------------------------------------------------|
| id             | AutoField (PK)                    |                                                                         |
| body           | TextField                         | not null; required; trimmed whitespace; `blank=False`                   |
| owner          | ForeignKey → AUTH_USER_MODEL      | SET_NULL, null, blank, `related_name='owned_notes'`                     |
| content_type   | ForeignKey → django_content_type  | SET_NULL, null, blank, `related_name='+'`                               |
| object_id      | PositiveIntegerField              | null, blank; soft reference — no existence check                        |
| content_object | GenericForeignKey                 | virtual accessor (no DB column)                                         |
| is_deleted     | BooleanField                      | default=False, db_index=True                                            |
| created_at     | DateTimeField                     | auto_now_add (from TimestampedModel)                                    |
| updated_at     | DateTimeField                     | auto_now (from TimestampedModel)                                        |

**Table**: `notes_note`

> **`owner_fk` vs `created_by` divergence**: `TimestampedModel` also provides a `created_by` FK → User (SET_NULL). On Note and Attachment, `created_by` is inherited but is **never populated and never surfaced in the API**. `owner` is the sole attribution field. `created_by` remains null on all Note and Attachment rows — it is unused dead weight from the abstract base and is explicitly excluded from all serializers. This diverges from Activity (which populates both `assigned_to` and `created_by`) because Note and Attachment have a single user concept: the person who added the record.

---

### Attachment

Business entity. Immutable once uploaded — `file`, `filename`, `file_size`, and `mime_type` cannot be changed after creation. Polymorphic relation to any CRM record via ContentTypes.

| Field          | Type                              | Constraints                                                             |
|----------------|-----------------------------------|-------------------------------------------------------------------------|
| id             | AutoField (PK)                    |                                                                         |
| file           | FileField                         | `upload_to=attachment_upload_path`; not null; required                  |
| filename       | CharField(255)                    | set server-side from uploaded file; not null; not user-editable         |
| file_size      | PositiveIntegerField              | bytes; set server-side; not user-editable                               |
| mime_type      | CharField(100)                    | set server-side via magic byte detection; not user-editable             |
| owner          | ForeignKey → AUTH_USER_MODEL      | SET_NULL, null, blank, `related_name='owned_attachments'`               |
| content_type   | ForeignKey → django_content_type  | SET_NULL, null, blank, `related_name='+'`                               |
| object_id      | PositiveIntegerField              | null, blank; soft reference — no existence check                        |
| content_object | GenericForeignKey                 | virtual accessor (no DB column)                                         |
| is_deleted     | BooleanField                      | default=False, db_index=True                                            |
| created_at     | DateTimeField                     | auto_now_add (from TimestampedModel)                                    |
| updated_at     | DateTimeField                     | auto_now (from TimestampedModel)                                        |

**Table**: `notes_attachment`

> `GenericForeignKey` adds no DB column. The real DB columns are `content_type_id` (FK to `django_content_type`) and `object_id` (PositiveIntegerField).

> `owner_fk` vs `created_by`: same divergence as Note above — `created_by` is inherited from `TimestampedModel` but never populated; `owner` is the sole attribution field.

---

## Model Code Sketches

### `upload_to` callable for `Attachment.file`

```python
# apps/notes/models.py
import os
from datetime import date

def attachment_upload_path(instance, filename):
    """
    Produces: attachments/<year>/<month>/<sanitised_filename>
    Sanitises to prevent path traversal and filesystem-unsafe characters.
    Django's storage backend appends a random suffix on collisions.
    """
    filename = os.path.basename(filename)  # strip any directory prefix
    safe = set('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-')
    filename = ''.join(c if c in safe else '_' for c in filename)
    today = date.today()
    return f'attachments/{today.year}/{today.month:02d}/{filename}'
```

### Note model

```python
from django.db import models
from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from apps.core.models import TimestampedModel

class Note(TimestampedModel):
    body = models.TextField()
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='owned_notes',
    )
    content_type = models.ForeignKey(
        ContentType,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='+',
    )
    object_id = models.PositiveIntegerField(null=True, blank=True)
    content_object = GenericForeignKey('content_type', 'object_id')
    is_deleted = models.BooleanField(default=False, db_index=True)

    class Meta:
        db_table = 'notes_note'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['content_type', 'object_id']),
        ]
```

### Attachment model

```python
class Attachment(TimestampedModel):
    file = models.FileField(upload_to=attachment_upload_path)
    filename = models.CharField(max_length=255)
    file_size = models.PositiveIntegerField()   # bytes
    mime_type = models.CharField(max_length=100)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='owned_attachments',
    )
    content_type = models.ForeignKey(
        ContentType,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='+',
    )
    object_id = models.PositiveIntegerField(null=True, blank=True)
    content_object = GenericForeignKey('content_type', 'object_id')
    is_deleted = models.BooleanField(default=False, db_index=True)

    class Meta:
        db_table = 'notes_attachment'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['content_type', 'object_id']),
        ]
```

---

## Relationships

```
User  (1) ──o< Note       (many, owner)       SET_NULL on User delete
User  (1) ──o< Attachment (many, owner)       SET_NULL on User delete
ContentType (1) ──o< Note (many)              SET_NULL (system-managed; never deleted in practice)
ContentType (1) ──o< Attachment (many)        SET_NULL (system-managed; never deleted in practice)

Note       }o──o{ Lead      via (content_type + object_id) — soft reference, no cascade
Note       }o──o{ Contact   via (content_type + object_id) — soft reference, no cascade
Note       }o──o{ Company   via (content_type + object_id) — soft reference, no cascade
Note       }o──o{ Deal      via (content_type + object_id) — soft reference, no cascade

Attachment }o──o{ Lead      via (content_type + object_id) — soft reference, no cascade
Attachment }o──o{ Contact   via (content_type + object_id) — soft reference, no cascade
Attachment }o──o{ Company   via (content_type + object_id) — soft reference, no cascade
Attachment }o──o{ Deal      via (content_type + object_id) — soft reference, no cascade
```

Deleting or soft-deleting a Lead, Contact, Company, or Deal does **NOT** cascade to Note or Attachment records. `content_type_id` and `object_id` columns remain intact; `content_object` returns `None` if the target is inaccessible.

---

## Validation Rules

### Note

| Field                     | Rule                                                                          | Layer               |
|---------------------------|-------------------------------------------------------------------------------|---------------------|
| body                      | Required; not blank; whitespace-only rejected after trim                      | Serializer          |
| content_type + object_id  | Must both be present or both be null (FR-018)                                 | Serializer (object) |
| object_id                 | No existence check against target record — soft reference only (Phase 1)      | Intentionally absent|
| content_type label        | Must be one of: `lead`, `contact`, `company`, `deal`                         | Serializer / Filter |
| owner                     | Set server-side from request.user; not user-editable; not required on input   | View/Serializer     |

### Attachment

| Field                     | Rule                                                                          | Layer               |
|---------------------------|-------------------------------------------------------------------------------|---------------------|
| file                      | Required; max 10 MB; MIME type must be in ALLOWED_MIME_TYPES allowlist        | Serializer.validate_file() |
| filename                  | Derived server-side from uploaded file; not user-supplied                     | Serializer          |
| file_size                 | Derived server-side from `value.size`; not user-supplied                      | Serializer          |
| mime_type                 | Detected server-side via magic bytes (python-magic); not user-supplied        | Serializer          |
| content_type + object_id  | Must both be present or both be null (FR-018)                                 | Serializer (object) |
| content_type label        | Must be one of: `lead`, `contact`, `company`, `deal`                         | Serializer / Filter |
| owner                     | Set server-side from request.user; not user-editable                          | View/Serializer     |

### MIME Type Allowlist (`ALLOWED_MIME_TYPES` constant in `apps/notes/serializers.py`)

```python
ALLOWED_MIME_TYPES = frozenset({
    'application/pdf',
    # Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    # Office — Word
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    # Office — Excel
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    # Office — PowerPoint
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
})
```

---

## Generic Relation Resolution Map (same as Activities, duplicated in `notes/filters.py`)

| API label  | app_label   | model name | Django model class        |
|------------|-------------|------------|---------------------------|
| `lead`     | `leads`     | `lead`     | `apps.leads.Lead`         |
| `contact`  | `contacts`  | `contact`  | `apps.contacts.Contact`   |
| `company`  | `companies` | `company`  | `apps.companies.Company`  |
| `deal`     | `deals`     | `deal`     | `apps.deals.Deal`         |

Resolution: `ContentType.objects.get_for_model(django_apps.get_model(app_label, model_name))` — see `notes/filters.py`. Do NOT import from `apps.activities.filters`.

---

## Indexes

| Table             | Column(s)                    | Reason                                                        |
|-------------------|------------------------------|---------------------------------------------------------------|
| notes_note        | is_deleted                   | Default queryset filter (all list views)                      |
| notes_note        | (content_type_id, object_id) | Widget filter — composite index for the pair query            |
| notes_note        | created_at                   | Default and only ordering                                     |
| notes_attachment  | is_deleted                   | Default queryset filter (all list views)                      |
| notes_attachment  | (content_type_id, object_id) | Widget filter — composite index for the pair query            |
| notes_attachment  | created_at                   | Default and only ordering                                     |

---

## API Surface Summary

### Notes

| Method | Endpoint              | Description                                            |
|--------|-----------------------|--------------------------------------------------------|
| GET    | /api/notes/           | Paginated list; filterable by content_type + object_id |
| POST   | /api/notes/           | Create note; owner set from request.user               |
| GET    | /api/notes/{id}/      | Retrieve note detail                                   |
| PATCH  | /api/notes/{id}/      | Partial update (body only)                             |
| DELETE | /api/notes/{id}/      | Soft delete (is_deleted=True)                          |

**Query parameters (list endpoint)**:

| Parameter    | Type    | Description                                               |
|--------------|---------|-----------------------------------------------------------|
| content_type | string  | Filter by entity label: lead / contact / company / deal   |
| object_id    | integer | Filter by entity PK; must accompany content_type          |
| page         | integer | Page number (1-based)                                     |
| page_size    | integer | Results per page (max 100)                                |

### Attachments

| Method | Endpoint                   | Description                                            |
|--------|----------------------------|--------------------------------------------------------|
| GET    | /api/attachments/          | Paginated list; filterable by content_type + object_id |
| POST   | /api/attachments/          | Upload file (multipart/form-data); owner from request.user |
| GET    | /api/attachments/{id}/     | Retrieve attachment metadata                           |
| DELETE | /api/attachments/{id}/     | Soft delete (is_deleted=True); file NOT removed from disk |

> No PUT or PATCH for attachments — files are immutable after upload.

**Query parameters (list endpoint)**:

| Parameter    | Type    | Description                                               |
|--------------|---------|-----------------------------------------------------------|
| content_type | string  | Filter by entity label: lead / contact / company / deal   |
| object_id    | integer | Filter by entity PK; must accompany content_type          |
| page         | integer | Page number (1-based)                                     |
| page_size    | integer | Results per page (max 100)                                |

---

## python-magic Dependency

| Platform    | Package           | Version  | Notes                                   |
|-------------|-------------------|----------|-----------------------------------------|
| Linux/macOS | `python-magic`    | >=0.4.27 | Requires `libmagic` (installed by OS)   |
| Windows     | `python-magic-bin`| >=0.4.14 | Bundles `libmagic.dll`; drop-in replacement |

Both packages expose the same API (`import magic; magic.from_buffer(..., mime=True)`). The Windows variant is installed as an optional extra — see `backend/pyproject.toml`.

---

## Migration Plan

| Migration               | Description                                     |
|-------------------------|-------------------------------------------------|
| notes/0001_initial      | Create `notes_note` and `notes_attachment` tables |

`notes/0001_initial` depends on `('core', '0001_initial')` and `('contenttypes', '0001_initial')`. It does NOT declare a dependency on leads, contacts, companies, deals, or activities migrations — the notes app is independent at the migration level.
