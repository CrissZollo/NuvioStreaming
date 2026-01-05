package com.nuvio.app.exoplayer

import android.content.Context
import android.net.Uri
import android.util.AttributeSet
import android.util.Log
import android.view.SurfaceView
import android.widget.FrameLayout
import androidx.media3.common.C
import androidx.media3.common.Format
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.common.Tracks
import androidx.media3.common.VideoSize
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.mediacodec.MediaCodecSelector
import androidx.media3.exoplayer.mediacodec.MediaCodecInfo
import androidx.media3.exoplayer.mediacodec.MediaCodecUtil
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.exoplayer.hls.HlsMediaSource
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector
import androidx.media3.common.TrackGroup
import androidx.media3.exoplayer.RendererCapabilities

/**
 * Helper object to detect Dolby Vision formats.
 */
object DolbyVisionDetector {
    fun isDolbyVision(format: Format): Boolean {
        val mimeType = format.sampleMimeType ?: ""
        val codecs = format.codecs ?: ""
        return mimeType.contains("dolby-vision", ignoreCase = true) ||
               mimeType == MimeTypes.VIDEO_DOLBY_VISION ||
               codecs.startsWith("dvh", ignoreCase = true) ||
               codecs.startsWith("hev1.08", ignoreCase = true) ||
               codecs.startsWith("dvhe", ignoreCase = true)
    }

    fun isDolbyVisionMimeType(mimeType: String): Boolean {
        return mimeType.contains("dolby-vision", ignoreCase = true) ||
               mimeType == MimeTypes.VIDEO_DOLBY_VISION
    }
}

/**
 * Custom MediaCodecSelector that refuses to return decoders for Dolby Vision.
 * This forces ExoPlayer to fall back to HEVC/H.265 decoders.
 */
@androidx.annotation.OptIn(androidx.media3.common.util.UnstableApi::class)
class NoDolbyVisionCodecSelector : MediaCodecSelector {
    companion object {
        private const val TAG = "NoDVCodecSelector"
    }

    override fun getDecoderInfos(
        mimeType: String,
        requiresSecureDecoder: Boolean,
        requiresTunnelingDecoder: Boolean
    ): MutableList<MediaCodecInfo> {
        // Check if this is a Dolby Vision MIME type
        if (DolbyVisionDetector.isDolbyVisionMimeType(mimeType)) {
            Log.d(TAG, "BLOCKING decoder request for Dolby Vision: $mimeType, returning HEVC decoders instead")
            // Return HEVC decoders instead - this allows the base layer to be decoded
            return MediaCodecUtil.getDecoderInfos(MimeTypes.VIDEO_H265, requiresSecureDecoder, requiresTunnelingDecoder)
        }

        // For all other formats, use the default selector
        return MediaCodecUtil.getDecoderInfos(mimeType, requiresSecureDecoder, requiresTunnelingDecoder)
    }
}

@androidx.annotation.OptIn(androidx.media3.common.util.UnstableApi::class)
class ExoPlayerView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : FrameLayout(context, attrs, defStyleAttr) {

