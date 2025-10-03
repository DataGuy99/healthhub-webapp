# HealthHub Web Application - Complete Project Log

## Project Information
- **Project Name**: HealthHub Web App (Supplement Tracker)
- **Created**: 2025-10-02
- **Location**: `/mnt/c/Users/Samuel/Downloads/Projects/healthhub` (Windows: `C:\Users\Samuel\Downloads\Projects\healthhub`)
- **Purpose**: Privacy-focused supplement tracking web application with offline-first sync capabilities, multi-device support, and comprehensive analytics
- **Repository**: Private (not yet pushed to GitHub due to .git/index.lock issue)
- **Production URL**: Not yet deployed
- **Tech Stack**: React 18, TypeScript 5, Vite 5, Supabase, TailwindCSS 3, Framer Motion 11, IndexedDB

## Architecture Overview

### Frontend Stack
- **Framework**: React 18.2+ with TypeScript 5.x
- **Build Tool**: Vite 5.x (HMR, ESM, optimized builds)
- **Styling**: TailwindCSS 3.x with custom glassmorphism effects
- **Animations**: Framer Motion 11.x (page transitions, timeline, buttons)
- **Database (Local)**: IndexedDB via native browser API
- **Database (Cloud)**: Supabase PostgreSQL with Row Level Security (RLS)
- **State Management**: React hooks (useState, useEffect) - no external state library
- **Routing**: Single-page app with tab-based navigation (no react-router)

### Backend Stack
- **Hosted Database**: Supabase (PostgreSQL 15+)
- **Authentication**: Supabase Auth (email/password)
- **Storage**: Supabase PostgreSQL + local IndexedDB mirror
- **API Layer**: Supabase JavaScript client (@supabase/supabase-js)
- **Offline Sync**: Custom IndexedDB sync queue with background sync

### Development Environment
- **Container**: Docker Compose (Vite dev server on port 3000)
- **Node Version**: 22.x LTS
- **Package Manager**: npm
- **IDE**: Claude Code (VS Code compatible)
- **OS**: WSL2 (Ubuntu) on Windows 11

---

## Complete Feature Documentation

### 1. Authentication System

**File**: `src/lib/auth.ts`, `src/components/LoginView.tsx`, `src/components/App.tsx`

**How It Works**:
1. User enters email/password in LoginView
2. Supabase Auth validates credentials and returns session token
3. Token stored in localStorage automatically by Supabase client
4. `getCurrentUser()` checks session validity on page load
5. RLS policies in Supabase ensure users only see their own data
6. Logout clears session via `supabase.auth.signOut()`

**Key Functions** (`src/lib/auth.ts`):
```typescript
export async function getCurrentUser(): Promise<User | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function clearAuth(): Promise<void> {
  await supabase.auth.signOut();
}
```

**LoginView UI**:
- Glassmorphism card with backdrop blur
- Email and password inputs
- "Log In" button with loading state
- Automatically redirects to Dashboard on success

**App.tsx Logic**:
```typescript
useEffect(() => {
  async function checkAuth() {
    const user = await getCurrentUser();
    setCurrentUser(user);
    setLoading(false);
  }
  checkAuth();
}, []);

if (loading) return <div>Loading...</div>;
if (!currentUser) return <LoginView />;
return <Dashboard />;
```

---

### 2. Supplement Management System

**File**: `src/components/SupplementsView.tsx`

**Database Schema** (`supplements` table):
```sql
CREATE TABLE supplements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dose TEXT,
  dose_unit TEXT,
  ingredients JSONB,  -- Array of {name, dose, dose_unit}
  form TEXT,
  section TEXT,  -- "Morning", "Pre-Workout", etc.
  active_days JSONB,  -- [0,1,2,3,4,5,6] for days of week
  frequency_pattern TEXT DEFAULT 'everyday'
    CHECK (frequency_pattern IN ('everyday', '5/2', 'workout', 'custom')),
  is_stack BOOLEAN DEFAULT false,
  stack_id UUID REFERENCES supplements(id) ON DELETE SET NULL,
  "order" INTEGER DEFAULT 0,
  cost DECIMAL(10,2) CHECK (cost IS NULL OR cost >= 0),
  quantity INTEGER CHECK (quantity IS NULL OR quantity >= 0),
  frequency INTEGER DEFAULT 1 CHECK (frequency IS NULL OR frequency >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Form State Management**:
```typescript
const [name, setName] = useState('');
const [dose, setDose] = useState('');
const [doseUnit, setDoseUnit] = useState('mg');
const [section, setSection] = useState('');
const [ingredients, setIngredients] = useState<Ingredient[]>([]);
const [frequencyPattern, setFrequencyPattern] = useState<'everyday' | '5/2' | 'workout' | 'custom'>('everyday');
const [activeDays, setActiveDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
const [notes, setNotes] = useState('');
```

**Ingredient Interface**:
```typescript
export interface Ingredient {
  name: string;
  dose: string;
  dose_unit: string;
}
```

**Single vs Multi-Ingredient Logic**:
- If `ingredients.length === 0`: Single ingredient supplement (use `dose` and `dose_unit` fields)
- If `ingredients.length > 0`: Multi-ingredient supplement (store in `ingredients` JSONB, set `dose` and `dose_unit` to null)

**CRUD Operations**:

**Create**:
```typescript
const supplementData = {
  name,
  dose: ingredients.length > 0 ? null : dose,
  dose_unit: ingredients.length > 0 ? null : doseUnit,
  ingredients: ingredients.length > 0 ? ingredients : null,
  section,
  frequency_pattern: frequencyPattern,
  active_days: calculatedActiveDays,
  notes: notes || null
};

const { data, error } = await supabase
  .from('supplements')
  .insert({ user_id: user.id, ...supplementData })
  .select()
  .single();
```

**Update**:
```typescript
const { error } = await supabase
  .from('supplements')
  .update(supplementData)
  .eq('id', editingSupplement.id);
```

**Delete**:
```typescript
const { error } = await supabase
  .from('supplements')
  .delete()
  .eq('id', id);
```

**Section Dropdown Behavior**:
- Normal supplements: Shows time sections (Morning, Afternoon, Evening, Night)
- Workout supplements (`frequency_pattern === 'workout'`): Shows "Pre-Workout" and "Post-Workout"
- Auto-switches section when frequency pattern changes

**Migration Logic** (fixes old data with invalid sections):
```typescript
useEffect(() => {
  const migrateOldSupplements = async () => {
    if (sections.length === 0 || supplements.length === 0) return;

    const validSectionNames = sections.map(s => s.name);
    const supplementsToFix = supplements.filter(
      s => s.section && !validSectionNames.includes(s.section)
    );

    if (supplementsToFix.length > 0) {
      for (const supplement of supplementsToFix) {
        await supabase
          .from('supplements')
          .update({ section: sections[0].name })
          .eq('id', supplement.id);
      }
      await loadData();
    }
  };

  migrateOldSupplements();
}, [sections, supplements]);
```

**Notes Field**:
- Optional textarea (3 rows)
- Displays in italic text below supplement in list view
- Useful for: "Take with food", "Empty stomach", "Before bed", etc.

---

### 3. Frequency Pattern System

**Purpose**: Control which days a supplement should be taken

**Patterns**:

1. **Everyday** (`'everyday'`)
   - `active_days`: `[0,1,2,3,4,5,6]`
   - Shows in daily logger every day
   - Cost calculation: full daily cost × 7

2. **5/2** (`'5/2'`)
   - `active_days`: `[1,2,3,4,5]` (Monday-Friday)
   - Shows in daily logger only Mon-Fri
   - Cost calculation: daily cost × (5/7)

3. **Workout Days Only** (`'workout'`)
   - `active_days`: `null`
   - Hidden from regular daily view
   - Shows only in Workout Mode (Pre/Post sections)
   - Cost calculation: daily cost × (3.5/7) [assumes 3-4 workouts/week]

4. **Custom Days** (`'custom'`)
   - `active_days`: User-selected array (e.g., `[0,2,4]` for Sun/Tue/Thu)
   - Shows in daily logger only on selected days
   - Cost calculation: daily cost × (active_days.length / 7)

**Filter Logic** (`DailySupplementLogger.tsx:17-40`):
```typescript
const shouldShowToday = (supplement: Supplement): boolean => {
  const today = new Date().getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday

  if (!supplement.frequency_pattern || supplement.frequency_pattern === 'everyday') {
    return true;
  }

  if (supplement.frequency_pattern === '5/2') {
    return today >= 1 && today <= 5; // Mon-Fri only
  }

  if (supplement.frequency_pattern === 'workout') {
    return false; // Filtered from regular view
  }

  if (supplement.frequency_pattern === 'custom' && supplement.active_days) {
    return Array.isArray(supplement.active_days) && supplement.active_days.includes(today);
  }

  return true;
};
```

**Custom Day Selector UI**:
```tsx
{frequencyPattern === 'custom' && (
  <div className="flex gap-2 flex-wrap">
    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
      <button
        key={day}
        type="button"
        onClick={() => {
          if (activeDays.includes(index)) {
            setActiveDays(activeDays.filter(d => d !== index));
          } else {
            setActiveDays([...activeDays, index].sort());
          }
        }}
        className={activeDays.includes(index) ? 'bg-purple-500/30' : 'bg-white/10'}
      >
        {day}
      </button>
    ))}
  </div>
)}
```

---

### 4. Workout Mode

**Purpose**: Separate pre-workout and post-workout supplements from daily supplements

**File**: `src/components/DailySupplementLogger.tsx`

**Toggle Button** (line 270-283):
```tsx
{workoutSupplements.length > 0 && (
  <button
    onClick={() => setIsWorkoutMode(!isWorkoutMode)}
    className={isWorkoutMode
      ? 'bg-orange-500/30 border border-orange-500/40 text-orange-300'
      : 'bg-white/10 border border-white/20 text-white hover:bg-white/20'
    }
  >
    💪 {isWorkoutMode ? 'Exit Workout' : 'Workout'}
  </button>
)}
```

**Data Separation** (line 206-207):
```typescript
const workoutSupplements = supplements.filter(s => s.frequency_pattern === 'workout');
const regularSupplements = supplements.filter(s => s.frequency_pattern !== 'workout' && shouldShowToday(s));
```

**Grouped by Section**:
```typescript
// Workout mode groups by Pre-Workout / Post-Workout
const groupedWorkout = workoutSupplements.reduce((acc, supplement) => {
  const section = supplement.section || 'Pre-Workout';
  if (!acc[section]) acc[section] = [];
  acc[section].push(supplement);
  return acc;
}, {} as Record<string, Supplement[]>);

