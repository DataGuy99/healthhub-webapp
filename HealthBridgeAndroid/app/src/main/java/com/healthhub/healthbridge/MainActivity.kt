package com.healthhub.healthbridge

import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.health.connect.client.PermissionController
import androidx.lifecycle.lifecycleScope
import androidx.work.WorkInfo
import androidx.work.WorkManager
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

class MainActivity : AppCompatActivity() {
    private lateinit var healthConnectService: HealthConnectService
    private lateinit var encryptionManager: EncryptionManager
    private lateinit var uploadManager: UploadManager

    private lateinit var statusText: TextView
    private lateinit var lastSyncText: TextView
    private lateinit var syncButton: Button
    private lateinit var configButton: Button
    private lateinit var autoSyncButton: Button
    private lateinit var progressBar: ProgressBar

    private var isAutoSyncEnabled = false

    companion object {
        private const val TAG = "MainActivity"
        private val dateFormatter = SimpleDateFormat("MMM dd, yyyy HH:mm", Locale.getDefault())
    }

    // Health Connect permission launcher using official contract
    private val requestPermissions = registerForActivityResult(
        PermissionController.createRequestPermissionResultContract()
    ) { granted ->
        val requiredPermissions = healthConnectService.getRequiredPermissions()
        if (granted.containsAll(requiredPermissions)) {
            statusText.text = "Permissions granted - ready to sync"
            syncButton.isEnabled = true
            Toast.makeText(this, "Health Connect permissions granted", Toast.LENGTH_SHORT).show()
        } else {
            statusText.text = "Permissions required to sync health data"
            Toast.makeText(this, "Please grant all Health Connect permissions", Toast.LENGTH_LONG).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        healthConnectService = HealthConnectService(this)
        encryptionManager = EncryptionManager()
        uploadManager = UploadManager(this)

        initializeViews()
        setupClickListeners()
        checkConfiguration()
        checkPermissions()
        updateLastSyncTime()
        observeBackgroundSync()
    }

    private fun initializeViews() {
        statusText = findViewById(R.id.status_text)
        lastSyncText = findViewById(R.id.last_sync_text)
        syncButton = findViewById(R.id.sync_button)
        configButton = findViewById(R.id.config_button)
        autoSyncButton = findViewById(R.id.auto_sync_button)
        progressBar = findViewById(R.id.progress_bar)

        val prefs = getSharedPreferences("health_bridge_prefs", MODE_PRIVATE)
        isAutoSyncEnabled = prefs.getBoolean("auto_sync_enabled", false)
        updateAutoSyncButton()
    }

    private fun setupClickListeners() {
        syncButton.setOnClickListener {
            performManualSync()
        }

        configButton.setOnClickListener {
            showConfigurationDialog()
        }

        autoSyncButton.setOnClickListener {
            toggleAutoSync()
        }
    }

    private fun checkConfiguration() {
        if (!uploadManager.isConfigured()) {
            statusText.text = "Configuration required"
            syncButton.isEnabled = false
            showConfigurationDialog()
        }
    }

    private fun checkPermissions() {
        lifecycleScope.launch {
            if (!healthConnectService.isHealthConnectAvailable()) {
                statusText.text = "HealthConnect not available"
                syncButton.isEnabled = false
                Toast.makeText(this@MainActivity,
                    "Please install Health Connect from Play Store",
                    Toast.LENGTH_LONG).show()
                return@launch
            }

            val permissions = healthConnectService.getRequiredPermissions()
            // Launch Health Connect's official permission request UI
            requestPermissions.launch(permissions)
        }
    }

    private fun performManualSync() {
        lifecycleScope.launch {
            try {
                statusText.text = "Syncing health data..."
                progressBar.visibility = View.VISIBLE
                syncButton.isEnabled = false

                val healthDataFlow = healthConnectService.extractUltraRichHealthData(daysBack = 30)
                val healthBundle = healthDataFlow.first()

                Log.i(TAG, "Extracted ${healthBundle.dataPointCount} health data points")

                if (healthBundle.dataPointCount == 0) {
                    statusText.text = "No health data found"
                    Toast.makeText(this@MainActivity, "No health data to sync", Toast.LENGTH_SHORT).show()
                    progressBar.visibility = View.GONE
                    syncButton.isEnabled = true
                    return@launch
                }

                val uploadResult = uploadManager.uploadHealthDataBundle(healthBundle, encryptionManager)

                when (uploadResult) {
                    is UploadManager.UploadResult.Success -> {
                        statusText.text = "Sync successful"
                        Toast.makeText(
                            this@MainActivity,
                            "Synced ${uploadResult.dataPointsUploaded} data points",
                            Toast.LENGTH_SHORT
                        ).show()

                        val prefs = getSharedPreferences("health_bridge_prefs", MODE_PRIVATE)
                        prefs.edit().putLong("last_sync_timestamp", System.currentTimeMillis()).apply()
                        updateLastSyncTime()
                    }
                    is UploadManager.UploadResult.Error -> {
                        statusText.text = "Sync failed"
                        Toast.makeText(
                            this@MainActivity,
                            "Upload failed: ${uploadResult.message}",
                            Toast.LENGTH_LONG
                        ).show()
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Sync error", e)
                statusText.text = "Sync error"
                Toast.makeText(this@MainActivity, "Error: ${e.message}", Toast.LENGTH_LONG).show()
            } finally {
                progressBar.visibility = View.GONE
                syncButton.isEnabled = true
            }
        }
    }

    private fun showConfigurationDialog() {
        val dialogView = layoutInflater.inflate(R.layout.dialog_configuration, null)
        val urlInput = dialogView.findViewById<EditText>(R.id.supabase_url_input)
        val keyInput = dialogView.findViewById<EditText>(R.id.supabase_key_input)
        val userIdInput = dialogView.findViewById<EditText>(R.id.user_id_input)

        val prefs = getSharedPreferences("health_bridge_prefs", MODE_PRIVATE)
        urlInput.setText(prefs.getString("supabase_url", ""))
        keyInput.setText(prefs.getString("supabase_key", ""))
        userIdInput.setText(prefs.getString("user_id", ""))

        AlertDialog.Builder(this)
            .setTitle("Configure Supabase Connection")
            .setView(dialogView)
            .setPositiveButton("Save") { _, _ ->
                val url = urlInput.text.toString().trim()
                val key = keyInput.text.toString().trim()
                val userId = userIdInput.text.toString().trim()

                if (url.isNotBlank() && key.isNotBlank() && userId.isNotBlank()) {
                    uploadManager.saveConfiguration(url, key, userId)
                    statusText.text = "Configuration saved"
                    syncButton.isEnabled = true
                    Toast.makeText(this, "Configuration saved", Toast.LENGTH_SHORT).show()

                    if (isAutoSyncEnabled) {
                        BackgroundSyncWorker.schedulePeriodicSync(this)
                    }
                } else {
                    Toast.makeText(this, "Please fill in all fields", Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun toggleAutoSync() {
        isAutoSyncEnabled = !isAutoSyncEnabled

        val prefs = getSharedPreferences("health_bridge_prefs", MODE_PRIVATE)
        prefs.edit().putBoolean("auto_sync_enabled", isAutoSyncEnabled).apply()

        if (isAutoSyncEnabled && uploadManager.isConfigured()) {
            BackgroundSyncWorker.schedulePeriodicSync(this)
            Toast.makeText(this, "Auto-sync enabled (every 6 hours)", Toast.LENGTH_SHORT).show()
        } else {
            BackgroundSyncWorker.cancelPeriodicSync(this)
            Toast.makeText(this, "Auto-sync disabled", Toast.LENGTH_SHORT).show()
        }

        updateAutoSyncButton()
    }

    private fun updateAutoSyncButton() {
        autoSyncButton.text = if (isAutoSyncEnabled) {
            "Disable Auto-Sync"
        } else {
            "Enable Auto-Sync"
        }
    }

    private fun updateLastSyncTime() {
        val prefs = getSharedPreferences("health_bridge_prefs", MODE_PRIVATE)
        val lastSyncTimestamp = prefs.getLong("last_sync_timestamp", 0)

        lastSyncText.text = if (lastSyncTimestamp > 0) {
            "Last sync: ${dateFormatter.format(Date(lastSyncTimestamp))}"
        } else {
            "Never synced"
        }
    }

    private fun observeBackgroundSync() {
        WorkManager.getInstance(this)
            .getWorkInfosByTagLiveData("health_data_background_sync")
            .observe(this) { workInfos ->
                workInfos?.forEach { workInfo ->
                    when (workInfo.state) {
                        WorkInfo.State.RUNNING -> {
                            statusText.text = "Background sync in progress..."
                        }
                        WorkInfo.State.SUCCEEDED -> {
                            updateLastSyncTime()
                        }
                        WorkInfo.State.FAILED -> {
                            statusText.text = "Background sync failed"
                        }
                        else -> {}
                    }
                }
            }
    }
}
