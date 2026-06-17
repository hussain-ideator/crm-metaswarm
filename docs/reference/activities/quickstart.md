# Quickstart Validation Guide: Activities Module

**Date**: 2026-06-15
**Spec**: [spec.md](spec.md) | **API Contract**: [contracts/openapi-activities.yaml](contracts/openapi-activities.yaml) | **Data Model**: [data-model.md](data-model.md)

This guide describes how to validate the Activities module end-to-end once implemented. It covers backend API scenarios and frontend UI flows.

---

## Prerequisites

- Django migrations applied (`python manage.py migrate`) — `apps.activities` in `INSTALLED_APPS`
- Development server running (`python manage.py runserver`)
- Frontend dev server running (`npm run dev` in `frontend/`)
- At least one active CRM user (for authentication)
- At least one Lead, Contact, Company, and Deal record (for generic relation testing)
- JWT access token for an authenticated user (`export TOKEN=...`)

---

## Backend Validation Scenarios

### 1. Create a minimal activity — subject and type only

```bash
curl -s -X POST http://localhost:8000/api/activities/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type": "task", "subject": "Follow up with prospect"}' | python -m json.tool
```

**Expected**: 201 response, `completed_at=null`, `assigned_to=null`, `content_type=null`, `object_id=null`.

---

### 2. Create an activity linked to a Lead (content_type + object_id)

```bash
# Substitute a valid Lead ID
LEAD_ID=1

curl -s -X POST http://localhost:8000/api/activities/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"type\": \"call\", \"subject\": \"Discovery call\", \"content_type\": \"lead\", \"object_id\": $LEAD_ID}" \
  | python -m json.tool
```

**Expected**: 201 response, `content_type="lead"`, `object_id=<LEAD_ID>`. No raw ContentType integer in the response.

---

### 3. Create an activity with a due date and assignee

```bash
USER_ID=1

curl -s -X POST http://localhost:8000/api/activities/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"type\": \"meeting\", \"subject\": \"Kickoff meeting\", \"due_at\": \"2026-06-20T14:00:00Z\", \"assigned_to_id\": $USER_ID}" \
  | python -m json.tool
```

**Expected**: 201, `due_at="2026-06-20T14:00:00Z"`, `assigned_to.id=$USER_ID`.

---

### 4. Mark an activity as complete (server timestamp)

```bash
# Capture the ID from step 1 or 2
ACTIVITY_ID=1

curl -s -X POST http://localhost:8000/api/activities/$ACTIVITY_ID/complete/ \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool
```

**Expected**: 200, `completed_at` is now set to a recent ISO 8601 timestamp. The timestamp is set by the server, not the client.

---

### 5. Mark the same activity as incomplete

```bash
curl -s -X POST http://localhost:8000/api/activities/$ACTIVITY_ID/incomplete/ \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool
```

**Expected**: 200, `completed_at=null`.

---

### 6. Filter activity feed for a specific Lead

```bash
curl -s "http://localhost:8000/api/activities/?content_type=lead&object_id=$LEAD_ID" \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool
```

**Expected**: Only activities linked to that Lead. Results sorted by `due_at ASC NULLS LAST`, then `created_at DESC`. Pagination envelope present (`count`, `next`, `previous`, `results`).

---

### 7. Filter by type

```bash
curl -s "http://localhost:8000/api/activities/?type=task" \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool
```

**Expected**: Only task-type activities.

---

### 8. Search — subject and description

```bash
curl -s "http://localhost:8000/api/activities/?q=kickoff" \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool
```

**Expected**: Activities whose `subject` or `description` contains "kickoff" (case-insensitive). Single SQL query, no N+1.

---

### 9. Filter combination (type + assigned_to)

```bash
curl -s "http://localhost:8000/api/activities/?type=call&assigned_to=$USER_ID" \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool
```

**Expected**: Only call-type activities assigned to that user. AND logic, paginated.

---

### 10. Validation errors

**Blank subject**:
```bash
curl -s -X POST http://localhost:8000/api/activities/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type": "task", "subject": ""}' | python -m json.tool
```
Expected: 400, `{"subject": ["This field may not be blank."]}`.

**Invalid type**:
```bash
curl -s -X POST http://localhost:8000/api/activities/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type": "email", "subject": "Test"}' | python -m json.tool
```
Expected: 400, `{"type": ["\"email\" is not a valid choice."]}`.

**content_type without object_id**:
```bash
curl -s -X POST http://localhost:8000/api/activities/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type": "task", "subject": "Orphan", "content_type": "lead"}' | python -m json.tool
```
Expected: 400, describing that content_type and object_id must both be provided.

