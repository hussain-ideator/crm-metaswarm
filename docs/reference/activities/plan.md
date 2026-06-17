# Implementation Plan: Activities Module

**Branch**: `feat/activities-module` | **Date**: 2026-06-15 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `agent-os/specs/activities/spec.md`

---

## Summary

Build the Activities module — the fifth and final CRM entity in Phase 1, sitting at the top of the dependency chain (core ← accounts ← companies ← contacts ← leads ← deals ← activities). Activities (tasks, calls, meetings) can be associated with any CRM entity via Django's ContentTypes generic relation. Provides a full CRUD API with soft delete, two dedicated completion lifecycle actions, and a reusable frontend activity feed widget.

The backend reuses `TimestampedModel`, JWT Bearer auth, `django-filter`, and the shared `PageNumberPagination` subclass. The architecturally distinctive feature is the ContentTypes generic relation: the filter layer translates human-readable string labels (`lead`, `contact`, `company`, `deal`) into ContentType instances via `ContentType.objects.get_for_model()` — no raw ContentType IDs are exposed in the public API. The activity feed widget is a frontend-only composition calling the standard list endpoint with `?content_type=<label>&object_id=<id>` filters.

**Three design decisions are locked by user directive and must not be changed:**

1. `object_id` is a **soft reference** — no existence check against the target table in Phase 1.
2. Feed sort order: `queryset.order_by(F('due_at').asc(nulls_last=True), '-created_at')`.
3. Content-type label resolution via `ContentType.objects.get_for_model()` lives in `filters.py`.

---

## Technical Context

**Language/Version**: Python 3.12 (backend) · TypeScript 5 (frontend)

**Primary Dependencies**:
- Backend: Django 5.2, adrf (async DRF), drf-spectacular, django-filter, simplejwt, `django.contrib.contenttypes` (Django built-in)
- Frontend: Next.js 16, React 19, TanStack Query v5, TanStack Table v8, React Hook Form 7, Zod 4, Tailwind CSS v4

**Storage**: MySQL 8.0 (utf8mb4) via `DATABASE_URL` / django-environ

**Testing**: pytest + pytest-django + factory_boy (backend) · Vitest + React Testing Library (frontend unit) · Playwright (frontend e2e)

**Target Platform**: Web application — Django REST API + Next.js frontend, deployed separately

**Project Type**: Web application (fullstack, separate backend/frontend)

**Performance Goals**: Activity list updates without full page reload (SC-002); activity feed renders within the same page load as the parent record (SC-003); `select_related('assigned_to', 'content_type', 'created_by')` on all queryset operations to prevent N+1

**Constraints**:
- Pagination max `page_size` = 100
- JWT Bearer auth on every endpoint; unauthenticated → 401 (FR-032)
- Soft delete only — no hard deletes (FR-026)
- `assigned_to` uses `SET_NULL` (FR-017); `created_by` uses `SET_NULL` (FR-018)
- `content_type` FK uses `SET_NULL` (ContentType rows are system-managed and never deleted in practice)
- `object_id` is a soft reference — **no existence check** against the target record (Assumption 9, FR-015)
- Activities app must be installed after Deals; dependency order enforced (FR-033)

**Scale/Scope**: Single CRM team, Phase 1 — no record-level permission scoping

---

## Constitution Check

*The project constitution file is a blank template (no principles ratified yet). No active gates apply. Re-evaluate when the constitution is populated.*

**Pre-design gate status**: PASS (no violations)
**Post-design gate status**: PASS

---

## Project Structure

### Documentation (this feature)

```text
agent-os/specs/activities/
├── plan.md            ← this file
├── spec.md            ← feature specification
├── research.md        ← Phase 0 decisions
├── data-model.md      ← Phase 1 entity design
├── quickstart.md      ← Phase 1 validation guide
├── checklists/
│   └── requirements.md
└── contracts/
    └── openapi-activities.yaml
```

### Source Code

