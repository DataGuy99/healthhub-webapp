# Phase 6 — Full Codebase Action Plan (Updated)
Date: 2025-10-18  
Author: ChatGPT (edited for completeness)

Purpose
-------
A single, authoritative action plan for Phase 6 that consolidates:
- CSV import reliability and mapping fixes,
- HealthConnect (.db/.zip) import hardening,
- Supabase schema migrations and backups,
- Frontend performance and API call improvements,
- Observability, testing, and CI steps,
- Android/ Plaid integration safety reminders.

This file combines the earlier summary plan with the full audit details, exact SQL/index list, migration safety instructions, environment recommendations, test fixtures, and concrete drop-in snippets so you can apply changes safely and track progress.

Scope
-----
- Entire codebase: frontend (React + TypeScript), serverless functions (Netlify), Supabase migrations, Android HealthBridge integration, and integration with Plaid.
- Focus areas: import reliability, DB correctness, performance, error handling, tests, and deployment safety.

Quick executive summary
-----------------------
1. Make CSV imports robust: replace positional parser with header-aware parser (PapaParse), surface raw rows, add header-mapping UI, and make mapping tolerant.
2. Harden HealthConnect import function: validate zip/db contents, list sqlite tables, use Supabase service-role key, reduce batch sizes, and surface errors.
3. Run critical DB migrations: unique constraints for .single() usages and missing composite indexes (full list included).
4. Fix API patterns: centralize user fetch (UserContext), cache queries, and debounce heavy input saves.
5. Improve observability and safety: import_logs table, Sentry, CI tests for parsers and imports, and rollback/backup instructions for migrations.
6. Add procedural steps, test fixtures, and PR plan so work can be applied incrementally and safely.

High-level prioritized steps
----------------------------
1. (Urgent) Add robust CSV parser + preview and surface parsing results in UI.
2. (Urgent) Surface Supabase insert errors in the frontend import flow.
3. (Urgent) Create transaction_rules table migration & run on staging.
4. (High) Harden Netlify health import function: service key + table discovery + batch tuning.
5. (High) Apply critical DB migrations (unique constraints + indexes) after backups in staging.
6. (High) Implement UserContext and caching; debounce inputs.
7. (Medium) Add testing, CI checks, Sentry, and import_logs.
8. (Medium) Improve Android HealthConnect permission handling and Plaid token encryption.
9. (Low) Bundle & dependency plan and progressive upgrades.

SECTION A — CSV import: robust, header-driven parsing (detailed)
----------------------------------------------------------------
Why: Current parser is positional (expects 11+ columns and specific indices). Many bank CSVs do not match. We must handle quotes, commas in fields, header variations, and negative/positive conventions.

A.1 Install PapaParse
```bash
npm install papaparse
```

A.2 Add header-aware parser
- File: `src/utils/robustCsvParser.ts` (drop-in; tolerant header mapping; returns `raw` per row for preview).

```typescript
// src/utils/robustCsvParser.ts
import Papa from 'papaparse';

export interface ParsedTransaction {
  date: string;
  merchant: string;
  amount: number;
  bankCategory?: string;
  description?: string;
  raw?: Record<string, string>;
}

/**
 * Parse CSV with header tolerance and common header name mappings.
 * Returns parsed transactions and parse errors.
 */
export function parseBankCSV(csvText: string): { transactions: ParsedTransaction[]; errors: string[] } {
  const results = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const errors: string[] = [];
  if (results.errors && results.errors.length) {
    for (const e of results.errors) {
      errors.push(`Row ${e.row}: ${e.message}`);
    }
  }

  const transactions: ParsedTransaction[] = [];
  for (const row of results.data) {
    const date = row['Date'] || row['date'] || row['Transaction Date'] || row['Posted Date'] || '';
    const merchant = row['Name'] || row['Merchant'] || row['Payee'] || row['Description'] || '';
    const amountRaw = (row['Amount'] || row['amount'] || row['Debit'] || row['Credit'] || '').toString();
    const bankCategory = row['Category'] || row['category'] || row['Bank Category'] || '';
    const description = row['Description'] || row['Memo'] || '';

    // clean amount (strip currency, thousands separators)
    const cleaned = amountRaw.replace(/[^0-9\.\-]/g, '');
    const amount = cleaned ? parseFloat(cleaned) : 0;

    transactions.push({
      date,
      merchant,
      amount,
      bankCategory,
      description,
      raw: row,
    });
  }

  return { transactions, errors };
}
```

A.3 Wire parser into FinanceView
- Replace current positional parser call with `parseBankCSV(content)`.
- Immediately log first N parsed rows for dev check:
```ts
console.log('parseBankCSV preview', result.transactions.slice(0,8));
```

