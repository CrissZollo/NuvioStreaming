package com.nuvio.tv.ui.screens.settings.debrid

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nuvio.tv.data.repository.DebridRepository
import com.nuvio.tv.domain.model.DebridService
import com.nuvio.tv.domain.model.TorBoxConfig
import com.nuvio.tv.domain.model.TorBoxUser
import com.nuvio.tv.domain.model.TorrentioConfig
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class DebridUiState(
    // General
    val isLoading: Boolean = false,
    val error: String? = null,
    val successMessage: String? = null,

    // TorBox
    val torBoxConfig: TorBoxConfig = TorBoxConfig(),
    val torBoxUser: TorBoxUser? = null,
    val torBoxApiKeyInput: String = "",

    // Torrentio
    val torrentioConfig: TorrentioConfig = TorrentioConfig(),

    // UI state
    val showDisconnectDialog: Boolean = false,
    val showRemoveTorrentioDialog: Boolean = false
)

@HiltViewModel
class DebridViewModel @Inject constructor(
    private val debridRepository: DebridRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(DebridUiState())
    val uiState: StateFlow<DebridUiState> = _uiState.asStateFlow()

    init {
        observeDebridState()
        initializeRepository()
    }

    private fun observeDebridState() {
        viewModelScope.launch {
            debridRepository.torBoxConfig.collect { config ->
                _uiState.update { it.copy(torBoxConfig = config) }
            }
        }

        viewModelScope.launch {
            debridRepository.torBoxUser.collect { user ->
                _uiState.update { it.copy(torBoxUser = user) }
            }
        }

        viewModelScope.launch {
            debridRepository.torrentioConfig.collect { config ->
                _uiState.update { it.copy(torrentioConfig = config) }
            }
        }

        viewModelScope.launch {
            debridRepository.isLoading.collect { loading ->
                _uiState.update { it.copy(isLoading = loading) }
            }
        }
    }

    private fun initializeRepository() {
        viewModelScope.launch {
            debridRepository.initialize()
        }
    }

    // ==================== TorBox Actions ====================

    fun updateTorBoxApiKey(apiKey: String) {
        _uiState.update { it.copy(torBoxApiKeyInput = apiKey) }
    }

    fun connectTorBox() {
        val apiKey = _uiState.value.torBoxApiKeyInput.trim()
        if (apiKey.isEmpty()) {
            _uiState.update { it.copy(error = "Please enter your TorBox API key") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            val result = debridRepository.connectTorBox(apiKey)

            result.fold(
                onSuccess = { user ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            successMessage = "Connected to TorBox as ${user.email}",
                            torBoxApiKeyInput = ""
                        )
                    }
                },
                onFailure = { error ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            error = error.message ?: "Failed to connect to TorBox"
                        )
                    }
                }
            )
        }
    }

    fun showDisconnectDialog() {
        _uiState.update { it.copy(showDisconnectDialog = true) }
    }

    fun hideDisconnectDialog() {
        _uiState.update { it.copy(showDisconnectDialog = false) }
    }

    fun disconnectTorBox() {
        viewModelScope.launch {
            _uiState.update { it.copy(showDisconnectDialog = false, isLoading = true) }

            val result = debridRepository.disconnectTorBox()

            result.fold(
                onSuccess = {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            successMessage = "Disconnected from TorBox"
                        )
                    }
                },
                onFailure = { error ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            error = error.message ?: "Failed to disconnect from TorBox"
                        )
                    }
                }
            )
        }
    }

    fun setTorBoxEnabled(enabled: Boolean) {
        viewModelScope.launch {
            debridRepository.setTorBoxEnabled(enabled)
        }
    }

    fun refreshTorBoxUser() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            debridRepository.refreshTorBoxUser()
            _uiState.update { it.copy(isLoading = false) }
        }
    }

    // ==================== Torrentio Actions ====================

    fun updateTorrentioDebridService(serviceId: String) {
        val config = _uiState.value.torrentioConfig.copy(debridService = serviceId)
        debridRepository.updateTorrentioConfig(config)
    }

    fun updateTorrentioApiKey(apiKey: String) {
        val config = _uiState.value.torrentioConfig.copy(debridApiKey = apiKey)
        debridRepository.updateTorrentioConfig(config)
    }

    fun updateTorrentioSort(sort: String) {
        val config = _uiState.value.torrentioConfig.copy(sort = sort)
        debridRepository.updateTorrentioConfig(config)
    }

    fun toggleQualityFilter(qualityId: String) {
        val currentFilters = _uiState.value.torrentioConfig.qualityFilter.toMutableList()
        if (currentFilters.contains(qualityId)) {
            currentFilters.remove(qualityId)
        } else {
            currentFilters.add(qualityId)
        }
        val config = _uiState.value.torrentioConfig.copy(qualityFilter = currentFilters)
        debridRepository.updateTorrentioConfig(config)
    }

    fun togglePriorityLanguage(languageId: String) {
        val currentLanguages = _uiState.value.torrentioConfig.priorityLanguages.toMutableList()
        if (currentLanguages.contains(languageId)) {
            currentLanguages.remove(languageId)
        } else {
            currentLanguages.add(languageId)
        }
        val config = _uiState.value.torrentioConfig.copy(priorityLanguages = currentLanguages)
        debridRepository.updateTorrentioConfig(config)
    }

    fun setNoDownloadLinks(enabled: Boolean) {
        val config = _uiState.value.torrentioConfig.copy(noDownloadLinks = enabled)
        debridRepository.updateTorrentioConfig(config)
    }

    fun setNoCatalog(enabled: Boolean) {
        val config = _uiState.value.torrentioConfig.copy(noCatalog = enabled)
        debridRepository.updateTorrentioConfig(config)
    }

    fun installTorrentio() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            val result = debridRepository.installTorrentio()

            result.fold(
                onSuccess = {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            successMessage = "Torrentio installed successfully"
                        )
                    }
                },
                onFailure = { error ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            error = error.message ?: "Failed to install Torrentio"
                        )
                    }
                }
            )
        }
    }

    fun showRemoveTorrentioDialog() {
        _uiState.update { it.copy(showRemoveTorrentioDialog = true) }
    }

    fun hideRemoveTorrentioDialog() {
        _uiState.update { it.copy(showRemoveTorrentioDialog = false) }
    }

    fun removeTorrentio() {
        viewModelScope.launch {
            _uiState.update { it.copy(showRemoveTorrentioDialog = false, isLoading = true) }

            val result = debridRepository.removeTorrentio()

            result.fold(
                onSuccess = {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            successMessage = "Torrentio removed successfully"
                        )
                    }
                },
                onFailure = { error ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            error = error.message ?: "Failed to remove Torrentio"
                        )
                    }
                }
            )
        }
    }

    // ==================== UI Actions ====================

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }

    fun clearSuccessMessage() {
        _uiState.update { it.copy(successMessage = null) }
    }
}
