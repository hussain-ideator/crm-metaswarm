# Quickstart & Validation Guide: Companies Module

**Date**: 2026-06-14 | **Plan**: [plan.md](plan.md) | **API Contract**: [contracts/openapi-companies.yaml](contracts/openapi-companies.yaml)

This guide describes runnable validation scenarios that prove the feature works end-to-end. It covers prerequisites, the start-up sequence, and per-user-story acceptance checks.

---

## Prerequisites

| Tool              | Version  | Check command                       |
|-------------------|----------|-------------------------------------|
| Python            | ≥ 3.12   | `python --version`                  |
| Node              | ≥ 20     | `node --version`                    |
| MySQL             | ≥ 8.0    | `mysql --version`                   |
| Backend venv      | active   | `backend/.venv` created via `uv`    |
| `.env` file       | present  | `backend/.env` (copy `.env.example`)|

---

## Start-up Sequence

### 1 — Backend

```powershell
# from repo root
cd backend
python manage.py migrate
python manage.py runserver
# Django starts on http://localhost:8000
```

### 2 — Frontend

```powershell
# new terminal, from repo root
cd frontend
npm install
npm run dev
# Next.js starts on http://localhost:3000
```

### 3 — Seed data (optional but recommended)

```powershell
# In a separate terminal with the venv active
cd backend
python manage.py shell -c "
from apps.accounts.tests.factories import UserFactory
from apps.companies.tests.factories import CompanyFactory

user = UserFactory(email='seed@example.com', password='seed1234')
CompanyFactory.create_batch(30, owner=user)
print('Seeded 1 user + 30 companies')
"
```

---

## Authentication

All company API endpoints require a valid JWT Bearer token.

```bash
# Obtain access token (replace seed@example.com / seed1234 with your user)
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"seed@example.com","password":"seed1234"}'
# → {"access": "<ACCESS_TOKEN>"}

# Use in subsequent requests:
export TOKEN=<ACCESS_TOKEN>
```

In the browser, log in at http://localhost:3000/login first; the frontend stores the token in memory and attaches it automatically.

---

## Validation Scenarios

### US1 — Browse the Company List

**Acceptance goal**: Paginated table with search, filter, sort, and URL state.

**Backend (curl)**:
```bash
# Default list — should return up to 25 results, count > 0
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/companies/"

# Search by name substring
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/companies/?q=acme"
# → results contain only companies whose name/website/phone matches "acme"

# Filter by industry
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/companies/?industry=Technology"

# Sort by created_at descending
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/companies/?ordering=-created_at"

# Page 2 with page_size=10
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/companies/?page=2&page_size=10"
# → response.previous ends with page=1, response.next ends with page=3 (if enough data)

# Invalid page (should return 400)
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/companies/?page=abc"
```

**Frontend**:
1. Navigate to http://localhost:3000/companies
2. Confirm table renders with rows.
3. Type a company name into the search box → table updates, URL gains `?q=<term>`.
4. Select an industry from the filter dropdown → URL gains `?industry=<value>`.
5. Click a column header → URL gains `?ordering=<field>`, click again → `-<field>`.
6. Navigate to page 2 → URL gains `?page=2`.
7. Copy the URL, open in a new tab → exact same view reproduced.

**Expected outcomes**: All list acceptance scenarios in spec.md §US1.

---

### US2 — Create a Company

**Backend (curl)**:
```bash
# Valid create
curl -X POST http://localhost:8000/api/companies/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Beta Industries","industry":"Finance","annual_revenue":"2500000.00","employee_count":50}'
# → 201 with full Company object; id assigned

# Missing name (validation error)
curl -X POST http://localhost:8000/api/companies/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"industry":"Finance"}'
# → 400 {"name":["This field may not be blank."]}

# Negative revenue (validation error)
curl -X POST http://localhost:8000/api/companies/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Bad Co","annual_revenue":"-100"}'
# → 400 {"annual_revenue":["annual_revenue must be a non-negative number."]}

# Non-integer employee count
curl -X POST http://localhost:8000/api/companies/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Bad Co","employee_count":3.5}'
# → 400

# Formatted string revenue (should fail — not a valid decimal)
curl -X POST http://localhost:8000/api/companies/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Bad Co","annual_revenue":"1,200,000"}'
# → 400
```

