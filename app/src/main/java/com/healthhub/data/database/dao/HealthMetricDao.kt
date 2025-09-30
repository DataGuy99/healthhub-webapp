package com.healthhub.data.database.dao

import androidx.room.*
import com.healthhub.data.database.entities.HealthMetric
import com.healthhub.data.database.entities.MetricType
import kotlinx.coroutines.flow.Flow
import java.time.Instant

@Dao
interface HealthMetricDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(metric: HealthMetric): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(metrics: List<HealthMetric>)

    @Update
    suspend fun update(metric: HealthMetric)

    @Delete
    suspend fun delete(metric: HealthMetric)

    @Query("SELECT * FROM health_metrics WHERE id = :id")
    suspend fun getById(id: Long): HealthMetric?

    @Query("SELECT * FROM health_metrics WHERE metricType = :type AND timestamp >= :startTime AND timestamp <= :endTime ORDER BY timestamp ASC")
    suspend fun getMetricsByTypeInRange(type: MetricType, startTime: Instant, endTime: Instant): List<HealthMetric>

    @Query("SELECT * FROM health_metrics WHERE metricType = :type AND timestamp >= :startTime AND timestamp <= :endTime ORDER BY timestamp ASC")
    fun getMetricsByTypeInRangeFlow(type: MetricType, startTime: Instant, endTime: Instant): Flow<List<HealthMetric>>

    @Query("SELECT * FROM health_metrics WHERE metricType = :type ORDER BY timestamp DESC LIMIT :limit")
    suspend fun getLatestMetrics(type: MetricType, limit: Int): List<HealthMetric>

    @Query("SELECT * FROM health_metrics WHERE timestamp >= :startTime AND timestamp <= :endTime ORDER BY timestamp ASC")
    suspend fun getAllMetricsInRange(startTime: Instant, endTime: Instant): List<HealthMetric>

    @Query("SELECT DISTINCT metricType FROM health_metrics")
    suspend fun getAvailableMetricTypes(): List<MetricType>

    @Query("SELECT AVG(value) FROM health_metrics WHERE metricType = :type AND timestamp >= :startTime AND timestamp <= :endTime")
    suspend fun getAverageValue(type: MetricType, startTime: Instant, endTime: Instant): Double?

    @Query("SELECT MIN(value) FROM health_metrics WHERE metricType = :type AND timestamp >= :startTime AND timestamp <= :endTime")
    suspend fun getMinValue(type: MetricType, startTime: Instant, endTime: Instant): Double?

    @Query("SELECT MAX(value) FROM health_metrics WHERE metricType = :type AND timestamp >= :startTime AND timestamp <= :endTime")
    suspend fun getMaxValue(type: MetricType, startTime: Instant, endTime: Instant): Double?

    @Query("DELETE FROM health_metrics WHERE timestamp < :beforeTime")
    suspend fun deleteOlderThan(beforeTime: Instant): Int

    @Query("SELECT COUNT(*) FROM health_metrics")
    suspend fun getCount(): Int
}