// Regular mode groups by time sections (Morning, Afternoon, etc.)
const groupedSupplements = regularSupplements.reduce((acc, supplement) => {
  const section = supplement.section || (sectionsList[0]?.name || 'Morning');
  if (!acc[section]) acc[section] = [];
  acc[section].push(supplement);
  return acc;
}, {} as Record<string, Supplement[]>);
```

**Render Logic** (line 314-517):
```typescript
{isWorkoutMode ? (
  // Workout mode - show pre-workout and post-workout sections
  Object.entries(groupedWorkout).map(([section, sectionSupplements]) => (
    <div key={section}>
      <h3>{section}</h3>
      {/* Pre-Workout or Post-Workout supplements */}
    </div>
  ))
) : (
  // Regular mode - show time-based sections
  sections.map((section, sectionIndex) => {
    const sectionSupplements = groupedSupplements[section] || [];
    // Morning, Afternoon, Evening supplements
  })
)}
```

**Active Supplements & Progress**:
```typescript
const activeSupplements = isWorkoutMode ? workoutSupplements : regularSupplements;
const totalSupplements = activeSupplements.length;
const takenCount = activeSupplements.filter(s => logs[s.id!]).length;
```

---

### 5. Daily Logger (Overview Page)

**File**: `src/components/DailySupplementLogger.tsx`

**Database Schema** (`supplement_logs` table):
```sql
CREATE TABLE supplement_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplement_id UUID NOT NULL REFERENCES supplements(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  is_taken BOOLEAN DEFAULT false,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, supplement_id, date)
);
```

**Data Loading**:
```typescript
const loadData = async () => {
  const user = await getCurrentUser();
  if (!user) return;

  // Load ALL supplements (don't filter - needed for workout toggle)
  const { data: supplementsData } = await supabase
    .from('supplements')
    .select('*')
    .eq('user_id', user.id)
    .order('section', { ascending: true })
    .order('order', { ascending: true });

  // Load today's logs
  const today = new Date().toISOString().split('T')[0];
  const { data: logsData } = await supabase
    .from('supplement_logs')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', today);

  setSupplements(supplementsData || []);

  // Build logs lookup object for O(1) access
  const logsMap: Record<string, boolean> = {};
  (logsData || []).forEach((log: SupplementLog) => {
    logsMap[log.supplement_id] = log.is_taken;
  });
  setLogs(logsMap);
};
```

**Toggle Individual Supplement**:
```typescript
const toggleSupplement = async (supplementId: string) => {
  const user = await getCurrentUser();
  if (!user) return;

  const currentValue = logs[supplementId] || false;
  const newValue = !currentValue;

  // Optimistic update (immediate UI feedback)
  setLogs(prev => ({ ...prev, [supplementId]: newValue }));

  // Upsert to database (create or update)
  const { error } = await supabase
    .from('supplement_logs')
    .upsert({
      user_id: user.id,
      supplement_id: supplementId,
      date: today,
      is_taken: newValue,
      timestamp: new Date().toISOString()
    }, {
      onConflict: 'user_id,supplement_id,date'
    });

  if (error) {
    // Revert optimistic update on error
    setLogs(prev => ({ ...prev, [supplementId]: !newValue }));
    alert('Failed to update supplement log');
  }
};
```

**Toggle Entire Section**:
```typescript
const toggleSection = async (section: string, newValue: boolean) => {
  const user = await getCurrentUser();
  if (!user) return;

  const sectionSupplements = groupedSupplements[section] || [];

  // Optimistic update for all supplements in section
  const updates: Record<string, boolean> = {};
  sectionSupplements.forEach(supplement => {
    if (supplement.id) {
      updates[supplement.id] = newValue;
    }
  });
  setLogs(prev => ({ ...prev, ...updates }));

  // Batch upsert all supplements in section
  const upsertData = sectionSupplements
    .filter(s => s.id)
    .map(supplement => ({
      user_id: user.id,
      supplement_id: supplement.id!,
      date: today,
      is_taken: newValue,
      timestamp: new Date().toISOString()
    }));

  const { error } = await supabase
    .from('supplement_logs')
    .upsert(upsertData, {
      onConflict: 'user_id,supplement_id,date'
    });

  if (error) {
    alert('Failed to update section');
    await loadData(); // Reload to revert
  }
};
```

**Timeline Dot Colors**:
```typescript
const sectionTakenCount = sectionSupplements.filter(s => logs[s.id!]).length;
const sectionTotal = sectionSupplements.length;
const allTaken = sectionTakenCount === sectionTotal;
const someTaken = sectionTakenCount > 0 && sectionTakenCount < sectionTotal;

