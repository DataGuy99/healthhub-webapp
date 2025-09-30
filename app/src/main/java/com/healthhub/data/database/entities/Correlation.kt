package com.healthhub.data.database.entities

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.Index
import java.time.Instant

/**
 * Calculated correlation between two metrics or supplement/metric pairs.
 */
@Entity(
    tableName = "correlations",
    indices = [
        Index(value = ["metricA", "metricB"], unique = true),
        Index(value = ["calculatedAt"]),
        Index(value = ["coefficient"])
    ]
)
data class Correlation(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,

    /** First metric/variable identifier (e.g., "SUPPLEMENT:Vitamin_D" or "METRIC:HRV") */
    val metricA: String,

    /** Second metric identifier */
    val metricB: String,

    /** Pearson or Spearman correlation coefficient (-1.0 to 1.0) */
    val coefficient: Double,

    /** P-value for statistical significance */
    val pValue: Double,

    /** Sample size used for calculation */
    val sampleSize: Int,

    /** Type of correlation (PEARSON, SPEARMAN) */
    val correlationType: CorrelationType,

    /** Lag in hours (0 = no lag, 24 = 1 day lag, etc.) */
    val lagHours: Int = 0,

    /** Date range used for calculation (start) */
    val periodStart: Instant,

    /** Date range used for calculation (end) */
    val periodEnd: Instant,

    /** When this correlation was calculated */
    val calculatedAt: Instant = Instant.now()
)

enum class CorrelationType {
    PEARSON,    // For continuous variables
    SPEARMAN    // For ranked/ordinal variables
}

/**
 * Helper data class for correlation analysis results.
 */
data class CorrelationResult(
    val metricA: String,
    val metricB: String,
    val coefficient: Double,
    val pValue: Double,
    val isSignificant: Boolean,
    val strength: CorrelationStrength
)

enum class CorrelationStrength {
    VERY_STRONG,  // |r| >= 0.8
    STRONG,       // |r| >= 0.6
    MODERATE,     // |r| >= 0.4
    WEAK,         // |r| >= 0.2
    VERY_WEAK     // |r| < 0.2
}