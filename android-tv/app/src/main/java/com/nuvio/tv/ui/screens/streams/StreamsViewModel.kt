package com.nuvio.tv.ui.screens.streams

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nuvio.tv.domain.model.Stream
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class StreamsUiState(
    val isLoading: Boolean = true,
    val error: String? = null,
    val streams: List<Stream> = emptyList(),
    val selectedStream: Stream? = null
)

@HiltViewModel
class StreamsViewModel @Inject constructor(
    // Will inject stream repository
) : ViewModel() {

    private val _uiState = MutableStateFlow(StreamsUiState())
    val uiState: StateFlow<StreamsUiState> = _uiState.asStateFlow()

    fun loadStreams(type: String, id: String, episodeId: String?) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            try {
                // TODO: Load from stream repository
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        streams = emptyList()
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

    fun selectStream(stream: Stream) {
        _uiState.update { it.copy(selectedStream = stream) }
    }
}
