package com.nuvio.tv.ui.screens.home

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nuvio.tv.data.repository.AddonRepository
import com.nuvio.tv.data.repository.CatalogRepository
import com.nuvio.tv.data.repository.SettingsRepository
import com.nuvio.tv.data.repository.TraktCalendarItem
import com.nuvio.tv.data.repository.TraktRepository
import com.nuvio.tv.data.repository.WatchProgressRepository
import com.nuvio.tv.domain.model.CatalogContent
import com.nuvio.tv.domain.model.StreamingContent
import com.nuvio.tv.domain.model.WatchProgress
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * UI State for the Home Screen.
 */
data class HomeUiState(
    val isLoading: Boolean = true,
    val isRefreshing: Boolean = false,
    val error: String? = null,
    val hasAddons: Boolean = true,
    val featuredContent: List<StreamingContent> = emptyList(),
    val continueWatching: List<ContinueWatchingItem> = emptyList(),
    val thisWeek: List<ThisWeekItem> = emptyList(),
    val catalogs: List<CatalogContent> = emptyList(),
    val selectedFeaturedIndex: Int = 0
)

/**
 * Continue watching item with progress info.
 */
data class ContinueWatchingItem(
    val content: StreamingContent,
    val progress: WatchProgress,
    val episodeInfo: String? = null // e.g., "S2 E5 - Episode Title"
)

/**
 * This week item (upcoming episodes from Trakt calendar).
 */
data class ThisWeekItem(
    val showId: String,
    val showTitle: String,
    val poster: String? = null,
    val episodeInfo: String, // "S2 E5"
    val episodeTitle: String,
    val airDate: String
)

/**
 * ViewModel for the Home Screen.
 * Manages loading of featured content, continue watching, and catalog rows.
 */
@HiltViewModel
class HomeViewModel @Inject constructor(
    private val addonRepository: AddonRepository,
    private val catalogRepository: CatalogRepository,
    private val watchProgressRepository: WatchProgressRepository,
    private val traktRepository: TraktRepository,
    private val settingsRepository: SettingsRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    init {
        initializeRepositories()
        observeContinueWatching()
    }

    private fun initializeRepositories() {
        viewModelScope.launch {
            // Initialize repositories
            addonRepository.initialize()
            watchProgressRepository.initialize()
            traktRepository.initialize()
            settingsRepository.initialize()

            // Load home content
            loadHomeContent()
        }
    }

    private fun observeContinueWatching() {
        viewModelScope.launch {
            watchProgressRepository.continueWatchingFlow.collectLatest { progressList ->
                updateContinueWatching(progressList)
            }
        }
    }

    private suspend fun updateContinueWatching(progressList: List<WatchProgress>) {
        val continueItems = progressList.mapNotNull { progress ->
            // Create a minimal StreamingContent for display
            val content = StreamingContent(
                id = progress.contentId,
                type = progress.type,
                name = progress.title ?: "Unknown",
                poster = progress.poster
            )

            val episodeInfo = if (progress.episodeId != null && progress.type == "series") {
                // Parse episode info from episodeId if available
                parseEpisodeInfo(progress.episodeId)
            } else null

            ContinueWatchingItem(
                content = content,
                progress = progress,
                episodeInfo = episodeInfo
            )
        }

        _uiState.update { it.copy(continueWatching = continueItems) }
    }

    private fun loadHomeContent() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            try {
                // Check if addons are installed
                val installedAddons = addonRepository.getInstalledAddonsSync()
                Log.d(TAG, "Installed addons count: ${installedAddons.size}")
                installedAddons.forEach { addon ->
                    Log.d(TAG, "  - ${addon.name}: ${addon.catalogs.size} catalogs")
                }

                if (installedAddons.isEmpty()) {
                    Log.d(TAG, "No addons installed, showing empty state")
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            hasAddons = false,
                            featuredContent = emptyList(),
                            catalogs = emptyList()
                        )
                    }
                    return@launch
                }

                // Load content in parallel
                Log.d(TAG, "Loading home catalogs...")
                val catalogsDeferred = async { catalogRepository.getHomeCatalogs() }
                val thisWeekDeferred = async { loadThisWeek() }

                val catalogs = catalogsDeferred.await()
                Log.d(TAG, "Loaded ${catalogs.size} catalogs")
                catalogs.forEach { catalog ->
                    Log.d(TAG, "  - ${catalog.config.catalogName}: ${catalog.items.size} items")
                }

                val thisWeekItems = thisWeekDeferred.await()

                // Extract featured content from the first catalog
                val featuredContent = extractFeaturedContent(catalogs)
                Log.d(TAG, "Featured content: ${featuredContent.size} items")

                _uiState.update {
                    it.copy(
                        isLoading = false,
                        hasAddons = true,
                        featuredContent = featuredContent,
                        thisWeek = thisWeekItems,
                        catalogs = catalogs,
                        error = null
                    )
                }

            } catch (e: Exception) {
                Log.e(TAG, "Failed to load home content", e)
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        error = e.message ?: "Failed to load home content"
                    )
                }
            }
        }
    }

    companion object {
        private const val TAG = "HomeViewModel"
    }

    private suspend fun loadThisWeek(): List<ThisWeekItem> {
        if (!traktRepository.isAuthenticated()) return emptyList()
        if (!settingsRepository.isShowThisWeekEnabled()) return emptyList()

        return try {
            val calendar = traktRepository.getThisWeekCalendar()
            calendar.map { item ->
                ThisWeekItem(
                    showId = item.showId,
                    showTitle = item.showTitle,
                    poster = null, // Would need to fetch from content repository
                    episodeInfo = "S${item.seasonNumber} E${item.episodeNumber}",
                    episodeTitle = item.episodeTitle,
                    airDate = formatAirDate(item.airDate)
                )
            }
        } catch (e: Exception) {
            emptyList()
        }
    }

    private fun extractFeaturedContent(catalogs: List<CatalogContent>): List<StreamingContent> {
        // Get the first 5-10 items from the first catalog for the hero carousel
        val firstCatalog = catalogs.firstOrNull() ?: return emptyList()
        return firstCatalog.items.take(10).filter {
            // Prefer items with background images for the hero
            it.background != null || it.poster != null
        }
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.update { it.copy(isRefreshing = true) }
            loadHomeContent()
            _uiState.update { it.copy(isRefreshing = false) }
        }
    }

    fun setSelectedFeaturedIndex(index: Int) {
        _uiState.update { it.copy(selectedFeaturedIndex = index) }
    }

    fun onContentClicked(content: StreamingContent) {
        // Navigation will be handled by the composable via callback
    }

    fun onSeeAllClicked(catalog: CatalogContent) {
        // Navigation will be handled by the composable via callback
    }

    private fun parseEpisodeInfo(episodeId: String): String? {
        // Episode ID format: "tt1234567:1:5" (imdbId:season:episode)
        val parts = episodeId.split(":")
        if (parts.size >= 3) {
            val season = parts.getOrNull(1)?.toIntOrNull() ?: return null
            val episode = parts.getOrNull(2)?.toIntOrNull() ?: return null
            return "S${season} E${episode}"
        }
        return null
    }

    private fun formatAirDate(dateString: String): String {
        // Parse ISO date and format for display
        return try {
            // Simple date extraction - could be enhanced with proper date parsing
            if (dateString.contains("T")) {
                dateString.substringBefore("T")
            } else {
                dateString
            }
        } catch (e: Exception) {
            dateString
        }
    }
}
