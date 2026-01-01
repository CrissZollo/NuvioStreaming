package com.nuvio.tv.data.repository

import android.util.Log
import com.nuvio.tv.data.local.MMKVDataSource
import com.nuvio.tv.data.remote.api.StremioApi
import com.nuvio.tv.data.remote.api.StremioUrlHelper
import com.nuvio.tv.data.remote.dto.ManifestDto
import com.nuvio.tv.domain.model.Addon
import com.nuvio.tv.domain.model.AddonBehaviorHints
import com.nuvio.tv.domain.model.AddonResource
import com.nuvio.tv.domain.model.Catalog
import com.nuvio.tv.domain.model.CatalogExtra
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.int
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository for managing Stremio addons.
 * Handles addon installation, removal, ordering, and persistence.
 * Compatible with the mobile app's storage format.
 */
@Singleton
class AddonRepository @Inject constructor(
    private val stremioApi: StremioApi,
    private val mmkvDataSource: MMKVDataSource
) {
    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        coerceInputValues = true
    }

    private val mutex = Mutex()
    private val _installedAddons = MutableStateFlow<List<Addon>>(emptyList())
    val installedAddons: Flow<List<Addon>> = _installedAddons.asStateFlow()

    // Cache of loaded addons by manifest URL
    private val addonCache = mutableMapOf<String, Addon>()

    companion object {
        private const val TAG = "AddonRepository"

        // Keys matching the mobile app's storage format
        private const val KEY_USER_SCOPE = "@user:current"
        private const val KEY_ADDON_MANIFESTS_BASE = "stremio-addons"
        private const val KEY_ADDON_ORDER = "stremio-addon-order"

        // Default addons that should be installed
        val DEFAULT_ADDONS = listOf(
            "https://v3-cinemeta.strem.io/manifest.json", // Cinemeta (metadata)
            "https://opensubtitles-v3.strem.io/manifest.json" // OpenSubtitles v3
        )
    }

    /**
     * Initialize repository and load installed addons.
     */
    suspend fun initialize() {
        withContext(Dispatchers.IO) {
            loadInstalledAddons()

            // Install default addons if none installed
            if (_installedAddons.value.isEmpty()) {
                Log.d(TAG, "No addons found, installing defaults")
                for (url in DEFAULT_ADDONS) {
                    Log.d(TAG, "Installing default addon: $url")
                    val result = installAddon(url)
                    result.onSuccess { addon ->
                        Log.d(TAG, "Successfully installed default addon: ${addon.name}")
                    }.onFailure { error ->
                        Log.e(TAG, "Failed to install default addon: $url", error)
                    }
                }
                Log.d(TAG, "Default addon installation complete. Total addons: ${_installedAddons.value.size}")
            }
        }
    }

    /**
     * Load installed addons from storage.
     * Tries multiple storage key formats for compatibility with mobile app.
     */
    private suspend fun loadInstalledAddons() {
        mutex.withLock {
            val addons = mutableListOf<Addon>()

            // Try to load from mobile app's scoped storage format first
            val scope = mmkvDataSource.getString(KEY_USER_SCOPE, "local")
            val scopedKey = "@user:$scope:$KEY_ADDON_MANIFESTS_BASE"
            val legacyKey = "@user:local:$KEY_ADDON_MANIFESTS_BASE"
            val simpleKey = KEY_ADDON_MANIFESTS_BASE

            Log.d(TAG, "Trying to load addons from storage")
            Log.d(TAG, "  - Scoped key: $scopedKey")
            Log.d(TAG, "  - Legacy key: $legacyKey")
            Log.d(TAG, "  - Simple key: $simpleKey")

            // Try scoped key first, then legacy, then simple
            var addonsJson = mmkvDataSource.getSharedString(scopedKey, "")
            if (addonsJson.isEmpty()) {
                addonsJson = mmkvDataSource.getSharedString(legacyKey, "")
            }
            if (addonsJson.isEmpty()) {
                addonsJson = mmkvDataSource.getSharedString(simpleKey, "")
            }

            if (addonsJson.isNotEmpty() && addonsJson != "[]") {
                Log.d(TAG, "Found addons JSON: ${addonsJson.take(200)}...")
                try {
                    // Mobile app stores full manifest objects, not just URLs
                    val parsedAddons = parseAddonsFromJson(addonsJson)
                    addons.addAll(parsedAddons)
                    Log.d(TAG, "Loaded ${addons.size} addons from storage")
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to parse addons JSON", e)
                    // Try loading as URL list (legacy format)
                    try {
                        val urls = json.decodeFromString(ListSerializer(String.serializer()), addonsJson)
                        urls.forEach { url ->
                            try {
                                val addon = fetchAndCacheAddon(url)
                                addons.add(addon)
                            } catch (fetchError: Exception) {
                                Log.e(TAG, "Failed to fetch addon: $url", fetchError)
                            }
                        }
                    } catch (urlParseError: Exception) {
                        Log.e(TAG, "Failed to parse as URL list", urlParseError)
                    }
                }
            } else {
                Log.d(TAG, "No addons found in storage")
            }

            // Sort by stored order if available
            val addonOrder = getAddonOrder()
            val sortedAddons = if (addonOrder.isNotEmpty()) {
                addons.sortedBy { addon ->
                    val index = addonOrder.indexOf(addon.id)
                    if (index == -1) Int.MAX_VALUE else index
                }
            } else {
                addons
            }

            _installedAddons.value = sortedAddons
            Log.d(TAG, "Final addon count: ${sortedAddons.size}")
            sortedAddons.forEach { addon ->
                Log.d(TAG, "  - ${addon.name} (${addon.id}): ${addon.catalogs.size} catalogs")
            }
        }
    }

    /**
     * Parse addons from JSON stored by mobile app.
     * Mobile app stores full manifest objects.
     */
    private fun parseAddonsFromJson(jsonString: String): List<Addon> {
        val addons = mutableListOf<Addon>()

        try {
            val jsonArray = json.parseToJsonElement(jsonString).jsonArray

            for (element in jsonArray) {
                try {
                    val addon = parseAddonFromJsonElement(element)
                    if (addon != null) {
                        addons.add(addon)
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to parse addon element", e)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse addons array", e)
        }

        return addons
    }

    /**
     * Parse a single addon from JSON element.
     */
    private fun parseAddonFromJsonElement(element: JsonElement): Addon? {
        val obj = element.jsonObject

        val id = obj["id"]?.jsonPrimitive?.contentOrNull ?: return null
        val name = obj["name"]?.jsonPrimitive?.contentOrNull ?: id
        val version = obj["version"]?.jsonPrimitive?.contentOrNull ?: "0.0.0"
        val description = obj["description"]?.jsonPrimitive?.contentOrNull
        val url = obj["url"]?.jsonPrimitive?.contentOrNull ?: ""
        val manifestUrl = obj["originalUrl"]?.jsonPrimitive?.contentOrNull
            ?: obj["manifestUrl"]?.jsonPrimitive?.contentOrNull
            ?: url
        val background = obj["background"]?.jsonPrimitive?.contentOrNull
        val logo = obj["logo"]?.jsonPrimitive?.contentOrNull

        // Parse catalogs
        val catalogs = mutableListOf<Catalog>()
        obj["catalogs"]?.jsonArray?.forEach { catalogElement ->
            try {
                val catalogObj = catalogElement.jsonObject
                val catalogType = catalogObj["type"]?.jsonPrimitive?.contentOrNull ?: return@forEach
                val catalogId = catalogObj["id"]?.jsonPrimitive?.contentOrNull ?: return@forEach
                val catalogName = catalogObj["name"]?.jsonPrimitive?.contentOrNull ?: catalogId

                val extraSupported = catalogObj["extraSupported"]?.jsonArray?.mapNotNull {
                    it.jsonPrimitive.contentOrNull
                }
                val extraRequired = catalogObj["extraRequired"]?.jsonArray?.mapNotNull {
                    it.jsonPrimitive.contentOrNull
                }

                // Parse extra definitions
                val extra = catalogObj["extra"]?.jsonArray?.mapNotNull { extraElement ->
                    try {
                        val extraObj = extraElement.jsonObject
                        CatalogExtra(
                            name = extraObj["name"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null,
                            isRequired = extraObj["isRequired"]?.jsonPrimitive?.booleanOrNull ?: false,
                            options = extraObj["options"]?.jsonArray?.mapNotNull { it.jsonPrimitive.contentOrNull },
                            optionsLimit = extraObj["optionsLimit"]?.jsonPrimitive?.intOrNull
                        )
                    } catch (e: Exception) {
                        null
                    }
                }

                catalogs.add(Catalog(
                    type = catalogType,
                    id = catalogId,
                    name = catalogName,
                    extraSupported = extraSupported,
                    extraRequired = extraRequired,
                    extra = extra
                ))
            } catch (e: Exception) {
                Log.e(TAG, "Failed to parse catalog", e)
            }
        }

        // Parse resources
        val resources = mutableListOf<AddonResource>()
        obj["resources"]?.jsonArray?.forEach { resourceElement ->
            try {
                val resourceObj = resourceElement.jsonObject
                val resourceName = resourceObj["name"]?.jsonPrimitive?.contentOrNull ?: return@forEach
                val resTypes = resourceObj["types"]?.jsonArray?.mapNotNull { it.jsonPrimitive.contentOrNull } ?: emptyList()
                val idPrefixes = resourceObj["idPrefixes"]?.jsonArray?.mapNotNull { it.jsonPrimitive.contentOrNull } ?: emptyList()

                resources.add(AddonResource(
                    name = resourceName,
                    types = resTypes,
                    idPrefixes = idPrefixes
                ))
            } catch (e: Exception) {
                Log.e(TAG, "Failed to parse resource", e)
            }
        }

        // Parse types
        val types = obj["types"]?.jsonArray?.mapNotNull { it.jsonPrimitive.contentOrNull } ?: emptyList()

        // Parse idPrefixes
        val idPrefixes = obj["idPrefixes"]?.jsonArray?.mapNotNull { it.jsonPrimitive.contentOrNull } ?: emptyList()

        // Parse behaviorHints
        val behaviorHints = obj["behaviorHints"]?.jsonObject?.let { hintsObj ->
            AddonBehaviorHints(
                configurable = hintsObj["configurable"]?.jsonPrimitive?.booleanOrNull ?: false,
                configurationRequired = hintsObj["configurationRequired"]?.jsonPrimitive?.booleanOrNull ?: false,
                adult = hintsObj["adult"]?.jsonPrimitive?.booleanOrNull ?: false,
                p2p = hintsObj["p2p"]?.jsonPrimitive?.booleanOrNull ?: false
            )
        }

        return Addon(
            id = id,
            name = name,
            version = version,
            description = description,
            url = url,
            manifestUrl = manifestUrl,
            catalogs = catalogs,
            resources = resources,
            types = types,
            idPrefixes = idPrefixes,
            background = background,
            logo = logo,
            behaviorHints = behaviorHints
        )
    }

    /**
     * Install an addon from its manifest URL.
     */
    suspend fun installAddon(manifestUrl: String): Result<Addon> {
        return withContext(Dispatchers.IO) {
            try {
                val addon = fetchAndCacheAddon(manifestUrl)

                mutex.withLock {
                    // Check if already installed
                    if (_installedAddons.value.any { it.id == addon.id }) {
                        return@withContext Result.failure(Exception("Addon already installed"))
                    }

                    // Add to installed list
                    val updatedList = _installedAddons.value + addon
                    _installedAddons.value = updatedList

                    // Save to storage in mobile app format
                    saveAddonsToStorage(updatedList)
                    saveAddonOrder(updatedList.map { it.id })
                }

                Result.success(addon)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to install addon: $manifestUrl", e)
                Result.failure(e)
            }
        }
    }

    /**
     * Remove an installed addon.
     */
    suspend fun removeAddon(addonId: String): Result<Unit> {
        return withContext(Dispatchers.IO) {
            mutex.withLock {
                val addon = _installedAddons.value.find { it.id == addonId }
                    ?: return@withContext Result.failure(Exception("Addon not found"))

                // Remove from cache
                addonCache.remove(addon.manifestUrl)

                // Update installed list
                val updatedList = _installedAddons.value.filter { it.id != addonId }
                _installedAddons.value = updatedList

                // Save to storage in mobile app format
                saveAddonsToStorage(updatedList)
                saveAddonOrder(updatedList.map { it.id })

                Result.success(Unit)
            }
        }
    }

    /**
     * Move an addon up in the priority order.
     */
    suspend fun moveAddonUp(addonId: String) {
        mutex.withLock {
            val currentList = _installedAddons.value.toMutableList()
            val index = currentList.indexOfFirst { it.id == addonId }

            if (index > 0) {
                val addon = currentList.removeAt(index)
                currentList.add(index - 1, addon)
                _installedAddons.value = currentList
                saveAddonOrder(currentList.map { it.id })
            }
        }
    }

    /**
     * Move an addon down in the priority order.
     */
    suspend fun moveAddonDown(addonId: String) {
        mutex.withLock {
            val currentList = _installedAddons.value.toMutableList()
            val index = currentList.indexOfFirst { it.id == addonId }

            if (index >= 0 && index < currentList.size - 1) {
                val addon = currentList.removeAt(index)
                currentList.add(index + 1, addon)
                _installedAddons.value = currentList
                saveAddonOrder(currentList.map { it.id })
            }
        }
    }

    /**
     * Get current list of installed addons (snapshot).
     */
    fun getInstalledAddonsSync(): List<Addon> {
        return _installedAddons.value
    }

    /**
     * Get addons that provide streams.
     */
    fun getStreamAddons(): List<Addon> {
        return _installedAddons.value.filter { it.providesStreams }
    }

    /**
     * Get addons that provide metadata.
     */
    fun getMetaAddons(): List<Addon> {
        return _installedAddons.value.filter { it.providesMeta }
    }

    /**
     * Get addons that provide catalogs.
     */
    fun getCatalogAddons(): List<Addon> {
        return _installedAddons.value.filter { it.providesCatalogs }
    }

    /**
     * Get addons that provide subtitles.
     */
    fun getSubtitleAddons(): List<Addon> {
        return _installedAddons.value.filter { it.providesSubtitles }
    }

    /**
     * Get addons that support search.
     */
    fun getSearchableAddons(): List<Addon> {
        return _installedAddons.value.filter { it.supportsSearch }
    }

    /**
     * Fetch addon manifest and cache it.
     */
    private suspend fun fetchAndCacheAddon(manifestUrl: String): Addon {
        // Check cache first
        addonCache[manifestUrl]?.let { return it }

        val response = stremioApi.getManifest(manifestUrl)
        if (!response.isSuccessful) {
            throw Exception("Failed to fetch addon manifest: ${response.code()}")
        }

        val manifestDto = response.body()
            ?: throw Exception("Empty manifest response")

        val addon = manifestDto.toAddon(manifestUrl)
        addonCache[manifestUrl] = addon
        return addon
    }

    /**
     * Save addons to storage in the mobile app's format.
     */
    private fun saveAddonsToStorage(addons: List<Addon>) {
        // Save in mobile app's format - full manifest objects
        val scope = mmkvDataSource.getString(KEY_USER_SCOPE, "local")
        val scopedKey = "@user:$scope:$KEY_ADDON_MANIFESTS_BASE"

        // Build JSON array of addon manifests
        val addonsJsonArray = buildString {
            append("[")
            addons.forEachIndexed { index, addon ->
                if (index > 0) append(",")
                append(addonToJsonString(addon))
            }
            append("]")
        }

        mmkvDataSource.putSharedString(scopedKey, addonsJsonArray)
        Log.d(TAG, "Saved ${addons.size} addons to storage")
    }

    /**
     * Convert addon to JSON string for storage.
     */
    private fun addonToJsonString(addon: Addon): String {
        return buildString {
            append("{")
            append("\"id\":\"${addon.id}\",")
            append("\"name\":\"${escapeJson(addon.name)}\",")
            append("\"version\":\"${addon.version}\",")
            addon.description?.let { append("\"description\":\"${escapeJson(it)}\",") }
            append("\"url\":\"${addon.url}\",")
            append("\"originalUrl\":\"${addon.manifestUrl}\",")
            addon.background?.let { append("\"background\":\"$it\",") }
            addon.logo?.let { append("\"logo\":\"$it\",") }

            // Types
            append("\"types\":[")
            addon.types.forEachIndexed { i, t -> if (i > 0) append(","); append("\"$t\"") }
            append("],")

            // Catalogs
            append("\"catalogs\":[")
            addon.catalogs.forEachIndexed { i, catalog ->
                if (i > 0) append(",")
                append("{\"type\":\"${catalog.type}\",\"id\":\"${catalog.id}\",\"name\":\"${escapeJson(catalog.name)}\"")
                catalog.extraSupported?.let { extras ->
                    append(",\"extraSupported\":[")
                    extras.forEachIndexed { j, e -> if (j > 0) append(","); append("\"$e\"") }
                    append("]")
                }
                append("}")
            }
            append("],")

            // Resources
            append("\"resources\":[")
            addon.resources.forEachIndexed { i, resource ->
                if (i > 0) append(",")
                append("{\"name\":\"${resource.name}\"")
                resource.types?.let { types ->
                    append(",\"types\":[")
                    types.forEachIndexed { j, t -> if (j > 0) append(","); append("\"$t\"") }
                    append("]")
                }
                if (resource.idPrefixes.isNotEmpty()) {
                    append(",\"idPrefixes\":[")
                    resource.idPrefixes.forEachIndexed { j, p -> if (j > 0) append(","); append("\"$p\"") }
                    append("]")
                }
                append("}")
            }
            append("]")

            // Behavior hints
            addon.behaviorHints?.let { hints ->
                append(",\"behaviorHints\":{")
                append("\"configurable\":${hints.configurable}")
                append(",\"configurationRequired\":${hints.configurationRequired}")
                append(",\"adult\":${hints.adult}")
                append(",\"p2p\":${hints.p2p}")
                append("}")
            }

            append("}")
        }
    }

    private fun escapeJson(s: String): String {
        return s.replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "\\r")
            .replace("\t", "\\t")
    }

    /**
     * Get addon order from storage.
     */
    private fun getAddonOrder(): List<String> {
        val orderJson = mmkvDataSource.getSharedString(KEY_ADDON_ORDER, "[]")
        return try {
            json.decodeFromString(ListSerializer(String.serializer()), orderJson)
        } catch (e: Exception) {
            emptyList()
        }
    }

    /**
     * Save addon order to storage.
     */
    private fun saveAddonOrder(order: List<String>) {
        val orderJson = json.encodeToString(ListSerializer(String.serializer()), order)
        mmkvDataSource.putSharedString(KEY_ADDON_ORDER, orderJson)
    }

    /**
     * Convert ManifestDto to Addon domain model.
     */
    private fun ManifestDto.toAddon(manifestUrl: String): Addon {
        return Addon(
            id = id,
            name = name,
            version = version,
            description = description,
            url = StremioUrlHelper.getBaseUrl(manifestUrl),
            manifestUrl = manifestUrl,
            catalogs = catalogs?.map { catalog ->
                Catalog(
                    type = catalog.type,
                    id = catalog.id,
                    name = catalog.name,
                    extraSupported = catalog.extraSupported,
                    extraRequired = catalog.extraRequired,
                    extra = catalog.extra?.map { extra ->
                        CatalogExtra(
                            name = extra.name,
                            isRequired = extra.isRequired ?: false,
                            options = extra.options,
                            optionsLimit = extra.optionsLimit
                        )
                    }
                )
            } ?: emptyList(),
            resources = resources?.map { resource ->
                AddonResource(
                    name = resource.name,
                    types = resource.types,
                    idPrefixes = resource.idPrefixes ?: emptyList()
                )
            } ?: emptyList(),
            types = types ?: emptyList(),
            idPrefixes = idPrefixes ?: emptyList(),
            background = background,
            logo = logo,
            behaviorHints = behaviorHints?.let {
                AddonBehaviorHints(
                    configurable = it.configurable ?: false,
                    configurationRequired = it.configurationRequired ?: false,
                    adult = it.adult ?: false,
                    p2p = it.p2p ?: false
                )
            }
        )
    }
}
