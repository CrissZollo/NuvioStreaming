package com.nuvio.app.mpv

import android.content.Context
import android.graphics.SurfaceTexture
import android.util.AttributeSet
import android.util.Log
import android.view.Surface
import android.view.TextureView
import dev.jdtech.mpv.MPVLib

class MPVView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : TextureView(context, attrs, defStyleAttr), TextureView.SurfaceTextureListener, MPVLib.EventObserver {

    companion object {
        private const val TAG = "MPVView"
    }

    private var isMpvInitialized = false
    private var pendingDataSource: String? = null
    private var isPaused: Boolean = true
    private var surface: Surface? = null
    private var httpHeaders: Map<String, String>? = null
    private var loadHandler: android.os.Handler? = null
    private var pendingLoadRunnable: Runnable? = null

    // Event listener for React Native
    var onLoadCallback: ((duration: Double, width: Int, height: Int) -> Unit)? = null
    var onProgressCallback: ((position: Double, duration: Double) -> Unit)? = null
    var onEndCallback: (() -> Unit)? = null
    var onErrorCallback: ((message: String) -> Unit)? = null
    var onTracksChangedCallback: ((audioTracks: List<Map<String, Any>>, subtitleTracks: List<Map<String, Any>>) -> Unit)? = null

    init {
        surfaceTextureListener = this
        isOpaque = false
        loadHandler = android.os.Handler(android.os.Looper.getMainLooper())
    }

