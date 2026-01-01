package com.nuvio.tv.ui.screens.settings.addons

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nuvio.tv.data.repository.AddonRepository
import com.nuvio.tv.domain.model.Addon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * UI State for Addons Settings Screen.
 */
data class AddonsSettingsUiState(
    val isLoading: Boolean = false,
    val addons: List<Addon> = emptyList(),
    val isInstalling: Boolean = false,
    val installError: String? = null,
    val showInstallDialog: Boolean = false,
    val addonUrlInput: String = ""
)

/**
 * ViewModel for managing addons in the settings screen.
 */
@HiltViewModel
class AddonsSettingsViewModel @Inject constructor(
    private val addonRepository: AddonRepository
) : ViewModel() {

    companion object {
        private const val TAG = "AddonsSettingsVM"
    }

    private val _uiState = MutableStateFlow(AddonsSettingsUiState())
    val uiState: StateFlow<AddonsSettingsUiState> = _uiState.asStateFlow()

    init {
        loadAddons()
    }

    private fun loadAddons() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }

            // Observe addon changes
            addonRepository.installedAddons.collect { addons ->
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        addons = addons
                    )
                }
            }
        }
    }

    fun showInstallDialog() {
        _uiState.update { it.copy(showInstallDialog = true, addonUrlInput = "", installError = null) }
    }

    fun hideInstallDialog() {
        _uiState.update { it.copy(showInstallDialog = false, addonUrlInput = "", installError = null) }
    }

    fun updateAddonUrl(url: String) {
        _uiState.update { it.copy(addonUrlInput = url, installError = null) }
    }

    fun installAddon(manifestUrl: String) {
        if (manifestUrl.isBlank()) {
            _uiState.update { it.copy(installError = "Please enter a valid addon URL") }
            return
        }

        // Normalize URL
        val normalizedUrl = if (!manifestUrl.endsWith("/manifest.json")) {
            if (manifestUrl.endsWith("/")) {
                "${manifestUrl}manifest.json"
            } else {
                "$manifestUrl/manifest.json"
            }
        } else {
            manifestUrl
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isInstalling = true, installError = null) }

            val result = addonRepository.installAddon(normalizedUrl)

            result.onSuccess { addon ->
                Log.d(TAG, "Successfully installed addon: ${addon.name}")
                _uiState.update {
                    it.copy(
                        isInstalling = false,
                        showInstallDialog = false,
                        addonUrlInput = ""
                    )
                }
            }.onFailure { error ->
                Log.e(TAG, "Failed to install addon", error)
                _uiState.update {
                    it.copy(
                        isInstalling = false,
                        installError = error.message ?: "Failed to install addon"
                    )
                }
            }
        }
    }

    fun removeAddon(addonId: String) {
        viewModelScope.launch {
            val result = addonRepository.removeAddon(addonId)
            result.onFailure { error ->
                Log.e(TAG, "Failed to remove addon", error)
            }
        }
    }

    fun moveAddonUp(addonId: String) {
        viewModelScope.launch {
            addonRepository.moveAddonUp(addonId)
        }
    }

    fun moveAddonDown(addonId: String) {
        viewModelScope.launch {
            addonRepository.moveAddonDown(addonId)
        }
    }

    fun installDefaultAddons() {
        viewModelScope.launch {
            _uiState.update { it.copy(isInstalling = true) }

            AddonRepository.DEFAULT_ADDONS.forEach { url ->
                try {
                    addonRepository.installAddon(url)
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to install default addon: $url", e)
                }
            }

            _uiState.update { it.copy(isInstalling = false) }
        }
    }
}
