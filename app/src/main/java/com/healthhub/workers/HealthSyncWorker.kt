package com.healthhub.workers

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import androidx.work.ForegroundInfo
import androidx.core.app.NotificationCompat
import com.healthhub.data.healthconnect.HealthConnectManager
import com.healthhub.data.repository.HealthRepository
import java.time.Instant
import java.time.temporal.ChronoUnit

/**
 * Background worker for syncing Health Connect data.
 * Runs periodically via WorkManager (minimum 15 minutes).
 */
class HealthSyncWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    private val healthConnectManager = HealthConnectManager(context)
    // Note: In production, inject repository via dependency injection (Hilt/Koin)

    override suspend fun doWork(): Result {
        return try {
            // Check if Health Connect is available
            if (!healthConnectManager.isAvailable()) {
                return Result.failure()
            }

            // Check if we have permissions
            if (!healthConnectManager.hasAllPermissions()) {
                return Result.failure()
            }

            // Sync last 7 days of data
            val endTime = Instant.now()
            val startTime = endTime.minus(7, ChronoUnit.DAYS)

            val metrics = healthConnectManager.syncAll(startTime, endTime)

            // TODO: Save to database via repository
            // This requires proper DI setup to inject HealthRepository

            Result.success()
        } catch (e: Exception) {
            // Retry on failure
            Result.retry()
        }
    }

    override suspend fun getForegroundInfo(): ForegroundInfo {
        val notification = NotificationCompat.Builder(applicationContext, CHANNEL_ID)
            .setContentTitle("HealthHub Sync")
            .setContentText("Syncing health data...")
            .setSmallIcon(android.R.drawable.ic_popup_sync)
            .build()

        return ForegroundInfo(NOTIFICATION_ID, notification)
    }

    companion object {
        const val WORK_NAME = "health_sync_worker"
        const val CHANNEL_ID = "health_sync_channel"
        const val NOTIFICATION_ID = 1001
    }
}