package com.nuvio.tv.data.repository

import android.util.Log
import com.tencent.mmkv.MMKV
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository for app settings.
 * Stores settings in MMKV (shared with mobile app where applicable).
 */
@Singleton
class SettingsRepository @Inject constructor() {

    companion object {
        private const val TAG = "SettingsRepository"
        private const val MMKV_ID = "nuvio_settings"

        // Setting keys
        private const val KEY_THEME = "selected_theme"
        private const val KEY_SUBTITLE_SIZE = "subtitle_size"
        private const val KEY_SUBTITLE_COLOR = "subtitle_color"
        private const val KEY_SUBTITLE_BACKGROUND = "subtitle_background"
        private const val KEY_AUTO_PLAY_NEXT = "auto_play_next"
        private const val KEY_SKIP_INTRO = "skip_intro"
        private const val KEY_SKIP_CREDITS = "skip_credits"
        private const val KEY_RESUME_PLAYBACK = "resume_playback"
        private const val KEY_DEFAULT_QUALITY = "default_quality"
        private const val KEY_PREFERRED_AUDIO_LANG = "preferred_audio_lang"
        private const val KEY_PREFERRED_SUBTITLE_LANG = "preferred_subtitle_lang"
        private const val KEY_SHOW_CONTINUE_WATCHING = "show_continue_watching"
        private const val KEY_SHOW_THIS_WEEK = "show_this_week"
        private const val KEY_DEBRID_SERVICE = "debrid_service"
        private const val KEY_DEBRID_API_KEY = "debrid_api_key"
        private const val KEY_PLAYER_TYPE = "player_type"
        private const val KEY_CACHE_SIZE_MB = "cache_size_mb"
        private const val KEY_STREAM_SORT_MODE = "stream_sort_mode"

        // Default values
        const val DEFAULT_THEME = "nuvio"
        const val DEFAULT_SUBTITLE_SIZE = 18
        const val DEFAULT_SUBTITLE_COLOR = "#FFFFFF"
        const val DEFAULT_SUBTITLE_BACKGROUND = "#80000000"
        const val DEFAULT_QUALITY = "auto"
        const val DEFAULT_PLAYER_TYPE = "exoplayer"
        const val DEFAULT_CACHE_SIZE = 500 // MB
        const val DEFAULT_STREAM_SORT_MODE = "addon_order" // addon_order (respects addon sorting), quality, size, or addon
    }

    private val mmkv: MMKV by lazy {
        MMKV.mmkvWithID(MMKV_ID, MMKV.MULTI_PROCESS_MODE)
    }

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    // Observable settings
    private val _themeFlow = MutableStateFlow(DEFAULT_THEME)
    val themeFlow: Flow<String> = _themeFlow.asStateFlow()

    private val _settingsFlow = MutableStateFlow(AppSettings())
    val settingsFlow: Flow<AppSettings> = _settingsFlow.asStateFlow()

    /**
     * Initialize and load settings.
     */
    suspend fun initialize() {
        withContext(Dispatchers.IO) {
            loadSettings()
        }
    }

    // ==================== THEME ====================

    fun getTheme(): String {
        return mmkv.decodeString(KEY_THEME, DEFAULT_THEME) ?: DEFAULT_THEME
    }

    suspend fun setTheme(theme: String) {
        withContext(Dispatchers.IO) {
            mmkv.encode(KEY_THEME, theme)
            _themeFlow.value = theme
            loadSettings()
            Log.d(TAG, "Theme set to: $theme")
        }
    }

    // ==================== SUBTITLE SETTINGS ====================

    fun getSubtitleSize(): Int {
        return mmkv.decodeInt(KEY_SUBTITLE_SIZE, DEFAULT_SUBTITLE_SIZE)
    }

    suspend fun setSubtitleSize(size: Int) {
        withContext(Dispatchers.IO) {
            mmkv.encode(KEY_SUBTITLE_SIZE, size)
            loadSettings()
        }
    }

    fun getSubtitleColor(): String {
        return mmkv.decodeString(KEY_SUBTITLE_COLOR, DEFAULT_SUBTITLE_COLOR) ?: DEFAULT_SUBTITLE_COLOR
    }

    suspend fun setSubtitleColor(color: String) {
        withContext(Dispatchers.IO) {
            mmkv.encode(KEY_SUBTITLE_COLOR, color)
            loadSettings()
        }
    }

    fun getSubtitleBackground(): String {
        return mmkv.decodeString(KEY_SUBTITLE_BACKGROUND, DEFAULT_SUBTITLE_BACKGROUND) ?: DEFAULT_SUBTITLE_BACKGROUND
    }

    suspend fun setSubtitleBackground(background: String) {
        withContext(Dispatchers.IO) {
            mmkv.encode(KEY_SUBTITLE_BACKGROUND, background)
            loadSettings()
        }
    }

