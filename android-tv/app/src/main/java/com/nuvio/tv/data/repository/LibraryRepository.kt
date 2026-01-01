package com.nuvio.tv.data.repository

import android.util.Log
import com.nuvio.tv.domain.model.StreamingContent
import com.tencent.mmkv.MMKV
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository for managing user library (favorites, watchlist).
 * Stores library items in MMKV (shared with mobile app).
 */
@Singleton
class LibraryRepository @Inject constructor() {

    companion object {
        private const val TAG = "LibraryRepository"
        private const val MMKV_ID = "nuvio_library"
        private const val KEY_FAVORITES = "favorites"
        private const val KEY_WATCHLIST = "watchlist"
    }

    private val mmkv: MMKV by lazy {
        MMKV.mmkvWithID(MMKV_ID, MMKV.MULTI_PROCESS_MODE)
    }

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    private val _favoritesFlow = MutableStateFlow<List<LibraryItem>>(emptyList())
    val favoritesFlow: Flow<List<LibraryItem>> = _favoritesFlow.asStateFlow()

    private val _watchlistFlow = MutableStateFlow<List<LibraryItem>>(emptyList())
    val watchlistFlow: Flow<List<LibraryItem>> = _watchlistFlow.asStateFlow()

    /**
     * Initialize and load library data.
     */
    suspend fun initialize() {
        withContext(Dispatchers.IO) {
            loadFavorites()
            loadWatchlist()
        }
    }

    // ==================== FAVORITES ====================