    override fun onSurfaceTextureAvailable(surfaceTexture: SurfaceTexture, width: Int, height: Int) {
        Log.d(TAG, "Surface texture available: ${width}x${height}")
        try {
            surface = Surface(surfaceTexture)
            
            MPVLib.create(context.applicationContext)
            initOptions()
            MPVLib.init()
            MPVLib.attachSurface(surface!!)
            MPVLib.addObserver(this)
            MPVLib.setPropertyString("android-surface-size", "${width}x${height}")
            observeProperties()
            isMpvInitialized = true

            // If a data source was set before surface was ready, schedule load now
            if (pendingDataSource != null) {
                scheduleLoad()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize MPV", e)
            onErrorCallback?.invoke("MPV initialization failed: ${e.message}")
        }
    }

    override fun onSurfaceTextureSizeChanged(surfaceTexture: SurfaceTexture, width: Int, height: Int) {
        Log.d(TAG, "Surface texture size changed: ${width}x${height}")
        if (isMpvInitialized) {
            MPVLib.setPropertyString("android-surface-size", "${width}x${height}")
        }
    }

    override fun onSurfaceTextureDestroyed(surfaceTexture: SurfaceTexture): Boolean {
        Log.d(TAG, "Surface texture destroyed")
        // Cancel any pending loads
        pendingLoadRunnable?.let { loadHandler?.removeCallbacks(it) }
        pendingLoadRunnable = null

        if (isMpvInitialized) {
            MPVLib.removeObserver(this)
            MPVLib.detachSurface()
            MPVLib.destroy()
            isMpvInitialized = false
        }
        surface?.release()
        surface = null
        return true
    }

    override fun onSurfaceTextureUpdated(surfaceTexture: SurfaceTexture) {
        // Called when the SurfaceTexture is updated via updateTexImage()
    }

    private fun initOptions() {
        Log.d(TAG, "========== INITIALIZING MPV OPTIONS ==========")

        // Detect if running on Android TV
        val uiModeManager = context.getSystemService(android.content.Context.UI_MODE_SERVICE) as android.app.UiModeManager
        val isTV = uiModeManager.currentModeType == android.content.res.Configuration.UI_MODE_TYPE_TELEVISION
        Log.d(TAG, "Device type: ${if (isTV) "Android TV" else "Mobile/Tablet"}")

        // Video output - required for Android
        MPVLib.setOptionString("vo", "gpu")
        MPVLib.setOptionString("gpu-context", "android")
        MPVLib.setOptionString("opengl-es", "yes")
        Log.d(TAG, "Video output: vo=gpu, gpu-context=android")

        // Hardware decoding configuration
        // - mediacodec: Direct hardware decoding (best performance, but some devices have issues)
        // - mediacodec-copy: Hardware decode + copy to CPU (more compatible, slightly slower)
        // - auto: Let MPV decide (may fall back to software on some devices)
        if (isTV) {
            // For Android TV (Nvidia Shield, Fire TV, etc.):
            // Use mediacodec for direct hardware decoding - best performance
            // Fall back to mediacodec-copy if direct fails
            MPVLib.setOptionString("hwdec", "mediacodec,mediacodec-copy,auto")
            Log.d(TAG, "Hardware decoding (TV): hwdec=mediacodec,mediacodec-copy,auto")

            // GPU shader optimizations for TV - prefer performance over quality
            MPVLib.setOptionString("profile", "fast")
            MPVLib.setOptionString("gpu-dumb-mode", "yes")
            Log.d(TAG, "GPU optimizations: profile=fast, gpu-dumb-mode=yes")

            // Reduce demuxer overhead for smoother playback
            MPVLib.setOptionString("demuxer-max-bytes", "50MiB")
            MPVLib.setOptionString("demuxer-max-back-bytes", "25MiB")
            Log.d(TAG, "Demuxer buffers: max=50MiB, back=25MiB")
        } else {
            // For mobile/tablet: Use auto with mediacodec-copy fallback
            MPVLib.setOptionString("hwdec", "mediacodec-copy,auto")
            Log.d(TAG, "Hardware decoding (Mobile): hwdec=mediacodec-copy,auto")
        }

        // Audio output - audiotrack is more reliable on Android
        MPVLib.setOptionString("ao", "audiotrack,opensles")
        Log.d(TAG, "Audio output: ao=audiotrack,opensles")

        // Caching for network streams
        MPVLib.setOptionString("cache", "yes")
        MPVLib.setOptionString("cache-secs", "30")
        Log.d(TAG, "Cache: enabled, 30 seconds")

        // Disable unnecessary features that consume resources
        MPVLib.setOptionString("osc", "no")
        MPVLib.setOptionString("terminal", "no")
        MPVLib.setOptionString("input-default-bindings", "no")
        MPVLib.setOptionString("sub-auto", "fuzzy")

        // Disable screenshot and other unused features
        MPVLib.setOptionString("screenshot", "no")

        // Logging (reduce in production for performance)
        MPVLib.setOptionString("msg-level", "all=warn")

        Log.d(TAG, "========== MPV OPTIONS COMPLETE ==========")
    }

    private fun observeProperties() {
        // MPV format constants (from MPVLib source)
        val MPV_FORMAT_NONE = 0
        val MPV_FORMAT_FLAG = 3
        val MPV_FORMAT_INT64 = 4
        val MPV_FORMAT_DOUBLE = 5

        MPVLib.observeProperty("time-pos", MPV_FORMAT_DOUBLE)
        MPVLib.observeProperty("duration/full", MPV_FORMAT_DOUBLE) // Use /full for complete HLS duration
        MPVLib.observeProperty("pause", MPV_FORMAT_FLAG)
        MPVLib.observeProperty("paused-for-cache", MPV_FORMAT_FLAG)
        MPVLib.observeProperty("eof-reached", MPV_FORMAT_FLAG)
        MPVLib.observeProperty("video-params/aspect", MPV_FORMAT_DOUBLE)
        MPVLib.observeProperty("width", MPV_FORMAT_INT64)
        MPVLib.observeProperty("height", MPV_FORMAT_INT64)
        MPVLib.observeProperty("track-list", MPV_FORMAT_NONE)

        // Observe subtitle properties for debugging
        MPVLib.observeProperty("sid", MPV_FORMAT_INT64)
        MPVLib.observeProperty("sub-visibility", MPV_FORMAT_FLAG)
        MPVLib.observeProperty("sub-text", MPV_FORMAT_NONE)

        // Observe error/status properties for better debugging
        MPVLib.observeProperty("path", MPV_FORMAT_NONE)
        MPVLib.observeProperty("file-loaded-status", MPV_FORMAT_NONE)
    }

    private fun loadFile(url: String) {
        Log.d(TAG, "========== LOADING FILE ==========")
        Log.d(TAG, "URL: $url")
        Log.d(TAG, "URL length: ${url.length}")
        Log.d(TAG, "URL starts with http: ${url.startsWith("http")}")
        Log.d(TAG, "MPV initialized: $isMpvInitialized")
        Log.d(TAG, "Surface ready: ${surface != null}")
        Log.d(TAG, "Headers: $httpHeaders")

        // Check if MPVLib methods are accessible
        try {
            val version = MPVLib.getPropertyString("mpv-version")
            Log.d(TAG, "MPV Version: $version")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get MPV version: ${e.message}")
        }

        Log.d(TAG, "==================================")

        // Test URL reachability in background
        Thread {
            try {
                Log.d(TAG, "Starting URL reachability test...")
                val connection = java.net.URL(url).openConnection() as java.net.HttpURLConnection
                connection.requestMethod = "HEAD"
                connection.connectTimeout = 15000
                connection.readTimeout = 15000
                connection.instanceFollowRedirects = true
                // Add headers if we have them
                httpHeaders?.forEach { (key, value) ->
                    connection.setRequestProperty(key, value)
                }
                connection.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 10; Android TV) AppleWebKit/537.36")
                Log.d(TAG, "Connecting to URL...")
                connection.connect()
                val responseCode = connection.responseCode
                val contentType = connection.contentType
                val contentLength = connection.contentLength
                val finalUrl = connection.url.toString()
                Log.d(TAG, "========== URL TEST RESULT ==========")
                Log.d(TAG, "Response code: $responseCode")
                Log.d(TAG, "Content-Type: $contentType")
                Log.d(TAG, "Content-Length: $contentLength")
                Log.d(TAG, "Final URL (after redirects): $finalUrl")
                Log.d(TAG, "=====================================")
                connection.disconnect()
            } catch (e: Exception) {
                Log.e(TAG, "========== URL TEST FAILED ==========")
                Log.e(TAG, "Error: ${e.message}")
                Log.e(TAG, "Exception type: ${e.javaClass.simpleName}")
                e.printStackTrace()
                Log.e(TAG, "=====================================")
            }
        }.start()

        try {
            Log.d(TAG, "Sending loadfile command to MPV...")
            MPVLib.command(arrayOf("loadfile", url))
            Log.d(TAG, "loadfile command sent successfully")
        } catch (e: Exception) {
            Log.e(TAG, "Error sending loadfile command: ${e.message}", e)
            onErrorCallback?.invoke("Failed to load file: ${e.message}")
        }
    }

