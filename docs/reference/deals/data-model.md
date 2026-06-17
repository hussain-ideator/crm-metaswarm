# Data Model: Deals Module

**Date**: 2026-06-15
**Feature**: Deals (Opportunities) Module — Phase 1, Module 4

---

## Entities

### Pipeline

Configuration entity. Not a business record — no audit fields.

| Field      | Type                        | Constraints                  |
|------------|-----------------------------|------------------------------|
| id         | AutoField (PK)              |                              |
| name       | CharField(200)              | not null                     |
| is_default | BooleanField                | default=False                |

**Table**: `deals_pipeline`

**Notes**:
- Exactly one row has `is_default=True` (the seeded "Sales Pipeline").
- No user-facing create/edit in Phase 1.

---

### Stage

Configuration entity per pipeline. Ordered within a pipeline.

| Field       | Type                        | Constraints                                  |
|-------------|-----------------------------|----------------------------------------------|
| id          | AutoField (PK)              |                                              |
| pipeline    | ForeignKey → Pipeline       | CASCADE, related_name='stages'               |
| name        | CharField(200)              | not null                                     |
| order_index | PositiveSmallIntegerField   | unique per pipeline (unique_together)        |
| probability | PositiveSmallIntegerField   | 0–100 (by convention; not DB-constrained)    |
| is_won      | BooleanField                | default=False                                |
| is_lost     | BooleanField                | default=False                                |

**Table**: `deals_stage`

**Notes**:
- `unique_together = [('pipeline', 'order_index')]` enforces ordering uniqueness per pipeline.
- `ordering = ['order_index']` on Meta.
- `is_won` and `is_lost` are mutually exclusive by convention (no DB constraint); seed data maintains this.

**Seeded rows** (per ADR-007):

| order_index | name           | probability | is_won | is_lost |
|-------------|----------------|-------------|--------|---------|
| 1           | Qualification  | 10          | false  | false   |
| 2           | Needs Analysis | 25          | false  | false   |
| 3           | Proposal       | 50          | false  | false   |
| 4           | Negotiation    | 75          | false  | false   |
| 5           | Closed Won     | 100         | true   | false   |
| 6           | Closed Lost    | 0           | false  | true    |

---

### Deal

Business entity. Full audit trail via `TimestampedModel`.

| Field               | Type                           | Constraints                                       |
|---------------------|--------------------------------|---------------------------------------------------|
| id                  | AutoField (PK)                 |                                                   |
| name                | CharField(500)                 | not null, required                                |
| amount              | DecimalField(15, 2)            | null, blank (optional)                            |
| currency            | CharField(3)                   | not null, default='USD'                           |
| close_date          | DateField                      | null, blank (optional)                            |
| pipeline            | ForeignKey → Pipeline          | PROTECT, null, blank, related_name='deals'        |
| stage               | ForeignKey → Stage             | PROTECT, null, blank, related_name='deals'        |
| company_fk          | ForeignKey → companies.Company | SET_NULL, null, blank, related_name='deals'       |
| primary_contact_fk  | ForeignKey → contacts.Contact  | SET_NULL, null, blank, related_name='deals'       |
| owner_fk            | ForeignKey → AUTH_USER_MODEL   | SET_NULL, null, blank, related_name='owned_deals' |
| probability         | PositiveSmallIntegerField      | null, blank (auto-set from stage, user-overridable)|
| is_deleted          | BooleanField                   | default=False, db_index=True                      |
| created_at          | DateTimeField                  | auto_now_add (from TimestampedModel)              |
| updated_at          | DateTimeField                  | auto_now (from TimestampedModel)                  |
| created_by          | ForeignKey → User              | PROTECT, null (from TimestampedModel)             |
| updated_by          | ForeignKey → User              | SET_NULL, null (from TimestampedModel)            |

**Table**: `deals_deal`

**Computed fields** (serializer only, not stored):
- `is_won` → `stage.is_won if stage_id else False`
- `is_lost` → `stage.is_lost if stage_id else False`

---

## Relationships

```
Pipeline (1) ──< Stage (many)           CASCADE: deleting Pipeline deletes its Stages
Stage    (1) ──< Deal  (many)           PROTECT: Stage cannot be deleted while Deals exist
Pipeline (1) ──< Deal  (many)           PROTECT: Pipeline cannot be deleted while Deals exist
Company  (1) ──< Deal  (many)           SET_NULL on Company delete
Contact  (1) ──< Deal  (many)           SET_NULL on Contact delete / soft-delete
User     (1) ──< Deal  (many, owner)    SET_NULL on User delete
Lead     (1) ──o Deal  (converted_to)   String FK on Lead side: 'deals.Deal', SET_NULL
```

---

## Validation Rules

| Field       | Rule                                                                                  | Layer         |
|-------------|---------------------------------------------------------------------------------------|---------------|
| name        | Required, not blank                                                                   | Serializer    |
| amount      | If provided: must be ≥ 0                                                              | Serializer    |
| probability | If provided: must be 0–100 (PositiveSmallIntegerField covers ≥ 0; serializer covers ≤ 100) | Serializer |
| stage       | If both stage and pipeline provided: stage.pipeline must match pipeline               | Serializer (object-level) |
| probability | Auto-set from stage.probability when stage changes and no explicit probability given  | Serializer (object-level) |
| currency    | Stored as-is; any 3-char string accepted (no ISO 4217 validation in Phase 1)         | None          |

---

## Indexes

| Table       | Column(s)         | Reason                                     |
|-------------|-------------------|--------------------------------------------|
| deals_deal  | is_deleted        | Default queryset filter (all list views)   |
| deals_deal  | stage_id          | Filter by stage (FR-025)                   |
| deals_deal  | pipeline_id       | Filter by pipeline (FR-025)                |
| deals_deal  | owner_fk_id       | Filter by owner (FR-025)                   |
| deals_deal  | company_fk_id     | Filter by company (FR-025); JOIN for search|
| deals_deal  | created_at        | Default ordering                           |
| deals_stage | (pipeline, order_index) | unique_together (ordering per pipeline)|

---

## State Transitions

Deal records have no formal status enum in Phase 1. The won/lost state is determined by the current stage's flags, not the deal row itself. A deal moves through states implicitly by changing its stage FK.

```
(no stage) → Qualification → Needs Analysis → Proposal → Negotiation → Closed Won
                                                                     ↘ Closed Lost
```

Any stage transition is permitted via edit in Phase 1 — no directional enforcement. Won/Lost deals remain editable in Phase 1 (Phase 2 may add lock behaviour).

---

## Migration Plan

| Migration                       | Description                                              |
|---------------------------------|----------------------------------------------------------|
| deals/0001_initial              | Create `deals_pipeline`, `deals_stage`, `deals_deal`     |
| deals/0002_seed_pipeline        | Seed "Sales Pipeline" + 6 stages (idempotent)            |
| leads/0003_add_converted_deal_fk| Adds `converted_deal_fk` on Lead (in leads app, not here)|

`leads/0003` depends on `('leads', '0002_seed_lead_sources'), ('deals', '0001_initial')`.
The deals app itself has no migration dependency on leads.
