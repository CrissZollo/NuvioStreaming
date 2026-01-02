package com.nuvio.tv.player.engine

import android.content.Context
import android.util.Log
import android.view.View
import com.nuvio.tv.domain.model.Stream
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Unified player state combining engine state with meta information.
 */
data class UnifiedPlayerState(
    val engineState: EnginePlayerState = EnginePlayerState(),
    val activeEngine: EngineType = EngineType.MPV,
    val isEngineInitialized: Boolean = false,
    val isFallbackActive: Boolean = false,
    val fallbackReason: String? = null
)

/**
 * Events specific to the unified player.
 */
sealed class UnifiedPlayerEvent {
    data class EngineSwitched(
        val from: EngineType,
        val to: EngineType,
        val reason: String
    ) : UnifiedPlayerEvent()

    data class EngineError(
        val engine: EngineType,
        val error: EngineEvent.Error,
        val willFallback: Boolean
    ) : UnifiedPlayerEvent()

    data object Initialized : UnifiedPlayerEvent()
    data object Released : UnifiedPlayerEvent()
}

/**
 * UnifiedPlayer orchestrates MPV and ExoPlayer engines with automatic fallback.
 *
 * Strategy:
 * 1. Try MPV first (primary engine - superior codec support)
 * 2. On fatal error, automatically switch to ExoPlayer
 * 3. Notify UI about engine switches
 */
