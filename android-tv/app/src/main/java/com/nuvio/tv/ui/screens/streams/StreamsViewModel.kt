package com.nuvio.tv.ui.screens.streams

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nuvio.tv.data.repository.ContentRepository
import com.nuvio.tv.data.repository.SettingsRepository
import com.nuvio.tv.domain.model.Stream
import com.nuvio.tv.domain.model.StreamingContent
import com.nuvio.tv.domain.model.Subtitle
import com.nuvio.tv.player.PlaybackRequest
import com.nuvio.tv.player.PlaybackStateHolder
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Stream grouped by addon source.
 */
data class StreamGroup(
    val addonId: String,
    val addonName: String,
    val streams: List<Stream>,
    val isLoading: Boolean = false
)

/**
 * UI state for streams screen.
 */
data class StreamsUiState(
    val isLoading: Boolean = true,
    val error: String? = null,
    val content: StreamingContent? = null,
    val episodeTitle: String? = null,
    val streamGroups: List<StreamGroup> = emptyList(),
    val subtitles: List<Subtitle> = emptyList(),
    val selectedStream: Stream? = null,
    val totalStreams: Int = 0,
    val loadingAddons: Set<String> = emptySet()
)

/**
 * ViewModel for the Streams selection screen.
 * Fetches streams from all installed addons in parallel.
 */
