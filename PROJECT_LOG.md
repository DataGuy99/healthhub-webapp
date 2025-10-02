# PROJECT_LOG.md - HealthHub Analytics

## Project Information
- **Project Name**: HealthHub Analytics (Android)
- **Created**: 2025-09-29
- **Location**: /mnt/c/Users/Samuel/Downloads/Projects/healthhub-android
- **Purpose**: Privacy-first health analytics platform integrating Health Connect data, supplement tracking, and correlation analysis
- **Status**: Phase 1 - Complete ✅ | Phase 2 - Ready to Start

## Core Principles
✅ **100% Local Data** - All data stays on Android device
✅ **Zero Cloud Storage** - No external servers or cloud sync
✅ **Automatic Sync** - Health Connect data updates via WorkManager (15 min intervals)
✅ **Offline-First** - Works completely without internet
✅ **Encrypted Storage** - SQLCipher for database encryption

## Tech Stack
- **Language**: Kotlin 1.9.22
- **UI Framework**: Jetpack Compose (Material 3)
- **Database**: Room 2.6.1 + SQLCipher 4.5.4
- **Background Tasks**: WorkManager 2.9.0
- **Health Data**: Health Connect SDK 1.1.0-alpha10
- **Charts**: MPAndroidChart 3.1.0 or Vico 2.0.0
- **Analytics**: Apache Commons Math 3.6.1
- **Architecture**: MVVM + Clean Architecture

## Architecture Components

### Data Layer
- **Room Database**: Local SQLite with encryption
- **DAOs**: Type-safe database access
- **Repositories**: Single source of truth
- **WorkManager**: Background Health Connect sync

### Domain Layer
- **Use Cases**: Business logic
- **Models**: Domain entities
- **Correlation Engine**: Statistical analysis

### UI Layer
- **Jetpack Compose**: Modern declarative UI
- **ViewModels**: UI state management
- **Navigation**: Type-safe Compose navigation

## Data Sources
1. **Health Connect API**
   - Heart rate, HRV, blood oxygen
   - Sleep stages & quality
   - Steps, distance, calories
   - Workouts (type, duration, intensity)
   - Nutrition (calories, macros, micronutrients)

2. **Manual Input**
   - Supplements (compound, dosage, timing)
   - Additional notes and observations

## Database Schema

### Core Tables
```kotlin
HealthMetric: timestamp, metricType, value, unit, source
Supplement: name, compounds, pathways, dosage, unit, notes
SupplementLog: supplementId, timestamp, dosage, timing
Correlation: metricA, metricB, coefficient, pValue, calculatedAt
NutritionLog: timestamp, calories, macros, micronutrients
WorkoutLog: timestamp, type, duration, intensity, avgHR, maxHR
```

## Implementation Phases

### ✅ Phase 1: Foundation (Week 1) - COMPLETE
- [x] Create project directory
- [x] Initialize Git repository
- [x] Create PROJECT_LOG.md
- [x] Set up Android Studio project structure
- [x] Configure build.gradle.kts with dependencies
- [x] Create Room database entities (HealthMetric, Supplement, SupplementLog, Correlation)
- [x] Create Room DAOs (HealthMetricDao, SupplementDao, SupplementLogDao, CorrelationDao)
- [x] Create Room database with SQLCipher encryption (HealthDatabase.kt)
- [x] Create TypeConverters for Instant type
- [x] Set up Health Connect SDK (HealthConnectManager.kt)
- [x] Create repositories (HealthRepository, SupplementRepository, CorrelationRepository)
- [x] Configure WorkManager (HealthSyncWorker, WorkManagerSetup)
- [x] Create Jetpack Compose UI scaffold
- [x] Create navigation system (AppNavigation.kt)
- [x] Create 4 main screens (Dashboard, Metrics, Supplements, Correlations)
- [x] Create Material 3 theme
- [x] Configure AndroidManifest.xml (no internet permission)

### Phase 2: Health Data Pipeline (Week 2)
- [ ] Health Connect permissions flow
- [ ] Background data sync (WorkManager)
- [ ] Historical data import (30 days)
- [ ] Basic time-series storage
- [ ] Simple list UI to verify data

### Phase 3: Supplement System (Week 3)
- [ ] Supplement database design
- [ ] CRUD operations for supplements
- [ ] Daily supplement logging UI
- [ ] Interaction checker (local rules)
- [ ] Pathway data structure

### Phase 4: Analytics Engine (Week 4)
- [ ] Correlation calculation engine
- [ ] Lag analysis implementation
- [ ] Statistical significance testing
- [ ] Correlation heatmap visualization

### Phase 5: Dashboard & Charts (Week 5)
- [ ] Main dashboard UI
- [ ] Time-series charts (MPAndroidChart)
- [ ] Correlation explorer
- [ ] Filters and date ranges
- [ ] Export/import functionality