    // ==================== PLAYBACK SETTINGS ====================

    fun isAutoPlayNextEnabled(): Boolean {
        return mmkv.decodeBool(KEY_AUTO_PLAY_NEXT, true)
    }

    suspend fun setAutoPlayNext(enabled: Boolean) {
        withContext(Dispatchers.IO) {
            mmkv.encode(KEY_AUTO_PLAY_NEXT, enabled)
            loadSettings()
        }
    }

    fun isSkipIntroEnabled(): Boolean {
        return mmkv.decodeBool(KEY_SKIP_INTRO, false)
    }

    suspend fun setSkipIntro(enabled: Boolean) {
        withContext(Dispatchers.IO) {
            mmkv.encode(KEY_SKIP_INTRO, enabled)
            loadSettings()
        }
    }

    fun isSkipCreditsEnabled(): Boolean {
        return mmkv.decodeBool(KEY_SKIP_CREDITS, false)
    }

    suspend fun setSkipCredits(enabled: Boolean) {
        withContext(Dispatchers.IO) {
            mmkv.encode(KEY_SKIP_CREDITS, enabled)
            loadSettings()
        }
    }

    fun isResumePlaybackEnabled(): Boolean {
        return mmkv.decodeBool(KEY_RESUME_PLAYBACK, true)
    }

    suspend fun setResumePlayback(enabled: Boolean) {
        withContext(Dispatchers.IO) {
            mmkv.encode(KEY_RESUME_PLAYBACK, enabled)
            loadSettings()
        }
    }

    fun getDefaultQuality(): String {
        return mmkv.decodeString(KEY_DEFAULT_QUALITY, DEFAULT_QUALITY) ?: DEFAULT_QUALITY
    }

    suspend fun setDefaultQuality(quality: String) {
        withContext(Dispatchers.IO) {
            mmkv.encode(KEY_DEFAULT_QUALITY, quality)
            loadSettings()
        }
    }

    // ==================== LANGUAGE PREFERENCES ====================

    fun getPreferredAudioLanguage(): String? {
        return mmkv.decodeString(KEY_PREFERRED_AUDIO_LANG)
    }

    suspend fun setPreferredAudioLanguage(language: String?) {
        withContext(Dispatchers.IO) {
            if (language != null) {
                mmkv.encode(KEY_PREFERRED_AUDIO_LANG, language)
            } else {
                mmkv.removeValueForKey(KEY_PREFERRED_AUDIO_LANG)
            }
            loadSettings()
        }
    }

    fun getPreferredSubtitleLanguage(): String? {
        return mmkv.decodeString(KEY_PREFERRED_SUBTITLE_LANG)
    }

    suspend fun setPreferredSubtitleLanguage(language: String?) {
        withContext(Dispatchers.IO) {
            if (language != null) {
                mmkv.encode(KEY_PREFERRED_SUBTITLE_LANG, language)
            } else {
                mmkv.removeValueForKey(KEY_PREFERRED_SUBTITLE_LANG)
            }
            loadSettings()
        }
    }

    // ==================== HOME SCREEN SETTINGS ====================

    fun isShowContinueWatchingEnabled(): Boolean {
        return mmkv.decodeBool(KEY_SHOW_CONTINUE_WATCHING, true)
    }

    suspend fun setShowContinueWatching(enabled: Boolean) {
        withContext(Dispatchers.IO) {
            mmkv.encode(KEY_SHOW_CONTINUE_WATCHING, enabled)
            loadSettings()
        }
    }

    fun isShowThisWeekEnabled(): Boolean {
        return mmkv.decodeBool(KEY_SHOW_THIS_WEEK, true)
    }

    suspend fun setShowThisWeek(enabled: Boolean) {
        withContext(Dispatchers.IO) {
            mmkv.encode(KEY_SHOW_THIS_WEEK, enabled)
            loadSettings()
        }
    }

    // ==================== DEBRID SETTINGS ====================

    fun getDebridService(): String? {
        return mmkv.decodeString(KEY_DEBRID_SERVICE)
    }

    suspend fun setDebridService(service: String?) {
        withContext(Dispatchers.IO) {
            if (service != null) {
                mmkv.encode(KEY_DEBRID_SERVICE, service)
            } else {
                mmkv.removeValueForKey(KEY_DEBRID_SERVICE)
            }
            loadSettings()
        }
    }

    fun getDebridApiKey(): String? {
        return mmkv.decodeString(KEY_DEBRID_API_KEY)
    }

    suspend fun setDebridApiKey(apiKey: String?) {
        withContext(Dispatchers.IO) {
            if (apiKey != null) {
                mmkv.encode(KEY_DEBRID_API_KEY, apiKey)
            } else {
                mmkv.removeValueForKey(KEY_DEBRID_API_KEY)
            }
            loadSettings()
        }
    }

