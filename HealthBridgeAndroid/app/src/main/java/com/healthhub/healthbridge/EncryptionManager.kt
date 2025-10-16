package com.healthhub.healthbridge

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Log
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class EncryptionManager {
    private val keyStore: KeyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply {
        load(null)
    }

    companion object {
        private const val TAG = "EncryptionManager"
        private const val ANDROID_KEYSTORE = "AndroidKeyStore"
        private const val KEY_ALIAS = "HealthBridgeEncryptionKey"
        private const val TRANSFORMATION = "AES/GCM/NoPadding"
        private const val GCM_TAG_LENGTH = 128
    }

    init {
        if (!keyStore.containsAlias(KEY_ALIAS)) {
            generateKey()
        }
    }

    private fun generateKey() {
        try {
            val keyGenerator = KeyGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_AES,
                ANDROID_KEYSTORE
            )

            val keyGenParameterSpec = KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .setUserAuthenticationRequired(false)
                .build()

            keyGenerator.init(keyGenParameterSpec)
            keyGenerator.generateKey()

            Log.i(TAG, "Encryption key generated successfully")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to generate encryption key", e)
            throw EncryptionException("Failed to generate encryption key", e)
        }
    }

    private fun getSecretKey(): SecretKey {
        return try {
            keyStore.getKey(KEY_ALIAS, null) as? SecretKey
                ?: throw EncryptionException("Encryption key not found in keystore")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to retrieve encryption key", e)
            throw EncryptionException("Failed to retrieve encryption key", e)
        }
    }

    fun encryptHealthData(jsonData: String): EncryptedHealthData {
        return try {
            val cipher = Cipher.getInstance(TRANSFORMATION)
            val secretKey = getSecretKey()

            cipher.init(Cipher.ENCRYPT_MODE, secretKey)

            val plaintext = jsonData.toByteArray(Charsets.UTF_8)
            val encryptedBytes = cipher.doFinal(plaintext)
            val iv = cipher.iv

            Log.i(TAG, "Encrypted ${plaintext.size} bytes of health data")

            EncryptedHealthData(
                encryptedData = encryptedBytes.map { it.toInt() },
                iv = iv.map { it.toInt() },
                dataPointCount = 0,
                extractionTimestamp = ""
            )
        } catch (e: Exception) {
            Log.e(TAG, "Failed to encrypt health data", e)
            throw EncryptionException("Failed to encrypt health data", e)
        }
    }

    fun decryptHealthData(encryptedData: EncryptedHealthData): String {
        return try {
            val cipher = Cipher.getInstance(TRANSFORMATION)
            val secretKey = getSecretKey()

            val encryptedBytes = encryptedData.encryptedData.map { it.toByte() }.toByteArray()
            val ivBytes = encryptedData.iv.map { it.toByte() }.toByteArray()

            val gcmParameterSpec = GCMParameterSpec(GCM_TAG_LENGTH, ivBytes)
            cipher.init(Cipher.DECRYPT_MODE, secretKey, gcmParameterSpec)

            val decryptedBytes = cipher.doFinal(encryptedBytes)

            Log.i(TAG, "Decrypted ${decryptedBytes.size} bytes of health data")

            String(decryptedBytes, Charsets.UTF_8)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to decrypt health data", e)
            throw EncryptionException("Failed to decrypt health data", e)
        }
    }

    fun deleteKey() {
        try {
            if (keyStore.containsAlias(KEY_ALIAS)) {
                keyStore.deleteEntry(KEY_ALIAS)
                Log.i(TAG, "Encryption key deleted successfully")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to delete encryption key", e)
            throw EncryptionException("Failed to delete encryption key", e)
        }
    }

    class EncryptionException(message: String, cause: Throwable? = null) : Exception(message, cause)
}
