package com.nuvio.tv.data.repository

import android.util.Log
import com.nuvio.tv.data.remote.api.TraktApi
import com.nuvio.tv.data.remote.dto.TraktDeviceCodeRequestDto
import com.nuvio.tv.data.remote.dto.TraktDeviceTokenRequestDto
import com.nuvio.tv.data.remote.dto.TraktEpisodeDto
import com.nuvio.tv.data.remote.dto.TraktIdsDto
import com.nuvio.tv.data.remote.dto.TraktMovieDto
import com.nuvio.tv.data.remote.dto.TraktScrobbleDto
import com.nuvio.tv.data.remote.dto.TraktShowDto
import com.nuvio.tv.data.remote.dto.TraktSyncRequestDto
import com.nuvio.tv.domain.model.Episode
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
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository for Trakt.tv integration.
 * Handles authentication, sync, scrobbling, and watchlist.
 */
@Singleton
class TraktRepository @Inject constructor(
    private val traktApi: TraktApi
) {

    companion object {
        private const val TAG = "TraktRepository"
        private const val MMKV_ID = "nuvio_trakt"

        // Trakt API credentials - should be moved to BuildConfig in production
        const val TRAKT_CLIENT_ID = "YOUR_TRAKT_CLIENT_ID"
        const val TRAKT_CLIENT_SECRET = "YOUR_TRAKT_CLIENT_SECRET"

        // Storage keys
        private const val KEY_ACCESS_TOKEN = "access_token"
        private const val KEY_REFRESH_TOKEN = "refresh_token"
        private const val KEY_EXPIRES_AT = "expires_at"
        private const val KEY_DEVICE_CODE = "device_code"
        private const val KEY_USER_SLUG = "user_slug"
        private const val KEY_WATCHLIST = "trakt_watchlist"
        private const val KEY_UP_NEXT = "trakt_up_next"
        private const val KEY_LAST_SYNC = "last_sync_time"
    }

    private val mmkv: MMKV by lazy {
        MMKV.mmkvWithID(MMKV_ID, MMKV.MULTI_PROCESS_MODE)
    }

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    private val _isAuthenticatedFlow = MutableStateFlow(false)
    val isAuthenticatedFlow: Flow<Boolean> = _isAuthenticatedFlow.asStateFlow()

    private val _upNextFlow = MutableStateFlow<List<TraktUpNextItem>>(emptyList())
    val upNextFlow: Flow<List<TraktUpNextItem>> = _upNextFlow.asStateFlow()

    private val _watchlistFlow = MutableStateFlow<List<TraktItem>>(emptyList())
    val watchlistFlow: Flow<List<TraktItem>> = _watchlistFlow.asStateFlow()

    /**
     * Initialize repository.
     */
    suspend fun initialize() {
        withContext(Dispatchers.IO) {
            checkAuthentication()
            if (isAuthenticated()) {
                loadCachedData()
            }
        }
    }

    // ==================== AUTHENTICATION ====================

    /**
     * Check if user is authenticated.
     */
    fun isAuthenticated(): Boolean {
        val accessToken = mmkv.decodeString(KEY_ACCESS_TOKEN)
        val expiresAt = mmkv.decodeLong(KEY_EXPIRES_AT, 0)
        return !accessToken.isNullOrBlank() && System.currentTimeMillis() < expiresAt
    }

    /**
     * Get access token for API calls.
     */
    fun getAccessToken(): String? {
        return mmkv.decodeString(KEY_ACCESS_TOKEN)
    }

    private fun getAuthHeader(): String {
        return "Bearer ${getAccessToken()}"
    }

    /**
     * Start device authentication flow (TV-friendly).
     * Returns device code info for user to enter at trakt.tv/activate.
     */
    suspend fun startDeviceAuth(): DeviceCodeResponse? {
        return withContext(Dispatchers.IO) {
            try {
                val request = TraktDeviceCodeRequestDto(clientId = TRAKT_CLIENT_ID)
                val response = traktApi.getDeviceCode(request)

                if (response.isSuccessful) {
                    val body = response.body() ?: return@withContext null

                    // Store device code for polling
                    mmkv.encode(KEY_DEVICE_CODE, body.deviceCode)

                    DeviceCodeResponse(
                        deviceCode = body.deviceCode,
                        userCode = body.userCode,
                        verificationUrl = body.verificationUrl,
                        expiresIn = body.expiresIn,
                        interval = body.interval
                    )
                } else {
                    Log.e(TAG, "Device auth failed: ${response.code()}")
                    null
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error starting device auth", e)
                null
            }
        }
    }

    /**
     * Poll for device auth completion.
     * Returns true if authentication succeeded.
     */
    suspend fun pollDeviceAuth(): Boolean {
        return withContext(Dispatchers.IO) {
            try {
                val deviceCode = mmkv.decodeString(KEY_DEVICE_CODE) ?: return@withContext false

                val request = TraktDeviceTokenRequestDto(
                    code = deviceCode,
                    clientId = TRAKT_CLIENT_ID,
                    clientSecret = TRAKT_CLIENT_SECRET
                )
                val response = traktApi.getDeviceToken(request)

                if (response.isSuccessful) {
                    val body = response.body() ?: return@withContext false

                    // Store tokens
                    mmkv.encode(KEY_ACCESS_TOKEN, body.accessToken)
                    mmkv.encode(KEY_REFRESH_TOKEN, body.refreshToken)
                    mmkv.encode(KEY_EXPIRES_AT, System.currentTimeMillis() + (body.expiresIn * 1000))
                    mmkv.removeValueForKey(KEY_DEVICE_CODE)

                    _isAuthenticatedFlow.value = true

                    // Fetch user profile
                    fetchUserProfile()

                    Log.d(TAG, "Trakt authentication successful")
                    true
                } else if (response.code() == 400) {
                    // Still pending authorization
                    false
                } else {
                    Log.e(TAG, "Device poll failed: ${response.code()}")
                    false
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error polling device auth", e)
                false
            }
        }
    }

    /**
     * Logout and clear tokens.
     */
    suspend fun logout() {
        withContext(Dispatchers.IO) {
            mmkv.removeValueForKey(KEY_ACCESS_TOKEN)
            mmkv.removeValueForKey(KEY_REFRESH_TOKEN)
            mmkv.removeValueForKey(KEY_EXPIRES_AT)
            mmkv.removeValueForKey(KEY_USER_SLUG)
            mmkv.removeValueForKey(KEY_DEVICE_CODE)
            _isAuthenticatedFlow.value = false
            _watchlistFlow.value = emptyList()
            _upNextFlow.value = emptyList()
            Log.d(TAG, "Logged out from Trakt")
        }
    }

    // ==================== SCROBBLING ====================

    /**
     * Start scrobbling (playback started).
     */
    suspend fun startScrobble(content: StreamingContent, episode: Episode? = null, progress: Float) {
        if (!isAuthenticated()) return

        withContext(Dispatchers.IO) {
            try {
                val scrobble = buildScrobbleDto(content, episode, progress)
                val response = traktApi.scrobbleStart(getAuthHeader(), scrobble)
                if (response.isSuccessful) {
                    Log.d(TAG, "Started scrobble for ${content.name}")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error starting scrobble", e)
            }
        }
    }

    /**
     * Pause scrobbling.
     */
    suspend fun pauseScrobble(content: StreamingContent, episode: Episode? = null, progress: Float) {
        if (!isAuthenticated()) return

        withContext(Dispatchers.IO) {
            try {
                val scrobble = buildScrobbleDto(content, episode, progress)
                val response = traktApi.scrobblePause(getAuthHeader(), scrobble)
                if (response.isSuccessful) {
                    Log.d(TAG, "Paused scrobble for ${content.name}")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error pausing scrobble", e)
            }
        }
    }

    /**
     * Stop scrobbling (playback ended).
     */
    suspend fun stopScrobble(content: StreamingContent, episode: Episode? = null, progress: Float) {
        if (!isAuthenticated()) return

        withContext(Dispatchers.IO) {
            try {
                val scrobble = buildScrobbleDto(content, episode, progress)
                val response = traktApi.scrobbleStop(getAuthHeader(), scrobble)
                if (response.isSuccessful) {
                    Log.d(TAG, "Stopped scrobble for ${content.name}")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error stopping scrobble", e)
            }
        }
    }

    // ==================== WATCHLIST ====================

    /**
     * Add to Trakt watchlist.
     */
    suspend fun addToWatchlist(content: StreamingContent) {
        if (!isAuthenticated()) return

        withContext(Dispatchers.IO) {
            try {
                val syncRequest = if (content.type == "movie") {
                    TraktSyncRequestDto(
                        movies = listOf(
                            TraktMovieDto(
                                title = content.name,
                                year = content.year,
                                ids = TraktIdsDto(imdb = content.id)
                            )
                        )
                    )
                } else {
                    TraktSyncRequestDto(
                        shows = listOf(
                            TraktShowDto(
                                title = content.name,
                                year = content.year,
                                ids = TraktIdsDto(imdb = content.id)
                            )
                        )
                    )
                }

                val response = traktApi.addToWatchlist(getAuthHeader(), syncRequest)
                if (response.isSuccessful) {
                    Log.d(TAG, "Added ${content.name} to watchlist")
                    syncWatchlist()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error adding to watchlist", e)
            }
        }
    }

    /**
     * Remove from Trakt watchlist.
     */
    suspend fun removeFromWatchlist(content: StreamingContent) {
        if (!isAuthenticated()) return

        withContext(Dispatchers.IO) {
            try {
                val syncRequest = if (content.type == "movie") {
                    TraktSyncRequestDto(
                        movies = listOf(
                            TraktMovieDto(ids = TraktIdsDto(imdb = content.id))
                        )
                    )
                } else {
                    TraktSyncRequestDto(
                        shows = listOf(
                            TraktShowDto(ids = TraktIdsDto(imdb = content.id))
                        )
                    )
                }

                val response = traktApi.removeFromWatchlist(getAuthHeader(), syncRequest)
                if (response.isSuccessful) {
                    Log.d(TAG, "Removed ${content.name} from watchlist")
                    syncWatchlist()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error removing from watchlist", e)
            }
        }
    }

    /**
     * Sync watchlist from Trakt.
     */
    suspend fun syncWatchlist() {
        if (!isAuthenticated()) return

        withContext(Dispatchers.IO) {
            try {
                val items = mutableListOf<TraktItem>()

                // Fetch movies watchlist
                val moviesResponse = traktApi.getWatchlist(getAuthHeader(), "movies", limit = 100)
                if (moviesResponse.isSuccessful) {
                    moviesResponse.body()?.forEach { item ->
                        item.movie?.let { movie ->
                            items.add(
                                TraktItem(
                                    id = movie.ids.imdb ?: "",
                                    type = "movie",
                                    title = movie.title ?: "",
                                    year = movie.year
                                )
                            )
                        }
                    }
                }

                // Fetch shows watchlist
                val showsResponse = traktApi.getWatchlist(getAuthHeader(), "shows", limit = 100)
                if (showsResponse.isSuccessful) {
                    showsResponse.body()?.forEach { item ->
                        item.show?.let { show ->
                            items.add(
                                TraktItem(
                                    id = show.ids.imdb ?: "",
                                    type = "series",
                                    title = show.title ?: "",
                                    year = show.year
                                )
                            )
                        }
                    }
                }

                // Cache watchlist
                mmkv.encode(KEY_WATCHLIST, json.encodeToString(items))
                _watchlistFlow.value = items

                Log.d(TAG, "Synced ${items.size} watchlist items")
            } catch (e: Exception) {
                Log.e(TAG, "Error syncing watchlist", e)
            }
        }
    }

    /**
     * Check if content is in watchlist.
     */
    fun isInWatchlist(contentId: String): Boolean {
        return _watchlistFlow.value.any { it.id == contentId }
    }

    // ==================== UP NEXT ====================

    /**
     * Get "Up Next" shows (next episode to watch).
     */
    suspend fun syncUpNext() {
        if (!isAuthenticated()) return

        withContext(Dispatchers.IO) {
            try {
                // Get all shows from watchlist and check progress
                val upNextItems = mutableListOf<TraktUpNextItem>()

                _watchlistFlow.value.filter { it.type == "series" }.forEach { show ->
                    try {
                        val response = traktApi.getShowProgress(getAuthHeader(), show.id)
                        if (response.isSuccessful) {
                            response.body()?.nextEpisode?.let { nextEp ->
                                upNextItems.add(
                                    TraktUpNextItem(
                                        showId = show.id,
                                        showTitle = show.title,
                                        seasonNumber = nextEp.season,
                                        episodeNumber = nextEp.number,
                                        episodeTitle = nextEp.title ?: ""
                                    )
                                )
                            }
                        }
                    } catch (e: Exception) {
                        Log.w(TAG, "Error getting progress for ${show.title}", e)
                    }
                }

                // Cache up next
                mmkv.encode(KEY_UP_NEXT, json.encodeToString(upNextItems))
                _upNextFlow.value = upNextItems

                Log.d(TAG, "Synced ${upNextItems.size} up next items")
            } catch (e: Exception) {
                Log.e(TAG, "Error syncing up next", e)
            }
        }
    }

    /**
     * Get cached up next items.
     */
    fun getUpNext(): List<TraktUpNextItem> {
        return _upNextFlow.value
    }

    // ==================== CALENDAR ====================

    /**
     * Get this week's calendar (upcoming episodes).
     */
    suspend fun getThisWeekCalendar(): List<TraktCalendarItem> {
        if (!isAuthenticated()) return emptyList()

        return withContext(Dispatchers.IO) {
            try {
                val today = LocalDate.now()
                val startDate = today.format(DateTimeFormatter.ISO_LOCAL_DATE)

                val response = traktApi.getMyShowsCalendar(getAuthHeader(), startDate, 7)
                if (response.isSuccessful) {
                    response.body()?.map { item ->
                        TraktCalendarItem(
                            showId = item.show.ids.imdb ?: "",
                            showTitle = item.show.title ?: "",
                            seasonNumber = item.episode.season,
                            episodeNumber = item.episode.number,
                            episodeTitle = item.episode.title ?: "",
                            airDate = item.firstAired
                        )
                    } ?: emptyList()
                } else {
                    emptyList()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error fetching calendar", e)
                emptyList()
            }
        }
    }

    // ==================== HISTORY ====================

    /**
     * Add to history (mark as watched).
     */
    suspend fun addToHistory(content: StreamingContent, episode: Episode? = null) {
        if (!isAuthenticated()) return

        withContext(Dispatchers.IO) {
            try {
                val syncRequest = if (content.type == "movie" || episode == null) {
                    TraktSyncRequestDto(
                        movies = listOf(
                            TraktMovieDto(
                                title = content.name,
                                year = content.year,
                                ids = TraktIdsDto(imdb = content.id)
                            )
                        )
                    )
                } else {
                    TraktSyncRequestDto(
                        shows = listOf(
                            TraktShowDto(
                                title = content.name,
                                year = content.year,
                                ids = TraktIdsDto(imdb = content.id)
                            )
                        )
                    )
                }

                val response = traktApi.addToHistory(getAuthHeader(), syncRequest)
                if (response.isSuccessful) {
                    Log.d(TAG, "Added to history: ${content.name}")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error adding to history", e)
            }
        }
    }

    /**
     * Sync full library.
     */
    suspend fun syncLibrary() {
        if (!isAuthenticated()) return

        withContext(Dispatchers.IO) {
            syncWatchlist()
            syncUpNext()
            mmkv.encode(KEY_LAST_SYNC, System.currentTimeMillis())
            Log.d(TAG, "Full library sync completed")
        }
    }

    // ==================== INTERNAL HELPERS ====================

    private fun checkAuthentication() {
        _isAuthenticatedFlow.value = isAuthenticated()
    }

    private fun loadCachedData() {
        // Load cached watchlist
        val watchlistData = mmkv.decodeString(KEY_WATCHLIST)
        if (watchlistData != null) {
            try {
                _watchlistFlow.value = json.decodeFromString<List<TraktItem>>(watchlistData)
            } catch (e: Exception) {
                // Ignore
            }
        }

        // Load cached up next
        val upNextData = mmkv.decodeString(KEY_UP_NEXT)
        if (upNextData != null) {
            try {
                _upNextFlow.value = json.decodeFromString<List<TraktUpNextItem>>(upNextData)
            } catch (e: Exception) {
                // Ignore
            }
        }
    }

    private suspend fun fetchUserProfile() {
        try {
            val response = traktApi.getUserSettings(getAuthHeader())
            if (response.isSuccessful) {
                val userSlug = response.body()?.user?.ids?.slug
                if (userSlug != null) {
                    mmkv.encode(KEY_USER_SLUG, userSlug)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error fetching user profile", e)
        }
    }

    private fun buildScrobbleDto(
        content: StreamingContent,
        episode: Episode?,
        progress: Float
    ): TraktScrobbleDto {
        return if (content.type == "movie" || episode == null) {
            TraktScrobbleDto(
                movie = TraktMovieDto(
                    title = content.name,
                    year = content.year,
                    ids = TraktIdsDto(imdb = content.id)
                ),
                progress = progress * 100
            )
        } else {
            TraktScrobbleDto(
                show = TraktShowDto(
                    title = content.name,
                    year = content.year,
                    ids = TraktIdsDto(imdb = content.id)
                ),
                episode = TraktEpisodeDto(
                    season = episode.seasonNumber,
                    number = episode.episodeNumber,
                    title = episode.title
                ),
                progress = progress * 100
            )
        }
    }
}

// ==================== DATA CLASSES ====================

@Serializable
data class DeviceCodeResponse(
    val deviceCode: String,
    val userCode: String,
    val verificationUrl: String,
    val expiresIn: Int,
    val interval: Int
)

@Serializable
data class TraktItem(
    val id: String,
    val type: String,
    val title: String,
    val year: Int? = null
)

@Serializable
data class TraktUpNextItem(
    val showId: String,
    val showTitle: String,
    val seasonNumber: Int,
    val episodeNumber: Int,
    val episodeTitle: String
)

@Serializable
data class TraktCalendarItem(
    val showId: String,
    val showTitle: String,
    val seasonNumber: Int,
    val episodeNumber: Int,
    val episodeTitle: String,
    val airDate: String
)
