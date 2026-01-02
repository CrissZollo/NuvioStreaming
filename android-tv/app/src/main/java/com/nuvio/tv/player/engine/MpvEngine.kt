package com.nuvio.tv.player.engine

import android.content.Context
import android.util.Log
import android.view.Surface
import android.view.SurfaceHolder
import android.view.SurfaceView
import android.view.View
import com.nuvio.tv.domain.model.Stream
import dev.jdtech.mpv.MPVLib
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
 * MPV-based video engine implementation.
 * Primary video engine with hardware acceleration and wide codec support.
 */
@Singleton
class MpvEngine @Inject constructor() : VideoEngine, MPVLib.EventObserver, MPVLib.LogObserver {

    companion object {
        private const val TAG = "MpvEngine"

        // Update interval for position/duration
        private const val STATE_UPDATE_INTERVAL_MS = 500L

        // Timeout for playback start
        private const val PLAYBACK_START_TIMEOUT_MS = 30_000L
    }

    override val engineType: EngineType = EngineType.MPV

    private val _playerState = MutableStateFlow(EnginePlayerState())
    override val playerState: StateFlow<EnginePlayerState> = _playerState.asStateFlow()

    private val _engineEvents = MutableStateFlow<EngineEvent?>(null)
    override val engineEvents: StateFlow<EngineEvent?> = _engineEvents.asStateFlow()

    private var context: Context? = null
    private var surfaceView: SurfaceView? = null
    private var surface: Surface? = null
    private var isInitialized = false
    private var isSurfaceAttached = false
    private var currentStream: Stream? = null

    private val engineScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var stateUpdateJob: kotlinx.coroutines.Job? = null

    // Observed properties with format constants
    private val observedProperties: List<Pair<String, Int>> = listOf(
        "pause" to MPVLib.MPV_FORMAT_FLAG,
        "time-pos" to MPVLib.MPV_FORMAT_INT64,
        "duration" to MPVLib.MPV_FORMAT_INT64,
        "demuxer-cache-time" to MPVLib.MPV_FORMAT_INT64,
        "speed" to MPVLib.MPV_FORMAT_DOUBLE,
        "paused-for-cache" to MPVLib.MPV_FORMAT_FLAG,
        "eof-reached" to MPVLib.MPV_FORMAT_FLAG,
        "track-list/count" to MPVLib.MPV_FORMAT_INT64,
        "video-codec" to MPVLib.MPV_FORMAT_STRING,
        "audio-codec-name" to MPVLib.MPV_FORMAT_STRING,
        "video-bitrate" to MPVLib.MPV_FORMAT_INT64,
        "video-params/w" to MPVLib.MPV_FORMAT_INT64,
        "video-params/h" to MPVLib.MPV_FORMAT_INT64,
        "hwdec-current" to MPVLib.MPV_FORMAT_STRING
    )

    override fun initialize(context: Context) {
        if (isInitialized) {
            Log.w(TAG, "Already initialized")
            return
        }

        this.context = context.applicationContext

        try {
            // Create MPV instance
            MPVLib.create(context.applicationContext)

            // Configure MPV options
            configureOptions()

            // Initialize MPV
            MPVLib.init()

            // Add observers
            MPVLib.addObserver(this)
            MPVLib.addLogObserver(this)

            // Observe properties
            observedProperties.forEach { pair ->
                MPVLib.observeProperty(pair.first, pair.second)
            }

            isInitialized = true
            Log.i(TAG, "MPV engine initialized successfully")

        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize MPV engine", e)
            _engineEvents.value = EngineEvent.Error(
                code = EngineErrorCodes.UNKNOWN,
                message = "Failed to initialize MPV: ${e.message}",
                isFatal = true,
                canRetry = false
            )
        }
    }

