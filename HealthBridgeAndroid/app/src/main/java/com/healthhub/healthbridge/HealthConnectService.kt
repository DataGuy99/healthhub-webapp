package com.healthhub.healthbridge

import android.content.Context
import android.util.Log
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.*
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import kotlin.reflect.KClass

class HealthConnectService(private val context: Context) {
    private val healthClient: HealthConnectClient? = try {
        HealthConnectClient.getOrCreate(context)
    } catch (e: Exception) {
        Log.e(TAG, "HealthConnect not available", e)
        null
    }

    companion object {
        private const val TAG = "HealthConnectService"
        private val ISO_FORMATTER = DateTimeFormatter.ISO_INSTANT
    }

    suspend fun isHealthConnectAvailable(): Boolean {
        return healthClient != null
    }

    fun getRequiredPermissions(): Set<String> {
        return setOf(
            HealthPermission.getReadPermission(HeartRateRecord::class),
            HealthPermission.getReadPermission(OxygenSaturationRecord::class),
            HealthPermission.getReadPermission(RespiratoryRateRecord::class),
            HealthPermission.getReadPermission(BodyTemperatureRecord::class),
            HealthPermission.getReadPermission(StepsRecord::class),
            HealthPermission.getReadPermission(DistanceRecord::class),
            HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class),
            HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
            HealthPermission.getReadPermission(ExerciseSessionRecord::class),
            HealthPermission.getReadPermission(SleepSessionRecord::class),
            HealthPermission.getReadPermission(NutritionRecord::class),
            HealthPermission.getReadPermission(HydrationRecord::class)
        )
    }

    suspend fun extractUltraRichHealthData(daysBack: Int = 30): Flow<HealthDataBundle> = flow {
        if (healthClient == null) {
            Log.e(TAG, "HealthConnect client not available")
            emit(HealthDataBundle(emptyList(), ISO_FORMATTER.format(Instant.now()), 0))
            return@flow
        }

        val endTime = Instant.now()
        val startTime = endTime.minus(daysBack.toLong(), ChronoUnit.DAYS)
        val timeRangeFilter = TimeRangeFilter.between(startTime, endTime)

        val allDataPoints = mutableListOf<HealthDataPoint>()

        try {
            // Heart Rate - 1Hz granularity when available
            allDataPoints.addAll(extractHeartRate(timeRangeFilter))

            // Blood Oxygen
            allDataPoints.addAll(extractBloodOxygen(timeRangeFilter))

            // Respiratory Rate
            allDataPoints.addAll(extractRespiratoryRate(timeRangeFilter))

            // Body Temperature
            allDataPoints.addAll(extractBodyTemperature(timeRangeFilter))

            // Steps
            allDataPoints.addAll(extractSteps(timeRangeFilter))

            // Distance
            allDataPoints.addAll(extractDistance(timeRangeFilter))

            // Calories (Total)
            allDataPoints.addAll(extractTotalCalories(timeRangeFilter))

            // Calories (Active)
            allDataPoints.addAll(extractActiveCalories(timeRangeFilter))

            // Exercise Sessions
            allDataPoints.addAll(extractExercise(timeRangeFilter))

            // Sleep Sessions
            allDataPoints.addAll(extractSleep(timeRangeFilter))

            // Nutrition
            allDataPoints.addAll(extractNutrition(timeRangeFilter))

            // Hydration
            allDataPoints.addAll(extractHydration(timeRangeFilter))

            Log.i(TAG, "Extracted ${allDataPoints.size} health data points")

            emit(HealthDataBundle(
                dataPoints = allDataPoints,
                extractionTimestamp = ISO_FORMATTER.format(Instant.now()),
                dataPointCount = allDataPoints.size
            ))
        } catch (e: Exception) {
            Log.e(TAG, "Error extracting health data", e)
            emit(HealthDataBundle(emptyList(), ISO_FORMATTER.format(Instant.now()), 0))
        }
    }

    private suspend fun extractHeartRate(timeRangeFilter: TimeRangeFilter): List<HealthDataPoint> {
        return extractRecords(HeartRateRecord::class, timeRangeFilter) { record ->
            record.samples.map { sample ->
                HealthDataPoint(
                    timestamp = ISO_FORMATTER.format(sample.time),
                    type = HealthMetricType.HEART_RATE.typeName,
                    value = sample.beatsPerMinute.toDouble(),
                    accuracy = null,
                    source = record.metadata.dataOrigin.packageName,
                    context = null,
                    metadata = HealthMetadata(
                        deviceId = record.metadata.device?.model,
                        batteryLevel = null,
                        sensorConfidence = null,
                        environmental = null
                    )
                )
            }
        }
    }

    private suspend fun extractBloodOxygen(timeRangeFilter: TimeRangeFilter): List<HealthDataPoint> {
        return extractRecords(OxygenSaturationRecord::class, timeRangeFilter) { record ->
            listOf(HealthDataPoint(
                timestamp = ISO_FORMATTER.format(record.time),
                type = HealthMetricType.BLOOD_OXYGEN.typeName,
                value = record.percentage.value,
                accuracy = null,
                source = record.metadata.dataOrigin.packageName,
                context = null,
                metadata = HealthMetadata(
                    deviceId = record.metadata.device?.model,
                    batteryLevel = null,
                    sensorConfidence = null,
                    environmental = null
                )
            ))
        }
    }

    private suspend fun extractRespiratoryRate(timeRangeFilter: TimeRangeFilter): List<HealthDataPoint> {
        return extractRecords(RespiratoryRateRecord::class, timeRangeFilter) { record ->
            listOf(HealthDataPoint(
                timestamp = ISO_FORMATTER.format(record.time),
                type = HealthMetricType.RESPIRATORY_RATE.typeName,
                value = record.rate,
                accuracy = null,
                source = record.metadata.dataOrigin.packageName,
                context = null,
                metadata = null
            ))
        }
    }

    private suspend fun extractBodyTemperature(timeRangeFilter: TimeRangeFilter): List<HealthDataPoint> {
        return extractRecords(BodyTemperatureRecord::class, timeRangeFilter) { record ->
            listOf(HealthDataPoint(
                timestamp = ISO_FORMATTER.format(record.time),
                type = HealthMetricType.BODY_TEMPERATURE.typeName,
                value = record.temperature.inFahrenheit,
                accuracy = null,
                source = record.metadata.dataOrigin.packageName,
                context = null,
                metadata = null
            ))
        }
    }

    private suspend fun extractSteps(timeRangeFilter: TimeRangeFilter): List<HealthDataPoint> {
        return extractRecords(StepsRecord::class, timeRangeFilter) { record ->
            listOf(HealthDataPoint(
                timestamp = ISO_FORMATTER.format(record.startTime),
                type = HealthMetricType.STEPS.typeName,
                value = record.count.toDouble(),
                accuracy = null,
                source = record.metadata.dataOrigin.packageName,
                context = null,
                metadata = null
            ))
        }
    }

    private suspend fun extractDistance(timeRangeFilter: TimeRangeFilter): List<HealthDataPoint> {
        return extractRecords(DistanceRecord::class, timeRangeFilter) { record ->
            listOf(HealthDataPoint(
                timestamp = ISO_FORMATTER.format(record.startTime),
                type = HealthMetricType.DISTANCE.typeName,
                value = record.distance.inMeters,
                accuracy = null,
                source = record.metadata.dataOrigin.packageName,
                context = null,
                metadata = null
            ))
        }
    }

    private suspend fun extractTotalCalories(timeRangeFilter: TimeRangeFilter): List<HealthDataPoint> {
        return extractRecords(TotalCaloriesBurnedRecord::class, timeRangeFilter) { record ->
            listOf(HealthDataPoint(
                timestamp = ISO_FORMATTER.format(record.startTime),
                type = HealthMetricType.CALORIES.typeName,
                value = record.energy.inCalories,
                accuracy = null,
                source = record.metadata.dataOrigin.packageName,
                context = null,
                metadata = null
            ))
        }
    }

    private suspend fun extractActiveCalories(timeRangeFilter: TimeRangeFilter): List<HealthDataPoint> {
        return extractRecords(ActiveCaloriesBurnedRecord::class, timeRangeFilter) { record ->
            listOf(HealthDataPoint(
                timestamp = ISO_FORMATTER.format(record.startTime),
                type = HealthMetricType.CALORIES.typeName,
                value = record.energy.inCalories,
                accuracy = null,
                source = record.metadata.dataOrigin.packageName,
                context = HealthContext(activity = "active"),
                metadata = null
            ))
        }
    }

    private suspend fun extractExercise(timeRangeFilter: TimeRangeFilter): List<HealthDataPoint> {
        return extractRecords(ExerciseSessionRecord::class, timeRangeFilter) { record ->
            val durationMinutes = ChronoUnit.MINUTES.between(record.startTime, record.endTime).toDouble()
            listOf(HealthDataPoint(
                timestamp = ISO_FORMATTER.format(record.startTime),
                type = HealthMetricType.EXERCISE.typeName,
                value = durationMinutes,
                accuracy = null,
                source = record.metadata.dataOrigin.packageName,
                context = HealthContext(activity = record.exerciseType.toString()),
                metadata = null
            ))
        }
    }

    private suspend fun extractSleep(timeRangeFilter: TimeRangeFilter): List<HealthDataPoint> {
        return extractRecords(SleepSessionRecord::class, timeRangeFilter) { record ->
            record.stages.map { stage ->
                val durationMinutes = ChronoUnit.MINUTES.between(stage.startTime, stage.endTime).toDouble()
                HealthDataPoint(
                    timestamp = ISO_FORMATTER.format(stage.startTime),
                    type = HealthMetricType.SLEEP_STAGE.typeName,
                    value = durationMinutes,
                    accuracy = null,
                    source = record.metadata.dataOrigin.packageName,
                    context = HealthContext(sleepStage = stage.stage.toString()),
                    metadata = null
                )
            }
        }
    }

    private suspend fun extractNutrition(timeRangeFilter: TimeRangeFilter): List<HealthDataPoint> {
        return extractRecords(NutritionRecord::class, timeRangeFilter) { record ->
            listOf(HealthDataPoint(
                timestamp = ISO_FORMATTER.format(record.startTime),
                type = HealthMetricType.NUTRITION.typeName,
                value = record.energy?.inCalories ?: 0.0,
                accuracy = null,
                source = record.metadata.dataOrigin.packageName,
                context = null,
                metadata = null
            ))
        }
    }

    private suspend fun extractHydration(timeRangeFilter: TimeRangeFilter): List<HealthDataPoint> {
        return extractRecords(HydrationRecord::class, timeRangeFilter) { record ->
            listOf(HealthDataPoint(
                timestamp = ISO_FORMATTER.format(record.startTime),
                type = HealthMetricType.HYDRATION.typeName,
                value = record.volume.inMilliliters,
                accuracy = null,
                source = record.metadata.dataOrigin.packageName,
                context = null,
                metadata = null
            ))
        }
    }

    private suspend fun <T : Record> extractRecords(
        recordClass: KClass<T>,
        timeRangeFilter: TimeRangeFilter,
        mapper: (T) -> List<HealthDataPoint>
    ): List<HealthDataPoint> {
        return try {
            val request = ReadRecordsRequest(
                recordType = recordClass,
                timeRangeFilter = timeRangeFilter
            )
            val response = healthClient?.readRecords(request) ?: return emptyList()
            response.records.flatMap(mapper)
        } catch (e: Exception) {
            Log.e(TAG, "Error extracting ${recordClass.simpleName}", e)
            emptyList()
        }
    }
}
