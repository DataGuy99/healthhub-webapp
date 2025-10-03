# HealthHub Web Application - Project Log

## 🔖 STABLE CHECKPOINT
**Commit**: `0ad70e0` (2025-10-03)
**Status**: ✅ Working - Mobile optimized with workout mode
**Fallback Point**: Use this commit if issues arise

---

## Project Information
- **Project Name**: HealthHub Web App (Supplement Tracker)
- **Created**: 2025-10-02
- **Location**: `/mnt/c/Users/Samuel/Downloads/Projects/healthhub` (Windows: `C:\Users\Samuel\Downloads\Projects\healthhub`)
- **Repository**: https://github.com/DataGuy99/healthhub-webapp
- **Production URL**: Deployed on Netlify
- **Tech Stack**: React 18, TypeScript 5, Vite 6, Supabase, TailwindCSS 3, Framer Motion 11

## Architecture Overview

### Frontend Stack
- **Framework**: React 18.3+ with TypeScript 5.x
- **Build Tool**: Vite 6.x (HMR, ESM, optimized builds)
- **Styling**: TailwindCSS 3.x with custom glassmorphism effects
- **Animations**: Framer Motion 11.x (page transitions, timeline, buttons)
- **Database (Cloud)**: Supabase PostgreSQL with Row Level Security (RLS)
- **State Management**: React hooks (useState, useEffect)
- **Routing**: Single-page app with tab-based navigation

### Backend Stack
- **Hosted Database**: Supabase (PostgreSQL 15+)
- **Authentication**: Supabase Auth (email/password)
- **API Layer**: Supabase JavaScript client (@supabase/supabase-js)

### Development Environment
- **Container**: Docker Compose (Vite dev server on port 3000)
- **Node Version**: 22.x LTS
- **Package Manager**: npm
- **IDE**: Claude Code
- **OS**: WSL2 (Ubuntu) on Windows 11

---

## Current Features (as of checkpoint 0ad70e0)

### 1. Authentication System
- Email/password login and signup via Supabase Auth
- Session persistence with localStorage
- Row Level Security (RLS) ensures users only see their own data
- Logout functionality

**Files**: `src/lib/auth.ts`, `src/components/LoginView.tsx`, `src/App.tsx`

### 2. Supplement Management
- Create, edit, delete supplements
- Single or multi-ingredient supplements
- Support for different forms (capsule, tablet, powder, etc.)
- Sections for time-based organization (Morning, Afternoon, Evening, Night)
- Workout supplements (Pre-Workout, Post-Workout)
- Frequency patterns: everyday, 5/2, workout, custom
- Active days selection for custom schedules
- Cost and quantity tracking
- **Notes field** for additional details

**Files**: `src/components/SupplementsView.tsx`

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
  section TEXT,
  active_days JSONB,  -- [0,1,2,3,4,5,6] for days of week
  frequency_pattern TEXT DEFAULT 'everyday'
    CHECK (frequency_pattern IN ('everyday', '5/2', 'workout', 'custom')),
  is_stack BOOLEAN DEFAULT false,
  stack_id UUID REFERENCES supplements(id) ON DELETE SET NULL,
  "order" INTEGER DEFAULT 0,
  cost DECIMAL(10,2),
  quantity INTEGER,
  frequency INTEGER DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3. Daily Supplement Logging
- Vertical timeline layout grouped by sections
- Check off supplements as taken
- Progress bar showing completion percentage
- Section-level "✓ All" and "✗ None" buttons
- **Workout Mode** toggle for pre/post-workout supplements
- **Notes display** below each supplement card
- Smooth animations with Framer Motion

**Files**: `src/components/DailySupplementLogger.tsx`

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

### 4. Section Management
- Create, edit, delete custom time sections
- Drag-and-drop reordering
- Default sections: Morning, Afternoon, Evening, Night
- Workout sections: Pre-Workout, Post-Workout

**Files**: `src/components/SectionsView.tsx`