@Singleton
class UnifiedPlayer @Inject constructor(
    private val mpvEngine: MpvEngine,
    private val exoPlayerEngine: ExoPlayerEngine
) {
    companion object {
        private const val TAG = "UnifiedPlayer"

        // Time to wait for playback to start before considering a failure
        private const val PLAYBACK_START_TIMEOUT_MS = 15_000L

        // Number of retries before fallback
        private const val MAX_RETRIES_BEFORE_FALLBACK = 2
    }

    private val playerScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    private val _state = MutableStateFlow(UnifiedPlayerState())
    val state: StateFlow<UnifiedPlayerState> = _state.asStateFlow()

    private val _events = MutableSharedFlow<UnifiedPlayerEvent>(replay = 1)
    val events: SharedFlow<UnifiedPlayerEvent> = _events.asSharedFlow()

    private var activeEngine: VideoEngine? = null
    private var currentStream: Stream? = null
    private var currentStartPosition: Long = 0L
    private var currentHeaders: Map<String, String> = emptyMap()
    private var retryCount = 0
    private var isInitialized = false
    private var context: Context? = null

    /**
     * Initialize the unified player with both engines.
     */
    fun initialize(context: Context) {
        if (isInitialized) {
            Log.w(TAG, "Already initialized")
            return
        }

        this.context = context.applicationContext
        Log.i(TAG, "Initializing UnifiedPlayer")

        // Initialize both engines
        mpvEngine.initialize(context)
        exoPlayerEngine.initialize(context)

        // Check MPV availability
        val mpvAvailable = try {
            mpvEngine.isAvailable()
        } catch (e: Exception) {
            Log.e(TAG, "MPV availability check failed", e)
            false
        }

        // Set active engine (prefer MPV)
        activeEngine = if (mpvAvailable) {
            Log.i(TAG, "Using MPV as primary engine")
            mpvEngine
        } else {
            Log.i(TAG, "MPV not available, using ExoPlayer")
            exoPlayerEngine
        }

        // Observe engine events
        observeEngineEvents()

        isInitialized = true
        _state.update {
            it.copy(
                activeEngine = activeEngine?.engineType ?: EngineType.EXOPLAYER,
                isEngineInitialized = true,
                isFallbackActive = !mpvAvailable
            )
        }

        playerScope.launch {
            _events.emit(UnifiedPlayerEvent.Initialized)
        }
    }

    private fun observeEngineEvents() {
        // Observe MPV events
        playerScope.launch {
            mpvEngine.engineEvents.collect { event ->
                if (activeEngine == mpvEngine) {
                    handleEngineEvent(mpvEngine, event)
                }
            }
        }

        // Observe MPV state
        playerScope.launch {
            mpvEngine.playerState.collect { engineState ->
                if (activeEngine == mpvEngine) {
                    _state.update { it.copy(engineState = engineState) }
                }
            }
        }

        // Observe ExoPlayer events
        playerScope.launch {
            exoPlayerEngine.engineEvents.collect { event ->
                if (activeEngine == exoPlayerEngine) {
                    handleEngineEvent(exoPlayerEngine, event)
                }
            }
        }

        // Observe ExoPlayer state
        playerScope.launch {
            exoPlayerEngine.playerState.collect { engineState ->
                if (activeEngine == exoPlayerEngine) {
                    _state.update { it.copy(engineState = engineState) }
                }
            }
        }
    }

    private suspend fun handleEngineEvent(engine: VideoEngine, event: EngineEvent?) {
        when (event) {
            is EngineEvent.Error -> {
                Log.e(TAG, "Engine error from ${engine.engineType}: ${event.message}")

                val shouldFallback = event.isFatal &&
                        engine == mpvEngine &&
                        exoPlayerEngine.isAvailable()

                _events.emit(
                    UnifiedPlayerEvent.EngineError(
                        engine = engine.engineType,
                        error = event,
                        willFallback = shouldFallback
                    )
                )

                if (shouldFallback) {
                    fallbackToExoPlayer(event.message)
                } else if (event.canRetry && retryCount < MAX_RETRIES_BEFORE_FALLBACK) {
                    retryCount++
                    Log.i(TAG, "Retrying playback (attempt $retryCount)")
                    delay(1000)
                    currentStream?.let { stream ->
                        engine.playStream(stream, _state.value.engineState.currentPosition, currentHeaders)
                    }
                } else if (engine == mpvEngine) {
                    // Max retries reached, fallback
                    fallbackToExoPlayer("Max retries exceeded: ${event.message}")
                }
            }
            else -> {
                // Other events don't require special handling
            }
        }
    }

    private suspend fun fallbackToExoPlayer(reason: String) {
        if (activeEngine == exoPlayerEngine) {
            Log.w(TAG, "Already using ExoPlayer, cannot fallback further")
            return
        }

        Log.i(TAG, "Falling back to ExoPlayer: $reason")

        // Stop MPV
        mpvEngine.stop()

        // Switch to ExoPlayer
        activeEngine = exoPlayerEngine

        _state.update {
            it.copy(
                activeEngine = EngineType.EXOPLAYER,
                isFallbackActive = true,
                fallbackReason = reason
            )
        }

        _events.emit(
            UnifiedPlayerEvent.EngineSwitched(
                from = EngineType.MPV,
                to = EngineType.EXOPLAYER,
                reason = reason
            )
        )

        // Resume playback on ExoPlayer
        currentStream?.let { stream ->
            val position = _state.value.engineState.currentPosition
            exoPlayerEngine.playStream(stream, position, currentHeaders)
        }

        retryCount = 0
    }

    /**
     * Get the video view from the active engine.
     */
    fun getVideoView(): View? {
        return activeEngine?.getVideoView()
    }

    /**
     * Get the current active engine type.
     */
    fun getActiveEngineType(): EngineType {
        return activeEngine?.engineType ?: EngineType.EXOPLAYER
    }

    /**
     * Play a stream using the active engine.
     */
    fun playStream(stream: Stream, startPosition: Long = 0L, headers: Map<String, String> = emptyMap()) {
        currentStream = stream
        currentStartPosition = startPosition
        currentHeaders = headers
        retryCount = 0

        Log.i(TAG, "Playing stream with ${activeEngine?.engineType}")
        activeEngine?.playStream(stream, startPosition, headers)
    }

    /**
     * Force use of a specific engine.
     */
    fun useEngine(engineType: EngineType) {
        val newEngine = when (engineType) {
            EngineType.MPV -> mpvEngine
            EngineType.EXOPLAYER -> exoPlayerEngine
        }

        if (activeEngine == newEngine) return

        val wasPlaying = _state.value.engineState.isPlaying
        val position = _state.value.engineState.currentPosition

        // Stop current engine
        activeEngine?.stop()

        // Switch engine
        activeEngine = newEngine

        _state.update {
            it.copy(
                activeEngine = engineType,
                isFallbackActive = engineType == EngineType.EXOPLAYER
            )
        }

        // Resume if was playing
        if (wasPlaying && currentStream != null) {
            newEngine.playStream(currentStream!!, position, currentHeaders)
        }

        playerScope.launch {
            _events.emit(
                UnifiedPlayerEvent.EngineSwitched(
                    from = if (engineType == EngineType.MPV) EngineType.EXOPLAYER else EngineType.MPV,
                    to = engineType,
                    reason = "User requested engine switch"
                )
            )
        }
    }

    // Delegate playback controls to active engine

    fun play() {
        activeEngine?.play()
    }

    fun pause() {
        activeEngine?.pause()
    }

    fun togglePlayPause() {
        activeEngine?.togglePlayPause()
    }

    fun stop() {
        activeEngine?.stop()
        currentStream = null
    }

    fun seekTo(positionMs: Long) {
        activeEngine?.seekTo(positionMs)
    }

    fun seekForward(amountMs: Long = 10_000L) {
        activeEngine?.seekForward(amountMs)
    }

    fun seekBackward(amountMs: Long = 10_000L) {
        activeEngine?.seekBackward(amountMs)
    }

    fun setPlaybackSpeed(speed: Float) {
        activeEngine?.setPlaybackSpeed(speed)
    }

    fun selectAudioTrack(trackIndex: Int) {
        activeEngine?.selectAudioTrack(trackIndex)
    }

    fun selectSubtitleTrack(trackIndex: Int) {
        activeEngine?.selectSubtitleTrack(trackIndex)
    }

    fun selectQualityLevel(levelIndex: Int) {
        activeEngine?.selectQualityLevel(levelIndex)
    }

    fun addExternalSubtitle(url: String, language: String, label: String? = null, mimeType: String? = null) {
        activeEngine?.addExternalSubtitle(url, language, label, mimeType)
    }

    fun updateState() {
        activeEngine?.updateState()
    }

    fun getProgressPercent(): Float {
        return activeEngine?.getProgressPercent() ?: 0f
    }

    /**
     * Release all resources.
     */
    fun release() {
        Log.i(TAG, "Releasing UnifiedPlayer")

        playerScope.cancel()

        mpvEngine.release()
        exoPlayerEngine.release()

        activeEngine = null
        currentStream = null
        isInitialized = false
        context = null

        _state.update { UnifiedPlayerState() }

        // Note: Can't emit after scope is cancelled
    }

    /**
     * Check if any engine is available.
     */
    fun isAvailable(): Boolean {
        return mpvEngine.isAvailable() || exoPlayerEngine.isAvailable()
    }

    /**
     * Get the MPV engine for direct access (e.g., for SurfaceView).
     */
    fun getMpvEngine(): MpvEngine = mpvEngine

    /**
     * Get the ExoPlayer engine for direct access (e.g., for PlayerView).
     */
    fun getExoPlayerEngine(): ExoPlayerEngine = exoPlayerEngine
}
