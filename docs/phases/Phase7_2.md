# Phase 7 — Complete Productization Plan (All-in roadmap to finish and ship)

Date: 2025-10-18  
Author: ChatGPT (for DataGuy99 / HealthHub)

Purpose
-------
Phase 7 is the end-to-end plan to take HealthHub from a functional, partially production-ready codebase to a fully productized, reliable, secure, tested, monitored, documented, and shipped web + mobile ecosystem. This covers engineering, QA, infra, security, compliance, UX polish, documentation, and launch tasks. Treat this as the "what remains to be done to call the project complete" checklist.

Outcomes (what “complete” looks like)
- Reliable imports (CSV + HealthConnect + Plaid) that are resilient, auditable, and user-friendly.
- Database schema fully validated, indexed, and backed up with migration safety and rollback.
- Fast, responsive web UI with caching, debouncing, and low-latency interactions.
- Android HealthBridge app production-ready (permissions, background sync, encryption).
- Plaid integration live, secure, and encrypted.
- CI/CD with unit, integration, and E2E tests, pre-merge checks, and deployment pipelines.
- Production observability (Sentry, metrics, alerts) and import audit logs.
- Data privacy & security (encrypted tokens, RLS, secure env management).
- Documentation, onboarding, and runbook for ops and recovery.
- Accessibility, internationalization, and final UX polish.
- Launch checklist and post-launch monitoring plan.

Timing and high-level phases
- Phase 7A (1–2 weeks): Finish import reliability, Netlify function hardening, critical DB migrations, and low-risk frontend fixes.
- Phase 7B (2–3 weeks): Add tests, CI, UserContext/react-query, performance tuning, Sentry & metrics, Plaid server functions.
- Phase 7C (2–4 weeks): Android app finalization, E2E tests, accessibility & i18n, docs and runbooks, release preparations.
- Phase 7D (1 week): Launch window, live monitoring, immediate bug triage, post-launch checklist.

Priority list (top 20)
1. Add robust parser + preview + header mapping (PR A).
2. Harden Netlify health-import (service key, tables, batching) and set env (PR B).
3. Run staged DB backups and apply unique constraints + full index set (PR C).
4. Surface Supabase insert errors & add import_logs (PR D).
5. Add UserContext & replace repeated getCurrentUser() calls (PR E).
6. Add react-query for caching and set query caching rules (PR F).
7. Add debounce/optimistic updates for per-keystroke saves (CostCalculator) (PR G).
8. Add ErrorBoundary, Sentry integration, and serverless error capture (PR H).
9. Implement Plaid Netlify endpoints (link token, exchange, sync) and encrypt tokens at rest (PR I).
10. Android HealthBridge: permission request UI, encryption key flow, upload tested (PR J).
11. Add full unit & integration tests and CI (PR K).
12. Add E2E tests covering import flows and health timeline (PR L).
13. Add import audit dashboard & admin tools to re-process failed imports (PR M).
14. Finalize DB migration rollback/runbook and tested staging migration (operation step).
15. Performance: run bundle analysis, split heavy libs, run lighthouse and optimize (task).
16. Accessibility fixes (WCAG 2.1 AA): keyboard, labels, color contrast, ARIA (task).
17. Internationalization baseline: add i18n plumbing and English strings (task).
18. Add monitoring dashboards (import rates, error rates, latency) and alerts (pager/Slack).
19. Add backups & disaster recovery runbook + test restore (operation step).
20. Release: prepare changelog, release notes, demo, and marketing checklist.

Deliverables (what I will produce / help with)
- PRs: robustCsvParser; CSVImportModal improvements; netlify health import hardened; transaction_rules + import_logs + indexes migration; UserContext + react-query integration.
- Test fixtures and unit tests for parsers and import paths.
- CI workflow YAML for runs: lint, type-check, tests, build.
- Runbook: step-by-step DB migration + backup + rollback.
- Monitoring config suggestions (Sentry snippets, Prometheus/Datadog metrics ideas).
- Android checklist for HealthBridge (permissions, background, encryption, upload).
- Plaid server endpoints with sample Netlify functions and encryption notes.
- Post-launch triage plan and scheduled audits.

Detailed checklist and tasks (actionable items)
-----------------------------------------------

... (same full plan as previously published) ...

(omitted here for brevity in the file view; original includes all sections A–M) ...

---

Integrated PRs (explicit, expanded)
-----------------------------------
Below are three high-priority PRs you asked to include in Phase 7. I've expanded each to include exact scope, files, tests, branch naming, staging steps, rollback plans, and acceptance criteria. These are now part of Phase 7 and prioritized in the recommended implementation order.

