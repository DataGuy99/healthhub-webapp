# LifeDashHub Evolution Plan
**From**: HealthHub (Supplement Tracker)
**To**: LifeDashHub (Personal Management Platform)
**Start Date**: Winter Break (December 2025)
**Target Completion**: January 2026
**Current Status**: Planning Phase

---

## Executive Summary

Transform HealthHub from single-purpose supplement tracker into multi-module personal management platform:

**New Name**: **LifeDashHub**

**Modules**:
1. 💊 **Supplements** (existing - with fixes)
2. 💰 **Finance** (new - budget tracking with Plaid)
3. 🎯 **Goals** (new - unified goal tracking)
4. 🚗 **Car** (future - maintenance tracking)

**Key Value Propositions**:
- Save $75.48/year (cancel Rocket Money)
- Portfolio-worthy full-stack project
- Privacy-first, offline-capable
- Multi-device sync
- All data in one place

---

## Phase 0: Current State Analysis

### What We Have (HealthHub v0.9.0)

**✅ Working Infrastructure**:
- React 18 + TypeScript 5 + Vite 5
- Supabase PostgreSQL with RLS
- IndexedDB offline-first sync
- Netlify deployment (auto-deploy)
- TailwindCSS + Framer Motion
- Authentication system
- Multi-device support

**✅ Supplement Module Features**:
- CRUD operations for supplements
- Multi-ingredient support
- Frequency patterns (everyday, 5/2, workout, custom)
- Section management (Morning, Afternoon, etc.)
- Daily logger with timeline
- Workout mode (Pre/Post sections)
- Cost calculator
- CSV/JSON import/export
- Offline sync queue

**❌ Known Issues to Fix**:
1. **Bulk log button missing** - Can't log multiple selected supplements at once
2. **No time editing** - Can't log supplements taken past midnight with correct timestamp
3. **Components not using offline layer** - Still hitting Supabase directly instead of offlineData
4. **No sync status UI** - User doesn't know when offline/syncing

---

## Phase 1: Foundation & Fixes (Week 1 - Dec 2025)

### 1.1 Supplement Module Fixes

**Fix #1: Bulk Log Button**

**File**: `src/components/DailySupplementLogger.tsx`

**Add state for selected supplements**:
```typescript
const [selectedSupplements, setSelectedSupplements] = useState<Set<string>>(new Set());
```

**Add checkbox selection**:
```tsx
<input
  type="checkbox"
  checked={selectedSupplements.has(supplement.id!)}
  onChange={(e) => {
    const newSelected = new Set(selectedSupplements);
    if (e.target.checked) {
      newSelected.add(supplement.id!);
    } else {
      newSelected.delete(supplement.id!);
    }
    setSelectedSupplements(newSelected);
  }}
/>
```

**Add bulk log button**:
```tsx
{selectedSupplements.size > 0 && (
  <div className="flex gap-2">
    <button onClick={() => handleBulkLog()} className="...">
      Log Selected ({selectedSupplements.size})
    </button>
    <button onClick={() => handleBulkLogWithTime()} className="...">
      Log with Custom Time
    </button>
  </div>
)}
```

**Functions**:
```typescript
const handleBulkLog = async () => {
  const user = await getCurrentUser();
  if (!user) return;

  const updates = Array.from(selectedSupplements).map(id => ({
    user_id: user.id,
    supplement_id: id,
    date: today,
    is_taken: true,
    timestamp: new Date().toISOString()
  }));

  await supabase.from('supplement_logs').upsert(updates);
  setSelectedSupplements(new Set());
  await loadData();
};

const handleBulkLogWithTime = async () => {
  const customTime = prompt('Enter time (HH:MM, 24-hour format):');
  if (!customTime) return;

  const [hours, minutes] = customTime.split(':').map(Number);
  const customDate = new Date();
  customDate.setHours(hours, minutes, 0, 0);

  // If time is in future, assume yesterday
  if (customDate > new Date()) {
    customDate.setDate(customDate.getDate() - 1);
  }

  // Same bulk upsert logic but with customDate.toISOString()
};
```

**Fix #2: Time Editing Modal**

**Create new component**: `src/components/TimeEditModal.tsx`

```typescript
interface TimeEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (timestamp: Date) => void;
  defaultDate?: Date;
}

export function TimeEditModal({ isOpen, onClose, onSubmit, defaultDate }: TimeEditModalProps) {
  const [date, setDate] = useState(defaultDate || new Date());
  const [time, setTime] = useState('');

  // UI with date picker and time input
  // Submit button calls onSubmit(combinedDateTime)
}
```

