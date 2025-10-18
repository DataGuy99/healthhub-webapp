```markdown
# Phase 6 — Full Codebase Action Plan
Date: 2025-10-18  
Author: ChatGPT (adapted for DataGuy99 / HealthHub)

Purpose
-------
This single file consolidates targeted fixes, hardening, migrations, and developer recipes to stabilize imports, fix database mismatches, improve performance, complete integrations (HealthConnect, Plaid), and raise code quality across the entire repository. It is intended to be saved offline and used as the master "what to do" checklist for Phase 6.

Scope
-----
- Entire codebase (frontend React + TypeScript, serverless Netlify functions, Supabase schema, Android HealthBridge docs)
- CSV import robustness and mapping
- HealthConnect (.db/.zip) import reliability
- Supabase schema fixes (indexes, unique constraints)
- API call efficiency and caching
- Component-level performance (debounce, memoize)
- Error handling and observability
- Dependency & CI upgrades
- Tests and verification steps

High-level priorities (short)
-----------------------------
1. Fix import reliability (CSV + HealthConnect). Critical to avoid data loss and to show fields properly in preview.
2. Apply essential DB migrations (unique constraints + indexes) to match .single() usage and queries.
3. Add front-end improvements: robust parser (PapaParse), header-mapping UI, explicit server error surfacing.
4. Harden serverless import function (use service role key, list tables, smaller batches, clearer error responses).
5. Fix N+1 patterns and common overfetching (UserContext + query caching).
6. Add test coverage + CI checks for imports and core flows.
7. Address Android HealthConnect permission flow and Plaid server integration.

Detailed plan and code snippets
-------------------------------

SECTION A — CSV import: robust, header-driven parsing
A.1 Add dependency
```bash
npm install papaparse
```

A.2 Add parser: `src/utils/robustCsvParser.ts`
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

A.3 Wire the parser into FinanceView
- Replace usage of the old positional parser with `parseBankCSV`.
- Immediately `console.log(result.transactions.slice(0,10))` on parse so you can inspect real values in devtools.

A.4 CSV preview UI improvements (`src/components/CSVImportModal.tsx`)
- Add a small toggle or per-row button: "Show raw parsed row" that renders `JSON.stringify(tx.raw, null, 2)` for the row.
- Add a visible "Header mapping" control that allows users to choose which CSV header is date/merchant/amount if auto-detection fails.

A.5 Make mapping tolerant:
- Category mapping should be case-insensitive and support fuzzy matches and trimming.
- Add a small "Map unmatched categories" dialog to allow bulk mapping before import.

SECTION B — Surface Supabase errors during import
B.1 In the import handler (where you call `supabase.from('transactions').insert(batch)`), change to:

```ts
const { data, error } = await supabase.from('transactions').insert(batch);
if (error) {
  console.error('Supabase insert failed', error);
  // show friendly UI and provide error details in logs
  notifyUser(`Import failed: ${error.message}`);
  // optionally record import_logs row with error.details
  break;
}
```

B.2 Add server-side `import_logs` table for audit (optional but recommended)
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

SECTION C — transaction_rules: create table & ensure migration run
C.1 Migration `supabase/migrations/20251018_create_transaction_rules.sql`:

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

C.2 Run migration in Supabase SQL editor or via CLI.

SECTION D — HealthConnect (.db/.zip) Netlify function hardening
D.1 Use the Supabase service role key in Netlify:
- In Netlify: set `SUPABASE_SERVICE_ROLE_KEY` (server only) and `VITE_SUPABASE_URL`.
- Update function to use the service key for server-side insert.

D.2 Improve netlify function logging + table discovery
- Add a listing of sqlite tables and return that in error responses to help debugging.
- Reduce batch sizes (e.g., from 1000 → 200) and add small delay between batches.

D.3 Return helpful errors — example skeleton:

```ts
// netlify/functions/health-connect-import.ts (concept)
const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table';")[0]?.values.map(r=>r[0]) || [];
console.log('Tables found:', tables);

if (!tables.includes('heart_rate_record_series_table') && !tables.includes('steps_record_table')) {
  return { statusCode: 400, body: JSON.stringify({ error: 'Unexpected DB schema', tables }) };
}
```

D.4 If sql.js fails in Netlify (WASM support problems), fallback:
- Option A: Move processing to a server that supports the WASM binary (Google Cloud Run, AWS Lambda with layer).
- Option B: Move parsing to the browser (client) and POST already-parsed JSON to a server endpoint (this reduces server complexity and removes sql.js on server).

SECTION E — Add missing DB unique constraints and indexes (run ASAP)
E.1 Create migration `sql-migrations/20251018_indexes_and_constraints.sql`:

```sql
-- Unique constraints
ALTER TABLE IF EXISTS grocery_budgets ADD CONSTRAINT IF NOT EXISTS unique_grocery_budgets_user UNIQUE (user_id);
ALTER TABLE IF EXISTS protein_targets ADD CONSTRAINT IF NOT EXISTS unique_protein_targets_user UNIQUE (user_id);
ALTER TABLE IF EXISTS misc_shop_budgets ADD CONSTRAINT IF NOT EXISTS unique_misc_shop_budgets_user UNIQUE (user_id);
ALTER TABLE IF EXISTS user_settings ADD CONSTRAINT IF NOT EXISTS unique_user_settings_user UNIQUE (user_id);