<div className={`absolute left-6 top-2 w-5 h-5 rounded-full border-4 backdrop-blur-xl ${
  allTaken
    ? 'bg-green-500 border-green-500/50'
    : someTaken
    ? 'bg-yellow-500 border-yellow-500/50'
    : 'bg-white/30 border-purple-500/50'
}`} />
```

**Progress Bar**:
```tsx
<div className="text-2xl font-bold text-white">
  {takenCount} / {totalSupplements} taken today
</div>
<div className="w-full bg-white/20 rounded-full h-3 mt-2">
  <div
    className="bg-green-500 h-3 rounded-full transition-all duration-300"
    style={{ width: `${totalSupplements > 0 ? (takenCount / totalSupplements) * 100 : 0}%` }}
  />
</div>
```

**Notes Display** (line 487-491):
```tsx
{supplement.notes && (
  <div className="text-white/50 text-xs mt-1 italic">
    {supplement.notes}
  </div>
)}
```

---

### 6. Cost Calculator

**File**: `src/components/CostCalculator.tsx`

**Fields**:
- **Cost** ($): Total cost of bottle/package
- **Quantity**: Number of servings in bottle
- **Per Day**: How many times per day you take it

**Calculation Formula**:
```typescript
const calculateDailyCost = (supp: SupplementCost): number => {
  if (!supp.cost || !supp.quantity || !supp.frequency) return 0;

  const costPerUnit = supp.cost / supp.quantity;
  const dailyCost = costPerUnit * supp.frequency;

  // Adjust for frequency pattern
  if (supp.frequency_pattern === '5/2') {
    return dailyCost * (5 / 7); // Mon-Fri only
  } else if (supp.frequency_pattern === 'workout') {
    return dailyCost * (3.5 / 7); // Assumes 3-4 workouts/week
  } else if (supp.frequency_pattern === 'custom' && supp.active_days) {
    const activeDaysCount = Array.isArray(supp.active_days) ? supp.active_days.length : 0;
    return dailyCost * (activeDaysCount / 7);
  }

  return dailyCost; // 'everyday' or no pattern
};
```

**Example**:
- Supplement: "Fish Oil"
- Cost: $20.00
- Quantity: 60 capsules
- Per Day: 2 capsules
- Frequency Pattern: "5/2" (Mon-Fri only)

Calculation:
1. Cost per capsule: $20 / 60 = $0.333
2. Daily cost (if taken every day): $0.333 × 2 = $0.667
3. Adjusted for 5/2: $0.667 × (5/7) = **$0.476/day**
4. Weekly: $0.476 × 7 = **$3.33/week**
5. Monthly: $0.476 × 30 = **$14.29/month**

**Update Cost Fields**:
```typescript
const updateCost = async (id: string, field: 'cost' | 'quantity' | 'frequency', value: number) => {
  const previousValue = supplements.find(s => s.id === id)?.[field];

  // Optimistic update
  setSupplements(prev => prev.map(s =>
    s.id === id ? { ...s, [field]: value } : s
  ));

  // Save to database
  try {
    const { error } = await supabase
      .from('supplements')
      .update({ [field]: value })
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    // Revert on error
    setSupplements(prev => prev.map(s =>
      s.id === id ? { ...s, [field]: previousValue } : s
    ));
    alert('Failed to update. Please run the SQL migration in COMPLETE_DATABASE.sql');
  }
};
```

**Summary Cards**:
```tsx
<div className="grid grid-cols-3 gap-4 mb-8">
  <div>
    <div className="text-white/70 text-sm">Daily</div>
    <div className="text-2xl font-bold text-white">${totalDailyCost.toFixed(2)}</div>
  </div>
  <div>
    <div className="text-white/70 text-sm">Weekly</div>
    <div className="text-2xl font-bold text-white">${totalWeeklyCost.toFixed(2)}</div>
  </div>
  <div>
    <div className="text-white/70 text-sm">Monthly</div>
    <div className="text-2xl font-bold text-white">${totalMonthlyCost.toFixed(2)}</div>
  </div>
</div>
```

---

### 7. Section Management

**File**: `src/components/SectionsView.tsx`

**Database Schema** (`supplement_sections` table):
```sql
CREATE TABLE supplement_sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);
```

**Default Sections** (auto-created if none exist):
```typescript
const defaults = ['Morning', 'Afternoon', 'Evening', 'Night'];
const defaultSections = defaults.map((name, i) => ({
  user_id: user.id,
  name,
  order: i
}));

await supabase
  .from('supplement_sections')
  .insert(defaultSections);
```

**Reorder Sections**:
```typescript
const moveSection = async (index: number, direction: 'up' | 'down') => {
  const newIndex = direction === 'up' ? index - 1 : index + 1;
  if (newIndex < 0 || newIndex >= sections.length) return;

  const newSections = [...sections];
  [newSections[index], newSections[newIndex]] = [newSections[newIndex], newSections[index]];
  setSections(newSections);

  // Update order in database for all sections
  for (let i = 0; i < newSections.length; i++) {
    await supabase
      .from('supplement_sections')
      .update({ order: i })
      .eq('id', newSections[i].id);
  }
};
```

**Delete Section**:
```typescript
const handleDelete = async (id: string) => {
  if (!confirm('Are you sure you want to delete this section?')) return;

  const { error } = await supabase
    .from('supplement_sections')
    .delete()
    .eq('id', id);

  if (error) {
    alert('Failed to delete section');
  } else {
    await loadData();
  }
};
```

**UI**:
- List of sections with order number
- ↑ ↓ arrow buttons for reordering
- Delete button (⨯)
- "Add Section" form at top

---

### 8. Animated Title

**File**: `src/components/AnimatedTitle.tsx`

**Behavior**:
1. Letters of "Health🩺Hub" cycle through fonts one at a time (left to right)
2. Active letter has thin underline
3. When cycle reaches last letter, emoji spins (slot machine effect)
4. Cycle repeats infinitely

**Implementation**:
```typescript
const FONTS = [
  'font-sans',
  'font-serif',
  'font-mono',
  'font-bold',
  'italic',
  'font-light'
];

const EMOJIS = ['💊', '🩺', '⚕️', '🧪', '💉', '🏥', '📋'];

const [letterFonts, setLetterFonts] = useState<number[]>([]);
const [activeLetterIndex, setActiveLetterIndex] = useState(0);
const [emoji, setEmoji] = useState('💊');
const [isSpinning, setIsSpinning] = useState(false);

useEffect(() => {
  // Initialize with random fonts
  setLetterFonts(LETTERS.map(() => Math.floor(Math.random() * FONTS.length)));

  const letterCount = LETTERS.length;
  let currentLetterIndex = 0;

  const letterInterval = setInterval(() => {
    const nextIndex = (currentLetterIndex + 1) % letterCount;
    const finalNextIndex = nextIndex === 6 ? (nextIndex + 1) % letterCount : nextIndex; // Skip emoji
    const isLastLetter = finalNextIndex === 0 && currentLetterIndex === 9;

    setActiveLetterIndex(finalNextIndex);

    // Change CURRENT letter font before moving (not the emoji)
    if (currentLetterIndex !== 6) {
      setLetterFonts(prev => {
        const next = [...prev];
        next[currentLetterIndex] = Math.floor(Math.random() * FONTS.length);
        return next;
      });
    }

    // Emoji slot machine at end of cycle
    if (isLastLetter) {
      setIsSpinning(true);
      let spinCount = 0;
      const spinInterval = setInterval(() => {
        setEmoji(EMOJIS[Math.floor(Math.random() * EMOJIS.length)]);
        spinCount++;
        if (spinCount >= 15) { // 15 spins at 50ms = 750ms total
          clearInterval(spinInterval);
          setIsSpinning(false);
          setEmoji(EMOJIS[Math.floor(Math.random() * EMOJIS.length)]);
        }
      }, 50);
    }

    currentLetterIndex = finalNextIndex;
  }, 600); // 600ms per letter

  return () => {
    clearInterval(letterInterval);
  };
}, []);
```

**Render**:
```tsx
<div className="flex items-center gap-1">
  {LETTERS.map((letter, index) => (
    <div key={index} className="relative">
      {index === 6 ? (
        <motion.span
          animate={isSpinning ? { rotateX: 360 } : {}}
          transition={{ duration: 0.05 }}
          className="text-4xl"
        >
          {emoji}
        </motion.span>
      ) : (
        <>
          <span className={`text-4xl font-bold ${FONTS[letterFonts[index]]}`}>
            {letter}
          </span>
          {activeLetterIndex === index && (
            <motion.div
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-400"
              layoutId="underline"
            />
          )}
        </>
      )}
    </div>
  ))}