```text
backend/
├── apps/
│   └── activities/
│       ├── __init__.py
│       ├── apps.py
│       ├── admin.py
│       ├── models.py          ← Activity (TextChoices enum, ContentTypes GFK, TimestampedModel)
│       ├── serializers.py     ← ActivitySerializer (content_type label in/out; covalidated pair)
│       ├── filters.py         ← ActivityFilter + resolve_content_type_from_label() + CONTENT_TYPE_LABEL_MAP
│       ├── views.py           ← ActivityViewSet (complete / incomplete @actions)
│       ├── urls.py            ← router registration
│       ├── migrations/
│       │   └── 0001_initial.py
│       └── tests/
│           ├── __init__.py
│           ├── factories.py
│           ├── test_models.py
│           ├── test_serializers.py    ← content_type label round-trip, completion lifecycle, pair validation
│           └── test_views.py         ← CRUD, filter, search, complete/incomplete, auth, soft delete
└── crm/
    ├── settings.py    ← add 'apps.activities' to INSTALLED_APPS (after 'apps.deals')
    └── urls.py        ← add path("api/", include("apps.activities.urls"))

frontend/src/
├── app/
│   └── (dashboard)/
│       └── activities/
│           ├── page.tsx          ← list view (search, filter, sort, pagination)
│           ├── new/
│           │   └── page.tsx      ← create form
│           └── [id]/
│               ├── page.tsx      ← detail view (type badge, completion status, linked record)
│               └── edit/
│                   └── page.tsx  ← edit form
└── features/
    └── activities/
        ├── api.ts
        ├── types.ts
        ├── schemas/
        │   └── activity.ts       ← Zod schema (subject required; type required; content_type+object_id covalidated)
        ├── components/
        │   ├── ActivityTable.tsx
        │   ├── ActivityFilters.tsx
        │   ├── ActivityForm.tsx
        │   ├── ActivityFeed.tsx        ← reusable widget; props: contentType + objectId
        │   ├── CompleteButton.tsx      ← inline toggle; calls complete / incomplete endpoints
        │   └── DeleteActivityButton.tsx
        └── hooks/
            ├── useActivities.ts
            ├── useActivity.ts
            ├── useCreateActivity.ts
            ├── useUpdateActivity.ts
            ├── useDeleteActivity.ts
            ├── useCompleteActivity.ts  ← calls POST /api/activities/{id}/complete/
            └── useActivityFeed.ts     ← wraps useActivities with fixed content_type+object_id params
```

---

## Design Decisions

### Activity Model

```python
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from apps.core.models import TimestampedModel

class Activity(TimestampedModel):
    class ActivityType(models.TextChoices):
        TASK    = 'task',    'Task'
        CALL    = 'call',    'Call'
        MEETING = 'meeting', 'Meeting'

    type         = models.CharField(max_length=20, choices=ActivityType.choices)
    subject      = models.CharField(max_length=500)
    description  = models.TextField(blank=True, default='')
    due_at       = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    assigned_to  = models.ForeignKey(
                       settings.AUTH_USER_MODEL,
                       null=True, blank=True,
                       on_delete=models.SET_NULL,
                       related_name='assigned_activities')
    content_type = models.ForeignKey(
                       ContentType,
                       null=True, blank=True,
                       on_delete=models.SET_NULL,
                       related_name='+')
    object_id    = models.PositiveIntegerField(null=True, blank=True)
    content_object = GenericForeignKey('content_type', 'object_id')
    is_deleted   = models.BooleanField(default=False, db_index=True)

    class Meta:
        db_table = 'activities_activity'
        ordering = ['-created_at']
        indexes  = [
            models.Index(fields=['content_type', 'object_id']),
        ]
```

`GenericForeignKey` is a virtual accessor — it adds no DB column. The real DB columns are `content_type_id` (FK to `django_content_type`) and `object_id` (PositiveIntegerField). A composite index on `(content_type_id, object_id)` covers the feed filter query efficiently.

`description` defaults to `''` (not null) so the API never returns `null` for a text field — consistent with the pattern used across Lead, Company, Contact.

`ActivityType` is a `TextChoices` inner class — a three-value enum stored as a string. No separate lookup table.