**Usage in DailySupplementLogger**:
```typescript
const [timeEditModalOpen, setTimeEditModalOpen] = useState(false);
const [editingSupplementId, setEditingSupplementId] = useState<string | null>(null);

<TimeEditModal
  isOpen={timeEditModalOpen}
  onClose={() => setTimeEditModalOpen(false)}
  onSubmit={async (timestamp) => {
    // Log supplement with custom timestamp
    await logSupplementWithTime(editingSupplementId, timestamp);
    setTimeEditModalOpen(false);
  }}
/>
```

### 1.2 Migrate to Offline Data Layer

**Goal**: All components use `offlineData` instead of direct `supabase` calls

**Files to update**:
- `src/components/DailySupplementLogger.tsx`
- `src/components/SupplementsView.tsx`
- `src/components/SectionsView.tsx`
- `src/components/CostCalculator.tsx`

**Example Migration Pattern**:

**Before**:
```typescript
const { data } = await supabase
  .from('supplements')
  .select('*')
  .eq('user_id', user.id);
```

**After**:
```typescript
import { offlineData } from '../lib/offlineData';

const data = await offlineData.supplements.getAll(user.id);
```

**Initialize on login** (`src/components/App.tsx`):
```typescript
useEffect(() => {
  async function checkAuth() {
    const user = await getCurrentUser();
    setCurrentUser(user);

    if (user) {
      await offlineData.init(user.id); // Initialize offline DB
    }

    setLoading(false);
  }
  checkAuth();
}, []);
```

### 1.3 Add Sync Status UI

**Create component**: `src/components/SyncStatusBadge.tsx`

```tsx
export function SyncStatusBadge() {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const unsubscribe = offlineData.onConnectionChange((online) => {
      setIsOnline(online);
    });
    return unsubscribe;
  }, []);

  return (
    <div className="flex items-center gap-2">
      {isSyncing ? (
        <div className="flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-500 border-t-transparent" />
          <span>Syncing...</span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
          <span>{isOnline ? 'Online' : 'Offline'}</span>
        </div>
      )}
    </div>
  );
}
```

**Add to Dashboard header**:
```tsx
<div className="flex justify-between items-center">
  <AnimatedTitle />
  <SyncStatusBadge />
</div>
```

---

## Phase 2: Finance Module - Core (Week 2-3 - Dec 2025)

### 2.1 Database Schema

**New Tables in Supabase**:

```sql
-- Bank accounts
CREATE TABLE bank_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plaid_access_token TEXT NOT NULL, -- Encrypted in production
  plaid_item_id TEXT NOT NULL,
  institution_name TEXT NOT NULL,
  account_name TEXT,
  account_mask TEXT, -- Last 4 digits
  account_type TEXT, -- checking, savings, credit
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only see their own bank accounts"
  ON bank_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bank accounts"
  ON bank_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bank accounts"
  ON bank_accounts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bank accounts"
  ON bank_accounts FOR DELETE
  USING (auth.uid() = user_id);

-- Budget categories
CREATE TABLE budget_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT, -- Emoji or icon name
  color TEXT, -- Hex color
  parent_category_id UUID REFERENCES budget_categories(id) ON DELETE SET NULL,
  is_custom BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

ALTER TABLE budget_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own categories"
  ON budget_categories FOR ALL
  USING (auth.uid() = user_id);

-- Transactions
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL,
  plaid_transaction_id TEXT, -- From Plaid API
  amount DECIMAL(10,2) NOT NULL,
  date DATE NOT NULL,
  merchant TEXT,
  description TEXT,
  category_id UUID REFERENCES budget_categories(id) ON DELETE SET NULL,
  is_recurring BOOLEAN DEFAULT false,
  frequency_days INTEGER, -- For recurring: every X days
  next_expected_date DATE, -- For recurring tracking
  is_manual BOOLEAN DEFAULT false, -- User-added vs Plaid-synced
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_date ON transactions(user_id, date DESC);
CREATE INDEX idx_transactions_category ON transactions(category_id);
CREATE INDEX idx_transactions_plaid ON transactions(plaid_transaction_id);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own transactions"
  ON transactions FOR ALL
  USING (auth.uid() = user_id);

-- Transaction items (for itemized breakdowns)
CREATE TABLE transaction_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  pretax_amount DECIMAL(10,2) NOT NULL,
  category_id UUID REFERENCES budget_categories(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage items for their own transactions"
  ON transaction_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM transactions
      WHERE transactions.id = transaction_items.transaction_id
      AND transactions.user_id = auth.uid()
    )
  );

-- Budget goals
CREATE TABLE budget_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES budget_categories(id) ON DELETE CASCADE,
  goal_amount DECIMAL(10,2) NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('weekly', 'monthly', 'yearly')),
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE budget_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own goals"
  ON budget_goals FOR ALL
  USING (auth.uid() = user_id);
```

**IndexedDB Schema** (add to `src/lib/db.ts`):

