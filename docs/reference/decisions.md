# Architecture Decisions

One short entry per non-obvious decision. Newest at the top.

Format: `ADR-NNN — Title — Date — Status (Proposed | Accepted | Superseded by ADR-XXX)`

---

## ADR-011 — SpecKit spec artifacts live under `agent-os/specs/` — 2026-06-14 — Accepted

**Context.** SpecKit (`github/spec-kit`) is the locked workflow framework
(tech-stack.md). It was bootstrapped at pinned release **v0.10.2** via
`uv tool install specify-cli --from git+...@v0.10.2`, then
`specify init --here --integration claude --script ps`. (The brief's
`--ai claude` flag predates v0.10.x; the current flag is `--integration`, and
v0.10.x ships its commands as hyphenated Claude Code skills — `/speckit-specify`
etc. — under `.claude/skills/`, not dot-namespaced `/speckit.*`.)

`init` scaffolds CLI-managed plumbing under `.specify/` (templates, PowerShell
scripts, workflow, constitution at `.specify/memory/constitution.md`) and a
4-line stub `CLAUDE.md` at repo root. It does **not** create a top-level
`specs/` at init time. However, `create-new-feature.ps1` hardcodes the spec
destination as `$repoRoot/specs` — so the first `/speckit-specify` run would
create a top-level `specs/` directory. That collides with [[ADR-010]]
("`agent-os/` is the canonical source of truth") and with the pre-existing,
intentionally-empty `agent-os/specs/` (held by `.gitkeep`).

**Decision.** Authored spec artifacts (one feature directory each, holding
`spec.md`, `plan.md`, `tasks.md`, `research.md`, `data-model.md`, `contracts/`,
etc.) live under **`agent-os/specs/`**, consistent with [[ADR-010]]. SpecKit's
own `.specify/` infrastructure stays where the CLI puts it — it is tool
plumbing, not an authored artifact, and is not relocated.

This is enforced by a **one-line patch** to
`.specify/scripts/powershell/create-new-feature.ps1`: `$specsDir` is set to
`Join-Path $repoRoot 'agent-os/specs'`. That single change propagates
everywhere — `common.ps1` and the `setup-plan`/`setup-tasks`/`check-prerequisites`
scripts all resolve the feature path from `.specify/feature.json` /
`$env:SPECIFY_FEATURE_DIRECTORY` persisted by `create-new-feature.ps1`, so no
other script hardcodes `specs/`.

**Consequences.** `create-new-feature.ps1` is now a locally-modified
CLI-managed file: a future `specify` upgrade that regenerates it will revert
the patch and silently restore top-level `specs/`. The patched line carries an
inline comment flagging this, and the re-apply step is documented in
`.specify/README.md`. A follow-up may replace the patch with a supported
config mechanism if SpecKit adds one. `.claude/skills/speckit-*` are committed
as shared infrastructure; per the `init` security notice, `.gitignore` now
ignores known `.claude/` credential/state paths while keeping `skills/`
tracked. The root `CLAUDE.md` stub is committed as-is (no project content yet).

---

## ADR-010 — Agent OS directory layout: `agent-os/` (no dot prefix) — 2026-06-14 — Accepted

**Context.** Two parallel directories existed in the repo: `.agent-os/`
(dot-prefixed, holding all real content — product docs, standards, README,
`specs/.gitkeep`) and `agent-os/` (dot-less, holding only a stub
`standards/index.yml` created by the Agent OS install). The dot-prefixed tree
was a tarball-era convention from before Agent OS was installed in this repo;
the dot-less tree is what Agent OS commands actually read and write.

A read-only audit of `.claude/commands/agent-os/` confirmed every command —
`discover-standards`, `inject-standards`, `index-standards`, `plan-product`,
`shape-spec` — references `agent-os/` without the leading dot. No command
references `.agent-os/`. Leaving content under `.agent-os/` made it invisible
to the entire command suite, and `agent-os/standards/index.yml` indexed zero
standards.

