package com.nuvio.tv.player

import android.content.Context
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.TrackGroup
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.common.Tracks
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.hls.HlsMediaSource
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.exoplayer.source.MediaSource
import androidx.media3.exoplayer.source.ProgressiveMediaSource
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector
import com.nuvio.tv.domain.model.Stream
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Player state data class.
 */
data class PlayerState(
    val isPlaying: Boolean = false,
    val isBuffering: Boolean = false,
    val isEnded: Boolean = false,
    val currentPosition: Long = 0L,
    val duration: Long = 0L,
    val bufferedPosition: Long = 0L,
    val error: String? = null,
    val playbackSpeed: Float = 1f,
    val audioTracks: List<AudioTrack> = emptyList(),
    val subtitleTracks: List<SubtitleTrack> = emptyList(),
    val qualityLevels: List<QualityLevel> = emptyList(),
    val selectedAudioTrack: Int = -1,
    val selectedSubtitleTrack: Int = -1,
    val selectedQualityLevel: Int = -1
)

data class AudioTrack(
    val index: Int,
    val language: String?,
    val label: String?,
    val isSelected: Boolean = false
)

data class SubtitleTrack(
    val index: Int,
    val language: String?,
    val label: String?,
    val isSelected: Boolean = false
)

data class QualityLevel(
    val index: Int,
    val width: Int,
    val height: Int,
    val bitrate: Int,
    val label: String,
    val isSelected: Boolean = false
)

/**
 * NuvioPlayer - ExoPlayer wrapper with state management.
 * Handles HLS, DASH, and progressive video playback.
 */
