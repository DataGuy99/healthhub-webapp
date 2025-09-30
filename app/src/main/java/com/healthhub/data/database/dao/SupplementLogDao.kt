package com.healthhub.data.database.dao

import androidx.room.*
import com.healthhub.data.database.entities.SupplementLog
import kotlinx.coroutines.flow.Flow
import java.time.Instant

@Dao
interface SupplementLogDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(log: SupplementLog): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(logs: List<SupplementLog>)

    @Update
    suspend fun update(log: SupplementLog)

    @Delete
    suspend fun delete(log: SupplementLog)

    @Query("SELECT * FROM supplement_logs WHERE id = :id")
    suspend fun getById(id: Long): SupplementLog?

    @Query("SELECT * FROM supplement_logs WHERE supplementId = :supplementId AND timestamp >= :startTime AND timestamp <= :endTime ORDER BY timestamp DESC")
    suspend fun getLogsBySupplementInRange(supplementId: Long, startTime: Instant, endTime: Instant): List<SupplementLog>

    @Query("SELECT * FROM supplement_logs WHERE supplementId = :supplementId AND timestamp >= :startTime AND timestamp <= :endTime ORDER BY timestamp DESC")
    fun getLogsBySupplementInRangeFlow(supplementId: Long, startTime: Instant, endTime: Instant): Flow<List<SupplementLog>>

    @Query("SELECT * FROM supplement_logs WHERE timestamp >= :startTime AND timestamp <= :endTime ORDER BY timestamp DESC")
    suspend fun getAllLogsInRange(startTime: Instant, endTime: Instant): List<SupplementLog>

    @Query("SELECT * FROM supplement_logs WHERE timestamp >= :startTime AND timestamp <= :endTime ORDER BY timestamp DESC")
    fun getAllLogsInRangeFlow(startTime: Instant, endTime: Instant): Flow<List<SupplementLog>>

    @Query("SELECT * FROM supplement_logs WHERE supplementId = :supplementId ORDER BY timestamp DESC LIMIT :limit")
    suspend fun getLatestLogs(supplementId: Long, limit: Int): List<SupplementLog>

    @Query("SELECT COUNT(*) FROM supplement_logs WHERE supplementId = :supplementId AND timestamp >= :startTime AND timestamp <= :endTime")
    suspend fun getLogCount(supplementId: Long, startTime: Instant, endTime: Instant): Int

    @Query("DELETE FROM supplement_logs WHERE timestamp < :beforeTime")
    suspend fun deleteOlderThan(beforeTime: Instant): Int
}