**Decision.** Canonical path is `agent-os/` (no leading dot), matching the
official Agent OS install. All product docs (`mission.md`, `roadmap.md`,
`tech-stack.md`, `decisions.md`), standards (`best-practices.md`,
`code-style.md`), `specs/`, and `README.md` move from `.agent-os/` to
`agent-os/` via `git mv` (preserving history). `.agent-os/` is removed
entirely — not kept as a symlink, not gitignored as a local-only mirror.
One path, one source of truth.

Twelve files that hardcoded `.agent-os/` paths are updated in the same
changeset: `README.md`, `scaffold.sh`, `.github/pull_request_template.md`,
`.specify/README.md`, `frontend/{README.md,.gitignore}`,
`docs/{README,setup,wireframes/README,wireframes/_GAPS}.md`,
`backend/apps/core/models.py`, and `agent-os/standards/best-practices.md`.
`.gitignore`'s `.agent-os.backup/` pattern is left intact — distinct concern
(backup directory ignore), not a path reference.

`docs/erd.md` and `docs/api-contract.md`, currently outside both trees and not
referenced by any Agent OS command, stay in `docs/`. They are project
documentation, not Agent OS artifacts; this matches the existing convention
in `best-practices.md` (Definition of Done references `docs/erd.md`).

**Consequences.** Agent OS commands work without per-invocation path
overrides. `agent-os/standards/index.yml` is regenerated to index the moved
standards (was an empty stub). `git log --follow` continues to work across
the renames. Future Agent OS upgrades will not fight the layout. Any new
tooling or scripts must reference `agent-os/` without the dot.

---

## ADR-009 — Adopt Next.js 16 over Next.js 15 — 2026-06-14 — Accepted (supersedes ADR-001)

**Context.** `create-next-app@latest` installed Next.js 16.2.9 + React 19.2.4
during the frontend scaffold on 2026-06-14. ADR-001 (dated 2026-06-12) pinned
Next.js 15. Next 16 shipped 2025-10-21 — the pin was already eight months stale
when ADR-001 was written, carried over from a template without re-checking. The
"docs win, stop and ask" rule fired correctly during the scaffold; this ADR is
the resolution.

The substance of ADR-001 — "App Router and React Server Components where they
fit (list views with server-side filters), client components for interactive
forms" — is preserved verbatim in Next 16. Only the version label changes.
Re-scaffolding on Next 15 to honour the literal text would mean paying the same
migration cost in a few months when Next 15's LTS expires, on top of having
written N15-shaped code in the interim. Going on 16 from day 1 — before any
code is written against 15 conventions — has the lowest cost.

**Decision.** Adopt Next.js 16. ADR-001 is superseded. New code follows Next 16
conventions from day 1:
- `params` and `searchParams` are Promises; `await` them in pages, layouts,
  and route handlers.
- `middleware.ts` is now `proxy.ts` (Node runtime only, no edge runtime).
- Turbopack is the default bundler; no `--turbopack` flag needed.
- `next lint` is deprecated; lint scripts call `eslint` directly.

**Consequences.** `tech-stack.md` updated in the same commit batch as the
frontend scaffold. ADR-001's status line points to this ADR (was incorrectly
pointing to ADR-008 in commit d6651f4 — fixed here). No migration debt: the
scaffold is fresh, so Next 16 conventions are the only conventions in the
codebase. Auth work (next session) will use `proxy.ts`, not `middleware.ts`.

## ADR-008 — `tests/` directory per app over `tests.py` — 2026-06-14 — Accepted

**Context.** Django's `startapp` scaffolds a single `tests.py` per app, which the
freshly scaffolded `core` and `accounts` apps inherited. The doc reconciliation
just completed (ADR-005/006/007 against `docs/erd.md` and
`docs/wireframes/_GAPS.md`) settled a body of Lead/Deal decisions whose
behaviour — status enum collapse, field denormalization, seed pipeline flags —
will each need focused test coverage. A single-file layout per app makes that
coverage unwieldy: tests for models, serializers, views, and seed data all pile
into one module, growing past the point where it reads cleanly or merges without
conflict.