@Singleton
class NuvioPlayer @Inject constructor(
    @ApplicationContext private val context: Context
) {

    private var _exoPlayer: ExoPlayer? = null
    val exoPlayer: ExoPlayer?
        get() = _exoPlayer

    private val trackSelector = DefaultTrackSelector(context).apply {
        setParameters(
            buildUponParameters()
                .setPreferredAudioLanguage("en")
                .setPreferredTextLanguage("en")
        )
    }

    private val _playerState = MutableStateFlow(PlayerState())
    val playerState: StateFlow<PlayerState> = _playerState.asStateFlow()

    private var currentStream: Stream? = null
    private var resumePosition: Long = 0L

    private val playerListener = object : Player.Listener {
        override fun onPlaybackStateChanged(playbackState: Int) {
            updatePlayerState()
        }

        override fun onIsPlayingChanged(isPlaying: Boolean) {
            updatePlayerState()
        }

        override fun onTracksChanged(tracks: Tracks) {
            updateTrackInfo(tracks)
        }

        override fun onPlayerError(error: PlaybackException) {
            _playerState.value = _playerState.value.copy(
                error = error.message ?: "Playback error"
            )
        }

        override fun onPlaybackParametersChanged(playbackParameters: androidx.media3.common.PlaybackParameters) {
            _playerState.value = _playerState.value.copy(playbackSpeed = playbackParameters.speed)
        }
    }

    /**
     * Initialize the player.
     */
    fun initialize() {
        if (_exoPlayer != null) return

        _exoPlayer = ExoPlayer.Builder(context)
            .setTrackSelector(trackSelector)
            .setMediaSourceFactory(DefaultMediaSourceFactory(context))
            .build()
            .apply {
                addListener(playerListener)
                playWhenReady = true
            }
    }

    /**
     * Prepare and play a stream.
     */
    fun playStream(stream: Stream, startPosition: Long = 0L) {
        val player = _exoPlayer ?: run {
            initialize()
            _exoPlayer
        } ?: return

        currentStream = stream
        resumePosition = startPosition

        val url = stream.url ?: return
        val headers = stream.headers ?: emptyMap()

        // Create data source factory with headers
        val dataSourceFactory = DefaultHttpDataSource.Factory()
            .setDefaultRequestProperties(headers)
            .setConnectTimeoutMs(30_000)
            .setReadTimeoutMs(30_000)
            .setAllowCrossProtocolRedirects(true)

        // Determine media type and create appropriate source
        val mediaSource = createMediaSource(url, dataSourceFactory)

        player.setMediaSource(mediaSource)
        player.prepare()

        if (startPosition > 0) {
            player.seekTo(startPosition)
        }

        _playerState.value = _playerState.value.copy(error = null)
    }

    private fun createMediaSource(
        url: String,
        dataSourceFactory: DefaultHttpDataSource.Factory
    ): MediaSource {
        val mediaItem = MediaItem.Builder()
            .setUri(url)
            .build()

        return when {
            url.contains(".m3u8", ignoreCase = true) ||
            url.contains("hls", ignoreCase = true) -> {
                HlsMediaSource.Factory(dataSourceFactory)
                    .createMediaSource(mediaItem)
            }
            else -> {
                ProgressiveMediaSource.Factory(dataSourceFactory)
                    .createMediaSource(mediaItem)
            }
        }
    }

    /**
     * Add external subtitles.
     */
    fun addSubtitle(url: String, language: String, mimeType: String = MimeTypes.TEXT_VTT) {
        val player = _exoPlayer ?: return
        val currentItem = player.currentMediaItem ?: return

        val subtitle = MediaItem.SubtitleConfiguration.Builder(android.net.Uri.parse(url))
            .setMimeType(mimeType)
            .setLanguage(language)
            .setSelectionFlags(C.SELECTION_FLAG_DEFAULT)
            .build()

        val newItem = currentItem.buildUpon()
            .setSubtitleConfigurations(listOf(subtitle))
            .build()

        val currentPosition = player.currentPosition
        player.setMediaItem(newItem)
        player.seekTo(currentPosition)
        player.prepare()
    }

    /**
     * Play/Pause toggle.
     */
    fun togglePlayPause() {
        _exoPlayer?.let { player ->
            if (player.isPlaying) {
                player.pause()
            } else {
                player.play()
            }
        }
    }

    /**
     * Play.
     */
    fun play() {
        _exoPlayer?.play()
    }

    /**
     * Pause.
     */
    fun pause() {
        _exoPlayer?.pause()
    }

    /**
     * Seek to position.
     */
    fun seekTo(positionMs: Long) {
        _exoPlayer?.seekTo(positionMs.coerceIn(0, _exoPlayer?.duration ?: 0))
    }

    /**
     * Seek forward by amount.
     */
    fun seekForward(amountMs: Long = 10_000) {
        _exoPlayer?.let { player ->
            val newPosition = (player.currentPosition + amountMs).coerceAtMost(player.duration)
            player.seekTo(newPosition)
        }
    }

    /**
     * Seek backward by amount.
     */
    fun seekBackward(amountMs: Long = 10_000) {
        _exoPlayer?.let { player ->
            val newPosition = (player.currentPosition - amountMs).coerceAtLeast(0)
            player.seekTo(newPosition)
        }
    }

    /**
     * Set playback speed.
     */
    fun setPlaybackSpeed(speed: Float) {
        _exoPlayer?.setPlaybackSpeed(speed.coerceIn(0.25f, 2f))
    }

    /**
     * Select audio track.
     */
    fun selectAudioTrack(trackIndex: Int) {
        val player = _exoPlayer ?: return

        if (trackIndex < 0) {
            // Disable audio track selection
            trackSelector.setParameters(
                trackSelector.buildUponParameters()
                    .clearOverridesOfType(C.TRACK_TYPE_AUDIO)
            )
            return
        }

        val tracks = player.currentTracks
        val audioGroups = tracks.groups.filter { it.type == C.TRACK_TYPE_AUDIO }

        if (trackIndex < audioGroups.size) {
            val group = audioGroups[trackIndex]
            val override = TrackSelectionOverride(group.mediaTrackGroup, 0)

            trackSelector.setParameters(
                trackSelector.buildUponParameters()
                    .setOverrideForType(override)
            )

            _playerState.value = _playerState.value.copy(selectedAudioTrack = trackIndex)
        }
    }

    /**
     * Select subtitle track.
     */
    fun selectSubtitleTrack(trackIndex: Int) {
        val player = _exoPlayer ?: return

        if (trackIndex < 0) {
            // Disable subtitles
            trackSelector.setParameters(
                trackSelector.buildUponParameters()
                    .setRendererDisabled(C.TRACK_TYPE_TEXT, true)
            )
            _playerState.value = _playerState.value.copy(selectedSubtitleTrack = -1)
            return
        }

        val tracks = player.currentTracks
        val textGroups = tracks.groups.filter { it.type == C.TRACK_TYPE_TEXT }

        if (trackIndex < textGroups.size) {
            val group = textGroups[trackIndex]
            val override = TrackSelectionOverride(group.mediaTrackGroup, 0)

            trackSelector.setParameters(
                trackSelector.buildUponParameters()
                    .setRendererDisabled(C.TRACK_TYPE_TEXT, false)
                    .setOverrideForType(override)
            )

            _playerState.value = _playerState.value.copy(selectedSubtitleTrack = trackIndex)
        }
    }

    /**
     * Select quality level.
     */
    fun selectQualityLevel(levelIndex: Int) {
        val player = _exoPlayer ?: return

        if (levelIndex < 0) {
            // Auto quality
            trackSelector.setParameters(
                trackSelector.buildUponParameters()
                    .clearOverridesOfType(C.TRACK_TYPE_VIDEO)
            )
            _playerState.value = _playerState.value.copy(selectedQualityLevel = -1)
            return
        }

        val tracks = player.currentTracks
        val videoGroups = tracks.groups.filter { it.type == C.TRACK_TYPE_VIDEO }

        if (videoGroups.isNotEmpty()) {
            val group = videoGroups[0]
            if (levelIndex < group.length) {
                val override = TrackSelectionOverride(group.mediaTrackGroup, levelIndex)

                trackSelector.setParameters(
                    trackSelector.buildUponParameters()
                        .setOverrideForType(override)
                )

                _playerState.value = _playerState.value.copy(selectedQualityLevel = levelIndex)
            }
        }
    }

    /**
     * Get current position as percentage.
     */
    fun getProgressPercent(): Float {
        val player = _exoPlayer ?: return 0f
        val duration = player.duration
        if (duration <= 0) return 0f
        return (player.currentPosition.toFloat() / duration.toFloat()).coerceIn(0f, 1f)
    }

    /**
     * Update player state from ExoPlayer.
     */
    fun updatePlayerState() {
        val player = _exoPlayer ?: return

        _playerState.value = _playerState.value.copy(
            isPlaying = player.isPlaying,
            isBuffering = player.playbackState == Player.STATE_BUFFERING,
            isEnded = player.playbackState == Player.STATE_ENDED,
            currentPosition = player.currentPosition,
            duration = player.duration.coerceAtLeast(0),
            bufferedPosition = player.bufferedPosition
        )
    }

    private fun updateTrackInfo(tracks: Tracks) {
        val audioTracks = mutableListOf<AudioTrack>()
        val subtitleTracks = mutableListOf<SubtitleTrack>()
        val qualityLevels = mutableListOf<QualityLevel>()

        var audioIndex = 0
        var subtitleIndex = 0

        for (group in tracks.groups) {
            when (group.type) {
                C.TRACK_TYPE_AUDIO -> {
                    for (i in 0 until group.length) {
                        val format = group.getTrackFormat(i)
                        audioTracks.add(
                            AudioTrack(
                                index = audioIndex++,
                                language = format.language,
                                label = format.label ?: format.language ?: "Audio ${audioIndex}",
                                isSelected = group.isTrackSelected(i)
                            )
                        )
                    }
                }
                C.TRACK_TYPE_TEXT -> {
                    for (i in 0 until group.length) {
                        val format = group.getTrackFormat(i)
                        subtitleTracks.add(
                            SubtitleTrack(
                                index = subtitleIndex++,
                                language = format.language,
                                label = format.label ?: format.language ?: "Subtitle ${subtitleIndex}",
                                isSelected = group.isTrackSelected(i)
                            )
                        )
                    }
                }
                C.TRACK_TYPE_VIDEO -> {
                    for (i in 0 until group.length) {
                        val format = group.getTrackFormat(i)
                        val height = format.height
                        val label = when {
                            height >= 2160 -> "4K"
                            height >= 1440 -> "1440p"
                            height >= 1080 -> "1080p"
                            height >= 720 -> "720p"
                            height >= 480 -> "480p"
                            height >= 360 -> "360p"
                            else -> "${height}p"
                        }
                        qualityLevels.add(
                            QualityLevel(
                                index = i,
                                width = format.width,
                                height = format.height,
                                bitrate = format.bitrate,
                                label = label,
                                isSelected = group.isTrackSelected(i)
                            )
                        )
                    }
                }
            }
        }

        _playerState.value = _playerState.value.copy(
            audioTracks = audioTracks,
            subtitleTracks = subtitleTracks,
            qualityLevels = qualityLevels.sortedByDescending { it.height }
        )
    }

    /**
     * Stop playback.
     */
    fun stop() {
        _exoPlayer?.stop()
        _exoPlayer?.clearMediaItems()
    }

    /**
     * Release the player.
     */
    fun release() {
        _exoPlayer?.removeListener(playerListener)
        _exoPlayer?.release()
        _exoPlayer = null
        currentStream = null
        _playerState.value = PlayerState()
    }
}
