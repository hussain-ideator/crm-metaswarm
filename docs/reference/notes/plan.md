# Implementation Plan: Notes & Attachments Module

**Branch**: `feat/notes-module` | **Date**: 2026-06-15 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `agent-os/specs/notes/spec.md`

---

## Summary

Build the Notes & Attachments module — the sixth and final CRM entity in Phase 1, sitting at the top of the dependency chain (core ← accounts ← companies ← contacts ← leads ← deals ← activities ← notes). Notes are free-text records and Attachments are uploaded files; both are attachable to any CRM record (Lead, Contact, Company, Deal) using the same Django ContentTypes generic relation pattern as Activities.

Two backend models share one Django app (`apps.notes`). The Notes API provides full CRUD. The Attachments API provides upload + retrieve + list + soft delete — no edit (files are immutable). File validation uses `python-magic` for server-side MIME type detection (magic bytes, not filename extension). Files are stored on the local filesystem under `attachments/<year>/<month>/`. Frontend delivers two reusable widgets integrated into all four entity detail pages.

**Three design decisions are locked by user directive and must not be changed:**

1. `owner_fk` is the sole user attribution field on Note and Attachment — `created_by` (inherited from `TimestampedModel`) is present in the DB but never populated or surfaced.
2. MIME type validation uses server-side magic byte detection via `python-magic` — client Content-Type and filename extension are not trusted.
3. `attachment_upload_path` callable produces: `attachments/<year>/<month>/<sanitised_filename>`.

---

## Technical Context

**Language/Version**: Python 3.12 (backend) · TypeScript 5 (frontend)

**Primary Dependencies**:
- Backend: Django 5.2, adrf (async DRF), drf-spectacular, django-filter, simplejwt, `django.contrib.contenttypes` (built-in), `python-magic>=0.4.27` (Linux/macOS) / `python-magic-bin>=0.4.14` (Windows)
- Frontend: Next.js 16, React 19, TanStack Query v5, React Hook Form 7, Zod 4, Tailwind CSS v4

**Storage**: MySQL 8.0 (utf8mb4) via `DATABASE_URL` / django-environ. File storage: local filesystem via `MEDIA_ROOT`.

**Testing**: pytest + pytest-django + factory_boy (backend) · Vitest + React Testing Library (frontend unit)

**Target Platform**: Web application — Django REST API + Next.js frontend, deployed separately

**Project Type**: Web application (fullstack, separate backend/frontend)

**Performance Goals**: Widget queries use a composite index on `(content_type_id, object_id)` — no full-table scans. `select_related('owner', 'content_type')` on all queryset operations to prevent N+1.

**Constraints**:
- Pagination max `page_size` = 100
- JWT Bearer auth on every endpoint; unauthenticated → 401 (FR-040)
- Soft delete only — no hard deletes (FR-031)
- `owner_fk` uses `SET_NULL` on User delete (FR-005, FR-010)
- `content_type` FK uses `SET_NULL` (system-managed; ContentType rows never deleted in practice)
- `object_id` is a soft reference — **no existence check** against the target record (Assumption 7, FR-019)
- Notes app must be installed after Activities; dependency order enforced (FR-041)
- Max upload: 10 MB per file (FR-011)
- MIME type: server-side magic byte detection; defined allowlist (FR-012, FR-013)
- Files NOT physically deleted on soft delete (FR-015)

**Scale/Scope**: Single CRM team, Phase 1 — no record-level permission scoping

---

## Constitution Check

*The project constitution file is a blank template (no principles ratified yet). No active gates apply.*

**Pre-design gate status**: PASS (no violations)
**Post-design gate status**: PASS

---

## Project Structure

### Documentation (this feature)

```text
agent-os/specs/notes/
├── plan.md            ← this file
├── spec.md            ← feature specification
├── research.md        ← Phase 0 decisions
├── data-model.md      ← Phase 1 entity design
├── quickstart.md      ← Phase 1 validation guide
├── checklists/
│   └── requirements.md
└── contracts/
    └── openapi-notes.yaml
```

### Source Code