**Decision.** Replace each app's `tests.py` with a `tests/` package (containing
`__init__.py`) holding one module per concern, e.g. `test_models.py`,
`test_serializers.py`, `test_views.py`, `test_seed.py`. The directory convention
applies to every app — `core`, `accounts`, and all apps added later.

**Consequences.** Test files stay small and topical; coverage for a given
decision (e.g. [[ADR-006]] status enum, [[ADR-007]] seed stages) lands in an
obvious module. Django/pytest discover the package automatically, so no config
change is needed beyond deleting the stub `tests.py`. Cost: a few more files and
the discipline of placing tests in the right module; negligible at project size.

---

## ADR-007 — Deal stage seed data — 2026-06-14 — Accepted

**Context.** `docs/erd.md` defines `Pipeline` → `Stage` but leaves the default
pipeline's stage rows, probabilities, and `is_won`/`is_lost` flags unspecified
(see `docs/wireframes/_GAPS.md` §B). Zoho's default stage list — Qualification,
Identify Decision Makers, Needs Analysis, Proposal/Price Quote,
Negotiation/Review, Closed Won, Closed Lost — was the reference.

**Decision.** Seed one default pipeline `Sales Pipeline` (`is_default=true`) with
six stages:

| order | Stage | probability | is_won | is_lost |
|-------|-------|-------------|--------|---------|
| 1 | Qualification | 10 | false | false |
| 2 | Needs Analysis | 25 | false | false |
| 3 | Proposal | 50 | false | false |
| 4 | Negotiation | 75 | false | false |
| 5 | Closed Won | 100 | true | false |
| 6 | Closed Lost | 0 | false | true |

Zoho's "Identify Decision Makers" stage is dropped: in practice it overlaps with
Needs Analysis (both are discovery work before a proposal exists), and a rep
moving a deal forward does not need to distinguish "understanding the need" from
"finding who signs" as separate pipeline columns. Stage names are simplified
(Proposal, Negotiation) rather than carrying Zoho's slash variants.

**Consequences.** A single, opinionated default pipeline ships in MVP seed data.
Probabilities feed forecasting later. Additional stages or extra pipelines can be
added without migration (data rows, not schema). Closed Won/Lost are ordinary
stages flagged with `is_won`/`is_lost`, so the Kanban "move to won/lost" flow
(§J, Phase 2) keys off those flags rather than hard-coded names.

---

## ADR-006 — Lead status enum — 2026-06-14 — Accepted

**Context.** The ERD `Lead.status` enum (`new/contacted/qualified/lost/converted`)
did not match the Zoho process strip seen in wireframes — Attempted to Contact,
Contact in Future, Contacted, Junk Lead, Lost Lead (see
`docs/wireframes/_GAPS.md` §B). The mismatch had to be reconciled before building
Lead status, since it drives filters, conversion, and any future Kanban flow.

**Decision.** Final enum: `new`, `contacted`, `qualified`, `unqualified`,
`converted`. Zoho's five-way split is collapsed: "Attempted to Contact" and
"Contact in Future" both fold into `contacted` (an attempt was made), while
"Junk Lead" and "Lost Lead" both fold into `unqualified` (not a fit). This
replaces the ERD's `lost` value with `unqualified`, which reads more naturally
for the not-a-fit terminal state.

In the MVP a rep only needs to know, for any lead: not yet reached (`new`),
reached (`contacted`), good fit (`qualified`), not a fit (`unqualified`), or won
(`converted`). Finer-grained states (e.g. distinguishing a future-callback from a
failed attempt) can be added later as enum values without breaking existing data.

**Consequences.** Simpler filters and status picker; less rep decision fatigue.
The `unqualified`/`converted` states are terminal. Adding states later is
additive (new enum members); any reporting that buckets by status should map on
the five canonical values rather than assume the set is frozen.