    companion object {
        private const val TAG = "ExoPlayerView"

        // Audio codecs that may not be supported on all devices
        private val PROBLEMATIC_AUDIO_CODECS = setOf(
            MimeTypes.AUDIO_AC3,      // Dolby Digital (AC-3)
            MimeTypes.AUDIO_E_AC3,    // Dolby Digital Plus (E-AC-3)
            MimeTypes.AUDIO_TRUEHD,   // Dolby TrueHD
            MimeTypes.AUDIO_DTS,      // DTS
            MimeTypes.AUDIO_DTS_HD,   // DTS-HD
            MimeTypes.AUDIO_DTS_EXPRESS  // DTS Express
        )

        /**
         * Check if the device has a decoder for the given audio MIME type.
         */
        private fun isAudioCodecSupported(mimeType: String): Boolean {
            return try {
                val decoderInfos = MediaCodecUtil.getDecoderInfos(mimeType, false, false)
                val supported = decoderInfos.isNotEmpty()
                Log.d(TAG, "Codec $mimeType supported: $supported (${decoderInfos.size} decoders)")
                supported
            } catch (e: Exception) {
                Log.w(TAG, "Failed to check codec support for $mimeType: ${e.message}")
                false
            }
        }

        private fun getErrorTypeName(errorCode: Int): String {
            return when (errorCode) {
                PlaybackException.ERROR_CODE_UNSPECIFIED -> "UNSPECIFIED"
                PlaybackException.ERROR_CODE_REMOTE_ERROR -> "REMOTE_ERROR"
                PlaybackException.ERROR_CODE_BEHIND_LIVE_WINDOW -> "BEHIND_LIVE_WINDOW"
                PlaybackException.ERROR_CODE_TIMEOUT -> "TIMEOUT"
                PlaybackException.ERROR_CODE_FAILED_RUNTIME_CHECK -> "FAILED_RUNTIME_CHECK"
                PlaybackException.ERROR_CODE_IO_UNSPECIFIED -> "IO_UNSPECIFIED"
                PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_FAILED -> "IO_NETWORK_CONNECTION_FAILED"
                PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_TIMEOUT -> "IO_NETWORK_CONNECTION_TIMEOUT"
                PlaybackException.ERROR_CODE_IO_INVALID_HTTP_CONTENT_TYPE -> "IO_INVALID_HTTP_CONTENT_TYPE"
                PlaybackException.ERROR_CODE_IO_BAD_HTTP_STATUS -> "IO_BAD_HTTP_STATUS"
                PlaybackException.ERROR_CODE_IO_FILE_NOT_FOUND -> "IO_FILE_NOT_FOUND"
                PlaybackException.ERROR_CODE_IO_NO_PERMISSION -> "IO_NO_PERMISSION"
                PlaybackException.ERROR_CODE_IO_CLEARTEXT_NOT_PERMITTED -> "IO_CLEARTEXT_NOT_PERMITTED"
                PlaybackException.ERROR_CODE_IO_READ_POSITION_OUT_OF_RANGE -> "IO_READ_POSITION_OUT_OF_RANGE"
                PlaybackException.ERROR_CODE_PARSING_CONTAINER_MALFORMED -> "PARSING_CONTAINER_MALFORMED"
                PlaybackException.ERROR_CODE_PARSING_MANIFEST_MALFORMED -> "PARSING_MANIFEST_MALFORMED"
                PlaybackException.ERROR_CODE_PARSING_CONTAINER_UNSUPPORTED -> "PARSING_CONTAINER_UNSUPPORTED"
                PlaybackException.ERROR_CODE_PARSING_MANIFEST_UNSUPPORTED -> "PARSING_MANIFEST_UNSUPPORTED"
                PlaybackException.ERROR_CODE_DECODER_INIT_FAILED -> "DECODER_INIT_FAILED"
                PlaybackException.ERROR_CODE_DECODER_QUERY_FAILED -> "DECODER_QUERY_FAILED"
                PlaybackException.ERROR_CODE_DECODING_FAILED -> "DECODING_FAILED"
                PlaybackException.ERROR_CODE_DECODING_FORMAT_EXCEEDS_CAPABILITIES -> "DECODING_FORMAT_EXCEEDS_CAPABILITIES"
                PlaybackException.ERROR_CODE_DECODING_FORMAT_UNSUPPORTED -> "DECODING_FORMAT_UNSUPPORTED"
                PlaybackException.ERROR_CODE_AUDIO_TRACK_INIT_FAILED -> "AUDIO_TRACK_INIT_FAILED"
                PlaybackException.ERROR_CODE_AUDIO_TRACK_WRITE_FAILED -> "AUDIO_TRACK_WRITE_FAILED"
                PlaybackException.ERROR_CODE_DRM_UNSPECIFIED -> "DRM_UNSPECIFIED"
                PlaybackException.ERROR_CODE_DRM_SCHEME_UNSUPPORTED -> "DRM_SCHEME_UNSUPPORTED"
                PlaybackException.ERROR_CODE_DRM_PROVISIONING_FAILED -> "DRM_PROVISIONING_FAILED"
                PlaybackException.ERROR_CODE_DRM_CONTENT_ERROR -> "DRM_CONTENT_ERROR"
                PlaybackException.ERROR_CODE_DRM_LICENSE_ACQUISITION_FAILED -> "DRM_LICENSE_ACQUISITION_FAILED"
                PlaybackException.ERROR_CODE_DRM_DISALLOWED_OPERATION -> "DRM_DISALLOWED_OPERATION"
                PlaybackException.ERROR_CODE_DRM_SYSTEM_ERROR -> "DRM_SYSTEM_ERROR"
                PlaybackException.ERROR_CODE_DRM_DEVICE_REVOKED -> "DRM_DEVICE_REVOKED"
                PlaybackException.ERROR_CODE_DRM_LICENSE_EXPIRED -> "DRM_LICENSE_EXPIRED"
                else -> "UNKNOWN($errorCode)"
            }
        }
    }

    private var player: ExoPlayer? = null
    private var trackSelector: DefaultTrackSelector? = null
    private var surfaceView: SurfaceView? = null
    private var isPaused: Boolean = true
    private var pendingSource: String? = null
    private var httpHeaders: Map<String, String>? = null
    private var currentVolume: Float = 1.0f
    private var currentRate: Float = 1.0f
    private var resizeMode: String = "contain"
    private var dolbyVisionDisabled: Boolean = false
    private var retryingWithoutDV: Boolean = false
    private var sourceErrorRetryCount: Int = 0
    private val maxSourceErrorRetries: Int = 2
    private var hasReportedLoad: Boolean = false  // Prevent duplicate onLoad callbacks
    private var audioRecoveryAttempted: Boolean = false  // Prevent infinite audio recovery loops

