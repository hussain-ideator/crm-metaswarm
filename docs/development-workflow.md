# Development Workflow: How This App Was Built with Metaswarm

This document explains how the metaswarm plugin, beads issue tracker, and
reference docs work together as the development system for this CRM.

---

## 1. docs/reference/* — Source of Truth

Every CRM module has a dedicated folder under `docs/reference/` containing
structured documents written before any code is touched:

| File              | Purpose                                                             |
|-------------------|---------------------------------------------------------------------|
| `spec.md`         | Feature requirements — user stories, acceptance criteria, FR-NNN rules |
| `plan.md`         | Implementation plan — phases, work units, sequencing               |
| `data-model.md`   | Entity fields, FK relationships, index definitions                  |
| `tasks.md`        | Granular task breakdown for the module                              |
| `research.md`     | Background investigation before building                           |
| `quickstart.md`   | Developer quick-start for the module                               |

When implementing a module (e.g. Companies), `spec.md` defines every
functional requirement (FR-001 through FR-018), every field, every
validation rule, and every edge case. Code is written to satisfy those
requirements — nothing is invented from scratch during implementation.

---

## 2. The Workflow: bd + Metaswarm Skills

Each module is tracked as a beads issue. The full loop looks like this:

```
bd ready                              # find the next unblocked issue
bd show <id>                          # read title / description / acceptance criteria
bd update <id> --claim                # mark in_progress

/metaswarm:start <id>
  └─ auto-invokes /metaswarm:prime <id>
       └─ bd prime loads relevant facts into context
            (architecture rules, gotchas, patterns, decisions)

[implement code against the spec in docs/reference/<module>/]

bd close <id> --reason="..."
git push
```

### What bd prime actually does

`bd prime` queries the beads knowledge base and injects categorised facts
into the conversation before a single line of code is written:

- **MUST FOLLOW** — non-negotiable rules (e.g. "NEVER filter(is_deleted=False),
  always use .objects.alive()")
- **GOTCHAS** — known pitfalls from prior sessions
- **PATTERNS** — established conventions in this codebase
- **DECISIONS** — architectural choices already locked in

This is how rules like "cross-app imports only inside function bodies" and
"use apps.get_model() inside get_fields() for cross-app FK querysets" were
enforced without having to re-derive them each session.

---

## 3. CLAUDE.md — Always-Loaded Guardrail

`CLAUDE.md` at the repo root is injected into every Claude Code conversation
automatically. It holds:

- **Locked ADRs** (ADR-001 through ADR-007) — architectural decisions that
  cannot be silently re-litigated (Next.js App Router, adrf async views,
  JWT auth, monorepo layout, lead field set, lead status enum, default pipeline)
- **App architecture rules** — dependency direction (`core ← accounts ←
  companies ← contacts ← leads ← deals ← activities`), string FK references,
  no module-level cross-app imports, business logic in services.py
- **API conventions** — plural resource nouns, pagination shape
  `{count, next, previous, results}`, drf-spectacular schema requirement,
  `?q=` search on every list endpoint
- **Definition of Done** — checklist that must pass before any issue is closed

This is what enforced `'companies.Company'` as a string FK (not a direct
model import) and why every list endpoint ships with search, filtering,
ordering, and pagination from day one.

---

## 4. Modules Built So Far

| Issue                  | Module    | Commit    | Status |
|------------------------|-----------|-----------|--------|
| crm-metaswarm-fnf      | Companies | `ba34942` | Closed |
| crm-metaswarm-ju5      | Contacts  | `1bb0a26` | Closed |

Reference docs exist for Leads, Deals, Activities, and Notes — those modules
are next in the roadmap.

---

## 5. External Tools (Optional)

`.metaswarm/external-tools.yaml` enables cross-model adversarial review via
OpenAI Codex CLI and Google Gemini CLI. When configured:

- A different model reviews every implementation (writer never reviews its own output)
- Escalation chain: Cheapest tool → Other tool → Claude → Alert user
- Budget circuit breakers enforced per task and per session

Neither external CLI is installed in the current environment, so metaswarm
runs in pure Claude mode. Install and authenticate either CLI to enable
cross-model review.

---

## 6. Key Commands

```bash
bd ready                        # find available work
bd show <id>                    # view issue details
bd update <id> --claim          # claim an issue
bd close <id> --reason="..."    # mark complete
bd prime                        # load knowledge base into context
bd remember "insight"           # persist a fact across sessions
bd memories <keyword>           # search persisted knowledge
```

Slash skills (via Claude Code):

```
/metaswarm:start <id>           # begin work on an issue
/metaswarm:prime <id>           # load context for an issue
/external-tools-health          # check Codex / Gemini CLI status
```
