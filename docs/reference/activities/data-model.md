# Data Model: Activities Module

**Date**: 2026-06-15
**Feature**: Activities Module — Phase 1, Module 5

---

## Entities

### Activity

Business entity. Full audit trail via `TimestampedModel`. Polymorphic relation to any CRM record via ContentTypes.

| Field          | Type                              | Constraints                                                   |
|----------------|-----------------------------------|---------------------------------------------------------------|
| id             | AutoField (PK)                    |                                                               |
| type           | CharField(20)                     | choices=ActivityType; not null; required                      |
| subject        | CharField(500)                    | not null; required                                            |
| description    | TextField                         | blank=True, default=''                                        |
| due_at         | DateTimeField                     | null, blank (optional)                                        |
| completed_at   | DateTimeField                     | null, blank; null = incomplete; set to now() on mark_complete |
| assigned_to    | ForeignKey → AUTH_USER_MODEL      | SET_NULL, null, blank, related_name='assigned_activities'     |
| content_type   | ForeignKey → django_content_type  | SET_NULL, null, blank, related_name='+'                       |
| object_id      | PositiveIntegerField              | null, blank; soft reference — no existence check              |
| content_object | GenericForeignKey                 | virtual accessor (no DB column)                               |
| is_deleted     | BooleanField                      | default=False, db_index=True                                  |
| created_at     | DateTimeField                     | auto_now_add (from TimestampedModel)                          |
| updated_at     | DateTimeField                     | auto_now (from TimestampedModel)                              |
| created_by     | ForeignKey → User                 | SET_NULL, null (from TimestampedModel)                        |

**Table**: `activities_activity`

**ActivityType enum** (stored as string, no lookup table):

| Value     | Display  |
|-----------|----------|
| `task`    | Task     |
| `call`    | Call     |
| `meeting` | Meeting  |

---

## Relationships

```
User  (1) ──o< Activity (many, assigned_to)   SET_NULL on User delete
User  (1) ──o< Activity (many, created_by)    SET_NULL on User delete (TimestampedModel)
ContentType (1) ──o< Activity (many)          SET_NULL on ContentType delete (never happens in practice)

Activity }o──o{ Lead      via (content_type + object_id) — soft reference, no cascade
Activity }o──o{ Contact   via (content_type + object_id) — soft reference, no cascade
Activity }o──o{ Company   via (content_type + object_id) — soft reference, no cascade
Activity }o──o{ Deal      via (content_type + object_id) — soft reference, no cascade
```

Deleting a Lead, Contact, Company, or Deal does **NOT** cascade to delete or soft-delete any linked Activity. The `content_type_id` and `object_id` columns remain on the Activity row. `content_object` returns `None` if the target record is no longer accessible (FR-015).

---

## Validation Rules

| Field                     | Rule                                                                               | Layer                    |
|---------------------------|------------------------------------------------------------------------------------|--------------------------|
| type                      | Required; must be one of: `task`, `call`, `meeting`                               | Serializer (ChoiceField) |
| subject                   | Required; not blank                                                                | Serializer               |
| content_type + object_id  | Must both be present or both be null (FR-014)                                     | Serializer (object-level)|
| object_id                 | No existence check against target record — soft reference only (Phase 1)          | Intentionally absent     |
| content_type label        | Must be one of: `lead`, `contact`, `company`, `deal`                              | Serializer / Filter      |
| completed_at              | Null = incomplete; set by server via `/complete/` action; also writable via PATCH | Serializer               |
| assigned_to_id            | Must reference an active User (`is_active=True`); nullable                        | Serializer               |

---

## Completion State Transitions

```
created (completed_at = null)
    │
    │  POST /api/activities/{id}/complete/   → completed_at = timezone.now()
    ▼
completed (completed_at is set)
    │
    │  POST /api/activities/{id}/incomplete/  → completed_at = null
    ▼
created (completed_at = null)
```

`completed_at` can also be set or cleared directly via PATCH (FR-011). There are no lock rules on completed activities in Phase 1 — they remain fully editable.

---

## Generic Relation Resolution Map

The public API uses string labels. Internally, Django's ContentTypes framework stores a FK to `django_content_type`.

| API label  | app_label   | model name | Django model class   |
|------------|-------------|------------|----------------------|
| `lead`     | `leads`     | `lead`     | `apps.leads.Lead`    |
| `contact`  | `contacts`  | `contact`  | `apps.contacts.Contact` |
| `company`  | `companies` | `company`  | `apps.companies.Company` |
| `deal`     | `deals`     | `deal`     | `apps.deals.Deal`    |

Resolution: `ContentType.objects.get_for_model(django_apps.get_model(app_label, model_name))` — see `activities/filters.py`.

---

## Indexes

| Table                | Column(s)                  | Reason                                               |
|----------------------|----------------------------|------------------------------------------------------|
| activities_activity  | is_deleted                 | Default queryset filter (all list views)             |
| activities_activity  | (content_type_id, object_id) | Feed filter — composite index for the pair query   |
| activities_activity  | object_id                  | Covered by composite index above                     |
| activities_activity  | assigned_to_id             | Filter by assigned user (FR-022)                     |
| activities_activity  | type                       | Filter by activity type (FR-022)                     |
| activities_activity  | due_at                     | Feed sort order — `F('due_at').asc(nulls_last=True)` |
| activities_activity  | created_at                 | Default and secondary ordering                       |

---

## API Surface Summary

| Method | Endpoint                              | Description                                      |
|--------|---------------------------------------|--------------------------------------------------|
| GET    | /api/activities/                      | Paginated list; filter, search, order            |
| POST   | /api/activities/                      | Create activity                                  |
| GET    | /api/activities/{id}/                 | Retrieve activity detail                         |
| PUT    | /api/activities/{id}/                 | Full update                                      |
| PATCH  | /api/activities/{id}/                 | Partial update                                   |
| DELETE | /api/activities/{id}/                 | Soft delete (is_deleted=True)                    |
| POST   | /api/activities/{id}/complete/        | Set completed_at = timezone.now()                |
| POST   | /api/activities/{id}/incomplete/      | Clear completed_at (set to null)                 |

**Query parameters (list endpoint)**:

| Parameter    | Type    | Description                                              |
|--------------|---------|----------------------------------------------------------|
| q            | string  | Search across subject and description (icontains)        |
| type         | string  | Filter by activity type: task / call / meeting           |
| assigned_to  | integer | Filter by assigned user PK                               |
| content_type | string  | Filter by related entity label (lead/contact/company/deal)|
| object_id    | integer | Filter by related entity PK; must accompany content_type |
| ordering     | string  | e.g. `-due_at`, `created_at`, `subject`                 |
| page         | integer | Page number (1-based)                                    |
| page_size    | integer | Results per page (max 100)                               |

---

## Migration Plan

| Migration                    | Description                        |
|------------------------------|------------------------------------|
| activities/0001_initial      | Create `activities_activity` table |

No seed data migration required — `ActivityType` values are hardcoded enum constants, not DB rows.

`activities/0001_initial` depends on `('core', '0001_initial')` and `('contenttypes', '0001_initial')`. It does **not** declare a dependency on leads, contacts, companies, or deals migrations.