---

## ADR-005 — Lead model field set — 2026-06-14 — Accepted

**Context.** Wireframes showed Lead create/detail fields absent from the ERD —
Mobile, Title, Fax, Website, Industry, No. of Employees, Salutation (see
`docs/wireframes/_GAPS.md` §A). Each needed an add / move-to-related-entity /
drop decision. Website, Industry, and No. of Employees already exist on the
`Company` entity, raising the question of whether they should live on `Lead` at
all.

**Decision.** Final `Lead` field set:

- Identity: `salutation`, `first_name`, `last_name`, `title`
- Contact: `email`, `phone`, `mobile`
- Company (raw text, pre-account): `company_name`, `website`, `industry`,
  `no_of_employees`
- CRM: `source_fk` → LeadSource, `status` (see [[ADR-006]] — Lead status enum),
  `owner_fk` → User, `converted_at`, `converted_deal_fk` → Deal
- Audit (via `TimestampedModel`): `is_deleted`, `created_at`, `updated_at`,
  `created_by_fk`

`website`, `industry`, and `no_of_employees` are kept on `Lead` — not delegated
to `Company` — because a Lead exists *before* any `Company`/Account record is
created. These are raw, unverified prospect details captured at intake;
duplicating them onto the `Company` happens at conversion. Mirroring
`company_name`, they are denormalized text on the Lead by design.

`fax` is dropped: it is effectively dead in B2B sales workflows and carries no
MVP value. It can be re-added as a nullable field later if a customer asks.

`salutation` is a stored enum: `Mr.`, `Ms.`, `Mrs.`, `Dr.`, `Mx.`, `None`
(rather than free text), keeping it normalized for display composites and
consistent across Lead and Contact.

**Consequences.** Leads capture full prospect context without a premature Company
record. Some fields are duplicated onto Company at conversion — an accepted
denormalization. The `salutation` enum is shared with Contact (§A) for a uniform
name display. Dropping `fax` is reversible (additive nullable column).

---

## ADR-004 — Monorepo for backend + frontend — 2026-06-12 — Accepted

**Context.** Solo developer building backend (Django) and frontend (Next.js).

**Decision.** Single repository with `backend/` and `frontend/` siblings.

**Consequences.** Atomic PRs across stack, single CI config, simpler local
setup. Cost: slightly larger checkouts; some CI duplication. Acceptable for
project size.

---

## ADR-003 — JWT (simplejwt) over session auth — 2026-06-12 — Accepted

**Context.** Need to authenticate Next.js client against Django API. Cookie
sessions complicate CSRF handling across origins; we want stateless API.

**Decision.** `djangorestframework-simplejwt` with access (short-lived) and
refresh (longer-lived) tokens. Refresh stored in httpOnly cookie; access in
memory on the client.

**Consequences.** Stateless API, easier scaling, easier mobile/3rd-party
later. Cost: must implement refresh rotation and revocation list.

---

## ADR-002 — adrf over plain DRF — 2026-06-12 — Accepted

**Context.** CRM has potentially long-running endpoints (bulk import, email
sync). Async views allow these without blocking workers.

**Decision.** Use `adrf` for all API views. Sync views are still acceptable
where async offers no benefit, but new endpoints default to async.

**Consequences.** Slightly less mature ecosystem than DRF. Mitigated by
adrf's compatibility with DRF serializers and filters.

---

## ADR-001 — Next.js 15 (App Router) over plain React — 2026-06-12 — Superseded by ADR-009

**Context.** CRM is heavy on dashboards (good SSR fit), needs route-level
auth middleware, and may eventually have public marketing pages.

**Decision.** Next.js 15 with App Router and React Server Components where
they fit (list views with server-side filters). Client components for
interactive forms.

**Consequences.** Steeper learning curve than plain React + Vite. Worth it
for SSR, middleware, and unified deploy story.