**Database Schema** (`supplement_sections` table):
```sql
CREATE TABLE supplement_sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5. Cost Calculator
- Monthly cost projection based on:
  - Everyday supplements: daily cost × 30
  - 5/2 supplements: daily cost × (5/7) × 30
  - Workout supplements: daily cost × (3.5/7) × 30 (assumes 3-4 workouts/week)
  - Custom schedules: calculated based on active days
- Total monthly cost summary

**Files**: `src/components/CostCalculator.tsx`

### 6. Import/Export
- **CSV Import**: Bulk import supplements with template
- **CSV Export**: Download all supplements as CSV
- **JSON Export**: Download all data (supplements + logs)
- Formula injection protection
- Section validation on import

**Files**: `src/components/Dashboard.tsx` (export section)

### 7. Mobile Optimization
- **Bottom Navigation Bar** (< 768px screens):
  - 📅 Daily - Daily supplement logger
  - 💊 Library - Supplements and Sections (sub-tabs)
  - ⚙️ Settings - Costs and Export (sub-tabs)
  - Transparent glassmorphism design matching cards
- **Desktop Navigation** (≥ 768px screens):
  - Top navigation with 5 tabs: Overview, Supplements, Sections, Costs, Export
- Logout button in top-right on mobile, top navigation on desktop
- Touch-optimized interactions
- Bottom padding to prevent content hiding behind nav

**Files**: `src/components/Dashboard.tsx`

### 8. Animated Title
- Cycling fonts and styles
- Emoji slot machine animation
- Split-flap letter transitions
- **Memory leak fixed** with proper interval cleanup

**Files**: `src/components/AnimatedTitle.tsx`

### 9. Visual Design
- Time-based gradient background (FluidBackground)
- Glassmorphism cards with backdrop blur
- Smooth transitions and animations
- Responsive design (mobile-first)

**Files**: `src/components/FluidBackground.tsx`, `src/index.css`

---

## Environment Variables

Required in Netlify (Site configuration → Environment variables):

```bash
VITE_SUPABASE_URL=https://clxocppshubwtbloefsv.supabase.co
VITE_SUPABASE_ANON_KEY=[your-anon-key]
```

See `.env.example` for template.

---

## Deployment

### Netlify Configuration
**File**: `netlify.toml`
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Build Command
```bash
npm run build  # Runs: tsc && vite build
```

---

## Key Fixes and Improvements

### Recent Changes (Oct 2-3, 2025)
1. **Service Worker Removal**: Removed PWA service worker causing loading hangs
2. **Version-based Cache Busting**: Auto-clears old caches when version changes
3. **AnimatedTitle Memory Leak**: Fixed interval cleanup with useRef
4. **Mobile Navigation**: Added 3-tab bottom nav with sub-tabs
5. **Workout Mode**: Toggle for pre/post-workout supplements
6. **Notes Display**: Show supplement notes on daily logger cards
7. **Transparent Nav**: Mobile nav bar matches glassmorphism design

### Known Issues
- None at checkpoint 0ad70e0

---

## File Structure

```
healthhub/
├── src/
│   ├── components/
│   │   ├── AnimatedTitle.tsx          # Animated header
│   │   ├── CostCalculator.tsx         # Monthly cost projections
│   │   ├── DailySupplementLogger.tsx  # Daily tracker with workout mode
│   │   ├── Dashboard.tsx              # Main app with navigation
│   │   ├── FluidBackground.tsx        # Animated gradient background
│   │   ├── LoginView.tsx              # Auth login/signup
│   │   ├── SectionsView.tsx           # Section management
│   │   └── SupplementsView.tsx        # Supplement CRUD
│   ├── lib/
│   │   ├── auth.ts                    # Supabase auth helpers
│   │   └── supabase.ts                # Supabase client + types
│   ├── App.tsx                        # App wrapper with auth check
│   ├── main.tsx                       # React entry point
│   └── index.css                      # Global styles + Tailwind
├── public/                            # Static assets (empty after PWA removal)
├── .env                               # Local environment variables (gitignored)
├── .env.example                       # Environment template
├── docker-compose.yml                 # Docker dev environment
├── Dockerfile                         # Docker image
├── index.html                         # HTML entry with cache clearing script
├── netlify.toml                       # Netlify config
├── package.json                       # Dependencies
├── PROJECT_LOG.md                     # This file
├── tsconfig.json                      # TypeScript config
└── vite.config.ts                     # Vite config
```

---

## Development Workflow

### Local Development (Docker)
```bash
docker-compose up -d
# App runs on http://localhost:3000
```

### Git Workflow
```bash
git add -A
git commit -m "description"
git push  # Auto-deploys to Netlify
```

### Database Changes
1. Update schema in Supabase dashboard
2. Update TypeScript interfaces in `src/lib/supabase.ts`
3. Test locally
4. Deploy

---

## Future Enhancements (Not Yet Implemented)

### Potential Features
- Offline-first sync with IndexedDB (reverted for stability)
- Health data import from Android Health Connect
- Correlation analysis between supplements and metrics
- AI suggestions based on patterns
- Dark mode toggle
- Multiple supplement stacks
- Reminder notifications
- Social sharing/export

---

## Version History

- **v2.0.0** (Oct 3, 2025) - Mobile optimization with bottom nav + workout mode ✅ CHECKPOINT
- **v1.0.0** (Oct 2, 2025) - Initial online-only version with all core features
- **v0.9.0** (Oct 2, 2025) - PWA features (reverted due to loading issues)
- **v0.8.0** (Oct 2, 2025) - Supabase integration complete

---

## Support & Documentation

- **GitHub Issues**: Report bugs at repository issues page
- **Supabase Docs**: https://supabase.com/docs
- **Vite Docs**: https://vitejs.dev
- **React Docs**: https://react.dev

---

**Last Updated**: 2025-10-03
**Stable Checkpoint**: `0ad70e0`