</div>
```

---

### 9. Import/Export System

**File**: `src/components/Dashboard.tsx`

**CSV Export**:
```typescript
const handleExportCSV = async () => {
  const user = await getCurrentUser();
  if (!user) return;

  const { data: supplements } = await supabase
    .from('supplements')
    .select('*')
    .eq('user_id', user.id);

  const csvHeader = 'Name,Dose,Dose Unit,Section,Ingredients (JSON),Notes\n';
  const csvRows = (supplements || []).map(s =>
    `${escapeCsvField(s.name)},${escapeCsvField(s.dose || '')},${escapeCsvField(s.dose_unit || '')},${escapeCsvField(s.section || '')},${escapeCsvField(s.ingredients ? JSON.stringify(s.ingredients) : '')},${escapeCsvField(s.notes || '')}`
  ).join('\n');
  const csv = csvHeader + csvRows;

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `supplements-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
```

**Formula Injection Prevention**:
```typescript
const escapeCsvField = (field: any): string => {
  if (field == null) return '';
  let str = String(field);

  // Prevent formula injection (Excel vulnerability)
  if (/^[=+\-@]/.test(str)) {
    str = "'" + str;
  }

  // Escape quotes and wrap if needed
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
};
```

**CSV Import**:
```typescript
const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;

  const user = await getCurrentUser();
  if (!user) return;

  // Get available sections
  const { data: sectionsData } = await supabase
    .from('supplement_sections')
    .select('*')
    .eq('user_id', user.id)
    .order('order', { ascending: true });

  const sections = sectionsData || [];

  if (sections.length === 0) {
    alert('Please create at least one section before importing supplements.');
    return;
  }

  const text = await file.text();
  const lines = text.split('\n').filter(l => l.trim());

  const supplements = lines.slice(1).map(line => {
    // Match quoted fields and unquoted fields
    const values = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g)?.map(v => v.replace(/^"|"$/g, '').trim()) || [];

    const name = values[0];
    const dose = values[1] || null;
    const dose_unit = values[2] || null;
    let section = values[3] || null;
    const ingredientsStr = values[4];
    const notes = values[5] || null;

    // Check if section exists
    if (!section || !sections.find(s => s.name === section)) {
      section = null; // Will be assigned later
    }

    let ingredients = null;
    if (ingredientsStr) {
      try {
        ingredients = JSON.parse(ingredientsStr);
      } catch (e) {
        console.error('Invalid JSON for ingredients:', ingredientsStr);
      }
    }

    return {
      user_id: user.id,
      name,
      dose,
      dose_unit,
      section,
      ingredients,
      notes,
      active_days: null
    };
  }).filter(s => s.name);

  // Check if any supplements are missing sections
  const missingSection = supplements.filter(s => !s.section);

  if (missingSection.length > 0) {
    const sectionNames = sections.map(s => s.name).join(', ');
    const selectedSection = prompt(
      `${missingSection.length} supplement(s) have no section or invalid section.\n\nAvailable sections: ${sectionNames}\n\nEnter section name to assign to all of them:`,
      sections[0].name
    );

    if (!selectedSection) {
      alert('Import cancelled.');
      return;
    }

    if (!sections.find(s => s.name === selectedSection)) {
      alert(`Section "${selectedSection}" does not exist. Import cancelled.`);
      return;
    }

    missingSection.forEach(s => s.section = selectedSection);
  }

  const { error } = await supabase
    .from('supplements')
    .insert(supplements);

  if (error) throw error;

  alert(`Successfully imported ${supplements.length} supplements!`);
  window.location.reload();
};
```

**Template Download**:
```typescript
const handleDownloadTemplate = () => {
  const template = `Name,Dose,Dose Unit,Section,Ingredients (JSON),Notes
Vitamin D,1000,IU,Morning,,Take with food
Omega-3,2,capsules,Morning,,
Multi-Vitamin,,,Morning,"[{""name"":""Vitamin A"",""dose"":""5000"",""dose_unit"":""IU""},{""name"":""Vitamin C"",""dose"":""500"",""dose_unit"":""mg""}]",Daily multivitamin`;

  const blob = new Blob([template], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'supplements-template.csv';
  a.click();
  URL.revokeObjectURL(url);
};
```

**JSON Export** (for backups):
```typescript
const handleExportJSON = async () => {
  const user = await getCurrentUser();
  if (!user) return;

  const { data: supplements } = await supabase
    .from('supplements')
    .select('*')
    .eq('user_id', user.id);

  const { data: logs } = await supabase
    .from('supplement_logs')
    .select('*')
    .eq('user_id', user.id);

  const exportData = {
    exported_at: new Date().toISOString(),
    user_id: user.id,
    supplements: supplements || [],
    logs: logs || []
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `supplements-export-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
};
```

---

## Offline-First Architecture (v0.9.0)

### Problem Statement
**Before offline support**:
- App required internet connection to function
- All operations directly hit Supabase API
- No service = app completely unusable
- Data loss if offline when logging supplements

**After offline support**:
- App works 100% offline
- All data cached locally in IndexedDB
- Changes queued for sync when online
- Automatic background sync when connection returns
- Multi-device sync with conflict resolution

---

### IndexedDB Schema

**File**: `src/lib/db.ts`

**Object Stores**:

1. **supplements**
   - keyPath: `id`
   - Indexes: `user_id`, `section`
   - Mirrors Supabase supplements table

2. **supplement_logs**
   - keyPath: `id`
   - Indexes: `user_id`, `date`, `supplement_id`
   - Mirrors Supabase supplement_logs table

3. **supplement_sections**
   - keyPath: `id`
   - Indexes: `user_id`
   - Mirrors Supabase supplement_sections table

4. **sync_queue**
   - keyPath: `id` (autoIncrement)
   - Indexes: `synced`, `timestamp`
   - Stores pending operations for sync

5. **metadata**
   - keyPath: `key`
   - Stores lastSync timestamp, version, etc.

**SyncQueueItem Interface**:
```typescript
export interface SyncQueueItem {
  id?: number;  // Auto-generated by IndexedDB
  type: 'supplement' | 'supplement_log' | 'supplement_section';
  operation: 'create' | 'update' | 'delete';
  data: any;  // The actual supplement/log/section data
  localId?: string;  // Temporary ID for offline-created items
  serverId?: string;  // Supabase UUID after sync
  timestamp: number;  // When operation was queued
  synced: boolean;  // false until successfully synced
  error?: string;  // Error message if sync failed
}
```

**OfflineDB Class Methods**:

```typescript
class OfflineDB {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    // Opens IndexedDB, creates object stores if needed
    // Called on app startup
  }

  async getAll<T>(storeName: string, indexName?: string, indexValue?: any): Promise<T[]> {
    // Returns all items from a store, optionally filtered by index
    // Example: getAll('supplements', 'user_id', 'user-123')
  }

  async get<T>(storeName: string, id: string): Promise<T | undefined> {
    // Returns single item by ID
  }

  async put(storeName: string, data: any): Promise<void> {
    // Insert or update item (upsert)
  }

  async delete(storeName: string, id: string): Promise<void> {
    // Delete item by ID
  }

  async clear(storeName: string): Promise<void> {
    // Delete all items in store
  }

  async addToSyncQueue(item: Omit<SyncQueueItem, 'id'>): Promise<void> {
    // Add operation to sync queue
  }

  async getPendingSyncItems(): Promise<SyncQueueItem[]> {
    // Get all items where synced = false
  }

  async markSynced(id: number, serverId?: string, error?: string): Promise<void> {
    // Mark sync item as synced (or failed with error)
  }

  async clearSyncedItems(): Promise<void> {
    // Delete all successfully synced items from queue
  }

  async setMetadata(key: string, value: any): Promise<void> {
    // Store metadata (lastSync, version, etc.)
  }

  async getMetadata(key: string): Promise<any> {
    // Retrieve metadata
  }
}
```

**Database Initialization** (onupgradeneeded):
```typescript
request.onupgradeneeded = (event) => {
  const db = (event.target as IDBOpenDBRequest).result;

  // Supplements store
  if (!db.objectStoreNames.contains('supplements')) {
    const supplementsStore = db.createObjectStore('supplements', { keyPath: 'id' });
    supplementsStore.createIndex('user_id', 'user_id', { unique: false });
    supplementsStore.createIndex('section', 'section', { unique: false });
  }

  // Supplement logs store
  if (!db.objectStoreNames.contains('supplement_logs')) {
    const logsStore = db.createObjectStore('supplement_logs', { keyPath: 'id' });
    logsStore.createIndex('user_id', 'user_id', { unique: false });
    logsStore.createIndex('date', 'date', { unique: false });
    logsStore.createIndex('supplement_id', 'supplement_id', { unique: false });
  }

  // Supplement sections store
  if (!db.objectStoreNames.contains('supplement_sections')) {
    const sectionsStore = db.createObjectStore('supplement_sections', { keyPath: 'id' });
    sectionsStore.createIndex('user_id', 'user_id', { unique: false });
  }

  // Sync queue store
  if (!db.objectStoreNames.contains('sync_queue')) {
    const syncStore = db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
    syncStore.createIndex('synced', 'synced', { unique: false });
    syncStore.createIndex('timestamp', 'timestamp', { unique: false });
  }

  // Metadata store
  if (!db.objectStoreNames.contains('metadata')) {
    db.createObjectStore('metadata', { keyPath: 'key' });
  }
};
```

---

### Sync Manager

**File**: `src/lib/syncManager.ts`

**SyncManager Class**:
```typescript
class SyncManager {
  private isOnline: boolean = navigator.onLine;
  private syncInProgress: boolean = false;
  private listeners: Set<(online: boolean) => void> = new Set();

