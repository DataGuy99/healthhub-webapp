package com.healthhub.data.database.converters

import androidx.room.TypeConverter
import java.time.Instant

/**
 * Type converters for Room database.
 * Required for converting Instant to/from Long for SQLite storage.
 */
class Converters {

    @TypeConverter
    fun fromTimestamp(value: Long?): Instant? {
        return value?.let { Instant.ofEpochMilli(it) }
    }

    @TypeConverter
    fun toTimestamp(instant: Instant?): Long? {
        return instant?.toEpochMilli()
    }
}