    private fun configureOptions() {
        // Video output
        MPVLib.setOptionString("vo", "gpu")
        MPVLib.setOptionString("gpu-context", "android")

        // Hardware decoding - prefer hardware, fallback to software
        MPVLib.setOptionString("hwdec", "auto-safe")

        // Cache settings for streaming
        MPVLib.setOptionString("cache", "yes")
        MPVLib.setOptionString("demuxer-max-bytes", "50MiB")
        MPVLib.setOptionString("demuxer-max-back-bytes", "25MiB")
        MPVLib.setOptionString("cache-secs", "120")

        // Network settings
        MPVLib.setOptionString("network-timeout", "60")
        MPVLib.setOptionString("stream-lavf-o", "reconnect=1,reconnect_streamed=1,reconnect_delay_max=5")

        // Audio
        MPVLib.setOptionString("ao", "audiotrack")
        MPVLib.setOptionString("audio-channels", "stereo")

        // Subtitles
        MPVLib.setOptionString("sub-auto", "fuzzy")
        MPVLib.setOptionString("sub-scale", "1.0")
        MPVLib.setOptionString("sub-font-size", "48")

        // Performance
        MPVLib.setOptionString("video-sync", "audio")
        MPVLib.setOptionString("interpolation", "no")

        // Seeking
        MPVLib.setOptionString("hr-seek", "yes")
        MPVLib.setOptionString("hr-seek-framedrop", "yes")

        // Keep open for seamless playback
        MPVLib.setOptionString("keep-open", "yes")
        MPVLib.setOptionString("keep-open-pause", "no")

        Log.d(TAG, "MPV options configured")
    }

    override fun isAvailable(): Boolean {
        return try {
            // Check if native library is loaded
            isInitialized
        } catch (e: UnsatisfiedLinkError) {
            Log.e(TAG, "MPV native library not available", e)
            false
        }
    }

    override fun getVideoView(): View? {
        if (surfaceView == null && context != null) {
            createSurfaceView()
        }
        return surfaceView
    }