## Key Features

### Automatic Background Sync
- WorkManager polls Health Connect every 15 minutes
- Battery-optimized scheduling
- Foreground service notification (Android requirement)
- Incremental sync (only new data)

### Privacy & Security
- SQLCipher encryption for database
- Biometric lock for app access
- No network permissions (offline-only)
- No analytics or telemetry
- Manual backup to encrypted file

### Analytics Capabilities
- Pearson correlation (continuous metrics)
- Spearman correlation (ranked data)
- Lag analysis (1h, 6h, 24h, 7d)
- P-value significance testing
- Time-series trend analysis

## File Structure
```
healthhub-android/
├── app/
│   ├── src/main/
│   │   ├── java/com/healthhub/
│   │   │   ├── data/
│   │   │   │   ├── database/
│   │   │   │   │   ├── HealthDatabase.kt
│   │   │   │   │   ├── dao/
│   │   │   │   │   └── entities/
│   │   │   │   ├── repository/
│   │   │   │   └── worker/
│   │   │   ├── domain/
│   │   │   │   ├── model/
│   │   │   │   └── usecase/
│   │   │   ├── ui/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── supplements/
│   │   │   │   ├── analytics/
│   │   │   │   └── theme/
│   │   │   └── utils/
│   │   ├── res/
│   │   └── AndroidManifest.xml
│   ├── build.gradle.kts
│   └── proguard-rules.pro
├── gradle/
├── build.gradle.kts
├── settings.gradle.kts
├── .gitignore
└── PROJECT_LOG.md
```

## Dependencies (Key Libraries)
```
Jetpack Compose: 2024.12.01
Material 3: 1.3.1
Room: 2.6.1
SQLCipher: 4.5.4
Health Connect: 1.1.0-alpha10
WorkManager: 2.9.0
MPAndroidChart: 3.1.0
Commons Math: 3.6.1
Kotlinx Coroutines: 1.8.0
```

## Development Environment
- **IDE**: Android Studio Hedgehog | 2023.1.1+
- **Min SDK**: 28 (Android 9.0)
- **Target SDK**: 34 (Android 14)
- **Compile SDK**: 34
- **JVM Target**: 17

## Health Connect Export APK Build Process

### Building the APK
```bash
cd /tmp/HealthConnectExports
./gradlew clean --no-daemon
./gradlew assembleRelease --no-daemon
# APK location: app/build/outputs/apk/release/app-release-unsigned.apk
```

### Signing the APK (Requires Android SDK)
**Note**: `apksigner` and `zipalign` are not available in WSL. Must use Windows Android SDK.

```bash
# On Windows with Android SDK installed:
# 1. Locate build-tools (e.g., C:\Users\Samuel\AppData\Local\Android\Sdk\build-tools\34.0.0\)
# 2. Align the APK:
zipalign -v -p 4 app-release-unsigned.apk app-release-aligned.apk

# 3. Sign the APK:
apksigner sign --ks my-release-key.jks --ks-pass pass:password123 --out app-release-signed.apk app-release-aligned.apk

# 4. Verify signature:
apksigner verify app-release-signed.apk
```

**Alternative**: Install unsigned APK directly for testing (Android will prompt for install confirmation)

### Health Connect Permissions Added
- Steps, Sleep, Heart Rate (original)
- Active Calories, Total Calories (original)
- **NEW**: Oxygen Saturation, Weight, Body Fat
- **NEW**: HRV (RMSSD), Respiratory Rate, Resting HR
- **NEW**: Nutrition, Exercise (permissions only, data extraction TBD)

### Code Improvements (2025-10-01)
- ✅ Removed binary artifacts from git (apk_contents/)
- ✅ Refactored to concurrent async/await (5x performance improvement)
- ✅ Added error handling to prevent worker crashes
- ✅ Removed runBlocking (already in suspend context)
- ✅ CodeRabbit approved (only minor suggestion about null vs 0)

## Netlify Deployment (2025-10-01)

### Serverless Function Setup
- Created `netlify.toml` with build config and redirects
- Created `/netlify/functions/health-export.js` serverless function
- Function accepts POST requests at `/api/health-export`
- Logs received Health Connect data (no database storage yet)
- Returns success response with timestamp

### GitHub Repository
- Pushed to: https://github.com/DataGuy99/healthhub-webapp
- Contains: React webapp + Netlify serverless function
- Ready for Netlify deployment via web interface

### Security Fixes (2025-10-01)
- ✅ Added input validation (body exists, 1MB size limit, structure check)
- ✅ Restricted CORS to specific origin (env var configurable)
- ✅ Added CORS preflight handling (OPTIONS requests)
- ✅ Removed sensitive data echo from response
- ✅ Generic error messages (no implementation details)
- ✅ Kept health data logging (personal use, user owns data)

