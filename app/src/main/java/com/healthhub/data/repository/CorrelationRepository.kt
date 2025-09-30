package com.healthhub.data.repository

import com.healthhub.data.database.dao.CorrelationDao
import com.healthhub.data.database.dao.HealthMetricDao
import com.healthhub.data.database.dao.SupplementLogDao
import com.healthhub.data.database.entities.*
import kotlinx.coroutines.flow.Flow
import org.apache.commons.math3.stat.correlation.PearsonsCorrelation
import org.apache.commons.math3.stat.correlation.SpearmansCorrelation
import java.time.Instant
import java.time.temporal.ChronoUnit
import kotlin.math.abs

/**
 * Repository for correlation analysis between metrics and supplements.
 */
class CorrelationRepository(
    private val correlationDao: CorrelationDao,
    private val healthMetricDao: HealthMetricDao,
    private val supplementLogDao: SupplementLogDao
) {

    /**
     * Calculate correlations between a supplement and all available metrics.
     */
    suspend fun calculateSupplementCorrelations(
        supplementId: Long,
        startTime: Instant,
        endTime: Instant,
        lagHours: Int = 0
    ): List<Correlation> {
        val supplementLogs = supplementLogDao.getLogsBySupplementInRange(supplementId, startTime, endTime)
        if (supplementLogs.size < 10) return emptyList() // Need minimum sample size

        val metricTypes = healthMetricDao.getAvailableMetricTypes()
        val correlations = mutableListOf<Correlation>()

        for (metricType in metricTypes) {
            val metrics = healthMetricDao.getMetricsByTypeInRange(metricType, startTime, endTime)
            if (metrics.size < 10) continue

            // Calculate correlation with lag
            val correlation = calculateCorrelation(
                supplementLogs = supplementLogs,
                metrics = metrics,
                lagHours = lagHours
            )

            correlation?.let { correlations.add(it) }
        }

        // Save correlations to database
        correlationDao.insertAll(correlations)

        return correlations
    }

    /**
     * Calculate correlation between two metrics.
     */
    suspend fun calculateMetricCorrelation(
        metricTypeA: MetricType,
        metricTypeB: MetricType,
        startTime: Instant,
        endTime: Instant,
        lagHours: Int = 0
    ): Correlation? {
        val metricsA = healthMetricDao.getMetricsByTypeInRange(metricTypeA, startTime, endTime)
        val metricsB = healthMetricDao.getMetricsByTypeInRange(metricTypeB, startTime, endTime)

        if (metricsA.size < 10 || metricsB.size < 10) return null

        // Align timestamps (hourly buckets)
        val bucketedA = bucketMetricsByHour(metricsA)
        val bucketedB = bucketMetricsByHour(metricsB)

        // Apply lag
        val shiftedB = if (lagHours > 0) {
            bucketedB.mapKeys { it.key.plus(lagHours.toLong(), ChronoUnit.HOURS) }
        } else {
            bucketedB
        }

        // Find common timestamps
        val commonTimestamps = bucketedA.keys.intersect(shiftedB.keys).sorted()
        if (commonTimestamps.size < 10) return null

        val valuesA = commonTimestamps.map { bucketedA[it]!! }.toDoubleArray()
        val valuesB = commonTimestamps.map { shiftedB[it]!! }.toDoubleArray()

        // Calculate Pearson correlation
        val pearson = PearsonsCorrelation()
        val coefficient = pearson.correlation(valuesA, valuesB)

        // Simple p-value estimation (would need proper statistical test in production)
        val pValue = estimatePValue(coefficient, commonTimestamps.size)

        val correlation = Correlation(
            metricA = "METRIC:${metricTypeA.name}",
            metricB = "METRIC:${metricTypeB.name}",
            coefficient = coefficient,
            pValue = pValue,
            sampleSize = commonTimestamps.size,
            correlationType = CorrelationType.PEARSON,
            lagHours = lagHours,
            periodStart = startTime,
            periodEnd = endTime
        )

        // Save to database
        correlationDao.insert(correlation)

        return correlation
    }

    /**
     * Get correlations for a specific metric or supplement.
     */
    suspend fun getCorrelations(identifier: String): List<Correlation> {
        return correlationDao.getCorrelationsForMetric(identifier)
    }

    /**
     * Get correlations for a specific metric as a Flow.
     */
    fun getCorrelationsFlow(identifier: String): Flow<List<Correlation>> {
        return correlationDao.getCorrelationsForMetricFlow(identifier)
    }

    /**
     * Get significant correlations (high coefficient, low p-value).
     */
    suspend fun getSignificantCorrelations(
        minCoefficient: Double = 0.3,
        maxPValue: Double = 0.05
    ): List<Correlation> {
        return correlationDao.getSignificantCorrelations(minCoefficient, maxPValue)
    }

    /**
     * Get significant correlations as a Flow.
     */
    fun getSignificantCorrelationsFlow(
        minCoefficient: Double = 0.3,
        maxPValue: Double = 0.05
    ): Flow<List<Correlation>> {
        return correlationDao.getSignificantCorrelationsFlow(minCoefficient, maxPValue)
    }

    /**
     * Get strongest correlations (by absolute coefficient value).
     */
    suspend fun getStrongestCorrelations(limit: Int = 20): List<Correlation> {
        return correlationDao.getStrongestCorrelations(limit)
    }

    /**
     * Private helper: Calculate correlation between supplement logs and metric.
     */
    private fun calculateCorrelation(
        supplementLogs: List<SupplementLog>,
        metrics: List<HealthMetric>,
        lagHours: Int
    ): Correlation? {
        // Bucket supplement logs by day (binary: took supplement or not)
        val supplementDays = supplementLogs
            .groupBy { it.timestamp.truncatedTo(ChronoUnit.DAYS) }
            .mapValues { 1.0 } // Binary: 1 if supplement taken

        // Bucket metrics by day (average value)
        val metricDays = bucketMetricsByDay(metrics)

        // Apply lag to supplement data
        val shiftedSupplementDays = supplementDays
            .mapKeys { it.key.plus(lagHours.toLong(), ChronoUnit.HOURS) }

        // Find common days
        val commonDays = shiftedSupplementDays.keys.intersect(metricDays.keys).sorted()
        if (commonDays.size < 10) return null

        val supplementValues = commonDays.map { shiftedSupplementDays[it] ?: 0.0 }.toDoubleArray()
        val metricValues = commonDays.map { metricDays[it]!! }.toDoubleArray()

        // Use Spearman for binary supplement data
        val spearman = SpearmansCorrelation()
        val coefficient = spearman.correlation(supplementValues, metricValues)

        if (coefficient.isNaN()) return null

        val pValue = estimatePValue(coefficient, commonDays.size)

        return Correlation(
            metricA = "SUPPLEMENT:${supplementLogs.first().supplementId}",
            metricB = "METRIC:${metrics.first().metricType.name}",
            coefficient = coefficient,
            pValue = pValue,
            sampleSize = commonDays.size,
            correlationType = CorrelationType.SPEARMAN,
            lagHours = lagHours,
            periodStart = metrics.first().timestamp,
            periodEnd = metrics.last().timestamp
        )
    }

    /**
     * Private helper: Bucket metrics by hour (average value).
     */
    private fun bucketMetricsByHour(metrics: List<HealthMetric>): Map<Instant, Double> {
        return metrics
            .groupBy { it.timestamp.truncatedTo(ChronoUnit.HOURS) }
            .mapValues { entry -> entry.value.map { it.value }.average() }
    }

    /**
     * Private helper: Bucket metrics by day (average value).
     */
    private fun bucketMetricsByDay(metrics: List<HealthMetric>): Map<Instant, Double> {
        return metrics
            .groupBy { it.timestamp.truncatedTo(ChronoUnit.DAYS) }
            .mapValues { entry -> entry.value.map { it.value }.average() }
    }

    /**
     * Private helper: Estimate p-value (simplified).
     * In production, use proper statistical test.
     */
    private fun estimatePValue(coefficient: Double, sampleSize: Int): Double {
        // Simplified p-value estimation using t-distribution approximation
        // For proper implementation, use Apache Commons Math or similar library
        val absCoeff = abs(coefficient)
        return when {
            absCoeff >= 0.7 && sampleSize >= 20 -> 0.001
            absCoeff >= 0.5 && sampleSize >= 20 -> 0.01
            absCoeff >= 0.3 && sampleSize >= 30 -> 0.05
            absCoeff >= 0.2 && sampleSize >= 50 -> 0.1
            else -> 0.5
        }
    }

    /**
     * Clean up old correlations (older than N days).
     */
    suspend fun cleanupOldCorrelations(daysToKeep: Int = 90): Int {
        val cutoffTime = Instant.now().minus(daysToKeep.toLong(), ChronoUnit.DAYS)
        return correlationDao.deleteOlderThan(cutoffTime)
    }
}