-- Indexes for date ranges & composite queries
CREATE INDEX IF NOT EXISTS idx_bill_payments_user_date ON bill_payments (user_id, date);
CREATE INDEX IF NOT EXISTS idx_grocery_purchases_user_date ON grocery_purchases (user_id, date);
CREATE INDEX IF NOT EXISTS idx_category_logs_user_date ON category_logs (user_id, month_year);

CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions (user_id, date);
CREATE INDEX IF NOT EXISTS idx_supplements_user_section_order ON supplements (user_id, section, "order");
```

E.2 Validate by running explain analyze on heavy queries after migration to confirm improvements.

SECTION F — API call and frontend performance improvements
F.1 Centralize user fetching: `src/contexts/UserContext.tsx`

```tsx
// src/contexts/UserContext.tsx
import React, { createContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export const UserContext = createContext(null);

export const UserProvider = ({ children }: any) => {
  const [user, setUser] = useState(null);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
    })();
  }, []);
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
};
```

- Wrap App with `UserProvider` so components stop calling `getCurrentUser()` repeatedly.

F.2 Use react-query (or similar) for caching and staleTime settings for routine reads.

F.3 Debounce aggressive inputs (CostCalculator) using `useDebounce` or lodash.debounce.

F.4 Memoize heavy calculations (ROIAnalyzer, correlationEngine) with `useMemo` and `useCallback`.

SECTION G — Bundle & dependency improvements
G.1 Update safe dependencies:
- `@supabase/supabase-js` to latest 2.x
- eslint, @typescript-eslint

G.2 Plan for major upgrades:
- Test framer-motion v12 in a branch
- Wait for React 19 ecosystem if needed (move when libs ready)

G.3 Vite rollup manualChunks to split heavy libs:

```ts
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['framer-motion'],
          db: ['@supabase/supabase-js']
        }
      }
    }
  }
});
```

SECTION H — Error handling, testing, CI
H.1 Add global ErrorBoundary (src/components/ErrorBoundary.tsx) and wrap top-level routes.

H.2 Add unit tests for:
- robustCsvParser parsing multiple banks
- CSVImportModal mapping logic
- Netlify function with mocked sql.js (or simulating parsed JSON) to test insertion logic

H.3 Add CI workflow (GitHub Actions):
- Steps: install, type-check, lint, unit tests, build, e2e (optional).
- On PR run tests and parsing checks.

SECTION I — Android HealthConnect notes (fix permissions + upload)
I.1 Permissions
- Ensure `PermissionController.createRequestPermissionResultContract()` is used with the full set of needed `HealthPermission`s.
- Provide an explicit "Open HealthConnect" link if not installed.

I.2 Extraction & upload
- Ensure Android code uploads compressed `.db` inside a `.zip` that includes the `.db` (most device exports come as zip).
- Ensure AES encryption key process and IV are included and documented for decryption on web side (currently documented, keep consistent).

SECTION J — Plaid integration
J.1 Plaid approval: implement serverless endpoints (Netlify functions) to create link tokens and to exchange public tokens safely (using service role keys where needed). (Examples are documented above.)

J.2 Encrypt Plaid access tokens before storing (use Supabase Edge function or serverless encryption with KMS). Do not store plaintext access tokens in DB.

SECTION K — Observability & monitoring
K.1 Add Sentry (or similar) to capture runtime errors and report function failures.

K.2 Add import metrics to Prometheus/Datadog or simple daily summary in Supabase `import_logs`.

SECTION L — Manual verification procedures
L.1 CSV flow:
- Use a sample CSV in `tests/fixtures/` representing formats from top banks.
- Run local parse script; confirm mapping in browser preview.
- Run import with `dry-run` mode that validates DB inserts without writing (optional).

L.2 HealthConnect flow:
- Use a small exported `.db` (1-2 minutes of heart rate + a few steps) and upload via UI. Check Netlify logs for discovered tables and batch insert responses.

ACTIONABLE CHECKLIST (top 12)
------------------------------
1. Add `papaparse` and `src/utils/robustCsvParser.ts`.
2. Replace old parser calls and add raw-row preview.
3. Add `transaction_rules` migration and run it.
4. Change import code to show Supabase insert errors.
5. Create `import_logs` table and record import attempts.
6. Harden `netlify/functions/health-connect-import.ts` (service key, table list, smaller batches).
7. Run DB migrations: unique constraints + critical indexes.
8. Add `UserContext` and remove repeated `getCurrentUser()` calls.
9. Debounce CostCalculator & add memoization in heavy components.
10. Add ErrorBoundary and surface runtime errors to Sentry.
11. Add unit tests for parser and import modal; add CI.
12. Run local end-to-end import tests and inspect logs.

Appendix: quick local test commands
----------------------------------
- Test parser locally (node):
```bash
npm install papaparse
node -e "const fs=require('fs'); const { parseBankCSV } = require('./src/utils/robustCsvParser'); const csv=fs.readFileSync('sample.csv','utf8'); console.log(parseBankCSV(csv).transactions.slice(0,4));"
```

- Run dev server and hit import:
```bash
npm run dev
# Upload small CSV or .db via UI and inspect Network/Console
```

- Inspect Netlify function logs (Netlify dashboard) after upload.

Notes & closing
---------------
This file expands the earlier Phase6 actions (which focused on CSV/health imports) to the whole codebase: database, frontend, backend, Android, and Plaid concerns. Copy this file into `docs/PHASE6_FULL_CODEBASE_ACTIONS.md` and work through the checklist top-to-bottom. I can prepare PRs for any of the high-priority items (A parser PR, Netlify function PR, DB migration PR, frontend error-surfacing PR). Tell me which PR to create first and I'll draft the branch + patch files.
```