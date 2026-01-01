package com.nuvio.tv.ui.theme

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel for managing theme state across the app.
 * Reads the current theme from MMKV (shared with mobile app) and provides
 * a way to change themes.
 */
@HiltViewModel
class ThemeViewModel @Inject constructor(
    // Will inject SettingsRepository later for MMKV access
) : ViewModel() {

    private val _currentTheme = MutableStateFlow(ThemePreset.DEFAULT)
    val currentTheme: StateFlow<ThemePreset> = _currentTheme.asStateFlow()

    private val _availableThemes = MutableStateFlow(ThemePresets.allThemes)
    val availableThemes: StateFlow<List<ThemePreset>> = _availableThemes.asStateFlow()

    init {
        loadSavedTheme()
    }

    private fun loadSavedTheme() {
        viewModelScope.launch {
            // TODO: Load from MMKV settings repository
            // For now, use default theme
            _currentTheme.value = ThemePreset.DEFAULT
        }
    }

    fun setTheme(themeId: String) {
        viewModelScope.launch {
            val theme = ThemePresets.getById(themeId)
            _currentTheme.value = theme
            // TODO: Save to MMKV settings repository
        }
    }

    fun setTheme(theme: ThemePreset) {
        viewModelScope.launch {
            _currentTheme.value = theme
            // TODO: Save to MMKV settings repository
        }
    }
}
