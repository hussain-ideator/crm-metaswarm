# Quickstart Validation Guide: Deals Module

**Date**: 2026-06-15
**Spec**: [spec.md](spec.md) | **API Contract**: [contracts/openapi-deals.yaml](contracts/openapi-deals.yaml) | **Data Model**: [data-model.md](data-model.md)

This guide describes how to validate the Deals module end-to-end once implemented. It covers backend API scenarios and frontend UI flows.

---

## Prerequisites

- Django migrations applied (`python manage.py migrate`) — seed pipeline and stages present
- Development server running (`python manage.py runserver`)
- Frontend dev server running (`npm run dev` in `frontend/`)
- At least one active CRM user (for authentication)
- At least one Company and Contact record (for optional FK fields)
- JWT access token for an authenticated user

---

## Backend Validation Scenarios

### 1. Confirm seed data is present

```bash
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/pipelines/ | python -m json.tool
```

**Expected**: One pipeline `Sales Pipeline` with `is_default=true` and six stages in order: Qualification (10%), Needs Analysis (25%), Proposal (50%), Negotiation (75%), Closed Won (100%, `is_won=true`), Closed Lost (0%, `is_lost=true`).

---

### 2. Create a deal — name only (minimum required)

```bash
curl -s -X POST http://localhost:8000/api/deals/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Deal"}' | python -m json.tool
```

**Expected**: 201 response, deal with `name="Test Deal"`, `probability=null`, `is_won=false`, `is_lost=false`.

---

### 3. Create a deal with stage — probability auto-set

First, get the Proposal stage ID (order_index=3, probability=50):

```bash
PROPOSAL_STAGE_ID=$(curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/pipelines/ | python -c "
import sys, json
data = json.load(sys.stdin)
stages = data[0]['stages']
print([s['id'] for s in stages if s['name'] == 'Proposal'][0])
")
PIPELINE_ID=$(curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/pipelines/ | python -c "
import sys, json; print(json.load(sys.stdin)[0]['id'])
")
```

```bash
curl -s -X POST http://localhost:8000/api/deals/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"Auto-Prob Deal\", \"pipeline_id\": $PIPELINE_ID, \"stage_id\": $PROPOSAL_STAGE_ID}" \
  | python -m json.tool
```

**Expected**: `probability=50` (auto-set from stage), `is_won=false`, `is_lost=false`.

---

### 4. Create a deal with stage — user overrides probability

```bash
curl -s -X POST http://localhost:8000/api/deals/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"Override Deal\", \"pipeline_id\": $PIPELINE_ID, \"stage_id\": $PROPOSAL_STAGE_ID, \"probability\": 35}" \
  | python -m json.tool
```

**Expected**: `probability=35` (user value wins), not 50.

---

### 5. PATCH stage — probability auto-updates

```bash
# Get deal ID from step 3 output, set DEAL_ID
NEGOTIATION_STAGE_ID=$(curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/pipelines/ | python -c "
import sys, json
data = json.load(sys.stdin)
stages = data[0]['stages']
print([s['id'] for s in stages if s['name'] == 'Negotiation'][0])
")

curl -s -X PATCH http://localhost:8000/api/deals/$DEAL_ID/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"stage_id\": $NEGOTIATION_STAGE_ID}" \
  | python -m json.tool
```

**Expected**: `probability=75`, `stage.name="Negotiation"`.

---

### 6. Move deal to Closed Won — is_won flag

```bash
CLOSED_WON_ID=$(curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/pipelines/ | python -c "
import sys, json
data = json.load(sys.stdin)
stages = data[0]['stages']
print([s['id'] for s in stages if s['is_won']][0])
")

curl -s -X PATCH http://localhost:8000/api/deals/$DEAL_ID/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"stage_id\": $CLOSED_WON_ID}" \
  | python -m json.tool
```

**Expected**: `is_won=true`, `is_lost=false`, `probability=100`. No name comparison — flag driven.

---

### 7. Validation errors

**Blank name**:
```bash
curl -s -X POST http://localhost:8000/api/deals/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": ""}' | python -m json.tool
```
Expected: 400, `{"name": ["This field may not be blank."]}`.

**Negative amount**:
```bash
curl -s -X PATCH http://localhost:8000/api/deals/$DEAL_ID/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": -100}' | python -m json.tool
```
Expected: 400, `{"amount": ["Amount must be zero or a positive value."]}`.