A.4 UI: CSVImportModal improvements
- Add "Show raw row" toggle or per-row button to display `tx.raw` (JSON) for the row — helps trace mapping issues.
- Add a "Header mapping" dialog to select which CSV header maps to date/merchant/amount when auto-detection fails.
- Add a "Dry-run" mode to validate inserts without writing.

A.5 CSV import rules (explicit)
- Positive amount = expense; negative = income (normalization done if needed)
- Date expected in YYYY-MM-DD for DB; if not, attempt common conversions and show a validation error.
- If `amount === 0` or missing merchant, flag for user review (don't auto-import).

SECTION B — Surface Supabase errors and import audit
----------------------------------------------------
B.1 Replace silent inserts with explicit error handling:
```ts
const { data, error } = await supabase.from('transactions').insert(batch);
if (error) {
  console.error('Supabase insert failed', error);
  notifyUser('Import failed: ' + error.message);
  // record import_logs entry and stop or continue based on policy
  break; // or continue based on your choice
}
```

B.2 Create `import_logs` table to record each import attempt and server errors
- Migration to run:
```sql
CREATE TABLE IF NOT EXISTS import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  import_type TEXT NOT NULL,
  rows_count INTEGER,
  error_count INTEGER,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

SECTION C — transaction_rules table (auto-mapping)
--------------------------------------------------
C.1 Migration: `supabase/migrations/20251018_create_transaction_rules.sql`
```sql
CREATE TABLE IF NOT EXISTS transaction_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  category TEXT NOT NULL,
  template TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, keyword)
);

CREATE INDEX IF NOT EXISTS idx_transaction_rules_user_keyword ON transaction_rules (user_id, keyword);
```

C.2 Run in staging, test mapping, then run in production.

SECTION D — HealthConnect import function hardening (Netlify)
-------------------------------------------------------------
Problems observed:
- sql.js WASM can be brittle in some serverless environments,
- zip contents differ across Android versions,
- large batches/timeouts and missing service key create insert failures.

D.1 Required environment variables (Netlify)
- `SUPABASE_SERVICE_ROLE_KEY` (server-only, must be set in Netlify environment)
- `VITE_SUPABASE_URL`

D.2 Hardened Netlify function (concept)
- Key points implemented: service role key usage, table discovery, smaller batch size, explicit error responses.

Drop-in skeleton (replace or adapt current function):
```typescript
// netlify/functions/health-connect-import.ts
import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import initSqlJs from 'sql.js';
import AdmZip from 'adm-zip';

// IMPORTANT: server must use service role key
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_URL in environment');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { fileData, isZip, userId } = JSON.parse(event.body || '{}');
    if (!fileData || !userId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing fileData or userId' }) };
    }

    // decode incoming base64
    const buffer = Buffer.from(fileData, 'base64');
    let dbBuffer: Buffer;
    if (isZip) {
      const zip = new AdmZip(buffer);
      const entries = zip.getEntries();
      const dbEntry = entries.find(e => e.entryName.endsWith('.db'));
      if (!dbEntry) {
        return { statusCode: 400, body: JSON.stringify({ error: 'No .db file in zip', entries: entries.map(e => e.entryName) }) };
      }
      dbBuffer = dbEntry.getData();
    } else {
      dbBuffer = buffer;
    }

    const SQL = await initSqlJs();
    const db = new SQL.Database(new Uint8Array(dbBuffer));

    // debug: list tables
    const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table';");
    const tables = tablesResult[0]?.values?.map(r => r[0]) || [];
    console.log('Health DB tables:', tables);

    // extraction logic - wrap every SELECT in try/catch and count rows
    // ... (same extraction code but with more try/catch logging)

    // After building dataPoints array:
    const BATCH_SIZE = 200;
    for (let i = 0; i < dataPoints.length; i += BATCH_SIZE) {
      const batch = dataPoints.slice(i, i + BATCH_SIZE).map(dp => ({
        user_id: userId,
        type: dp.type,
        timestamp: dp.timestamp,
        value: dp.value,
        source: dp.source,
        metadata: dp.metadata || null,
        created_at: new Date().toISOString()
      }));
      const { error } = await supabase.from('health_data_upload').insert(batch);
      if (error) {
        console.error('Supabase batch insert error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Supabase insert failed', detail: error.message }) };
      }
      await new Promise(r => setTimeout(r, 150)); // gentle throttle
    }

    db.close();
    return { statusCode: 200, body: JSON.stringify({ success: true, tables, imported: dataPoints.length }) };
  } catch (err) {
    console.error('Import handler error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
  }
};
```

D.3 If sql.js/WASM breaks in Netlify, fallback options:
- Move processing to a container/Cloud Run (supports WASM reliably).
- Or parse client-side (browser) and POST JSON rows (requires client memory but removes server WASM dependency).

SECTION E — Full list of composite indexes and unique constraints (apply in migrations)
-------------------------------------------------------------------------------------
E.1 Unique constraints (required for `.single()` usage)
- grocery_budgets.user_id
- protein_targets.user_id
- misc_shop_budgets.user_id
- user_settings.user_id

E.2 Composite / performance indexes (run in a single migration)
- gas_fillups: (user_id, date, mileage)
- maintenance_items: (user_id, is_active, service_name)
- recurring_bills: (user_id, is_active)
- protein_calculations: (user_id, created_at)
- misc_shop_purchases: (user_id, month, date)
- supplements: (user_id, section, "order")
- supplement_logs: (user_id, date)
- supplement_sections: (user_id, "order")
- bank_accounts: (user_id, is_active)
- transactions: (user_id, date)
- category_budgets: (user_id, month_year)
- bill_payments: (user_id, date)
- grocery_purchases: (user_id, date)
- category_logs: (user_id, date) — consider (user_id, date, category_id) if join-heavy

E.3 Migration snippet (example file `sql-migrations/20251018_indexes_and_constraints.sql`)
```sql
-- Unique constraints
ALTER TABLE IF EXISTS grocery_budgets ADD CONSTRAINT IF NOT EXISTS unique_grocery_budgets_user UNIQUE (user_id);
ALTER TABLE IF EXISTS protein_targets ADD CONSTRAINT IF NOT EXISTS unique_protein_targets_user UNIQUE (user_id);
ALTER TABLE IF EXISTS misc_shop_budgets ADD CONSTRAINT IF NOT EXISTS unique_misc_shop_budgets_user UNIQUE (user_id);
ALTER TABLE IF EXISTS user_settings ADD CONSTRAINT IF NOT EXISTS unique_user_settings_user UNIQUE (user_id);

