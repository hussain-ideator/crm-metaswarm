# Research: Deals Module

**Date**: 2026-06-15
**Feature**: Deals (Opportunities) Module — Phase 1, Module 4

All decisions below were resolved from existing project ADRs, best-practices.md, the leads plan.md (working example), and the user's explicit guidance. No external research was required — the tech stack is fully pinned in tech-stack.md.

---

## Decision 1: Probability auto-set behaviour on stage change

**Decision**: When a stage is set or changed, probability is auto-set to `stage.probability` only if the caller does not provide an explicit `probability` in the same request payload. User-supplied values always win. Implemented in `DealSerializer.validate()` (object-level) by inspecting `self.initial_data`.

**Rationale**: The spec (FR-010, FR-011) requires both behaviours in the same endpoint. Field-level validators cannot access other fields; object-level `validate()` has the full attrs dict and `self.initial_data` to distinguish a user-supplied `probability` from an absent one.

**Alternatives considered**:
- Separate `set_probability_from_stage` endpoint action — rejected as overly chatty; the UX requires probability to update inline with stage selection.
- Always overwrite probability from stage, ignore user input — violates FR-011.

---

## Decision 2: Won/Lost state representation

**Decision**: `is_won` and `is_lost` are **not** stored on the `Deal` model. They are computed read-only fields in `DealSerializer`, derived from `deal.stage.is_won` and `deal.stage.is_lost`. The frontend reads these flags from the API response and renders badges accordingly. No name comparisons are performed anywhere.

**Rationale**: ADR-007 explicitly states "Closed Won / Closed Lost are ordinary stages flagged with `is_won`/`is_lost`, so the Kanban 'move to won/lost' flow keys off those flags rather than hard-coded names." Storing a denormalised `is_won` on Deal would require keeping it in sync when stages change; deriving it at serialisation time has zero maintenance burden.

**Alternatives considered**:
- `is_won` / `is_lost` columns on Deal (denormalised) — rejected: adds sync complexity, diverges from ADR intent.
- Hardcoded stage name checks (`stage.name == 'Closed Won'`) — explicitly prohibited by ADR-007.

---

## Decision 3: `currency` field type

**Decision**: `CharField(max_length=3, default='USD')`. Not null, not blank. No foreign key to a Currency lookup table. No validation of ISO 4217 code correctness in Phase 1.

**Rationale**: The user explicitly specified this type. Currency conversion is out of scope for Phase 1. A simple string field avoids adding a lookup table and migration for no MVP value. `max_length=3` matches ISO 4217 (three uppercase letters).

**Alternatives considered**:
- `CurrencyField` via `django-money` — rejected: overkill for Phase 1, no conversion needed.
- FK to a Currency model — rejected: unnecessary complexity, no lookup needed.

---

## Decision 4: Search implementation (FR-024)

**Decision**: `Q(name__icontains=q) | Q(company_fk__name__icontains=q)` with `select_related('company_fk')` on the base queryset. The join used for `company_fk__name` is covered by the pre-existing `select_related` call, so no additional query is issued per result row.

**Rationale**: User explicitly specified this exact implementation. `icontains` on `company_fk__name` is a SQL JOIN filter, not a Python-level filter — Django ORM generates a single query with a WHERE clause over the joined table.

**Alternatives considered**:
- Full-text search index (MySQL FULLTEXT) — rejected: over-engineered for Phase 1 volume; no indexing infrastructure set up.
- Search only on `deal.name` — rejected: FR-024 explicitly requires company name matching.

---

## Decision 5: Deals app independence (FR-031)

**Decision**: `deals` is installable and migratable with no dependency on the `leads` app. The leads app holds the string FK `'deals.Deal'` and the migration `leads/0003_add_converted_deal_fk` that depends on `('deals', '0001_initial')`. The deals app has no migrations that declare a dependency on leads, and no module-level imports from `apps.leads`.

**Rationale**: The spec states "Deals app landing unblocks leads/0003_add_converted_deal_fk." This means deals must be deployable first, then leads migration 0003 can run. If deals imported leads at module level, circular imports would occur.

**Alternatives considered**:
- Placing `converted_deal_fk` on the Deal model (inverse direction) — rejected: the relationship owner is Lead (Lead converts to Deal); Deal has no semantic need to know it was conversion-created.

---

## Decision 6: `pipeline_fk` and `stage_fk` — PROTECT vs CASCADE

**Decision**: Both `pipeline_fk` and `stage_fk` on Deal use `on_delete=PROTECT`. `Pipeline.stages` uses `on_delete=CASCADE` (deleting a pipeline deletes its stages). A pipeline with deals cannot be deleted (PROTECT fires). A stage with deals cannot be deleted (PROTECT fires).

**Rationale**: FR-020 and FR-021 explicitly require this. Deals represent real business value; silently reassigning or nullifying their pipeline/stage on delete would corrupt pipeline analytics. `PROTECT` forces an explicit data-cleaning step before infrastructure changes.

**Alternatives considered**:
- `SET_NULL` on both — rejected: creates orphaned deals with no stage, breaking probability and won/lost logic.
- `CASCADE` — rejected: would silently delete deals when a stage is removed.

---

## Decision 7: Pipeline and Stage do not inherit TimestampedModel

**Decision**: `Pipeline` and `Stage` are plain `models.Model` subclasses with no `created_at`, `updated_at`, `is_deleted`, or `created_by` fields.

**Rationale**: They are configuration/reference data, not business entities with audit trails. Users do not create, edit, or delete pipelines and stages via the Phase 1 UI — they are seeded at deploy time. Adding `TimestampedModel` would require `created_by` FK to User, complicating the seed migration which runs before any user exists.

**Alternatives considered**:
- Inheriting `TimestampedModel` with `created_by=null` — rejected: the best-practices.md convention is that `created_by` is not null for business entities; nulling it for seed data creates an inconsistency.
