package com.healthhub.healthbridge

import android.content.Context
import android.util.Log
import androidx.work.*
import kotlinx.coroutines.flow.first
import java.util.concurrent.TimeUnit

class BackgroundSyncWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    companion object {
        private const val TAG = "BackgroundSyncWorker"
        private const val WORK_NAME = "health_data_background_sync"
        private const val SYNC_INTERVAL_HOURS = 6L

        fun schedulePeriodicSync(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .setRequiresBatteryNotLow(true)
                .build()

            val periodicWorkRequest = PeriodicWorkRequestBuilder<BackgroundSyncWorker>(
                SYNC_INTERVAL_HOURS,
                TimeUnit.HOURS,
                15,
                TimeUnit.MINUTES
            )
                .setConstraints(constraints)
                .setBackoffCriteria(
                    BackoffPolicy.EXPONENTIAL,
                    WorkRequest.MIN_BACKOFF_MILLIS,
                    TimeUnit.MILLISECONDS
                )
                .addTag(WORK_NAME)
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                periodicWorkRequest
            )

            Log.i(TAG, "Background sync scheduled (every $SYNC_INTERVAL_HOURS hours)")
        }

        fun cancelPeriodicSync(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
            Log.i(TAG, "Background sync cancelled")
        }

        fun triggerImmediateSync(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val oneTimeWorkRequest = OneTimeWorkRequestBuilder<BackgroundSyncWorker>()
                .setConstraints(constraints)
                .setBackoffCriteria(
                    BackoffPolicy.EXPONENTIAL,
                    WorkRequest.MIN_BACKOFF_MILLIS,
                    TimeUnit.MILLISECONDS
                )
                .addTag("immediate_sync")
                .build()

            WorkManager.getInstance(context).enqueue(oneTimeWorkRequest)
            Log.i(TAG, "Immediate sync triggered")
        }
    }

    override suspend fun doWork(): Result {
        Log.i(TAG, "Background sync started")

        return try {
            val healthConnectService = HealthConnectService(applicationContext)
            val encryptionManager = EncryptionManager()
            val uploadManager = UploadManager(applicationContext)

            if (!healthConnectService.isHealthConnectAvailable()) {
                Log.e(TAG, "HealthConnect not available")
                return Result.failure()
            }

            if (!uploadManager.isConfigured()) {
                Log.e(TAG, "Upload manager not configured")
                return Result.failure()
            }

            val healthDataFlow = healthConnectService.extractUltraRichHealthData(daysBack = 7)
            val healthBundle = healthDataFlow.first()

            if (healthBundle.dataPointCount == 0) {
                Log.i(TAG, "No health data to sync")
                return Result.success()
            }

            Log.i(TAG, "Extracted ${healthBundle.dataPointCount} health data points")

            val uploadResult = uploadManager.uploadHealthDataBundle(healthBundle, encryptionManager)

            when (uploadResult) {
                is UploadManager.UploadResult.Success -> {
                    Log.i(TAG, "Background sync completed: ${uploadResult.dataPointsUploaded} data points uploaded")

                    val prefs = applicationContext.getSharedPreferences("health_bridge_prefs", Context.MODE_PRIVATE)
                    prefs.edit().putLong("last_sync_timestamp", System.currentTimeMillis()).apply()

                    Result.success()
                }
                is UploadManager.UploadResult.Error -> {
                    Log.e(TAG, "Background sync failed: ${uploadResult.message}")
                    Result.retry()
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Background sync error", e)
            Result.retry()
        }
    }
}
