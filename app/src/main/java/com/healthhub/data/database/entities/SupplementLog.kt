package com.healthhub.data.database.entities

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.ForeignKey
import androidx.room.Index
import java.time.Instant

/**
 * Log entry for when a supplement was taken.
 */
@Entity(
    tableName = "supplement_logs",
    foreignKeys = [
        ForeignKey(
            entity = Supplement::class,
            parentColumns = ["id"],
            childColumns = ["supplementId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [
        Index(value = ["supplementId"]),
        Index(value = ["timestamp"]),
        Index(value = ["supplementId", "timestamp"])
    ]
)
data class SupplementLog(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,

    /** Reference to the supplement */
    val supplementId: Long,

    /** When the supplement was taken */
    val timestamp: Instant,

    /** Amount taken (may differ from standard dosage) */
    val dosage: Double,

    /** Unit of dosage */
    val dosageUnit: String,

    /** Timing context */
    val timing: SupplementTiming,

    /** Optional notes for this specific log */
    val notes: String? = null,

    /** When this log was created */
    val createdAt: Instant = Instant.now()
)