  constructor() {
    // Listen for online/offline events
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  private handleOnline() {
    console.log('🟢 Connection restored');
    this.isOnline = true;
    this.notifyListeners();
    this.syncAll(); // Auto-sync when connection returns
  }

  private handleOffline() {
    console.log('🔴 Connection lost - switching to offline mode');
    this.isOnline = false;
    this.notifyListeners();
  }

  public onConnectionChange(callback: (online: boolean) => void) {
    // Subscribe to connection status changes
    // Returns unsubscribe function
    this.listeners.add(callback);
    callback(this.isOnline); // Call immediately with current status
    return () => this.listeners.delete(callback);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.isOnline));
  }

  public getOnlineStatus(): boolean {
    return this.isOnline;
  }

  // Generate temporary local ID for offline-created items
  private generateLocalId(): string {
    return `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    // Example: "local_1696284653123_k7g3f5h2w"
  }

  // Sync all pending operations
  async syncAll(): Promise<void> {
    if (this.syncInProgress || !this.isOnline) {
      console.log('Sync skipped:', this.syncInProgress ? 'already in progress' : 'offline');
      return;
    }

    this.syncInProgress = true;
    console.log('🔄 Starting sync...');

    try {
      const pendingItems = await db.getPendingSyncItems();
      console.log(`📋 ${pendingItems.length} items to sync`);

      // Sort by timestamp to maintain order
      pendingItems.sort((a, b) => a.timestamp - b.timestamp);

      for (const item of pendingItems) {
        try {
          await this.syncItem(item);
        } catch (error) {
          console.error('Failed to sync item:', item, error);
          await db.markSynced(item.id!, undefined, (error as Error).message);
        }
      }

      // Clean up synced items
      await db.clearSyncedItems();
      console.log('✅ Sync complete');
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  private async syncItem(item: SyncQueueItem): Promise<void> {
    const { type, operation, data, localId, serverId } = item;

    console.log(`Syncing ${operation} ${type}:`, data.name || data.id);

    if (type === 'supplement') {
      await this.syncSupplement(operation, data, localId, serverId, item.id!);
    } else if (type === 'supplement_log') {
      await this.syncSupplementLog(operation, data, localId, serverId, item.id!);
    } else if (type === 'supplement_section') {
      await this.syncSupplementSection(operation, data, localId, serverId, item.id!);
    }
  }

  private async syncSupplement(
    operation: string,
    data: any,
    localId: string | undefined,
    serverId: string | undefined,
    queueId: number
  ): Promise<void> {
    if (operation === 'create') {
      // Insert into Supabase
      const { error, data: result } = await supabase
        .from('supplements')
        .insert(data)
        .select()
        .single();

      if (error) throw error;

      // Update local DB: replace local ID with server ID
      if (localId && result) {
        await db.delete('supplements', localId);
        await db.put('supplements', result);
      }

      await db.markSynced(queueId, result.id);
    } else if (operation === 'update') {
      // Update in Supabase
      const { error } = await supabase
        .from('supplements')
        .update(data)
        .eq('id', serverId || data.id);

      if (error) throw error;

      // Update local DB
      await db.put('supplements', { ...data, id: serverId || data.id });
      await db.markSynced(queueId);
    } else if (operation === 'delete') {
      // Delete from Supabase
      const { error } = await supabase
        .from('supplements')
        .delete()
        .eq('id', serverId || data.id);

      if (error) throw error;

      // Remove from local DB
      await db.delete('supplements', serverId || data.id);
      await db.markSynced(queueId);
    }
  }

  private async syncSupplementLog(
    operation: string,
    data: any,
    localId: string | undefined,
    serverId: string | undefined,
    queueId: number
  ): Promise<void> {
    if (operation === 'create' || operation === 'update') {
      // Use upsert for logs (handles both create and update)
      const { error, data: result } = await supabase
        .from('supplement_logs')
        .upsert(data, {
          onConflict: 'user_id,supplement_id,date'
        })
        .select()
        .single();

      if (error) throw error;

      // Update local DB
      if (localId && result) {
        await db.delete('supplement_logs', localId);
        await db.put('supplement_logs', result);
      } else if (result) {
        await db.put('supplement_logs', result);
      }

      await db.markSynced(queueId, result.id);
    } else if (operation === 'delete') {
      const { error } = await supabase
        .from('supplement_logs')
        .delete()
        .eq('id', serverId || data.id);

      if (error) throw error;

      await db.delete('supplement_logs', serverId || data.id);
      await db.markSynced(queueId);
    }
  }

  private async syncSupplementSection(
    operation: string,
    data: any,
    localId: string | undefined,
    serverId: string | undefined,
    queueId: number
  ): Promise<void> {
    if (operation === 'create') {
      const { error, data: result } = await supabase
        .from('supplement_sections')
        .insert(data)
        .select()
        .single();

      if (error) throw error;

      if (localId && result) {
        await db.delete('supplement_sections', localId);
        await db.put('supplement_sections', result);
      }

      await db.markSynced(queueId, result.id);
    } else if (operation === 'update') {
      const { error } = await supabase
        .from('supplement_sections')
        .update(data)
        .eq('id', serverId || data.id);

      if (error) throw error;

      await db.put('supplement_sections', { ...data, id: serverId || data.id });
      await db.markSynced(queueId);
    } else if (operation === 'delete') {
      const { error } = await supabase
        .from('supplement_sections')
        .delete()
        .eq('id', serverId || data.id);

      if (error) throw error;

      await db.delete('supplement_sections', serverId || data.id);
      await db.markSynced(queueId);
    }
  }

  // Initial data sync from Supabase to IndexedDB
  async initialSync(userId: string): Promise<void> {
    if (!this.isOnline) {
      console.log('Offline - skipping initial sync');
      return;
    }

    console.log('📥 Fetching data from Supabase...');

    try {
      // Fetch supplements
      const { data: supplements } = await supabase
        .from('supplements')
        .select('*')
        .eq('user_id', userId);

      if (supplements) {
        await db.clear('supplements');
        for (const supplement of supplements) {
          await db.put('supplements', supplement);
        }
        console.log(`✅ Synced ${supplements.length} supplements`);
      }

      // Fetch logs (last 30 days to limit data)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: logs } = await supabase
        .from('supplement_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('date', thirtyDaysAgo.toISOString().split('T')[0]);

      if (logs) {
        await db.clear('supplement_logs');
        for (const log of logs) {
          await db.put('supplement_logs', log);
        }
        console.log(`✅ Synced ${logs.length} logs`);
      }

      // Fetch sections
      const { data: sections } = await supabase
        .from('supplement_sections')
        .select('*')
        .eq('user_id', userId);

      if (sections) {
        await db.clear('supplement_sections');
        for (const section of sections) {
          await db.put('supplement_sections', section);
        }
        console.log(`✅ Synced ${sections.length} sections`);
      }

      await db.setMetadata('lastSync', Date.now());
      console.log('✅ Initial sync complete');
    } catch (error) {
      console.error('Initial sync failed:', error);
      throw error;
    }
  }

  // Queue an operation for later sync
  async queueOperation(
    type: 'supplement' | 'supplement_log' | 'supplement_section',
    operation: 'create' | 'update' | 'delete',
    data: any,
    serverId?: string
  ): Promise<string> {
    const localId = data.id || this.generateLocalId();

    await db.addToSyncQueue({
      type,
      operation,
      data: { ...data, id: localId },
      localId: operation === 'create' ? localId : undefined,
      serverId: serverId || (operation !== 'create' ? data.id : undefined),
      timestamp: Date.now(),
      synced: false
    });

    // If online, sync immediately
    if (this.isOnline) {
      this.syncAll().catch(console.error);
    }

    return localId;
  }
}

export const syncManager = new SyncManager();
```

---

### Offline Data Layer

**File**: `src/lib/offlineData.ts`

**Purpose**: Wrapper around Supabase operations that works offline-first

**Architecture**:
1. All reads come from IndexedDB (instant, works offline)
2. All writes go to IndexedDB immediately (optimistic UI)
3. Writes are queued for background sync to Supabase
4. When online, queue is automatically processed

**offlineData API**:
```typescript
export const offlineData = {
  // Initialize offline database
  async init(userId: string): Promise<void> {
    await db.init();
    if (syncManager.getOnlineStatus()) {
      await syncManager.initialSync(userId);
    }
  },

  // Supplements operations
  supplements: {
    async getAll(userId: string): Promise<Supplement[]> {
      // Read from IndexedDB (works offline)
      const supplements = await db.getAll<Supplement>('supplements', 'user_id', userId);
      return supplements;
    },

    async create(supplement: Supplement): Promise<Supplement> {
      const localId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const suppWithId = { ...supplement, id: localId };

      // Save to IndexedDB immediately (optimistic)
      await db.put('supplements', suppWithId);

      // Queue for sync
      await syncManager.queueOperation('supplement', 'create', supplement);

      return suppWithId;
    },

    async update(id: string, updates: Partial<Supplement>): Promise<void> {
      // Get current data
      const current = await db.get<Supplement>('supplements', id);
      if (!current) throw new Error('Supplement not found');

      const updated = { ...current, ...updates };

      // Update IndexedDB immediately (optimistic)
      await db.put('supplements', updated);

      // Queue for sync
      await syncManager.queueOperation('supplement', 'update', updated, id);
    },

    async delete(id: string): Promise<void> {
      // Delete from IndexedDB immediately (optimistic)
      await db.delete('supplements', id);

      // Queue for sync
      await syncManager.queueOperation('supplement', 'delete', { id }, id);
    }
  },

  // Supplement logs operations
  logs: {
    async getByUserAndDate(userId: string, date: string): Promise<SupplementLog[]> {
      // Get all logs for user, then filter by date
      const allLogs = await db.getAll<SupplementLog>('supplement_logs', 'user_id', userId);
      return allLogs.filter(log => log.date === date);
    },

    async upsert(log: SupplementLog): Promise<SupplementLog> {
      // Generate ID if needed
      const logWithId = {
        ...log,
        id: log.id || `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: log.timestamp || new Date().toISOString()
      };

      // Save to IndexedDB immediately (optimistic)
      await db.put('supplement_logs', logWithId);

      // Queue for sync
      await syncManager.queueOperation('supplement_log', 'create', log);

      return logWithId;
    },

    async delete(id: string): Promise<void> {
      // Delete from IndexedDB immediately (optimistic)
      await db.delete('supplement_logs', id);

      // Queue for sync
      await syncManager.queueOperation('supplement_log', 'delete', { id }, id);
    }
  },

  // Supplement sections operations
  sections: {
    async getAll(userId: string): Promise<SupplementSection[]> {
      const sections = await db.getAll<SupplementSection>('supplement_sections', 'user_id', userId);
      return sections.sort((a, b) => (a.order || 0) - (b.order || 0));
    },

    async create(section: SupplementSection): Promise<SupplementSection> {
      const localId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const sectionWithId = { ...section, id: localId };

      // Save to IndexedDB immediately (optimistic)
      await db.put('supplement_sections', sectionWithId);

      // Queue for sync
      await syncManager.queueOperation('supplement_section', 'create', section);

      return sectionWithId;
    },

    async update(id: string, updates: Partial<SupplementSection>): Promise<void> {
      // Get current data
      const current = await db.get<SupplementSection>('supplement_sections', id);
      if (!current) throw new Error('Section not found');

      const updated = { ...current, ...updates };

      // Update IndexedDB immediately (optimistic)
      await db.put('supplement_sections', updated);

      // Queue for sync
      await syncManager.queueOperation('supplement_section', 'update', updated, id);
    },

    async delete(id: string): Promise<void> {
      // Delete from IndexedDB immediately (optimistic)
      await db.delete('supplement_sections', id);

      // Queue for sync
      await syncManager.queueOperation('supplement_section', 'delete', { id }, id);
    }
  },

  // Connection status
  onConnectionChange(callback: (online: boolean) => void): () => void {
    return syncManager.onConnectionChange(callback);
  },

  isOnline(): boolean {
    return syncManager.getOnlineStatus();
  }
};
```

---

### How Offline Sync Works (Example Flow)

**Scenario**: User goes offline, logs 3 supplements, comes back online

**Step 1: User goes offline**
```
window.dispatchEvent(new Event('offline'))
↓
syncManager.handleOffline()
↓
isOnline = false
notifyListeners() // UI shows offline badge
```

**Step 2: User logs supplements while offline**
```
User clicks supplement checkbox
↓
toggleSupplement(supplementId)
↓
offlineData.logs.upsert({
  user_id: 'user-123',
  supplement_id: 'supp-456',
  date: '2025-10-02',
  is_taken: true
})
↓
Generate local ID: "local_1696284653123_k7g3f5h2w"
↓
db.put('supplement_logs', { id: localId, ... })  // Save to IndexedDB
↓
db.addToSyncQueue({
  type: 'supplement_log',
  operation: 'create',
  data: { id: localId, ... },
  localId: localId,
  timestamp: 1696284653123,
  synced: false
})
↓
syncManager.queueOperation() checks isOnline = false
↓
Sync skipped (offline)
↓
UI updates immediately (optimistic update)
```

**User logs 2 more supplements**:
```
Same flow, 3 total items in sync queue
IndexedDB: 3 new logs with local IDs
Supabase: No changes yet (offline)
```

**Step 3: Connection returns**
```
window.dispatchEvent(new Event('online'))
↓
syncManager.handleOnline()
↓
isOnline = true
notifyListeners() // UI shows online badge
↓
syncManager.syncAll()
↓
db.getPendingSyncItems() → [3 items]
↓
Sort by timestamp (maintain order)
↓
For each item:
  syncItem(item)
  ↓
  supabase.from('supplement_logs').upsert(data)
  ↓
  Supabase returns: { id: 'real-uuid-789', ... }
  ↓
  db.delete('supplement_logs', localId) // Remove local ID
  db.put('supplement_logs', { id: 'real-uuid-789', ... }) // Replace with server ID
  ↓
  db.markSynced(queueItemId, 'real-uuid-789')
