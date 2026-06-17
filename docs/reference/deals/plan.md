# Implementation Plan: Deals (Opportunities) Module

**Branch**: `feat/deals-module` | **Date**: 2026-06-15 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `agent-os/specs/deals/spec.md`

---

## Summary

Build the Deals module — the fourth CRM entity and the next step in the dependency chain (core ← accounts ← companies ← contacts ← leads ← deals). Provides Pipeline and Stage models (seeded per ADR-007), a full Deal CRUD API via adrf/DRF, and a Next.js 16 / TanStack Query frontend with list, detail, create, and edit pages.

The backend reuses `TimestampedModel` + `SoftDeleteMixin` base classes, JWT Bearer auth, `django-filter`, and the shared `PageNumberPagination` subclass. Seed data (one pipeline, six stages) is delivered via a **data migration** that is idempotent (uses `get_or_create`). Won/Lost status is determined exclusively by `stage.is_won` / `stage.is_lost` flags — no hardcoded name checks anywhere. The deals app has **no import-time or runtime dependency on the leads app**; it is installable and migratable independently, unblocking `leads/0003_add_converted_deal_fk`.

---

## Technical Context

**Language/Version**: Python 3.12 (backend) · TypeScript 5 (frontend)

**Primary Dependencies**:
- Backend: Django 5.2, adrf (async DRF), drf-spectacular, django-filter, simplejwt
- Frontend: Next.js 16, React 19, TanStack Query v5, TanStack Table v8, React Hook Form 7, Zod 4, Tailwind CSS v4

**Storage**: MySQL 8.0 (utf8mb4) via `DATABASE_URL` / django-environ

**Testing**: pytest + pytest-django + factory_boy (backend) · Vitest + React Testing Library (frontend unit) · Playwright (frontend e2e)

**Target Platform**: Web application — Django REST API + Next.js frontend, deployed separately

**Project Type**: Web application (fullstack, separate backend/frontend)

**Performance Goals**: Deal search results within 2 s on standard broadband (SC-001); list updates without full page reload (SC-002); `select_related('company_fk')` on all queryset operations to avoid N+1 (best-practices.md)

**Constraints**:
- Pagination max `page_size` = 100
- JWT Bearer auth on every endpoint; unauthenticated → 401 (FR-030)
- Soft delete only — no hard deletes (FR-028)
- `pipeline` and `stage` FKs use `PROTECT` — cannot be deleted while deals reference them (FR-020, FR-021)
- `company_fk`, `primary_contact_fk`, `owner_fk` use `SET_NULL` (FR-017, FR-018, FR-019)
- Deals app MUST be installable and migratable without the leads app present (FR-031, FR-032)
- Won/Lost determined solely by `stage.is_won` / `stage.is_lost` flags (ADR-007, FR-004)

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
agent-os/specs/deals/
├── plan.md            ← this file
├── spec.md            ← feature specification
├── research.md        ← Phase 0 decisions
├── data-model.md      ← Phase 1 entity design
├── quickstart.md      ← Phase 1 validation guide
├── checklists/
│   └── requirements.md
└── contracts/
    └── openapi-deals.yaml
```

### Source Code

```text
backend/
├── apps/
│   └── deals/
│       ├── __init__.py
│       ├── apps.py
│       ├── admin.py
│       ├── models.py          ← Pipeline, Stage, Deal models
│       ├── serializers.py     ← PipelineSerializer, StageSerializer, DealSerializer
│       ├── filters.py         ← DealFilter (stage, pipeline, owner, company) + Q search
│       ├── pagination.py      ← reuse or re-export shared PageNumberPagination
│       ├── views.py           ← PipelineViewSet, StageViewSet, DealViewSet
│       ├── urls.py            ← router registration
│       ├── migrations/
│       │   ├── 0001_initial.py            ← Pipeline, Stage, Deal schema
│       │   └── 0002_seed_pipeline.py      ← data migration: Sales Pipeline + 6 stages
│       └── tests/
│           ├── __init__.py
│           ├── factories.py
│           ├── test_models.py
│           ├── test_serializers.py     ← probability auto-set, stage/pipeline mismatch
│           ├── test_views.py           ← CRUD, filter, search, auth, soft delete
│           └── test_seed.py            ← seed migration idempotency
└── crm/
    ├── settings.py    ← add 'apps.deals' to INSTALLED_APPS
    └── urls.py        ← add path("api/", include("apps.deals.urls"))

