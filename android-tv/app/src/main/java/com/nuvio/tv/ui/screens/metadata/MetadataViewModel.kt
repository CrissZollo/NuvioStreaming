package com.nuvio.tv.ui.screens.metadata

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nuvio.tv.domain.model.Cast
import com.nuvio.tv.domain.model.Episode
import com.nuvio.tv.domain.model.Season
import com.nuvio.tv.domain.model.StreamingContent
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class MetadataUiState(
    val isLoading: Boolean = true,
    val error: String? = null,
    val content: StreamingContent? = null,
    val cast: List<Cast> = emptyList(),
    val seasons: List<Season> = emptyList(),
    val selectedSeason: Int = 1,
    val episodes: List<Episode> = emptyList(),
    val recommendations: List<StreamingContent> = emptyList(),
    val isInLibrary: Boolean = false
)

@HiltViewModel
class MetadataViewModel @Inject constructor(
    // Will inject metadata repository
) : ViewModel() {

    private val _uiState = MutableStateFlow(MetadataUiState())
    val uiState: StateFlow<MetadataUiState> = _uiState.asStateFlow()

    fun loadMetadata(type: String, id: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            try {
                // TODO: Load from repository
                // For now, show placeholder
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        content = StreamingContent(
                            id = id,
                            type = type,
                            name = "Loading...",
                            description = "Content details will load from the API."
                        )
                    )
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

    fun selectSeason(seasonNumber: Int) {
        _uiState.update { it.copy(selectedSeason = seasonNumber) }
        // Load episodes for selected season
    }

    fun toggleLibrary() {
        _uiState.update { it.copy(isInLibrary = !it.isInLibrary) }
        // TODO: Update library repository
    }
}
