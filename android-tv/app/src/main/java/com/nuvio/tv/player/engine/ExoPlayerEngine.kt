package com.nuvio.tv.player.engine

import android.content.Context
import android.util.Log
import android.view.View
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.common.Tracks
import androidx.media3.common.VideoSize
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.hls.HlsMediaSource
import androidx.media3.exoplayer.source.MediaSource
import androidx.media3.exoplayer.source.ProgressiveMediaSource
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector
import androidx.media3.ui.PlayerView
import com.nuvio.tv.domain.model.Stream
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

/**
 * ExoPlayer-based video engine implementation.
 * Fallback video engine with reliable Android platform support.
 */
@Singleton
class ExoPlayerEngine @Inject constructor() : VideoEngine {

    companion object {
        private const val TAG = "ExoPlayerEngine"
        private const val STATE_UPDATE_INTERVAL_MS = 500L
    }

    override val engineType: EngineType = EngineType.EXOPLAYER

    private val _playerState = MutableStateFlow(EnginePlayerState())
    override val playerState: StateFlow<EnginePlayerState> = _playerState.asStateFlow()

    private val _engineEvents = MutableStateFlow<EngineEvent?>(null)
    override val engineEvents: StateFlow<EngineEvent?> = _engineEvents.asStateFlow()

    private var context: Context? = null
    private var exoPlayer: ExoPlayer? = null
    private var playerView: PlayerView? = null
    private var trackSelector: DefaultTrackSelector? = null
    private var currentStream: Stream? = null
    private var isInitialized = false

    private val engineScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var stateUpdateJob: kotlinx.coroutines.Job? = null

    private val playerListener = object : Player.Listener {
        override fun onPlaybackStateChanged(playbackState: Int) {
            updateState()
            when (playbackState) {
                Player.STATE_READY -> {
                    if (exoPlayer?.isPlaying == true) {
                        _engineEvents.value = EngineEvent.PlaybackStarted(_playerState.value.currentPosition)
                    }
                }
                Player.STATE_ENDED -> {
                    _engineEvents.value = EngineEvent.PlaybackEnded
                }
                Player.STATE_BUFFERING -> {
                    _engineEvents.value = EngineEvent.BufferingStarted(_playerState.value.bufferedPercent)
                }
            }
        }

        override fun onIsPlayingChanged(isPlaying: Boolean) {
            updateState()
            if (isPlaying) {
                _engineEvents.value = EngineEvent.PlaybackResumed
            } else if (_playerState.value.isPaused) {
                _engineEvents.value = EngineEvent.PlaybackPaused
            }
        }

        override fun onTracksChanged(tracks: Tracks) {
            updateTrackInfo(tracks)
            _engineEvents.value = EngineEvent.TracksChanged(
                audioCount = _playerState.value.audioTracks.size,
                subtitleCount = _playerState.value.subtitleTracks.size,
                qualityCount = _playerState.value.qualityLevels.size
            )
        }

        override fun onPlayerError(error: PlaybackException) {
            Log.e(TAG, "Player error: ${error.message}", error)
            val errorCode = when (error.errorCode) {
                PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_FAILED,
                PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_TIMEOUT -> EngineErrorCodes.NETWORK_ERROR
                PlaybackException.ERROR_CODE_DECODER_INIT_FAILED,
                PlaybackException.ERROR_CODE_DECODER_QUERY_FAILED -> EngineErrorCodes.CODEC_ERROR
                PlaybackException.ERROR_CODE_DRM_LICENSE_ACQUISITION_FAILED,
                PlaybackException.ERROR_CODE_DRM_SCHEME_UNSUPPORTED -> EngineErrorCodes.DRM_ERROR
                else -> EngineErrorCodes.UNKNOWN
            }
            _engineEvents.value = EngineEvent.Error(
                code = errorCode,
                message = error.message ?: "Playback error",
                isFatal = true,
                canRetry = true
            )
            _playerState.update { it.copy(error = error.message) }
        }

        override fun onPlaybackParametersChanged(playbackParameters: androidx.media3.common.PlaybackParameters) {
            _playerState.update { it.copy(playbackSpeed = playbackParameters.speed) }
        }

        override fun onVideoSizeChanged(videoSize: VideoSize) {
            _engineEvents.value = EngineEvent.VideoSizeChanged(videoSize.width, videoSize.height)
            _playerState.update {
                it.copy(
                    currentResolution = if (videoSize.width > 0 && videoSize.height > 0) {
                        "${videoSize.width}x${videoSize.height}"
                    } else ""
                )
            }
        }

        override fun onPositionDiscontinuity(
            oldPosition: Player.PositionInfo,
            newPosition: Player.PositionInfo,
            reason: Int
        ) {
            if (reason == Player.DISCONTINUITY_REASON_SEEK) {
                _engineEvents.value = EngineEvent.SeekCompleted(newPosition.positionMs)
            }
        }
    }

