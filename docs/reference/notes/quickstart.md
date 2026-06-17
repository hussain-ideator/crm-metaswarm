# Quickstart Validation Guide: Notes & Attachments Module

**Date**: 2026-06-15
**Spec**: [spec.md](spec.md) | **API Contract**: [contracts/openapi-notes.yaml](contracts/openapi-notes.yaml) | **Data Model**: [data-model.md](data-model.md)

This guide describes how to validate the Notes & Attachments module end-to-end once implemented. It covers backend API scenarios and frontend UI flows.

---

## Prerequisites

- Django migrations applied (`python manage.py migrate`) — `apps.notes` in `INSTALLED_APPS` after `apps.activities`
- `python-magic` (Linux/macOS) or `python-magic-bin` (Windows) installed in the backend virtualenv
- `MEDIA_ROOT` configured in Django settings and the directory writable
- Development server running (`python manage.py runserver`)
- Frontend dev server running (`npm run dev` in `frontend/`)
- At least one active CRM user (for authentication)
- At least one Lead, Contact, Company, and Deal record (for generic relation testing)
- JWT access token for an authenticated user:

```bash
export TOKEN=<your_access_token>
```

---

## Backend Validation Scenarios

### 1. Create a minimal note (body only, no linked record)

```bash
curl -s -X POST http://localhost:8000/api/notes/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"body": "General reminder for Q3 review."}' | python -m json.tool
```

**Expected**: 201. `owner` shows the authenticated user. `content_type=null`, `object_id=null`.

---

### 2. Create a note linked to a Lead

```bash
LEAD_ID=1

curl -s -X POST http://localhost:8000/api/notes/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"body\": \"Prospect confirmed enterprise interest.\", \"content_type\": \"lead\", \"object_id\": $LEAD_ID}" \
  | python -m json.tool
```

**Expected**: 201. `content_type="lead"`, `object_id=1`. No raw ContentType integer in the response.

---

### 3. List notes for a specific Lead (Notes widget query)

```bash
curl -s "http://localhost:8000/api/notes/?content_type=lead&object_id=$LEAD_ID" \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool
```

**Expected**: Paginated list, only notes linked to that Lead, sorted `created_at` DESC. Pagination envelope present (`count`, `next`, `previous`, `results`).

---

### 4. Update a note body (PATCH)

```bash
NOTE_ID=1

curl -s -X PATCH http://localhost:8000/api/notes/$NOTE_ID/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"body": "Updated: prospect confirmed and wants a demo."}' | python -m json.tool
```

**Expected**: 200. `body` is updated; `updated_at` has advanced.

---

### 5. Validation errors — Notes

**Blank body**:
```bash
curl -s -X POST http://localhost:8000/api/notes/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"body": ""}' | python -m json.tool
```
Expected: 400, `{"body": ["This field may not be blank."]}`.

**Whitespace-only body**:
```bash
curl -s -X POST http://localhost:8000/api/notes/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"body": "   "}' | python -m json.tool
```
Expected: 400, body validation error.

**content_type without object_id**:
```bash
curl -s -X POST http://localhost:8000/api/notes/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"body": "Test", "content_type": "lead"}' | python -m json.tool
```
Expected: 400, `{"non_field_errors": ["content_type and object_id must both be provided or both be null."]}`.

**Invalid content_type label**:
```bash
curl -s "http://localhost:8000/api/notes/?content_type=invoice&object_id=1" \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool
```
Expected: 400, `{"content_type": ["Invalid label: 'invoice'. Allowed: [...]"]}`.

---

### 6. Soft delete a note

```bash
curl -s -X DELETE http://localhost:8000/api/notes/$NOTE_ID/ \
  -H "Authorization: Bearer $TOKEN"
# Expected: 204 No Content

curl -s http://localhost:8000/api/notes/$NOTE_ID/ \
  -H "Authorization: Bearer $TOKEN"
# Expected: 404 Not Found

# Verify in Django shell: Note.objects.get(pk=$NOTE_ID).is_deleted == True
```

---

### 7. Upload an attachment — PDF linked to a Deal

