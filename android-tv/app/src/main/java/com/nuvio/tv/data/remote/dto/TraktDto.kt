package com.nuvio.tv.data.remote.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Trakt scrobble request/response.
 */
@Serializable
data class TraktScrobbleDto(
    val movie: TraktMovieDto? = null,
    val show: TraktShowDto? = null,
    val episode: TraktEpisodeDto? = null,
    val progress: Float,
    @SerialName("app_version")
    val appVersion: String? = null,
    @SerialName("app_date")
    val appDate: String? = null
)

@Serializable
data class TraktScrobbleResponseDto(
    val id: Long? = null,
    val action: String? = null, // "start", "pause", "scrobble"
    val progress: Float? = null,
    val sharing: TraktSharingDto? = null,
    val movie: TraktMovieDto? = null,
    val show: TraktShowDto? = null,
    val episode: TraktEpisodeDto? = null
)

@Serializable
data class TraktSharingDto(
    val twitter: Boolean? = null,
    val mastodon: Boolean? = null,
    val tumblr: Boolean? = null
)

/**
 * Trakt movie object.
 */
@Serializable
data class TraktMovieDto(
    val title: String? = null,
    val year: Int? = null,
    val ids: TraktIdsDto
)

/**
 * Trakt TV show object.
 */
@Serializable
data class TraktShowDto(
    val title: String? = null,
    val year: Int? = null,
    val ids: TraktIdsDto
)

/**
 * Trakt episode object.
 */
@Serializable
data class TraktEpisodeDto(
    val season: Int,
    val number: Int,
    val title: String? = null,
    val ids: TraktIdsDto? = null
)

/**
 * Trakt ID object - contains various external IDs.
 */
@Serializable
data class TraktIdsDto(
    val trakt: Int? = null,
    val slug: String? = null,
    val imdb: String? = null,
    val tmdb: Int? = null,
    val tvdb: Int? = null
)

/**
 * Trakt watchlist item.
 */
@Serializable
data class TraktWatchlistItemDto(
    val rank: Int? = null,
    @SerialName("listed_at")
    val listedAt: String? = null,
    val type: String, // "movie" or "show"
    val movie: TraktMovieDto? = null,
    val show: TraktShowDto? = null
)

/**
 * Trakt history item.
 */
@Serializable
data class TraktHistoryItemDto(
    val id: Long,
    @SerialName("watched_at")
    val watchedAt: String,
    val action: String, // "watch", "scrobble"
    val type: String, // "movie" or "episode"
    val movie: TraktMovieDto? = null,
    val show: TraktShowDto? = null,
    val episode: TraktEpisodeDto? = null
)

/**
 * Trakt sync add/remove request.
 */
@Serializable
data class TraktSyncRequestDto(
    val movies: List<TraktMovieDto>? = null,
    val shows: List<TraktShowDto>? = null,
    val episodes: List<TraktEpisodeSyncDto>? = null
)

@Serializable
data class TraktEpisodeSyncDto(
    val ids: TraktIdsDto? = null,
    @SerialName("watched_at")
    val watchedAt: String? = null
)

/**
 * Trakt sync response.
 */
@Serializable
data class TraktSyncResponseDto(
    val added: TraktSyncResultDto? = null,
    val deleted: TraktSyncResultDto? = null,
    val existing: TraktSyncResultDto? = null,
    @SerialName("not_found")
    val notFound: TraktSyncNotFoundDto? = null
)

@Serializable
data class TraktSyncResultDto(
    val movies: Int? = null,
    val shows: Int? = null,
    val seasons: Int? = null,
    val episodes: Int? = null
)

@Serializable
data class TraktSyncNotFoundDto(
    val movies: List<TraktMovieDto>? = null,
    val shows: List<TraktShowDto>? = null,
    val episodes: List<TraktEpisodeSyncDto>? = null
)

/**
 * Trakt playback progress item.
 */