```text
backend/
├── apps/
│   └── notes/
│       ├── __init__.py
│       ├── apps.py
│       ├── admin.py
│       ├── models.py          ← Note, Attachment, attachment_upload_path callable
│       ├── serializers.py     ← NoteSerializer, AttachmentSerializer (MIME validation, server-side field derivation)
│       ├── filters.py         ← NoteFilter, AttachmentFilter + resolve_content_type_from_label() + CONTENT_TYPE_LABEL_MAP
│       ├── views.py           ← NoteViewSet, AttachmentViewSet
│       ├── urls.py            ← router registration
│       ├── migrations/
│       │   └── 0001_initial.py
│       └── tests/
│           ├── __init__.py
│           ├── factories.py
│           ├── test_models.py
│           ├── test_serializers.py    ← MIME validation, file size limit, magic byte detection, pair constraint, owner set server-side
│           └── test_views.py         ← CRUD (Notes), upload/retrieve/list/delete (Attachments), auth, soft delete, filter
└── crm/
    ├── settings.py    ← add 'apps.notes' to INSTALLED_APPS (after 'apps.activities'); configure MEDIA_ROOT, MEDIA_URL
    └── urls.py        ← add path("api/", include("apps.notes.urls")); add static(MEDIA_URL, document_root=MEDIA_ROOT) in DEBUG

frontend/src/
├── app/
│   └── (dashboard)/
│       ├── leads/[id]/page.tsx       ← integrate NotesFeed + AttachmentsWidget
│       ├── contacts/[id]/page.tsx    ← integrate NotesFeed + AttachmentsWidget
│       ├── companies/[id]/page.tsx   ← integrate NotesFeed + AttachmentsWidget
│       └── deals/[id]/page.tsx       ← integrate NotesFeed + AttachmentsWidget
└── features/
    ├── notes/
    │   ├── api.ts
    │   ├── types.ts
    │   ├── schemas/
    │   │   └── note.ts              ← Zod schema (body required; content_type+object_id covalidated)
    │   ├── components/
    │   │   ├── NotesFeed.tsx        ← reusable widget; props: contentType + objectId
    │   │   ├── NoteForm.tsx         ← inline add form
    │   │   ├── NoteItem.tsx         ← single note row with inline edit + delete
    │   │   └── DeleteNoteButton.tsx
    │   └── hooks/
    │       ├── useNotes.ts
    │       ├── useNote.ts
    │       ├── useCreateNote.ts
    │       ├── useUpdateNote.ts
    │       ├── useDeleteNote.ts
    │       └── useNotesFeed.ts      ← wraps useNotes with fixed content_type+object_id params
    └── attachments/
        ├── api.ts
        ├── types.ts
        ├── schemas/
        │   └── attachment.ts        ← Zod schema for upload form (file required; pair covalidation)
        ├── components/
        │   ├── AttachmentsWidget.tsx ← reusable widget; props: contentType + objectId
        │   ├── AttachmentUploadButton.tsx ← file picker + upload; client-side size pre-check
        │   ├── AttachmentItem.tsx    ← single row: filename, size, type badge, download link, delete
        │   └── DeleteAttachmentButton.tsx
        └── hooks/
            ├── useAttachments.ts
            ├── useAttachment.ts
            ├── useUploadAttachment.ts ← sends multipart/form-data via fetch
            ├── useDeleteAttachment.ts
            └── useAttachmentsFeed.ts ← wraps useAttachments with fixed content_type+object_id params
```

---

## Design Decisions

### `owner_fk` vs `created_by` — Explicit Divergence from `TimestampedModel` Convention

**This is the most important model-level decision for this module.**

`TimestampedModel` (the shared base class in `apps.core`) provides: `created_at`, `updated_at`, and `created_by` (ForeignKey → User, SET_NULL). Every other CRM entity (Lead, Contact, Company, Deal, Activity) uses `created_by` for creation attribution.

**Note and Attachment diverge intentionally**: they define their own `owner` ForeignKey → User (SET_NULL) and treat it as the sole attribution field. `created_by` (inherited from `TimestampedModel`) is present in the DB schema but is **never set, never serialised, and never returned by the API**.