```bash
DEAL_ID=1

curl -s -X POST http://localhost:8000/api/attachments/ \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/proposal.pdf" \
  -F "content_type=deal" \
  -F "object_id=$DEAL_ID" | python -m json.tool
```

**Expected**: 201. `filename`, `file_size`, `mime_type` are all set server-side. `mime_type="application/pdf"`. `file_url` points to the served file under `/media/attachments/<year>/<month>/`. `content_type="deal"`, `object_id=1`.

---

### 8. Upload an attachment — image (no linked record)

```bash
curl -s -X POST http://localhost:8000/api/attachments/ \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/screenshot.png" | python -m json.tool
```

**Expected**: 201. `mime_type="image/png"`. `content_type=null`, `object_id=null`.

---

### 9. List attachments for a Deal

```bash
curl -s "http://localhost:8000/api/attachments/?content_type=deal&object_id=$DEAL_ID" \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool
```

**Expected**: Paginated list, only attachments linked to that Deal, sorted `created_at` DESC.

---

### 10. Validation errors — Attachments

**File too large** (create a >10 MB test file first):
```bash
dd if=/dev/urandom of=/tmp/bigfile.bin bs=1M count=11 2>/dev/null

curl -s -X POST http://localhost:8000/api/attachments/ \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/bigfile.bin" | python -m json.tool
```
Expected: 400, `{"file": ["File exceeds the 10 MB limit."]}`.

**Disallowed MIME type** (rename an executable to .pdf to test magic detection):
```bash
# Disallowed type test: send a plain text file with a .pdf extension
echo "this is plain text" > /tmp/fakepdf.pdf

curl -s -X POST http://localhost:8000/api/attachments/ \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/fakepdf.pdf" | python -m json.tool
```
Expected: 400, `{"file": ["File type 'text/plain' is not allowed. Allowed types: [...]"]}`.
This confirms MIME detection is based on file content, not the extension.

**No file field**:
```bash
curl -s -X POST http://localhost:8000/api/attachments/ \
  -H "Authorization: Bearer $TOKEN" \
  -F "content_type=deal" \
  -F "object_id=1" | python -m json.tool
```
Expected: 400, `{"file": ["No file was submitted."]}`.

**content_type without object_id**:
```bash
curl -s -X POST http://localhost:8000/api/attachments/ \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/doc.pdf" \
  -F "content_type=deal" | python -m json.tool
```
Expected: 400, pair validation error.

---

### 11. Confirm no PATCH/PUT endpoint for attachments

```bash
ATTACHMENT_ID=1

curl -s -X PATCH http://localhost:8000/api/attachments/$ATTACHMENT_ID/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filename": "renamed.pdf"}' | python -m json.tool
```
Expected: 405 Method Not Allowed.

---

### 12. Soft delete an attachment

```bash
curl -s -X DELETE http://localhost:8000/api/attachments/$ATTACHMENT_ID/ \
  -H "Authorization: Bearer $TOKEN"
# Expected: 204 No Content

curl -s http://localhost:8000/api/attachments/$ATTACHMENT_ID/ \
  -H "Authorization: Bearer $TOKEN"
# Expected: 404 Not Found

# Verify file STILL EXISTS on disk at MEDIA_ROOT/attachments/...
# Verify DB row: Attachment.objects.get(pk=$ATTACHMENT_ID).is_deleted == True
```

---

### 13. Soft-deleted Lead — notes and attachments survive

```bash
# Soft-delete the Lead ($LEAD_ID) via the Leads API
curl -s -X DELETE http://localhost:8000/api/leads/$LEAD_ID/ \
  -H "Authorization: Bearer $TOKEN"

# Re-query notes that were linked to that lead — they must still be accessible
curl -s http://localhost:8000/api/notes/$NOTE_ID/ \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool
```

**Expected**: Note is still retrievable. `content_type="lead"`, `object_id=<LEAD_ID>` are preserved on the row. The note is NOT auto-deleted.

---

### 14. owner becomes null when user is deleted

```bash
# Via Django shell — simulate user deletion
# from django.contrib.auth import get_user_model
# User = get_user_model()
# User.objects.filter(pk=<owner_pk>).delete()
#
# Then retrieve the note:
curl -s http://localhost:8000/api/notes/$NOTE_ID/ \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool
```

