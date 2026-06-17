# Research: Activities Module

**Date**: 2026-06-15
**Feature**: Activities Module — Phase 1, Module 5

All decisions below were resolved from existing project ADRs, best-practices.md, tech-stack.md, the deals plan.md (working example), the spec, and explicit user directives. No external research was required — the tech stack is fully pinned.

---

## Decision 1: ContentTypes generic relation approach

**Decision**: Use Django's built-in `django.contrib.contenttypes` framework. The Activity model carries two DB columns — `content_type_id` (FK to `django_content_type`) and `object_id` (PositiveIntegerField) — plus a virtual `GenericForeignKey` accessor. No separate junction table or per-entity FK columns are added to `activities_activity`.

**Rationale**: ContentTypes is the idiomatic Django solution for polymorphic FK relationships. It requires no additional libraries, is already installed in every Django project (`django.contrib.contenttypes` is in `INSTALLED_APPS` by default), and scales cleanly to N entity types without schema changes. A composite DB index on `(content_type_id, object_id)` makes the feed filter query efficient.

**Alternatives considered**:
- Four nullable FK columns (`lead_fk`, `contact_fk`, `company_fk`, `deal_fk`) — rejected: schema sprawl; adding a fifth entity type requires a migration; requires application-level enforcement that exactly one is set.
- Polymorphic library (`django-polymorphic`) — rejected: overkill for a simple related-record pointer; ContentTypes is sufficient and avoids an extra dependency.

---

## Decision 2: `object_id` is a soft reference — no existence validation (Phase 1)

**Decision**: `object_id` is stored as a plain `PositiveIntegerField`. No SELECT is issued against the target entity table to verify the record exists at create or update time. This is explicitly mandated by the user and matches Assumption 9 in the spec.

**Rationale**: Existence checks against polymorphic targets would require either:
(a) importing each target model class into the Activity serializer (import-time coupling, circular imports), or
(b) a runtime `content_type.get_object_for_this_type(pk=object_id)` call per request (extra query, and fails for soft-deleted records which still exist in DB).

The ContentTypes framework is designed for this soft-reference pattern. If a target is later soft-deleted or hard-deleted, `content_object` returns `None`; the `content_type_id` and `object_id` columns on the Activity row are unaffected (FR-015). Phase 2 can add validation if needed.

**Alternatives considered**:
- Runtime existence check via `get_object_for_this_type()` — rejected: adds a query per write; fails for soft-deleted records; violates user directive.
- Direct model import + ORM filter — rejected: creates circular import chain; violates dependency order (FR-033).

---

## Decision 3: Feed sort order — `F('due_at').asc(nulls_last=True), '-created_at'`

**Decision**: When the list endpoint is filtered by a specific related record (`?content_type=<label>&object_id=<id>`), the queryset is ordered by `F('due_at').asc(nulls_last=True)` as primary sort and `-created_at` as secondary. This is applied conditionally in `ActivityViewSet.get_queryset()`. The global list retains `-created_at` as its default.

**Rationale**: Explicitly specified by the user (FR-029). `nulls_last=True` is required because MySQL sorts `NULL` as the lowest value in ASC order — a plain `.order_by('due_at')` would surface null-due_at activities at the top, which is the wrong UX (upcoming/overdue activities should appear first). `F().asc(nulls_last=True)` generates `ORDER BY due_at ASC NULLS LAST`. The `-created_at` secondary tiebreaker ensures deterministic ordering within the null group.

**Alternatives considered**:
- `COALESCE(due_at, '9999-12-31')` in a RawSQL expression — rejected: non-portable, harder to read; `F().asc(nulls_last=True)` is the idiomatic Django ORM approach.
- A single global sort applied to all queryset paths — rejected: the global list must allow client-controlled ordering via `?ordering=`; the feed sort is specific to the record-scoped view.

---

## Decision 4: `content_type` label resolution in `filters.py` via `get_for_model()`

**Decision**: `CONTENT_TYPE_LABEL_MAP` and `resolve_content_type_from_label()` live in `activities/filters.py`. The function uses `django_apps.get_model(app_label, model_name)` (lazy runtime lookup) followed by `ContentType.objects.get_for_model(model_class)` (cached after first call). This is explicitly mandated by the user.

