package com.nuvio.tv.data.repository

import android.util.Log
import com.nuvio.tv.domain.model.WatchProgress
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
 * Repository for managing watch progress.
 * Stores progress in MMKV (shared with mobile app).
 */
@Singleton
class WatchProgressRepository @Inject constructor() {

    companion object {
        private const val TAG = "WatchProgressRepository"
        private const val MMKV_ID = "nuvio_watch_progress"
        private const val KEY_PROGRESS_PREFIX = "progress_"
        private const val KEY_ALL_PROGRESS = "all_progress_ids"
    }

    private val mmkv: MMKV by lazy {
        MMKV.mmkvWithID(MMKV_ID, MMKV.MULTI_PROCESS_MODE)
    }

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    private val _continueWatchingFlow = MutableStateFlow<List<WatchProgress>>(emptyList())
    val continueWatchingFlow: Flow<List<WatchProgress>> = _continueWatchingFlow.asStateFlow()

    /**
     * Initialize and load existing progress.
     */
    suspend fun initialize() {
        withContext(Dispatchers.IO) {
            loadContinueWatching()
        }
    }

    /**
     * Save watch progress for content.
     */
    suspend fun saveProgress(progress: WatchProgress) {
        withContext(Dispatchers.IO) {
            try {
                val key = getProgressKey(progress.contentId, progress.episodeId)
                val progressData = ProgressData(
                    contentId = progress.contentId,
                    type = progress.type,
                    episodeId = progress.episodeId,
                    position = progress.position,
                    duration = progress.duration,
                    updatedAt = System.currentTimeMillis(),
                    title = progress.title,
                    poster = progress.poster
                )

                mmkv.encode(key, json.encodeToString(progressData))

                // Update the list of all progress IDs
                addToProgressList(key)

                // Refresh continue watching
                loadContinueWatching()

                Log.d(TAG, "Saved progress for $key: ${progress.progressPercent}%")
            } catch (e: Exception) {
                Log.e(TAG, "Error saving progress", e)
            }
        }
    }

    /**
     * Get watch progress for specific content.
     */
    suspend fun getProgress(contentId: String, episodeId: String? = null): WatchProgress? {
        return withContext(Dispatchers.IO) {
            try {
                val key = getProgressKey(contentId, episodeId)
                val data = mmkv.decodeString(key) ?: return@withContext null
                val progressData = json.decodeFromString<ProgressData>(data)

                WatchProgress(
                    contentId = progressData.contentId,
                    type = progressData.type,
                    episodeId = progressData.episodeId,
                    position = progressData.position,
                    duration = progressData.duration,
                    updatedAt = progressData.updatedAt,
                    title = progressData.title,
                    poster = progressData.poster
                )
            } catch (e: Exception) {
                Log.e(TAG, "Error getting progress for $contentId", e)
                null
            }
        }
    }

    /**
     * Get all in-progress content for continue watching.
     */
    suspend fun getContinueWatching(): List<WatchProgress> {
        return withContext(Dispatchers.IO) {
            try {
                val progressIds = getProgressList()
                val progressList = mutableListOf<WatchProgress>()

                for (key in progressIds) {
                    try {
                        val data = mmkv.decodeString(key) ?: continue
                        val progressData = json.decodeFromString<ProgressData>(data)

                        val progress = WatchProgress(
                            contentId = progressData.contentId,
                            type = progressData.type,
                            episodeId = progressData.episodeId,
                            position = progressData.position,
                            duration = progressData.duration,
                            updatedAt = progressData.updatedAt,
                            title = progressData.title,
                            poster = progressData.poster
                        )

                        // Only include in-progress items (5-89%)
                        if (progress.isInProgress) {
                            progressList.add(progress)
                        }
                    } catch (e: Exception) {
                        Log.w(TAG, "Error parsing progress for $key", e)
                    }
                }

                // Sort by last updated, most recent first
                progressList.sortedByDescending { it.updatedAt }
            } catch (e: Exception) {
                Log.e(TAG, "Error getting continue watching", e)
                emptyList()
            }
        }
    }

    /**
     * Get watch history (all watched content).
     */
    suspend fun getWatchHistory(limit: Int = 50): List<WatchProgress> {
        return withContext(Dispatchers.IO) {
            try {
                val progressIds = getProgressList()
                val historyList = mutableListOf<WatchProgress>()

                for (key in progressIds) {
                    try {
                        val data = mmkv.decodeString(key) ?: continue
                        val progressData = json.decodeFromString<ProgressData>(data)

                        val progress = WatchProgress(
                            contentId = progressData.contentId,
                            type = progressData.type,
                            episodeId = progressData.episodeId,
                            position = progressData.position,
                            duration = progressData.duration,
                            updatedAt = progressData.updatedAt,
                            title = progressData.title,
                            poster = progressData.poster
                        )

                        historyList.add(progress)
                    } catch (e: Exception) {
                        Log.w(TAG, "Error parsing progress for $key", e)
                    }
                }

                // Sort by last updated, most recent first, limit results
                historyList.sortedByDescending { it.updatedAt }.take(limit)
            } catch (e: Exception) {
                Log.e(TAG, "Error getting watch history", e)
                emptyList()
            }
        }
    }

