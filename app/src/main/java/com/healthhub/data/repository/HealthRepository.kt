package com.healthhub.data.repository

import com.healthhub.data.database.dao.HealthMetricDao
import com.healthhub.data.database.entities.HealthMetric
import com.healthhub.data.database.entities.MetricType
import com.healthhub.data.healthconnect.HealthConnectManager
import kotlinx.coroutines.flow.Flow
import java.time.Instant
import java.time.temporal.ChronoUnit

/**
 * Repository for health metric data.
 * Handles data synchronization between Health Connect and local database.
 */
class HealthRepository(
    private val healthMetricDao: HealthMetricDao,
    private val healthConnectManager: HealthConnectManager
) {

    /**
     * Sync health data from Health Connect for the last N days.
     */
    suspend fun syncHealthData(days: Int = 7): Result<Int> {
        return try {
            val endTime = Instant.now()
            val startTime = endTime.minus(days.toLong(), ChronoUnit.DAYS)

            // Sync all health data
            val metrics = healthConnectManager.syncAll(startTime, endTime)

            // Insert into database
            healthMetricDao.insertAll(metrics)

            Result.success(metrics.size)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Get health metrics by type in a date range.
     */
    suspend fun getMetricsByType(
        type: MetricType,
        startTime: Instant,
        endTime: Instant
    ): List<HealthMetric> {
        return healthMetricDao.getMetricsByTypeInRange(type, startTime, endTime)
    }

    /**
     * Get health metrics by type as a Flow (reactive updates).
     */
    fun getMetricsByTypeFlow(
        type: MetricType,
        startTime: Instant,
        endTime: Instant
    ): Flow<List<HealthMetric>> {
        return healthMetricDao.getMetricsByTypeInRangeFlow(type, startTime, endTime)
    }

    /**
     * Get latest N metrics of a specific type.
     */
    suspend fun getLatestMetrics(type: MetricType, limit: Int = 100): List<HealthMetric> {
        return healthMetricDao.getLatestMetrics(type, limit)
    }

    /**
     * Get statistics for a metric type in a date range.
     */
    suspend fun getMetricStats(
        type: MetricType,
        startTime: Instant,
        endTime: Instant
    ): MetricStats? {
        val avg = healthMetricDao.getAverageValue(type, startTime, endTime) ?: return null
        val min = healthMetricDao.getMinValue(type, startTime, endTime) ?: return null
        val max = healthMetricDao.getMaxValue(type, startTime, endTime) ?: return null

        return MetricStats(
            average = avg,
            min = min,
            max = max
        )
    }

    /**
     * Get all available metric types in the database.
     */
    suspend fun getAvailableMetricTypes(): List<MetricType> {
        return healthMetricDao.getAvailableMetricTypes()
    }

    /**
     * Insert a manual health metric entry.
     */
    suspend fun insertMetric(metric: HealthMetric): Long {
        return healthMetricDao.insert(metric)
    }

    /**
     * Clean up old data (older than N days).
     */
    suspend fun cleanupOldData(daysToKeep: Int = 365): Int {
        val cutoffTime = Instant.now().minus(daysToKeep.toLong(), ChronoUnit.DAYS)
        return healthMetricDao.deleteOlderThan(cutoffTime)
    }
}

/**
 * Statistics for a metric.
 */
data class MetricStats(
    val average: Double,
    val min: Double,
    val max: Double
)