### Decision 1 — `object_id` Soft Reference: No Existence Validation (Phase 1)

`object_id` stores the primary key of the related CRM record. **No SELECT is issued against the target table to confirm the record exists.** This is a deliberate Phase 1 decision (Assumption 9, FR-015).

**Why no existence check:**
- Existence checks would require runtime queries per create/update, adding latency for a generic relation that points to any of four different tables.
- Alternatively, importing target model classes at module level would create import-time coupling from `apps.activities` into all four entity apps, risking circular imports.
- The ContentTypes framework is specifically designed for this soft-reference pattern. If a target record is later deleted or soft-deleted, `content_object` returns `None` — the `content_type_id` and `object_id` values remain on the Activity row intact (FR-015).

**Do not add existence checks in Phase 1.** The serializer validate() only enforces the pair constraint:

```python
def validate(self, attrs):
    ct_label = attrs.get('_content_type_label')  # resolved in to_internal_value
    oid      = attrs.get('object_id')

    # Both must be present or both null (FR-014)
    if bool(ct_label) != bool(oid is not None):
        raise serializers.ValidationError(
            'content_type and object_id must both be provided or both be null.'
        )

    # ❌ DO NOT add — no existence check against the target record (Phase 1 soft reference)
    # target = content_type.get_object_for_this_type(pk=object_id)
    # if not target: raise ValidationError(...)

    return attrs
```

### Decision 2 — Feed Sort Order: `F('due_at').asc(nulls_last=True), '-created_at'` (FR-029)

When the list endpoint is filtered by a specific related record (`?content_type=<label>&object_id=<id>`), the queryset is ordered by:

```python
from django.db.models import F

queryset.order_by(F('due_at').asc(nulls_last=True), '-created_at')
```

**Why `F('due_at').asc(nulls_last=True)`**: Activities with a due date appear first, sorted earliest-first (overdue at top). Activities with no due date (`due_at=null`) fall at the bottom. A plain `.order_by('due_at')` would place nulls first in MySQL (null sorts as the lowest value in ASC order). `nulls_last=True` corrects this via `ORDER BY due_at ASC NULLS LAST`.

**Why `'-created_at'` as secondary**: Within the null-due_at group — and as a tiebreaker for same-timestamp due dates — show the most recently created activity first.

**Where it is applied**: In `ActivityViewSet.get_queryset()`, the feed sort is applied conditionally only when both `?content_type` and `?object_id` are present. The global activity list retains `-created_at` (Meta-level default) and allows client-controlled ordering via `?ordering=`.

```python
def get_queryset(self):
    qs = Activity.objects.filter(is_deleted=False).select_related(
        'assigned_to', 'content_type', 'created_by'
    )
    ct_label = self.request.query_params.get('content_type', '').strip()
    oid      = self.request.query_params.get('object_id', '').strip()
    if ct_label and oid:
        return qs.order_by(F('due_at').asc(nulls_last=True), '-created_at')
    return qs
```

The DRF `OrderingFilter` can then override this for non-feed requests via `?ordering=`.

### Decision 3 — `content_type` Label Resolution (FR-025) — Most Complex Part of This Module

The public API exposes `content_type` as a **human-readable string label** (`lead`, `contact`, `company`, `deal`) in both request input and response output. Raw ContentType integer IDs are never exposed. The entire resolution layer lives in `filters.py`.

**Resolution map and helper function (in `filters.py`):**

```python
from django.apps import apps as django_apps
from django.contrib.contenttypes.models import ContentType
import django_filters

# Maps public API label → (app_label, model_name)
CONTENT_TYPE_LABEL_MAP: dict[str, tuple[str, str]] = {
    'lead':    ('leads',     'lead'),
    'contact': ('contacts',  'contact'),
    'company': ('companies', 'company'),
    'deal':    ('deals',     'deal'),
}

def resolve_content_type_from_label(label: str) -> ContentType | None:
    """
    Resolve a human-readable label to a ContentType instance.
    Returns None if the label is not in CONTENT_TYPE_LABEL_MAP.
    Uses django_apps.get_model() (lazy, runtime) to avoid import-time coupling.
    Uses ContentType.objects.get_for_model() which caches after the first call.
    """
    entry = CONTENT_TYPE_LABEL_MAP.get(label.lower())
    if not entry:
        return None
    app_label, model_name = entry
    model_class = django_apps.get_model(app_label, model_name)
    return ContentType.objects.get_for_model(model_class)
```

