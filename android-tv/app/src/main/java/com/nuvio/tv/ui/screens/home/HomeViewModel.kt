package com.nuvio.tv.ui.screens.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nuvio.tv.domain.model.CatalogContent
import com.nuvio.tv.domain.model.StreamingContent
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * UI State for the Home Screen.
 */
data class HomeUiState(
    val isLoading: Boolean = true,
    val error: String? = null,
    val featuredContent: List<StreamingContent> = emptyList(),
    val continueWatching: List<StreamingContent> = emptyList(),
    val catalogs: List<CatalogContent> = emptyList(),
    val watchProgress: Map<String, Float> = emptyMap()
)

/**
 * ViewModel for the Home Screen.
 * Manages loading of featured content, continue watching, and catalog rows.
 */
@HiltViewModel
class HomeViewModel @Inject constructor(
    // Will inject repositories when implemented:
    // private val catalogRepository: CatalogRepository,
    // private val watchProgressRepository: WatchProgressRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    init {
        loadHomeContent()
    }

    private fun loadHomeContent() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            try {
                // TODO: Load from repositories
                // For now, show mock data for testing

                val mockFeatured = listOf(
                    StreamingContent(
                        id = "tt1375666",
                        type = "movie",
                        name = "Inception",
                        poster = "https://image.tmdb.org/t/p/w500/9gk7adHYeDvHkCSEqAvQNLV5Ber.jpg",
                        background = "https://image.tmdb.org/t/p/original/s3TBrRGB1iav7gFOCNx3H31MoES.jpg",
                        year = 2010,
                        imdbRating = "8.8",
                        genres = listOf("Action", "Sci-Fi", "Thriller"),
                        description = "A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O."
                    ),
                    StreamingContent(
                        id = "tt0468569",
                        type = "movie",
                        name = "The Dark Knight",
                        poster = "https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
                        background = "https://image.tmdb.org/t/p/original/hkBaDkMWbLaf8B1lsWsKX7Ew3Xq.jpg",
                        year = 2008,
                        imdbRating = "9.0",
                        genres = listOf("Action", "Crime", "Drama"),
                        description = "When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological and physical tests of his ability to fight injustice."
                    ),
                    StreamingContent(
                        id = "tt0111161",
                        type = "movie",
                        name = "The Shawshank Redemption",
                        poster = "https://image.tmdb.org/t/p/w500/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg",
                        background = "https://image.tmdb.org/t/p/original/kXfqcdQKsToO0OUXHcrrNCHDBzO.jpg",
                        year = 1994,
                        imdbRating = "9.3",
                        genres = listOf("Drama"),
                        description = "Two imprisoned men bond over a number of years, finding solace and eventual redemption through acts of common decency."
                    )
                )

                _uiState.update {
                    it.copy(
                        isLoading = false,
                        featuredContent = mockFeatured,
                        continueWatching = emptyList(),
                        catalogs = emptyList()
                    )
                }

            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        error = e.message ?: "Unknown error occurred"
                    )
                }
            }
        }
    }

    fun refresh() {
        loadHomeContent()
    }
}