frontend/src/
├── app/
│   └── (dashboard)/
│       └── deals/
│           ├── page.tsx          ← list view (search, filter, sort, pagination)
│           ├── new/
│           │   └── page.tsx      ← create form
│           └── [id]/
│               ├── page.tsx      ← detail view (won/lost badge from stage flags)
│               └── edit/
│                   └── page.tsx  ← edit form (probability auto-updates on stage change)
└── features/
    └── deals/
        ├── api.ts
        ├── types.ts
        ├── schemas/
        │   └── deal.ts           ← Zod schema (name required; probability 0–100; amount ≥ 0)
        ├── components/
        │   ├── DealTable.tsx
        │   ├── DealFilters.tsx
        │   ├── DealForm.tsx      ← stage change triggers probability auto-update
        │   └── DeleteDealButton.tsx
        └── hooks/
            ├── useDeals.ts
            ├── useDeal.ts
            ├── useCreateDeal.ts
            ├── useUpdateDeal.ts
            └── useDeleteDeal.ts
```

---

## Design Decisions

### Pipeline and Stage Models

```python
class Pipeline(models.Model):
    name       = models.CharField(max_length=200)
    is_default = models.BooleanField(default=False)

    class Meta:
        db_table = 'deals_pipeline'

class Stage(models.Model):
    pipeline    = models.ForeignKey(Pipeline, on_delete=models.CASCADE, related_name='stages')
    name        = models.CharField(max_length=200)
    order_index = models.PositiveSmallIntegerField()
    probability = models.PositiveSmallIntegerField()  # 0–100
    is_won      = models.BooleanField(default=False)
    is_lost     = models.BooleanField(default=False)

    class Meta:
        db_table      = 'deals_stage'
        unique_together = [('pipeline', 'order_index')]
        ordering      = ['order_index']
```

`Pipeline` and `Stage` do **not** inherit `TimestampedModel` — they are configuration/reference data, not business entities with audit needs. Adding `TimestampedModel` would require a `created_by` FK to User, complicating the seed migration which runs before any user exists.

### Deal Model

```python
class Deal(TimestampedModel):
    name               = models.CharField(max_length=500)
    amount             = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    currency           = models.CharField(max_length=3, default='USD')
    close_date         = models.DateField(null=True, blank=True)
    pipeline           = models.ForeignKey(
                           'deals.Pipeline', null=True, blank=True,
                           on_delete=models.PROTECT, related_name='deals')
    stage              = models.ForeignKey(
                           'deals.Stage', null=True, blank=True,
                           on_delete=models.PROTECT, related_name='deals')
    company_fk         = models.ForeignKey(
                           'companies.Company', null=True, blank=True,
                           on_delete=models.SET_NULL, related_name='deals')
    primary_contact_fk = models.ForeignKey(
                           'contacts.Contact', null=True, blank=True,
                           on_delete=models.SET_NULL, related_name='deals')
    owner_fk           = models.ForeignKey(
                           settings.AUTH_USER_MODEL, null=True, blank=True,
                           on_delete=models.SET_NULL, related_name='owned_deals')
    probability        = models.PositiveSmallIntegerField(null=True, blank=True)
    is_deleted         = models.BooleanField(default=False, db_index=True)

    class Meta:
        db_table = 'deals_deal'
        ordering = ['-created_at']
```

`currency` is `CharField(max_length=3, default='USD')` — not null, no currency conversion in Phase 1.

`pipeline` and `stage` are nullable at the DB level (optional fields, FR-009) but use `PROTECT` on delete (FR-020, FR-021).

### Seed Data Migration (ADR-007)

```python
# deals/migrations/0002_seed_pipeline.py

STAGES = [
    dict(name='Qualification',  order_index=1, probability=10,  is_won=False, is_lost=False),
    dict(name='Needs Analysis', order_index=2, probability=25,  is_won=False, is_lost=False),
    dict(name='Proposal',       order_index=3, probability=50,  is_won=False, is_lost=False),
    dict(name='Negotiation',    order_index=4, probability=75,  is_won=False, is_lost=False),
    dict(name='Closed Won',     order_index=5, probability=100, is_won=True,  is_lost=False),
    dict(name='Closed Lost',    order_index=6, probability=0,   is_won=False, is_lost=True),
]

