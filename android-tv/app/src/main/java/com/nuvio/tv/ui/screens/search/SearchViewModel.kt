package com.nuvio.tv.ui.screens.search

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nuvio.tv.data.repository.CatalogRepository
import com.nuvio.tv.data.repository.SettingsRepository
import com.nuvio.tv.domain.model.StreamingContent
import com.tencent.mmkv.MMKV
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import javax.inject.Inject

/**
 * Search result group from an addon.
 */
data class SearchResultGroup(
    val addonName: String,
    val results: List<StreamingContent>,
    val isLoading: Boolean = false
)

/**
 * Filter options for search.
 */
enum class ContentTypeFilter(val displayName: String, val type: String?) {
    ALL("All", null),
    MOVIES("Movies", "movie"),
    SERIES("Series", "series")
}

data class SearchUiState(
    val query: String = "",
    val results: List<StreamingContent> = emptyList(),
    val resultsByAddon: Map<String, List<StreamingContent>> = emptyMap(),
    val isLoading: Boolean = false,
    val hasSearched: Boolean = false,
    val error: String? = null,
    val recentSearches: List<String> = emptyList(),
    val typeFilter: ContentTypeFilter = ContentTypeFilter.ALL,
    val totalResults: Int = 0
)

@HiltViewModel
class SearchViewModel @Inject constructor(
    private val catalogRepository: CatalogRepository
) : ViewModel() {

    companion object {
        private const val TAG = "SearchViewModel"
        private const val MMKV_ID = "nuvio_search"
        private const val KEY_RECENT_SEARCHES = "recent_searches"
        private const val MAX_RECENT_SEARCHES = 10
    }

    private val mmkv: MMKV by lazy {
        MMKV.mmkvWithID(MMKV_ID, MMKV.MULTI_PROCESS_MODE)
    }

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    private val _uiState = MutableStateFlow(SearchUiState())
    val uiState: StateFlow<SearchUiState> = _uiState.asStateFlow()

    private var searchJob: Job? = null

    init {
        loadRecentSearches()
    }

    fun onQueryChange(query: String) {
        _uiState.update { it.copy(query = query) }

        // Debounce search
        searchJob?.cancel()
        if (query.isNotBlank() && query.length >= 2) {
            searchJob = viewModelScope.launch {
                delay(400) // Debounce delay
                search(query)
            }
        } else {
            _uiState.update {
                it.copy(
                    results = emptyList(),
                    resultsByAddon = emptyMap(),
                    hasSearched = false,
                    totalResults = 0
                )
            }
        }
    }

    fun onTypeFilterChange(filter: ContentTypeFilter) {
        _uiState.update { it.copy(typeFilter = filter) }

        // Re-search with new filter
        val query = _uiState.value.query
        if (query.isNotBlank() && query.length >= 2) {
            searchJob?.cancel()
            searchJob = viewModelScope.launch {
                search(query)
            }
        }
    }

    private suspend fun search(query: String) {
        _uiState.update {
            it.copy(
                isLoading = true,
                error = null,
                hasSearched = true
            )
        }

        try {
            val typeFilter = _uiState.value.typeFilter.type

            // Search grouped by addon for better UX
            val resultsByAddon = catalogRepository.searchGroupedByAddon(query, typeFilter)

            // Flatten for combined view
            val allResults = resultsByAddon.values.flatten().distinctBy { it.id }

            _uiState.update {
                it.copy(
                    results = allResults,
                    resultsByAddon = resultsByAddon,
                    isLoading = false,
                    totalResults = allResults.size
                )
            }

            // Save to recent searches
            saveRecentSearch(query)

            Log.d(TAG, "Search completed: ${allResults.size} results for '$query'")
        } catch (e: Exception) {
            Log.e(TAG, "Search error", e)
            _uiState.update {
                it.copy(
                    isLoading = false,
                    error = e.message ?: "Search failed"
                )
            }
        }
    }

    fun onRecentSearchClick(query: String) {
        _uiState.update { it.copy(query = query) }
        searchJob?.cancel()
        searchJob = viewModelScope.launch {
            search(query)
        }
    }

    fun clearSearch() {
        searchJob?.cancel()
        _uiState.update {
            it.copy(
                query = "",
                results = emptyList(),
                resultsByAddon = emptyMap(),
                hasSearched = false,
                error = null,
                totalResults = 0
            )
        }
    }

    fun removeRecentSearch(query: String) {
        val updated = _uiState.value.recentSearches.filter { it != query }
        _uiState.update { it.copy(recentSearches = updated) }
        saveRecentSearchesList(updated)
    }

    fun clearRecentSearches() {
        _uiState.update { it.copy(recentSearches = emptyList()) }
        mmkv.remove(KEY_RECENT_SEARCHES)
    }

    private fun loadRecentSearches() {
        try {
            val data = mmkv.decodeString(KEY_RECENT_SEARCHES) ?: return
            val searches = json.decodeFromString<List<String>>(data)
            _uiState.update { it.copy(recentSearches = searches) }
        } catch (e: Exception) {
            Log.e(TAG, "Error loading recent searches", e)
        }
    }

    private fun saveRecentSearch(query: String) {
        val current = _uiState.value.recentSearches.toMutableList()

        // Remove if already exists
        current.remove(query)

        // Add at beginning
        current.add(0, query)

        // Limit size
        val updated = current.take(MAX_RECENT_SEARCHES)

        _uiState.update { it.copy(recentSearches = updated) }
        saveRecentSearchesList(updated)
    }

    private fun saveRecentSearchesList(searches: List<String>) {
        try {
            mmkv.encode(KEY_RECENT_SEARCHES, json.encodeToString(searches))
        } catch (e: Exception) {
            Log.e(TAG, "Error saving recent searches", e)
        }
    }
}
