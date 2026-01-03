package com.nuvio.tv.ui.screens.player

import android.content.Context
import android.util.Log
import android.view.SurfaceView
import android.view.View
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.media3.exoplayer.ExoPlayer
import com.nuvio.tv.data.repository.ContentRepository
import com.nuvio.tv.data.repository.SettingsRepository
import com.nuvio.tv.domain.model.Stream
import com.nuvio.tv.domain.model.Subtitle
import com.nuvio.tv.player.PlaybackRequest
import com.nuvio.tv.player.PlaybackStateHolder
import com.nuvio.tv.player.engine.EngineAudioTrack
import com.nuvio.tv.player.engine.EngineSubtitleTrack
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
 * UI state for the Nuvio player.
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
    val engineSwitchReason: String? = null,
    // Loading state
    val isLoading: Boolean = true,
    val loadingMessage: String = "Loading...",
    // External subtitles from addons
    val externalSubtitles: List<Subtitle> = emptyList(),
    val selectedExternalSubtitleIndex: Int = -1,
    // Content info for loading screen
    val contentTitle: String? = null,
    val contentPoster: String? = null,
    val contentLogo: String? = null
)

/**
 * ViewModel for the unified Nuvio player.
 * Manages the UnifiedPlayer and exposes state to the UI.
 */
