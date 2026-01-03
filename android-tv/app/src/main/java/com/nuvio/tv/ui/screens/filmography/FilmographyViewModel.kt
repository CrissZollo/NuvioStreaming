package com.nuvio.tv.ui.screens.filmography

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nuvio.tv.data.repository.ContentRepository
import com.nuvio.tv.domain.model.PersonCredit
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class SortOption {
    POPULARITY,
    RECENT,
    RATING
}

data class FilmographyUiState(
    val isLoading: Boolean = true,
    val error: String? = null,
    val personName: String = "",
    val filmography: List<PersonCredit> = emptyList(),
    val sortBy: SortOption = SortOption.POPULARITY
)

@HiltViewModel
class FilmographyViewModel @Inject constructor(
    private val contentRepository: ContentRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(FilmographyUiState())
    val uiState: StateFlow<FilmographyUiState> = _uiState.asStateFlow()

    private var originalFilmography: List<PersonCredit> = emptyList()

    fun loadFilmography(personId: Int, personName: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null, personName = personName) }

            try {
                val personDetails = contentRepository.getPersonDetails(personId)

                if (personDetails != null) {
                    originalFilmography = personDetails.filmography
                    val sortedFilmography = sortFilmography(originalFilmography, _uiState.value.sortBy)

                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            personName = personDetails.name,
                            filmography = sortedFilmography
                        )
                    }
                } else {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            error = "Could not load filmography"
                        )
                    }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        error = e.message ?: "Unknown error"
                    )
                }
            }
        }
    }

    fun setSortBy(sortOption: SortOption) {
        if (_uiState.value.sortBy == sortOption) return

        _uiState.update {
            it.copy(
                sortBy = sortOption,
                filmography = sortFilmography(originalFilmography, sortOption)
            )
        }
    }

    private fun sortFilmography(filmography: List<PersonCredit>, sortOption: SortOption): List<PersonCredit> {
        return when (sortOption) {
            SortOption.POPULARITY -> filmography.sortedByDescending { it.popularity ?: 0f }
            SortOption.RECENT -> filmography.sortedByDescending { it.releaseDate ?: "" }
            SortOption.RATING -> filmography.sortedByDescending { it.voteAverage ?: 0f }
        }
    }
}
