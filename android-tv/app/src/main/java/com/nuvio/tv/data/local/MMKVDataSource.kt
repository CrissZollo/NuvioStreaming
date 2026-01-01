package com.nuvio.tv.data.local

import com.tencent.mmkv.MMKV
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.MapSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Data source for reading/writing shared configuration with the mobile app via MMKV.
 * This allows the TV app to share addon configuration with the mobile NuvioStreaming app.
 */
@Singleton
class MMKVDataSource @Inject constructor() {

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    // Serializers
    private val stringListSerializer = ListSerializer(String.serializer())
    private val stringFloatMapSerializer = MapSerializer(String.serializer(), Float.serializer())

    // Main MMKV instance for app settings
    private val mmkv: MMKV by lazy {
        MMKV.defaultMMKV()
    }

    // Shared MMKV instance that can be accessed by both apps
    private val sharedMmkv: MMKV by lazy {
        MMKV.mmkvWithID("nuvio_shared", MMKV.MULTI_PROCESS_MODE)
    }

    // Keys matching the mobile app's storage keys
    companion object {
        // Addon keys
        const val KEY_INSTALLED_ADDONS = "installed_addons"
        const val KEY_ADDON_CONFIGS = "addon_configs"

        // User preferences
        const val KEY_SELECTED_THEME = "selected_theme"
        const val KEY_PLAYER_SETTINGS = "player_settings"
        const val KEY_SUBTITLE_SETTINGS = "subtitle_settings"

        // Authentication
        const val KEY_TRAKT_AUTH = "trakt_auth"
        const val KEY_REAL_DEBRID_AUTH = "real_debrid_auth"
        const val KEY_PREMIUMIZE_AUTH = "premiumize_auth"
        const val KEY_ALL_DEBRID_AUTH = "all_debrid_auth"

        // Watch progress
        const val KEY_WATCH_PROGRESS = "watch_progress"
        const val KEY_CONTINUE_WATCHING = "continue_watching"

        // Library
        const val KEY_FAVORITES = "favorites"
        const val KEY_WATCHLIST = "watchlist"
    }

    // ==================== Generic Operations ====================

    fun getString(key: String, default: String = ""): String {
        return mmkv.decodeString(key, default) ?: default
    }

    fun putString(key: String, value: String) {
        mmkv.encode(key, value)
    }

    fun getInt(key: String, default: Int = 0): Int {
        return mmkv.decodeInt(key, default)
    }

    fun putInt(key: String, value: Int) {
        mmkv.encode(key, value)
    }

    fun getBoolean(key: String, default: Boolean = false): Boolean {
        return mmkv.decodeBool(key, default)
    }

    fun putBoolean(key: String, value: Boolean) {
        mmkv.encode(key, value)
    }

    fun getLong(key: String, default: Long = 0L): Long {
        return mmkv.decodeLong(key, default)
    }

    fun putLong(key: String, value: Long) {
        mmkv.encode(key, value)
    }

    fun remove(key: String) {
        mmkv.removeValueForKey(key)
    }

    fun contains(key: String): Boolean {
        return mmkv.containsKey(key)
    }

    // ==================== Shared Storage Operations ====================

    fun getSharedString(key: String, default: String = ""): String {
        return sharedMmkv.decodeString(key, default) ?: default
    }

    fun putSharedString(key: String, value: String) {
        sharedMmkv.encode(key, value)
    }

    // ==================== Addon Operations ====================

    /**
     * Get the list of installed addon manifest URLs.
     */
    fun getInstalledAddons(): List<String> {
        val addonsJson = getSharedString(KEY_INSTALLED_ADDONS, "[]")
        return try {
            json.decodeFromString(stringListSerializer, addonsJson)
        } catch (e: Exception) {
            emptyList()
        }
    }

    /**
     * Save the list of installed addon manifest URLs.
     */
    fun saveInstalledAddons(addons: List<String>) {
        val addonsJson = json.encodeToString(stringListSerializer, addons)
        putSharedString(KEY_INSTALLED_ADDONS, addonsJson)
    }

    // ==================== Theme Operations ====================

    /**
     * Get the currently selected theme ID.
     */
    fun getSelectedThemeId(): String {
        return getString(KEY_SELECTED_THEME, "default")
    }

    /**
     * Save the selected theme ID.
     */
    fun saveSelectedThemeId(themeId: String) {
        putString(KEY_SELECTED_THEME, themeId)
    }

    // ==================== Authentication Operations ====================

    /**
     * Get Trakt authentication token.
     */
    fun getTraktAuth(): String? {
        val auth = getSharedString(KEY_TRAKT_AUTH)
        return auth.ifEmpty { null }
    }

    /**
     * Save Trakt authentication token.
     */
    fun saveTraktAuth(token: String) {
        putSharedString(KEY_TRAKT_AUTH, token)
    }