**Why `django_apps.get_model()` + `get_for_model()`** (not direct model imports):

Direct imports such as `from apps.leads.models import Lead` at module level in `activities/filters.py` would create import-time dependencies from `apps.activities` into every entity app. Because activities sits at the top of the dependency chain, these imports would create circular import chains at Django startup. `django_apps.get_model('leads', 'lead')` is resolved lazily at runtime, after all apps have loaded, eliminating the coupling entirely. `ContentType.objects.get_for_model()` is the idiomatic ContentTypes API and maintains an internal in-process cache — the DB query fires only on the first call per model class per process.

**Filter class applying the resolution:**

```python
class ActivityFilter(django_filters.FilterSet):
    type        = django_filters.CharFilter(field_name='type')
    assigned_to = django_filters.NumberFilter(field_name='assigned_to_id')

    class Meta:
        model  = Activity
        fields = ['type', 'assigned_to']

    def filter_queryset(self, queryset):
        queryset = super().filter_queryset(queryset)
        ct_label = self.data.get('content_type', '').strip()
        oid      = self.data.get('object_id', '').strip()

        if ct_label or oid:
            if not (ct_label and oid):
                raise serializers.ValidationError(
                    'content_type and object_id must both be provided together.'
                )
            ct = resolve_content_type_from_label(ct_label)
            if ct is None:
                raise serializers.ValidationError(
                    {'content_type': f'Invalid label: {ct_label!r}. '
                                     f'Allowed: {sorted(CONTENT_TYPE_LABEL_MAP)}'}
                )
            try:
                oid_int = int(oid)
            except ValueError:
                raise serializers.ValidationError({'object_id': 'Must be an integer.'})
            queryset = queryset.filter(content_type=ct, object_id=oid_int)
        return queryset
```

**Serializer — label round-trip (write label in, label out on read):**

The serializer accepts `content_type` as a string label on write and returns it as a string label on read. `object_id` is a plain integer field. The internal `ContentType` FK is resolved from the label in `to_internal_value()` or `validate()` and stored as a FK instance. On serialisation, the reverse map (derived from `CONTENT_TYPE_LABEL_MAP`) converts the stored ContentType back to its label. No raw ContentType ID is ever part of the API response.

### Completion Lifecycle (FR-008–FR-011)

Two dedicated `@action` endpoints handle server-controlled timestamp setting (FR-009), while direct PATCH of `completed_at` satisfies FR-011:

```python
from django.utils import timezone

@action(detail=True, methods=['post'], url_path='complete')
def mark_complete(self, request, pk=None):
    """Sets completed_at to the current server timestamp."""
    activity = self.get_object()
    activity.completed_at = timezone.now()
    activity.save(update_fields=['completed_at', 'updated_at'])
    return Response(ActivitySerializer(activity, context={'request': request}).data)

@action(detail=True, methods=['post'], url_path='incomplete')
def mark_incomplete(self, request, pk=None):
    """Clears completed_at, reverting the activity to incomplete."""
    activity = self.get_object()
    activity.completed_at = None
    activity.save(update_fields=['completed_at', 'updated_at'])
    return Response(ActivitySerializer(activity, context={'request': request}).data)
```

PATCH of `completed_at` (explicit timestamp) is also accepted by the standard update endpoint (FR-011).

### Search (FR-021)

```python
if q := request.query_params.get('q', '').strip():
    queryset = queryset.filter(
        Q(subject__icontains=q) | Q(description__icontains=q)
    )
```

Both `subject` and `description` are columns on `activities_activity`. No JOIN is needed.

### Base Queryset with `select_related` (N+1 Prevention)

