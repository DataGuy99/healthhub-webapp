package com.healthhub.healthbridge

import kotlinx.serialization.Serializable

@Serializable
data class HealthDataPoint(
    val timestamp: String,
    val type: String,
    val value: Double,
    val accuracy: Int? = null,
    val source: String = "healthconnect",
    val context: HealthContext? = null,
    val metadata: HealthMetadata? = null
)

@Serializable
data class HealthContext(
    val activity: String? = null,
    val location: String? = null,
    val supplementLogs: List<String>? = null,
    val sleepStage: String? = null,
    val stressLevel: String? = null
)

@Serializable
data class HealthMetadata(
    val deviceId: String? = null,
    val batteryLevel: Int? = null,
    val sensorConfidence: Double? = null,
    val environmental: EnvironmentalData? = null
)

@Serializable
data class EnvironmentalData(
    val temperature: Double? = null,
    val humidity: Double? = null
)

@Serializable
data class HealthDataBundle(
    val dataPoints: List<HealthDataPoint>,
    val extractionTimestamp: String,
    val dataPointCount: Int
)

@Serializable
data class EncryptedHealthData(
    val encryptedData: List<Int>,
    val iv: List<Int>,
    val dataPointCount: Int,
    val extractionTimestamp: String
)

@Serializable
data class UploadPayload(
    val user_id: String,
    val encrypted_data: List<Int>,
    val iv: List<Int>,
    val data_point_count: Int,
    val extraction_timestamp: String
)

enum class HealthMetricType(val typeName: String) {
    HEART_RATE("heart_rate"),
    BLOOD_OXYGEN("blood_oxygen"),
    RESPIRATORY_RATE("respiratory_rate"),
    BODY_TEMPERATURE("body_temperature"),
    STEPS("steps"),
    DISTANCE("distance"),
    CALORIES("calories"),
    EXERCISE("exercise"),
    SLEEP_STAGE("sleep_stage"),
    NUTRITION("nutrition"),
    HYDRATION("hydration"),
    STRESS_LEVEL("stress_level")
}