    /**
     * Get Real-Debrid authentication token.
     */
    fun getRealDebridAuth(): String? {
        val auth = getSharedString(KEY_REAL_DEBRID_AUTH)
        return auth.ifEmpty { null }
    }

    /**
     * Save Real-Debrid authentication token.
     */
    fun saveRealDebridAuth(token: String) {
        putSharedString(KEY_REAL_DEBRID_AUTH, token)
    }

    /**
     * Get Premiumize authentication token.
     */
    fun getPremiumizeAuth(): String? {
        val auth = getSharedString(KEY_PREMIUMIZE_AUTH)
        return auth.ifEmpty { null }
    }

    /**
     * Save Premiumize authentication token.
     */
    fun savePremiumizeAuth(token: String) {
        putSharedString(KEY_PREMIUMIZE_AUTH, token)
    }

    /**
     * Get AllDebrid authentication token.
     */
    fun getAllDebridAuth(): String? {
        val auth = getSharedString(KEY_ALL_DEBRID_AUTH)
        return auth.ifEmpty { null }
    }

    /**
     * Save AllDebrid authentication token.
     */
    fun saveAllDebridAuth(token: String) {
        putSharedString(KEY_ALL_DEBRID_AUTH, token)
    }

    // ==================== Watch Progress Operations ====================

    /**
     * Get watch progress for a specific content item.
     * Returns progress as a percentage (0-100).
     */
    fun getWatchProgress(contentId: String): Float {
        val progressJson = getString(KEY_WATCH_PROGRESS, "{}")
        return try {
            val progressMap = json.decodeFromString(stringFloatMapSerializer, progressJson)
            progressMap[contentId] ?: 0f
        } catch (e: Exception) {
            0f
        }
    }

    /**
     * Save watch progress for a specific content item.
     */
    fun saveWatchProgress(contentId: String, progress: Float) {
        val progressJson = getString(KEY_WATCH_PROGRESS, "{}")
        try {
            val progressMap = json.decodeFromString(stringFloatMapSerializer, progressJson).toMutableMap()
            progressMap[contentId] = progress
            val updatedJson = json.encodeToString(stringFloatMapSerializer, progressMap)
            putString(KEY_WATCH_PROGRESS, updatedJson)
        } catch (e: Exception) {
            // If parsing fails, create new map
            val newMap = mapOf(contentId to progress)
            val newJson = json.encodeToString(stringFloatMapSerializer, newMap)
            putString(KEY_WATCH_PROGRESS, newJson)
        }
    }

    // ==================== Favorites & Watchlist Operations ====================

    /**
     * Get the list of favorite content IDs.
     */
    fun getFavorites(): Set<String> {
        val favoritesJson = getString(KEY_FAVORITES, "[]")
        return try {
            json.decodeFromString(stringListSerializer, favoritesJson).toSet()
        } catch (e: Exception) {
            emptySet()
        }
    }

    /**
     * Add a content item to favorites.
     */
    fun addToFavorites(contentId: String) {
        val favorites = getFavorites().toMutableSet()
        favorites.add(contentId)
        val favoritesJson = json.encodeToString(stringListSerializer, favorites.toList())
        putString(KEY_FAVORITES, favoritesJson)
    }

    /**
     * Remove a content item from favorites.
     */
    fun removeFromFavorites(contentId: String) {
        val favorites = getFavorites().toMutableSet()
        favorites.remove(contentId)
        val favoritesJson = json.encodeToString(stringListSerializer, favorites.toList())
        putString(KEY_FAVORITES, favoritesJson)
    }

    /**
     * Check if a content item is in favorites.
     */
    fun isFavorite(contentId: String): Boolean {
        return getFavorites().contains(contentId)
    }

    /**
     * Get the watchlist content IDs.
     */
    fun getWatchlist(): Set<String> {
        val watchlistJson = getString(KEY_WATCHLIST, "[]")
        return try {
            json.decodeFromString(stringListSerializer, watchlistJson).toSet()
        } catch (e: Exception) {
            emptySet()
        }
    }

    /**
     * Add a content item to the watchlist.
     */
    fun addToWatchlist(contentId: String) {
        val watchlist = getWatchlist().toMutableSet()
        watchlist.add(contentId)
        val watchlistJson = json.encodeToString(stringListSerializer, watchlist.toList())
        putString(KEY_WATCHLIST, watchlistJson)
    }

    /**
     * Remove a content item from the watchlist.
     */
    fun removeFromWatchlist(contentId: String) {
        val watchlist = getWatchlist().toMutableSet()
        watchlist.remove(contentId)
        val watchlistJson = json.encodeToString(stringListSerializer, watchlist.toList())
        putString(KEY_WATCHLIST, watchlistJson)
    }

    /**
     * Check if a content item is in the watchlist.
     */
    fun isInWatchlist(contentId: String): Boolean {
        return getWatchlist().contains(contentId)
    }
}