@HiltViewModel
class StreamsViewModel @Inject constructor(
    private val contentRepository: ContentRepository,
    private val settingsRepository: SettingsRepository,
    private val playbackStateHolder: PlaybackStateHolder
) : ViewModel() {

    private val _uiState = MutableStateFlow(StreamsUiState())
    val uiState: StateFlow<StreamsUiState> = _uiState.asStateFlow()

    private var contentType: String = ""
    private var contentId: String = ""
    private var episodeId: String? = null

    /**
     * Set the selected stream and prepare for navigation.
     * Call this before navigating to the player screen.
     */
    fun selectStream(stream: Stream) {
        _uiState.update { it.copy(selectedStream = stream) }

        // Set the playback request for the player to consume
        playbackStateHolder.setPlaybackRequest(
            PlaybackRequest(
                stream = stream,
                content = _uiState.value.content,
                episodeId = episodeId,
                episodeTitle = _uiState.value.episodeTitle,
                subtitles = _uiState.value.subtitles
            )
        )
    }

    /**
     * Load streams for content.
     */
    fun loadStreams(type: String, id: String, episodeId: String? = null) {
        this.contentType = type
        this.contentId = id
        this.episodeId = episodeId

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null, streamGroups = emptyList()) }

            try {
                // Load content metadata first
                val content = contentRepository.getMetadata(type, id)
                _uiState.update { it.copy(content = content) }

                // Set episode title if this is an episode
                if (episodeId != null && type == "series") {
                    val episodeTitle = parseEpisodeTitle(episodeId)
                    _uiState.update { it.copy(episodeTitle = episodeTitle) }
                }

                // Collect streams from all addons as they arrive
                val streamId = episodeId ?: id

                contentRepository.getStreams(type, streamId).collect { streamsResult ->
                    val addonId = streamsResult.first
                    val addonStreams = streamsResult.second

                    updateStreamGroups(addonId, addonStreams)
                }

                // Mark loading as complete
                _uiState.update { it.copy(isLoading = false) }

                // Load subtitles
                loadSubtitles(type, episodeId ?: id)

            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        error = e.message ?: "Failed to load streams"
                    )
                }
            }
        }
    }

    private fun updateStreamGroups(addonId: String, newStreams: List<Stream>) {
        val sortedStreams = sortStreams(newStreams)

        _uiState.update { currentState ->
            val existingGroups = currentState.streamGroups.toMutableList()
            val existingGroupIndex = existingGroups.indexOfFirst { it.addonId == addonId }

            val addonName = newStreams.firstOrNull()?.addonName ?: addonId

            if (existingGroupIndex >= 0) {
                // Update existing group
                existingGroups[existingGroupIndex] = StreamGroup(
                    addonId = addonId,
                    addonName = addonName,
                    streams = sortedStreams,
                    isLoading = false
                )
            } else {
                // Add new group
                existingGroups.add(
                    StreamGroup(
                        addonId = addonId,
                        addonName = addonName,
                        streams = sortedStreams,
                        isLoading = false
                    )
                )
            }

            val totalStreams = existingGroups.sumOf { it.streams.size }

            currentState.copy(
                streamGroups = existingGroups,
                totalStreams = totalStreams,
                loadingAddons = currentState.loadingAddons - addonId
            )
        }
    }

    private fun sortStreams(streams: List<Stream>): List<Stream> {
        val sortMode = settingsRepository.getStreamSortMode()

        return when (sortMode) {
            "addon_order" -> {
                // Respect addon's original sorting order
                // Only move cached/instant streams to the top, but keep their relative order
                // This preserves the sorting that Stremio addons provide (often by relevance, seeds, etc.)
                val cached = streams.filter { it.isCached }
                val debrid = streams.filter { it.isDebrid && !it.isCached }
                val others = streams.filter { !it.isDebrid && !it.isCached }
                cached + debrid + others
            }
            "size" -> {
                // Cached first, then sort by file size (largest first), then by quality
                streams.sortedWith(
                    compareByDescending<Stream> { it.isCached }
                        .thenByDescending { it.isDebrid }
                        .thenByDescending { it.size ?: 0 }
                        .thenByDescending { getQualityPriority(it.parsedQuality ?: it.quality) }
                )
            }
            "addon" -> {
                // Cached first, then sort by addon name, then by quality within each addon
                streams.sortedWith(
                    compareByDescending<Stream> { it.isCached }
                        .thenByDescending { it.isDebrid }
                        .thenBy { it.addonName }
                        .thenByDescending { getQualityPriority(it.parsedQuality ?: it.quality) }
                        .thenByDescending { it.size ?: 0 }
                )
            }
            "quality" -> {
                // Sort by quality (4K > 1080p > 720p > 480p), then by size
                streams.sortedWith(
                    compareByDescending<Stream> { it.isCached }
                        .thenByDescending { it.isDebrid }
                        .thenByDescending { getQualityPriority(it.parsedQuality ?: it.quality) }
                        .thenByDescending { it.size ?: 0 }
                )
            }
            else -> {
                // Fallback to addon_order (default)
                val cached = streams.filter { it.isCached }
                val debrid = streams.filter { it.isDebrid && !it.isCached }
                val others = streams.filter { !it.isDebrid && !it.isCached }
                cached + debrid + others
            }
        }
    }

    private fun getQualityPriority(quality: String?): Int {
        if (quality == null) return 0

        val qualityLower = quality.lowercase()
        return when {
            qualityLower.contains("4k") || qualityLower.contains("2160") -> 5
            qualityLower.contains("1080") -> 4
            qualityLower.contains("720") -> 3
            qualityLower.contains("480") -> 2
            qualityLower.contains("360") -> 1
            else -> 0
        }
    }

    private suspend fun loadSubtitles(type: String, id: String) {
        try {
            val subtitles = contentRepository.getSubtitles(type, id)

            // Sort by preferred language if set
            val preferredLang = settingsRepository.getPreferredSubtitleLanguage()
            val sortedSubtitles = if (preferredLang != null) {
                subtitles.sortedByDescending { it.lang.equals(preferredLang, ignoreCase = true) }
            } else {
                subtitles
            }

            _uiState.update { it.copy(subtitles = sortedSubtitles) }
        } catch (e: Exception) {
            // Subtitles are optional, don't fail the whole screen
        }
    }

    /**
     * Clear selected stream.
     */
    fun clearSelection() {
        _uiState.update { it.copy(selectedStream = null) }
    }

    /**
     * Refresh streams.
     */
    fun refresh() {
        loadStreams(contentType, contentId, episodeId)
    }

    /**
     * Get the playback URL for the selected stream.
     */
    fun getPlaybackUrl(stream: Stream): String? {
        return stream.url ?: stream.externalUrl
    }

    /**
     * Check if debrid service is configured.
     */
    fun hasDebridConfigured(): Boolean {
        return settingsRepository.hasDebridConfigured()
    }

    private fun parseEpisodeTitle(episodeId: String): String? {
        // Episode ID format: "tt1234567:1:5" (imdbId:season:episode)
        val parts = episodeId.split(":")
        if (parts.size >= 3) {
            val season = parts.getOrNull(1)?.toIntOrNull() ?: return null
            val episode = parts.getOrNull(2)?.toIntOrNull() ?: return null
            return "S${season} E${episode}"
        }
        return null
    }
}