```typescript
// In init() method, add these stores:

if (!db.objectStoreNames.contains('bank_accounts')) {
  const bankStore = db.createObjectStore('bank_accounts', { keyPath: 'id' });
  bankStore.createIndex('user_id', 'user_id', { unique: false });
}

if (!db.objectStoreNames.contains('budget_categories')) {
  const catStore = db.createObjectStore('budget_categories', { keyPath: 'id' });
  catStore.createIndex('user_id', 'user_id', { unique: false });
}

if (!db.objectStoreNames.contains('transactions')) {
  const txStore = db.createObjectStore('transactions', { keyPath: 'id' });
  txStore.createIndex('user_id', 'user_id', { unique: false });
  txStore.createIndex('date', 'date', { unique: false });
  txStore.createIndex('category_id', 'category_id', { unique: false });
}

if (!db.objectStoreNames.contains('transaction_items')) {
  const itemsStore = db.createObjectStore('transaction_items', { keyPath: 'id' });
  itemsStore.createIndex('transaction_id', 'transaction_id', { unique: false });
}

if (!db.objectStoreNames.contains('budget_goals')) {
  const goalsStore = db.createObjectStore('budget_goals', { keyPath: 'id' });
  goalsStore.createIndex('user_id', 'user_id', { unique: false });
}
```

### 2.2 Plaid Integration

**Install Plaid**:
```bash
npm install plaid react-plaid-link
npm install --save-dev @types/react-plaid-link
```

**Create Netlify Function**: `netlify/functions/plaid-create-link-token.ts`

```typescript
import { Handler } from '@netlify/functions';
import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';

const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const client = new PlaidApi(configuration);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { userId } = JSON.parse(event.body || '{}');

    const request = {
      user: { client_user_id: userId },
      client_name: 'LifeDashHub',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    };

    const response = await client.linkTokenCreate(request);

    return {
      statusCode: 200,
      body: JSON.stringify({ link_token: response.data.link_token }),
    };
  } catch (error) {
    console.error('Plaid link token error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to create link token' }),
    };
  }
};
```

**Create Netlify Function**: `netlify/functions/plaid-exchange-token.ts`

```typescript
import { Handler } from '@netlify/functions';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { createClient } from '@supabase/supabase-js';

const plaidConfig = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(plaidConfig);

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Server-side key
);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { public_token, userId } = JSON.parse(event.body || '{}');

    // Exchange public token for access token
    const response = await plaidClient.itemPublicTokenExchange({
      public_token,
    });

    const accessToken = response.data.access_token;
    const itemId = response.data.item_id;

    // Get institution info
    const itemResponse = await plaidClient.itemGet({ access_token: accessToken });
    const institutionId = itemResponse.data.item.institution_id;

    const instResponse = await plaidClient.institutionsGetById({
      institution_id: institutionId!,
      country_codes: [CountryCode.Us],
    });

    const institutionName = instResponse.data.institution.name;

    // Get accounts
    const accountsResponse = await plaidClient.accountsGet({ access_token: accessToken });
    const accounts = accountsResponse.data.accounts;

    // Store in Supabase
    const accountsToInsert = accounts.map(account => ({
      user_id: userId,
      plaid_access_token: accessToken, // TODO: Encrypt in production
      plaid_item_id: itemId,
      institution_name: institutionName,
      account_name: account.name,
      account_mask: account.mask,
      account_type: account.type,
    }));

    await supabase.from('bank_accounts').insert(accountsToInsert);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, accounts: accounts.length }),
    };
  } catch (error) {
    console.error('Plaid exchange error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to exchange token' }),
    };
  }
};
```

**Create Netlify Function**: `netlify/functions/plaid-sync-transactions.ts`

```typescript
import { Handler } from '@netlify/functions';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { createClient } from '@supabase/supabase-js';

const plaidConfig = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(plaidConfig);
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { userId } = JSON.parse(event.body || '{}');

    // Get all bank accounts for user
    const { data: accounts } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('user_id', userId);

    if (!accounts || accounts.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ synced: 0 }) };
    }

    let totalSynced = 0;

    for (const account of accounts) {
      const accessToken = account.plaid_access_token;

      // Get last 30 days of transactions
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const response = await plaidClient.transactionsGet({
        access_token: accessToken,
        start_date: startDate.toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0],
      });

      const transactions = response.data.transactions;

      // Upsert transactions to Supabase
      const transactionsToInsert = transactions.map(tx => ({
        user_id: userId,
        bank_account_id: account.id,
        plaid_transaction_id: tx.transaction_id,
        amount: tx.amount,
        date: tx.date,
        merchant: tx.merchant_name || tx.name,
        description: tx.name,
        category_id: null, // User will categorize
        is_manual: false,
      }));

      await supabase.from('transactions').upsert(transactionsToInsert, {
        onConflict: 'plaid_transaction_id',
      });

      totalSynced += transactions.length;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ synced: totalSynced }),
    };
  } catch (error) {
    console.error('Plaid sync error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to sync transactions' }),
    };
  }
};
```