    // Public API

    fun setDataSource(url: String) {
        Log.d(TAG, "setDataSource called: $url")
        pendingDataSource = url
        scheduleLoad()
    }

    fun setHeaders(headers: Map<String, String>?) {
        httpHeaders = headers
        Log.d(TAG, "Headers set: $headers")
        // If we already have a pending source, reschedule load to apply new headers
        if (pendingDataSource != null) {
            scheduleLoad()
        }
    }

    private fun scheduleLoad() {
        Log.d(TAG, "scheduleLoad called, pendingDataSource: $pendingDataSource, isMpvInitialized: $isMpvInitialized")
        // Cancel any pending load
        pendingLoadRunnable?.let { loadHandler?.removeCallbacks(it) }

        // Schedule load with a small delay to allow both source and headers to be set
        pendingLoadRunnable = Runnable {
            Log.d(TAG, "scheduleLoad runnable executing, pendingDataSource: $pendingDataSource, isMpvInitialized: $isMpvInitialized")
            pendingDataSource?.let { url ->
                if (isMpvInitialized) {
                    Log.d(TAG, "About to apply headers and load file")
                    applyHttpHeaders()
                    loadFile(url)
                    pendingDataSource = null
                } else {
                    Log.d(TAG, "MPV not initialized yet, will load when surface is available")
                }
                // If not initialized yet, onSurfaceTextureAvailable will handle it
            }
        }

        // 100ms delay allows React Native to set both props before we load
        loadHandler?.postDelayed(pendingLoadRunnable!!, 100)
    }

    private fun applyHttpHeaders() {
        httpHeaders?.let { headers ->
            if (headers.isNotEmpty()) {
                Log.d(TAG, "========== APPLYING HEADERS ==========")
                // Format headers for MPV - each header on its own line
                // MPV expects headers separated by newlines or as separate options
                headers.forEach { (key, value) ->
                    Log.d(TAG, "Header: $key = $value")
                }

                // Method 1: http-header-fields with comma separation
                val headerList = headers.map { (key, value) -> "$key: $value" }
                val headerString = headerList.joinToString(",")
                Log.d(TAG, "Setting http-header-fields: $headerString")
                MPVLib.setOptionString("http-header-fields", headerString)

                // Method 2: Also set referrer and user-agent separately if present
                headers["Referer"]?.let { referer ->
                    Log.d(TAG, "Setting referrer: $referer")
                    MPVLib.setOptionString("referrer", referer)
                }
                headers["User-Agent"]?.let { ua ->
                    Log.d(TAG, "Setting user-agent: $ua")
                    MPVLib.setOptionString("user-agent", ua)
                }
                Log.d(TAG, "=======================================")
            }
        }
    }