**Invalid content_type label**:
```bash
curl -s "http://localhost:8000/api/activities/?content_type=invoice&object_id=1" \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool
```
Expected: 400, `{"content_type": ["Invalid label: 'invoice'. Allowed: [...]"]}`.

---

### 11. Soft delete

```bash
curl -s -X DELETE http://localhost:8000/api/activities/$ACTIVITY_ID/ \
  -H "Authorization: Bearer $TOKEN"
# Expected: 204 No Content

curl -s http://localhost:8000/api/activities/$ACTIVITY_ID/ \
  -H "Authorization: Bearer $TOKEN"
# Expected: 404 Not Found

# Verify row still exists in DB with is_deleted=True (Django shell or direct DB check)
```

---

### 12. Soft-deleted Lead — activity survives

```bash
# Soft-delete the Lead ($LEAD_ID) — via the Leads API or Django shell
# Then re-query the activity that was linked to it

curl -s http://localhost:8000/api/activities/$ACTIVITY_ID/ \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool
```

**Expected**: Activity is still retrievable. `content_type="lead"`, `object_id=<LEAD_ID>` are preserved. `content_object` returns None at the ORM level (but the API shows the stored label and object_id). The activity is NOT automatically soft-deleted.

---

### 13. Unauthenticated request

```bash
curl -s http://localhost:8000/api/activities/ | python -m json.tool
```

**Expected**: 401 `{"detail": "Authentication credentials were not provided."}`.

---

## Frontend Validation Flows

### Flow 1 — Activity list renders with correct layout

1. Navigate to `/activities`.
2. Confirm list renders with columns: Type badge, Subject, Due Date, Completed, Assigned To, Linked Record.
3. Confirm search box and filter controls (Type, Assigned To) are present.
4. Confirm pagination controls appear.

### Flow 2 — Create activity linked to a CRM record

1. Click "Log Activity."
2. Select type = "Call."
3. Enter subject = "Discovery call."
4. Set linked record = Lead (select from dropdown or type-ahead).
5. Submit. Confirm redirect to detail view.
6. Confirm `content_type = "lead"` and linked record name shown on detail.

### Flow 3 — Mark complete / incomplete inline

1. On any activity detail page, click "Mark as Complete."
2. Confirm `completed_at` timestamp appears and a "Completed" badge renders — without a full page reload.
3. Click "Unmark" (or equivalent).
4. Confirm `completed_at` clears and the badge reverts — without a full page reload.

### Flow 4 — Activity feed widget on a Lead detail page

1. Navigate to any Lead detail page.
2. Confirm an "Activity Feed" section is visible.
3. If activities exist for this Lead, confirm they appear sorted by due date (nulls at bottom), then created date.
4. If no activities exist, confirm an empty-state message ("No activities yet") is shown.
5. Click "Log Activity" within the feed (if inline form is provided), log a task — confirm it appears in the feed immediately without a full page reload.
6. Click "Mark Complete" inline in the feed — confirm the activity updates in place.

### Flow 5 — Activity feed widget on Deal, Contact, Company detail pages

Repeat Flow 4 for a Deal, Contact, and Company detail page. Each feed should show only activities linked to that specific record.

### Flow 6 — Search and filters update URL

1. Enter "discovery" in the search box.
2. Confirm URL updates to `?q=discovery` without a full page reload.
3. Apply Type = "Call" filter.
4. Confirm URL reflects `?q=discovery&type=call`.
5. Copy and paste URL in a new tab — confirm identical filtered view.

### Flow 7 — Soft delete hides activity

1. On an activity detail page, click Delete and confirm.
2. Confirm redirect to activity list.
3. Confirm the deleted activity does not appear in the list.
4. Navigate directly to `/activities/{id}` — confirm 404/not-found page.
5. Navigate to the linked Lead/Contact/Company/Deal detail page — confirm the activity no longer appears in that record's feed.

---

## Quick Checks (Definition of Done)

- [ ] `python manage.py migrate` completes cleanly with `apps.activities` in `INSTALLED_APPS`
- [ ] `apps.activities` can be installed and migrated without any of the four entity apps installed
- [ ] All 13 backend validation scenarios above pass via curl
- [ ] `pytest backend/apps/activities/` passes (models, serializers, views)
- [ ] `tsc --noEmit` passes in frontend
- [ ] `npm run lint` passes in frontend
- [ ] OpenAPI schema regenerated: `python manage.py spectacular --file docs/openapi.yaml`
- [ ] `docs/erd.md` updated to reflect Activity as implemented
- [ ] `ActivityFeed` widget renders correctly on Lead, Contact, Company, and Deal detail pages
- [ ] Inline complete/incomplete toggle in the feed works without a full page reload
