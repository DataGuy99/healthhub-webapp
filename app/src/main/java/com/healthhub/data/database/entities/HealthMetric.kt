package com.healthhub.data.database.entities

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.Index
import java.time.Instant

/**
 * Health metric data point from Health Connect or manual input.
 * Stores time-series health data (HR, HRV, sleep, steps, etc.)
 */
@Entity(
    tableName = "health_metrics",
    indices = [
        Index(value = ["timestamp", "metricType"]),
        Index(value = ["metricType", "timestamp"]),
        Index(value = ["source"])
    ]
)
data class HealthMetric(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,

    /** Timestamp when the metric was recorded */
    val timestamp: Instant,

    /** Type of metric (HR, HRV, SLEEP, STEPS, etc.) */
    val metricType: MetricType,

    /** Numeric value of the metric */
    val value: Double,

    /** Unit of measurement (bpm, ms, steps, hours, etc.) */
    val unit: String,

    /** Source of the data (Health Connect app name, or "Manual") */
    val source: String,

    /** Optional metadata as JSON string (e.g., sleep stage details, workout type) */
    val metadata: String? = null,

    /** When this record was created/synced */
    val syncedAt: Instant = Instant.now()
)

/**
 * Enum for metric types
 */
enum class MetricType {
    // Vitals
    HEART_RATE,
    HEART_RATE_VARIABILITY,
    BLOOD_OXYGEN,
    BLOOD_PRESSURE_SYSTOLIC,
    BLOOD_PRESSURE_DIASTOLIC,
    BODY_TEMPERATURE,
    RESTING_HEART_RATE,

    // Activity
    STEPS,
    DISTANCE,
    ACTIVE_CALORIES,
    TOTAL_CALORIES,
    FLOORS_CLIMBED,

    // Sleep
    SLEEP_DURATION,
    SLEEP_DEEP,
    SLEEP_LIGHT,
    SLEEP_REM,
    SLEEP_AWAKE,
    SLEEP_SCORE,

    // Body Composition
    WEIGHT,
    HEIGHT,
    BODY_FAT_PERCENTAGE,
    BMI,

    // Nutrition
    CALORIES_CONSUMED,
    PROTEIN,
    CARBS,
    FAT,
    FIBER,
    WATER,

    // Exercise
    WORKOUT_DURATION,
    WORKOUT_INTENSITY,
    VO2_MAX,

    // Other
    STRESS_LEVEL,
    ENERGY_LEVEL,
    MOOD
}