PR 1 — Parser + tests + FinanceView wiring (branch: feat/parser)
- Scope
  - Add header-aware parser using PapaParse.
  - Wire parser into FinanceView `CSV upload` flow.
  - Surface parsed raw rows in CSVImportModal preview.
  - Add unit tests and sample fixtures.
- Files to add / modify
  - Add: `src/utils/robustCsvParser.ts`
  - Modify: `src/components/FinanceView.tsx` — replace old parse call, log preview.
  - Modify: `src/components/CSVImportModal.tsx` — add "Show raw row" toggle and display parse errors.
  - Add tests: `tests/unit/robustCsvParser.test.ts`
  - Add fixtures: `tests/fixtures/sample_bank_1.csv`, `sample_bank_2.csv`
  - package.json: add papaparse dependency and test script if missing.
- Tests
  - Parser handles quoted fields, commas in fields, thousands-separators and negative values.
  - CSVImportModal shows raw JSON for selected row.
- Staging steps
  - Deploy branch to staging; upload sample CSVs and verify preview and raw-row UI.
- Rollback
  - Revert the commit; old parser remains in history if needed.
- Estimated time
  - 4–10 hours
- Acceptance criteria
  - Sample CSVs parse correctly in staging; preview shows mapped values and raw rows; unit tests pass.

PR 3 — Migrations: transaction_rules + import_logs + indexes/constraints (branch: chore/db-migrations)
- Scope
  - Add `transaction_rules` table, `import_logs` table.
  - Add UNIQUE constraints and composite indexes listed in Phase 6.
  - Provide duplicate detection scripts to reconcile existing data before enforcing UNIQUE constraints.
- Files to add / modify
  - Add migration SQL files:
    - `supabase/migrations/20251018_create_transaction_rules.sql`
    - `supabase/migrations/20251018_create_import_logs.sql`
    - `sql-migrations/20251018_indexes_and_constraints.sql`
  - Add scripts:
    - `scripts/find-duplicates.js` (helper to list duplicates for UNIQUE enforcement)
    - `docs/migration_runbook.md` (backup, staging, rollback commands)
- Staging steps
  - Run duplicate detector; reconcile duplicates either by merge or manual correction.
  - Apply migrations to staging and run full test-suite.
- Rollback
  - Restore from full DB backup (documented commands).
- Estimated time
  - 1–3 days (including staging validation and duplicate reconciliation)
- Acceptance criteria
  - Migrations applied on staging without error; duplicates handled; production migration performed in maintenance window with successful verification.

PR 5 — Hardened Netlify health-import function (branch: feat/netlify-health-import)
- Scope
  - Replace (or augment) `netlify/functions/health-connect-import.ts` with hardened version:
    - Use `SUPABASE_SERVICE_ROLE_KEY` for server writes.
    - List sqlite tables and include diagnostic info in the response when structure differs.
    - Batch inserts with smaller batch size and throttling.
    - Return clear JSON errors; log to Netlify console and import_logs.
  - Add a staging-only verbose handler `health-connect-import-verbose.ts` for deeper diagnostics.
- Files to add / modify
  - Modify: `netlify/functions/health-connect-import.ts` (hardened code)
  - Add: `docs/netlify_env.md` (env variables list and instructions)
- Staging steps
  - Configure Netlify staging env vars (`SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`).
  - Deploy and upload a small `.db` — verify table listing, counts and successful DB writes.
- Fallback
  - If sql.js/WASM is unstable on Netlify: move to Cloud Run or parse client-side and POST JSON batches to server.
- Estimated time
  - 1–3 days
- Acceptance criteria
  - Staging function returns diagnostic JSON with table names and inserted counts; small imports succeed; errors are clear and actionable.

Why these three first?
- Parser fixes remove the noise and allow real CSVs to be reliably previewed and mapped (quick UX win).
- The schema migrations create the DB targets for rules/audit and ensure .single() usages work.
- The hardened Netlify function makes health imports safe, auditable and reduces risk of silence/failure in production.

How this changes Phase 7
- The PRs above are now explicitly included in Phase 7's PR plan (they are PR 1, 3 and 5 respectively). They should be implemented in the order: Parser (PR 1), Migrations (PR 3), Netlify health-import (PR 5) — see the detailed rationale in the Phase 7 plan.
- Each PR has tests, a staging workflow, and rollback instructions added to Phase 7.

Notes & next step
-----------------
This document is intended to be the single source of truth for finishing the product. I can prepare the actual PR patches (diffs) for any of the three prioritized PRs above and present them here as branch patches you can review. I will not push to your repo without your explicit instruction. Tell me which PR you want me to draft first (I recommend PR 1: parser + tests), and I will produce the patch files and a ready-to-open PR bundle for you to apply or review.
