package com.nuvio.tv.ui.screens.player

import android.content.Context
import android.view.SurfaceView
import android.view.View
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.media3.exoplayer.ExoPlayer
import com.nuvio.tv.domain.model.Stream
import com.nuvio.tv.player.PlaybackRequest
import com.nuvio.tv.player.PlaybackStateHolder
import com.nuvio.tv.player.engine.EngineType
import com.nuvio.tv.player.engine.UnifiedPlayer
import com.nuvio.tv.player.engine.UnifiedPlayerEvent
import com.nuvio.tv.player.engine.UnifiedPlayerState
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * UI state for the Netflix-style player.
 */
data class PlayerUiState(
    val showControls: Boolean = true,
    val showSubtitlePanel: Boolean = false,
    val showAudioPanel: Boolean = false,
    val showQualityPanel: Boolean = false,
    val showSpeedPanel: Boolean = false,
    val showUpNext: Boolean = false,
    val upNextCountdown: Int = 10,
    val showPlaybackInfo: Boolean = false,
    val showEngineSwitchNotification: Boolean = false,
    val engineSwitchFrom: EngineType? = null,
    val engineSwitchTo: EngineType? = null,
    val engineSwitchReason: String? = null
)

/**
 * ViewModel for the unified Netflix-style player.
 * Manages the UnifiedPlayer and exposes state to the UI.
 */
@HiltViewModel
class UnifiedPlayerViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val unifiedPlayer: UnifiedPlayer,
    private val playbackStateHolder: PlaybackStateHolder
) : ViewModel() {

    val playerState: StateFlow<UnifiedPlayerState> = unifiedPlayer.state

    private val _uiState = MutableStateFlow(PlayerUiState())
    val uiState: StateFlow<PlayerUiState> = _uiState.asStateFlow()

    private var isInitialized = false
    private var currentStream: Stream? = null
    private var cachedPlaybackRequest: PlaybackRequest? = null

    init {
        observePlayerEvents()
    }

    /**
     * Get the playback request from the holder.
     * This consumes the request, so it should only be called once.
     */
    fun getPlaybackRequest(): PlaybackRequest? {
        if (cachedPlaybackRequest != null) {
            return cachedPlaybackRequest
        }
        cachedPlaybackRequest = playbackStateHolder.consumePlaybackRequest()
        return cachedPlaybackRequest
    }

    private fun observePlayerEvents() {
        viewModelScope.launch {
            unifiedPlayer.events.collect { event ->
                when (event) {
                    is UnifiedPlayerEvent.EngineSwitched -> {
                        _uiState.update {
                            it.copy(
                                showEngineSwitchNotification = true,
                                engineSwitchFrom = event.from,
                                engineSwitchTo = event.to,
                                engineSwitchReason = event.reason
                            )
                        }
                        // Hide notification after 3 seconds
                        kotlinx.coroutines.delay(3000)
                        _uiState.update { it.copy(showEngineSwitchNotification = false) }
                    }
                    is UnifiedPlayerEvent.EngineError -> {
                        // Error handling is done through playerState.engineState.error
                    }
                    is UnifiedPlayerEvent.Initialized -> {
                        isInitialized = true
                    }
                    is UnifiedPlayerEvent.Released -> {
                        isInitialized = false
                    }
                }
            }
        }
    }

    /**
     * Initialize the unified player.
     */
    fun initialize() {
        if (isInitialized) return
        unifiedPlayer.initialize(context)
    }

    /**
     * Play a stream.
     */
    fun playStream(stream: Stream, startPosition: Long = 0L) {
        currentStream = stream
        val headers = stream.headers ?: emptyMap()
        unifiedPlayer.playStream(stream, startPosition, headers)
    }

    /**
     * Play/Resume playback.
     */
    fun play() {
        unifiedPlayer.play()
    }

    /**
     * Pause playback.
     */
    fun pause() {
        unifiedPlayer.pause()
    }

    /**
     * Toggle play/pause.
     */
    fun togglePlayPause() {
        unifiedPlayer.togglePlayPause()
    }

    /**
     * Stop playback.
     */
    fun stop() {
        unifiedPlayer.stop()
    }

    /**
     * Seek to position.
     */
    fun seekTo(positionMs: Long) {
        unifiedPlayer.seekTo(positionMs)
    }

    /**
     * Seek forward.
     */
    fun seekForward(amountMs: Long = 10_000L) {
        unifiedPlayer.seekForward(amountMs)
    }

    /**
     * Seek backward.
     */
    fun seekBackward(amountMs: Long = 10_000L) {
        unifiedPlayer.seekBackward(amountMs)
    }

    /**
     * Set playback speed.
     */
    fun setPlaybackSpeed(speed: Float) {
        unifiedPlayer.setPlaybackSpeed(speed)
    }

    /**
     * Select audio track.
     */
    fun selectAudioTrack(index: Int) {
        unifiedPlayer.selectAudioTrack(index)
    }

    /**
     * Select subtitle track.
     */
    fun selectSubtitleTrack(index: Int) {
        unifiedPlayer.selectSubtitleTrack(index)
    }

    /**
     * Select quality level.
     */
    fun selectQualityLevel(index: Int) {
        unifiedPlayer.selectQualityLevel(index)
    }

    /**
     * Add external subtitle.
     */
    fun addExternalSubtitle(url: String, language: String, label: String? = null) {
        unifiedPlayer.addExternalSubtitle(url, language, label)
    }

    /**
     * Switch to a specific engine.
     */
    fun useEngine(engineType: EngineType) {
        unifiedPlayer.useEngine(engineType)
    }

    /**
     * Get the MPV surface view for rendering.
     */
    fun getMpvSurfaceView(): SurfaceView? {
        val view = unifiedPlayer.getMpvEngine().getVideoView()
        return view as? SurfaceView
    }

    /**
     * Get the ExoPlayer instance for PlayerView.
     */
    fun getExoPlayer(): ExoPlayer? {
        return unifiedPlayer.getExoPlayerEngine().getExoPlayer()
    }

    /**
     * Get the current active engine type.
     */
    fun getActiveEngineType(): EngineType {
        return unifiedPlayer.getActiveEngineType()
    }

    /**
     * Toggle playback info overlay.
     */
    fun togglePlaybackInfo() {
        _uiState.update { it.copy(showPlaybackInfo = !it.showPlaybackInfo) }
    }

    /**
     * Show controls.
     */
    fun showControls() {
        _uiState.update { it.copy(showControls = true) }
    }

    /**
     * Hide controls.
     */
    fun hideControls() {
        _uiState.update { it.copy(showControls = false) }
    }

    /**
     * Release all resources.
     */
    fun release() {
        unifiedPlayer.release()
        isInitialized = false
    }

    override fun onCleared() {
        super.onCleared()
        release()
    }
}