    /**
     * Add content to favorites.
     */
    suspend fun addToFavorites(content: StreamingContent) {
        withContext(Dispatchers.IO) {
            try {
                val item = LibraryItem(
                    id = content.id,
                    type = content.type,
                    name = content.name,
                    poster = content.poster,
                    year = content.year,
                    imdbRating = content.imdbRating?.toFloatOrNull(),
                    addedAt = System.currentTimeMillis()
                )

                val favorites = getFavoritesList().toMutableList()
                if (favorites.none { it.id == content.id }) {
                    favorites.add(0, item) // Add to beginning
                    saveFavoritesList(favorites)
                    loadFavorites()
                    Log.d(TAG, "Added ${content.name} to favorites")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error adding to favorites", e)
            }
        }
    }

    /**
     * Remove content from favorites.
     */
    suspend fun removeFromFavorites(contentId: String) {
        withContext(Dispatchers.IO) {
            try {
                val favorites = getFavoritesList().toMutableList()
                favorites.removeAll { it.id == contentId }
                saveFavoritesList(favorites)
                loadFavorites()
                Log.d(TAG, "Removed $contentId from favorites")
            } catch (e: Exception) {
                Log.e(TAG, "Error removing from favorites", e)
            }
        }
    }

    /**
     * Check if content is in favorites.
     */
    suspend fun isInFavorites(contentId: String): Boolean {
        return withContext(Dispatchers.IO) {
            getFavoritesList().any { it.id == contentId }
        }
    }

    /**
     * Get all favorites.
     */
    suspend fun getFavorites(): List<LibraryItem> {
        return withContext(Dispatchers.IO) {
            getFavoritesList()
        }
    }

    /**
     * Get favorites filtered by type.
     */
    suspend fun getFavoritesByType(type: String): List<LibraryItem> {
        return withContext(Dispatchers.IO) {
            getFavoritesList().filter { it.type == type }
        }
    }

    // ==================== WATCHLIST ====================

    /**
     * Add content to watchlist.
     */
    suspend fun addToWatchlist(content: StreamingContent) {
        withContext(Dispatchers.IO) {
            try {
                val item = LibraryItem(
                    id = content.id,
                    type = content.type,
                    name = content.name,
                    poster = content.poster,
                    year = content.year,
                    imdbRating = content.imdbRating?.toFloatOrNull(),
                    addedAt = System.currentTimeMillis()
                )

                val watchlist = getWatchlistList().toMutableList()
                if (watchlist.none { it.id == content.id }) {
                    watchlist.add(0, item) // Add to beginning
                    saveWatchlistList(watchlist)
                    loadWatchlist()
                    Log.d(TAG, "Added ${content.name} to watchlist")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error adding to watchlist", e)
            }
        }
    }

    /**
     * Remove content from watchlist.
     */
    suspend fun removeFromWatchlist(contentId: String) {
        withContext(Dispatchers.IO) {
            try {
                val watchlist = getWatchlistList().toMutableList()
                watchlist.removeAll { it.id == contentId }
                saveWatchlistList(watchlist)
                loadWatchlist()
                Log.d(TAG, "Removed $contentId from watchlist")
            } catch (e: Exception) {
                Log.e(TAG, "Error removing from watchlist", e)
            }
        }
    }

    /**
     * Check if content is in watchlist.
     */
    suspend fun isInWatchlist(contentId: String): Boolean {
        return withContext(Dispatchers.IO) {
            getWatchlistList().any { it.id == contentId }
        }
    }

    /**
     * Get all watchlist items.
     */
    suspend fun getWatchlist(): List<LibraryItem> {
        return withContext(Dispatchers.IO) {
            getWatchlistList()
        }
    }

    /**
     * Get watchlist filtered by type.
     */
    suspend fun getWatchlistByType(type: String): List<LibraryItem> {
        return withContext(Dispatchers.IO) {
            getWatchlistList().filter { it.type == type }
        }
    }

    // ==================== TOGGLE OPERATIONS ====================

    /**
     * Toggle favorite status.
     */
    suspend fun toggleFavorite(content: StreamingContent): Boolean {
        return withContext(Dispatchers.IO) {
            val isCurrentlyFavorite = isInFavorites(content.id)
            if (isCurrentlyFavorite) {
                removeFromFavorites(content.id)
            } else {
                addToFavorites(content)
            }
            !isCurrentlyFavorite
        }
    }

    /**
     * Toggle watchlist status.
     */
    suspend fun toggleWatchlist(content: StreamingContent): Boolean {
        return withContext(Dispatchers.IO) {
            val isCurrentlyInWatchlist = isInWatchlist(content.id)
            if (isCurrentlyInWatchlist) {
                removeFromWatchlist(content.id)
            } else {
                addToWatchlist(content)
            }
            !isCurrentlyInWatchlist
        }
    }

    // ==================== CLEAR OPERATIONS ====================

    /**
     * Clear all favorites.
     */
    suspend fun clearFavorites() {
        withContext(Dispatchers.IO) {
            saveFavoritesList(emptyList())
            loadFavorites()
            Log.d(TAG, "Cleared all favorites")
        }
    }

    /**
     * Clear all watchlist items.
     */
    suspend fun clearWatchlist() {
        withContext(Dispatchers.IO) {
            saveWatchlistList(emptyList())
            loadWatchlist()
            Log.d(TAG, "Cleared all watchlist items")
        }
    }

    /**
     * Clear entire library.
     */
    suspend fun clearAll() {
        clearFavorites()
        clearWatchlist()
    }

    // ==================== INTERNAL HELPERS ====================

    private fun loadFavorites() {
        _favoritesFlow.value = getFavoritesList()
    }

    private fun loadWatchlist() {
        _watchlistFlow.value = getWatchlistList()
    }

    private fun getFavoritesList(): List<LibraryItem> {
        val data = mmkv.decodeString(KEY_FAVORITES) ?: return emptyList()
        return try {
            json.decodeFromString<List<LibraryItem>>(data)
        } catch (e: Exception) {
            Log.e(TAG, "Error parsing favorites", e)
            emptyList()
        }
    }

    private fun saveFavoritesList(favorites: List<LibraryItem>) {
        mmkv.encode(KEY_FAVORITES, json.encodeToString(favorites))
    }

    private fun getWatchlistList(): List<LibraryItem> {
        val data = mmkv.decodeString(KEY_WATCHLIST) ?: return emptyList()
        return try {
            json.decodeFromString<List<LibraryItem>>(data)
        } catch (e: Exception) {
            Log.e(TAG, "Error parsing watchlist", e)
            emptyList()
        }
    }

    private fun saveWatchlistList(watchlist: List<LibraryItem>) {
        mmkv.encode(KEY_WATCHLIST, json.encodeToString(watchlist))
    }
}

/**
 * Represents an item in the user's library.
 */
@Serializable
data class LibraryItem(
    val id: String,
    val type: String,
    val name: String,
    val poster: String? = null,
    val year: Int? = null,
    val imdbRating: Float? = null,
    val addedAt: Long = System.currentTimeMillis()
)
