package com.nuvio.tv.ui.screens.library

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nuvio.tv.data.repository.LibraryItem
import com.nuvio.tv.data.repository.LibraryRepository
import com.nuvio.tv.data.repository.TraktRepository
import com.nuvio.tv.data.repository.WatchProgressRepository
import com.nuvio.tv.domain.model.StreamingContent
import com.nuvio.tv.domain.model.WatchProgress
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Tabs in the library screen.
 */
enum class LibraryTab(val title: String) {
    FAVORITES("Favorites"),
    WATCHLIST("Watchlist"),
    HISTORY("History"),
    CONTINUE("Continue Watching")
}

/**
 * Filter for content type.
 */
enum class LibraryFilter(val displayName: String, val type: String?) {
    ALL("All", null),
    MOVIES("Movies", "movie"),
    SERIES("Series", "series")
}

/**
 * Sort option for library items.
 */
enum class LibrarySort(val displayName: String) {
    RECENT("Recently Added"),
    NAME("Name"),
    YEAR("Year"),
    RATING("Rating")
}

/**
 * UI state for the library screen.
 */
data class LibraryUiState(
    val selectedTab: LibraryTab = LibraryTab.FAVORITES,
    val filter: LibraryFilter = LibraryFilter.ALL,
    val sort: LibrarySort = LibrarySort.RECENT,
    val favorites: List<LibraryItem> = emptyList(),
    val watchlist: List<LibraryItem> = emptyList(),
    val history: List<WatchProgress> = emptyList(),
    val continueWatching: List<WatchProgress> = emptyList(),
    val isLoading: Boolean = true,
    val error: String? = null,
    val isTraktConnected: Boolean = false
)

@HiltViewModel
class LibraryViewModel @Inject constructor(
    private val libraryRepository: LibraryRepository,
    private val watchProgressRepository: WatchProgressRepository,
    private val traktRepository: TraktRepository
) : ViewModel() {

    companion object {
        private const val TAG = "LibraryViewModel"
    }

    private val _uiState = MutableStateFlow(LibraryUiState())
    val uiState: StateFlow<LibraryUiState> = _uiState.asStateFlow()

    init {
        loadLibraryData()
        observeLibraryChanges()
    }

    /**
     * Load all library data.
     */
    private fun loadLibraryData() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            try {
                // Initialize library
                libraryRepository.initialize()

                // Check Trakt connection
                val isTraktConnected = traktRepository.isAuthenticated()

                // Load favorites
                val favorites = libraryRepository.getFavorites()

                // Load watchlist
                val watchlist = libraryRepository.getWatchlist()

                // Load watch history
                val history = watchProgressRepository.getWatchHistory()

                // Load continue watching
                val continueWatching = watchProgressRepository.getContinueWatching()

                _uiState.update {
                    it.copy(
                        favorites = favorites,
                        watchlist = watchlist,
                        history = history,
                        continueWatching = continueWatching,
                        isTraktConnected = isTraktConnected,
                        isLoading = false
                    )
                }

                Log.d(TAG, "Library loaded: ${favorites.size} favorites, ${watchlist.size} watchlist, ${continueWatching.size} continue watching")
            } catch (e: Exception) {
                Log.e(TAG, "Error loading library", e)
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        error = e.message ?: "Failed to load library"
                    )
                }
            }
        }
    }

    /**
     * Observe library changes from repository.
     */
    private fun observeLibraryChanges() {
        viewModelScope.launch {
            libraryRepository.favoritesFlow.collect { favorites ->
                _uiState.update { it.copy(favorites = favorites) }
            }
        }

        viewModelScope.launch {
            libraryRepository.watchlistFlow.collect { watchlist ->
                _uiState.update { it.copy(watchlist = watchlist) }
            }
        }

        viewModelScope.launch {
            watchProgressRepository.continueWatchingFlow.collect { continueWatching ->
                _uiState.update { it.copy(continueWatching = continueWatching) }
            }
        }
    }

    /**
     * Select a tab.
     */
    fun selectTab(tab: LibraryTab) {
        _uiState.update { it.copy(selectedTab = tab) }
    }

    /**
     * Set content type filter.
     */
    fun setFilter(filter: LibraryFilter) {
        _uiState.update { it.copy(filter = filter) }
    }

    /**
     * Set sort option.
     */
    fun setSort(sort: LibrarySort) {
        _uiState.update { it.copy(sort = sort) }
    }

    /**
     * Refresh library data.
     */
    fun refresh() {
        loadLibraryData()
    }

    /**
     * Remove item from favorites.
     */
    fun removeFromFavorites(contentId: String) {
        viewModelScope.launch {
            libraryRepository.removeFromFavorites(contentId)
        }
    }

    /**
     * Remove item from watchlist.
     */
    fun removeFromWatchlist(contentId: String) {
        viewModelScope.launch {
            libraryRepository.removeFromWatchlist(contentId)
        }
    }

    /**
     * Clear watch progress for an item.
     */
    fun clearProgress(contentId: String) {
        viewModelScope.launch {
            watchProgressRepository.removeProgress(contentId)
            loadLibraryData() // Reload to reflect changes
        }
    }

    /**
     * Clear all history.
     */
    fun clearAllHistory() {
        viewModelScope.launch {
            watchProgressRepository.clearAllProgress()
            loadLibraryData()
        }
    }

    /**
     * Get filtered and sorted items for the current tab.
     */
    fun getFilteredItems(): List<Any> {
        val state = _uiState.value
        val filterType = state.filter.type

        return when (state.selectedTab) {
            LibraryTab.FAVORITES -> {
                state.favorites
                    .filter { filterType == null || it.type == filterType }
                    .sortedWith(getLibraryItemComparator(state.sort))
            }
            LibraryTab.WATCHLIST -> {
                state.watchlist
                    .filter { filterType == null || it.type == filterType }
                    .sortedWith(getLibraryItemComparator(state.sort))
            }
            LibraryTab.HISTORY -> {
                state.history
                    .filter { filterType == null || it.type == filterType }
                    .sortedByDescending { it.updatedAt }
            }
            LibraryTab.CONTINUE -> {
                state.continueWatching
                    .filter { filterType == null || it.type == filterType }
                    .sortedByDescending { it.updatedAt }
            }
        }
    }

    private fun getLibraryItemComparator(sort: LibrarySort): Comparator<LibraryItem> {
        return when (sort) {
            LibrarySort.RECENT -> compareByDescending { it.addedAt }
            LibrarySort.NAME -> compareBy { it.name.lowercase() }
            LibrarySort.YEAR -> compareByDescending { it.year ?: 0 }
            LibrarySort.RATING -> compareByDescending { it.imdbRating ?: 0f }
        }
    }
}