↓
All 3 items synced successfully
↓
db.clearSyncedItems() // Remove from queue
↓
console.log('✅ Sync complete')
```

**Final State**:
```
IndexedDB: 3 logs with server IDs
Supabase: 3 logs with same IDs
Sync queue: Empty
```

---

### Conflict Resolution Strategy

**Current Implementation**: Last-Write-Wins (LWW)

**How it works**:
1. Each operation has a timestamp
2. Sync queue processes in chronological order
3. Supabase's `upsert()` with `onConflict` handles duplicates
4. If two devices edit same item offline:
   - Both queue their changes with timestamps
   - When both come online, they sync in order
   - Last sync overwrites previous (based on timestamp)

**Example Conflict**:
```
Device A (offline): Updates supplement dose to "500mg" at 10:00 AM
Device B (offline): Updates same supplement dose to "1000mg" at 10:05 AM

Both come online at 10:10 AM:

Device A syncs first:
  supabase.update(supplement).set({ dose: "500mg" })

Device B syncs second:
  supabase.update(supplement).set({ dose: "1000mg" })

Final result: "1000mg" (last write wins)
```

**Future Enhancement**:
- Could implement CRDT (Conflict-free Replicated Data Types)
- Or show conflict resolution UI to user
- Or use version vectors for true multi-device sync

---

### Component Migration (Not Yet Done)

**Next Step**: Update all components to use `offlineData` instead of `supabase` directly

**Example Migration** (DailySupplementLogger.tsx):

**Before**:
```typescript
const { data: supplementsData } = await supabase
  .from('supplements')
  .select('*')
  .eq('user_id', user.id);

