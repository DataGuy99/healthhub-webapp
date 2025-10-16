# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.

# Keep health data models for serialization
-keep class com.healthhub.healthbridge.HealthDataPoint { *; }
-keep class com.healthhub.healthbridge.HealthContext { *; }
-keep class com.healthhub.healthbridge.HealthMetadata { *; }
-keep class com.healthhub.healthbridge.EnvironmentalData { *; }
-keep class com.healthhub.healthbridge.HealthDataBundle { *; }
-keep class com.healthhub.healthbridge.EncryptedHealthData { *; }
-keep class com.healthhub.healthbridge.UploadPayload { *; }

# Keep Kotlin serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt
-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# Keep OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**

# Keep HealthConnect SDK classes
-keep class androidx.health.connect.client.** { *; }

# Keep WorkManager
-keep class androidx.work.** { *; }
