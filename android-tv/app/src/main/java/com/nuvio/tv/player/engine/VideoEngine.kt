package com.nuvio.tv.player.engine

import android.content.Context
import android.view.View
import com.nuvio.tv.domain.model.Stream
import kotlinx.coroutines.flow.StateFlow

/**
 * Unified interface for video playback engines.
 * Implemented by MpvEngine and ExoPlayerEngine.
 */
interface VideoEngine {

    /**
     * The type of this engine.
     */
    val engineType: EngineType

    /**
     * Current player state as a StateFlow.
     */
    val playerState: StateFlow<EnginePlayerState>

    /**
     * Engine events (errors, state changes, etc.)
     */
    val engineEvents: StateFlow<EngineEvent?>

    /**
     * Initialize the engine with a context.
     */
    fun initialize(context: Context)

    /**
     * Check if the engine is available and can be used.
     */
    fun isAvailable(): Boolean

    /**
     * Get the video surface view for embedding in UI.
     */
    fun getVideoView(): View?

    /**
     * Prepare and play a stream.
     * @param stream The stream to play
     * @param startPosition Position to start from in milliseconds
     * @param headers Optional HTTP headers for the request
     */
    fun playStream(stream: Stream, startPosition: Long = 0L, headers: Map<String, String> = emptyMap())

    /**
     * Start or resume playback.
     */
    fun play()

    /**
     * Pause playback.
     */
    fun pause()

    /**
     * Toggle play/pause.
     */
    fun togglePlayPause()

    /**
     * Stop playback and clear media.
     */
    fun stop()

    /**
     * Seek to a specific position.
     * @param positionMs Position in milliseconds
     */
    fun seekTo(positionMs: Long)

    /**
     * Seek forward by amount.
     * @param amountMs Amount in milliseconds (default 10 seconds)
     */
    fun seekForward(amountMs: Long = 10_000L)

    /**
     * Seek backward by amount.
     * @param amountMs Amount in milliseconds (default 10 seconds)
     */
    fun seekBackward(amountMs: Long = 10_000L)

    /**
     * Set playback speed.
     * @param speed Speed multiplier (0.25 - 2.0)
     */
    fun setPlaybackSpeed(speed: Float)

    /**
     * Select an audio track.
     * @param trackIndex Track index, or -1 to use default
     */
    fun selectAudioTrack(trackIndex: Int)

    /**
     * Select a subtitle track.
     * @param trackIndex Track index, or -1 to disable subtitles
     */
    fun selectSubtitleTrack(trackIndex: Int)

    /**
     * Select a quality level.
     * @param levelIndex Quality level index, or -1 for auto
     */
    fun selectQualityLevel(levelIndex: Int)

    /**
     * Add an external subtitle track.
     * @param url URL of the subtitle file
     * @param language Language code
     * @param label Display label
     * @param mimeType MIME type of the subtitle (e.g., text/vtt, application/x-subrip)
     */
    fun addExternalSubtitle(url: String, language: String, label: String? = null, mimeType: String? = null)

    /**
     * Update and return the current player state.
     */
    fun updateState()

    /**
     * Get progress as a percentage (0.0 - 1.0).
     */
    fun getProgressPercent(): Float

    /**
     * Release all resources.
     */
    fun release()
}

/**
 * Types of video engines.
 */
enum class EngineType {
    MPV,
    EXOPLAYER
}

/**
 * Player state from the video engine.
 */
data class EnginePlayerState(
    val isPlaying: Boolean = false,
    val isBuffering: Boolean = false,
    val isEnded: Boolean = false,
    val isPaused: Boolean = false,
    val currentPosition: Long = 0L,
    val duration: Long = 0L,
    val bufferedPosition: Long = 0L,
    val bufferedPercent: Int = 0,
    val playbackSpeed: Float = 1f,
    val audioTracks: List<EngineAudioTrack> = emptyList(),
    val subtitleTracks: List<EngineSubtitleTrack> = emptyList(),
    val qualityLevels: List<EngineQualityLevel> = emptyList(),
    val selectedAudioTrack: Int = -1,
    val selectedSubtitleTrack: Int = -1,
    val selectedQualityLevel: Int = -1,
    // Playback info (debug)
    val currentBitrate: Int = 0,
    val currentResolution: String = "",
    val currentCodec: String = "",
    val decoderType: String = "", // "HW" or "SW"
    val error: String? = null
)

/**
 * Audio track information.
 */
data class EngineAudioTrack(
    val index: Int,
    val id: String? = null,
    val language: String?,
    val label: String?,
    val codec: String? = null,
    val channels: Int = 0,
    val sampleRate: Int = 0,
    val isSelected: Boolean = false,
    val isDefault: Boolean = false
)

/**
 * Subtitle track information.
 */
data class EngineSubtitleTrack(
    val index: Int,
    val id: String? = null,
    val language: String?,
    val label: String?,
    val codec: String? = null,
    val isExternal: Boolean = false,
    val isSelected: Boolean = false,
    val isDefault: Boolean = false
)

/**
 * Quality level information.
 */
data class EngineQualityLevel(
    val index: Int,
    val width: Int,
    val height: Int,
    val bitrate: Int,
    val label: String,
    val codec: String? = null,
    val isSelected: Boolean = false
)

/**
 * Events emitted by video engines.
 */
sealed class EngineEvent {
    data class Error(
        val code: Int,
        val message: String,
        val isFatal: Boolean = false,
        val canRetry: Boolean = true
    ) : EngineEvent()

    data class PlaybackStarted(val position: Long) : EngineEvent()
    object PlaybackEnded : EngineEvent()
    object PlaybackPaused : EngineEvent()
    object PlaybackResumed : EngineEvent()
    data class BufferingStarted(val percent: Int) : EngineEvent()
    data class BufferingEnded(val percent: Int) : EngineEvent()
    data class SeekCompleted(val position: Long) : EngineEvent()
    data class TracksChanged(val audioCount: Int, val subtitleCount: Int, val qualityCount: Int) : EngineEvent()
    data class VideoSizeChanged(val width: Int, val height: Int) : EngineEvent()
}

/**
 * Error codes for video engine errors.
 */
object EngineErrorCodes {
    const val UNKNOWN = -1
    const val NETWORK_ERROR = 1001
    const val CODEC_ERROR = 1002
    const val DRM_ERROR = 1003
    const val TIMEOUT = 1004
    const val INVALID_URL = 1005
    const val SOURCE_ERROR = 1006
    const val RENDERER_ERROR = 1007
    const val DECODE_ERROR = 1008
}
