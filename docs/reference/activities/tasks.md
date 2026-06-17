---

description: "Task list for the Activities module implementation"
---

# Tasks: Activities Module

**Input**: Design documents from `agent-os/specs/activities/`

**Prerequisites**: [plan.md](plan.md) · [spec.md](spec.md) · [data-model.md](data-model.md) · [contracts/openapi-activities.yaml](contracts/openapi-activities.yaml)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US7)
- Exact file paths are included in every description

## Path Conventions

- Backend: `backend/apps/activities/` · `backend/crm/settings.py` · `backend/crm/urls.py`
- Frontend: `frontend/src/features/activities/` · `frontend/src/app/(dashboard)/activities/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Bootstrap the activities app so migrations can run and the router can be wired up. No user story can begin until this is done.

- [ ] T001 Create activities app skeleton — `backend/apps/activities/__init__.py`, `apps.py` (`name='apps.activities'`, `default_auto_field='django.db.models.BigAutoField'`), `admin.py` — and add `'apps.activities'` to `INSTALLED_APPS` in `backend/crm/settings.py` after `'apps.deals'` (dependency order: core ← accounts ← companies ← contacts ← leads ← deals ← activities)
- [ ] T002 Create `backend/apps/activities/tests/__init__.py` to make the tests directory a package; confirm `django.contrib.contenttypes` is already present in `INSTALLED_APPS` (it is a Django built-in — no explicit addition needed)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Activity model, migration, serializer (with content_type label round-trip), filter (with label resolution), pagination, ViewSet base, URL wiring, and frontend types — everything every user story depends on.

**⚠️ CRITICAL**: Must be complete before Phase 3+

- [ ] T003 Implement `Activity` model extending `TimestampedModel` in `backend/apps/activities/models.py`:
  - `ActivityType(TextChoices)` inner class — `TASK='task'`, `CALL='call'`, `MEETING='meeting'`
  - `type = CharField(max_length=20, choices=ActivityType.choices)`
  - `subject = CharField(max_length=500)`
  - `description = TextField(blank=True, default='')`
  - `due_at = DateTimeField(null=True, blank=True)`
  - `completed_at = DateTimeField(null=True, blank=True)`
  - `assigned_to = ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=SET_NULL, related_name='assigned_activities')`
  - `content_type = ForeignKey(ContentType, null=True, blank=True, on_delete=SET_NULL, related_name='+')`
  - `object_id = PositiveIntegerField(null=True, blank=True)`
  - `content_object = GenericForeignKey('content_type', 'object_id')` (virtual, no DB column)
  - `is_deleted = BooleanField(default=False, db_index=True)`
  - `Meta`: `db_table='activities_activity'`; `ordering=['-created_at']`; `indexes=[Index(fields=['content_type', 'object_id'])]`
  - Imports: `from django.contrib.contenttypes.fields import GenericForeignKey`; `from django.contrib.contenttypes.models import ContentType`; `from apps.core.models import TimestampedModel`
- [ ] T004 Generate `0001_initial.py` schema migration creating `activities_activity` table in `backend/apps/activities/migrations/0001_initial.py` (run: `python manage.py makemigrations activities`); verify migration depends on `('core', '0001_initial')` and `('contenttypes', '0001_initial')` — NOT on leads/contacts/companies/deals migrations (FR-033)
- [ ] T005 [P] Create `ActivityFactory` (model `Activity`; `type` cycles `ActivityType.TASK`; `subject = factory.Sequence(lambda n: f'Activity {n}')`; `description=''`; `due_at=None`; `completed_at=None`; `assigned_to=None`; `content_type=None`; `object_id=None`; `is_deleted=False`) in `backend/apps/activities/tests/factories.py`; import `factory`, `factory.django`, and `Activity`; also import `DjangoModelFactory`
- [ ] T006 [P] Implement `CONTENT_TYPE_LABEL_MAP`, `resolve_content_type_from_label()`, and `ActivityFilter` in `backend/apps/activities/filters.py`:
  - `CONTENT_TYPE_LABEL_MAP: dict[str, tuple[str, str]] = {'lead': ('leads','lead'), 'contact': ('contacts','contact'), 'company': ('companies','company'), 'deal': ('deals','deal')}`
  - `resolve_content_type_from_label(label: str) -> ContentType | None` — uses `django_apps.get_model(app_label, model_name)` (lazy, avoids import-time circular coupling) then `ContentType.objects.get_for_model(model_class)` (cached after first call); returns `None` for unknown labels
  - `ActivityFilter(django_filters.FilterSet)`: `type = CharFilter(field_name='type')`; `assigned_to = NumberFilter(field_name='assigned_to_id')`; `Meta: model=Activity, fields=['type','assigned_to']`
  - Override `filter_queryset(self, queryset)`: call `super().filter_queryset(queryset)`; extract `ct_label` and `oid` from `self.data`; if either provided, validate both present (raise `ValidationError` if only one); call `resolve_content_type_from_label` (raise `ValidationError` with allowed labels if None returned); parse `oid` as int (raise `ValidationError` if not integer); apply `queryset.filter(content_type=ct, object_id=oid_int)`
  - Imports: `from django.apps import apps as django_apps`; `from django.contrib.contenttypes.models import ContentType`; `import django_filters`; `from rest_framework import serializers`; `from .models import Activity`
- [ ] T007 Implement `ActivitySerializer` in `backend/apps/activities/serializers.py`:
  - Write fields: `type` (ChoiceField from `ActivityType.choices`); `subject` (CharField max_length 500); `description` (CharField default ''); `due_at` (DateTimeField allow_null, required=False); `completed_at` (DateTimeField allow_null, required=False, with note: also writable via PATCH for explicit timestamp per FR-011); `assigned_to_id = PrimaryKeyRelatedField(source='assigned_to', queryset=User.objects.filter(is_active=True), allow_null=True, required=False, write_only=True)`; `content_type` (CharField allow_null=True, required=False — accepted as string label on write, returned as string label on read); `object_id` (IntegerField min_value=1, allow_null=True, required=False)
  - Read fields: `assigned_to = UserMinimalSerializer(source='assigned_to', read_only=True)`; `created_by = UserMinimalSerializer(source='created_by', read_only=True)`; `is_deleted = BooleanField(read_only=True)` ; `created_at` / `updated_at` (DateTimeField read_only)
  - `to_internal_value()`: pop `content_type` string label from data; resolve via `resolve_content_type_from_label()`; store resolved `ContentType` instance as `attrs['content_type']`; raise `ValidationError({'content_type': 'Invalid label...'})` for unknown labels
  - `to_representation()`: convert stored `content_type` FK back to label string using reverse lookup from `CONTENT_TYPE_LABEL_MAP` (invert the map: ContentType id → label); return `None` if `content_type` is null
  - `validate(attrs)`: enforce pair constraint — `bool(content_type) != bool(object_id is not None)` → raise `ValidationError('content_type and object_id must both be provided or both be null.')` — **NO existence check against the target record** (Phase 1 soft reference — Decision 1)
  - `UserMinimalSerializer`: `id`, `full_name`, `email`
  - Imports: `get_user_model`, `TimestampedModel`, `Activity`, `resolve_content_type_from_label`, `CONTENT_TYPE_LABEL_MAP`
- [ ] T008 [P] Implement `ActivityPageNumberPagination` subclass (`page`/`page_size`, 1-based, `max_page_size=100`, response shape: `count`/`next`/`previous`/`results`) in `backend/apps/activities/pagination.py`; follows the same pattern as the existing DealPageNumberPagination
- [ ] T009 Implement `ActivityViewSet` base in `backend/apps/activities/views.py` — inherits from `GenericViewSet` only (no CRUD actions yet):
  - `get_queryset()`: `qs = Activity.objects.filter(is_deleted=False).select_related('assigned_to', 'content_type', 'created_by')`; then conditional feed sort — if both `?content_type` and `?object_id` params are present: `return qs.order_by(F('due_at').asc(nulls_last=True), '-created_at')` — else: `return qs` (Meta ordering `-created_at` applies) — **Decision 2: exact sort expression is locked**
  - `serializer_class = ActivitySerializer`
  - `pagination_class = ActivityPageNumberPagination`
  - `filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]`
  - `filterset_class = ActivityFilter`
  - `search_fields = ['subject', 'description']` (DRF SearchFilter handles `?q=` icontains on both columns — no JOIN needed, both are on `activities_activity`)
  - `ordering_fields = ['subject', 'due_at', 'completed_at', 'created_at', 'type', 'assigned_to']`
  - `ordering = ['-created_at']`
  - `permission_classes = [IsAuthenticated]`
  - Imports: `from django.db.models import F`; `from django_filters.rest_framework import DjangoFilterBackend`; `from rest_framework.filters import SearchFilter, OrderingFilter`
- [ ] T010 Register `ActivityViewSet` (basename `'activity'`) with `DefaultRouter` in `backend/apps/activities/urls.py`; wire activities URLs in `backend/crm/urls.py` by adding `path("api/", include("apps.activities.urls"))` (routes: `/api/activities/`, `/api/activities/{id}/`, `/api/activities/{id}/complete/`, `/api/activities/{id}/incomplete/`)
- [ ] T011 [P] Define TypeScript interfaces in `frontend/src/features/activities/types.ts`: `ActivityType = 'task' | 'call' | 'meeting'`; `ContentTypeLabel = 'lead' | 'contact' | 'company' | 'deal'`; `UserMinimal { id: number; full_name: string; email: string }`; `Activity { id: number; type: ActivityType; subject: string; description: string; due_at: string | null; completed_at: string | null; assigned_to_id: number | null; assigned_to: UserMinimal | null; content_type: ContentTypeLabel | null; object_id: number | null; is_deleted: boolean; created_at: string; updated_at: string; created_by: UserMinimal | null }`; `CreateActivityInput { type: ActivityType; subject: string; description?: string; due_at?: string | null; completed_at?: string | null; assigned_to_id?: number | null; content_type?: ContentTypeLabel | null; object_id?: number | null }`; `UpdateActivityInput = Partial<CreateActivityInput>`; `PaginatedActivities { count: number; next: string | null; previous: string | null; results: Activity[] }`; `ActivitiesQueryParams { q?: string; type?: ActivityType; assigned_to?: number; content_type?: ContentTypeLabel; object_id?: number; ordering?: string; page?: number; page_size?: number }`
- [ ] T012 [P] Define Zod schemas in `frontend/src/features/activities/schemas/activity.ts`: `activityTypeSchema = z.enum(['task','call','meeting'])`; `contentTypeLabelSchema = z.enum(['lead','contact','company','deal'])`; `createActivitySchema` — `type: activityTypeSchema`; `subject: z.string().min(1,'Subject is required').max(500)`; `description: z.string().default('')`; `due_at: z.string().datetime().nullable().optional()`; `completed_at: z.string().datetime().nullable().optional()`; `assigned_to_id: z.number().int().positive().nullable().optional()`; `content_type: contentTypeLabelSchema.nullable().optional()`; `object_id: z.number().int().positive().nullable().optional()`; `.superRefine()` for pair validation — if one of `content_type`/`object_id` is set and the other is null, add issue on both fields: "content_type and object_id must both be provided or both be null"
- [ ] T013 [P] Implement all API client functions in `frontend/src/features/activities/api.ts`: `fetchActivities(params: ActivitiesQueryParams): Promise<PaginatedActivities>` (GET `/api/activities/`); `fetchActivity(id: number): Promise<Activity>` (GET `/api/activities/{id}/`); `createActivity(input: CreateActivityInput): Promise<Activity>` (POST `/api/activities/`); `updateActivity(id: number, input: UpdateActivityInput): Promise<Activity>` (PATCH `/api/activities/{id}/`); `deleteActivity(id: number): Promise<void>` (DELETE `/api/activities/{id}/`); `completeActivity(id: number): Promise<Activity>` (POST `/api/activities/{id}/complete/`); `incompleteActivity(id: number): Promise<Activity>` (POST `/api/activities/{id}/incomplete/`)

**Checkpoint**: Migrations pass (`python manage.py migrate`), URL registered (`/api/activities/` reachable), factories ready, TS types and Zod schemas defined — story phases can begin

---

## Phase 3: User Story 1 — Log a New Activity (Priority: P1) 🎯 MVP

**Goal**: Authenticated user submits the create form with type + subject, optionally links to a CRM record via content_type + object_id, and is redirected to the new activity's detail page. Proves the ContentTypes generic relation and pair validation work end-to-end.

**Independent Test**: Log a new "Call" activity with subject "Discovery call," link to Lead #1 — confirm 201 response with `content_type="lead"`, `object_id=1`, `completed_at=null`. Log with subject blank — confirm 400 `{"subject": ["This field may not be blank."]}`. Log with `content_type="lead"` but no `object_id` — confirm 400 pair error.

### Implementation for User Story 1

- [ ] T014 Add `create` action to `ActivityViewSet` in `backend/apps/activities/views.py` (mix in `CreateModelMixin`; standard DRF `create()` flow; `ActivitySerializer.validate()` enforces pair constraint and no-existence-check soft reference; `created_by` set from `request.user` via `TimestampedModel`; returns 201 with full Activity serialization)
- [ ] T015 [P] [US1] Write create endpoint tests in `backend/apps/activities/tests/test_views.py`: valid `type`+`subject` only → 201, `completed_at=null`, `assigned_to=null`, `content_type=null`, `object_id=null`; with `content_type='lead'` + `object_id=1` → 201, `content_type='lead'`, `object_id=1`; blank `subject` → 400 `{'subject': ['This field may not be blank.']}`; missing `type` → 400; invalid `type='email'` → 400; `content_type='lead'` without `object_id` → 400 pair error; `object_id=1` without `content_type` → 400 pair error; invalid `content_type='invoice'` → 400; unauthenticated → 401; with `due_at`, `assigned_to_id`, `completed_at` → 201 with all fields populated; `object_id=999` (non-existent Lead) → **201** (no existence check — Phase 1 soft reference, Decision 1)
- [ ] T016 [P] [US1] Write serializer tests in `backend/apps/activities/tests/test_serializers.py`: `content_type='lead'` resolves to correct `ContentType` FK on write; response serializes `content_type` as string label `'lead'`, never as integer; `content_type=None` + `object_id=None` → valid; `content_type='lead'` + `object_id=None` → pair validation error; `object_id=1` + `content_type=None` → pair validation error; `object_id=999` with valid `content_type` → **no error** (soft reference); `ActivityType.TASK/CALL/MEETING` all accepted; `type='email'` → choice validation error
- [ ] T017 [P] [US1] Implement `useCreateActivity()` mutation hook in `frontend/src/features/activities/hooks/useCreateActivity.ts` (calls `createActivity(input)`; on success: invalidates `['activities']` query key and `['activities', {content_type, object_id}]` if the new activity has a generic relation; returns `{ mutateAsync, isPending, error }`)
- [ ] T018 [P] [US1] Implement `useActivity(id: number)` TanStack Query hook in `frontend/src/features/activities/hooks/useActivity.ts` (queryKey `['activity', id]`; fetches single activity via `fetchActivity(id)`; `staleTime: 30_000`)
- [ ] T019 [US1] Implement `ActivityForm` component in `frontend/src/features/activities/components/ActivityForm.tsx` (react-hook-form bound to `createActivitySchema` Zod; fields: type `<select>` with task/call/meeting options; subject `<input>` required; description `<textarea>` optional; due_at `<input type="datetime-local">` optional; assigned_to_id `<select>` optional; content_type `<select>` of entity type options optional; object_id `<input type="number">` optional — shown/required only when content_type is selected; `.superRefine()` pair check surfaces inline errors on both fields before submit; mode `'create' | 'edit'` prop for default values; shared by Phase 7 edit form)
- [ ] T020 [US1] Build create activity page in `frontend/src/app/(dashboard)/activities/new/page.tsx` (renders `ActivityForm` in create mode with `useCreateActivity`; on success redirects to `/activities/[id]`; "Cancel" button navigates to `/activities`)
- [ ] T021 [US1] Build activity detail page in `frontend/src/app/(dashboard)/activities/[id]/page.tsx` (fetches via `useActivity(id)`; displays all ERD fields: type (badge), subject, description, due_at, completion status (badge — "Completed" with timestamp when `completed_at` set, "Not completed" when null), assigned_to (name), linked record (`content_type` label + `object_id` — link to that entity's detail page if `content_type` is known), created_by, created_at, updated_at; "Edit" button to `/activities/[id]/edit`; placeholder "Delete" and "Mark Complete/Incomplete" buttons — wired in later phases; 404 redirect on not-found)

**Checkpoint**: US1 fully functional — create form submits, generic relation stored, pair validation surfaces errors, detail page renders all fields; `object_id=999` accepted without existence error (soft reference confirmed)

---

## Phase 4: User Story 2 — Browse the Activity List (Priority: P1)

**Goal**: Authenticated user sees a paginated, searchable (subject+description), filterable (type, assigned_to, content_type+object_id), sortable list; all query state is reflected in the URL and survives a new tab.

**Independent Test**: Navigate to `/activities` — confirm rows render. Enter "kickoff" in search — only matching activities appear. Apply type=call filter — narrows further. Copy URL — reproduces same view in new tab. Submit `?content_type=lead&object_id=1` — confirm only activities linked to Lead #1 appear, sorted due_at ASC NULLS LAST then created_at DESC.

### Implementation for User Story 2

- [ ] T022 Add `list` action to `ActivityViewSet` in `backend/apps/activities/views.py` (mix in `ListModelMixin`; DRF's `list()` uses the already-configured `filter_backends`, `filterset_class`, `search_fields`, `ordering_fields`, and `pagination_class` from the foundational base — no additional code needed for search or filtering; the `get_queryset()` feed sort conditional is already in place from T009)
- [ ] T023 [P] [US2] Write list endpoint tests in `backend/apps/activities/tests/test_views.py`: unauthenticated → 401; default list returns only `is_deleted=False` activities; response has `count`/`next`/`previous`/`results` pagination envelope; `?q=kickoff` matches `subject` icontains; `?q=kickoff` matches `description` icontains; `?type=task` returns only tasks; `?assigned_to=<id>` returns only assigned activities; `?content_type=lead&object_id=1` returns only activities for that Lead; `?content_type=lead&object_id=1` result is sorted `due_at ASC NULLS LAST` then `created_at DESC` (verify with 3 activities: one null due_at, two with due dates); `?content_type=lead` without `object_id` → 400; `?content_type=invoice&object_id=1` → 400; combined type+assigned_to → AND logic; `?ordering=-subject` orders descending by subject; default ordering is `-created_at`; `page_size=200` → 400; `page=abc` → 400
- [ ] T024 [P] [US2] Implement `useActivities(params: ActivitiesQueryParams)` TanStack Query hook in `frontend/src/features/activities/hooks/useActivities.ts` (queryKey `['activities', params]`; calls `fetchActivities(params)`; `staleTime: 30_000`); also implement `useActivitiesSearchParams` hook in the same file — reads/writes `q`, `type`, `assigned_to`, `ordering`, `page`, `page_size` via `useSearchParams` + `router.replace` without page reload (FR-024; `content_type`+`object_id` not exposed here — those are feed-widget params used by `useActivityFeed`)
- [ ] T025 [P] [US2] Build `ActivityFilters` component in `frontend/src/features/activities/components/ActivityFilters.tsx` (search input wired to `useActivitiesSearchParams`; type `<select>` with task/call/meeting options + "All Types" default; assigned_to input; all changes update URL via `useActivitiesSearchParams`; "Clear Filters" resets all params)
- [ ] T026 [P] [US2] Build `ActivityTable` component in `frontend/src/features/activities/components/ActivityTable.tsx` (TanStack Table v8; columns: Type (badge chip — task/call/meeting), Subject (link to `/activities/[id]`), Due Date, Completed (tick or blank), Assigned To (`assigned_to.full_name`), Linked Record (`content_type` label + entity name or `object_id`); sortable column headers via `useActivitiesSearchParams`; empty-state message when `count === 0`)
- [ ] T027 [US2] Build activities list page in `frontend/src/app/(dashboard)/activities/page.tsx` (composing `ActivityFilters`, `ActivityTable`, pagination controls — prev/next page buttons + page indicator — and "Log Activity" button linking to `/activities/new`; all state from `useActivitiesSearchParams`; loading skeleton while `isLoading`)

**Checkpoint**: US2 fully functional — authenticated user can search, filter, sort, and paginate; URL is bookmarkable; feed sort confirmed for `?content_type+object_id` queries

---

## Phase 5: User Story 3 — View Activity Details (Priority: P1)

**Goal**: User clicks an activity row and sees a detail page with all ERD-specified fields. Type badge, completion badge, linked record with entity label and clickable link, and timestamps are all visible. Soft-deleted activity returns 404.

**Independent Test**: Click any activity row — confirm detail page shows type badge, subject, description, due_at, `completed_at` with "Completed"/"Not completed" badge, assigned_to, linked record ("Lead: #5" → link to `/leads/5`), created_by, created_at, updated_at. Navigate to a soft-deleted activity URL — confirm 404.

### Implementation for User Story 3

- [ ] T028 Add `retrieve` action to `ActivityViewSet` in `backend/apps/activities/views.py` (mix in `RetrieveModelMixin`; `get_object()` uses the `is_deleted=False` queryset from `get_queryset()` — soft-deleted activities return 404 automatically via `get_object_or_404`)
- [ ] T029 [P] [US3] Write retrieve endpoint tests in `backend/apps/activities/tests/test_views.py`: exists → 200 with all fields; `content_type` returned as string label not integer; `assigned_to` nested object with id/full_name/email; `completed_at` null on incomplete activity; `completed_at` set on complete activity; soft-deleted activity → 404; non-existent id → 404; unauthenticated → 401
- [ ] T030 [US3] Expand activity detail page in `frontend/src/app/(dashboard)/activities/[id]/page.tsx` — replace placeholder rendering with: type badge component (colour-coded chip per type); completion badge ("Completed" green badge with formatted `completed_at` timestamp, or "Not Completed" grey badge); linked record section — when `content_type` is set: show label and `object_id` with a link to the entity detail route (`/leads/[id]`, `/contacts/[id]`, `/companies/[id]`, `/deals/[id]`) constructed from `content_type` label; when null: "No linked record"; created_by and timestamps section at page footer; keep "Edit", "Delete", "Mark Complete/Incomplete" buttons in place (wired in subsequent phases)

**Checkpoint**: US3 fully functional — detail page renders all fields; type and completion badges display correctly; linked record routes navigate to the correct entity; soft-deleted URL returns 404

---

## Phase 6: User Story 4 — Mark an Activity as Complete (Priority: P2)

**Goal**: User clicks "Mark as Complete" on an activity — `completed_at` is set to the current server timestamp and the completion badge updates immediately. "Unmark" clears it. Both actions work inline from the detail page without a full page reload.

**Independent Test**: Open an incomplete activity detail page, click "Mark as Complete" — confirm `completed_at` is set to a recent timestamp (server-side) and "Completed" badge renders. Click "Unmark" — confirm `completed_at` clears and badge reverts. No full page reload occurs in either direction.

### Implementation for User Story 4

- [ ] T031 Add `complete` and `incomplete` `@action` endpoints to `ActivityViewSet` in `backend/apps/activities/views.py`:
  - `@action(detail=True, methods=['post'], url_path='complete')` — `activity.completed_at = timezone.now()`; `activity.save(update_fields=['completed_at','updated_at'])`; return 200 with serialized activity (server timestamp — no client input required)
  - `@action(detail=True, methods=['post'], url_path='incomplete')` — `activity.completed_at = None`; `activity.save(update_fields=['completed_at','updated_at'])`; return 200 with serialized activity; idempotent (already-incomplete activity still returns 200)
  - Imports: `from django.utils import timezone`; `from rest_framework.decorators import action`; `from rest_framework.response import Response`
- [ ] T032 [P] [US4] Write complete/incomplete endpoint tests in `backend/apps/activities/tests/test_views.py`: POST `/complete/` on incomplete activity → 200, `completed_at` is set, timestamp is recent ISO 8601; POST `/complete/` on already-complete activity → 200, `completed_at` updated to new timestamp (idempotent re-stamp); POST `/incomplete/` on complete activity → 200, `completed_at=null`; POST `/incomplete/` on already-incomplete activity → 200, `completed_at=null` (idempotent); POST `/complete/` on soft-deleted activity → 404; unauthenticated → 401
- [ ] T033 [P] [US4] Implement `useCompleteActivity()` mutation hook in `frontend/src/features/activities/hooks/useCompleteActivity.ts` (calls `completeActivity(id)`; on success: invalidates `['activity', id]`, `['activities']`, and `['activities', {content_type, object_id}]` (feed) query keys so all views refresh — SC-004); also implement `useIncompleteActivity()` in the same file (calls `incompleteActivity(id)`; same invalidation logic)
- [ ] T034 [P] [US4] Build `CompleteButton` component in `frontend/src/features/activities/components/CompleteButton.tsx` (accepts `activity: Activity`; when `completed_at=null`: renders "Mark as Complete" button calling `useCompleteActivity`; when `completed_at` set: renders "Unmark" button calling `useIncompleteActivity`; shows loading spinner during mutation; `disabled` during `isPending`)
- [ ] T035 [US4] Wire `CompleteButton` into the activity detail page in `frontend/src/app/(dashboard)/activities/[id]/page.tsx` — replace "Mark Complete/Incomplete" placeholder button with `<CompleteButton activity={activity} />`; confirm badge and button state update immediately after mutation without page reload (TanStack Query cache update via invalidation — SC-004)

**Checkpoint**: US4 fully functional — complete/incomplete toggle works end-to-end; completion badge and button state update inline; feed query key is invalidated so ActivityFeed widget (Phase 8) will also refresh

---

## Phase 7: User Story 5 — Edit an Activity (Priority: P2)

**Goal**: User edits any field (type, subject, description, due_at, assigned_to, or generic relation), saves — detail view reflects changes immediately with `updated_at` advanced. Clearing linked record is supported.

**Independent Test**: Open a task activity, click "Edit," change type to "Meeting," update subject, re-assign to a different user, change linked record to a Company — save. Confirm detail view shows all three changes and `updated_at` has advanced.

### Implementation for User Story 5

- [ ] T036 Add `update` and `partial_update` actions to `ActivityViewSet` in `backend/apps/activities/views.py` (mix in `UpdateModelMixin`; standard DRF `update()`/`partial_update()`; `ActivitySerializer.validate()` enforces pair constraint on PATCH — if only one of `content_type`/`object_id` sent, raise error; `updated_at` advanced via `TimestampedModel` `auto_now`; `updated_by` set from `request.user` via `TimestampedModel` if applicable)
- [ ] T037 [P] [US5] Write update/partial_update tests in `backend/apps/activities/tests/test_views.py`: valid PUT → 200 with all updated fields, `updated_at` advanced; PATCH subject only → 200, other fields unchanged; PATCH clear linked record (both null) → 200, `content_type=null`, `object_id=null`; PATCH `content_type='deal'` + `object_id=3` → 200, relation updated; PATCH `content_type='contact'` without `object_id` → 400 pair error; PATCH `object_id=5` without `content_type` → 400 pair error; blank subject via PATCH → 400; PUT to soft-deleted activity → 404; unauthenticated → 401
- [ ] T038 [P] [US5] Implement `useUpdateActivity()` mutation hook in `frontend/src/features/activities/hooks/useUpdateActivity.ts` (calls `updateActivity(id, input)` — PATCH; on success: invalidates `['activity', id]`, `['activities']`, and any feed query key matching the activity's `content_type`+`object_id`)
- [ ] T039 [US5] Build edit activity page in `frontend/src/app/(dashboard)/activities/[id]/edit/page.tsx` (loads activity via `useActivity(id)`; renders `ActivityForm` in edit mode pre-populated with current values; uses `useUpdateActivity`; on success redirects to `/activities/[id]`; "Cancel" navigates back to `/activities/[id]` without saving)

**Checkpoint**: US5 fully functional — PATCH with partial fields preserves unspecified values; clearing linked record works; edit page pre-populates correctly; saving redirects to detail with updated values

---

## Phase 8: User Story 6 — View Activities for a CRM Record (Priority: P2)

**Goal**: Lead, Contact, Company, and Deal detail pages all show an "Activity Feed" widget listing activities for that record — sorted by due_at ASC NULLS LAST then created_at DESC. Feed supports inline complete/incomplete toggle. Shows empty-state when no activities.

**Independent Test**: Open Lead #1 detail page — confirm ActivityFeed widget appears. Log a task linked to Lead #1 — navigate back, confirm task appears in feed sorted by due date. Click "Mark Complete" in feed — activity updates inline without page reload. Open Lead with no activities — confirm "No activities yet" empty state.

### Implementation for User Story 6

- [ ] T040 [P] [US6] Implement `useActivityFeed(contentType, objectId)` hook in `frontend/src/features/activities/hooks/useActivityFeed.ts` — wraps `useActivities` with pre-fixed `params = { content_type: contentType, object_id: objectId, page_size: 50 }`; queryKey `['activities', { content_type: contentType, object_id: objectId }]`; `staleTime: 30_000`; this is the key that `useCompleteActivity`/`useIncompleteActivity` invalidate on mutation (SC-004)
- [ ] T041 [P] [US6] Build `ActivityFeed` component in `frontend/src/features/activities/components/ActivityFeed.tsx`:
  - Props: `contentType: ContentTypeLabel`, `objectId: number`
  - Uses `useActivityFeed({ contentType, objectId })`
  - Renders activity rows: type chip, subject, due_at (formatted), completion badge + inline `<CompleteButton>`
  - Empty-state: "No activities yet" message when `count === 0` (FR-031)
  - Loading skeleton while `isLoading`
  - "Log Activity" button that links to `/activities/new?content_type=<label>&object_id=<id>` (pre-fills the create form's linked record fields via URL search params)
- [ ] T042 [P] [US6] Write feed sort order test in `backend/apps/activities/tests/test_views.py` confirming Decision 2: create 3 activities for the same Lead — Activity A: `due_at=null`; Activity B: `due_at=2026-07-01`; Activity C: `due_at=2026-06-20`; GET `?content_type=lead&object_id=<id>` — assert order is C (earliest due), B (later due), A (null, last); create two null-due activities and assert secondary sort is `created_at DESC` (most recently created null-due activity first)
- [ ] T043 [US6] Integrate `ActivityFeed` widget into the Lead detail page in `frontend/src/app/(dashboard)/leads/[id]/page.tsx` — add `<ActivityFeed contentType="lead" objectId={lead.id} />` section at the bottom of the Lead detail page; imports from `features/activities/components/ActivityFeed`
- [ ] T044 [P] [US6] Integrate `ActivityFeed` widget into the Contact detail page in `frontend/src/app/(dashboard)/contacts/[id]/page.tsx` — add `<ActivityFeed contentType="contact" objectId={contact.id} />` section
- [ ] T045 [P] [US6] Integrate `ActivityFeed` widget into the Company detail page in `frontend/src/app/(dashboard)/companies/[id]/page.tsx` — add `<ActivityFeed contentType="company" objectId={company.id} />` section
- [ ] T046 [P] [US6] Integrate `ActivityFeed` widget into the Deal detail page in `frontend/src/app/(dashboard)/deals/[id]/page.tsx` — add `<ActivityFeed contentType="deal" objectId={deal.id} />` section

**Checkpoint**: US6 fully functional — ActivityFeed widget renders correctly on all four entity detail pages; feed sort is due_at ASC NULLS LAST; inline complete toggle updates feed immediately; empty-state shows when no activities

---

## Phase 9: User Story 7 — Soft Delete an Activity (Priority: P3)

**Goal**: User deletes an activity — it disappears from all default views (global list and all entity feeds) immediately. The database row is preserved with `is_deleted=True`. The activity URL returns 404. Activity-linked entity records (Leads, Contacts, etc.) are unaffected.

**Independent Test**: Delete an activity from its detail page — confirm redirect to list and activity absent. Navigate to `/activities/[id]` — confirm 404. Check DB row has `is_deleted=True`. Navigate to the linked Lead detail page — confirm the deleted activity does not appear in the feed.

### Implementation for User Story 7

- [ ] T047 Override `ActivityViewSet.destroy()` in `backend/apps/activities/views.py` — `activity = self.get_object()`; `activity.is_deleted = True`; `activity.save(update_fields=['is_deleted','updated_at'])`; return `Response(status=HTTP_204_NO_CONTENT)` — do NOT call `super().destroy()` (that would hard-delete the row)
- [ ] T048 [P] [US7] Write destroy tests in `backend/apps/activities/tests/test_views.py`: DELETE → 204; subsequent GET `/api/activities/{id}/` → 404; DB row has `is_deleted=True` and all other fields intact; GET `/api/activities/` list excludes soft-deleted activity; `?content_type=lead&object_id=<id>` feed excludes soft-deleted activity; unauthenticated DELETE → 401; DELETE on already-deleted activity → 404
- [ ] T049 [P] [US7] Implement `useDeleteActivity()` mutation hook in `frontend/src/features/activities/hooks/useDeleteActivity.ts` (calls `deleteActivity(id)`; on success: invalidates `['activities']` and any matching feed query keys; removes `['activity', id]` from query cache via `queryClient.removeQueries`)
- [ ] T050 [P] [US7] Build `DeleteActivityButton` component in `frontend/src/features/activities/components/DeleteActivityButton.tsx` (confirmation dialog before delete — "Are you sure you want to delete this activity?"; calls `useDeleteActivity`; `disabled` during `isPending`; on success navigates to `/activities`)
- [ ] T051 [US7] Wire `DeleteActivityButton` into the activity detail page in `frontend/src/app/(dashboard)/activities/[id]/page.tsx` — replace "Delete" placeholder with `<DeleteActivityButton activityId={id} />`; confirm redirect to `/activities` after successful delete; confirm the deleted activity no longer appears in any entity's ActivityFeed (cache invalidation)

**Checkpoint**: US7 fully functional — soft delete works end-to-end; deleted activity returns 404 from API; global list and entity feeds exclude it; DB row preserved with `is_deleted=True`

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Model-level tests, admin registration, OpenAPI annotations, nav wiring, ERD update, and final quickstart validation.

- [ ] T052 [P] Write model tests in `backend/apps/activities/tests/test_models.py`: `Activity.is_deleted` defaults to `False`; `Activity.description` defaults to `''`; `Activity.ordering` is `['-created_at']`; `Activity.db_table` is `'activities_activity'`; `ActivityType` choices are exactly `task`, `call`, `meeting`; `assigned_to` SET_NULL when User deleted (activity row survives); `content_type` SET_NULL when ContentType deleted (activity row survives); composite index on `(content_type_id, object_id)` is present in `Activity._meta.indexes`
- [ ] T053 [P] Write filter/resolution tests in `backend/apps/activities/tests/test_filters.py`: `resolve_content_type_from_label('lead')` returns correct `ContentType`; `resolve_content_type_from_label('contact')` returns correct `ContentType`; `resolve_content_type_from_label('company')` returns correct `ContentType`; `resolve_content_type_from_label('deal')` returns correct `ContentType`; `resolve_content_type_from_label('invoice')` returns `None`; `resolve_content_type_from_label('Lead')` (uppercase) resolves correctly (`.lower()` normalisation); `filter_queryset` with `content_type='lead'` + valid `object_id` narrows queryset; `filter_queryset` with only `content_type` raises `ValidationError`; `filter_queryset` with only `object_id` raises `ValidationError`; `filter_queryset` with `content_type='unknown'` raises `ValidationError` with allowed list
- [ ] T054 [P] Register `Activity` in `backend/apps/activities/admin.py` with `list_display = ('subject', 'type', 'assigned_to', 'due_at', 'completed_at', 'is_deleted', 'created_at')` and `list_filter = ('is_deleted', 'type')`; `search_fields = ('subject', 'description')`
- [ ] T055 [P] Add drf-spectacular `@extend_schema` annotations to `ActivityViewSet` in `backend/apps/activities/views.py`: list/create/retrieve/update/partial_update annotated with request/response schemas and 400/401/404 codes; `destroy` annotated as soft-delete (note: row preserved, `is_deleted=True`); `complete`/`incomplete` annotated (no request body, returns full `Activity` schema)
- [ ] T056 [P] Add `activities` nav link to the sidebar component in `frontend/src/app/(dashboard)/` layout so the Activities section is accessible from all dashboard pages; follows the same pattern as the existing leads/contacts/companies/deals nav links
- [ ] T057 [P] Regenerate OpenAPI schema (`python manage.py spectacular --file docs/openapi.yaml`) and verify `/api/activities/`, `/api/activities/{id}/`, `/api/activities/{id}/complete/`, and `/api/activities/{id}/incomplete/` endpoints are present with correct schemas, query parameters (`q`, `type`, `assigned_to`, `content_type`, `object_id`, `ordering`, `page`, `page_size`), and response shapes
- [ ] T058 [P] Update `docs/erd.md` to reflect `activities_activity` table as implemented — add FK arrows (assigned_to → users, created_by → users, content_type → django_content_type); note `is_deleted` soft-delete pattern; note `content_object` is a virtual accessor (no DB column); note composite index on `(content_type_id, object_id)`; note `ActivityType` is a string enum stored in `type` column, not a lookup table
- [ ] T059 Run all 13 backend validation scenarios from `agent-os/specs/activities/quickstart.md` against the running dev server and confirm all pass; run all 7 frontend validation flows; tick off the Definition of Done checklist in quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — **blocks all user story phases**
- **US1, US2, US3 (Phases 3–5)**: All depend on Phase 2; all three are P1 — proceed in priority order (US1 → US2 → US3) or in parallel if staffed
- **US4, US5, US6 (Phases 6–8)**: All depend on Phase 2; US4/US5 also need US3 detail page for frontend wiring; US6 activity feed integration needs entity detail pages to exist (those were built in earlier modules)
- **US7 (Phase 9)**: Depends on Phase 2; `DeleteActivityButton` integration needs US3 detail page
- **Polish (Phase 10)**: Can start once all desired user stories are complete; all tasks within Phase 10 are independent

### User Story Dependencies

| Story | Depends on | Notes |
|---|---|---|
| US1 (Log Activity) | Phase 2 | Independent — entry point; proves generic relation and pair validation |
| US2 (Browse List) | Phase 2 | Independent — needs list URL to be wired (T010) |
| US3 (View Detail) | Phase 2 | Frontend detail page improvements build on US1's basic detail page |
| US4 (Complete/Incomplete) | US3 | `CompleteButton` is wired into the detail page from US3 |
| US5 (Edit) | US3 | Edit page is sibling route to detail; `ActivityForm` is shared from US1 |
| US6 (Feed Widget) | US1, US2, US4 | `ActivityFeed` uses `useActivityFeed`; `CompleteButton` used inline; entity detail pages must exist |
| US7 (Soft Delete) | US3 | `DeleteActivityButton` lives on the detail page from US3 |

### Within Each User Story

- Backend: model → serializer → filter → viewset action → tests
- Frontend: TypeScript types → Zod schema → API client → hooks → components → page
- Backend and frontend tasks marked `[P]` within a story can run in parallel once the dependent viewset action task is complete

---

## Parallel Opportunities

### Phase 2 (after T003–T004 complete sequentially)

```
T005 (factories)      ──┐
T006 (filters.py)     ──┤ T005, T006, T008, T011, T012, T013 fully parallel (different files)
T007 (serializers)    ──┤ T007 depends on T006 (resolve_content_type_from_label import)
T008 (pagination)     ──┤
T011 (TS types)       ──┤
T012 (Zod schemas)    ──┤
T013 (API client)     ──┘
```

### Phase 3 (US1 — after T014 complete)

```
T015 (create tests)       ──┐
T016 (serializer tests)   ──┤ parallel (different test files)
T017 (useCreateActivity)  ──┤
T018 (useActivity)        ──┤ all parallel (different files)
T019 (ActivityForm)       ──┘
```

### Phase 4 (US2 — after T022 complete)

```
T023 (list tests)      ──┐
T024 (hooks)           ──┤
T025 (ActivityFilters) ──┤ parallel (different files)
T026 (ActivityTable)   ──┘
```

### Phase 6 (US4 — after T031 complete)

```
T032 (complete tests)    ──┐
T033 (hooks)             ──┤ parallel
T034 (CompleteButton)    ──┘
```

### Phase 8 (US6 — after T040–T042 complete)

```
T043 (Lead feed)    ──┐
T044 (Contact feed) ──┤ parallel (different entity pages)
T045 (Company feed) ──┤
T046 (Deal feed)    ──┘
```

### Phase 10 (all independent)

```
T052  T053  T054  T055  T056  T057  T058  T059  ← all in parallel
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US3 — all P1)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (model, migration, serializer with label round-trip, filter with label resolution, pagination, ViewSet base, URL wiring, TS types, Zod, API client)
3. Complete Phase 3: US1 — create form with generic relation working end-to-end
4. Complete Phase 4: US2 — list view with search, filter, feed sort
5. Complete Phase 5: US3 — full detail view
6. **STOP and VALIDATE**: All P1 stories independently functional; content_type label round-trip confirmed; feed sort confirmed; pair validation confirmed
7. Deploy/demo MVP

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → test create end-to-end → deploy (users can log activities)
3. US2 → test list + feed filter → deploy (users can browse activities)
4. US3 → test detail view → deploy (users can view all fields)
5. US4 → test complete/incomplete → deploy (users can track completions)
6. US5 → test edit form → deploy (users can update activities)
7. US6 → test feed widget on all entity pages → deploy (contextual activity feed live)
8. US7 → test soft delete → deploy (users can remove activities)
9. Polish → final QA + OpenAPI regen + ERD update