```python
def get_queryset(self):
    return Activity.objects.filter(is_deleted=False).select_related(
        'assigned_to', 'content_type', 'created_by'
    )
```

`content_type` is a FK to `django_content_type` (~30 rows, one per model registered in the system). `select_related` avoids a per-row query when serialising the `content_type` label.

### Soft Delete (`destroy()` Override)

```python
def destroy(self, request, *args, **kwargs):
    activity = self.get_object()
    activity.is_deleted = True
    activity.save(update_fields=['is_deleted', 'updated_at'])
    return Response(status=status.HTTP_204_NO_CONTENT)
```

### Nullable FK Serialisation

Each FK appears as:
- **Writable**: `<field>_id` PrimaryKeyRelatedField (accepts `null` to clear)
- **Read-only**: `<field>` nested minimal serializer

```python
assigned_to_id = serializers.PrimaryKeyRelatedField(
    source='assigned_to',
    queryset=get_user_model().objects.filter(is_active=True),
    allow_null=True, required=False, write_only=True,
)
assigned_to = UserMinimalSerializer(source='assigned_to', read_only=True)
```

### Activities App Independence (FR-033)

No module-level imports from `apps.leads`, `apps.contacts`, `apps.companies`, or `apps.deals` appear in `apps/activities/`. The `django_apps.get_model()` call in `filters.py` is a runtime lookup — no import-time coupling. Migration dependency:

```
activities/0001_initial
    depends on: ('core', '0001_initial'), ('contenttypes', '0001_initial')
    does NOT declare a dependency on leads / contacts / companies / deals migrations
```

The activities app can be installed, migrated, and run independently of the other entity apps. The `content_type` FK points to `django_content_type` (always present), not to individual entity model tables.

### Frontend — `ActivityFeed` Widget

```tsx
interface ActivityFeedProps {
  contentType: 'lead' | 'contact' | 'company' | 'deal'
  objectId: number
}

export function ActivityFeed({ contentType, objectId }: ActivityFeedProps) {
  const { data, isLoading } = useActivityFeed({ contentType, objectId })
  // renders sorted list; each row has CompleteButton for inline toggle
}
```

`useActivityFeed` wraps `useActivities` with pre-fixed `?content_type=<label>&object_id=<id>` params. The query key is `['activities', { content_type: contentType, object_id: objectId }]`. Mutations (`useCompleteActivity`) invalidate this key so the feed refreshes without a page reload (SC-004).

`ActivityFeed` is integrated into the Lead, Contact, Company, and Deal detail pages as part of this module (per Assumption 16 in the spec).

### URL State Persistence (Frontend)

All active query parameters — `q`, `type`, `assigned_to`, `content_type`, `object_id`, `ordering`, `page`, `page_size` — mirrored in the browser URL via `useActivitiesSearchParams` hook using Next.js `useSearchParams` / `router.replace`.

### Pagination

Reuse the shared `PageNumberPagination` subclass: `page` / `page_size`, 1-based, max 100, response shape `{ count, next, previous, results }`.

---

## Complexity Tracking

No constitution violations to justify.

| Design choice | Why it adds complexity | Justification |
|---|---|---|
| ContentTypes generic relation | Polymorphic FK + label resolution layer in filters.py | Spec requires activities to relate to any of four entity types without adding four FK columns |
| `resolve_content_type_from_label()` via `django_apps.get_model()` | Runtime lookup instead of direct import | Avoids import-time circular coupling; activities sits at top of dependency chain |
| Feed sort conditional on filter presence | Two ordering branches in `get_queryset()` | `F('due_at').asc(nulls_last=True)` cannot be a Model Meta ordering; must be applied at queryset level only when the feed filter pair is active |
| Two `@action` completion endpoints | Extra endpoints vs. pure PATCH | FR-009 requires a server-controlled timestamp; PATCH alone allows arbitrary client-supplied `completed_at` values |
| `content_type` label round-trip in serializer | Custom `to_internal_value()` / `SerializerMethodField` | Public API must never expose raw ContentType IDs; label must be resolved inbound and reversed outbound |