**Out-of-range probability**:
```bash
curl -s -X PATCH http://localhost:8000/api/deals/$DEAL_ID/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"probability": 150}' | python -m json.tool
```
Expected: 400, `{"probability": ["Probability must be between 0 and 100."]}`.

**Stage/pipeline mismatch** (use a stage from a different pipeline if one exists):
Expected: 400, `{"stage": ["Stage does not belong to the selected pipeline."]}`.

---

### 8. Search — name and company name

```bash
# Create a deal linked to a company, then search by company name
curl -s "http://localhost:8000/api/deals/?q=Acme" \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool
```

**Expected**: Deals whose `name` or `company_fk.name` contains "Acme" (case-insensitive). Query runs as a single SQL join, not N queries.

---

### 9. Filter combinations

```bash
curl -s "http://localhost:8000/api/deals/?stage=$PROPOSAL_STAGE_ID&owner=1" \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool
```

**Expected**: Only deals matching both filters (AND logic), with pagination envelope (`count`, `next`, `previous`, `results`).

---

### 10. Soft delete

```bash
curl -s -X DELETE http://localhost:8000/api/deals/$DEAL_ID/ \
  -H "Authorization: Bearer $TOKEN"
# Expected: 204 No Content

curl -s http://localhost:8000/api/deals/$DEAL_ID/ \
  -H "Authorization: Bearer $TOKEN"
# Expected: 404 Not Found

# Verify row still exists in DB with is_deleted=True (direct DB check or Django shell)
```

---

### 11. Unauthenticated request

```bash
curl -s http://localhost:8000/api/deals/ | python -m json.tool
```

**Expected**: 401 `{"detail": "Authentication credentials were not provided."}`.

---

### 12. Seed idempotency

```bash
python manage.py migrate deals 0002_seed_pipeline
python manage.py migrate deals 0002_seed_pipeline
```

**Expected**: Second run completes without error; no duplicate pipeline or stage rows created (`get_or_create` is idempotent).

---

## Frontend Validation Flows

### Flow 1 — Deal list renders with correct columns

1. Navigate to `/deals`.
2. Confirm table shows columns: Name, Amount, Stage, Probability, Close Date, Owner, Company.
3. Confirm pagination controls appear.
4. Confirm search box and filter dropdowns (Stage, Pipeline, Owner, Company) are present.

### Flow 2 — Create deal, probability auto-updates

1. Click "New Deal."
2. Fill in Name = "Quickstart Deal."
3. Select Pipeline = "Sales Pipeline."
4. Select Stage = "Proposal."
5. Confirm Probability field auto-populates to 50 **without saving**.
6. Change Stage to "Negotiation" — confirm Probability updates to 75.
7. Override Probability to 60.
8. Submit. Confirm detail view shows Probability = 60 and Stage = Negotiation.

### Flow 3 — Won/lost badge (flag-based, not name-based)

1. Edit the deal created in Flow 2.
2. Change Stage to "Closed Won."
3. Save. Confirm a "Won" badge appears on the detail page.
4. The badge is driven by `is_won=true` in the API response, not by comparing the stage name string.

### Flow 4 — Search and filters update URL

1. Enter "Quickstart" in the search box.
2. Confirm URL updates to `?q=Quickstart` without a full page reload.
3. Apply Stage filter.
4. Confirm URL reflects both parameters.
5. Copy and paste URL in a new tab — confirm same filtered view loads.

### Flow 5 — Soft delete hides deal

1. On the detail page, click Delete and confirm.
2. Confirm redirect to deal list.
3. Confirm "Quickstart Deal" no longer appears in the list.
4. Navigate directly to `/deals/{id}` — confirm 404/not-found page.

---

## Quick Checks (Definition of Done)

- [ ] `python manage.py migrate` completes cleanly with deals app in `INSTALLED_APPS`
- [ ] `python manage.py migrate` can run with deals installed but **without** leads installed
- [ ] Seed pipeline + 6 stages present after migrate
- [ ] All 5 validation scenarios above pass via curl
- [ ] `pytest backend/apps/deals/` passes
- [ ] `tsc --noEmit` passes in frontend
- [ ] `npm run lint` passes in frontend
- [ ] OpenAPI schema regenerated: `python manage.py spectacular --file docs/openapi.yaml`
- [ ] `docs/erd.md` updated to reflect Deal, Pipeline, Stage as implemented
