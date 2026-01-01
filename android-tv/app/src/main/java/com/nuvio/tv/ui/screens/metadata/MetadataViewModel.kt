package com.nuvio.tv.ui.screens.metadata

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nuvio.tv.data.repository.ContentRepository
import com.nuvio.tv.data.repository.LibraryRepository
import com.nuvio.tv.data.repository.TraktRepository
import com.nuvio.tv.data.repository.WatchProgressRepository
import com.nuvio.tv.domain.model.CastMember
import com.nuvio.tv.domain.model.Episode
import com.nuvio.tv.domain.model.Season
import com.nuvio.tv.domain.model.StreamingContent
import com.nuvio.tv.domain.model.TrailerStream
import com.nuvio.tv.domain.model.WatchProgress
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * UI state for the Metadata screen.
 */
data class MetadataUiState(
    val isLoading: Boolean = true,
    val isLoadingEpisodes: Boolean = false,
    val error: String? = null,
    val content: StreamingContent? = null,
    val cast: List<CastMember> = emptyList(),
    val seasons: List<Season> = emptyList(),
    val selectedSeason: Int = 1,
    val episodes: List<Episode> = emptyList(),
    val recommendations: List<StreamingContent> = emptyList(),
    val trailers: List<TrailerStream> = emptyList(),
    val isInLibrary: Boolean = false,
    val isInWatchlist: Boolean = false,
    val isTraktAuthenticated: Boolean = false,
    val watchProgress: WatchProgress? = null,
    val nextEpisode: Episode? = null
)

/**
 * ViewModel for the Metadata/Details screen.
 * Loads content details, cast, episodes (for series), and recommendations.
 */
