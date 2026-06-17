# Mission

## What we're building

A self-hosted CRM platform inspired by Zoho CRM, focused on small sales teams
that want to own their data and customize without per-seat SaaS fees.

## Who it's for

> TODO: define your primary persona. For a learning project, write
> "myself + future employer demo". For a real product, write the actual
> ICP (industry, team size, pain point).

## Why it's worth building

- Zoho CRM and HubSpot are excellent but expensive at scale, opinionated, and
  hard to deeply customize.
- A clean Django + Next.js implementation is a strong portfolio piece and a
  realistic foundation for a niche vertical CRM (real estate, edtech, etc.).

## What it is NOT (non-goals)

- Not a marketing automation platform.
- Not a help desk / ticketing tool.
- Not a replacement for a full ERP.
- Not multi-tenant SaaS in v1 (single-org self-hosted).

## Success criteria (MVP)

- A sales rep can capture a lead, qualify it, convert to deal, move it
  through pipeline stages, log calls/meetings/tasks, and close the deal —
  end to end, in under 60 seconds per common action.
- Page loads under 200ms for list views with 10k records.
- 80%+ unit test coverage on backend; e2e happy-path tests for each module.