    /**
     * Remove progress for specific content.
     */
    suspend fun removeProgress(contentId: String, episodeId: String? = null) {
        withContext(Dispatchers.IO) {
            try {
                val key = getProgressKey(contentId, episodeId)
                mmkv.removeValueForKey(key)
                removeFromProgressList(key)
                loadContinueWatching()
                Log.d(TAG, "Removed progress for $key")
            } catch (e: Exception) {
                Log.e(TAG, "Error removing progress", e)
            }
        }
    }

    /**
     * Mark content as watched (progress >= 90%).
     */
    suspend fun markAsWatched(contentId: String, episodeId: String? = null, duration: Long) {
        val progress = WatchProgress(
            contentId = contentId,
            type = if (episodeId != null) "series" else "movie",
            episodeId = episodeId,
            position = (duration * 0.95).toLong(), // 95% watched
            duration = duration,
            updatedAt = System.currentTimeMillis()
        )
        saveProgress(progress)
    }

    /**
     * Clear all watch progress.
     */
    suspend fun clearAllProgress() {
        withContext(Dispatchers.IO) {
            try {
                val progressIds = getProgressList()
                for (key in progressIds) {
                    mmkv.removeValueForKey(key)
                }
                mmkv.removeValueForKey(KEY_ALL_PROGRESS)
                _continueWatchingFlow.value = emptyList()
                Log.d(TAG, "Cleared all watch progress")
            } catch (e: Exception) {
                Log.e(TAG, "Error clearing all progress", e)
            }
        }
    }

    /**
     * Check if content has been started.
     */
    suspend fun hasStarted(contentId: String, episodeId: String? = null): Boolean {
        val progress = getProgress(contentId, episodeId)
        return progress != null && progress.progressPercent > 0
    }

    /**
     * Check if content is completed.
     */
    suspend fun isCompleted(contentId: String, episodeId: String? = null): Boolean {
        val progress = getProgress(contentId, episodeId)
        return progress?.isWatched == true
    }

    /**
     * Get the next unwatched episode for a series.
     */
    suspend fun getNextEpisode(seriesId: String): String? {
        return withContext(Dispatchers.IO) {
            try {
                val progressIds = getProgressList()
                var latestEpisodeId: String? = null
                var latestTime = 0L

                for (key in progressIds) {
                    if (!key.contains(seriesId)) continue

                    try {
                        val data = mmkv.decodeString(key) ?: continue
                        val progressData = json.decodeFromString<ProgressData>(data)

                        if (progressData.contentId == seriesId &&
                            progressData.episodeId != null &&
                            progressData.updatedAt > latestTime) {
                            latestTime = progressData.updatedAt
                            latestEpisodeId = progressData.episodeId
                        }
                    } catch (e: Exception) {
                        // Skip invalid entries
                    }
                }

                latestEpisodeId
            } catch (e: Exception) {
                Log.e(TAG, "Error getting next episode", e)
                null
            }
        }
    }

    private fun loadContinueWatching() {
        try {
            val progressIds = getProgressList()
            val progressList = mutableListOf<WatchProgress>()

            for (key in progressIds) {
                try {
                    val data = mmkv.decodeString(key) ?: continue
                    val progressData = json.decodeFromString<ProgressData>(data)

                    val progress = WatchProgress(
                        contentId = progressData.contentId,
                        type = progressData.type,
                        episodeId = progressData.episodeId,
                        position = progressData.position,
                        duration = progressData.duration,
                        updatedAt = progressData.updatedAt,
                        title = progressData.title,
                        poster = progressData.poster
                    )

                    if (progress.isInProgress) {
                        progressList.add(progress)
                    }
                } catch (e: Exception) {
                    // Skip invalid entries
                }
            }

            _continueWatchingFlow.value = progressList.sortedByDescending { it.updatedAt }
        } catch (e: Exception) {
            Log.e(TAG, "Error loading continue watching", e)
        }
    }

    private fun getProgressKey(contentId: String, episodeId: String?): String {
        return if (episodeId != null) {
            "$KEY_PROGRESS_PREFIX${contentId}_$episodeId"
        } else {
            "$KEY_PROGRESS_PREFIX$contentId"
        }
    }

    private fun getProgressList(): Set<String> {
        val data = mmkv.decodeString(KEY_ALL_PROGRESS) ?: return emptySet()
        return try {
            json.decodeFromString<Set<String>>(data)
        } catch (e: Exception) {
            emptySet()
        }
    }

    private fun addToProgressList(key: String) {
        val current = getProgressList().toMutableSet()
        current.add(key)
        mmkv.encode(KEY_ALL_PROGRESS, json.encodeToString(current))
    }

    private fun removeFromProgressList(key: String) {
        val current = getProgressList().toMutableSet()
        current.remove(key)
        mmkv.encode(KEY_ALL_PROGRESS, json.encodeToString(current))
    }

    @Serializable
    private data class ProgressData(
        val contentId: String,
        val type: String,
        val episodeId: String? = null,
        val position: Long,
        val duration: Long,
        val updatedAt: Long,
        val title: String? = null,
        val poster: String? = null
    )
}
