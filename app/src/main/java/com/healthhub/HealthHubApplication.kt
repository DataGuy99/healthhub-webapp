package com.healthhub

import android.app.Application
import com.healthhub.workers.WorkManagerSetup

/**
 * Main application class for HealthHub.
 */
class HealthHubApplication : Application() {

    override fun onCreate() {
        super.onCreate()

        // Schedule periodic health data sync (every 15 minutes)
        WorkManagerSetup.schedulePeriodicSync(this, intervalMinutes = 15)
    }
}