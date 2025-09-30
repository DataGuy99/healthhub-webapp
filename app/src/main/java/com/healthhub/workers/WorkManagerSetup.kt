package com.healthhub.workers

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.work.*
import java.util.concurrent.TimeUnit

/**
 * Setup and configuration for WorkManager background sync.
 */
object WorkManagerSetup {

    /**
     * Schedule periodic health data sync.
     * Minimum interval is 15 minutes (Android WorkManager limitation).
     */
    fun schedulePeriodicSync(context: Context, intervalMinutes: Long = 15) {
        // Create notification channel for foreground service
        createNotificationChannel(context)

        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.NOT_REQUIRED) // Offline app
            .setRequiresBatteryNotLow(false) // Sync even on low battery
            .setRequiresCharging(false)
            .build()

        val syncRequest = PeriodicWorkRequestBuilder<HealthSyncWorker>(
            intervalMinutes, TimeUnit.MINUTES,
            5, TimeUnit.MINUTES // Flex interval
        )
            .setConstraints(constraints)
            .setBackoffCriteria(
                BackoffPolicy.EXPONENTIAL,
                WorkRequest.MIN_BACKOFF_MILLIS,
                TimeUnit.MILLISECONDS
            )
            .addTag("health_sync")
            .build()

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            HealthSyncWorker.WORK_NAME,
            ExistingPeriodicWorkPolicy.KEEP, // Don't replace if already scheduled
            syncRequest
        )
    }

    /**
     * Trigger immediate one-time sync.
     */
    fun triggerImmediateSync(context: Context) {
        val syncRequest = OneTimeWorkRequestBuilder<HealthSyncWorker>()
            .addTag("health_sync")
            .build()

        WorkManager.getInstance(context).enqueue(syncRequest)
    }

    /**
     * Cancel all scheduled sync work.
     */
    fun cancelSync(context: Context) {
        WorkManager.getInstance(context).cancelUniqueWork(HealthSyncWorker.WORK_NAME)
    }

    /**
     * Create notification channel for foreground service (Android 8.0+).
     */
    private fun createNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                HealthSyncWorker.CHANNEL_ID,
                "Health Data Sync",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Background sync for health data from Health Connect"
                enableLights(false)
                enableVibration(false)
            }

            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }
}