@HiltViewModel
class MetadataViewModel @Inject constructor(
    private val savedStateHandle: SavedStateHandle,
    private val contentRepository: ContentRepository,
    private val libraryRepository: LibraryRepository,
    private val traktRepository: TraktRepository,
    private val watchProgressRepository: WatchProgressRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(MetadataUiState())
    val uiState: StateFlow<MetadataUiState> = _uiState.asStateFlow()

    // Content identifiers from navigation
    private var contentType: String = ""
    private var contentId: String = ""

    init {
        // Check Trakt authentication status
        viewModelScope.launch {
            traktRepository.isAuthenticatedFlow.collect { isAuthenticated ->
                _uiState.update { it.copy(isTraktAuthenticated = isAuthenticated) }
            }
        }
    }

    /**
     * Load metadata for the specified content.
     */
    fun loadMetadata(type: String, id: String) {
        contentType = type
        contentId = id

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            try {
                // Load content in parallel
                val metadataDeferred = async { contentRepository.getMetadata(type, id) }
                val libraryStatusDeferred = async { libraryRepository.isInFavorites(id) }
                val watchlistStatusDeferred = async { libraryRepository.isInWatchlist(id) }
                val watchProgressDeferred = async { watchProgressRepository.getProgress(id) }
                val content = metadataDeferred.await()
                val isInLibrary = libraryStatusDeferred.await()
                val isInWatchlist = watchlistStatusDeferred.await()
                val watchProgress = watchProgressDeferred.await()

                // Load recommendations if we have a TMDB ID
                val recommendations = content?.tmdbId?.let { tmdbId ->
                    try {
                        contentRepository.getRecommendations(type, tmdbId)
                    } catch (e: Exception) {
                        emptyList()
                    }
                } ?: emptyList()

                if (content != null) {
                    // Build seasons list from content
                    val seasons = if (type == "series") {
                        content.seasons.map { seasonInfo ->
                            Season(
                                seasonNumber = seasonInfo.seasonNumber,
                                name = seasonInfo.name,
                                overview = seasonInfo.overview,
                                posterPath = seasonInfo.posterPath,
                                airDate = seasonInfo.airDate,
                                episodeCount = seasonInfo.episodeCount
                            )
                        }
                    } else {
                        emptyList()
                    }

                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            content = content,
                            cast = content.cast,
                            seasons = seasons,
                            trailers = content.trailerStreams,
                            recommendations = recommendations,
                            isInLibrary = isInLibrary,
                            isInWatchlist = isInWatchlist,
                            watchProgress = watchProgress
                        )
                    }

                    // Load episodes for the first season if this is a series
                    if (type == "series" && seasons.isNotEmpty()) {
                        loadEpisodes(1)
                    }
                } else {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            error = "Content not found"
                        )
                    }
                }

            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        error = e.message ?: "Failed to load content details"
                    )
                }
            }
        }
    }

    /**
     * Select and load episodes for a season.
     */
    fun selectSeason(seasonNumber: Int) {
        if (seasonNumber == _uiState.value.selectedSeason) return

        _uiState.update { it.copy(selectedSeason = seasonNumber) }
        loadEpisodes(seasonNumber)
    }

    private fun loadEpisodes(seasonNumber: Int) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingEpisodes = true) }

            try {
                val tmdbId = _uiState.value.content?.tmdbId ?: return@launch

                val imdbId = _uiState.value.content?.imdbId
                val episodes = contentRepository.getSeasonEpisodes(
                    tmdbId = tmdbId,
                    seasonNumber = seasonNumber,
                    imdbId = imdbId
                )

                // Find next unwatched episode
                val nextEpisode = findNextEpisode(episodes)

                _uiState.update {
                    it.copy(
                        isLoadingEpisodes = false,
                        episodes = episodes,
                        nextEpisode = nextEpisode
                    )
                }

            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoadingEpisodes = false,
                        episodes = emptyList()
                    )
                }
            }
        }
    }

    private suspend fun findNextEpisode(episodes: List<Episode>): Episode? {
        // Find first unwatched episode in the season
        for (episode in episodes) {
            val progress = watchProgressRepository.getProgress(contentId, episode.stremioId)
            if (progress == null || !progress.isWatched) {
                return episode
            }
        }
        return episodes.firstOrNull() // Default to first if all watched
    }

    /**
     * Toggle favorite status.
     */
    fun toggleLibrary() {
        val content = _uiState.value.content ?: return

        viewModelScope.launch {
            val newStatus = libraryRepository.toggleFavorite(content)
            _uiState.update { it.copy(isInLibrary = newStatus) }
        }
    }

    /**
     * Toggle watchlist status.
     */
    fun toggleWatchlist() {
        val content = _uiState.value.content ?: return

        viewModelScope.launch {
            val newStatus = libraryRepository.toggleWatchlist(content)
            _uiState.update { it.copy(isInWatchlist = newStatus) }

            // Also sync with Trakt if authenticated
            if (traktRepository.isAuthenticated()) {
                if (newStatus) {
                    traktRepository.addToWatchlist(content)
                } else {
                    traktRepository.removeFromWatchlist(content)
                }
            }
        }
    }

    /**
     * Mark content as watched.
     */
    fun markAsWatched() {
        viewModelScope.launch {
            val content = _uiState.value.content ?: return@launch

            if (content.isSeries) {
                // Mark current episode as watched
                val currentEpisode = _uiState.value.nextEpisode ?: return@launch
                val duration = currentEpisode.runtime?.let { it * 60 * 1000L } ?: 3600000L

                watchProgressRepository.markAsWatched(
                    contentId = contentId,
                    episodeId = currentEpisode.stremioId,
                    duration = duration
                )

                // Sync with Trakt
                if (traktRepository.isAuthenticated()) {
                    traktRepository.addToHistory(content, currentEpisode)
                }

                // Reload episodes to update next episode
                loadEpisodes(_uiState.value.selectedSeason)

            } else {
                // Mark movie as watched
                val duration = content.runtime?.replace(Regex("[^0-9]"), "")?.toLongOrNull()
                    ?.let { it * 60 * 1000 } ?: 7200000L

                watchProgressRepository.markAsWatched(contentId, duration = duration)

                // Sync with Trakt
                if (traktRepository.isAuthenticated()) {
                    traktRepository.addToHistory(content)
                }

                // Reload watch progress
                val newProgress = watchProgressRepository.getProgress(contentId)
                _uiState.update { it.copy(watchProgress = newProgress) }
            }
        }
    }

    /**
     * Get episode progress percentage.
     */
    suspend fun getEpisodeProgress(episode: Episode): Float {
        val progress = watchProgressRepository.getProgress(contentId, episode.stremioId)
        return progress?.progress ?: 0f
    }

    /**
     * Check if episode is watched.
     */
    suspend fun isEpisodeWatched(episode: Episode): Boolean {
        return watchProgressRepository.isCompleted(contentId, episode.stremioId)
    }

    /**
     * Refresh metadata.
     */
    fun refresh() {
        loadMetadata(contentType, contentId)
    }
}