**Frontend**:
1. Click "New Company" from the list page.
2. Leave Name blank → attempt submit → inline error on the Name field.
3. Fill Name + optional fields → submit → redirected to detail page.
4. New record appears in the list.

---

### US3 — View Company Details

**Backend (curl)**:
```bash
# Valid retrieve (replace 42 with an actual id)
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/companies/42/"
# → 200 with all Company fields

# Unauthenticated request
curl "http://localhost:8000/api/companies/42/"
# → 401

# Non-existent id
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/companies/999999/"
# → 404
```

**Frontend**:
1. Click any row in the company list.
2. Confirm detail page loads with all fields visible (name, industry, website, phone, addresses, revenue, employee count, owner, timestamps).
3. Navigate directly via URL → page loads correctly.

---

### US4 — Edit a Company

**Backend (curl)**:
```bash
# Full update (PUT)
curl -X PUT http://localhost:8000/api/companies/42/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Acme Corp Renamed","industry":"Retail"}'
# → 200; updated_at has advanced; name and industry changed

# Partial update (PATCH) — only industry changes
curl -X PATCH http://localhost:8000/api/companies/42/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"industry":"Healthcare"}'
# → 200; only industry changed, name unchanged

# Clear name (validation error)
curl -X PATCH http://localhost:8000/api/companies/42/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":""}'
# → 400
```

**Frontend**:
1. Open a company detail page.
2. Click "Edit".
3. Change Name and Industry → Save.
4. Detail view shows updated values; `updated_at` is refreshed.

---

### US5 — Soft Delete a Company

**Backend (curl)**:
```bash
# Note the company id before deleting
COMPANY_ID=42

# Soft delete
curl -X DELETE http://localhost:8000/api/companies/$COMPANY_ID/ \
  -H "Authorization: Bearer $TOKEN"
# → 204 No Content

# Confirm it's gone from the list
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/companies/?q=<deleted-company-name>"
# → count: 0

# Confirm 404 on direct access
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/companies/$COMPANY_ID/"
# → 404

# Confirm row still exists in DB (Django shell)
cd backend
python manage.py shell -c "
from apps.companies.models import Company
c = Company.objects.get(pk=$COMPANY_ID)
print(c.is_deleted, c.deleted_at)
"
# → True <timestamp>
```

**Frontend**:
1. Open a company detail page.
2. Click "Delete" and confirm.
3. Redirected to the company list; deleted company is absent.
4. Navigating directly to the deleted company's URL shows a "not found" page.

---

## Edge-Case Checks

| Scenario                          | Expected result                                          |
|-----------------------------------|----------------------------------------------------------|
| Search with no matches            | `count: 0`, `results: []`; UI shows empty-state message  |
| `page=abc` (non-integer)          | 400 with descriptive error                               |
| `page_size=200` (exceeds max)     | 400 or clamped to 100 (per implementation choice)        |
| Owner user deleted → list company | Company appears with `owner: null`, no error             |
| SQL-special chars in `q`          | Plain-text match; no 500; results are safe               |
| Unauthenticated request           | 401 on all endpoints                                     |
| Access deleted company URL        | 404 (identical to non-existent)                          |

---

## Automated Test Suites

After implementation, run the full suites to confirm no regressions:

```powershell
# Backend
cd backend
pytest apps/companies/tests/ -v

# Frontend unit
cd frontend
npm test

# Frontend e2e (requires both servers running)
cd frontend
npx playwright test
```

All tests must pass before marking the feature complete.