    private fun createSurfaceView() {
        val ctx = context ?: return

        surfaceView = SurfaceView(ctx).apply {
            holder.addCallback(object : SurfaceHolder.Callback {
                override fun surfaceCreated(holder: SurfaceHolder) {
                    Log.d(TAG, "Surface created")
                    surface = holder.surface
                    attachSurface()
                }

                override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
                    Log.d(TAG, "Surface changed: ${width}x${height}")
                    MPVLib.setPropertyString("android-surface-size", "${width}x${height}")
                }

                override fun surfaceDestroyed(holder: SurfaceHolder) {
                    Log.d(TAG, "Surface destroyed")
                    detachSurface()
                    surface = null
                }
            })
        }
    }

    private fun attachSurface() {
        val s = surface ?: return
        if (!isInitialized) return

        try {
            MPVLib.attachSurface(s)
            isSurfaceAttached = true
            Log.d(TAG, "Surface attached")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to attach surface", e)
        }
    }

    private fun detachSurface() {
        if (!isSurfaceAttached) return

        try {
            MPVLib.detachSurface()
            isSurfaceAttached = false
            Log.d(TAG, "Surface detached")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to detach surface", e)
        }
    }

    override fun playStream(stream: Stream, startPosition: Long, headers: Map<String, String>) {
        if (!isInitialized) {
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

        // Set HTTP headers if provided
        if (headers.isNotEmpty()) {
            val headerString = headers.entries.joinToString(",") { "${it.key}: ${it.value}" }
            MPVLib.setOptionString("http-header-fields", headerString)
        }

        // Load the file
        val loadCommand = if (startPosition > 0) {
            arrayOf("loadfile", url, "replace", "start=${startPosition / 1000.0}")
        } else {
            arrayOf("loadfile", url, "replace")
        }

        try {
            MPVLib.command(loadCommand)

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

            // Set playback start timeout
            engineScope.launch {
                delay(PLAYBACK_START_TIMEOUT_MS)
                if (_playerState.value.isBuffering && !_playerState.value.isPlaying) {
                    _engineEvents.value = EngineEvent.Error(
                        code = EngineErrorCodes.TIMEOUT,
                        message = "Playback start timeout",
                        isFatal = false,
                        canRetry = true
                    )
                }
            }

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

    override fun play() {
        if (!isInitialized) return
        try {
            MPVLib.setPropertyBoolean("pause", false)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to play", e)
        }
    }

    override fun pause() {
        if (!isInitialized) return
        try {
            MPVLib.setPropertyBoolean("pause", true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to pause", e)
        }
    }

    override fun togglePlayPause() {
        if (_playerState.value.isPlaying) {
            pause()
        } else {
            play()
        }
    }

    override fun stop() {
        if (!isInitialized) return
        try {
            MPVLib.command(arrayOf("stop"))
            stopStateUpdates()
            _playerState.update {
                EnginePlayerState()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop", e)
        }
    }

    override fun seekTo(positionMs: Long) {
        if (!isInitialized) return
        try {
            val positionSec = positionMs / 1000.0
            MPVLib.command(arrayOf("seek", positionSec.toString(), "absolute"))
        } catch (e: Exception) {
            Log.e(TAG, "Failed to seek", e)
        }
    }

    override fun seekForward(amountMs: Long) {
        if (!isInitialized) return
        try {
            val amountSec = amountMs / 1000.0
            MPVLib.command(arrayOf("seek", amountSec.toString(), "relative"))
        } catch (e: Exception) {
            Log.e(TAG, "Failed to seek forward", e)
        }
    }

    override fun seekBackward(amountMs: Long) {
        if (!isInitialized) return
        try {
            val amountSec = -(amountMs / 1000.0)
            MPVLib.command(arrayOf("seek", amountSec.toString(), "relative"))
        } catch (e: Exception) {
            Log.e(TAG, "Failed to seek backward", e)
        }
    }

    override fun setPlaybackSpeed(speed: Float) {
        if (!isInitialized) return
        try {
            MPVLib.setPropertyDouble("speed", speed.toDouble())
        } catch (e: Exception) {
            Log.e(TAG, "Failed to set playback speed", e)
        }
    }

    override fun selectAudioTrack(trackIndex: Int) {
        if (!isInitialized) return
        try {
            val tracks = getAudioTracks()
            if (trackIndex >= 0 && trackIndex < tracks.size) {
                val trackId = tracks[trackIndex].id ?: (trackIndex + 1).toString()
                MPVLib.setPropertyString("aid", trackId)
                Log.d(TAG, "Selected audio track: $trackId")
            } else if (trackIndex == -1) {
                // Auto selection
                MPVLib.setPropertyString("aid", "auto")
            }
            updateTracks()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to select audio track", e)
        }
    }

    override fun selectSubtitleTrack(trackIndex: Int) {
        if (!isInitialized) return
        try {
            if (trackIndex == -1) {
                // Disable subtitles
                MPVLib.setPropertyString("sid", "no")
            } else {
                val tracks = getSubtitleTracks()
                if (trackIndex >= 0 && trackIndex < tracks.size) {
                    val trackId = tracks[trackIndex].id ?: (trackIndex + 1).toString()
                    MPVLib.setPropertyString("sid", trackId)
                    Log.d(TAG, "Selected subtitle track: $trackId")
                }
            }
            updateTracks()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to select subtitle track", e)
        }
    }

    override fun selectQualityLevel(levelIndex: Int) {
        // MPV handles adaptive streaming quality automatically
        // For manual override, we could adjust video-bitrate or similar
        Log.d(TAG, "Quality level selection not directly supported in MPV - uses auto adaptation")
    }

    override fun addExternalSubtitle(url: String, language: String, label: String?, mimeType: String?) {
        if (!isInitialized) return
        try {
            // Add external subtitle file
            MPVLib.command(arrayOf("sub-add", url, "auto", label ?: language, language))
            Log.d(TAG, "Added external subtitle: $url")
            updateTracks()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to add external subtitle", e)
        }
    }

    override fun updateState() {
        if (!isInitialized) return

        try {
            val position = (MPVLib.getPropertyDouble("time-pos") ?: 0.0) * 1000
            val duration = (MPVLib.getPropertyDouble("duration") ?: 0.0) * 1000
            val bufferedTime = (MPVLib.getPropertyDouble("demuxer-cache-time") ?: 0.0) * 1000
            val isPaused = MPVLib.getPropertyBoolean("pause") ?: false
            val isBuffering = MPVLib.getPropertyBoolean("paused-for-cache") ?: false
            val eofReached = MPVLib.getPropertyBoolean("eof-reached") ?: false
            val speed = MPVLib.getPropertyDouble("speed")?.toFloat() ?: 1f

            // Get playback info
            val videoCodec = MPVLib.getPropertyString("video-codec") ?: ""
            val videoBitrate = MPVLib.getPropertyInt("video-bitrate") ?: 0
            val videoWidth = MPVLib.getPropertyInt("video-params/w") ?: 0
            val videoHeight = MPVLib.getPropertyInt("video-params/h") ?: 0
            val hwdec = MPVLib.getPropertyString("hwdec-current") ?: ""

            val bufferedPercent = if (duration > 0) {
                ((position + bufferedTime) / duration * 100).toInt().coerceIn(0, 100)
            } else 0

            _playerState.update { current ->
                current.copy(
                    isPlaying = !isPaused && !isBuffering && !eofReached,
                    isBuffering = isBuffering,
                    isPaused = isPaused,
                    isEnded = eofReached,
                    currentPosition = position.toLong(),
                    duration = duration.toLong(),
                    bufferedPosition = (position + bufferedTime).toLong(),
                    bufferedPercent = bufferedPercent,
                    playbackSpeed = speed,
                    currentBitrate = videoBitrate,
                    currentResolution = if (videoWidth > 0 && videoHeight > 0) "${videoWidth}x${videoHeight}" else "",
                    currentCodec = videoCodec,
                    decoderType = if (hwdec.isNotEmpty() && hwdec != "no") "HW" else "SW"
                )
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to update state", e)
        }
    }

    override fun getProgressPercent(): Float {
        val state = _playerState.value
        return if (state.duration > 0) {
            state.currentPosition.toFloat() / state.duration.toFloat()
        } else 0f
    }

    override fun release() {
        Log.i(TAG, "Releasing MPV engine")

        stopStateUpdates()
        engineScope.cancel()

        if (isInitialized) {
            try {
                MPVLib.removeObserver(this)
                MPVLib.removeLogObserver(this)
                detachSurface()
                MPVLib.destroy()
            } catch (e: Exception) {
                Log.e(TAG, "Error releasing MPV", e)
            }
        }

        surfaceView = null
        surface = null
        context = null
        isInitialized = false
        currentStream = null
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

    // Track management
    private fun getAudioTracks(): List<EngineAudioTrack> {
        val tracks = mutableListOf<EngineAudioTrack>()
        try {
            val trackCount = MPVLib.getPropertyInt("track-list/count") ?: 0
            var audioIndex = 0

            for (i in 0 until trackCount) {
                val type = MPVLib.getPropertyString("track-list/$i/type")
                if (type == "audio") {
                    val id = MPVLib.getPropertyString("track-list/$i/id")
                    val lang = MPVLib.getPropertyString("track-list/$i/lang")
                    val title = MPVLib.getPropertyString("track-list/$i/title")
                    val codec = MPVLib.getPropertyString("track-list/$i/codec")
                    val selected = MPVLib.getPropertyBoolean("track-list/$i/selected") ?: false
                    val isDefault = MPVLib.getPropertyBoolean("track-list/$i/default") ?: false
                    val channels = MPVLib.getPropertyInt("track-list/$i/audio-channels") ?: 0

                    tracks.add(
                        EngineAudioTrack(
                            index = audioIndex++,
                            id = id,
                            language = lang,
                            label = title ?: lang,
                            codec = codec,
                            channels = channels,
                            isSelected = selected,
                            isDefault = isDefault
                        )
                    )
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get audio tracks", e)
        }
        return tracks
    }

    private fun getSubtitleTracks(): List<EngineSubtitleTrack> {
        val tracks = mutableListOf<EngineSubtitleTrack>()
        try {
            val trackCount = MPVLib.getPropertyInt("track-list/count") ?: 0
            var subIndex = 0

            for (i in 0 until trackCount) {
                val type = MPVLib.getPropertyString("track-list/$i/type")
                if (type == "sub") {
                    val id = MPVLib.getPropertyString("track-list/$i/id")
                    val lang = MPVLib.getPropertyString("track-list/$i/lang")
                    val title = MPVLib.getPropertyString("track-list/$i/title")
                    val codec = MPVLib.getPropertyString("track-list/$i/codec")
                    val selected = MPVLib.getPropertyBoolean("track-list/$i/selected") ?: false
                    val isDefault = MPVLib.getPropertyBoolean("track-list/$i/default") ?: false
                    val external = MPVLib.getPropertyBoolean("track-list/$i/external") ?: false

                    tracks.add(
                        EngineSubtitleTrack(
                            index = subIndex++,
                            id = id,
                            language = lang,
                            label = title ?: lang,
                            codec = codec,
                            isExternal = external,
                            isSelected = selected,
                            isDefault = isDefault
                        )
                    )
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get subtitle tracks", e)
        }
        return tracks
    }

    private fun updateTracks() {
        _playerState.update { current ->
            val selectedAudio = getAudioTracks().indexOfFirst { it.isSelected }
            val selectedSub = getSubtitleTracks().indexOfFirst { it.isSelected }

            current.copy(
                audioTracks = getAudioTracks(),
                subtitleTracks = getSubtitleTracks(),
                selectedAudioTrack = selectedAudio,
                selectedSubtitleTrack = selectedSub
            )
        }
    }

    // MPVLib.EventObserver implementation
    override fun eventProperty(property: String) {
        Log.d(TAG, "Property changed: $property")
    }

    override fun eventProperty(property: String, value: Long) {
        Log.d(TAG, "Property changed: $property = $value")
        when (property) {
            "track-list/count" -> {
                engineScope.launch {
                    delay(100) // Give tracks time to populate
                    updateTracks()
                    _engineEvents.value = EngineEvent.TracksChanged(
                        audioCount = getAudioTracks().size,
                        subtitleCount = getSubtitleTracks().size,
                        qualityCount = 0
                    )
                }
            }
        }
    }

    override fun eventProperty(property: String, value: Double) {
        Log.d(TAG, "Property changed: $property = $value")
    }

    override fun eventProperty(property: String, value: Boolean) {
        Log.d(TAG, "Property changed: $property = $value")
        when (property) {
            "pause" -> {
                if (value) {
                    _engineEvents.value = EngineEvent.PlaybackPaused
                } else {
                    _engineEvents.value = EngineEvent.PlaybackResumed
                }
            }
            "paused-for-cache" -> {
                if (value) {
                    _engineEvents.value = EngineEvent.BufferingStarted(_playerState.value.bufferedPercent)
                } else {
                    _engineEvents.value = EngineEvent.BufferingEnded(_playerState.value.bufferedPercent)
                }
            }
            "eof-reached" -> {
                if (value) {
                    _engineEvents.value = EngineEvent.PlaybackEnded
                }
            }
        }
    }

    override fun eventProperty(property: String, value: String) {
        Log.d(TAG, "Property changed: $property = $value")
    }

    override fun event(eventId: Int) {
        Log.d(TAG, "Event: $eventId")
        when (eventId) {
            MPVLib.MPV_EVENT_START_FILE -> {
                Log.i(TAG, "File started")
                _playerState.update { it.copy(isBuffering = true) }
            }
            MPVLib.MPV_EVENT_FILE_LOADED -> {
                Log.i(TAG, "File loaded")
                _engineEvents.value = EngineEvent.PlaybackStarted(_playerState.value.currentPosition)
                updateTracks()
            }
            MPVLib.MPV_EVENT_PLAYBACK_RESTART -> {
                Log.i(TAG, "Playback restarted")
                _playerState.update { it.copy(isBuffering = false, isPlaying = true) }
            }
            MPVLib.MPV_EVENT_SEEK -> {
                Log.d(TAG, "Seeking")
            }
            MPVLib.MPV_EVENT_END_FILE -> {
                Log.i(TAG, "File ended")
            }
            MPVLib.MPV_EVENT_SHUTDOWN -> {
                Log.i(TAG, "MPV shutdown")
            }
        }
    }

    // MPVLib.LogObserver implementation
    override fun logMessage(prefix: String, level: Int, text: String) {
        val logLevel = when (level) {
            MPVLib.MPV_LOG_LEVEL_ERROR, MPVLib.MPV_LOG_LEVEL_FATAL -> Log.ERROR
            MPVLib.MPV_LOG_LEVEL_WARN -> Log.WARN
            MPVLib.MPV_LOG_LEVEL_INFO -> Log.INFO
            MPVLib.MPV_LOG_LEVEL_V, MPVLib.MPV_LOG_LEVEL_DEBUG -> Log.DEBUG
            else -> Log.VERBOSE
        }

        when (logLevel) {
            Log.ERROR -> Log.e(TAG, "[$prefix] $text")
            Log.WARN -> Log.w(TAG, "[$prefix] $text")
            Log.INFO -> Log.i(TAG, "[$prefix] $text")
            Log.DEBUG -> Log.d(TAG, "[$prefix] $text")
            else -> Log.v(TAG, "[$prefix] $text")
        }

        // Check for fatal errors
        if (level <= MPVLib.MPV_LOG_LEVEL_ERROR) {
            if (text.contains("Could not") || text.contains("Failed") || text.contains("Error")) {
                _engineEvents.value = EngineEvent.Error(
                    code = EngineErrorCodes.DECODE_ERROR,
                    message = text,
                    isFatal = level == MPVLib.MPV_LOG_LEVEL_FATAL,
                    canRetry = true
                )
            }
        }
    }
}