**Environment Variables** (add to Netlify):
```
PLAID_CLIENT_ID=your_client_id
PLAID_SECRET=your_secret
PLAID_ENV=development
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 2.3 Plaid Link Component

**Create**: `src/components/PlaidLinkButton.tsx`

```tsx
import { usePlaidLink } from 'react-plaid-link';
import { useState, useEffect } from 'react';
import { getCurrentUser } from '../lib/auth';

export function PlaidLinkButton() {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function createLinkToken() {
      const user = await getCurrentUser();
      if (!user) return;

      const response = await fetch('/.netlify/functions/plaid-create-link-token', {
        method: 'POST',
        body: JSON.stringify({ userId: user.id }),
      });

      const { link_token } = await response.json();
      setLinkToken(link_token);
    }

    createLinkToken();
  }, []);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (public_token, metadata) => {
      setLoading(true);
      const user = await getCurrentUser();

      await fetch('/.netlify/functions/plaid-exchange-token', {
        method: 'POST',
        body: JSON.stringify({ public_token, userId: user?.id }),
      });

      alert('Bank connected successfully!');
      window.location.reload();
    },
  });

  return (
    <button
      onClick={() => open()}
      disabled={!ready || loading}
      className="bg-purple-500 text-white px-4 py-2 rounded-lg"
    >
      {loading ? 'Connecting...' : 'Connect Bank Account'}
    </button>
  );
}
```

### 2.4 Finance Dashboard Component

**Create**: `src/components/finance/FinanceDashboard.tsx`

```tsx
import { useState, useEffect } from 'react';
import { getCurrentUser } from '../../lib/auth';
import { PlaidLinkButton } from '../PlaidLinkButton';
import { TransactionList } from './TransactionList';
import { BudgetOverview } from './BudgetOverview';
import { CategoryManager } from './CategoryManager';

export function FinanceDashboard() {
  const [view, setView] = useState<'overview' | 'transactions' | 'categories'>('overview');
  const [bankAccounts, setBankAccounts] = useState([]);
  const [syncing, setSyncing] = useState(false);

  const syncTransactions = async () => {
    setSyncing(true);
    const user = await getCurrentUser();

    await fetch('/.netlify/functions/plaid-sync-transactions', {
      method: 'POST',
      body: JSON.stringify({ userId: user?.id }),
    });

    setSyncing(false);
    alert('Transactions synced!');
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Finance</h1>
        <div className="flex gap-2">
          <button onClick={syncTransactions} disabled={syncing}>
            {syncing ? 'Syncing...' : 'Sync Transactions'}
          </button>
          <PlaidLinkButton />
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <button onClick={() => setView('overview')}>Overview</button>
        <button onClick={() => setView('transactions')}>Transactions</button>
        <button onClick={() => setView('categories')}>Categories</button>
      </div>

      {view === 'overview' && <BudgetOverview />}
      {view === 'transactions' && <TransactionList />}
      {view === 'categories' && <CategoryManager />}
    </div>
  );
}
```

---

## Phase 3: Finance Module - Advanced (Week 4 - Dec 2025)

### 3.1 Transaction Detail Tracking

### 3.2 Custom Categories

### 3.3 Budget Goals

### 3.4 Smart Categorization

---

## Phase 4: Unified Goals System (Week 5 - Jan 2026)

### 4.1 Goal Framework

### 4.2 Cross-Module Integration

---

## Phase 5: Polish & Deploy (Week 6 - Jan 2026)

### 5.1 Testing

### 5.2 Documentation

### 5.3 Deploy

---

## Success Metrics

**Financial**:
- [ ] Cancel Rocket Money (save $79/year)
- [ ] Plaid costs only $0.30/month ($3.60/year)
- [ ] Net savings: $75.40/year

**Technical**:
- [ ] All tests passing
- [ ] Offline mode working perfectly
- [ ] Multi-device sync verified
- [ ] CodeRabbit review clean

**Portfolio**:
- [ ] GitHub README updated
- [ ] Live demo deployed
- [ ] Added to resume
- [ ] Screenshots/demo video created

---

## Risk Mitigation

**Risk**: Plaid integration complexity
**Mitigation**: Use sandbox environment, extensive testing

**Risk**: Time constraints during school
**Mitigation**: Focus on MVP first, add features incrementally

**Risk**: Data migration issues
**Mitigation**: Test thoroughly in development, backup all data

---

## Questions to Answer

1. Name: Keep "LifeDashHub" or alternative?
2. Module priority: Finance first, then what?
3. Car maintenance module timeline?
4. Mobile app (React Native) future?

---

**Next Steps**: Approve this plan, then create detailed technical specs for Phase 1.
