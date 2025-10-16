package com.healthhub.healthbridge

import android.app.Application
import android.util.Log

class HealthBridgeApplication : Application() {
    companion object {
        private const val TAG = "HealthBridgeApp"
    }

    override fun onCreate() {
        super.onCreate()
        Log.i(TAG, "HealthBridge Application started")

        val uploadManager = UploadManager(this)
        if (uploadManager.isConfigured()) {
            BackgroundSyncWorker.schedulePeriodicSync(this)
            Log.i(TAG, "Background sync scheduled")
        } else {
            Log.w(TAG, "Upload manager not configured - background sync not scheduled")
        }
    }
}
