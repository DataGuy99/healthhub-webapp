package com.healthhub.data.repository

import com.healthhub.data.database.dao.SupplementDao
import com.healthhub.data.database.dao.SupplementLogDao
import com.healthhub.data.database.entities.Supplement
import com.healthhub.data.database.entities.SupplementCategory
import com.healthhub.data.database.entities.SupplementLog
import kotlinx.coroutines.flow.Flow
import java.time.Instant
import java.time.temporal.ChronoUnit

/**
 * Repository for supplement data and logging.
 */
class SupplementRepository(
    private val supplementDao: SupplementDao,
    private val supplementLogDao: SupplementLogDao
) {

    /**
     * Get all active supplements.
     */
    suspend fun getActiveSupplements(): List<Supplement> {
        return supplementDao.getActive()
    }

    /**
     * Get all active supplements as a Flow.
     */
    fun getActiveSupplementsFlow(): Flow<List<Supplement>> {
        return supplementDao.getActiveFlow()
    }

    /**
     * Get all supplements (active and inactive).
     */
    suspend fun getAllSupplements(): List<Supplement> {
        return supplementDao.getAll()
    }

    /**
     * Get supplement by ID.
     */
    suspend fun getSupplementById(id: Long): Supplement? {
        return supplementDao.getById(id)
    }

    /**
     * Get supplement by ID as a Flow.
     */
    fun getSupplementByIdFlow(id: Long): Flow<Supplement?> {
        return supplementDao.getByIdFlow(id)
    }

    /**
     * Get supplements by category.
     */
    suspend fun getSupplementsByCategory(category: SupplementCategory): List<Supplement> {
        return supplementDao.getByCategory(category)
    }

    /**
     * Add a new supplement.
     */
    suspend fun addSupplement(supplement: Supplement): Long {
        return supplementDao.insert(supplement)
    }

    /**
     * Update an existing supplement.
     */
    suspend fun updateSupplement(supplement: Supplement) {
        supplementDao.update(supplement)
    }

    /**
     * Activate or deactivate a supplement.
     */
    suspend fun setSupplementActive(id: Long, isActive: Boolean) {
        supplementDao.setActive(id, isActive)
    }

    /**
     * Log a supplement intake.
     */
    suspend fun logSupplementIntake(log: SupplementLog): Long {
        return supplementLogDao.insert(log)
    }

    /**
     * Get supplement logs for a specific supplement in a date range.
     */
    suspend fun getSupplementLogs(
        supplementId: Long,
        startTime: Instant,
        endTime: Instant
    ): List<SupplementLog> {
        return supplementLogDao.getLogsBySupplementInRange(supplementId, startTime, endTime)
    }

    /**
     * Get supplement logs for a specific supplement as a Flow.
     */
    fun getSupplementLogsFlow(
        supplementId: Long,
        startTime: Instant,
        endTime: Instant
    ): Flow<List<SupplementLog>> {
        return supplementLogDao.getLogsBySupplementInRangeFlow(supplementId, startTime, endTime)
    }

    /**
     * Get all supplement logs in a date range.
     */
    suspend fun getAllLogsInRange(startTime: Instant, endTime: Instant): List<SupplementLog> {
        return supplementLogDao.getAllLogsInRange(startTime, endTime)
    }

    /**
     * Get all supplement logs in a date range as a Flow.
     */
    fun getAllLogsInRangeFlow(startTime: Instant, endTime: Instant): Flow<List<SupplementLog>> {
        return supplementLogDao.getAllLogsInRangeFlow(startTime, endTime)
    }

    /**
     * Get latest N logs for a supplement.
     */
    suspend fun getLatestLogs(supplementId: Long, limit: Int = 30): List<SupplementLog> {
        return supplementLogDao.getLatestLogs(supplementId, limit)
    }

    /**
     * Get supplement intake frequency (logs per day).
     */
    suspend fun getIntakeFrequency(
        supplementId: Long,
        startTime: Instant,
        endTime: Instant
    ): Double {
        val count = supplementLogDao.getLogCount(supplementId, startTime, endTime)
        val days = ChronoUnit.DAYS.between(startTime, endTime).coerceAtLeast(1)
        return count.toDouble() / days.toDouble()
    }

    /**
     * Clean up old logs (older than N days).
     */
    suspend fun cleanupOldLogs(daysToKeep: Int = 365): Int {
        val cutoffTime = Instant.now().minus(daysToKeep.toLong(), ChronoUnit.DAYS)
        return supplementLogDao.deleteOlderThan(cutoffTime)
    }
}