    fun setPaused(paused: Boolean) {
        isPaused = paused
        if (isMpvInitialized) {
            MPVLib.setPropertyBoolean("pause", paused)
        }
    }

    fun seekTo(positionSeconds: Double) {
        Log.d(TAG, "seekTo called: positionSeconds=$positionSeconds, isMpvInitialized=$isMpvInitialized")
        if (isMpvInitialized) {
            Log.d(TAG, "Executing MPV seek command: seek $positionSeconds absolute")
            MPVLib.command(arrayOf("seek", positionSeconds.toString(), "absolute"))
        }
    }

    fun setSpeed(speed: Double) {
        if (isMpvInitialized) {
            MPVLib.setPropertyDouble("speed", speed)
        }
    }

    fun setVolume(volume: Double) {
        if (isMpvInitialized) {
            // MPV volume is 0-100
            MPVLib.setPropertyDouble("volume", volume * 100.0)
        }
    }

    fun setAudioTrack(trackId: Int) {
        if (isMpvInitialized) {
            if (trackId == -1) {
                MPVLib.setPropertyString("aid", "no")
            } else {
                MPVLib.setPropertyInt("aid", trackId)
            }
        }
    }

    fun setSubtitleTrack(trackId: Int) {
        Log.d(TAG, "setSubtitleTrack called: trackId=$trackId, isMpvInitialized=$isMpvInitialized")
        if (isMpvInitialized) {
            if (trackId == -1) {
                Log.d(TAG, "Disabling subtitles (sid=no)")
                MPVLib.setPropertyString("sid", "no")
                MPVLib.setPropertyString("sub-visibility", "no")
            } else {
                Log.d(TAG, "Setting subtitle track to: $trackId")
                MPVLib.setPropertyInt("sid", trackId)
                // Ensure subtitles are visible
                MPVLib.setPropertyString("sub-visibility", "yes")
                
                // Debug: Verify the subtitle was set correctly
                val currentSid = MPVLib.getPropertyInt("sid")
                val subVisibility = MPVLib.getPropertyString("sub-visibility")
                val subDelay = MPVLib.getPropertyDouble("sub-delay")
                val subScale = MPVLib.getPropertyDouble("sub-scale")
                Log.d(TAG, "After setting - sid=$currentSid, sub-visibility=$subVisibility, sub-delay=$subDelay, sub-scale=$subScale")
            }
        }
    }

    fun setResizeMode(mode: String) {
        Log.d(TAG, "setResizeMode called: mode=$mode, isMpvInitialized=$isMpvInitialized")
        if (isMpvInitialized) {
            when (mode) {
                "contain" -> {
                    // Letterbox - show entire video with black bars
                    MPVLib.setPropertyDouble("panscan", 0.0)
                    MPVLib.setPropertyString("keepaspect", "yes")
                }
                "cover" -> {
                    // Fill/crop - zoom to fill, cropping edges
                    MPVLib.setPropertyDouble("panscan", 1.0)
                    MPVLib.setPropertyString("keepaspect", "yes")
                }
                "stretch" -> {
                    // Stretch - disable aspect ratio
                    MPVLib.setPropertyDouble("panscan", 0.0)
                    MPVLib.setPropertyString("keepaspect", "no")
                }
                else -> {
                    // Default to contain
                    MPVLib.setPropertyDouble("panscan", 0.0)
                    MPVLib.setPropertyString("keepaspect", "yes")
                }
            }
        }
    }

    // MPVLib.EventObserver implementation

    override fun eventProperty(property: String) {
        Log.d(TAG, "Property changed: $property")
        when (property) {
            "track-list" -> {
                // Parse track list and notify React Native
                parseAndSendTracks()
            }
        }
    }
    
