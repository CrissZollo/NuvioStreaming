package com.nuvio.tv.data.remote.api

import com.nuvio.tv.data.remote.dto.TraktCalendarItemDto
import com.nuvio.tv.data.remote.dto.TraktDeviceCodeRequestDto
import com.nuvio.tv.data.remote.dto.TraktDeviceCodeResponseDto
import com.nuvio.tv.data.remote.dto.TraktDeviceTokenRequestDto
import com.nuvio.tv.data.remote.dto.TraktHistoryItemDto
import com.nuvio.tv.data.remote.dto.TraktPlaybackProgressDto
import com.nuvio.tv.data.remote.dto.TraktScrobbleDto
import com.nuvio.tv.data.remote.dto.TraktScrobbleResponseDto
import com.nuvio.tv.data.remote.dto.TraktShowProgressDto
import com.nuvio.tv.data.remote.dto.TraktSyncRequestDto
import com.nuvio.tv.data.remote.dto.TraktSyncResponseDto
import com.nuvio.tv.data.remote.dto.TraktTokenRequestDto
import com.nuvio.tv.data.remote.dto.TraktTokenResponseDto
import com.nuvio.tv.data.remote.dto.TraktUserSettingsDto
import com.nuvio.tv.data.remote.dto.TraktWatchlistItemDto
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Retrofit interface for Trakt API.
 * Used for scrobbling, watchlist sync, and progress tracking.
 */
interface TraktApi {

    companion object {
        const val BASE_URL = "https://api.trakt.tv/"
        const val API_VERSION = "2"
    }

    // ==================== Authentication ====================

    /**
     * Get device code for TV authentication flow.
     */
    @POST("oauth/device/code")
    suspend fun getDeviceCode(
        @Body request: TraktDeviceCodeRequestDto
    ): Response<TraktDeviceCodeResponseDto>

    /**
     * Poll for device token after user authorizes.
     */
    @POST("oauth/device/token")
    suspend fun getDeviceToken(
        @Body request: TraktDeviceTokenRequestDto
    ): Response<TraktTokenResponseDto>

    /**
     * Exchange authorization code for tokens.
     */
    @POST("oauth/token")
    suspend fun getToken(
        @Body request: TraktTokenRequestDto
    ): Response<TraktTokenResponseDto>

    /**
     * Refresh access token.
     */
    @POST("oauth/token")
    suspend fun refreshToken(
        @Body request: TraktTokenRequestDto
    ): Response<TraktTokenResponseDto>

    /**
     * Revoke access token.
     */
    @POST("oauth/revoke")
    suspend fun revokeToken(
        @Body request: TraktTokenRequestDto
    ): Response<Unit>

    // ==================== User ====================

    /**
     * Get user settings.
     */
    @GET("users/settings")
    suspend fun getUserSettings(
        @Header("Authorization") authorization: String
    ): Response<TraktUserSettingsDto>

    // ==================== Scrobbling ====================

    /**
     * Start watching content.
     */
    @POST("scrobble/start")
    suspend fun scrobbleStart(
        @Header("Authorization") authorization: String,
        @Body scrobble: TraktScrobbleDto
    ): Response<TraktScrobbleResponseDto>

    /**
     * Pause watching content.
     */
    @POST("scrobble/pause")
    suspend fun scrobblePause(
        @Header("Authorization") authorization: String,
        @Body scrobble: TraktScrobbleDto
    ): Response<TraktScrobbleResponseDto>

    /**
     * Stop watching content (marks as watched if > 80%).
     */
    @POST("scrobble/stop")
    suspend fun scrobbleStop(
        @Header("Authorization") authorization: String,
        @Body scrobble: TraktScrobbleDto
    ): Response<TraktScrobbleResponseDto>

    // ==================== Sync - Watchlist ====================

