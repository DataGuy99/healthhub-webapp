package com.healthhub.healthbridge

import android.content.Context
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

class UploadManager(private val context: Context) {
    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    companion object {
        private const val TAG = "UploadManager"
        private const val MEDIA_TYPE_JSON = "application/json; charset=utf-8"
        private const val PREFS_NAME = "health_bridge_prefs"
        private const val KEY_SUPABASE_URL = "supabase_url"
        private const val KEY_SUPABASE_KEY = "supabase_key"
        private const val KEY_USER_ID = "user_id"
    }

    fun isConfigured(): Boolean {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val supabaseUrl = prefs.getString(KEY_SUPABASE_URL, null)
        val supabaseKey = prefs.getString(KEY_SUPABASE_KEY, null)
        val userId = prefs.getString(KEY_USER_ID, null)
        return !supabaseUrl.isNullOrBlank() && !supabaseKey.isNullOrBlank() && !userId.isNullOrBlank()
    }

    fun saveConfiguration(supabaseUrl: String, supabaseKey: String, userId: String) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().apply {
            putString(KEY_SUPABASE_URL, supabaseUrl.trim())
            putString(KEY_SUPABASE_KEY, supabaseKey.trim())
            putString(KEY_USER_ID, userId.trim())
            apply()
        }
        Log.i(TAG, "Supabase configuration saved")
    }

    private fun getSupabaseUrl(): String {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(KEY_SUPABASE_URL, "") ?: ""
    }

    private fun getSupabaseKey(): String {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(KEY_SUPABASE_KEY, "") ?: ""
    }

    private fun getUserId(): String {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(KEY_USER_ID, "") ?: ""
    }

    suspend fun uploadEncryptedHealthData(encryptedData: EncryptedHealthData): UploadResult {
        return withContext(Dispatchers.IO) {
            try {
                if (!isConfigured()) {
                    Log.e(TAG, "Upload manager not configured")
                    return@withContext UploadResult.Error("Supabase configuration missing")
                }

                val supabaseUrl = getSupabaseUrl()
                val supabaseKey = getSupabaseKey()
                val userId = getUserId()

                val payload = UploadPayload(
                    user_id = userId,
                    encrypted_data = encryptedData.encryptedData,
                    iv = encryptedData.iv,
                    data_point_count = encryptedData.dataPointCount,
                    extraction_timestamp = encryptedData.extractionTimestamp
                )

                val jsonPayload = json.encodeToString(payload)
                Log.d(TAG, "Uploading ${payload.data_point_count} data points")

                val requestBody = jsonPayload.toRequestBody(MEDIA_TYPE_JSON.toMediaType())

                val request = Request.Builder()
                    .url("$supabaseUrl/rest/v1/health_data_upload")
                    .addHeader("apikey", supabaseKey)
                    .addHeader("Authorization", "Bearer $supabaseKey")
                    .addHeader("Content-Type", "application/json")
                    .addHeader("Prefer", "return=minimal")
                    .post(requestBody)
                    .build()

                val response = httpClient.newCall(request).execute()

                return@withContext if (response.isSuccessful) {
                    Log.i(TAG, "Upload successful: ${payload.data_point_count} data points")
                    UploadResult.Success(payload.data_point_count)
                } else {
                    val errorBody = response.body?.string() ?: "Unknown error"
                    Log.e(TAG, "Upload failed: ${response.code} - $errorBody")
                    UploadResult.Error("Upload failed: ${response.code} - $errorBody")
                }
            } catch (e: IOException) {
                Log.e(TAG, "Network error during upload", e)
                UploadResult.Error("Network error: ${e.message}")
            } catch (e: Exception) {
                Log.e(TAG, "Unexpected error during upload", e)
                UploadResult.Error("Unexpected error: ${e.message}")
            }
        }
    }

    suspend fun uploadHealthDataBundle(bundle: HealthDataBundle, encryptionManager: EncryptionManager): UploadResult {
        return try {
            val jsonData = json.encodeToString(bundle)
            val encrypted = encryptionManager.encryptHealthData(jsonData)

            val encryptedWithMetadata = EncryptedHealthData(
                encryptedData = encrypted.encryptedData,
                iv = encrypted.iv,
                dataPointCount = bundle.dataPointCount,
                extractionTimestamp = bundle.extractionTimestamp
            )

            uploadEncryptedHealthData(encryptedWithMetadata)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to encrypt and upload health data", e)
            UploadResult.Error("Encryption failed: ${e.message}")
        }
    }

    sealed class UploadResult {
        data class Success(val dataPointsUploaded: Int) : UploadResult()
        data class Error(val message: String) : UploadResult()
    }
}