    private fun parseAndSendTracks() {
        try {
            val trackCount = MPVLib.getPropertyInt("track-list/count") ?: 0
            Log.d(TAG, "Track count: $trackCount")

            val audioTracks = mutableListOf<Map<String, Any>>()
            val subtitleTracks = mutableListOf<Map<String, Any>>()

            for (i in 0 until trackCount) {
                val type = MPVLib.getPropertyString("track-list/$i/type")
                val id = MPVLib.getPropertyInt("track-list/$i/id")
                val title = MPVLib.getPropertyString("track-list/$i/title") ?: ""
                val lang = MPVLib.getPropertyString("track-list/$i/lang") ?: ""
                val codec = MPVLib.getPropertyString("track-list/$i/codec") ?: ""

                // Log ALL tracks regardless of type for debugging
                Log.d(TAG, "Track $i: type=$type, id=$id, title=$title, lang=$lang, codec=$codec")

                if (type == null || id == null) {
                    Log.d(TAG, "Skipping track $i - type or id is null")
                    continue
                }

                val trackName = when {
                    title.isNotEmpty() -> title
                    lang.isNotEmpty() -> lang.uppercase()
                    else -> "Track $id"
                }

                val track = mapOf(
                    "id" to id,
                    "name" to trackName,
                    "language" to lang,
                    "codec" to codec
                )

                when (type) {
                    "audio" -> {
                        Log.d(TAG, "Found audio track: $track")
                        audioTracks.add(track)
                    }
                    "sub" -> {
                        Log.d(TAG, "Found subtitle track: $track")
                        subtitleTracks.add(track)
                    }
                    "video" -> {
                        Log.d(TAG, "Found video track: $track")
                        // Video tracks are not sent to React Native but log them
                    }
                    else -> {
                        Log.d(TAG, "Unknown track type '$type': $track")
                    }
                }
            }

            Log.d(TAG, "Sending tracks - Audio: ${audioTracks.size}, Subtitles: ${subtitleTracks.size}")
            onTracksChangedCallback?.invoke(audioTracks, subtitleTracks)
        } catch (e: Exception) {
            Log.e(TAG, "Error parsing tracks", e)
        }
    }

    override fun eventProperty(property: String, value: Long) {
        Log.d(TAG, "Property $property = $value (Long)")
    }

    override fun eventProperty(property: String, value: Double) {
        Log.d(TAG, "Property $property = $value (Double)")
        when (property) {
            "time-pos" -> {
                val duration = MPVLib.getPropertyDouble("duration/full") ?: MPVLib.getPropertyDouble("duration") ?: 0.0
                onProgressCallback?.invoke(value, duration)
            }
            "duration/full", "duration" -> {
                val width = MPVLib.getPropertyInt("width") ?: 0
                val height = MPVLib.getPropertyInt("height") ?: 0
                onLoadCallback?.invoke(value, width, height)
            }
        }
    }

    override fun eventProperty(property: String, value: Boolean) {
        Log.d(TAG, "Property $property = $value (Boolean)")
        when (property) {
            "eof-reached" -> {
                if (value) {
                    onEndCallback?.invoke()
                }
            }
        }
    }

    override fun eventProperty(property: String, value: String) {
        Log.d(TAG, "Property $property = $value (String)")
    }