setSupplements(supplementsData || []);
```

**After**:
```typescript
const supplementsData = await offlineData.supplements.getAll(user.id);
setSupplements(supplementsData);
```

**Before**:
```typescript
const { error } = await supabase
  .from('supplement_logs')
  .upsert({
    user_id: user.id,
    supplement_id: supplementId,
    date: today,
    is_taken: newValue,
    timestamp: new Date().toISOString()
  });
```

**After**:
```typescript
await offlineData.logs.upsert({
  user_id: user.id,
  supplement_id: supplementId,
  date: today,
  is_taken: newValue
});
```

---

## Complete File Structure

```
healthhub/
├── docker-compose.yml              # Docker config (Vite dev server on port 3000)
├── package.json                    # Dependencies
├── package-lock.json
├── tsconfig.json                   # TypeScript config
├── vite.config.ts                  # Vite config
├── tailwind.config.js              # TailwindCSS config
├── index.html                      # Entry point
├── COMPLETE_DATABASE.sql           # Complete Supabase schema (run this!)
├── WEB_PROJECT_LOG.md              # This file
│
├── src/
│   ├── main.tsx                    # React entry point
│   ├── index.css                   # Global styles (Tailwind imports)
│   │
│   ├── lib/
│   │   ├── supabase.ts             # Supabase client + TypeScript interfaces
│   │   ├── auth.ts                 # Auth helpers (getCurrentUser, clearAuth)
│   │   ├── db.ts                   # IndexedDB wrapper (OfflineDB class)
│   │   ├── syncManager.ts          # Sync orchestration (online/offline detection)
│   │   └── offlineData.ts          # Offline-aware data layer (NOT YET USED)
│   │
│   └── components/
│       ├── App.tsx                 # Main app (auth check, shows LoginView or Dashboard)
│       ├── LoginView.tsx           # Login screen
│       ├── Dashboard.tsx           # Main layout (tabs, import/export)
│       ├── AnimatedTitle.tsx       # "Health🩺Hub" animated title
│       ├── DailySupplementLogger.tsx  # Overview timeline + workout mode
│       ├── SupplementsView.tsx     # Supplement CRUD + form
│       ├── SectionsView.tsx        # Section management
│       └── CostCalculator.tsx      # Cost tracking and calculations
│
├── .gitignore
└── .git/
    └── index.lock                  # BLOCKED - user must remove to commit
```

---

## Environment Setup

**.env file** (create in project root):
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Docker Compose** (docker-compose.yml):
```yaml
services:
  healthhub-webapp:
    image: node:22
    working_dir: /app
    volumes:
      - .:/app
    ports:
      - "3000:3000"
    command: sh -c "npm install && npm run dev -- --host 0.0.0.0"
```

**Package.json scripts**:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  }
}
```

---

## Development Commands

```bash
# Start development server
docker-compose up -d

# Restart after code changes
docker-compose restart

# Stop container
docker-compose down

# View logs
docker logs healthhub-healthhub-webapp-1

# Check running containers
docker ps

# Build for production
npm run build  # Output: dist/

# Preview production build
npm run preview
```

---

## Database Setup (Supabase)

**1. Create Supabase Project**
- Go to https://supabase.com
- Create new project
- Copy URL and anon key to `.env`

**2. Run Schema**
- Go to SQL Editor in Supabase dashboard
- Paste contents of `COMPLETE_DATABASE.sql`
- Click "Run"

**3. Verify Tables**
- Go to Table Editor
- Should see: supplements, supplement_logs, supplement_sections
- Check RLS is enabled on all tables

**4. Create First User**
- Go to Authentication > Users
- Click "Add user"
- Enter email/password
- Save

---

## Known Issues & Blockers

### 1. Git Lock File (CRITICAL)
**Issue**: `.git/index.lock` file exists, preventing commits

**Cause**: Previous git operation interrupted or another process holding lock

**Fix Required**:
```bash
rm -f .git/index.lock
```

**User must approve** this command before we can commit changes.

### 2. Offline Data Layer Not Integrated (IN PROGRESS)
**Issue**: Components still use `supabase` directly, not `offlineData`

**Status**:
- ✅ IndexedDB wrapper created (`src/lib/db.ts`)
- ✅ Sync manager created (`src/lib/syncManager.ts`)
- ✅ Offline data layer created (`src/lib/offlineData.ts`)
- ❌ Components not yet migrated to use offline layer

