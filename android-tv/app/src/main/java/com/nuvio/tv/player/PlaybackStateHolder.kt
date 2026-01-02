package com.nuvio.tv.player

import com.nuvio.tv.domain.model.Stream
import com.nuvio.tv.domain.model.StreamingContent
import com.nuvio.tv.domain.model.Subtitle
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Data class holding all playback-related data for navigation.
 */
data class PlaybackRequest(
    val stream: Stream,
    val content: StreamingContent? = null,
    val episodeId: String? = null,
    val episodeTitle: String? = null,
    val seasonNumber: Int? = null,
    val episodeNumber: Int? = null,
    val startPosition: Long = 0L,
    val subtitles: List<Subtitle> = emptyList()
)

/**
 * Singleton holder for playback state during navigation.
 *
 * This allows passing complex Stream objects between screens
 * without serialization in navigation arguments.
 */
@Singleton
class PlaybackStateHolder @Inject constructor() {

    private var _playbackRequest: PlaybackRequest? = null

    /**
     * Set the current playback request before navigating to player.
     */
    fun setPlaybackRequest(request: PlaybackRequest) {
        _playbackRequest = request
    }

    /**
     * Get and consume the playback request.
     * Returns null if no request is pending.
     */
    fun consumePlaybackRequest(): PlaybackRequest? {
        val request = _playbackRequest
        _playbackRequest = null
        return request
    }

    /**
     * Peek at the current playback request without consuming it.
     */
    fun peekPlaybackRequest(): PlaybackRequest? = _playbackRequest

    /**
     * Check if there's a pending playback request.
     */
    fun hasPendingRequest(): Boolean = _playbackRequest != null

    /**
     * Clear any pending playback request.
     */
    fun clear() {
        _playbackRequest = null
    }
}