    override fun event(eventId: Int) {
        Log.d(TAG, "Event: $eventId")
        // MPV event constants (from MPVLib source)
        val MPV_EVENT_NONE = 0
        val MPV_EVENT_SHUTDOWN = 1
        val MPV_EVENT_LOG_MESSAGE = 2
        val MPV_EVENT_GET_PROPERTY_REPLY = 3
        val MPV_EVENT_SET_PROPERTY_REPLY = 4
        val MPV_EVENT_COMMAND_REPLY = 5
        val MPV_EVENT_START_FILE = 6
        val MPV_EVENT_END_FILE = 7
        val MPV_EVENT_FILE_LOADED = 8
        val MPV_EVENT_IDLE = 11
        val MPV_EVENT_TICK = 14
        val MPV_EVENT_CLIENT_MESSAGE = 16
        val MPV_EVENT_VIDEO_RECONFIG = 17
        val MPV_EVENT_AUDIO_RECONFIG = 18
        val MPV_EVENT_SEEK = 20
        val MPV_EVENT_PLAYBACK_RESTART = 21
        val MPV_EVENT_PROPERTY_CHANGE = 22
        val MPV_EVENT_QUEUE_OVERFLOW = 24
        val MPV_EVENT_HOOK = 25

        when (eventId) {
            MPV_EVENT_LOG_MESSAGE -> {
                // Try to get the log message - this may vary by MPVLib implementation
                Log.d(TAG, "MPV_EVENT_LOG_MESSAGE received")
            }
            MPV_EVENT_START_FILE -> {
                Log.d(TAG, "MPV_EVENT_START_FILE - beginning to load file")
            }
            MPV_EVENT_FILE_LOADED -> {
                Log.d(TAG, "MPV_EVENT_FILE_LOADED - file loaded successfully")

                // Log what was detected
                val videoCodec = MPVLib.getPropertyString("video-codec")
                val audioCodec = MPVLib.getPropertyString("audio-codec")
                val hwdecCurrent = MPVLib.getPropertyString("hwdec-current")
                val videoFormat = MPVLib.getPropertyString("video-format")
                val fileFormat = MPVLib.getPropertyString("file-format")
                val duration = MPVLib.getPropertyDouble("duration")
                val width = MPVLib.getPropertyInt("width")
                val height = MPVLib.getPropertyInt("height")
                val trackCount = MPVLib.getPropertyInt("track-list/count")

                Log.d(TAG, "========== FILE LOADED DIAGNOSTICS ==========")
                Log.d(TAG, "Video codec: $videoCodec, Audio codec: $audioCodec")
                Log.d(TAG, "Hwdec: $hwdecCurrent, Video format: $videoFormat")
                Log.d(TAG, "File format: $fileFormat, Duration: $duration")
                Log.d(TAG, "Resolution: ${width}x${height}, Tracks: $trackCount")
                Log.d(TAG, "=============================================")

                // File is loaded, start playback if not paused
                if (!isPaused) {
                    MPVLib.setPropertyBoolean("pause", false)
                }
            }
            MPV_EVENT_END_FILE -> {
                Log.d(TAG, "MPV_EVENT_END_FILE")

                // Get detailed diagnostic info
                val duration = MPVLib.getPropertyDouble("duration/full") ?: MPVLib.getPropertyDouble("duration") ?: 0.0
                val timePos = MPVLib.getPropertyDouble("time-pos") ?: 0.0
                val eofReached = MPVLib.getPropertyBoolean("eof-reached") ?: false
                val path = MPVLib.getPropertyString("path")

                // Additional diagnostics
                val videoCodec = MPVLib.getPropertyString("video-codec")
                val audioCodec = MPVLib.getPropertyString("audio-codec")
                val hwdecCurrent = MPVLib.getPropertyString("hwdec-current")
                val videoFormat = MPVLib.getPropertyString("video-format")
                val fileFormat = MPVLib.getPropertyString("file-format")
                val containerFps = MPVLib.getPropertyDouble("container-fps")
                val width = MPVLib.getPropertyInt("width")
                val height = MPVLib.getPropertyInt("height")

                Log.d(TAG, "========== END FILE DIAGNOSTICS ==========")
                Log.d(TAG, "Duration: $duration, Time: $timePos, EOF: $eofReached")
                Log.d(TAG, "Path: $path")
                Log.d(TAG, "Video codec: $videoCodec, Audio codec: $audioCodec")
                Log.d(TAG, "Hwdec current: $hwdecCurrent")
                Log.d(TAG, "Video format: $videoFormat, File format: $fileFormat")
                Log.d(TAG, "FPS: $containerFps, Resolution: ${width}x${height}")
                Log.d(TAG, "===========================================")

                if (duration < 1.0 && !eofReached) {
                     val customError = "Unable to play media. Video codec: $videoCodec, Audio codec: $audioCodec, hwdec: $hwdecCurrent"
                     Log.e(TAG, "Playback error detected: $customError")
                     onErrorCallback?.invoke("Unable to play media. Source may be unreachable.")
                } else {
                    onEndCallback?.invoke()
                }
            }
            MPV_EVENT_PLAYBACK_RESTART -> {
                Log.d(TAG, "MPV_EVENT_PLAYBACK_RESTART - playback can resume")
            }
            else -> {
                Log.d(TAG, "Unhandled MPV event: $eventId")
            }
        }
    }
}