| Entity     | Attribution field | Additional user ref | Why                                      |
|------------|-------------------|---------------------|------------------------------------------|
| Activity   | `created_by`      | `assigned_to`       | Two distinct roles: logger vs. assignee  |
| Note       | `owner`           | —                   | Single role: the note author             |
| Attachment | `owner`           | —                   | Single role: the uploader                |

**Implementation rules**:
- In `NoteSerializer` and `AttachmentSerializer`, `created_by` is excluded from all `fields` lists.
- In `NoteViewSet.perform_create()` and `AttachmentViewSet.perform_create()`, set `owner=request.user`. Do NOT set `created_by`.
- `created_by_id` column in `notes_note` and `notes_attachment` tables will always be `NULL`.
- The serializer `owner` field is a nested `UserMinimalSerializer` (read-only). On write, `owner` is not accepted from the client.

```python
class NoteSerializer(serializers.ModelSerializer):
    owner = UserMinimalSerializer(read_only=True)

    class Meta:
        model = Note
        fields = [
            'id', 'body', 'owner',
            'content_type', 'object_id',
            'created_at', 'updated_at',
        ]
        # 'created_by' is intentionally ABSENT — inherited from TimestampedModel
        # but unused on Note/Attachment. Never add it here.
        read_only_fields = ['id', 'owner', 'created_at', 'updated_at']

class NoteViewSet(viewsets.ModelViewSet):
    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)
        # DO NOT pass created_by= here. created_by stays null on these models.
```

---

### Note Model

```python
from django.db import models
from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from apps.core.models import TimestampedModel

class Note(TimestampedModel):
    body = models.TextField()  # blank=False enforced at serializer layer
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

`GenericForeignKey` is a virtual accessor — no DB column. Real DB columns: `content_type_id` (FK to `django_content_type`) and `object_id` (PositiveIntegerField). Composite index on `(content_type_id, object_id)` covers the widget filter query.

---

### Attachment Model

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

### Decision: `upload_to` Callable — File Storage Path

```python
# apps/notes/models.py
import os
from datetime import date

def attachment_upload_path(instance, filename):
    """
    Produces: attachments/<year>/<month>/<sanitised_filename>

    Sanitises to prevent path traversal and filesystem-unsafe characters.
    Django's storage backend appends a random suffix on name collisions.
    """
    filename = os.path.basename(filename)          # strip any directory prefix
    safe = set(
        'abcdefghijklmnopqrstuvwxyz'
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
        '0123456789._-'
    )
    filename = ''.join(c if c in safe else '_' for c in filename)
    today = date.today()
    return f'attachments/{today.year}/{today.month:02d}/{filename}'
```

**Why `<year>/<month>/`**: Prevents flat-directory accumulation. A structured subdirectory keeps directory entry counts manageable across months of uploads.

**Name collisions**: Django's default `FileSystemStorage` appends a random suffix (e.g., `proposal_a1b2c3.pdf`) when the target path already exists. No application-level collision handling is needed.

---

### Decision: `python-magic` Dependency & Platform Handling

`python-magic` wraps `libmagic`, the same library used by the Unix `file` command. It identifies file types by inspecting magic bytes — the only reliable method for server-side MIME detection (FR-013).

**Platform difference**:
- Linux/macOS: `python-magic` requires `libmagic` installed by the OS (`libmagic1` on Debian/Ubuntu, `libmagic` via Homebrew). The Python package is a thin wrapper.
- Windows: `python-magic-bin` ships a pre-built `libmagic.dll` alongside the Python bindings. It is a drop-in replacement — same import name (`import magic`), same API.

**`backend/pyproject.toml` update**:

```toml
[project]
name = "crm-backend"
version = "0.1.0"
description = "CRM backend (Django + adrf)"
requires-python = ">=3.12"
dependencies = [
    "python-magic>=0.4.27",
    # ... other existing dependencies ...
]

[project.optional-dependencies]
# On Windows, install python-magic-bin instead of python-magic.
# It bundles the libmagic DLL and is a drop-in replacement (same import: `import magic`).
# Install:  pip install ".[magic-win]"
# Linux/macOS: no extra needed if libmagic is OS-installed (apt install libmagic1 / brew install libmagic).
magic-win = ["python-magic-bin>=0.4.14"]
```

**Usage in `AttachmentSerializer.validate_file()`**:

```python
import magic