    /**
     * Get user's watchlist.
     */
    @GET("sync/watchlist/{type}")
    suspend fun getWatchlist(
        @Header("Authorization") authorization: String,
        @Path("type") type: String, // "movies", "shows", or "episodes"
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20
    ): Response<List<TraktWatchlistItemDto>>

    /**
     * Add items to watchlist.
     */
    @POST("sync/watchlist")
    suspend fun addToWatchlist(
        @Header("Authorization") authorization: String,
        @Body items: TraktSyncRequestDto
    ): Response<TraktSyncResponseDto>

    /**
     * Remove items from watchlist.
     */
    @POST("sync/watchlist/remove")
    suspend fun removeFromWatchlist(
        @Header("Authorization") authorization: String,
        @Body items: TraktSyncRequestDto
    ): Response<TraktSyncResponseDto>

    // ==================== Sync - History ====================

    /**
     * Get user's watch history.
     */
    @GET("sync/history/{type}")
    suspend fun getHistory(
        @Header("Authorization") authorization: String,
        @Path("type") type: String, // "movies", "shows", or "episodes"
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20,
        @Query("start_at") startAt: String? = null,
        @Query("end_at") endAt: String? = null
    ): Response<List<TraktHistoryItemDto>>

    /**
     * Add items to history.
     */
    @POST("sync/history")
    suspend fun addToHistory(
        @Header("Authorization") authorization: String,
        @Body items: TraktSyncRequestDto
    ): Response<TraktSyncResponseDto>

    /**
     * Remove items from history.
     */
    @POST("sync/history/remove")
    suspend fun removeFromHistory(
        @Header("Authorization") authorization: String,
        @Body items: TraktSyncRequestDto
    ): Response<TraktSyncResponseDto>

    // ==================== Sync - Playback Progress ====================

    /**
     * Get playback progress (resume positions).
     */
    @GET("sync/playback/{type}")
    suspend fun getPlaybackProgress(
        @Header("Authorization") authorization: String,
        @Path("type") type: String, // "movies" or "episodes"
        @Query("limit") limit: Int = 50
    ): Response<List<TraktPlaybackProgressDto>>

    /**
     * Delete a specific playback progress entry.
     */
    @DELETE("sync/playback/{id}")
    suspend fun deletePlaybackProgress(
        @Header("Authorization") authorization: String,
        @Path("id") id: Long
    ): Response<Unit>

    // ==================== Shows ====================

    /**
     * Get show watched progress.
     */
    @GET("shows/{id}/progress/watched")
    suspend fun getShowProgress(
        @Header("Authorization") authorization: String,
        @Path("id") id: String, // Trakt slug, IMDB ID, or TMDB ID
        @Query("hidden") hidden: Boolean = false,
        @Query("specials") specials: Boolean = false,
        @Query("count_specials") countSpecials: Boolean = false,
        @Query("last_activity") lastActivity: String = "watched" // or "collected", "aired"
    ): Response<TraktShowProgressDto>

    // ==================== Calendar ====================

    /**
     * Get shows airing today (requires authentication).
     */
    @GET("calendars/my/shows/{start_date}/{days}")
    suspend fun getMyShowsCalendar(
        @Header("Authorization") authorization: String,
        @Path("start_date") startDate: String, // YYYY-MM-DD
        @Path("days") days: Int = 7
    ): Response<List<TraktCalendarItemDto>>

    /**
     * Get all shows airing (no authentication required).
     */
    @GET("calendars/all/shows/{start_date}/{days}")
    suspend fun getAllShowsCalendar(
        @Path("start_date") startDate: String, // YYYY-MM-DD
        @Path("days") days: Int = 7
    ): Response<List<TraktCalendarItemDto>>

    /**
     * Get new show premieres.
     */
    @GET("calendars/all/shows/premieres/{start_date}/{days}")
    suspend fun getPremieres(
        @Path("start_date") startDate: String,
        @Path("days") days: Int = 7
    ): Response<List<TraktCalendarItemDto>>
}
