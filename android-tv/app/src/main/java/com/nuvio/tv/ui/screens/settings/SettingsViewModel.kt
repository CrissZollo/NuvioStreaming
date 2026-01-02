package com.nuvio.tv.ui.screens.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nuvio.tv.data.repository.AddonRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SettingsUiState(
    // Content & Discovery
    val addonCount: Int = 0,

    // Appearance
    val currentTheme: String = "Dark",
    val horizontalEpisodeLayout: Boolean = true,

    // Integrations
    val traktConnected: Boolean = false,
    val traktUsername: String = "",
    val mdblistConnected: Boolean = false,
    val openRouterConnected: Boolean = false,

    // Playback
    val selectedPlayer: String = "Built-in Player",
    val preferredAudioLanguage: String = "English",
    val preferredSubtitleLanguage: String = "English",
    val subtitleSourcePriority: String = "Internal First",
    val autoSelectSubtitles: Boolean = true,
    val showTrailers: Boolean = true,
    val downloadsEnabled: Boolean = false,

    // About
    val appVersion: String = "1.0.0"
)

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val addonRepository: AddonRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(SettingsUiState())
    val uiState: StateFlow<SettingsUiState> = _uiState.asStateFlow()

    init {
        loadSettings()
    }

    private fun loadSettings() {
        viewModelScope.launch {
            // Load addon count
            addonRepository.installedAddons.collect { addons ->
                _uiState.update { it.copy(addonCount = addons.size) }
            }
        }

        // TODO: Load other settings from preferences/repositories
    }

    fun setHorizontalEpisodeLayout(enabled: Boolean) {
        _uiState.update { it.copy(horizontalEpisodeLayout = enabled) }
        // TODO: Save to preferences
    }

    fun setAutoSelectSubtitles(enabled: Boolean) {
        _uiState.update { it.copy(autoSelectSubtitles = enabled) }
        // TODO: Save to preferences
    }

    fun setShowTrailers(enabled: Boolean) {
        _uiState.update { it.copy(showTrailers = enabled) }
        // TODO: Save to preferences
    }

    fun setDownloadsEnabled(enabled: Boolean) {
        _uiState.update { it.copy(downloadsEnabled = enabled) }
        // TODO: Save to preferences
    }
}