ALLOWED_MIME_TYPES = frozenset({
    'application/pdf',
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
})

class AttachmentSerializer(serializers.ModelSerializer):

    def validate_file(self, value):
        # 1. Size check (fast — Django already buffered the upload)
        if value.size > 10 * 1024 * 1024:
            raise serializers.ValidationError('File exceeds the 10 MB limit.')

        # 2. MIME detection via magic bytes — read only the header, not the whole file
        header = value.read(2048)
        value.seek(0)  # rewind so Django can save the full file
        detected_mime = magic.from_buffer(header, mime=True)

        if detected_mime not in ALLOWED_MIME_TYPES:
            raise serializers.ValidationError(
                f'File type "{detected_mime}" is not allowed. '
                f'Allowed types: {sorted(ALLOWED_MIME_TYPES)}'
            )
        return value

    def create(self, validated_data):
        file = validated_data['file']
        validated_data['filename'] = os.path.basename(file.name)
        validated_data['file_size'] = file.size
        # Re-detect MIME for storage (same logic as validate_file)
        header = file.read(2048)
        file.seek(0)
        validated_data['mime_type'] = magic.from_buffer(header, mime=True)
        return super().create(validated_data)
```

---

### Decision: `content_type` Label Resolution (identical pattern to Activities, NOT imported from it)

`CONTENT_TYPE_LABEL_MAP` and `resolve_content_type_from_label()` are defined in `apps/notes/filters.py`. They are NOT imported from `apps.activities.filters` — the utility is duplicated to keep the modules independent.

```python
# apps/notes/filters.py
from django.apps import apps as django_apps
from django.contrib.contenttypes.models import ContentType

CONTENT_TYPE_LABEL_MAP: dict[str, tuple[str, str]] = {
    'lead':    ('leads',     'lead'),
    'contact': ('contacts',  'contact'),
    'company': ('companies', 'company'),
    'deal':    ('deals',     'deal'),
}

def resolve_content_type_from_label(label: str) -> ContentType | None:
    entry = CONTENT_TYPE_LABEL_MAP.get(label.lower())
    if not entry:
        return None
    app_label, model_name = entry
    model_class = django_apps.get_model(app_label, model_name)
    return ContentType.objects.get_for_model(model_class)
```

**Why NOT import from `apps.activities`**: Although `apps.notes` sits after `apps.activities` in the install order, importing at module level from `activities/filters.py` would create inter-app coupling. The four-line utility is cheaper to duplicate than to couple two independent modules.

---

### `content_type` Serialisation — Label Round-Trip

Same pattern as Activities. `content_type` is exposed as a string label in both request input and response output. Raw ContentType integer IDs are never in the API.

```python
# Read: ContentType FK → label string
content_type_label = serializers.SerializerMethodField()

def get_content_type_label(self, obj):
    if obj.content_type is None:
        return None
    for label, (app, model) in CONTENT_TYPE_LABEL_MAP.items():
        if obj.content_type.app_label == app and obj.content_type.model == model:
            return label
    return None
```

---

### Soft Delete — Notes

```python
def destroy(self, request, *args, **kwargs):
    note = self.get_object()
    note.is_deleted = True
    note.save(update_fields=['is_deleted', 'updated_at'])
    return Response(status=status.HTTP_204_NO_CONTENT)
```

---

### Soft Delete — Attachments (file NOT removed from disk)

```python
def destroy(self, request, *args, **kwargs):
    attachment = self.get_object()
    attachment.is_deleted = True
    attachment.save(update_fields=['is_deleted', 'updated_at'])
    # Physical file on disk intentionally preserved (FR-015).
    # Future cleanup: management command scanning is_deleted=True rows
    # and removing files after a retention window.
    return Response(status=status.HTTP_204_NO_CONTENT)
```

---

### AttachmentViewSet — No Update Actions

```python
class AttachmentViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    """Attachments are immutable after upload. No update/partial_update actions."""
    parser_classes = [MultiPartParser, FormParser]
    ...