**Rationale**: The public API must accept `?content_type=lead` (not `?content_type_id=7`). The resolution must happen without importing target model classes at module load time — activities sits at the top of the dependency chain and would cause circular imports. `django_apps.get_model()` resolves lazily after all apps are loaded. `get_for_model()` uses Django's internal ContentType cache and issues at most one DB query per model class per process lifetime.

**Alternatives considered**:
- Direct model imports (`from apps.leads.models import Lead`) — rejected: import-time circular dependency.
- `ContentType.objects.get(app_label=..., model=...)` without `get_for_model()` — rejected: bypasses the ContentType cache; user explicitly specified `get_for_model()`.
- Accepting raw `content_type_id` integers in the API — rejected: exposes internal DB IDs to clients; IDs differ across environments; user explicitly specified human-readable labels.

---

## Decision 5: `ActivityType` as `TextChoices` enum, not a lookup table

**Decision**: Activity type is implemented as `models.TextChoices` with three values (`task`, `call`, `meeting`) stored in a `CharField(max_length=20)` on the Activity model. No `ActivityType` lookup table or migration seeding is needed.

**Rationale**: The spec explicitly requires "ActivityType is an enum — not a lookup table." The three values are fixed domain constants unlikely to change in Phase 1. A `TextChoices` enum is self-documenting, validated automatically by DRF's `ChoiceField`, and adds no migration complexity. Stored values are human-readable strings in the DB.

**Alternatives considered**:
- `IntegerChoices` — rejected: integer storage makes DB inspection harder; the spec did not specify integers.
- Separate `ActivityType` lookup table (like `LeadSource`) — explicitly rejected by the spec.

---

## Decision 6: Completion lifecycle — dedicated `@action` endpoints + PATCH

**Decision**: Two `@action` endpoints — `POST /api/activities/{id}/complete/` and `POST /api/activities/{id}/incomplete/` — handle server-controlled timestamp setting (FR-009). Direct PATCH of `completed_at` is also allowed (FR-011). The two approaches coexist.

**Rationale**: FR-009 requires the server to set `completed_at = timezone.now()`, not the client. A dedicated action endpoint satisfies this cleanly: the client posts to `/complete/` with no body; the server stamps the time. FR-011 additionally requires that an explicit `completed_at` value can be submitted directly. Both requirements are satisfied without compromising either.

**Alternatives considered**:
- PATCH only (`completed_at: "auto"` sentinel) — rejected: sentinel strings in JSON fields are non-standard and confusing for API consumers.
- PATCH only with server-side timestamp inference — rejected: cannot distinguish "client sent null" from "client wants server timestamp."
- Single toggle endpoint — rejected: two explicit endpoints (`complete`, `incomplete`) are clearer and make the intent unambiguous.

---

## Decision 7: `content_type` FK `on_delete=SET_NULL`

**Decision**: The `content_type` FK on Activity uses `on_delete=SET_NULL`.

**Rationale**: ContentType rows represent Django model registrations (`django_content_type` table). These rows are created by migrations and are never deleted in normal operation. In the unlikely event a ContentType row is removed (e.g., an app is uninstalled), setting `content_type` to null is safer than cascading a delete to all linked activities. The activity record survives; the generic relation is simply cleared.

**Alternatives considered**:
- `CASCADE` — rejected: would silently delete all activities linked to a given entity type if that app were ever uninstalled.
- `PROTECT` — rejected: would block uninstalling an app with any linked activities; too restrictive for a reference FK.

---

## Decision 8: Activity does not cascade from related entity deletion (FR-015)

**Decision**: Deleting or soft-deleting a Lead, Contact, Company, or Deal does NOT cascade to soft-delete its linked Activities. The `content_type_id` and `object_id` columns remain on the Activity row. `content_object` returns `None` if the target is no longer accessible.

**Rationale**: Explicitly required by the spec (FR-015). Activity history is an independent record of interactions; losing the parent record does not erase the interaction log. A sales user who deletes a Lead should still be able to review the calls and meetings that were logged against it in the global activity list.

**Alternatives considered**:
- Pre-save signal on Lead/Contact/Company/Deal to soft-delete linked Activities — rejected: violates FR-015; creates hidden cascading behaviour driven by signals (hard to trace).
- `CASCADE` on the generic FK — not applicable; GenericForeignKey is virtual and has no `on_delete` behaviour. The `content_type` FK's `SET_NULL` only fires if the ContentType row itself is deleted (not when the referenced object is deleted).
