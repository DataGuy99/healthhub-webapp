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

A — Import reliability & UX (CSV, Plaid, HealthConnect)
- A1. Parser: Add `src/utils/robustCsvParser.ts` (PapaParse) and tests (unit).
- A2. CSV UI: CSVImportModal — add header mapping UI, "Show raw row", dry-run, and explicit mapping save.
- A3. Batch import: implement chunking with transactional error handling and partial roll-forward handling (log failures).
- A4. Import audit: create `import_logs` table and wire front-end + server to log attempts and failures.
- A5. Reprocess tooling: Admin view to re-run failed import batches and inspect row-level errors.
- A6. Plaid: implement Netlify functions:
  - `plaid-create-link-token` (server)
  - `plaid-exchange-token` (server): exchange public_token → access_token; store encrypted.
  - `plaid-sync-transactions` (periodic or manual).
- A7. HealthConnect: Harden function (service role), list zip entries, small batches, & return breakdown. Add fallback client-side parse if serverless WASM fails.

B — Database correctness, performance, and safety
- B1. Run pre-migration backups (pg_dump or Supabase snapshot). Document filenames and retention.
- B2. Migrations to apply (staging first):
  - Unique constraints for single-row tables (grocery_budgets, protein_targets, misc_shop_budgets, user_settings).
  - All composite indexes listed in Phase6_FULL.
  - transaction_rules and import_logs tables.
- B3. Data cleanup: detect and fix duplicates that prevent UNIQUE constraint addition. Script to find duplicates and produce reconciliation suggestions (CSV for manual review).
- B4. Validate queries: EXPLAIN ANALYZE for heavy queries; iterate on index choices if needed.
- B5. Add safe migration checklist & rollback commands to docs.

C — Frontend architecture, performance & reliability
- C1. Add UserContext: centralize auth user and reduce repeated getCurrentUser calls.
- C2. Introduce TanStack Query (react-query) for data fetching, caching, and invalidation patterns.
- C3. Debounce inputs (CostCalculator and any onChange saves). Add optimistic updates where latency-sensitive.
- C4. Memoize compute-heavy logic; avoid unnecessary re-renders (useMemo/useCallback).
- C5. Code-splitting: ensure Dashboard lazy loads sub-tabs; check chunk sizes, update Vite config as needed.
- C6. Remove unused components and clean imports.
- C7. Linting & Prettier rules; enforce via pre-commit hooks (husky + lint-staged).

D — Tests, CI, E2E
- D1. Unit tests:
  - Parser (robustCsvParser) covering diverse bank formats and edge cases (quoted fields, commas, negative values).
  - CSVImportModal mapping logic and split behavior.
  - HealthConnect function core extraction logic (mocked sql.js outputs).
- D2. Integration tests:
  - Supabase insert mock tests to ensure error surfacing and fallback.
- D3. E2E tests:
  - Import a sample CSV and verify UI preview, mapping, and DB row appearance.
  - Upload sample .db and verify health data appears in HealthTimeline.
  - Plaid link flow in sandbox (if feasible).
- D4. CI:
  - GitHub Actions: install, lint, type-check, unit tests, build, E2E (optional on PR).
  - Protect main branch; require passing checks.

E — Observability, monitoring & ops
- E1. Sentry: add Sentry to frontend and Netlify functions. Capture exceptions with tags (user_id, import_id).
- E2. Metrics:
  - Import success/failure counters and latencies.
  - HealthConnect upload counts, batch failures.
  - Plaid sync counts and token errors.
- E3. Dashboards & alerts:
  - Error rate alert (Sentry).
  - Import failure alert (Slack/pager).
  - Latency/SLA alerts (page load time).
- E4. Logs: Ensure Netlify functions log enough context; capture logs centrally if possible (e.g., Datadog/LogDNA).
- E5. Backup schedule: daily snapshots, weekly exports, verify restore monthly.

F — Security & privacy
- F1. Secrets:
  - Use Netlify environment secrets (server-only) for SUPABASE_SERVICE_ROLE_KEY, PLAID_SECRET, etc.
  - Ensure never to commit secrets.
- F2. Token encryption:
  - Encrypt Plaid access tokens before storing (server-side KMS or Supabase via edge function).
  - Prefer storing only encrypted tokens; use service role or key management for decryption when needed.
- F3. RLS & least privilege:
  - Confirm RLS policies for all user data tables.
  - Verify serverless functions use service role key only on server; do not expose to client.
- F4. TLS + HSTS + CSP:
  - Ensure hosting (Netlify) enforces HSTS and secure headers; add CSP to reduce risks.
- F5. Privacy:
  - Keep user-facing privacy policy updated.
  - Data retention policies for health uploads and processed encrypted blobs (Phase6 proposed 7-day retention for uploads).