### Parallel Team Strategy

With multiple developers (after Phase 2 complete):

1. Developer A: US1 (create form — generic relation focus)
2. Developer B: US2 (list page — filter/search/URL state focus)
3. After US1+US2: Developer A continues US3+US4; Developer B continues US5+US6

---

## Notes

- `[P]` tasks target different files with no blocking dependencies — safe to run simultaneously
- `[US#]` label maps each task to its user story for traceability and MVP scoping
- **Decision 1 (object_id soft reference)**: `object_id=999` (non-existent lead) MUST succeed — see T015 test case. Do not add existence checks in Phase 1.
- **Decision 2 (feed sort)**: `F('due_at').asc(nulls_last=True), '-created_at'` is applied conditionally in `get_queryset()` only when both `?content_type` and `?object_id` are present. The global list retains `-created_at` default and respects `?ordering=`. T042 specifically validates this sort order.
- **Decision 3 (label resolution)**: `resolve_content_type_from_label()` uses `django_apps.get_model()` (lazy, no import-time coupling). Direct imports from `apps.leads`, `apps.contacts`, `apps.companies`, or `apps.deals` are forbidden in `backend/apps/activities/` — they create circular imports.
- `content_type` label round-trip: input `"lead"` → stored as ContentType FK → serialized back as `"lead"`. The raw ContentType integer ID is never exposed in the API.
- `ActivityFeed` widget calls the standard list endpoint with `?content_type+object_id` — no dedicated feed endpoint is added (Assumption 11 in spec).
- `useCompleteActivity` and `useIncompleteActivity` invalidate the `['activities', {content_type, object_id}]` query key — this ensures `ActivityFeed` widgets refresh inline on all entity detail pages (SC-004).
- Migration independence (FR-033): `activities/0001_initial` depends only on `('core', '0001_initial')` and `('contenttypes', '0001_initial')` — NOT on leads/contacts/companies/deals migrations. Verify with T004.
- `select_related('assigned_to', 'content_type', 'created_by')` on all queryset operations prevents N+1 — `content_type` is a FK to `django_content_type` (~30 rows, one per registered model). Verify no raw `Activity.objects.all()` calls bypass `get_queryset()`.
- Soft-delete queryset filter (`is_deleted=False`) is set at the ViewSet level in `get_queryset()`; never bypass it with `Activity.objects.all()` in list/retrieve/update/destroy actions.
