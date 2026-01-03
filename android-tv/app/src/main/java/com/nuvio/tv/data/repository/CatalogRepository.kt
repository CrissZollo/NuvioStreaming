package com.nuvio.tv.data.repository

import android.util.Log
import com.nuvio.tv.data.remote.api.StremioApi
import com.nuvio.tv.data.remote.api.StremioUrlHelper
import com.nuvio.tv.domain.model.Addon
import com.nuvio.tv.domain.model.Catalog
import com.nuvio.tv.domain.model.CatalogConfig
import com.nuvio.tv.domain.model.CatalogContent
import com.nuvio.tv.domain.model.CatalogItem
import com.nuvio.tv.domain.model.PosterShape
import com.nuvio.tv.domain.model.StreamingContent
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository for fetching catalog content from Stremio addons.
 */
@Singleton
class CatalogRepository @Inject constructor(
    private val stremioApi: StremioApi,
    private val addonRepository: AddonRepository
) {

    companion object {
        private const val TAG = "CatalogRepository"
        private const val DEFAULT_PAGE_SIZE = 100
        private const val CACHE_EXPIRY_MS = 5 * 60 * 1000L // 5 minutes cache
    }

    // Simple in-memory cache for catalog content
    private data class CachedCatalog(
        val content: CatalogContent,
        val timestamp: Long
    )

    private val catalogCache = mutableMapOf<String, CachedCatalog>()

    private fun getCacheKey(config: CatalogConfig, page: Int = 1, genre: String? = null, search: String? = null): String {
        return "${config.addonId}:${config.catalogId}:${config.type}:$page:${genre ?: ""}:${search ?: ""}"
    }

    private fun getCachedCatalog(key: String): CatalogContent? {
        val cached = catalogCache[key] ?: return null
        val now = System.currentTimeMillis()
        return if (now - cached.timestamp < CACHE_EXPIRY_MS) {
            Log.d(TAG, "Cache hit for: $key")
            cached.content
        } else {
            catalogCache.remove(key)
            null
        }
    }

    private fun cacheCatalog(key: String, content: CatalogContent) {
        catalogCache[key] = CachedCatalog(content, System.currentTimeMillis())
    }

    /**
     * Clear all cached catalogs.
     */
    fun clearCache() {
        catalogCache.clear()
        Log.d(TAG, "Catalog cache cleared")
    }

    /**
     * Get catalogs for the home screen.
     * Loads ALL catalogs from ALL installed addons (same as mobile app).
     */
    suspend fun getHomeCatalogs(
        limit: Int = Int.MAX_VALUE
    ): List<CatalogContent> = withContext(Dispatchers.IO) {
        val catalogAddons = addonRepository.getCatalogAddons()
        if (catalogAddons.isEmpty()) {
            Log.d(TAG, "No catalog addons installed")
            return@withContext emptyList()
        }

        Log.d(TAG, "Loading catalogs from ${catalogAddons.size} addons:")
        catalogAddons.forEach { addon ->
            Log.d(TAG, "  - ${addon.name} (${addon.id}): ${addon.catalogs.size} catalogs")
            addon.catalogs.forEach { catalog ->
                Log.d(TAG, "      * ${catalog.name} (${catalog.id}/${catalog.type})")
            }
        }

        // Collect ALL catalogs from ALL addons (like the mobile app does)
        val allCatalogConfigs = catalogAddons.flatMap { addon ->
            addon.catalogs.map { catalog ->
                CatalogConfig(
                    addonId = addon.id,
                    addonName = addon.name,
                    catalogId = catalog.id,
                    catalogName = catalog.name,
                    type = catalog.type
                ) to addon
            }
        }

        Log.d(TAG, "Total catalogs to load: ${allCatalogConfigs.size}")

        // Apply limit if specified
        val selectedConfigs = if (limit < allCatalogConfigs.size) {
            allCatalogConfigs.take(limit)
        } else {
            allCatalogConfigs
        }

        // Fetch all catalogs in parallel
        coroutineScope {
            selectedConfigs.map { (config, addon) ->
                async {
                    try {
                        Log.d(TAG, "Fetching catalog: ${config.catalogName} (${config.catalogId}/${config.type})")
                        fetchCatalog(addon, config)
                    } catch (e: Exception) {
                        Log.e(TAG, "Failed to fetch catalog ${config.catalogName}: ${e.message}")
                        null
                    }
                }
            }.awaitAll().filterNotNull()
        }
    }

    /**
     * Get all available catalog configurations.
     */
    fun getAllCatalogConfigs(): List<Pair<CatalogConfig, Addon>> {
        return addonRepository.getCatalogAddons().flatMap { addon ->
            addon.catalogs.map { catalog ->
                CatalogConfig(
                    addonId = addon.id,
                    addonName = addon.name,
                    catalogId = catalog.id,
                    catalogName = catalog.name,
                    type = catalog.type
                ) to addon
            }
        }
    }

    /**
     * Fetch a specific catalog from an addon.
     */
    suspend fun fetchCatalog(
        addon: Addon,
        config: CatalogConfig,
        page: Int = 1,
        genre: String? = null,
        search: String? = null
    ): CatalogContent = withContext(Dispatchers.IO) {
        // Check cache first
        val cacheKey = getCacheKey(config, page, genre, search)
        getCachedCatalog(cacheKey)?.let { return@withContext it }

        val baseUrl = addon.url.removeSuffix("/")
        val catalog = addon.catalogs.find { it.id == config.catalogId }
            ?: throw Exception("Catalog not found")

        // Build extra parameters
        val extraParams = buildExtraParams(page, genre, search)

        // Build full URL for the catalog request
        val catalogUrl = if (extraParams.isNotEmpty()) {
            "$baseUrl/catalog/${config.type}/${config.catalogId}/$extraParams.json"
        } else {
            "$baseUrl/catalog/${config.type}/${config.catalogId}.json"
        }

        Log.d(TAG, "Fetching catalog: $catalogUrl")

        val response = stremioApi.getCatalog(catalogUrl)

        if (!response.isSuccessful) {
            Log.e(TAG, "Failed to fetch catalog: ${response.code()} - ${response.errorBody()?.string()}")
            throw Exception("Failed to fetch catalog: ${response.code()}")
        }

        val catalogResponse = response.body()
            ?: throw Exception("Empty catalog response")

        Log.d(TAG, "Catalog response: ${catalogResponse.metas?.size ?: 0} items")

        val items = catalogResponse.metas?.map { meta ->
            StreamingContent(
                id = meta.id,
                type = meta.type,
                name = meta.name,
                poster = meta.poster,
                posterShape = when (meta.posterShape) {
                    "landscape" -> PosterShape.LANDSCAPE
                    "square" -> PosterShape.SQUARE
                    else -> PosterShape.POSTER
                },
                background = meta.background,
                logo = meta.logo,
                description = meta.description,
                imdbRating = meta.imdbRating,
                year = meta.year,
                genres = meta.genres ?: emptyList(),
                releaseInfo = meta.releaseInfo,
                imdbId = meta.imdbId ?: if (meta.id.startsWith("tt")) meta.id else null,
                addonId = addon.id
            )
        } ?: emptyList()

        // Determine if there are more pages
        val hasMore = items.size >= DEFAULT_PAGE_SIZE && catalog.supportsPagination

        val result = CatalogContent(
            config = config,
            items = items,
            hasMore = hasMore
        )

        // Cache the result
        cacheCatalog(cacheKey, result)

        result
    }

    /**
     * Fetch catalog by type and optional genre.
     */
    suspend fun fetchCatalogByType(
        type: String,
        genre: String? = null,
        page: Int = 1
    ): List<StreamingContent> = withContext(Dispatchers.IO) {
        val catalogAddons = addonRepository.getCatalogAddons()

        // Find catalogs that support this type
        val results = coroutineScope {
            catalogAddons.flatMap { addon ->
                addon.getCatalogsForType(type).map { catalog ->
                    async {
                        try {
                            val config = CatalogConfig(
                                addonId = addon.id,
                                addonName = addon.name,
                                catalogId = catalog.id,
                                catalogName = catalog.name,
                                type = type
                            )
                            fetchCatalog(addon, config, page, genre)
                        } catch (e: Exception) {
                            null
                        }
                    }
                }
            }.awaitAll().filterNotNull()
        }

        // Combine and deduplicate results
        val allItems = results.flatMap { it.items }
        deduplicateContent(allItems)
    }

    /**
     * Search across all searchable addons.
     */
    suspend fun search(
        query: String,
        type: String? = null
    ): List<StreamingContent> = withContext(Dispatchers.IO) {
        val searchableAddons = addonRepository.getSearchableAddons()

        val results = coroutineScope {
            searchableAddons.flatMap { addon ->
                // Find searchable catalogs
                addon.catalogs.filter { catalog ->
                    catalog.supportsSearch && (type == null || catalog.type == type)
                }.map { catalog ->
                    async {
                        try {
                            val config = CatalogConfig(
                                addonId = addon.id,
                                addonName = addon.name,
                                catalogId = catalog.id,
                                catalogName = catalog.name,
                                type = catalog.type
                            )
                            fetchCatalog(addon, config, search = query)
                        } catch (e: Exception) {
                            null
                        }
                    }
                }
            }.awaitAll().filterNotNull()
        }

        // Combine and deduplicate results
        val allItems = results.flatMap { it.items }
        deduplicateContent(allItems)
    }

    /**
     * Search with results grouped by addon.
     */
    suspend fun searchGroupedByAddon(
        query: String,
        type: String? = null
    ): Map<String, List<StreamingContent>> = withContext(Dispatchers.IO) {
        val searchableAddons = addonRepository.getSearchableAddons()

        val results = coroutineScope {
            searchableAddons.flatMap { addon ->
                addon.catalogs.filter { catalog ->
                    catalog.supportsSearch && (type == null || catalog.type == type)
                }.map { catalog ->
                    async {
                        try {
                            val config = CatalogConfig(
                                addonId = addon.id,
                                addonName = addon.name,
                                catalogId = catalog.id,
                                catalogName = catalog.name,
                                type = catalog.type
                            )
                            addon.name to fetchCatalog(addon, config, search = query)
                        } catch (e: Exception) {
                            null
                        }
                    }
                }
            }.awaitAll().filterNotNull()
        }

        // Group by addon name
        results.groupBy(
            keySelector = { it.first },
            valueTransform = { it.second.items }
        ).mapValues { (_, lists) -> lists.flatten() }
    }

    /**
     * Live search with callback per addon.
     */
    suspend fun liveSearch(
        query: String,
        type: String? = null,
        onAddonResult: (addonName: String, results: List<StreamingContent>) -> Unit
    ) = withContext(Dispatchers.IO) {
        val searchableAddons = addonRepository.getSearchableAddons()

        coroutineScope {
            searchableAddons.forEach { addon ->
                addon.catalogs.filter { catalog ->
                    catalog.supportsSearch && (type == null || catalog.type == type)
                }.forEach { catalog ->
                    async {
                        try {
                            val config = CatalogConfig(
                                addonId = addon.id,
                                addonName = addon.name,
                                catalogId = catalog.id,
                                catalogName = catalog.name,
                                type = catalog.type
                            )
                            val content = fetchCatalog(addon, config, search = query)
                            onAddonResult(addon.name, content.items)
                        } catch (e: Exception) {
                            // Ignore errors for individual addons
                        }
                    }
                }
            }
        }
    }

    /**
     * Get available genres for a content type.
     */
    fun getAvailableGenres(type: String): List<String> {
        val catalogAddons = addonRepository.getCatalogAddons()
        return catalogAddons.flatMap { addon ->
            addon.catalogs
                .filter { it.type == type && it.supportsGenre }
                .flatMap { it.genreOptions ?: emptyList() }
        }.distinct().sorted()
    }

    /**
     * Build extra parameters string for catalog requests.
     */
    private fun buildExtraParams(
        page: Int = 1,
        genre: String? = null,
        search: String? = null
    ): String {
        val params = mutableListOf<String>()

        if (search != null) {
            params.add("search=${search}")
        }

        if (genre != null) {
            params.add("genre=${genre}")
        }

        if (page > 1) {
            val skip = (page - 1) * DEFAULT_PAGE_SIZE
            params.add("skip=$skip")
        }

        return params.joinToString("&")
    }

    /**
     * Deduplicate content by ID, preferring items with more metadata.
     */
    private fun deduplicateContent(items: List<StreamingContent>): List<StreamingContent> {
        return items.groupBy { it.id }.map { (_, duplicates) ->
            // Prefer item with most metadata
            duplicates.maxByOrNull { item ->
                var score = 0
                if (item.poster != null) score += 1
                if (item.background != null) score += 1
                if (item.description != null) score += 1
                if (item.imdbRating != null) score += 1
                if (item.year != null) score += 1
                if (item.genres.isNotEmpty()) score += 1
                score
            } ?: duplicates.first()
        }
    }
}