    override fun initialize(context: Context) {
        if (isInitialized) {
            Log.w(TAG, "Already initialized")
            return
        }

        this.context = context.applicationContext

        try {
            trackSelector = DefaultTrackSelector(context.applicationContext).apply {
                setParameters(
                    buildUponParameters()
                        .setPreferredAudioLanguage("en")
                        .setPreferredTextLanguage("en")
                )
            }

            exoPlayer = ExoPlayer.Builder(context.applicationContext)
                .setTrackSelector(trackSelector!!)
                .build()
                .apply {
                    addListener(playerListener)
                    playWhenReady = true
                }

            isInitialized = true
            Log.i(TAG, "ExoPlayer engine initialized successfully")

        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize ExoPlayer engine", e)
            _engineEvents.value = EngineEvent.Error(
                code = EngineErrorCodes.UNKNOWN,
                message = "Failed to initialize ExoPlayer: ${e.message}",
                isFatal = true,
                canRetry = false
            )
        }
    }

    override fun isAvailable(): Boolean {
        return isInitialized && exoPlayer != null
    }

    override fun getVideoView(): View? {
        if (playerView == null && context != null) {
            createPlayerView()
        }
        return playerView
    }

    private fun createPlayerView() {
        val ctx = context ?: return
        val player = exoPlayer ?: return

        playerView = PlayerView(ctx).apply {
            this.player = player
            useController = false
            setShowBuffering(PlayerView.SHOW_BUFFERING_NEVER)
        }
    }