@Serializable
data class TraktPlaybackProgressDto(
    val id: Long,
    val progress: Float,
    @SerialName("paused_at")
    val pausedAt: String? = null,
    val type: String, // "movie" or "episode"
    val movie: TraktMovieDto? = null,
    val show: TraktShowDto? = null,
    val episode: TraktEpisodeDto? = null
)

/**
 * Trakt show progress (watching progress).
 */
@Serializable
data class TraktShowProgressDto(
    val aired: Int,
    val completed: Int,
    @SerialName("last_watched_at")
    val lastWatchedAt: String? = null,
    @SerialName("reset_at")
    val resetAt: String? = null,
    val seasons: List<TraktSeasonProgressDto>? = null,
    @SerialName("hidden_seasons")
    val hiddenSeasons: List<TraktSeasonDto>? = null,
    @SerialName("next_episode")
    val nextEpisode: TraktEpisodeDto? = null,
    @SerialName("last_episode")
    val lastEpisode: TraktEpisodeDto? = null
)

@Serializable
data class TraktSeasonProgressDto(
    val number: Int,
    val title: String? = null,
    val aired: Int,
    val completed: Int,
    val episodes: List<TraktEpisodeProgressDto>? = null
)

@Serializable
data class TraktEpisodeProgressDto(
    val number: Int,
    val completed: Boolean,
    @SerialName("last_watched_at")
    val lastWatchedAt: String? = null
)

@Serializable
data class TraktSeasonDto(
    val number: Int,
    val ids: TraktIdsDto
)

/**
 * Trakt up next (calendar) item.
 */
@Serializable
data class TraktCalendarItemDto(
    @SerialName("first_aired")
    val firstAired: String,
    val episode: TraktEpisodeDto,
    val show: TraktShowDto
)

/**
 * Trakt OAuth token response.
 */
@Serializable
data class TraktTokenResponseDto(
    @SerialName("access_token")
    val accessToken: String,
    @SerialName("token_type")
    val tokenType: String,
    @SerialName("expires_in")
    val expiresIn: Long,
    @SerialName("refresh_token")
    val refreshToken: String,
    val scope: String,
    @SerialName("created_at")
    val createdAt: Long
)

/**
 * Trakt OAuth token request.
 */
@Serializable
data class TraktTokenRequestDto(
    val code: String? = null,
    @SerialName("refresh_token")
    val refreshToken: String? = null,
    @SerialName("client_id")
    val clientId: String,
    @SerialName("client_secret")
    val clientSecret: String,
    @SerialName("redirect_uri")
    val redirectUri: String,
    @SerialName("grant_type")
    val grantType: String // "authorization_code" or "refresh_token"
)

/**
 * Trakt device code request.
 */
@Serializable
data class TraktDeviceCodeRequestDto(
    @SerialName("client_id")
    val clientId: String
)

/**
 * Trakt device code response.
 */
@Serializable
data class TraktDeviceCodeResponseDto(
    @SerialName("device_code")
    val deviceCode: String,
    @SerialName("user_code")
    val userCode: String,
    @SerialName("verification_url")
    val verificationUrl: String,
    @SerialName("expires_in")
    val expiresIn: Int,
    val interval: Int
)

/**
 * Trakt device token request.
 */
@Serializable
data class TraktDeviceTokenRequestDto(
    val code: String,
    @SerialName("client_id")
    val clientId: String,
    @SerialName("client_secret")
    val clientSecret: String
)

/**
 * Trakt user settings.
 */
@Serializable
data class TraktUserSettingsDto(
    val user: TraktUserDto,
    val account: TraktAccountDto? = null
)

@Serializable
data class TraktUserDto(
    val username: String,
    val private: Boolean,
    val name: String? = null,
    val vip: Boolean? = null,
    @SerialName("vip_ep")
    val vipEp: Boolean? = null,
    val ids: TraktUserIdsDto
)

@Serializable
data class TraktUserIdsDto(
    val slug: String,
    val uuid: String? = null
)

@Serializable
data class TraktAccountDto(
    val timezone: String? = null,
    @SerialName("date_format")
    val dateFormat: String? = null,
    @SerialName("time_24hr")
    val time24hr: Boolean? = null
)