def seed_pipeline(apps, schema_editor):
    Pipeline = apps.get_model('deals', 'Pipeline')
    Stage    = apps.get_model('deals', 'Stage')
    pipeline, _ = Pipeline.objects.get_or_create(
        name='Sales Pipeline',
        defaults={'is_default': True},
    )
    for s in STAGES:
        Stage.objects.get_or_create(
            pipeline=pipeline,
            name=s['name'],
            defaults={k: v for k, v in s.items() if k != 'name'},
        )

def unseed_pipeline(apps, schema_editor):
    Pipeline = apps.get_model('deals', 'Pipeline')
    Pipeline.objects.filter(name='Sales Pipeline').delete()

class Migration(migrations.Migration):
    dependencies = [('deals', '0001_initial')]
    operations   = [migrations.RunPython(seed_pipeline, unseed_pipeline)]
```

`get_or_create` makes the migration **idempotent** — safe to re-run in test teardown/restore scenarios (SC-010). Deleting the pipeline cascades to its stages.

### Won/Lost Flag Enforcement (FR-004, ADR-007)

**No hardcoded name comparisons anywhere in the codebase.** Won/Lost state is surfaced exclusively via computed serializer fields:

```python
is_won  = serializers.SerializerMethodField()
is_lost = serializers.SerializerMethodField()

def get_is_won(self, obj):
    return obj.stage.is_won if obj.stage_id else False

def get_is_lost(self, obj):
    return obj.stage.is_lost if obj.stage_id else False
```

The frontend reads `deal.is_won` and `deal.is_lost` from the API response to render badges. The TypeScript type includes `is_won: boolean` and `is_lost: boolean`; no stage-name comparison is written in frontend code either.

### Search — FR-024 (User-Specified Implementation)

```python
if q := request.query_params.get('q', '').strip():
    queryset = queryset.filter(
        Q(name__icontains=q) | Q(company_fk__name__icontains=q)
    )
```

`select_related('company_fk')` is on the base queryset (see below), so the `company_fk__name` JOIN is already established — no extra query per row.

### Base Queryset with `select_related` (N+1 Prevention)

```python
def get_queryset(self):
    return Deal.objects.filter(is_deleted=False).select_related(
        'pipeline', 'stage', 'company_fk', 'primary_contact_fk', 'owner_fk'
    )
```

`select_related` covers all FK fields rendered in list responses (pipeline name, stage name, company name, contact name, owner name) and the `company_fk__name` JOIN used by the search filter. Satisfies best-practices.md performance requirement.

### Filtering (`?stage=`, `?pipeline=`, `?owner=`, `?company=`)

```python
class DealFilter(FilterSet):
    stage    = NumberFilter(field_name='stage_id')
    pipeline = NumberFilter(field_name='pipeline_id')
    owner    = NumberFilter(field_name='owner_fk_id')
    company  = NumberFilter(field_name='company_fk_id')

    class Meta:
        model  = Deal
        fields = ['stage', 'pipeline', 'owner', 'company']
```

All four filters match by PK. They combine with AND logic (default `FilterSet` behaviour) and chain with the `?q=` search on the same queryset (FR-025).

### Ordering

`ordering = ['-created_at']` on `Deal.Meta`. Explicit allowlist on `DealViewSet`:

```python
ordering_fields = ['name', 'amount', 'close_date', 'probability', 'created_at', 'owner_fk']
```

Using an explicit list rather than `'__all__'` prevents clients from ordering by internal fields.

### Probability Auto-Set (FR-010, FR-011)

Resolved in `DealSerializer.validate()` (object-level validation):

```python
def validate(self, attrs):
    stage    = attrs.get('stage') or (self.instance and self.instance.stage)
    pipeline = attrs.get('pipeline') or (self.instance and self.instance.pipeline)

    # Stage/pipeline mismatch check (FR-014)
    if attrs.get('stage') and pipeline and attrs['stage'].pipeline_id != pipeline.id:
        raise serializers.ValidationError(
            {'stage': 'Stage does not belong to the selected pipeline.'}
        )

    # Probability auto-set (FR-010) — only when stage is explicitly provided
    # and no explicit probability was sent in the same request (FR-011)
    if 'stage' in attrs and attrs['stage'] is not None:
        if 'probability' not in self.initial_data:
            attrs['probability'] = attrs['stage'].probability

    return attrs
