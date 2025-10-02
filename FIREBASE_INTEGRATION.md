# Firebase Integration for Android Health Connect Exporter

## Updated Export Endpoint

The Health Connect exporter app now sends data to Firebase via Netlify function.

### Android App Changes Required

Update the export URL in your Android app to include the user ID header:

```kotlin
// In your export function
val url = "https://legendary-chaja-e17d86.netlify.app/.netlify/functions/health-export"

val connection = URL(url).openConnection() as HttpURLConnection
connection.requestMethod = "POST"
connection.setRequestProperty("Content-Type", "application/json")
connection.setRequestProperty("X-User-ID", userId) // Add this header

connection.doOutput = true
connection.outputStream.write(jsonData.toByteArray())

val responseCode = connection.responseCode
println("Export response: $responseCode")
```

### User ID
- Use a consistent userId (e.g., device ID, user email hash, or UUID)
- This isolates data per user in Firebase
- Example: `val userId = Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID)`

### Data Flow

1. **Android App** → POST to Netlify function with `X-User-ID` header
2. **Netlify Function** → Stores to Firebase at `/users/{userId}/metrics`
3. **Webapp** → Fetches from Firebase using same userId
4. **Real-time sync** → Firebase updates instantly available

### Firebase URL Structure

```
https://healthhub-data-default-rtdb.firebaseio.com/
  └── users/
      └── {userId}/
          └── metrics/
              ├── [0] { time, data, receivedAt }
              ├── [1] { time, data, receivedAt }
              └── ...
```

### Testing

1. Export data from Android app
2. Check Firebase console: https://console.firebase.google.com/project/healthhub-data/database
3. Navigate to `/users/{your-userId}/metrics`
4. Verify data appears
5. Login to webapp with same userId
6. Data should display immediately

### Firebase Security Rules

Current rules (test mode - open access):
```json
{
  "rules": {
    "users": {
      "$userId": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

**Production rules (add auth):**
```json
{
  "rules": {
    "users": {
      "$userId": {
        ".read": "$userId === auth.uid || $userId === 'demo'",
        ".write": "$userId === auth.uid || $userId === 'demo'"
      }
    }
  }
}
```

### Environment Variables

Set in Netlify:
- `FIREBASE_URL` = `https://healthhub-data-default-rtdb.firebaseio.com`
- `ALLOWED_ORIGIN` = `https://legendary-chaja-e17d86.netlify.app`
