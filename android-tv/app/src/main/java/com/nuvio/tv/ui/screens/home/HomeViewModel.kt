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
import kotlinx.coroutines.awaitAll
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
            // Initialize repositories in parallel for faster startup
            val addonInit = async { addonRepository.initialize() }
            val watchProgressInit = async { watchProgressRepository.initialize() }
            val traktInit = async { traktRepository.initialize() }
            val settingsInit = async { settingsRepository.initialize() }

            // Wait for addon repository first (required for catalogs)
            addonInit.await()

            // Start loading home content immediately, don't wait for other repos
            loadHomeContent()

            // Let other repos finish in background
            watchProgressInit.await()
            traktInit.await()
            settingsInit.await()
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

                // Mark as having addons immediately
                _uiState.update { it.copy(hasAddons = true) }

                // Load catalogs progressively - first catalog first for featured content
                Log.d(TAG, "Loading home catalogs progressively...")
                loadCatalogsProgressively()

                // Load this week in background
                viewModelScope.launch {
                    try {
                        val thisWeekItems = loadThisWeek()
                        _uiState.update { it.copy(thisWeek = thisWeekItems) }
                    } catch (e: Exception) {
                        Log.e(TAG, "Failed to load this week", e)
                    }
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

    /**
     * Load catalogs progressively - show content as it becomes available.
     */
    private suspend fun loadCatalogsProgressively() {
        val catalogConfigs = catalogRepository.getAllCatalogConfigs()
        if (catalogConfigs.isEmpty()) {
            _uiState.update { it.copy(isLoading = false) }
            return
        }

        Log.d(TAG, "Loading ${catalogConfigs.size} catalogs progressively")

        // Load first catalog immediately for featured content
        val firstConfig = catalogConfigs.first()
        try {
            val firstCatalog = catalogRepository.fetchCatalog(firstConfig.second, firstConfig.first)
            val featuredContent = extractFeaturedContent(listOf(firstCatalog))

            // Show featured content and first catalog immediately
            _uiState.update {
                it.copy(
                    isLoading = false,
                    featuredContent = featuredContent,
                    catalogs = listOf(firstCatalog)
                )
            }
            Log.d(TAG, "First catalog loaded: ${firstCatalog.config.catalogName} with ${firstCatalog.items.size} items")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to load first catalog", e)
            _uiState.update { it.copy(isLoading = false) }
        }

        // Load remaining catalogs in parallel batches
        if (catalogConfigs.size > 1) {
            val remainingConfigs = catalogConfigs.drop(1)
            val batchSize = 3 // Load 3 catalogs at a time

            remainingConfigs.chunked(batchSize).forEach { batch ->
                kotlinx.coroutines.coroutineScope {
                    val results = batch.map { (config, addon) ->
                        async {
                            try {
                                catalogRepository.fetchCatalog(addon, config)
                            } catch (e: Exception) {
                                Log.e(TAG, "Failed to load catalog ${config.catalogName}", e)
                                null
                            }
                        }
                    }.awaitAll().filterNotNull()

                    // Add new catalogs to UI as they arrive
                    if (results.isNotEmpty()) {
                        _uiState.update { current ->
                            current.copy(catalogs = current.catalogs + results)
                        }
                        Log.d(TAG, "Added ${results.size} more catalogs, total: ${_uiState.value.catalogs.size}")
                    }
                }
            }
        }

        Log.d(TAG, "All catalogs loaded: ${_uiState.value.catalogs.size}")
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