    // Callbacks
    var onLoadCallback: ((duration: Double, width: Int, height: Int) -> Unit)? = null
    var onProgressCallback: ((position: Double, duration: Double) -> Unit)? = null
    var onEndCallback: (() -> Unit)? = null
    var onErrorCallback: ((message: String) -> Unit)? = null
    var onTracksChangedCallback: ((audioTracks: List<Map<String, Any>>, subtitleTracks: List<Map<String, Any>>) -> Unit)? = null

    // Progress update handler
    private val progressHandler = android.os.Handler(android.os.Looper.getMainLooper())
    private val progressRunnable = object : Runnable {
        override fun run() {
            player?.let { p ->
                if (p.isPlaying) {
                    val position = p.currentPosition / 1000.0
                    val duration = p.duration / 1000.0
                    onProgressCallback?.invoke(position, if (duration > 0) duration else 0.0)
                }
            }
            progressHandler.postDelayed(this, 250) // Update every 250ms
        }
    }

    init {
        Log.d(TAG, "ExoPlayerView init")
        setupSurfaceView()
        checkDolbyVisionSupport()
    }

    private fun checkDolbyVisionSupport() {
        // Nvidia Shield and many devices have limited DV profile support
        // Profile 8 (hev1.08.xx) often fails even when DV decoder exists
        // To avoid playback errors, we disable DV by default and prefer HDR10/HEVC fallback
        // This is more reliable than checking codec capabilities which don't report profile support
        Log.d(TAG, "Disabling Dolby Vision by default - preferring HDR10/HEVC for reliability")
        dolbyVisionDisabled = true
    }

    private fun setupSurfaceView() {
        surfaceView = SurfaceView(context).apply {
            layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
        }
        addView(surfaceView)
    }

