# HealthBridge Android App

Android application that syncs health data from HealthConnect to HealthHub web dashboard using end-to-end encryption.

## Features

- **HealthConnect Integration**: Extracts ultra-rich health data with 1Hz granularity
- **End-to-End Encryption**: AES-256-GCM encryption using Android Keystore
- **Background Sync**: Automatic sync every 6 hours
- **Manual Sync**: On-demand sync of last 30 days of health data
- **Privacy-First**: All data encrypted before leaving device

## Supported Health Metrics

- Heart Rate (1Hz sampling)
- Blood Oxygen
- Respiratory Rate
- Body Temperature
- Steps
- Distance
- Calories (Total & Active)
- Exercise Sessions
- Sleep Stages
- Nutrition
- Hydration

## Requirements

- Android 10+ (API 29+)
- HealthConnect app installed
- Active Supabase account
- HealthHub web app deployment

## Setup Instructions

### 1. Prerequisites

Install Android Studio and set up Android development environment:
- Download Android Studio from https://developer.android.com/studio
- Install Android SDK Platform 34
- Configure Gradle

### 2. Import Project

1. Open Android Studio
2. Select "Open an Existing Project"
3. Navigate to `HealthBridgeAndroid/` directory
4. Wait for Gradle sync to complete

### 3. Build Configuration

The app is pre-configured with:
- Kotlin 1.8.20
- Android Gradle Plugin 7.4.2
- Min SDK 29 (Android 10)
- Target SDK 34

### 4. HealthConnect Setup

1. Install HealthConnect from Google Play Store
2. Grant HealthConnect permissions when prompted
3. Connect your fitness apps/devices to HealthConnect

### 5. Configuration

On first launch, configure the app with:

**Supabase URL**: `https://your-project.supabase.co`
**Supabase Anon Key**: Get from Supabase dashboard > Settings > API
**User ID**: Get from HealthHub web app > Settings > Account

These settings are stored securely in SharedPreferences.

### 6. Grant Permissions

The app requires these HealthConnect permissions:
- Read Heart Rate
- Read Blood Oxygen
- Read Respiratory Rate
- Read Body Temperature
- Read Steps
- Read Distance
- Read Calories (Total & Active)
- Read Exercise Sessions
- Read Sleep Sessions
- Read Nutrition
- Read Hydration

### 7. Enable Background Sync

Tap "Enable Auto-Sync" to schedule automatic syncs every 6 hours. The app uses WorkManager with these constraints:
- Network connection required
- Battery not low
- Exponential backoff on failures

## How It Works

### Data Flow

```
HealthConnect → Extract Data → Encrypt (AES-256-GCM) → Upload to Supabase → Decrypt in Web App → Display Dashboard
```

### Encryption Process

1. Generate encryption key in Android Keystore (hardware-backed)
2. Serialize health data bundle to JSON
3. Encrypt with AES-256-GCM (256-bit key, 128-bit GCM tag)
4. Convert to integer arrays for Supabase storage
5. Upload encrypted data + IV to `health_data_upload` table

### Decryption Process

The web app handles decryption:
1. Query unprocessed uploads from Supabase
2. Decrypt using user's encryption key
3. Parse JSON and insert into `health_data_points` table
4. Mark upload as processed

## Architecture

### Components

**HealthConnectService**: Extracts health data from HealthConnect API
**EncryptionManager**: Handles AES-256-GCM encryption/decryption using Android Keystore
**UploadManager**: Uploads encrypted data to Supabase REST API
**BackgroundSyncWorker**: WorkManager worker for periodic background sync
**MainActivity**: User interface for manual sync and configuration

### Data Models

**HealthDataPoint**: Individual health metric reading
**HealthDataBundle**: Collection of data points from extraction
**EncryptedHealthData**: Encrypted bundle ready for upload
**UploadPayload**: JSON payload sent to Supabase

## Building APK

### Debug Build

```bash
cd HealthBridgeAndroid
./gradlew assembleDebug
```

APK location: `app/build/outputs/apk/debug/app-debug.apk`

### Release Build

1. Create keystore:
```bash
keytool -genkey -v -keystore healthbridge.keystore -alias healthbridge -keyalg RSA -keysize 2048 -validity 10000
```

2. Configure signing in `app/build.gradle`:
```gradle
android {
    signingConfigs {
        release {
            storeFile file("../healthbridge.keystore")
            storePassword "your-password"
            keyAlias "healthbridge"
            keyPassword "your-password"
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
```

3. Build release APK:
```bash
./gradlew assembleRelease
```

APK location: `app/build/outputs/apk/release/app-release.apk`

## Troubleshooting

### HealthConnect Not Available

- Ensure HealthConnect is installed from Google Play Store
- Check device is running Android 10+ (API 29+)
- Verify HealthConnect is enabled in Settings

### Sync Fails

- Check Supabase URL and API key are correct
- Verify User ID matches web app account
- Ensure network connection is available
- Check Supabase logs for upload errors

### Permissions Denied

- Grant all requested HealthConnect permissions
- Re-open app and retry sync
- Check HealthConnect settings for permission grants

### Background Sync Not Working

- Enable auto-sync in app settings
- Ensure battery optimization is disabled for app
- Check WorkManager status in Android Settings > Developer Options

## Security

### Encryption

- **Algorithm**: AES-256-GCM
- **Key Storage**: Android Keystore (hardware-backed on supported devices)
- **Key Size**: 256 bits
- **GCM Tag Length**: 128 bits
- **IV**: Randomly generated per encryption

### Data Privacy

- Health data encrypted before leaving device
- Encryption keys never leave device
- No plaintext health data stored on device
- No analytics or tracking

### Network Security

- HTTPS only (cleartext traffic disabled)
- TLS 1.2+ required
- Certificate pinning recommended for production

## Development

### Project Structure

```
app/src/main/
├── java/com/healthhub/healthbridge/
│   ├── HealthBridgeApplication.kt
│   ├── MainActivity.kt
│   ├── HealthConnectService.kt
│   ├── EncryptionManager.kt
│   ├── UploadManager.kt
│   ├── BackgroundSyncWorker.kt
│   └── HealthDataModels.kt
├── res/
│   ├── layout/
│   │   ├── activity_main.xml
│   │   └── dialog_configuration.xml
│   ├── values/
│   │   └── strings.xml
│   └── xml/
│       └── health_permissions.xml
├── AndroidManifest.xml
└── build.gradle
```

### Key Dependencies

- `androidx.health.connect:connect-client:1.1.0-alpha07` - HealthConnect SDK
- `com.squareup.okhttp3:okhttp:4.11.0` - HTTP client
- `org.jetbrains.kotlinx:kotlinx-serialization-json:1.5.1` - JSON serialization
- `androidx.work:work-runtime-ktx:2.9.0` - Background jobs
- `androidx.security:security-crypto:1.1.0-alpha06` - Encryption utilities

### Testing

Run unit tests:
```bash
./gradlew test
```

Run instrumented tests (requires device/emulator):
```bash
./gradlew connectedAndroidTest
```

## License

Proprietary - Part of HealthHub ecosystem

## Support

For issues or questions, contact support through HealthHub web app.