```

If the caller provides both `stage` and `probability`, the user-supplied value wins (FR-011). Applies on `PUT` and `PATCH`.

### Stage/Pipeline Mismatch Validation (FR-014)

Embedded in `validate()` above. On `PATCH`, falls back to instance values for whichever of `stage` / `pipeline` is not in the payload — mismatches caught even on partial updates.

### `amount` Validation (FR-013)

```python
def validate_amount(self, value):
    if value is not None and value < 0:
        raise serializers.ValidationError('Amount must be zero or a positive value.')
    return value
```

### `probability` Validation (FR-012)

```python
def validate_probability(self, value):
    if value is not None and not (0 <= value <= 100):
        raise serializers.ValidationError('Probability must be between 0 and 100.')
    return value
```

`PositiveSmallIntegerField` enforces ≥ 0 at the DB level; the serializer validator enforces ≤ 100 to return a 400 before hitting the DB.

### Soft Delete (`destroy()` Override)

```python
def destroy(self, request, *args, **kwargs):
    deal = self.get_object()
    deal.is_deleted = True
    deal.save(update_fields=['is_deleted', 'updated_at'])
    return Response(status=status.HTTP_204_NO_CONTENT)
```

DRF's `DestroyModelMixin` would hard-delete. The override is mandatory and handles soft delete explicitly (FR-028). No additional guard needed for won/lost deals in Phase 1.

### Deals App Independence (FR-031, FR-032)

The deals app has **zero** import-time references to the leads app. Migration dependency graph:

```
deals/0001_initial
deals/0002_seed_pipeline   depends on deals/0001

leads/0001_initial
leads/0002_seed_lead_sources  depends on leads/0001
leads/0003_add_converted_deal_fk  depends on leads/0002 AND deals/0001
```

`leads/0003_add_converted_deal_fk` is in the **leads** app, not in deals. Deals can be installed, migrated, and run entirely without leads.

### Nullable FK Serialisation

Each FK appears in the serializer as:
- **Writable**: `<field>_id` PrimaryKeyRelatedField (accepts `null` to clear)
- **Read-only**: `<field>` nested minimal serializer for display without a second request

```python
company_id  = serializers.PrimaryKeyRelatedField(
    source='company_fk',
    queryset=Company.objects.filter(is_deleted=False),
    allow_null=True, required=False, write_only=True,
)
company = CompanyMinimalSerializer(source='company_fk', read_only=True)
```

`is_won` and `is_lost` are read-only computed fields — not writable.

### Pagination

Reuse the shared `PageNumberPagination` subclass: `page` / `page_size`, 1-based, max 100, response shape `{ count, next, previous, results }`. Import from the shared location or co-locate in `deals/pagination.py`.

### URL State Persistence (Frontend)

All active query parameters — `q`, `stage`, `pipeline`, `owner`, `company`, `ordering`, `page`, `page_size` — mirrored in the browser URL via `useDealsSearchParams` hook using Next.js `useSearchParams` / `router.replace` (FR-027, SC-006).

### Probability Auto-Update (Frontend)

In `DealForm.tsx`, an `onChange` handler on the stage selector calls `setValue('probability', selectedStage.probability)` via react-hook-form — but only when the user has not manually edited the probability field. The form tracks a `userOverrodeProbability` ref in local state. Probability updates without a server round-trip (SC-004).

---

## Complexity Tracking

No constitution violations to justify.

| Design choice | Why it adds complexity | Justification |
|---|---|---|
| `select_related` covering all FK fields | Wider join surface | Required for search `company_fk__name` join and N+1 prevention (best-practices.md) |
| Probability auto-set in object-level `validate()` | Cross-field dependency | Spec requires stage-driven default but user-overridable; field-level validation cannot access both `stage` and `initial_data` simultaneously |
| Stage/pipeline mismatch check with instance fallback | Extra logic path on PATCH | PATCH only sends changed fields; must compare against persisted values for reliable validation |
| `is_won` / `is_lost` as computed serializer fields (not DB columns) | Extra serializer fields | ADR-007 mandates flag-based determination; avoids denormalising stage data onto the Deal row |
| Data migration for seed data (not fixture) | Slightly more code than `loaddata` | Runs automatically on `migrate`; idempotent via `get_or_create`; no manual deploy step |