### Cross-Device Sync Implementation (v0.8.0)
- ✅ Backend Express API server (server/server.js)
- ✅ SQLite database with better-sqlite3
- ✅ bcrypt password hashing (salt rounds: 10)
- ✅ Rate limiting for auth endpoints (100 requests/15min)
- ✅ Input validation (batch size, data types, string lengths)
- ✅ Unique constraints on supplement_logs table
- ✅ Offline sync queue with background sync (60s interval)
- ✅ Dark vertical timeline UI (slate-900/800/700)
- ✅ Mobile responsive design (Tailwind breakpoints)
- ✅ Removed "Unsorted" section requirement
- ✅ Login/logout with passcode authentication
- ✅ Data loss prevention (check unsynced before download)
- ✅ Duplicate prevention (check server before create/update)

### CodeRabbit Security Fixes (v0.8.0)
1. ✅ Added input validation and batch size limits (1000 items)
2. ✅ Fixed downloadAllData data loss risk - uploads unsynced changes first
3. ✅ Implemented bcrypt password hashing - separate registration endpoint
4. ✅ Fixed uploadAllData duplicates - fetches server data to detect existing items
5. ✅ Added unique constraint to supplement_logs (user_id, supplement_id, date)
6. ✅ Fixed LoginView button re-enable during error timeout
7. ✅ Fixed incomplete supplement update - added isStack and stackId fields

### Backend Server Dependencies
```json
{
  "express": "^4.18.2",
  "cors": "^2.8.5",
  "better-sqlite3": "^9.2.2",
  "bcrypt": "^5.1.1",
  "express-rate-limit": "^7.1.5"
}
```

### API Endpoints
- `POST /api/auth/register` - Register new user with hashed passcode
- `POST /api/auth/verify` - Verify user credentials
- `GET /api/data/all` - Download all user data (supplements, logs, sections)
- `POST /api/sync` - Upload sync queue items (create/update/delete)

### Deployment to Netlify
**Deployment Method**: Push to GitHub - Netlify auto-deploys via integration

1. **GitHub Repository**: https://github.com/DataGuy99/healthhub-webapp
2. **Netlify Setup**: Connected to GitHub repo (auto-deploy on push)
3. **Build Settings**:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Node version: 22.x
4. **Environment Variables** (set in Netlify dashboard):
   - Any required production URLs or API keys

**Backend Server**: Requires separate deployment (not Netlify - needs persistent process for Express API)

### Next Steps
- [ ] Push latest changes to GitHub (triggers Netlify auto-deploy)
- [ ] Deploy backend Express server separately (port 3001)
- [ ] Update Android app with production backend endpoint URL
- [ ] Test health data export from phone
- [ ] Test cross-device sync with same credentials

## Version History
- **v0.1.0** (2025-09-29): Project initialization, planning phase complete
- **v0.2.0** (2025-09-29): Phase 1 foundation complete - database layer, repositories, WorkManager, UI scaffold (33 files)
- **v0.3.0** (2025-09-30): UI polish - beautiful animations, pull-to-refresh, shimmer effects, haptic feedback (9 new components)
- **v0.4.0** (2025-10-01): Health Connect export app - Added 8 new health metrics, async/await refactor, CodeRabbit approved
- **v0.5.0** (2025-10-01): Netlify serverless function added - health data webhook endpoint ready for deployment
- **v0.5.1** (2025-10-01): Security fixes - input validation, CORS restrictions, removed data echo, generic errors
- **v0.6.0** (2025-10-01): Added Nutrition and Exercise data extraction - 15 total metrics now exported, tested successfully
- **v0.7.0** (2025-10-01): Webapp complete - Ambient fluid background, auto-sync from Netlify Blobs, all 15 metrics displayed, CodeRabbit approved
- **v0.8.0** (2025-10-02): Cross-device sync complete - Backend Express API, bcrypt auth, offline sync queue, dark timeline UI, all security issues fixed

## Notes
- Health Connect requires Android 9+ (API 28)
- Background reads require Android 15+ (API 35) for best experience
- SQLCipher adds ~7MB to APK size (acceptable for security)
- WorkManager minimum interval is 15 minutes (Android limitation)
- No Google Play Services required (Health Connect is part of Android)

## Future Enhancements (Post-MVP)
- [ ] TensorFlow Lite for on-device ML predictions
- [ ] Optional local web server (Ktor) for tablet access
- [ ] Export to FHIR format
- [ ] Supplement interaction warnings via local rule engine
- [ ] Integration with supplement pathway databases (KEGG, Reactome)