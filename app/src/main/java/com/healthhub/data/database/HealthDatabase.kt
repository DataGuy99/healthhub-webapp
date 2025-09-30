package com.healthhub.data.database

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import com.healthhub.data.database.converters.Converters
import com.healthhub.data.database.dao.*
import com.healthhub.data.database.entities.*
import net.sqlcipher.database.SQLiteDatabase
import net.sqlcipher.database.SupportFactory

/**
 * Main Room database for HealthHub.
 * Encrypted with SQLCipher for privacy.
 */
@Database(
    entities = [
        HealthMetric::class,
        Supplement::class,
        SupplementLog::class,
        Correlation::class
    ],
    version = 1,
    exportSchema = true
)
@TypeConverters(Converters::class)
abstract class HealthDatabase : RoomDatabase() {

    abstract fun healthMetricDao(): HealthMetricDao
    abstract fun supplementDao(): SupplementDao
    abstract fun supplementLogDao(): SupplementLogDao
    abstract fun correlationDao(): CorrelationDao

    companion object {
        @Volatile
        private var INSTANCE: HealthDatabase? = null

        private const val DATABASE_NAME = "healthhub.db"

        fun getInstance(context: Context, passphrase: CharArray): HealthDatabase {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: buildDatabase(context, passphrase).also { INSTANCE = it }
            }
        }

        private fun buildDatabase(context: Context, passphrase: CharArray): HealthDatabase {
            // Initialize SQLCipher
            System.loadLibrary("sqlcipher")

            // Create encrypted database factory
            val factory = SupportFactory(SQLiteDatabase.getBytes(passphrase))

            return Room.databaseBuilder(
                context.applicationContext,
                HealthDatabase::class.java,
                DATABASE_NAME
            )
                .openHelperFactory(factory)
                .fallbackToDestructiveMigration() // Remove in production after stable schema
                .build()
        }

        /**
         * Close and clear the database instance.
         * Useful for testing or when user logs out.
         */
        fun closeDatabase() {
            INSTANCE?.close()
            INSTANCE = null
        }
    }
}