**Remaining Work**:
1. Update `DailySupplementLogger.tsx` to use `offlineData.logs.upsert()`
2. Update `SupplementsView.tsx` to use `offlineData.supplements.*`
3. Update `SectionsView.tsx` to use `offlineData.sections.*`
4. Update `CostCalculator.tsx` to use `offlineData.supplements.getAll()`
5. Initialize offline DB on login: `await offlineData.init(user.id)`
6. Add sync status UI indicator

### 3. Workout Toggle Not Showing (FIXED)
**Issue**: Button didn't appear because workout supplements were filtered before state

**Fix**: Load all supplements, filter in render logic (line 206-207)

**Status**: ✅ Fixed in current code

### 4. Variable Declaration Error (FIXED)
**Issue**: `workoutSupplements` used before declaration

**Fix**: Moved declaration to top of render (line 206)

**Status**: ✅ Fixed in current code

---

## Testing Checklist (For Offline Mode)

### Prerequisites
- [ ] Run `COMPLETE_DATABASE.sql` in Supabase
- [ ] Remove `.git/index.lock` file
- [ ] Migrate components to use `offlineData`
- [ ] Add sync status UI

### Online Tests
- [ ] Login works
- [ ] Initial sync downloads all data to IndexedDB
- [ ] Create supplement → saves to Supabase
- [ ] Update supplement → updates in Supabase
- [ ] Delete supplement → removes from Supabase
- [ ] Log supplement → creates log in Supabase
- [ ] All UI operations feel instant (optimistic updates)

### Offline Tests
- [ ] Go offline (Network tab → Offline)
- [ ] Create supplement → saves to IndexedDB, queued for sync
- [ ] Update supplement → updates IndexedDB, queued
- [ ] Delete supplement → removes from IndexedDB, queued
- [ ] Log supplements → saves to IndexedDB, queued
- [ ] Refresh page → data persists from IndexedDB
- [ ] Check IndexedDB (DevTools → Application → IndexedDB) → verify data exists

### Sync Tests
- [ ] Go back online → sync automatically starts
- [ ] Console shows "🔄 Starting sync..."
- [ ] Console shows "✅ Sync complete"
- [ ] Check Supabase database → all offline changes present
- [ ] Local IDs replaced with server UUIDs
- [ ] Sync queue empty after sync

### Multi-Device Tests
- [ ] Device A: Create supplement while online
- [ ] Device B: Refresh → sees new supplement
- [ ] Device A: Go offline, edit supplement
- [ ] Device B: Go offline, edit same supplement (different value)
- [ ] Both devices come online
- [ ] Verify last-write-wins (later edit wins)

### Edge Cases
- [ ] Create supplement with multi-ingredients offline
- [ ] Import CSV while offline
- [ ] Delete section while offline
- [ ] Reorder sections while offline
- [ ] Toggle entire section while offline
- [ ] Export JSON/CSV while offline (should work from IndexedDB)

---

## Next Steps (Immediate)

1. **Remove git lock** (requires user approval):
   ```bash
   rm -f /mnt/c/Users/Samuel/Downloads/Projects/healthhub/.git/index.lock
   ```

2. **Migrate components to offline layer**:
   - Update all `supabase.from()` calls to `offlineData.*` calls
   - Initialize offline DB on login
   - Test thoroughly

3. **Add sync status UI**:
   - Online/offline badge (green/red dot in header)
   - Syncing spinner when sync in progress
   - Toast notifications for sync errors
   - Manual sync button

4. **Run CodeRabbit review**:
   ```bash
   /root/.local/bin/coderabbit review --plain
   ```

5. **Fix any issues** from CodeRabbit

6. **Commit all changes**:
   ```bash
   git add -A
   git commit -m "feat: offline-first architecture + notes field + workout mode

   - Add IndexedDB local database with sync queue
   - Implement background sync when online
   - Add notes field to supplements
   - Add workout mode toggle with Pre/Post sections
   - Fix workout toggle visibility
   - Add frequency pattern cost calculations
   - Update CSV import/export to include notes

   🤖 Generated with Claude Code
   Co-Authored-By: Claude <noreply@anthropic.com>"
   ```

7. **Push to GitHub**:
   ```bash
   git push origin main
   ```

---

## Future Enhancements

### Phase 1: PWA (Progressive Web App)
- [ ] Service Worker for offline assets
- [ ] App manifest for "Add to Home Screen"
- [ ] Push notifications for reminders
- [ ] Background Sync API integration

### Phase 2: Advanced Sync
- [ ] CRDT for conflict-free sync
- [ ] Version vectors for multi-device awareness
- [ ] Conflict resolution UI
- [ ] Sync history view

### Phase 3: Analytics
- [ ] Adherence tracking (% supplements taken per day)
- [ ] Streak counter (consecutive days taking all supplements)
- [ ] Cost trends over time
- [ ] Most/least taken supplements

### Phase 4: Reminders
- [ ] Push notifications at scheduled times
- [ ] Custom reminder schedules per supplement
- [ ] Snooze functionality
- [ ] Reminder history

### Phase 5: Integrations
- [ ] Export to Apple Health / Google Fit
- [ ] Import from spreadsheets
- [ ] Barcode scanner for adding supplements
- [ ] Photo storage for supplement bottles

---

## Version History

- **v0.1.0** (2025-10-02 early): Initial React app setup, Supabase integration
- **v0.2.0** (2025-10-02 morning): Basic CRUD for supplements, sections, logs
- **v0.3.0** (2025-10-02 mid-day): Animated title, cost calculator, import/export
- **v0.4.0** (2025-10-02 afternoon): Frequency patterns, workout mode, section reordering
- **v0.5.0** (2025-10-02 late afternoon): Notes field, CSV template update, bug fixes
- **v0.9.0** (2025-10-02 evening): Offline-first architecture (IndexedDB, sync queue, background sync)

**Current Version**: v0.9.0

**Next Release**: v1.0.0 (when offline mode is fully tested and deployed)

---

## Deployment Strategy (Not Yet Executed)

### Frontend (Netlify)
1. Push to GitHub
2. Connect Netlify to repo
3. Build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Node version: 22.x
4. Environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

### Database (Supabase)
- Already hosted
- Run `COMPLETE_DATABASE.sql` in production project
- Verify RLS policies

### Domain (Optional)
- Configure custom domain in Netlify
- SSL certificate auto-provisioned

---

## Critical Notes for Future Recovery

If project is lost and needs to be recreated from this log:

1. **Database Schema**: Use `COMPLETE_DATABASE.sql` exactly as written
2. **Frequency Pattern Logic**: `shouldShowToday()` function is critical for filtering
3. **Workout Mode**: Requires TWO separate groupings (workout vs regular supplements)
4. **Optimistic UI**: All operations update state immediately, sync in background
5. **Local ID Format**: `local_${timestamp}_${random}` for offline-created items
6. **Sync Queue**: MUST process in timestamp order to maintain causality
7. **IndexedDB Indexes**: Required for performant queries (user_id, date, etc.)
8. **CSV Escaping**: Formula injection prevention is critical (`escapeCsvField()`)
9. **Upsert Pattern**: Use `onConflict: 'user_id,supplement_id,date'` for logs
10. **RLS Policies**: All tables must have policies for SELECT, INSERT, UPDATE, DELETE

---

## Contributors
- Claude Code (Anthropic) - Full implementation
- User (Samuel) - Product direction, testing, feedback

---

**Last Updated**: 2025-10-02 20:30:00 (Evening)
**Status**: Offline architecture complete, components not yet migrated
**Blockers**: Git lock file, component migration pending
