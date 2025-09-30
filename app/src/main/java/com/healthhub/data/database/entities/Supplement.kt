package com.healthhub.data.database.entities

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.Index
import java.time.Instant

/**
 * Supplement/compound definition with pathway and interaction information.
 */
@Entity(
    tableName = "supplements",
    indices = [
        Index(value = ["name"], unique = true),
        Index(value = ["category"])
    ]
)
data class Supplement(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,

    /** Supplement name (e.g., "Vitamin D3", "Magnesium Glycinate") */
    val name: String,

    /** Common/brand names as JSON array */
    val aliases: String? = null,

    /** Category (vitamin, mineral, amino acid, herb, etc.) */
    val category: SupplementCategory,

    /** Active compounds as JSON array (e.g., ["cholecalciferol"] for Vitamin D3) */
    val compounds: String? = null,

    /** Biochemical pathways as JSON array (e.g., KEGG pathway IDs) */
    val pathways: String? = null,

    /** Known interactions as JSON array of interaction objects */
    val interactions: String? = null,

    /** Standard dosage amount */
    val standardDosage: Double,

    /** Dosage unit (mg, mcg, IU, etc.) */
    val dosageUnit: String,

    /** Recommended timing (with_food, empty_stomach, morning, evening, etc.) */
    val timing: SupplementTiming,

    /** Notes about the supplement (benefits, warnings, etc.) */
    val notes: String? = null,

    /** DNA markers this supplement addresses as JSON array */
    val dnaMarkers: String? = null,

    /** Conditions this supplement targets as JSON array */
    val conditions: String? = null,

    /** Is this supplement currently being taken */
    val isActive: Boolean = true,

    /** Created timestamp */
    val createdAt: Instant = Instant.now(),

    /** Last updated timestamp */
    val updatedAt: Instant = Instant.now()
)

enum class SupplementCategory {
    VITAMIN,
    MINERAL,
    AMINO_ACID,
    HERB,
    FATTY_ACID,
    PROBIOTIC,
    ENZYME,
    ANTIOXIDANT,
    NOOTROPIC,
    ADAPTOGEN,
    OTHER
}

enum class SupplementTiming {
    WITH_FOOD,
    EMPTY_STOMACH,
    MORNING,
    EVENING,
    BEFORE_BED,
    BEFORE_WORKOUT,
    AFTER_WORKOUT,
    ANYTIME
}