@HiltViewModel
class UnifiedPlayerViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val unifiedPlayer: UnifiedPlayer,
    private val playbackStateHolder: PlaybackStateHolder,
    private val contentRepository: ContentRepository,
    private val settingsRepository: SettingsRepository
) : ViewModel() {

    companion object {
        private const val TAG = "UnifiedPlayerVM"
    }

    val playerState: StateFlow<UnifiedPlayerState> = unifiedPlayer.state

    private val _uiState = MutableStateFlow(PlayerUiState())
    val uiState: StateFlow<PlayerUiState> = _uiState.asStateFlow()

    private var isInitialized = false
    private var currentStream: Stream? = null
    private var cachedPlaybackRequest: PlaybackRequest? = null
    private var subtitlesLoaded = false
    private var autoSelectApplied = false

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

        // Observe player state to detect when playback starts and apply auto-selection
        viewModelScope.launch {
            unifiedPlayer.state.collect { state ->
                // Hide loading when video starts playing
                if (state.engineState.isPlaying && _uiState.value.isLoading) {
                    _uiState.update { it.copy(isLoading = false) }
                }

                // Apply auto-selection when tracks become available
                if (!autoSelectApplied && state.engineState.audioTracks.isNotEmpty()) {
                    applyAutoSelection(state)
                }
            }
        }
    }

    /**
     * Apply auto-selection of audio and subtitle tracks based on user preferences.
     */
    private fun applyAutoSelection(state: UnifiedPlayerState) {
        if (autoSelectApplied) return
        autoSelectApplied = true

        val preferredAudioLang = settingsRepository.getPreferredAudioLanguage()
        val preferredSubtitleLang = settingsRepository.getPreferredSubtitleLanguage()
        val subtitleSourcePriority = settingsRepository.getSubtitleSourcePriority()

        Log.d(TAG, "Applying auto-selection: audio=$preferredAudioLang, subtitle=$preferredSubtitleLang, source=$subtitleSourcePriority")

        // Auto-select audio track
        autoSelectAudioTrack(state.engineState.audioTracks, preferredAudioLang)

        // Auto-select subtitle track (if not "none")
        if (preferredSubtitleLang != "none") {
            autoSelectSubtitleTrack(
                embeddedTracks = state.engineState.subtitleTracks,
                externalSubtitles = _uiState.value.externalSubtitles,
                preferredLang = preferredSubtitleLang,
                preferEmbedded = subtitleSourcePriority == "embedded"
            )
        } else {
            Log.d(TAG, "Subtitle auto-selection disabled (set to 'none')")
        }
    }

    /**
     * Auto-select audio track based on preferred language.
     * Falls back to the default track if preferred language is not found.
     */
    private fun autoSelectAudioTrack(tracks: List<EngineAudioTrack>, preferredLang: String) {
        if (tracks.isEmpty()) {
            Log.d(TAG, "No audio tracks available for auto-selection")
            return
        }

        // Find track matching preferred language
        val matchingTrack = tracks.indexOfFirst { track ->
            matchesLanguage(track.language, preferredLang)
        }

        if (matchingTrack >= 0) {
            Log.d(TAG, "Auto-selecting audio track $matchingTrack (matches $preferredLang)")
            selectAudioTrack(matchingTrack)
        } else {
            // Find default track
            val defaultTrack = tracks.indexOfFirst { it.isDefault }
            if (defaultTrack >= 0) {
                Log.d(TAG, "Preferred audio language not found, using default track $defaultTrack")
                selectAudioTrack(defaultTrack)
            } else {
                Log.d(TAG, "No matching or default audio track found")
            }
        }
    }

    /**
     * Auto-select subtitle track based on preferred language and source priority.
     */
    private fun autoSelectSubtitleTrack(
        embeddedTracks: List<EngineSubtitleTrack>,
        externalSubtitles: List<Subtitle>,
        preferredLang: String,
        preferEmbedded: Boolean
    ) {
        Log.d(TAG, "Auto-selecting subtitles: ${embeddedTracks.size} embedded, ${externalSubtitles.size} external")

        // Try primary source first, then fallback
        val foundInPrimary = if (preferEmbedded) {
            trySelectEmbeddedSubtitle(embeddedTracks, preferredLang)
        } else {
            trySelectExternalSubtitle(externalSubtitles, preferredLang)
        }

        if (!foundInPrimary) {
            // Try fallback source
            val foundInFallback = if (preferEmbedded) {
                trySelectExternalSubtitle(externalSubtitles, preferredLang)
            } else {
                trySelectEmbeddedSubtitle(embeddedTracks, preferredLang)
            }

            if (!foundInFallback) {
                Log.d(TAG, "No subtitle matching $preferredLang found in either source")
            }
        }
    }

    /**
     * Try to select an embedded subtitle track matching the preferred language.
     * Returns true if found and selected.
     */
    private fun trySelectEmbeddedSubtitle(tracks: List<EngineSubtitleTrack>, preferredLang: String): Boolean {
        val matchingIndex = tracks.indexOfFirst { track ->
            matchesLanguage(track.language, preferredLang)
        }

        if (matchingIndex >= 0) {
            Log.d(TAG, "Auto-selecting embedded subtitle track $matchingIndex")
            selectSubtitleTrack(matchingIndex)
            return true
        }
        return false
    }

    /**
     * Try to select an external subtitle matching the preferred language.
     * Returns true if found and selected.
     */
    private fun trySelectExternalSubtitle(subtitles: List<Subtitle>, preferredLang: String): Boolean {
        val matchingIndex = subtitles.indexOfFirst { subtitle ->
            matchesLanguage(subtitle.lang, preferredLang)
        }

        if (matchingIndex >= 0) {
            Log.d(TAG, "Auto-selecting external subtitle $matchingIndex")
            selectExternalSubtitle(matchingIndex)
            return true
        }
        return false
    }

    /**
     * Check if a track language matches the preferred language.
     * Handles various language code formats (ISO 639-1, ISO 639-2, full names).
     */
    private fun matchesLanguage(trackLang: String?, preferredLang: String): Boolean {
        if (trackLang.isNullOrBlank()) return false

        val track = trackLang.lowercase().trim()
        val preferred = preferredLang.lowercase().trim()

        // Direct match
        if (track == preferred) return true

        // Map common language codes
        val languageMap = mapOf(
            "eng" to listOf("en", "english"),
            "spa" to listOf("es", "spanish", "español"),
            "fra" to listOf("fr", "french", "français"),
            "deu" to listOf("de", "german", "deutsch"),
            "ita" to listOf("it", "italian", "italiano"),
            "por" to listOf("pt", "portuguese", "português"),
            "rus" to listOf("ru", "russian", "русский"),
            "jpn" to listOf("ja", "japanese", "日本語"),
            "kor" to listOf("ko", "korean", "한국어"),
            "zho" to listOf("zh", "chi", "chinese", "中文"),
            "ara" to listOf("ar", "arabic", "العربية"),
            "hin" to listOf("hi", "hindi", "हिन्दी"),
            "pol" to listOf("pl", "polish", "polski"),
            "tur" to listOf("tr", "turkish", "türkçe"),
            "nld" to listOf("nl", "dutch", "nederlands"),
            "swe" to listOf("sv", "swedish", "svenska"),
            "nor" to listOf("no", "norwegian", "norsk"),
            "dan" to listOf("da", "danish", "dansk"),
            "fin" to listOf("fi", "finnish", "suomi")
        )

        // Check if preferred code maps to track language
        val preferredAliases = languageMap[preferred] ?: emptyList()
        if (track in preferredAliases || track == preferred) return true

        // Check if track code maps to preferred language
        for ((code, aliases) in languageMap) {
            if (preferred == code || preferred in aliases) {
                if (track == code || track in aliases) return true
            }
        }

        return false
    }

    /**
     * Initialize the unified player.
     */
    fun initialize() {
        if (isInitialized) return
        unifiedPlayer.initialize(context)
    }

    /**
     * Play a stream and load external subtitles.
     */
    fun playStream(stream: Stream, startPosition: Long = 0L) {
        currentStream = stream
        val headers = stream.headers ?: emptyMap()

        // Set loading state with content info
        val request = cachedPlaybackRequest
        _uiState.update {
            it.copy(
                isLoading = true,
                loadingMessage = "Loading stream...",
                contentTitle = request?.content?.name,
                contentPoster = request?.content?.poster,
                contentLogo = request?.content?.logo
            )
        }

        unifiedPlayer.playStream(stream, startPosition, headers)

        // Load subtitles from the playback request and addons
        loadSubtitles()
    }

    /**
     * Load subtitles from playback request and fetch additional from addons.
     */
    private fun loadSubtitles() {
        if (subtitlesLoaded) return
        subtitlesLoaded = true

        viewModelScope.launch {
            val request = cachedPlaybackRequest ?: return@launch

            // Combine subtitles from:
            // 1. PlaybackRequest (already fetched by StreamsViewModel)
            // 2. Stream's embedded subtitles (if any)
            val requestSubtitles = request.subtitles
            val streamSubtitles = request.stream.subtitles

            // Merge and deduplicate subtitles
            val allExternalSubtitles = (requestSubtitles + streamSubtitles)
                .distinctBy { it.url }

            _uiState.update { it.copy(externalSubtitles = allExternalSubtitles) }

            // If no subtitles from request, try to fetch from addons
            if (allExternalSubtitles.isEmpty()) {
                val contentId = request.episodeId ?: request.content?.id ?: return@launch
                val contentType = request.content?.type ?: "movie"

                try {
                    val addonSubtitles = contentRepository.getSubtitles(contentType, contentId)
                    _uiState.update { it.copy(externalSubtitles = addonSubtitles) }
                } catch (e: Exception) {
                    // Subtitles are optional, don't fail playback
                }
            }
        }
    }

    /**
     * Select an external subtitle from addons.
     */
    fun selectExternalSubtitle(index: Int) {
        Log.d(TAG, "selectExternalSubtitle called with index: $index")
        val subtitles = _uiState.value.externalSubtitles
        Log.d(TAG, "  Available external subtitles: ${subtitles.size}")

        if (index < 0 || index >= subtitles.size) {
            // Deselect external subtitle
            Log.d(TAG, "  Deselecting external subtitle")
            _uiState.update { it.copy(selectedExternalSubtitleIndex = -1) }
            return
        }

        val subtitle = subtitles[index]
        Log.d(TAG, "  Selected subtitle: url=${subtitle.url}, lang=${subtitle.lang}, label=${subtitle.label}")
        _uiState.update { it.copy(selectedExternalSubtitleIndex = index) }

        // Determine MIME type from format or URL
        val mimeType = when {
            subtitle.format?.contains("vtt", ignoreCase = true) == true -> "text/vtt"
            subtitle.format?.contains("srt", ignoreCase = true) == true -> "application/x-subrip"
            subtitle.format?.contains("ass", ignoreCase = true) == true -> "text/x-ssa"
            subtitle.url.endsWith(".vtt", ignoreCase = true) -> "text/vtt"
            subtitle.url.endsWith(".srt", ignoreCase = true) -> "application/x-subrip"
            subtitle.url.endsWith(".ass", ignoreCase = true) -> "text/x-ssa"
            subtitle.url.endsWith(".ssa", ignoreCase = true) -> "text/x-ssa"
            else -> "text/vtt" // Default to VTT
        }

        Log.d(TAG, "  Adding external subtitle with mimeType: $mimeType")
        unifiedPlayer.addExternalSubtitle(
            url = subtitle.url,
            language = subtitle.lang,
            label = subtitle.label ?: subtitle.lang,
            mimeType = mimeType
        )
    }

    /**
     * Mark loading as complete when playback starts.
     */
    fun onPlaybackStarted() {
        _uiState.update { it.copy(isLoading = false) }
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
     * Select subtitle track (embedded).
     */
    fun selectSubtitleTrack(index: Int) {
        Log.d(TAG, "selectSubtitleTrack called with index: $index")
        Log.d(TAG, "  Active engine: ${unifiedPlayer.getActiveEngineType()}")
        Log.d(TAG, "  Available embedded tracks: ${playerState.value.engineState.subtitleTracks.size}")
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
     * Get the ExoPlayer's PlayerView with subtitle support.
     */
    fun getExoPlayerView(): android.view.View? {
        return unifiedPlayer.getExoPlayerEngine().getVideoView()
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
        subtitlesLoaded = false
        autoSelectApplied = false
        _uiState.update { PlayerUiState() }
    }

    override fun onCleared() {
        super.onCleared()
        release()
    }
}
