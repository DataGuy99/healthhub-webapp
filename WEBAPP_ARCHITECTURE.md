# HealthHub Web App Architecture

## Overview
Transition from native Android app to React PWA with automatic Health Connect data sync.

## Data Flow Architecture

```
Health Connect (Android)
    ↓
angeloanan/HealthConnectExports (Android App)
    ↓ (HTTP POST - JSON)
Local Web Server (Node.js/Bun on phone OR Cloudflare Tunnel)
    ↓ (Save to file or forward)
React PWA (localhost or deployed)
    ↓ (Read & process)
IndexedDB (Browser storage)
```

## Implementation Options

### Option A: Fully Local (Most Private)
1. **HealthConnectExports** → HTTP POST to `localhost:3000/api/import`
2. **Vite dev server** with API endpoint running on phone
3. **React app** reads from IndexedDB
4. **No cloud, 100% offline**

**Pros:** Maximum privacy, zero server costs
**Cons:** Must run dev server on phone (Termux), complex setup

### Option B: Self-Hosted Server (Recommended)
1. **HealthConnectExports** → HTTP POST to `https://yourdomain.com/api/import`
2. **Lightweight Node.js/Bun server** (DigitalOcean $6/mo or free Render.com)
3. **React PWA** deployed to Vercel/Netlify (free)
4. **Server stores data in SQLite**, webapp fetches via API

**Pros:** Easy setup, accessible anywhere, still private (self-hosted)
**Cons:** Small server cost, data leaves phone

### Option C: Cloudflare Tunnel (Hybrid)
1. **Local server on computer** (not phone)
2. **Cloudflare Tunnel** exposes it as HTTPS endpoint (free)
3. **HealthConnectExports** → POST to tunnel URL
4. **React PWA** deployed, fetches from tunnel

**Pros:** No server cost, data stays on your computer
**Cons:** Computer must be on, more complex setup

## Recommended Tech Stack

### Frontend (React PWA)
- **Vite** - Lightning fast dev server
- **React 18** with TypeScript
- **TanStack Query** - Data fetching/caching
- **Recharts** or **Chart.js** - Beautiful visualizations
- **Tailwind CSS** - Utility-first styling
- **Framer Motion** - Smooth animations
- **IndexedDB via Dexie.js** - Local storage
- **date-fns** - Date manipulation

### Backend (Simple API)
- **Bun** or **Node.js + Fastify** - Fast HTTP server
- **SQLite** or **JSON files** - Data storage
- **CORS enabled** - For webapp access

## Time-Based Gradient Themes

```javascript
const getTimeGradient = (hour: number) => {
  if (hour >= 5 && hour < 12) {
    // Morning: Teal → Yellow
    return ['#14B8A6', '#FCD34D'];
  } else if (hour >= 12 && hour < 17) {
    // Afternoon: Orange → Ruby
    return ['#FB923C', '#BE123C'];
  } else if (hour >= 17 && hour < 21) {
    // Evening: Pink → Peach
    return ['#F472B6', '#FDBA74'];
  } else {
    // Night: Amethyst → Navy
    return ['#A78BFA', '#1E3A8A'];
  }
};
```

## File Structure

```
healthhub-webapp/
├── frontend/                 # React PWA
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── MetricChart.tsx
│   │   │   ├── GradientBackground.tsx
│   │   │   └── SupplementTracker.tsx
│   │   ├── hooks/
│   │   │   ├── useHealthData.ts
│   │   │   ├── useTimeGradient.ts
│   │   │   └── useSupplements.ts
│   │   ├── lib/
│   │   │   ├── db.ts           # IndexedDB wrapper
│   │   │   ├── api.ts          # API client
│   │   │   └── correlation.ts  # Stats calculations
│   │   ├── types/
│   │   │   └── health.ts
│   │   └── App.tsx
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
│
├── backend/                  # Simple API server
│   ├── src/
│   │   ├── index.ts
│   │   ├── routes/
│   │   │   └── import.ts     # POST /api/import
│   │   └── db/
│   │       └── sqlite.ts
│   ├── package.json
│   └── data/
│       └── health.db
│
└── PROJECT_LOG.md
```

## Next Steps

1. **Fork/modify HealthConnectExports** to add scheduled auto-export
2. **Build lightweight backend** (Bun + SQLite)
3. **Create React PWA** with beautiful time-based gradients
4. **Test data flow** from Health Connect → Server → Webapp
5. **Deploy** (Render.com backend + Vercel frontend)

## Privacy Considerations

- **Option B (Self-hosted)**: Data encrypted in transit (HTTPS), stored on your server only
- **No analytics/tracking** in webapp
- **Optional: End-to-end encryption** - Encrypt JSON before sending to server
- **API authentication** - Require API key for imports

## Estimated Timeline

- **Backend API**: 2-3 hours
- **React PWA foundation**: 3-4 hours
- **Charts & visualizations**: 4-5 hours
- **Time-based gradients & polish**: 2-3 hours
- **Testing & deployment**: 2-3 hours

**Total**: ~15-20 hours for fully working webapp with auto-import