**Expected**: Note is still accessible. `owner=null` in the response.

---

### 15. Unauthenticated requests

```bash
curl -s http://localhost:8000/api/notes/ | python -m json.tool
curl -s http://localhost:8000/api/attachments/ | python -m json.tool
```

**Expected**: Both return 401 `{"detail": "Authentication credentials were not provided."}`.

---

## Frontend Validation Flows

### Flow 1 — Notes widget on a Lead detail page

1. Navigate to any Lead detail page.
2. Confirm a "Notes" section is visible with a text input area and "Add Note" button.
3. If notes exist for this Lead, confirm they appear sorted `created_at` DESC with owner name and relative timestamp.
4. If no notes exist, confirm an empty-state message ("No notes yet") is shown.
5. Type a note body and click "Add Note" — confirm the note appears immediately at the top of the feed without a full page reload.
6. Click "Edit" on a note, change the body, save — confirm the updated body replaces the old text in-place without page reload.
7. Click "Delete" on a note, confirm the deletion prompt, confirm the note disappears from the feed without page reload.

### Flow 2 — Attachments widget on a Deal detail page

1. Navigate to any Deal detail page.
2. Confirm an "Attachments" section is visible with an "Upload File" button.
3. If attachments exist for this Deal, confirm they appear with filename, file size (formatted), MIME type badge, uploader, and upload date.
4. If no attachments exist, confirm an empty-state message ("No attachments yet") is shown.
5. Click "Upload File," select a valid PDF (< 10 MB) — confirm the attachment appears in the widget immediately after upload without page reload.
6. Click a filename — confirm the file downloads.
7. Click "Delete" on an attachment, confirm deletion prompt — confirm the attachment disappears from the widget without page reload.

### Flow 3 — Widgets on Contact and Company detail pages

Repeat Flow 1 (Notes) and Flow 2 (Attachments) for a Contact and a Company. Each widget should show only records linked to that specific record.

### Flow 4 — File upload validation in the UI

1. Attempt to upload a file > 10 MB via the Attachments widget.
2. Confirm a user-readable error message appears ("File exceeds 10 MB limit") before or immediately after the upload attempt.
3. Attempt to upload a `.exe` file.
4. Confirm a user-readable error message lists allowed file types and the upload is rejected.

### Flow 5 — Note validation in the UI

1. Click "Add Note" with the body text area empty.
2. Confirm an inline validation error appears ("Note body cannot be empty") and no note is created.
3. Click "Edit" on a note, clear the body, attempt to save.
4. Confirm an inline validation error appears and the original note is not modified.

---

## Quick Checks (Definition of Done)

- [ ] `python manage.py migrate` completes cleanly with `apps.notes` in `INSTALLED_APPS`
- [ ] `python-magic` (Linux/macOS) or `python-magic-bin` (Windows) is installed and importable
- [ ] `MEDIA_ROOT` directory is writable; uploaded files appear at `attachments/<year>/<month>/<filename>`
- [ ] All 15 backend validation scenarios above pass via curl
- [ ] `pytest backend/apps/notes/` passes (models, serializers, views)
- [ ] MIME type detection test passes: a `.pdf`-renamed text file is rejected; a valid PDF is accepted
- [ ] File size limit test passes: a file > 10 MB is rejected with a descriptive error
- [ ] No PATCH/PUT endpoint exists for attachments (405 confirmed)
- [ ] Soft-deleted notes/attachments return 404; DB rows remain with `is_deleted=True`
- [ ] Physical files remain on disk after soft delete of an Attachment
- [ ] Notes and Attachments for a CRM record are NOT deleted when that record is soft-deleted
- [ ] `owner` becomes `null` (not an error) when the owning user is deleted
- [ ] `tsc --noEmit` passes in frontend
- [ ] `npm run lint` passes in frontend
- [ ] OpenAPI schema regenerated: `python manage.py spectacular --file docs/openapi.yaml`
- [ ] Notes feed widget and Attachments widget render correctly on Lead, Contact, Company, and Deal detail pages
- [ ] Inline add/edit/delete for Notes and upload/delete for Attachments work without full page reloads
