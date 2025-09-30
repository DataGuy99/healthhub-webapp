package com.healthhub.data.database.dao

import androidx.room.*
import com.healthhub.data.database.entities.Correlation
import com.healthhub.data.database.entities.CorrelationType
import kotlinx.coroutines.flow.Flow
import java.time.Instant

@Dao
interface CorrelationDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(correlation: Correlation): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(correlations: List<Correlation>)

    @Update
    suspend fun update(correlation: Correlation)

    @Delete
    suspend fun delete(correlation: Correlation)

    @Query("SELECT * FROM correlations WHERE id = :id")
    suspend fun getById(id: Long): Correlation?

    @Query("SELECT * FROM correlations WHERE metricA = :metricA AND metricB = :metricB AND lagHours = :lagHours")
    suspend fun getCorrelation(metricA: String, metricB: String, lagHours: Int): Correlation?

    @Query("SELECT * FROM correlations WHERE (metricA = :metric OR metricB = :metric) ORDER BY ABS(coefficient) DESC")
    suspend fun getCorrelationsForMetric(metric: String): List<Correlation>

    @Query("SELECT * FROM correlations WHERE (metricA = :metric OR metricB = :metric) ORDER BY ABS(coefficient) DESC")
    fun getCorrelationsForMetricFlow(metric: String): Flow<List<Correlation>>

    @Query("SELECT * FROM correlations WHERE ABS(coefficient) >= :minCoefficient AND pValue <= :maxPValue ORDER BY ABS(coefficient) DESC")
    suspend fun getSignificantCorrelations(minCoefficient: Double, maxPValue: Double): List<Correlation>

    @Query("SELECT * FROM correlations WHERE ABS(coefficient) >= :minCoefficient AND pValue <= :maxPValue ORDER BY ABS(coefficient) DESC")
    fun getSignificantCorrelationsFlow(minCoefficient: Double, maxPValue: Double): Flow<List<Correlation>>

    @Query("SELECT * FROM correlations WHERE lagHours = :lagHours ORDER BY ABS(coefficient) DESC")
    suspend fun getCorrelationsByLag(lagHours: Int): List<Correlation>

    @Query("SELECT * FROM correlations ORDER BY calculatedAt DESC LIMIT :limit")
    suspend fun getLatestCorrelations(limit: Int): List<Correlation>

    @Query("SELECT * FROM correlations ORDER BY ABS(coefficient) DESC LIMIT :limit")
    suspend fun getStrongestCorrelations(limit: Int): List<Correlation>

    @Query("DELETE FROM correlations WHERE calculatedAt < :beforeTime")
    suspend fun deleteOlderThan(beforeTime: Instant): Int

    @Query("SELECT COUNT(*) FROM correlations")
    suspend fun getCount(): Int
}