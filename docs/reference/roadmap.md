# Roadmap

Phased delivery. Each phase ends with a demoable, tested increment.

## Phase 0 — Foundations (Week 1)

- Repo scaffold, CI, linting, formatting
- Django + adrf project, MySQL connection, base settings
- Next.js scaffold with shadcn/ui, Tailwind, base layout
- User model, JWT auth (login, refresh, logout)
- Health check + OpenAPI schema endpoint
- Docker compose for local services (optional)

## Phase 1 — Core CRM MVP (Weeks 2–5)

Order of modules — each is a SpecKit cycle.

1. **Accounts (Companies)** — CRUD, list with search/filter, detail view
2. **Contacts (People)** — CRUD, link to Account
3. **Leads** — CRUD, lead source, status, convert-to-deal flow
4. **Deals (Opportunities)** — CRUD, pipeline + stage, amount, close date
5. **Activities** — Tasks, Calls, Meetings; relate to any of the above
6. **Notes & Attachments** — generic, attachable to any record
7. **Global search** — across all modules
8. **User profile + settings** page

## Phase 2 — Workflow & polish (Weeks 6–8)

- Kanban view for Deals (drag-and-drop between stages)
- Custom fields per module
- Roles & permissions (Admin, Manager, Sales Rep)
- Audit log (who changed what, when)
- Bulk actions on list views
- CSV import/export per module

## Phase 3 — Power features (Weeks 9–12)

- Email integration (IMAP read, SMTP send, log to record)
- Workflow automation (when X happens, do Y)
- Reports (configurable: pipeline value, win rate, activity volume)
- Dashboards (drag-and-drop widgets)
- Webhooks (outbound on key events)

## Phase 4 — Productionization

- Multi-tenant support (optional, only if needed)
- Cloud deployment (the user mentioned this comes later)
- Backup/restore tooling
- Performance: index review, query profiling, caching
- Mobile-responsive pass

## Explicitly deferred

- Mobile native apps
- AI features (lead scoring, email drafting)
- Marketplace / third-party integrations beyond email