    fun hasDebridConfigured(): Boolean {
        val service = getDebridService()
        val apiKey = getDebridApiKey()
        return !service.isNullOrBlank() && !apiKey.isNullOrBlank()
    }

    // ==================== PLAYER SETTINGS ====================

    fun getPlayerType(): String {
        return mmkv.decodeString(KEY_PLAYER_TYPE, DEFAULT_PLAYER_TYPE) ?: DEFAULT_PLAYER_TYPE
    }

    suspend fun setPlayerType(playerType: String) {
        withContext(Dispatchers.IO) {
            mmkv.encode(KEY_PLAYER_TYPE, playerType)
            loadSettings()
        }
    }

    // ==================== CACHE SETTINGS ====================

    fun getCacheSizeMB(): Int {
        return mmkv.decodeInt(KEY_CACHE_SIZE_MB, DEFAULT_CACHE_SIZE)
    }

    suspend fun setCacheSizeMB(sizeMB: Int) {
        withContext(Dispatchers.IO) {
            mmkv.encode(KEY_CACHE_SIZE_MB, sizeMB)
            loadSettings()
        }
    }

    // ==================== STREAM SETTINGS ====================

    /**
     * Get the stream sort mode.
     * Options:
     * - "addon_order" (default): Respects the sorting provided by each addon (Stremio addons often have their own quality/relevance sorting)
     * - "quality": Sort by quality (4K > 1080p > 720p > 480p)
     * - "size": Sort by file size (largest first)
     * - "addon": Sort alphabetically by addon name
     *
     * Note: Cached/instant streams are always prioritized first regardless of sort mode.
     */
    fun getStreamSortMode(): String {
        return mmkv.decodeString(KEY_STREAM_SORT_MODE, DEFAULT_STREAM_SORT_MODE) ?: DEFAULT_STREAM_SORT_MODE
    }

    suspend fun setStreamSortMode(mode: String) {
        withContext(Dispatchers.IO) {
            mmkv.encode(KEY_STREAM_SORT_MODE, mode)
            loadSettings()
        }
    }

    // ==================== BULK SETTINGS ====================

    /**
     * Get all settings as an object.
     */
    fun getAllSettings(): AppSettings {
        return AppSettings(
            theme = getTheme(),
            subtitleSize = getSubtitleSize(),
            subtitleColor = getSubtitleColor(),
            subtitleBackground = getSubtitleBackground(),
            autoPlayNext = isAutoPlayNextEnabled(),
            skipIntro = isSkipIntroEnabled(),
            skipCredits = isSkipCreditsEnabled(),
            resumePlayback = isResumePlaybackEnabled(),
            defaultQuality = getDefaultQuality(),
            preferredAudioLanguage = getPreferredAudioLanguage(),
            preferredSubtitleLanguage = getPreferredSubtitleLanguage(),
            showContinueWatching = isShowContinueWatchingEnabled(),
            showThisWeek = isShowThisWeekEnabled(),
            debridService = getDebridService(),
            playerType = getPlayerType(),
            cacheSizeMB = getCacheSizeMB(),
            streamSortMode = getStreamSortMode()
        )
    }

    /**
     * Reset all settings to defaults.
     */
    suspend fun resetToDefaults() {
        withContext(Dispatchers.IO) {
            mmkv.clearAll()
            loadSettings()
            Log.d(TAG, "Reset all settings to defaults")
        }
    }

    private fun loadSettings() {
        _themeFlow.value = getTheme()
        _settingsFlow.value = getAllSettings()
    }
}

/**
 * Data class representing all app settings.
 */
@Serializable
data class AppSettings(
    val theme: String = SettingsRepository.DEFAULT_THEME,
    val subtitleSize: Int = SettingsRepository.DEFAULT_SUBTITLE_SIZE,
    val subtitleColor: String = SettingsRepository.DEFAULT_SUBTITLE_COLOR,
    val subtitleBackground: String = SettingsRepository.DEFAULT_SUBTITLE_BACKGROUND,
    val autoPlayNext: Boolean = true,
    val skipIntro: Boolean = false,
    val skipCredits: Boolean = false,
    val resumePlayback: Boolean = true,
    val defaultQuality: String = SettingsRepository.DEFAULT_QUALITY,
    val preferredAudioLanguage: String? = null,
    val preferredSubtitleLanguage: String? = null,
    val showContinueWatching: Boolean = true,
    val showThisWeek: Boolean = true,
    val debridService: String? = null,
    val playerType: String = SettingsRepository.DEFAULT_PLAYER_TYPE,
    val cacheSizeMB: Int = SettingsRepository.DEFAULT_CACHE_SIZE,
    val streamSortMode: String = SettingsRepository.DEFAULT_STREAM_SORT_MODE
)