    private fun initializePlayer() {
        if (player != null) return

        Log.d(TAG, "Initializing ExoPlayer")

        // Create track selector with parameters that prefer non-DV codecs
        trackSelector = DefaultTrackSelector(context).apply {
            val paramsBuilder = buildUponParameters()
                // Prefer highest quality - no resolution limits
                .setMaxVideoBitrate(Int.MAX_VALUE)
                // Enable HDR10 support
                .setAllowVideoMixedMimeTypeAdaptiveness(true)
                // Allow non-seamless adaptation for better format fallback
                .setAllowVideoNonSeamlessAdaptiveness(true)
                // Prefer hardware codecs but don't exceed capabilities
                .setForceHighestSupportedBitrate(true)
                // Critical: Don't allow tracks that exceed renderer capabilities
                .setExceedRendererCapabilitiesIfNecessary(false)
                .setExceedVideoConstraintsIfNecessary(false)
                // Explicitly prefer non-DV codecs - this sets the preference order
                .setPreferredVideoMimeTypes(MimeTypes.VIDEO_H265, MimeTypes.VIDEO_H264, MimeTypes.VIDEO_VP9)

            Log.d(TAG, "Configuring DefaultTrackSelector with capability constraints and HEVC preference")
            setParameters(paramsBuilder)
        }

        // Create renderers factory with custom codec selector that blocks DV decoders
        // This forces ExoPlayer to fall back to HEVC when DV is requested
        val renderersFactory = DefaultRenderersFactory(context)
            // Use custom codec selector that refuses DV decoders
            .setMediaCodecSelector(NoDolbyVisionCodecSelector())
            // Enable decoder fallback - critical for DV -> HEVC fallback
            .setEnableDecoderFallback(true)
            .setExtensionRendererMode(DefaultRenderersFactory.EXTENSION_RENDERER_MODE_PREFER)

        Log.d(TAG, "Using NoDolbyVisionCodecSelector to block DV decoders")

        Log.d(TAG, "Creating ExoPlayer instance, isPaused=$isPaused")
        player = ExoPlayer.Builder(context, renderersFactory)
            .setTrackSelector(trackSelector!!)
            .setVideoScalingMode(C.VIDEO_SCALING_MODE_SCALE_TO_FIT)
            .build()
            .apply {
                setVideoSurfaceView(surfaceView)
                playWhenReady = !isPaused
                Log.d(TAG, "ExoPlayer created, playWhenReady=$playWhenReady")
                volume = currentVolume
                setPlaybackSpeed(currentRate)

                addListener(object : Player.Listener {
                    override fun onPlaybackStateChanged(state: Int) {
                        Log.d(TAG, "Playback state changed: $state")
                        when (state) {
                            Player.STATE_READY -> {
                                Log.d(TAG, "Player ready (hasReportedLoad=$hasReportedLoad)")
                                // Reset error retry count on successful playback
                                sourceErrorRetryCount = 0

                                // Only fire onLoad once per media load to prevent seek loops
                                if (!hasReportedLoad) {
                                    hasReportedLoad = true
                                    val duration = duration / 1000.0
                                    val videoSize = videoSize
                                    Log.d(TAG, "Duration: $duration, Size: ${videoSize.width}x${videoSize.height}")
                                    onLoadCallback?.invoke(duration, videoSize.width, videoSize.height)
                                }
                                startProgressUpdates()
                            }
                            Player.STATE_ENDED -> {
                                Log.d(TAG, "Playback ended")
                                onEndCallback?.invoke()
                            }
                            Player.STATE_BUFFERING -> {
                                Log.d(TAG, "Buffering...")
                            }
                            Player.STATE_IDLE -> {
                                Log.d(TAG, "Player IDLE")
                            }
                        }
                    }

                    override fun onIsPlayingChanged(isPlaying: Boolean) {
                        Log.d(TAG, "onIsPlayingChanged: isPlaying=$isPlaying, playWhenReady=${player?.playWhenReady}")
                    }

                    override fun onPlayerError(error: PlaybackException) {
                        Log.e(TAG, "Player error: ${error.message}", error)
                        Log.e(TAG, "Error code: ${error.errorCode}, type: ${getErrorTypeName(error.errorCode)}")
                        error.cause?.let { cause ->
                            Log.e(TAG, "Error cause: ${cause.javaClass.simpleName}: ${cause.message}")
                            cause.cause?.let { rootCause ->
                                Log.e(TAG, "Root cause: ${rootCause.javaClass.simpleName}: ${rootCause.message}")
                            }
                        }

                        // Check if this is a Dolby Vision / codec capability error
                        val errorMessage = error.message ?: ""
                        val causeMessage = error.cause?.message ?: ""
                        val isDolbyVisionError = errorMessage.contains("dolby-vision", ignoreCase = true) ||
                                                 errorMessage.contains("EXCEEDS_CAPABILITIES", ignoreCase = true) ||
                                                 causeMessage.contains("dolby-vision", ignoreCase = true) ||
                                                 causeMessage.contains("EXCEEDS_CAPABILITIES", ignoreCase = true)

                        // Always retry on DV errors, regardless of dolbyVisionDisabled flag
                        if (isDolbyVisionError && !retryingWithoutDV) {
                            Log.w(TAG, "Dolby Vision/capability error detected, attempting recovery")
                            retryingWithoutDV = true

                            // Try to set track overrides to force non-DV selection
                            post { attemptDolbyVisionRecovery() }
                        } else if (error.errorCode == PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_FAILED ||
                                   error.errorCode == PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_TIMEOUT ||
                                   error.errorCode == PlaybackException.ERROR_CODE_IO_UNSPECIFIED ||
                                   error.errorCode == PlaybackException.ERROR_CODE_PARSING_CONTAINER_MALFORMED ||
                                   error.errorCode == PlaybackException.ERROR_CODE_PARSING_MANIFEST_MALFORMED) {
                            // IO/Network/Parsing errors - retry a few times before giving up
                            // Parsing errors can happen during stream switches (e.g., after DV recovery)
                            if (sourceErrorRetryCount < maxSourceErrorRetries) {
                                sourceErrorRetryCount++
                                Log.w(TAG, "Transient error detected (${getErrorTypeName(error.errorCode)}), retrying ($sourceErrorRetryCount/$maxSourceErrorRetries)")
                                post { retryPlayback() }
                            } else {
                                Log.e(TAG, "Error - max retries exceeded")
                                val errorType = getErrorTypeName(error.errorCode)
                                onErrorCallback?.invoke("Playback error: ${error.message} [$errorType]")
                            }
                        } else if (error.errorCode == PlaybackException.ERROR_CODE_BEHIND_LIVE_WINDOW) {
                            // Live stream fell behind - try to restart at live edge
                            Log.w(TAG, "Behind live window - seeking to live edge")
                            player?.seekToDefaultPosition()
                            player?.prepare()
                        } else if (error.errorCode == PlaybackException.ERROR_CODE_DECODER_INIT_FAILED ||
                                   error.errorCode == PlaybackException.ERROR_CODE_DECODING_FORMAT_UNSUPPORTED) {
                            // Audio/Video decoder not available - try to recover
                            val isAudioError = errorMessage.contains("AudioRenderer", ignoreCase = true) ||
                                              errorMessage.contains("audio/", ignoreCase = true)
                            if (isAudioError && !audioRecoveryAttempted) {
                                Log.w(TAG, "Audio decoder error - unsupported audio format (likely AC3/EAC3), attempting recovery")
                                audioRecoveryAttempted = true
                                // Try to recover by switching to a supported audio track
                                post { attemptAudioDecoderRecovery() }
                            } else if (isAudioError) {
                                Log.w(TAG, "Audio decoder error - recovery already attempted, no supported tracks available")
                                onErrorCallback?.invoke("No supported audio formats available on this device")
                            } else {
                                val errorType = getErrorTypeName(error.errorCode)
                                onErrorCallback?.invoke("Decoder error: ${error.message} [$errorType]")
                            }
                        } else {
                            // Include error code in message for debugging
                            val errorType = getErrorTypeName(error.errorCode)
                            val detailedMessage = "${error.message ?: "Unknown error"} [${errorType}]"
                            onErrorCallback?.invoke(detailedMessage)
                        }
                    }

                    override fun onVideoSizeChanged(videoSize: VideoSize) {
                        Log.d(TAG, "Video size changed: ${videoSize.width}x${videoSize.height}")
                        updateAspectRatio(videoSize)
                    }

                    override fun onTracksChanged(tracks: Tracks) {
                        Log.d(TAG, "Tracks changed")

                        // Filter out Dolby Vision tracks by setting overrides
                        filterOutDolbyVisionTracks(tracks)

                        // Auto-select a supported audio track if current one is unsupported
                        autoSelectSupportedAudioTrack(tracks)

                        parseAndSendTracks(tracks)
                    }
                })
            }

        Log.d(TAG, "ExoPlayer initialized")

        // Load pending source if any
        pendingSource?.let { loadMedia(it) }
    }