    override fun playStream(stream: Stream, startPosition: Long, headers: Map<String, String>) {
        val player = exoPlayer ?: run {
            Log.e(TAG, "Engine not initialized")
            _engineEvents.value = EngineEvent.Error(
                code = EngineErrorCodes.UNKNOWN,
                message = "Engine not initialized",
                isFatal = true,
                canRetry = true
            )
            return
        }

        currentStream = stream
        val url = stream.url ?: stream.externalUrl ?: return

        Log.i(TAG, "Playing stream: $url")

        // Merge stream headers with provided headers
        val allHeaders = (stream.headers ?: emptyMap()) + headers

        // Create data source factory with headers
        val dataSourceFactory = DefaultHttpDataSource.Factory()
            .setDefaultRequestProperties(allHeaders)
            .setConnectTimeoutMs(30_000)
            .setReadTimeoutMs(30_000)
            .setAllowCrossProtocolRedirects(true)

        // Create appropriate media source
        val mediaSource = createMediaSource(url, dataSourceFactory)

        try {
            player.setMediaSource(mediaSource)
            player.prepare()

            if (startPosition > 0) {
                player.seekTo(startPosition)
            }

            _playerState.update {
                it.copy(
                    isBuffering = true,
                    isPlaying = false,
                    isPaused = false,
                    isEnded = false,
                    error = null
                )
            }

            // Start state update polling
            startStateUpdates()

        } catch (e: Exception) {
            Log.e(TAG, "Failed to play stream", e)
            _engineEvents.value = EngineEvent.Error(
                code = EngineErrorCodes.SOURCE_ERROR,
                message = "Failed to load stream: ${e.message}",
                isFatal = false,
                canRetry = true
            )
        }
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

    override fun play() {
        exoPlayer?.play()
    }

    override fun pause() {
        exoPlayer?.pause()
    }

    override fun togglePlayPause() {
        exoPlayer?.let { player ->
            if (player.isPlaying) {
                player.pause()
            } else {
                player.play()
            }
        }
    }

    override fun stop() {
        exoPlayer?.stop()
        exoPlayer?.clearMediaItems()
        stopStateUpdates()
        _playerState.update { EnginePlayerState() }
    }

    override fun seekTo(positionMs: Long) {
        exoPlayer?.let { player ->
            player.seekTo(positionMs.coerceIn(0, player.duration.coerceAtLeast(0)))
        }
    }

    override fun seekForward(amountMs: Long) {
        exoPlayer?.let { player ->
            val newPosition = (player.currentPosition + amountMs).coerceAtMost(player.duration)
            player.seekTo(newPosition)
        }
    }

    override fun seekBackward(amountMs: Long) {
        exoPlayer?.let { player ->
            val newPosition = (player.currentPosition - amountMs).coerceAtLeast(0)
            player.seekTo(newPosition)
        }
    }

    override fun setPlaybackSpeed(speed: Float) {
        exoPlayer?.setPlaybackSpeed(speed.coerceIn(0.25f, 2f))
    }

    override fun selectAudioTrack(trackIndex: Int) {
        val player = exoPlayer ?: return
        val selector = trackSelector ?: return

        if (trackIndex < 0) {
            selector.setParameters(
                selector.buildUponParameters()
                    .clearOverridesOfType(C.TRACK_TYPE_AUDIO)
            )
            _playerState.update { it.copy(selectedAudioTrack = -1) }
            return
        }

        val tracks = player.currentTracks
        val audioGroups = tracks.groups.filter { it.type == C.TRACK_TYPE_AUDIO }

        if (trackIndex < audioGroups.size) {
            val group = audioGroups[trackIndex]
            val override = TrackSelectionOverride(group.mediaTrackGroup, 0)

            selector.setParameters(
                selector.buildUponParameters()
                    .setOverrideForType(override)
            )

            _playerState.update { it.copy(selectedAudioTrack = trackIndex) }
            updateTrackInfo(player.currentTracks)
        }
    }

    override fun selectSubtitleTrack(trackIndex: Int) {
        val player = exoPlayer ?: return
        val selector = trackSelector ?: return

        if (trackIndex < 0) {
            selector.setParameters(
                selector.buildUponParameters()
                    .setRendererDisabled(C.TRACK_TYPE_TEXT, true)
            )
            _playerState.update { it.copy(selectedSubtitleTrack = -1) }
            return
        }

        val tracks = player.currentTracks
        val textGroups = tracks.groups.filter { it.type == C.TRACK_TYPE_TEXT }

        if (trackIndex < textGroups.size) {
            val group = textGroups[trackIndex]
            val override = TrackSelectionOverride(group.mediaTrackGroup, 0)

            selector.setParameters(
                selector.buildUponParameters()
                    .setRendererDisabled(C.TRACK_TYPE_TEXT, false)
                    .setOverrideForType(override)
            )

            _playerState.update { it.copy(selectedSubtitleTrack = trackIndex) }
            updateTrackInfo(player.currentTracks)
        }
    }

    override fun selectQualityLevel(levelIndex: Int) {
        val player = exoPlayer ?: return
        val selector = trackSelector ?: return

        if (levelIndex < 0) {
            selector.setParameters(
                selector.buildUponParameters()
                    .clearOverridesOfType(C.TRACK_TYPE_VIDEO)
            )
            _playerState.update { it.copy(selectedQualityLevel = -1) }
            return
        }

        val tracks = player.currentTracks
        val videoGroups = tracks.groups.filter { it.type == C.TRACK_TYPE_VIDEO }

        if (videoGroups.isNotEmpty()) {
            val group = videoGroups[0]
            if (levelIndex < group.length) {
                val override = TrackSelectionOverride(group.mediaTrackGroup, levelIndex)

                selector.setParameters(
                    selector.buildUponParameters()
                        .setOverrideForType(override)
                )

                _playerState.update { it.copy(selectedQualityLevel = levelIndex) }
            }
        }
    }

    override fun addExternalSubtitle(url: String, language: String, label: String?, mimeType: String?) {
        val player = exoPlayer ?: return
        val currentItem = player.currentMediaItem ?: return

        val subtitle = MediaItem.SubtitleConfiguration.Builder(android.net.Uri.parse(url))
            .setMimeType(mimeType ?: MimeTypes.TEXT_VTT)
            .setLanguage(language)
            .setLabel(label ?: language)
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

    override fun updateState() {
        val player = exoPlayer ?: return

        val bufferedPercent = if (player.duration > 0) {
            (player.bufferedPosition.toFloat() / player.duration * 100).toInt().coerceIn(0, 100)
        } else 0

        _playerState.update { current ->
            current.copy(
                isPlaying = player.isPlaying,
                isBuffering = player.playbackState == Player.STATE_BUFFERING,
                isPaused = !player.isPlaying && player.playbackState == Player.STATE_READY,
                isEnded = player.playbackState == Player.STATE_ENDED,
                currentPosition = player.currentPosition,
                duration = player.duration.coerceAtLeast(0),
                bufferedPosition = player.bufferedPosition,
                bufferedPercent = bufferedPercent
            )
        }
    }

    override fun getProgressPercent(): Float {
        val player = exoPlayer ?: return 0f
        val duration = player.duration
        if (duration <= 0) return 0f
        return (player.currentPosition.toFloat() / duration.toFloat()).coerceIn(0f, 1f)
    }

    override fun release() {
        Log.i(TAG, "Releasing ExoPlayer engine")

        stopStateUpdates()
        engineScope.cancel()

        exoPlayer?.removeListener(playerListener)
        exoPlayer?.release()
        exoPlayer = null

        playerView?.player = null
        playerView = null

        trackSelector = null
        context = null
        currentStream = null
        isInitialized = false
    }

    private fun startStateUpdates() {
        stateUpdateJob?.cancel()
        stateUpdateJob = engineScope.launch {
            while (true) {
                updateState()
                delay(STATE_UPDATE_INTERVAL_MS)
            }
        }
    }

    private fun stopStateUpdates() {
        stateUpdateJob?.cancel()
        stateUpdateJob = null
    }

    private fun updateTrackInfo(tracks: Tracks) {
        val audioTracks = mutableListOf<EngineAudioTrack>()
        val subtitleTracks = mutableListOf<EngineSubtitleTrack>()
        val qualityLevels = mutableListOf<EngineQualityLevel>()

        var audioIndex = 0
        var subtitleIndex = 0
        var selectedAudioIndex = -1
        var selectedSubtitleIndex = -1
        var selectedQualityIndex = -1

        for (group in tracks.groups) {
            when (group.type) {
                C.TRACK_TYPE_AUDIO -> {
                    for (i in 0 until group.length) {
                        val format = group.getTrackFormat(i)
                        val isSelected = group.isTrackSelected(i)
                        if (isSelected) selectedAudioIndex = audioIndex

                        audioTracks.add(
                            EngineAudioTrack(
                                index = audioIndex++,
                                id = format.id,
                                language = format.language,
                                label = format.label ?: format.language ?: "Audio $audioIndex",
                                codec = format.codecs,
                                channels = format.channelCount,
                                sampleRate = format.sampleRate,
                                isSelected = isSelected,
                                isDefault = (format.selectionFlags and C.SELECTION_FLAG_DEFAULT) != 0
                            )
                        )
                    }
                }
                C.TRACK_TYPE_TEXT -> {
                    for (i in 0 until group.length) {
                        val format = group.getTrackFormat(i)
                        val isSelected = group.isTrackSelected(i)
                        if (isSelected) selectedSubtitleIndex = subtitleIndex

                        subtitleTracks.add(
                            EngineSubtitleTrack(
                                index = subtitleIndex++,
                                id = format.id,
                                language = format.language,
                                label = format.label ?: format.language ?: "Subtitle $subtitleIndex",
                                codec = format.codecs,
                                isExternal = false,
                                isSelected = isSelected,
                                isDefault = (format.selectionFlags and C.SELECTION_FLAG_DEFAULT) != 0
                            )
                        )
                    }
                }
                C.TRACK_TYPE_VIDEO -> {
                    for (i in 0 until group.length) {
                        val format = group.getTrackFormat(i)
                        val isSelected = group.isTrackSelected(i)
                        if (isSelected) selectedQualityIndex = i

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
                            EngineQualityLevel(
                                index = i,
                                width = format.width,
                                height = format.height,
                                bitrate = format.bitrate,
                                label = label,
                                codec = format.codecs,
                                isSelected = isSelected
                            )
                        )
                    }
                }
            }
        }

        // Get current codec info
        val player = exoPlayer
        val videoFormat = player?.videoFormat
        val currentCodec = videoFormat?.codecs ?: ""
        val currentBitrate = videoFormat?.bitrate ?: 0

        _playerState.update { current ->
            current.copy(
                audioTracks = audioTracks,
                subtitleTracks = subtitleTracks,
                qualityLevels = qualityLevels.sortedByDescending { it.height },
                selectedAudioTrack = selectedAudioIndex,
                selectedSubtitleTrack = selectedSubtitleIndex,
                selectedQualityLevel = selectedQualityIndex,
                currentCodec = currentCodec,
                currentBitrate = currentBitrate,
                decoderType = "HW" // ExoPlayer uses hardware by default when available
            )
        }
    }

    /**
     * Get the underlying ExoPlayer instance for PlayerView integration.
     */
    fun getExoPlayer(): ExoPlayer? = exoPlayer
}
