package com.nuvio.tv.data.repository

import android.util.Log
import com.nuvio.tv.data.api.TorBoxApi
import com.nuvio.tv.data.local.MMKVDataSource
import com.nuvio.tv.domain.model.TorBoxConfig
import com.nuvio.tv.domain.model.TorBoxUser
import com.nuvio.tv.domain.model.TorrentioConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository for managing debrid service configurations.
 * Handles TorBox and Torrentio integrations.
 */
@Singleton
class DebridRepository @Inject constructor(
    private val torBoxApi: TorBoxApi,
    private val addonRepository: AddonRepository,
    private val mmkvDataSource: MMKVDataSource
) {
    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    private val _torBoxConfig = MutableStateFlow(TorBoxConfig())
    val torBoxConfig: StateFlow<TorBoxConfig> = _torBoxConfig.asStateFlow()

    private val _torBoxUser = MutableStateFlow<TorBoxUser?>(null)
    val torBoxUser: StateFlow<TorBoxUser?> = _torBoxUser.asStateFlow()

    private val _torrentioConfig = MutableStateFlow(TorrentioConfig())
    val torrentioConfig: StateFlow<TorrentioConfig> = _torrentioConfig.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    companion object {
        private const val TAG = "DebridRepository"
        private const val KEY_TORBOX_CONFIG = "torbox_debrid_config"
        private const val KEY_TORRENTIO_CONFIG = "torrentio_config"
    }

    /**
     * Initialize repository and load saved configurations.
     */
    suspend fun initialize() {
        withContext(Dispatchers.IO) {
            loadTorBoxConfig()
            loadTorrentioConfig()

            // If TorBox is connected, fetch user info
            if (_torBoxConfig.value.isConnected && _torBoxConfig.value.apiKey.isNotEmpty()) {
                fetchTorBoxUserInfo(_torBoxConfig.value.apiKey)
            }
        }
    }

    // ==================== TorBox Integration ====================

    /**
     * Connect TorBox with API key.
     * Validates the key, installs the addon, and saves the config.
     */
    suspend fun connectTorBox(apiKey: String): Result<TorBoxUser> = withContext(Dispatchers.IO) {
        _isLoading.value = true
        try {
            // Validate API key by fetching user info
            val userResult = fetchTorBoxUserInfo(apiKey)
            if (userResult.isFailure) {
                return@withContext Result.failure(
                    userResult.exceptionOrNull() ?: Exception("Failed to validate API key")
                )
            }

            val user = userResult.getOrThrow()

            // Install TorBox addon
            val manifestUrl = TorBoxApi.getManifestUrl(apiKey)
            val addonResult = addonRepository.installAddon(manifestUrl)

            if (addonResult.isFailure) {
                return@withContext Result.failure(
                    addonResult.exceptionOrNull() ?: Exception("Failed to install TorBox addon")
                )
            }

            val addon = addonResult.getOrThrow()

            // Save config
            val config = TorBoxConfig(
                apiKey = apiKey,
                isConnected = true,
                isEnabled = true,
                addonId = addon.id
            )
            saveTorBoxConfig(config)

            Log.d(TAG, "TorBox connected successfully for user: ${user.email}")
            Result.success(user)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to connect TorBox", e)
            Result.failure(e)
        } finally {
            _isLoading.value = false
        }
    }

    /**
     * Disconnect TorBox and remove the addon.
     */
    suspend fun disconnectTorBox(): Result<Unit> = withContext(Dispatchers.IO) {
        _isLoading.value = true
        try {
            val config = _torBoxConfig.value

            // Remove addon if installed
            if (config.addonId != null) {
                addonRepository.removeAddon(config.addonId)
            }

            // Clear config
            val newConfig = TorBoxConfig()
            saveTorBoxConfig(newConfig)
            _torBoxUser.value = null

            Log.d(TAG, "TorBox disconnected successfully")
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to disconnect TorBox", e)
            Result.failure(e)
        } finally {
            _isLoading.value = false
        }
    }

    /**
     * Enable or disable TorBox addon.
     */
    suspend fun setTorBoxEnabled(enabled: Boolean) {
        val config = _torBoxConfig.value.copy(isEnabled = enabled)
        saveTorBoxConfig(config)
        // TODO: Actually enable/disable the addon in addon repository
    }

    /**
     * Refresh TorBox user info.
     */
    suspend fun refreshTorBoxUser(): Result<TorBoxUser> = withContext(Dispatchers.IO) {
        val apiKey = _torBoxConfig.value.apiKey
        if (apiKey.isEmpty()) {
            return@withContext Result.failure(Exception("No API key configured"))
        }
        fetchTorBoxUserInfo(apiKey)
    }

    /**
     * Fetch TorBox user information from API.
     */
    private suspend fun fetchTorBoxUserInfo(apiKey: String): Result<TorBoxUser> {
        return try {
            val response = torBoxApi.getUserInfo(
                authorization = TorBoxApi.getAuthHeader(apiKey)
            )

            if (response.success && response.data != null) {
                val user = response.data.toTorBoxUser()
                _torBoxUser.value = user
                Result.success(user)
            } else {
                val error = response.error ?: response.detail ?: "Unknown error"
                Log.e(TAG, "TorBox API error: $error")
                Result.failure(Exception(error))
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to fetch TorBox user info", e)
            Result.failure(e)
        }
    }

    /**
     * Load TorBox config from storage.
     */
    private fun loadTorBoxConfig() {
        try {
            val configJson = mmkvDataSource.getString(KEY_TORBOX_CONFIG, "")
            if (configJson.isNotEmpty()) {
                val config = json.decodeFromString<TorBoxConfigDto>(configJson)
                _torBoxConfig.value = config.toTorBoxConfig()
                Log.d(TAG, "Loaded TorBox config: connected=${config.isConnected}")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to load TorBox config", e)
        }
    }

    /**
     * Save TorBox config to storage.
     */
    private fun saveTorBoxConfig(config: TorBoxConfig) {
        try {
            val dto = TorBoxConfigDto.fromTorBoxConfig(config)
            val configJson = json.encodeToString(dto)
            mmkvDataSource.putString(KEY_TORBOX_CONFIG, configJson)
            _torBoxConfig.value = config
            Log.d(TAG, "Saved TorBox config: connected=${config.isConnected}")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to save TorBox config", e)
        }
    }

    // ==================== Torrentio Integration ====================

    /**
     * Install Torrentio with current configuration.
     */
    suspend fun installTorrentio(): Result<Unit> = withContext(Dispatchers.IO) {
        _isLoading.value = true
        try {
            val config = _torrentioConfig.value
            val manifestUrl = config.generateManifestUrl()

            val addonResult = addonRepository.installAddon(manifestUrl)
            if (addonResult.isFailure) {
                return@withContext Result.failure(
                    addonResult.exceptionOrNull() ?: Exception("Failed to install Torrentio")
                )
            }

            // Update config with manifest URL and installed status
            val newConfig = config.copy(
                isInstalled = true,
                manifestUrl = manifestUrl
            )
            saveTorrentioConfig(newConfig)

            Log.d(TAG, "Torrentio installed successfully")
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to install Torrentio", e)
            Result.failure(e)
        } finally {
            _isLoading.value = false
        }
    }

    /**
     * Remove Torrentio addon.
     */
    suspend fun removeTorrentio(): Result<Unit> = withContext(Dispatchers.IO) {
        _isLoading.value = true
        try {
            // Find and remove Torrentio addon
            // Torrentio addons have URLs containing "torrentio.strem.fun"
            val addons = addonRepository.getInstalledAddonsSync()
            val torrentioAddon = addons.find {
                it.manifestUrl?.contains("torrentio.strem.fun") == true
            }

            if (torrentioAddon != null) {
                addonRepository.removeAddon(torrentioAddon.id)
            }

            // Update config
            val newConfig = _torrentioConfig.value.copy(
                isInstalled = false,
                manifestUrl = null
            )
            saveTorrentioConfig(newConfig)

            Log.d(TAG, "Torrentio removed successfully")
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to remove Torrentio", e)
            Result.failure(e)
        } finally {
            _isLoading.value = false
        }
    }

    /**
     * Update Torrentio configuration.
     */
    fun updateTorrentioConfig(config: TorrentioConfig) {
        saveTorrentioConfig(config)
    }

    /**
     * Load Torrentio config from storage.
     */
    private fun loadTorrentioConfig() {
        try {
            val configJson = mmkvDataSource.getString(KEY_TORRENTIO_CONFIG, "")
            if (configJson.isNotEmpty()) {
                val config = json.decodeFromString<TorrentioConfigDto>(configJson)
                _torrentioConfig.value = config.toTorrentioConfig()
                Log.d(TAG, "Loaded Torrentio config: installed=${config.isInstalled}")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to load Torrentio config", e)
        }
    }

    /**
     * Save Torrentio config to storage.
     */
    private fun saveTorrentioConfig(config: TorrentioConfig) {
        try {
            val dto = TorrentioConfigDto.fromTorrentioConfig(config)
            val configJson = json.encodeToString(dto)
            mmkvDataSource.putString(KEY_TORRENTIO_CONFIG, configJson)
            _torrentioConfig.value = config
            Log.d(TAG, "Saved Torrentio config: installed=${config.isInstalled}")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to save Torrentio config", e)
        }
    }
}

// ==================== DTOs for serialization ====================

@kotlinx.serialization.Serializable
private data class TorBoxConfigDto(
    val apiKey: String = "",
    val isConnected: Boolean = false,
    val isEnabled: Boolean = true,
    val addonId: String? = null
) {
    fun toTorBoxConfig() = TorBoxConfig(apiKey, isConnected, isEnabled, addonId)

    companion object {
        fun fromTorBoxConfig(config: TorBoxConfig) = TorBoxConfigDto(
            config.apiKey, config.isConnected, config.isEnabled, config.addonId
        )
    }
}

@kotlinx.serialization.Serializable
private data class TorrentioConfigDto(
    val providers: List<String> = TorrentioConfig.DEFAULT_PROVIDERS,
    val sort: String = "quality",
    val qualityFilter: List<String> = listOf("scr", "cam"),
    val priorityLanguages: List<String> = emptyList(),
    val maxResults: String = "",
    val debridService: String = "torbox",
    val debridApiKey: String = "",
    val noDownloadLinks: Boolean = false,
    val noCatalog: Boolean = false,
    val isInstalled: Boolean = false,
    val manifestUrl: String? = null
) {
    fun toTorrentioConfig() = TorrentioConfig(
        providers, sort, qualityFilter, priorityLanguages, maxResults,
        debridService, debridApiKey, noDownloadLinks, noCatalog,
        isInstalled, manifestUrl
    )

    companion object {
        fun fromTorrentioConfig(config: TorrentioConfig) = TorrentioConfigDto(
            config.providers, config.sort, config.qualityFilter, config.priorityLanguages,
            config.maxResults, config.debridService, config.debridApiKey,
            config.noDownloadLinks, config.noCatalog, config.isInstalled, config.manifestUrl
        )
    }
}