    private fun filterOutDolbyVisionTracks(tracks: Tracks) {
        if (!dolbyVisionDisabled) return
        val selector = trackSelector ?: return

        Log.d(TAG, "Filtering out Dolby Vision tracks")

        // Find video track groups and identify non-DV tracks to select
        for (group in tracks.groups) {
            if (group.type != C.TRACK_TYPE_VIDEO) continue

            val trackGroup = group.mediaTrackGroup
            val nonDvTrackIndices = mutableListOf<Int>()

            for (i in 0 until trackGroup.length) {
                val format = trackGroup.getFormat(i)
                val mimeType = format.sampleMimeType ?: ""
                val codecs = format.codecs ?: ""

                val isDolbyVision = mimeType.contains("dolby-vision", ignoreCase = true) ||
                                    mimeType == MimeTypes.VIDEO_DOLBY_VISION ||
                                    codecs.startsWith("dvh", ignoreCase = true) ||
                                    codecs.startsWith("hev1.08", ignoreCase = true) ||
                                    codecs.startsWith("dvhe", ignoreCase = true)

                if (isDolbyVision) {
                    Log.d(TAG, "Found DV track at index $i: mimeType=$mimeType, codecs=$codecs - EXCLUDING")
                } else {
                    Log.d(TAG, "Found non-DV track at index $i: mimeType=$mimeType, codecs=$codecs - KEEPING")
                    nonDvTrackIndices.add(i)
                }
            }

            // If we found non-DV tracks, force selection to those only
            if (nonDvTrackIndices.isNotEmpty() && nonDvTrackIndices.size < trackGroup.length) {
                Log.d(TAG, "Setting override to select only non-DV tracks: $nonDvTrackIndices")
                selector.setParameters(
                    selector.buildUponParameters()
                        .setOverrideForType(
                            TrackSelectionOverride(trackGroup, nonDvTrackIndices)
                        )
                )
            }
        }
    }

    /**
     * Automatically select a supported audio track if the default/current selection
     * uses an unsupported codec (like AC3/EAC3 on devices without Dolby license).
     */
    private fun autoSelectSupportedAudioTrack(tracks: Tracks) {
        val selector = trackSelector ?: return

        Log.d(TAG, "Checking audio tracks for supported codecs")

        for (group in tracks.groups) {
            if (group.type != C.TRACK_TYPE_AUDIO) continue

            val trackGroup = group.mediaTrackGroup
            val supportedTrackIndices = mutableListOf<Int>()
            var hasUnsupportedTracks = false

            // First pass: identify supported and unsupported tracks
            for (i in 0 until trackGroup.length) {
                val format = trackGroup.getFormat(i)
                val mimeType = format.sampleMimeType ?: ""
                val isSupported = isAudioCodecSupported(mimeType)

                if (isSupported) {
                    supportedTrackIndices.add(i)
                    Log.d(TAG, "Audio track $i ($mimeType) - SUPPORTED")
                } else {
                    hasUnsupportedTracks = true
                    Log.d(TAG, "Audio track $i ($mimeType) - UNSUPPORTED")
                }
            }

            // If there are unsupported tracks and we have supported alternatives, force selection
            if (hasUnsupportedTracks && supportedTrackIndices.isNotEmpty()) {
                Log.d(TAG, "Auto-selecting supported audio tracks: $supportedTrackIndices")
                selector.setParameters(
                    selector.buildUponParameters()
                        .setTrackTypeDisabled(C.TRACK_TYPE_AUDIO, false)
                        .setOverrideForType(
                            TrackSelectionOverride(trackGroup, supportedTrackIndices)
                        )
                )
            } else if (supportedTrackIndices.isEmpty() && trackGroup.length > 0) {
                Log.w(TAG, "No supported audio tracks found! Playback may have no audio.")
            }
        }
    }

