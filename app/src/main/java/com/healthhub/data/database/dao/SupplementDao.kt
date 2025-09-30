package com.healthhub.data.database.dao

import androidx.room.*
import com.healthhub.data.database.entities.Supplement
import com.healthhub.data.database.entities.SupplementCategory
import kotlinx.coroutines.flow.Flow

@Dao
interface SupplementDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(supplement: Supplement): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(supplements: List<Supplement>)

    @Update
    suspend fun update(supplement: Supplement)

    @Delete
    suspend fun delete(supplement: Supplement)

    @Query("SELECT * FROM supplements WHERE id = :id")
    suspend fun getById(id: Long): Supplement?

    @Query("SELECT * FROM supplements WHERE id = :id")
    fun getByIdFlow(id: Long): Flow<Supplement?>

    @Query("SELECT * FROM supplements WHERE name = :name")
    suspend fun getByName(name: String): Supplement?

    @Query("SELECT * FROM supplements WHERE isActive = 1 ORDER BY name ASC")
    suspend fun getActive(): List<Supplement>

    @Query("SELECT * FROM supplements WHERE isActive = 1 ORDER BY name ASC")
    fun getActiveFlow(): Flow<List<Supplement>>

    @Query("SELECT * FROM supplements ORDER BY name ASC")
    suspend fun getAll(): List<Supplement>

    @Query("SELECT * FROM supplements ORDER BY name ASC")
    fun getAllFlow(): Flow<List<Supplement>>

    @Query("SELECT * FROM supplements WHERE category = :category ORDER BY name ASC")
    suspend fun getByCategory(category: SupplementCategory): List<Supplement>

    @Query("UPDATE supplements SET isActive = :isActive WHERE id = :id")
    suspend fun setActive(id: Long, isActive: Boolean)

    @Query("SELECT COUNT(*) FROM supplements WHERE isActive = 1")
    suspend fun getActiveCount(): Int
}