-- Composite & helpful indexes
CREATE INDEX IF NOT EXISTS idx_gas_fillups_user_date_mileage ON gas_fillups (user_id, date, mileage);
CREATE INDEX IF NOT EXISTS idx_maintenance_items_user_active_name ON maintenance_items (user_id, is_active, service_name);
CREATE INDEX IF NOT EXISTS idx_recurring_bills_user_active ON recurring_bills (user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_protein_calculations_user_created ON protein_calculations (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_misc_shop_purchases_user_month_date ON misc_shop_purchases (user_id, month, date);
CREATE INDEX IF NOT EXISTS idx_supplements_user_section_order ON supplements (user_id, section, "order");
CREATE INDEX IF NOT EXISTS idx_supplement_logs_user_date ON supplement_logs (user_id, date);
CREATE INDEX IF NOT EXISTS idx_supplement_sections_user_order ON supplement_sections (user_id, "order");
CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_active ON bank_accounts (user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions (user_id, date);
CREATE INDEX IF NOT EXISTS idx_category_budgets_user_month_year ON category_budgets (user_id, month_year);

-- Add others as needed; run EXPLAIN ANALYZE to confirm
```

Note: run these on staging first, monitor query plans, and adjust index columns/order to match your most frequent WHERE/ORDER BY patterns.

SECTION F — Migration safety checklist (DO THIS BEFORE RUNNING ANY MIGRATION ON PROD)
--------------------------------------------------------------------------------------
1. Export full DB backup:
```bash
pg_dump -Fc --no-acl --no-owner -h <host> -U <user> -d <db> -f backup_$(date +%Y%m%d_%H%M).dump
# or use Supabase Backup tools
```
2. Apply migration to a staging DB (clone production snapshot).
3. Run integration tests on staging (import flows, pages that fail previously).
4. Run `EXPLAIN ANALYZE` on heavy queries to confirm improved plans.
5. Deploy migration to production during a maintenance window.
6. If rollback required: restore from backup:
```bash
pg_restore --clean --no-acl --no-owner -h <host> -U <user> -d <db> backup_file.dump
```

SECTION G — API patterns & front-end improvements
-------------------------------------------------
G.1 Centralize user (avoid N+1):
- `src/contexts/UserContext.tsx` (wrap App). Replace repeated `getCurrentUser()` with context.

G.2 Use react-query (or TanStack Query) for caching, background refresh, and retrying queries.

G.3 Debounce saves (CostCalculator) and use optimistic updates where sensible.

G.4 Memoize heavy computations (useMemo/useCallback) in ROIAnalyzer, correlationEngine, etc.

SECTION H — Tests, CI, and monitoring
-------------------------------------
H.1 Unit tests:
- Parser tests: multiple bank CSV formats.
- CSVImportModal mapping logic.
- Netlify function: unit test flow by mocking parsed JSON and asserting DB calls.

H.2 E2E:
- Import a test CSV into a staging environment; assert rows inserted and preview mapping.

H.3 CI (GitHub Actions basic workflow)
- Steps: install, lint, type-check, unit tests, build.

H.4 Observability:
- Add Sentry to frontend and serverless functions.
- Add import metrics to import_logs and optionally external metrics system.

SECTION I — Android HealthConnect notes (practical)
---------------------------------------------------
- Make sure exported file is `.zip` containing `.db`; if Android changes names, Netlify function should return zip entries when missing `.db`.
- Permission flow: use HealthConnect permission controller and show clear UI to open HealthConnect settings if not installed or permission denied.
- For encrypted uploads: include IV and metadata for decryption; document key management: do not store user keys unencrypted server-side.

SECTION J — Plaid integration safe approach
-------------------------------------------
- Implement serverless endpoints for `link_token_create` and `public_token` exchange using Plaid client and server-side secrets.
- Encrypt access tokens using KMS or server-side encryption before storing them in Supabase (or store only tokens encrypted with service key).
- Use a Netlify function to periodically sync transactions server-side (using service key on server to write to DB).

SECTION K — Where problems were found (file index)
--------------------------------------------------
Quick index so developers can find the code locations to modify:
- Frontend CSV related:
  - `src/components/FinanceView.tsx`
  - `src/components/CSVImportModal.tsx`
  - `src/utils/csvParser.ts` (old parser)
  - `src/components/SupplementImportExport.tsx`
- HealthConnect import:
  - `src/components/HealthConnectImport.tsx`
  - `netlify/functions/health-connect-import.ts`
- DB / Supabase schema & migration folders:
  - `supabase/migrations/`
  - `sql-migrations/`
- Performance & patterns:
  - `src/components/ProteinCalculator.tsx`
  - `src/components/CostCalculator.tsx`
  - `src/components/ROIAnalyzer.tsx`
  - `src/components/Dashboard.tsx`
- Android docs:
  - `HealthBridgeAndroid/` (README, Kotlin files)
- Netlify functions and Plaid:
  - `netlify/functions/` (plaid-create-link-token, plaid-exchange-token, plaid-sync-transactions)

SECTION L — Example test fixtures & sample CSV headers
-----------------------------------------------------
Place representative samples under `tests/fixtures/`:
- `sample_bank_1.csv` (Knoxville TVA style)
- `sample_bank_2.csv` (Chase/Bank of America style)
- `sample_csv_headers.md` — quick reference for header names to support mapping

Example typical headers to include in fixtures / header mapping UI:
- Date, Original Date, Description, Name, Merchant, Amount, Debit, Credit, Category, Memo

SECTION M — Actionable PR plan (small, safe incremental PRs)
-------------------------------------------------------------
PR 1 (A): Add `src/utils/robustCsvParser.ts` + tests + update `FinanceView` to use it (small).
PR 2 (B): Add console logging + raw-row preview toggle in `CSVImportModal`, and surface Supabase errors.
PR 3 (C): Migration: `transaction_rules` and `import_logs` + index file.
PR 4 (D): Harden netlify `health-connect-import` function (service role key, table discovery, reduce batch size).
PR 5 (E): Add `sql-migrations/20251018_indexes_and_constraints.sql` and run in staging (and rollback docs).
PR 6 (F): Add `UserContext` and replace repeated `getCurrentUser()` usages in top components.
PR 7 (G): Add tests & CI configuration.

If you want, I can prepare PR 1 (parser + test) now and open a branch. Tell me which PR to create first and I will draft the changes.

Final checklist (top 18, actionable)
-------------------------------------
1. Add `papaparse` and `src/utils/robustCsvParser.ts` (PR 1).
2. Replace old parser calls and add raw-row preview in `CSVImportModal` (PR 2).
3. Add `transaction_rules` migration and `import_logs` (PR 3).
4. Surface Supabase insert errors in import flow (PR 2).
5. Harden `netlify/functions/health-connect-import.ts` (PR 4).
6. Back up DB and run migrations on staging.
7. Apply index/unique constraint migration (PR 5).
8. Add `UserContext` and remove repeated `getCurrentUser()` (PR 6).
9. Debounce CostCalculator updates.
10. Memoize heavy computations in ROIAnalyzer/correlationEngine.
11. Add ErrorBoundary and Sentry integration.
12. Add unit tests for parser and import modal.
13. Add CI workflow to run tests and type checks.
14. Add sample fixtures to `tests/fixtures/`.
15. Validate HealthConnect .db uploads with small test files.
16. Implement Plaid endpoint PRs (link-token/exchange/sync) carefully with encrypted token storage.
17. Monitor imports and add alerting for failures.
18. Document all changes in `PROJECT_LOG.md` and `docs/README.md`.

---

If you'd like I will:
- produce PR 1 now (parser + tests + FinanceView wiring), or
- produce PR 4 now (hardened Netlify function + Netlify env changes), or
- create the consolidated migration file and a rollback instruction file.

Which would you like me to create first? I will generate the patch files for that PR next.