    /**
     * Attempt to recover from audio decoder errors by switching to a supported audio track
     * and restarting playback from the current position.
     */
    private fun attemptAudioDecoderRecovery() {
        Log.d(TAG, "Attempting audio decoder recovery")

        val p = player ?: return
        val selector = trackSelector ?: return
        val currentPosition = p.currentPosition
        val tracks = p.currentTracks

        // Find a supported audio track
        for (group in tracks.groups) {
            if (group.type != C.TRACK_TYPE_AUDIO) continue

            val trackGroup = group.mediaTrackGroup
            var supportedTrackIndex: Int? = null

            for (i in 0 until trackGroup.length) {
                val format = trackGroup.getFormat(i)
                val mimeType = format.sampleMimeType ?: ""
                if (isAudioCodecSupported(mimeType)) {
                    supportedTrackIndex = i
                    Log.d(TAG, "Found supported audio track for recovery: $i ($mimeType)")
                    break
                }
            }

            if (supportedTrackIndex != null) {
                Log.d(TAG, "Setting audio track override to index $supportedTrackIndex and restarting")

                // Force selection of the supported track
                selector.setParameters(
                    selector.buildUponParameters()
                        .setTrackTypeDisabled(C.TRACK_TYPE_AUDIO, false)
                        .setOverrideForType(
                            TrackSelectionOverride(trackGroup, listOf(supportedTrackIndex))
                        )
                )

                // Restart playback from current position
                pendingSource?.let { url ->
                    p.stop()
                    p.clearMediaItems()
                    loadMedia(url)

                    // Restore position after a short delay
                    android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                        if (currentPosition > 0) {
                            player?.seekTo(currentPosition)
                        }
                        // Reset recovery flag after successful recovery
                        android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                            audioRecoveryAttempted = false
                        }, 2000)
                    }, 500)
                }
                return
            }
        }

        // No supported track found
        Log.w(TAG, "No supported audio tracks found for recovery")
        onErrorCallback?.invoke("No supported audio formats available on this device")
    }

    private fun parseAndSendTracks(tracks: Tracks) {
        val audioTracks = mutableListOf<Map<String, Any>>()
        val subtitleTracks = mutableListOf<Map<String, Any>>()

        // Cache codec support checks to avoid repeated queries
        val codecSupportCache = mutableMapOf<String, Boolean>()

        for (group in tracks.groups) {
            val trackGroup = group.mediaTrackGroup
            for (i in 0 until trackGroup.length) {
                val format = trackGroup.getFormat(i)
                val trackType = format.sampleMimeType ?: continue

                when {
                    trackType.startsWith("audio/") -> {
                        // Check if this audio codec is supported
                        val isSupported = codecSupportCache.getOrPut(trackType) {
                            isAudioCodecSupported(trackType)
                        }

                        // Build track name with codec info
                        val baseName = format.label ?: format.language?.uppercase() ?: "Audio ${i + 1}"
                        val codecName = format.codecs ?: trackType.removePrefix("audio/").uppercase()
                        val displayName = if (!isSupported) {
                            "$baseName ($codecName - Unsupported)"
                        } else {
                            baseName
                        }

                        val track = mapOf(
                            "id" to i,
                            "name" to displayName,
                            "language" to (format.language ?: ""),
                            "codec" to (format.codecs ?: trackType),
                            "supported" to isSupported
                        )
                        audioTracks.add(track)
                        Log.d(TAG, "Found audio track: $track (supported=$isSupported)")
                    }
                    trackType.startsWith("text/") || trackType == MimeTypes.APPLICATION_SUBRIP -> {
                        val track = mapOf(
                            "id" to i,
                            "name" to (format.label ?: format.language?.uppercase() ?: "Subtitle ${i + 1}"),
                            "language" to (format.language ?: ""),
                            "codec" to (format.codecs ?: trackType)
                        )
                        subtitleTracks.add(track)
                        Log.d(TAG, "Found subtitle track: $track")
                    }
                }
            }
        }

        Log.d(TAG, "Sending tracks - Audio: ${audioTracks.size}, Subtitles: ${subtitleTracks.size}")
        onTracksChangedCallback?.invoke(audioTracks, subtitleTracks)
    }

    private fun updateAspectRatio(videoSize: VideoSize) {
        if (videoSize.width == 0 || videoSize.height == 0) return

        val videoAspect = videoSize.width.toFloat() / videoSize.height.toFloat()
        val viewAspect = width.toFloat() / height.toFloat()

        surfaceView?.let { sv ->
            val lp = sv.layoutParams as LayoutParams

            when (resizeMode) {
                "contain" -> {
                    if (videoAspect > viewAspect) {
                        lp.width = width
                        lp.height = (width / videoAspect).toInt()
                    } else {
                        lp.height = height
                        lp.width = (height * videoAspect).toInt()
                    }
                    lp.gravity = android.view.Gravity.CENTER
                }
                "cover" -> {
                    if (videoAspect > viewAspect) {
                        lp.height = height
                        lp.width = (height * videoAspect).toInt()
                    } else {
                        lp.width = width
                        lp.height = (width / videoAspect).toInt()
                    }
                    lp.gravity = android.view.Gravity.CENTER
                }
                "stretch" -> {
                    lp.width = width
                    lp.height = height
                }
            }

            sv.layoutParams = lp
        }
    }

    private fun startProgressUpdates() {
        progressHandler.removeCallbacks(progressRunnable)
        progressHandler.post(progressRunnable)
    }

    private fun stopProgressUpdates() {
        progressHandler.removeCallbacks(progressRunnable)
    }

    private fun retryPlayback() {
        Log.d(TAG, "Retrying playback after transient error")
        val p = player ?: return
        val currentPosition = p.currentPosition

        pendingSource?.let { url ->
            p.stop()
            p.clearMediaItems()
            loadMedia(url)

            // Restore position after a short delay
            android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                if (currentPosition > 0) {
                    player?.seekTo(currentPosition)
                }
            }, 500)
        }
    }

    private fun attemptDolbyVisionRecovery() {
        Log.d(TAG, "Attempting Dolby Vision recovery - constraining to lower resolution")

        val p = player ?: return
        val selector = trackSelector ?: return

        // Strategy: Constrain video to 1080p max, which often excludes DV variants
        // Many streaming services only offer DV at 4K, so 1080p should be HEVC-only
        selector.setParameters(
            selector.buildUponParameters()
                // Constrain to 1080p - this often excludes DV variants which are 4K-only
                .setMaxVideoSize(1920, 1080)
                .setMaxVideoBitrate(15_000_000) // 15 Mbps max
                // Prefer non-DV codecs
                .setPreferredVideoMimeTypes(MimeTypes.VIDEO_H265, MimeTypes.VIDEO_H264, MimeTypes.VIDEO_VP9)
                .setExceedRendererCapabilitiesIfNecessary(false)
                .setExceedVideoConstraintsIfNecessary(false)
        )

        Log.d(TAG, "Set 1080p constraint - reloading media")

        // Retry playback with new constraints
        pendingSource?.let { url ->
            p.stop()
            p.clearMediaItems()
            loadMedia(url)

            // Reset retry flag after a delay
            android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                retryingWithoutDV = false
            }, 3000)
        }
    }

    private fun retryWithoutDolbyVision() {
        Log.d(TAG, "Retrying playback without Dolby Vision")

        // Constrain to non-DV codecs
        trackSelector?.setParameters(
            trackSelector!!.buildUponParameters()
                // Constrain to 4K max which helps avoid unsupported DV profiles
                .setMaxVideoSize(3840, 2160)
                // Explicitly exclude Dolby Vision
                .setExceedVideoConstraintsIfNecessary(false)
                // Prefer HEVC over DV
                .setPreferredVideoMimeType(MimeTypes.VIDEO_H265)
                .setPreferredVideoMimeTypes(MimeTypes.VIDEO_H265, MimeTypes.VIDEO_H264, MimeTypes.VIDEO_VP9)
        )

        // Retry playback
        pendingSource?.let { url ->
            player?.stop()
            player?.clearMediaItems()
            loadMedia(url)
            retryingWithoutDV = false
        }
    }

    private fun loadMedia(url: String) {
        Log.d(TAG, "Loading media: $url")
        // Reset flags for new media
        hasReportedLoad = false
        // Note: Don't reset audioRecoveryAttempted here as it's managed by the recovery process

        val dataSourceFactory = if (httpHeaders?.isNotEmpty() == true) {
            DefaultHttpDataSource.Factory().apply {
                setDefaultRequestProperties(httpHeaders!!)
            }
        } else {
            DefaultHttpDataSource.Factory()
        }

        val mediaItem = MediaItem.Builder()
            .setUri(Uri.parse(url))
            .build()

        // Check if this is an HLS stream
        val isHls = url.contains(".m3u8", ignoreCase = true) ||
                    url.contains("hls", ignoreCase = true) ||
                    url.contains("/manifest", ignoreCase = true)

        if (isHls) {
            Log.d(TAG, "Using HLS media source")

            // Create HLS media source factory
            // DV filtering is handled by the track selector and codec selector
            val hlsMediaSourceFactory = HlsMediaSource.Factory(dataSourceFactory)

            player?.apply {
                setMediaSource(hlsMediaSourceFactory.createMediaSource(mediaItem))
                prepare()
            }
        } else {
            Log.d(TAG, "Using default media source factory")
            val mediaSourceFactory = DefaultMediaSourceFactory(dataSourceFactory)

            player?.apply {
                setMediaSource(mediaSourceFactory.createMediaSource(mediaItem))
                prepare()
            }
        }
    }

    // Public API

    fun setDataSource(url: String) {
        Log.d(TAG, "setDataSource: $url")
        pendingSource = url

        if (player == null) {
            initializePlayer()
        } else {
            loadMedia(url)
        }
    }

    fun setHeaders(headers: Map<String, String>?) {
        Log.d(TAG, "setHeaders: $headers")
        httpHeaders = headers
    }

    fun setPaused(paused: Boolean) {
        Log.d(TAG, "setPaused: $paused, player=${player != null}, currentPlayWhenReady=${player?.playWhenReady}")
        isPaused = paused
        player?.playWhenReady = !paused
        Log.d(TAG, "After setPaused: playWhenReady=${player?.playWhenReady}, isPlaying=${player?.isPlaying}")
    }

    fun seekTo(positionSeconds: Double) {
        Log.d(TAG, "seekTo: $positionSeconds")
        player?.seekTo((positionSeconds * 1000).toLong())
    }

    fun setVolume(volume: Double) {
        currentVolume = volume.toFloat()
        player?.volume = currentVolume
    }

    fun setSpeed(speed: Double) {
        currentRate = speed.toFloat()
        player?.setPlaybackSpeed(currentRate)
    }

    fun setAudioTrack(trackId: Int) {
        Log.d(TAG, "setAudioTrack: $trackId")
        val player = player ?: return
        val trackSelector = trackSelector ?: return

        if (trackId == -1) {
            // Disable audio
            trackSelector.setParameters(
                trackSelector.buildUponParameters()
                    .setTrackTypeDisabled(C.TRACK_TYPE_AUDIO, true)
            )
        } else {
            // Find and select the audio track
            val tracks = player.currentTracks
            for (group in tracks.groups) {
                if (group.type == C.TRACK_TYPE_AUDIO) {
                    val trackGroup = group.mediaTrackGroup
                    if (trackId < trackGroup.length) {
                        // Check if the selected codec is supported
                        val format = trackGroup.getFormat(trackId)
                        val mimeType = format.sampleMimeType ?: ""
                        val isSupported = isAudioCodecSupported(mimeType)

                        if (!isSupported) {
                            Log.w(TAG, "Selected audio track $trackId uses unsupported codec: $mimeType")
                            // Find first supported audio track as fallback
                            var fallbackTrackId: Int? = null
                            for (i in 0 until trackGroup.length) {
                                val fallbackFormat = trackGroup.getFormat(i)
                                val fallbackMimeType = fallbackFormat.sampleMimeType ?: ""
                                if (isAudioCodecSupported(fallbackMimeType)) {
                                    fallbackTrackId = i
                                    Log.d(TAG, "Found supported fallback audio track: $i ($fallbackMimeType)")
                                    break
                                }
                            }

                            if (fallbackTrackId != null) {
                                // Use the fallback track
                                trackSelector.setParameters(
                                    trackSelector.buildUponParameters()
                                        .setTrackTypeDisabled(C.TRACK_TYPE_AUDIO, false)
                                        .setOverrideForType(
                                            TrackSelectionOverride(trackGroup, listOf(fallbackTrackId))
                                        )
                                )
                                onErrorCallback?.invoke("Audio format not supported on this device. Using fallback audio track.")
                            } else {
                                // No supported tracks found, try anyway (might fail)
                                Log.w(TAG, "No supported audio tracks found, attempting to use unsupported track")
                                trackSelector.setParameters(
                                    trackSelector.buildUponParameters()
                                        .setTrackTypeDisabled(C.TRACK_TYPE_AUDIO, false)
                                        .setOverrideForType(
                                            TrackSelectionOverride(trackGroup, listOf(trackId))
                                        )
                                )
                            }
                        } else {
                            // Codec is supported, select normally
                            trackSelector.setParameters(
                                trackSelector.buildUponParameters()
                                    .setTrackTypeDisabled(C.TRACK_TYPE_AUDIO, false)
                                    .setOverrideForType(
                                        TrackSelectionOverride(trackGroup, listOf(trackId))
                                    )
                            )
                        }
                        break
                    }
                }
            }
        }
    }

    fun setSubtitleTrack(trackId: Int) {
        Log.d(TAG, "setSubtitleTrack: $trackId")
        val player = player ?: return
        val trackSelector = trackSelector ?: return

        if (trackId == -1) {
            // Disable subtitles
            trackSelector.setParameters(
                trackSelector.buildUponParameters()
                    .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
            )
        } else {
            // Find and select the subtitle track
            val tracks = player.currentTracks
            for (group in tracks.groups) {
                if (group.type == C.TRACK_TYPE_TEXT) {
                    val trackGroup = group.mediaTrackGroup
                    if (trackId < trackGroup.length) {
                        trackSelector.setParameters(
                            trackSelector.buildUponParameters()
                                .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, false)
                                .setOverrideForType(
                                    TrackSelectionOverride(trackGroup, listOf(trackId))
                                )
                        )
                        break
                    }
                }
            }
        }
    }

    fun setResizeMode(mode: String) {
        Log.d(TAG, "setResizeMode: $mode")
        resizeMode = mode
        player?.videoSize?.let { updateAspectRatio(it) }
    }

    fun release() {
        Log.d(TAG, "Releasing player")
        stopProgressUpdates()
        player?.release()
        player = null
        trackSelector = null
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        release()
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        if (player == null && pendingSource != null) {
            initializePlayer()
        }
    }
}
