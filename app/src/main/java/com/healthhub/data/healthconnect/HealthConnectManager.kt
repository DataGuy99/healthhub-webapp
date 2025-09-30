package com.healthhub.data.healthconnect

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.*
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.healthhub.data.database.entities.HealthMetric
import com.healthhub.data.database.entities.MetricType
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import java.time.Instant

/**
 * Manager for Health Connect API integration.
 * Handles permission requests and data synchronization.
 */
class HealthConnectManager(private val context: Context) {

    private val healthConnectClient by lazy {
        HealthConnectClient.getOrCreate(context)
    }

    /**
     * Check if Health Connect is available on this device.
     */
    suspend fun isAvailable(): Boolean {
        return HealthConnectClient.isAvailable(context)
    }

    /**
     * Get all required permissions for the app.
     */
    fun getRequiredPermissions(): Set<String> {
        return setOf(
            // Vitals
            HealthPermission.getReadPermission(HeartRateRecord::class),
            HealthPermission.getReadPermission(HeartRateVariabilityRmssdRecord::class),
            HealthPermission.getReadPermission(OxygenSaturationRecord::class),
            HealthPermission.getReadPermission(BloodPressureRecord::class),
            HealthPermission.getReadPermission(BodyTemperatureRecord::class),
            HealthPermission.getReadPermission(RestingHeartRateRecord::class),

            // Activity
            HealthPermission.getReadPermission(StepsRecord::class),
            HealthPermission.getReadPermission(DistanceRecord::class),
            HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
            HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class),
            HealthPermission.getReadPermission(FloorsClimbedRecord::class),

            // Sleep
            HealthPermission.getReadPermission(SleepSessionRecord::class),

            // Body Composition
            HealthPermission.getReadPermission(WeightRecord::class),
            HealthPermission.getReadPermission(HeightRecord::class),
            HealthPermission.getReadPermission(BodyFatRecord::class),

            // Nutrition
            HealthPermission.getReadPermission(NutritionRecord::class),
            HealthPermission.getReadPermission(HydrationRecord::class),

            // Exercise
            HealthPermission.getReadPermission(ExerciseSessionRecord::class),
            HealthPermission.getReadPermission(Vo2MaxRecord::class)
        )
    }

    /**
     * Check if all required permissions are granted.
     */
    suspend fun hasAllPermissions(): Boolean {
        val granted = healthConnectClient.permissionController.getGrantedPermissions()
        return granted.containsAll(getRequiredPermissions())
    }

    /**
     * Sync heart rate data from Health Connect.
     */
    suspend fun syncHeartRate(startTime: Instant, endTime: Instant): List<HealthMetric> {
        val request = ReadRecordsRequest(
            recordType = HeartRateRecord::class,
            timeRangeFilter = TimeRangeFilter.between(startTime, endTime)
        )

        val response = healthConnectClient.readRecords(request)

        return response.records.flatMap { record ->
            record.samples.map { sample ->
                HealthMetric(
                    timestamp = sample.time,
                    metricType = MetricType.HEART_RATE,
                    value = sample.beatsPerMinute.toDouble(),
                    unit = "bpm",
                    source = record.metadata.dataOrigin.packageName,
                    metadata = null
                )
            }
        }
    }

    /**
     * Sync HRV data from Health Connect.
     */
    suspend fun syncHeartRateVariability(startTime: Instant, endTime: Instant): List<HealthMetric> {
        val request = ReadRecordsRequest(
            recordType = HeartRateVariabilityRmssdRecord::class,
            timeRangeFilter = TimeRangeFilter.between(startTime, endTime)
        )

        val response = healthConnectClient.readRecords(request)

        return response.records.map { record ->
            HealthMetric(
                timestamp = record.time,
                metricType = MetricType.HEART_RATE_VARIABILITY,
                value = record.heartRateVariabilityMillis,
                unit = "ms",
                source = record.metadata.dataOrigin.packageName,
                metadata = null
            )
        }
    }

    /**
     * Sync steps data from Health Connect.
     */
    suspend fun syncSteps(startTime: Instant, endTime: Instant): List<HealthMetric> {
        val request = ReadRecordsRequest(
            recordType = StepsRecord::class,
            timeRangeFilter = TimeRangeFilter.between(startTime, endTime)
        )

        val response = healthConnectClient.readRecords(request)

        return response.records.map { record ->
            HealthMetric(
                timestamp = record.startTime,
                metricType = MetricType.STEPS,
                value = record.count.toDouble(),
                unit = "steps",
                source = record.metadata.dataOrigin.packageName,
                metadata = null
            )
        }
    }

    /**
     * Sync sleep data from Health Connect.
     */
    suspend fun syncSleep(startTime: Instant, endTime: Instant): List<HealthMetric> {
        val request = ReadRecordsRequest(
            recordType = SleepSessionRecord::class,
            timeRangeFilter = TimeRangeFilter.between(startTime, endTime)
        )

        val response = healthConnectClient.readRecords(request)

        return response.records.flatMap { record ->
            val durationHours = java.time.Duration.between(record.startTime, record.endTime).toMinutes() / 60.0

            val metrics = mutableListOf(
                HealthMetric(
                    timestamp = record.startTime,
                    metricType = MetricType.SLEEP_DURATION,
                    value = durationHours,
                    unit = "hours",
                    source = record.metadata.dataOrigin.packageName,
                    metadata = null
                )
            )

            // Parse sleep stages from record
            record.stages.forEach { stage ->
                val stageType = when (stage.stage) {
                    SleepSessionRecord.STAGE_TYPE_DEEP -> MetricType.SLEEP_DEEP
                    SleepSessionRecord.STAGE_TYPE_LIGHT -> MetricType.SLEEP_LIGHT
                    SleepSessionRecord.STAGE_TYPE_REM -> MetricType.SLEEP_REM
                    SleepSessionRecord.STAGE_TYPE_AWAKE -> MetricType.SLEEP_AWAKE
                    else -> null
                }

                stageType?.let {
                    val stageDuration = java.time.Duration.between(stage.startTime, stage.endTime).toMinutes() / 60.0
                    metrics.add(
                        HealthMetric(
                            timestamp = stage.startTime,
                            metricType = it,
                            value = stageDuration,
                            unit = "hours",
                            source = record.metadata.dataOrigin.packageName,
                            metadata = null
                        )
                    )
                }
            }

            metrics
        }
    }

    /**
     * Sync oxygen saturation data from Health Connect.
     */
    suspend fun syncOxygenSaturation(startTime: Instant, endTime: Instant): List<HealthMetric> {
        val request = ReadRecordsRequest(
            recordType = OxygenSaturationRecord::class,
            timeRangeFilter = TimeRangeFilter.between(startTime, endTime)
        )

        val response = healthConnectClient.readRecords(request)

        return response.records.map { record ->
            HealthMetric(
                timestamp = record.time,
                metricType = MetricType.BLOOD_OXYGEN,
                value = record.percentage.value,
                unit = "%",
                source = record.metadata.dataOrigin.packageName,
                metadata = null
            )
        }
    }

    /**
     * Sync weight data from Health Connect.
     */
    suspend fun syncWeight(startTime: Instant, endTime: Instant): List<HealthMetric> {
        val request = ReadRecordsRequest(
            recordType = WeightRecord::class,
            timeRangeFilter = TimeRangeFilter.between(startTime, endTime)
        )

        val response = healthConnectClient.readRecords(request)

        return response.records.map { record ->
            HealthMetric(
                timestamp = record.time,
                metricType = MetricType.WEIGHT,
                value = record.weight.inKilograms,
                unit = "kg",
                source = record.metadata.dataOrigin.packageName,
                metadata = null
            )
        }
    }

    /**
     * Sync active calories burned from Health Connect.
     */
    suspend fun syncActiveCalories(startTime: Instant, endTime: Instant): List<HealthMetric> {
        val request = ReadRecordsRequest(
            recordType = ActiveCaloriesBurnedRecord::class,
            timeRangeFilter = TimeRangeFilter.between(startTime, endTime)
        )

        val response = healthConnectClient.readRecords(request)

        return response.records.map { record ->
            HealthMetric(
                timestamp = record.startTime,
                metricType = MetricType.ACTIVE_CALORIES,
                value = record.energy.inKilocalories,
                unit = "kcal",
                source = record.metadata.dataOrigin.packageName,
                metadata = null
            )
        }
    }

    /**
     * Sync all available health data for the specified time range.
     */
    suspend fun syncAll(startTime: Instant, endTime: Instant): List<HealthMetric> {
        val allMetrics = mutableListOf<HealthMetric>()

        runCatching { allMetrics.addAll(syncHeartRate(startTime, endTime)) }
        runCatching { allMetrics.addAll(syncHeartRateVariability(startTime, endTime)) }
        runCatching { allMetrics.addAll(syncSteps(startTime, endTime)) }
        runCatching { allMetrics.addAll(syncSleep(startTime, endTime)) }
        runCatching { allMetrics.addAll(syncOxygenSaturation(startTime, endTime)) }
        runCatching { allMetrics.addAll(syncWeight(startTime, endTime)) }
        runCatching { allMetrics.addAll(syncActiveCalories(startTime, endTime)) }

        return allMetrics
    }
}