```

Using individual mixins (not `ModelViewSet`) ensures PUT and PATCH routes are never registered — any attempt returns 405.

---

### Base Queryset with `select_related` (N+1 Prevention)

```python
# NoteViewSet
def get_queryset(self):
    return Note.objects.filter(is_deleted=False).select_related(
        'owner', 'content_type'
    )

# AttachmentViewSet
def get_queryset(self):
    return Attachment.objects.filter(is_deleted=False).select_related(
        'owner', 'content_type'
    )
```

---

### `MEDIA_ROOT` / `MEDIA_URL` Configuration

```python
# crm/settings.py
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'
```

```python
# crm/urls.py — development only
from django.conf import settings
from django.conf.urls.static import static

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
```

In production, `MEDIA_ROOT` is served by nginx or a CDN — Django must not serve media files in production.

---

### Frontend — `NotesFeed` Widget

```tsx
interface NotesFeedProps {
  contentType: 'lead' | 'contact' | 'company' | 'deal'
  objectId: number
}

export function NotesFeed({ contentType, objectId }: NotesFeedProps) {
  const { data, isLoading } = useNotesFeed({ contentType, objectId })
  // Renders: inline add form at top, then NoteItem rows sorted created_at DESC
  // Empty state: "No notes yet" when data.results is empty
}
```

`useNotesFeed` wraps `useNotes` with pre-fixed `?content_type=<label>&object_id=<id>` params. Mutations (`useCreateNote`, `useUpdateNote`, `useDeleteNote`) invalidate the query key `['notes', { content_type, object_id }]` so the feed refreshes without page reload.

---

### Frontend — `AttachmentsWidget`

```tsx
interface AttachmentsWidgetProps {
  contentType: 'lead' | 'contact' | 'company' | 'deal'
  objectId: number
}

export function AttachmentsWidget({ contentType, objectId }: AttachmentsWidgetProps) {
  const { data, isLoading } = useAttachmentsFeed({ contentType, objectId })
  // Renders: "Upload File" button at top, then AttachmentItem rows sorted created_at DESC
  // Empty state: "No attachments yet"
}
```

Upload flow: `useUploadAttachment` sends `multipart/form-data` via `fetch`. Client-side pre-check rejects files > 10 MB with an immediate UI error before the request is sent. Client `accept` attribute on `<input>` filters by extension for UX — but server-side magic byte detection is authoritative. On success, invalidates `['attachments', { content_type, object_id }]`.

---

### Notes App Independence (FR-041)

No module-level imports from `apps.leads`, `apps.contacts`, `apps.companies`, `apps.deals`, or `apps.activities` appear in `apps/notes/`. Migration dependency:

```python
# notes/migrations/0001_initial.py
class Migration(migrations.Migration):
    dependencies = [
        ('core', '0001_initial'),
        ('contenttypes', '0001_initial'),
    ]
    # Does NOT depend on leads, contacts, companies, deals, or activities migrations.
```

The notes app can be installed, migrated, and tested independently of all entity apps.

---

## Complexity Tracking

No constitution violations to justify.

| Design choice | Why it adds complexity | Justification |
|---|---|---|
| ContentTypes generic relation | Polymorphic FK + label resolution layer in filters.py | Spec requires notes/attachments to relate to any of four entity types without adding four FK columns |
| `resolve_content_type_from_label()` duplicated from activities | Repeated utility in two apps | Keeps modules independent; avoids cross-app import coupling; four lines — not worth abstracting in Phase 1 |
| `python-magic` platform dependency | Different package on Linux/macOS vs. Windows; OS-level `libmagic` requirement | FR-013 requires server-side magic byte inspection — no reliable alternative without libmagic |
| `owner_fk` instead of `created_by` | Diverges from convention; `created_by` present in DB but always null on these models | Spec explicitly names `owner_fk`; conceptually correct for note author / file uploader |
| `attachment_upload_path` callable | Custom upload path instead of a static string | Structured `<year>/<month>/` prevents flat-directory inode degradation at scale |
| Mixin-based `AttachmentViewSet` | Individual mixins instead of `ModelViewSet` | Ensures PUT/PATCH routes are never registered; 405 is the correct response |
| Soft delete without disk cleanup | Files accumulate on disk after soft delete | FR-015 explicitly defers physical cleanup; keeping delete fast and safe is the Phase 1 priority |
