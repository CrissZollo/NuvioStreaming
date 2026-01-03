package com.nuvio.tv.ui.screens.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nuvio.tv.data.repository.AddonRepository
import com.nuvio.tv.data.repository.SettingsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Common language options for audio and subtitles.
 * Uses ISO 639-2 language codes.
 */
object LanguageOptions {
    val audioLanguages = listOf(
        "eng" to "English",
        "spa" to "Spanish",
        "fra" to "French",
        "deu" to "German",
        "ita" to "Italian",
        "por" to "Portuguese",
        "rus" to "Russian",
        "jpn" to "Japanese",
        "kor" to "Korean",
        "zho" to "Chinese",
        "ara" to "Arabic",
        "hin" to "Hindi",
        "pol" to "Polish",
        "tur" to "Turkish",
        "nld" to "Dutch",
        "swe" to "Swedish",
        "nor" to "Norwegian",
        "dan" to "Danish",
        "fin" to "Finnish"
    )

    val subtitleLanguages = listOf(
        "none" to "None",
        "eng" to "English",
        "spa" to "Spanish",
        "fra" to "French",
        "deu" to "German",
        "ita" to "Italian",
        "por" to "Portuguese",
        "rus" to "Russian",
        "jpn" to "Japanese",
        "kor" to "Korean",
        "zho" to "Chinese",
        "ara" to "Arabic",
        "hin" to "Hindi",
        "pol" to "Polish",
        "tur" to "Turkish",
        "nld" to "Dutch",
        "swe" to "Swedish",
        "nor" to "Norwegian",
        "dan" to "Danish",
        "fin" to "Finnish"
    )

    val subtitleSourceOptions = listOf(
        "embedded" to "Embedded First",
        "external" to "External First"
    )

    fun getLanguageDisplayName(code: String, isSubtitle: Boolean = false): String {
        val languages = if (isSubtitle) subtitleLanguages else audioLanguages
        return languages.find { it.first == code }?.second ?: code.uppercase()
    }

    fun getSubtitleSourceDisplayName(code: String): String {
        return subtitleSourceOptions.find { it.first == code }?.second ?: code
    }
}

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
    val preferredAudioLanguageCode: String = "eng",
    val preferredAudioLanguage: String = "English",
    val preferredSubtitleLanguageCode: String = "none",
    val preferredSubtitleLanguage: String = "None",
    val subtitleSourcePriorityCode: String = "embedded",
    val subtitleSourcePriority: String = "Embedded First",
    val autoSelectSubtitles: Boolean = true,
    val showTrailers: Boolean = true,
    val downloadsEnabled: Boolean = false,

    // About
    val appVersion: String = "1.0.0"
)

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val addonRepository: AddonRepository,
    private val settingsRepository: SettingsRepository
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

        // Load playback settings
        viewModelScope.launch {
            val audioLangCode = settingsRepository.getPreferredAudioLanguage()
            val subtitleLangCode = settingsRepository.getPreferredSubtitleLanguage()
            val subtitleSourceCode = settingsRepository.getSubtitleSourcePriority()

            _uiState.update {
                it.copy(
                    preferredAudioLanguageCode = audioLangCode,
                    preferredAudioLanguage = LanguageOptions.getLanguageDisplayName(audioLangCode),
                    preferredSubtitleLanguageCode = subtitleLangCode,
                    preferredSubtitleLanguage = LanguageOptions.getLanguageDisplayName(subtitleLangCode, true),
                    subtitleSourcePriorityCode = subtitleSourceCode,
                    subtitleSourcePriority = LanguageOptions.getSubtitleSourceDisplayName(subtitleSourceCode)
                )
            }
        }
    }

    fun setHorizontalEpisodeLayout(enabled: Boolean) {
        _uiState.update { it.copy(horizontalEpisodeLayout = enabled) }
    }

    fun setPreferredAudioLanguage(languageCode: String) {
        viewModelScope.launch {
            settingsRepository.setPreferredAudioLanguage(languageCode)
            _uiState.update {
                it.copy(
                    preferredAudioLanguageCode = languageCode,
                    preferredAudioLanguage = LanguageOptions.getLanguageDisplayName(languageCode)
                )
            }
        }
    }

    fun setPreferredSubtitleLanguage(languageCode: String) {
        viewModelScope.launch {
            settingsRepository.setPreferredSubtitleLanguage(languageCode)
            _uiState.update {
                it.copy(
                    preferredSubtitleLanguageCode = languageCode,
                    preferredSubtitleLanguage = LanguageOptions.getLanguageDisplayName(languageCode, true)
                )
            }
        }
    }

    fun setSubtitleSourcePriority(priorityCode: String) {
        viewModelScope.launch {
            settingsRepository.setSubtitleSourcePriority(priorityCode)
            _uiState.update {
                it.copy(
                    subtitleSourcePriorityCode = priorityCode,
                    subtitleSourcePriority = LanguageOptions.getSubtitleSourceDisplayName(priorityCode)
                )
            }
        }
    }

    fun setAutoSelectSubtitles(enabled: Boolean) {
        _uiState.update { it.copy(autoSelectSubtitles = enabled) }
    }

    fun setShowTrailers(enabled: Boolean) {
        _uiState.update { it.copy(showTrailers = enabled) }
    }

    fun setDownloadsEnabled(enabled: Boolean) {
        _uiState.update { it.copy(downloadsEnabled = enabled) }
    }
}
