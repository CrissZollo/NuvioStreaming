package com.nuvio.tv.domain.model

/**
 * Represents a Stremio addon manifest.
 */
data class Addon(
    val id: String,
    val name: String,
    val version: String,
    val description: String? = null,
    val url: String, // Base URL of the addon
    val manifestUrl: String, // Full manifest URL
    val catalogs: List<Catalog> = emptyList(),
    val resources: List<AddonResource> = emptyList(),
    val types: List<String> = emptyList(),
    val idPrefixes: List<String> = emptyList(),
    val background: String? = null,
    val logo: String? = null,
    val behaviorHints: AddonBehaviorHints? = null
) {
    /**
     * Check if this addon provides a specific resource type.
     */
    fun providesResource(resourceName: String): Boolean {
        return resources.any { it.name == resourceName }
    }

    /**
     * Check if this addon supports a specific content type.
     */
    fun supportsType(type: String): Boolean {
        return types.contains(type) || resources.any { it.types?.contains(type) == true }
    }

    /**
     * Check if this addon supports a specific ID prefix.
     */
    fun supportsIdPrefix(id: String): Boolean {
        if (idPrefixes.isEmpty()) return true
        return idPrefixes.any { prefix -> id.startsWith(prefix, ignoreCase = true) }
    }

    /**
     * Get catalogs for a specific content type.
     */
    fun getCatalogsForType(type: String): List<Catalog> {
        return catalogs.filter { it.type == type }
    }

    /**
     * Check if this addon provides streams.
     */
    val providesStreams: Boolean
        get() = providesResource("stream")

    /**
     * Check if this addon provides metadata.
     */
    val providesMeta: Boolean
        get() = providesResource("meta")

    /**
     * Check if this addon provides subtitles.
     */
    val providesSubtitles: Boolean
        get() = providesResource("subtitles")

    /**
     * Check if this addon provides catalogs.
     */
    val providesCatalogs: Boolean
        get() = providesResource("catalog") && catalogs.isNotEmpty()

    /**
     * Check if this addon supports search.
     */
    val supportsSearch: Boolean
        get() = catalogs.any { catalog ->
            catalog.extraSupported?.contains("search") == true ||
            catalog.extra?.any { it.name == "search" } == true
        }
}

/**
 * Represents an addon resource (catalog, meta, stream, subtitles).
 */
data class AddonResource(
    val name: String, // "catalog", "meta", "stream", "subtitles"
    val types: List<String>? = null,
    val idPrefixes: List<String> = emptyList()
)

/**
 * Behavior hints for addon configuration.
 */
data class AddonBehaviorHints(
    val configurable: Boolean = false,
    val configurationRequired: Boolean = false,
    val adult: Boolean = false,
    val p2p: Boolean = false
)

/**
 * Represents a catalog definition from an addon.
 */
data class Catalog(
    val type: String, // "movie", "series", "channel", etc.
    val id: String,
    val name: String,
    val extraSupported: List<String>? = null, // ["search", "genre", "skip"]
    val extraRequired: List<String>? = null,
    val extra: List<CatalogExtra>? = null
) {
    /**
     * Check if this catalog supports search.
     */
    val supportsSearch: Boolean
        get() = extraSupported?.contains("search") == true ||
                extra?.any { it.name == "search" } == true

    /**
     * Check if this catalog supports genre filtering.
     */
    val supportsGenre: Boolean
        get() = extraSupported?.contains("genre") == true ||
                extra?.any { it.name == "genre" } == true

    /**
     * Check if this catalog supports pagination.
     */
    val supportsPagination: Boolean
        get() = extraSupported?.contains("skip") == true ||
                extra?.any { it.name == "skip" } == true

    /**
     * Get available genre options if supported.
     */
    val genreOptions: List<String>?
        get() = extra?.find { it.name == "genre" }?.options
}

/**
 * Extra parameter definition for catalog filtering.
 */
data class CatalogExtra(
    val name: String, // "genre", "search", "skip"
    val isRequired: Boolean = false,
    val options: List<String>? = null,
    val optionsLimit: Int? = null
)

/**
 * Represents a catalog item (content from a catalog).
 */
data class CatalogItem(
    val id: String,
    val type: String,
    val name: String,
    val poster: String? = null,
    val posterShape: PosterShape = PosterShape.POSTER,
    val background: String? = null,
    val logo: String? = null,
    val description: String? = null,
    val imdbRating: String? = null,
    val year: Int? = null,
    val genres: List<String> = emptyList()
) {
    /**
     * Convert to StreamingContent for display.
     */
    fun toStreamingContent(): StreamingContent {
        return StreamingContent(
            id = id,
            type = type,
            name = name,
            poster = poster,
            background = background,
            logo = logo,
            description = description,
            imdbRating = imdbRating,
            year = year,
            genres = genres
        )
    }
}

/**
 * Poster shape variants.
 */
enum class PosterShape {
    POSTER,    // 2:3 aspect ratio (default)
    LANDSCAPE, // 16:9 aspect ratio
    SQUARE     // 1:1 aspect ratio
}
