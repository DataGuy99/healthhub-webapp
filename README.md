# HealthHub Web App 🏥✨

Beautiful, private health analytics with liquid gradient backgrounds that change with time of day.

## Features

- **🎨 Animated Liquid Gradients**: Background swirls and morphs based on time
  - Morning (5am-12pm): Teal → Yellow
  - Afternoon (12pm-5pm): Orange → Ruby
  - Evening (5pm-9pm): Pink → Peach
  - Night (9pm-5am): Amethyst → Navy

- **📊 Health Metrics Dashboard**: Visualize Heart Rate, HRV, Steps, and more
- **🔗 Correlation Analysis**: Discover relationships between metrics
- **💊 Supplement Tracking**: Log and analyze supplement intake
- **🔒 100% Private**: All data stored locally in IndexedDB (no server required)
- **📱 PWA Ready**: Install on phone/desktop like a native app

## Quick Start

### Option 1: Docker (Recommended)

```bash
docker-compose up
```

Visit `http://localhost:3000`

### Option 2: Local Development

```bash
npm install
npm run dev
```

## Importing Health Data

1. Export data from Health Connect (use [angeloanan/HealthConnectExports](https://github.com/angeloanan/HealthConnectExports))
2. Go to "Import" tab
3. Drag & drop JSON file or click "Choose File"
4. Data is stored locally in your browser

## Architecture

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + Framer Motion
- **Database**: Dexie.js (IndexedDB wrapper)
- **Charts**: Recharts
- **Analytics**: Custom correlation engine with Pearson coefficient

## Tech Stack

- React 18.3
- TypeScript 5.7
- Vite 6.0
- Tailwind CSS 3.4
- Framer Motion 11.15
- Dexie.js 4.0 (IndexedDB)
- Recharts 2.15
- date-fns 4.1

## Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Docker Commands

```bash
# Build and run
docker-compose up --build

# Run in background
docker-compose up -d

# Stop
docker-compose down

# View logs
docker-compose logs -f
```

## Privacy

- ✅ All data stored locally (IndexedDB)
- ✅ No external API calls
- ✅ No analytics or tracking
- ✅ Works completely offline after first load
- ✅ Your data never leaves your device

## License

MIT