G — Android HealthBridge finalization
- G1. Permissions: show full permission list in UI; use HealthConnect permission controller contract.
- G2. Background sync: ensure WorkManager constraints, battery optimization guidance, and retry/backoff.
- G3. Encryption: AES-256-GCM with Android Keystore; include IV and metadata with upload and document decryption steps in web app.
- G4. Upload format: zip with .db; include manifest (JSON) with version/date/metric-list; Netlify function should read manifest.
- G5. Test matrix: test on Android 10+ devices and emulator; verify export zip structure across devices.
- G6. Release: Play Store prep (listing, privacy policy, feature permissions).

H — Plaid production checklist
- H1. Sandbox testing: link, exchange token, sync transactions in sandbox.
- H2. Token encryption and storage.
- H3. Netlify scheduler (or Cloud function) to refresh transactions daily or on-demand.
- H4. Reconciliation UI to review auto-categorized transactions and train rules.
- H5. Legal/Pricing: confirm Plaid production terms and rate limits.

I — Product & UX polish
- I1. Onboarding flows: guide users through CSV import and HealthConnect export steps; include screenshots.
- I2. Import errors handling: show row-level errors, offer manual edit in preview, allow skip/continue.
- I3. Empty & no-data states: friendly instruction panels (HealthTimeline, ROI, Grocery).
- I4. Accessibility (WCAG 2.1 AA): run audits and fix issues (aria labels, keyboard navigation, contrast).
- I5. i18n baseline: add translations structure (react-i18next or similar).
- I6. Performance targets: page load time <2s for overview (on typical broadband); interaction latency <100ms for key actions.

J — Documentation, runbooks, and release
- J1. Developer docs:
  - README + architecture diagram.
  - How to run the Netlify functions locally.
  - How to run migrations and rollback steps.
- J2. Runbooks:
  - DB migration playbook.
  - Import failure triage playbook.
  - Recovery from lost encryption key (documented policy).
- J3. Release artifacts:
  - Changelog, release notes, demo video/screenshots.
  - Post-launch monitoring schedule (first 7 days each 4 hour checks).
- J4. Legal & privacy: privacy policy, terms updates for Plaid and HealthConnect integration.

K — Example PR list to create (recommended order)
- PR 1: `feat/parser` — add robustCsvParser + tests; small FinanceView wiring.
- PR 2: `feat/csv-ui` — add raw-row preview, header mapping UI, dry-run.
- PR 3: `chore/db-migrations` — add transaction_rules + import_logs + indexes migrations (staging only).
- PR 4: `fix/import-errors` — surface Supabase errors and add import_logs writes.
- PR 5: `feat/netlify-health-import` — hardened netlify function with service key and table discovery (and tests).
- PR 6: `feat/user-context` — add UserContext and update components to use it.
- PR 7: `feat/react-query` — add TanStack Query and caching for key endpoints.
- PR 8: `test/ci` — tests, fixtures, GitHub Actions workflow.
- PR 9: `android/healthbridge` — Android permission flow fixes & docs.
- PR 10: `feat/plaid` — Plaid server functions and token encryption.

Acceptance criteria (final validation)
- All top-20 priorities completed and tested on staging.
- Import flows supported with zero silent failures and ability to reprocess failing rows.
- DB migration applied safely with no data loss (verified by backups and validations).
- Performance targets met and load-tested.
- Security: tokens encrypted, RLS validated, secrets configured in Netlify.
- Monitoring/alerts active and tested.
- Documentation complete and release checklist executed.

Appendix — Helpful CLI & commands
- DB backup:
```bash
pg_dump -Fc --no-acl --no-owner -h $PG_HOST -U $PG_USER -d $PG_DB -f backup_$(date +%Y%m%d_%H%M).dump
```
- Restore:
```bash
pg_restore --clean --no-acl --no-owner -h $PG_HOST -U $PG_USER -d $PG_DB backup_file.dump
```
- Run migrations (example using psql / supabase CLI):
```bash
supabase db push --file sql-migrations/20251018_indexes_and_constraints.sql
# or
psql -h $PG_HOST -U $PG_USER -d $PG_DB -f sql-migrations/20251018_indexes_and_constraints.sql
```
- Run Netlify functions locally:
```bash
netlify dev
# or use netlify-lambda for local emulation
```

Notes & next step
-----------------
This document is intended to be the single source of truth for finishing the product. I can immediately begin by creating the highest-impact PR:
- Parser + test + FinanceView wiring (PR 1), or
- Hardened Netlify health-import (PR 5), or
- Migration PR with transaction_rules + import_logs + indexes (PR 3).

Which PR should I draft first? I will generate the patch and PR content for it next.