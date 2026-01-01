package com.nuvio.tv.domain.model

/**
 * Represents a movie or TV show content item.
 * This is the core domain model used throughout the app.
 */
data class StreamingContent(
    val id: String,
    val type: String, // "movie" or "series"
    val name: String,
    val poster: String? = null,
    val posterShape: PosterShape = PosterShape.POSTER,
    val background: String? = null,
    val logo: String? = null,
    val imdbRating: String? = null,
    val year: Int? = null,
    val genres: List<String> = emptyList(),
    val description: String? = null,
    val runtime: String? = null,
    val certification: String? = null,
    val tmdbId: Int? = null,
    val imdbId: String? = null,
    val addonId: String? = null,
    val releaseInfo: String? = null,
    val links: List<ContentLink> = emptyList(),
    val cast: List<Cast> = emptyList(),
    val director: String? = null,
    val trailerStreams: List<TrailerStream> = emptyList()
)

/**
 * Shape of the poster image.
 */
enum class PosterShape {
    POSTER,    // 2:3 aspect ratio
    SQUARE,    // 1:1 aspect ratio
    LANDSCAPE  // 16:9 aspect ratio
}

/**
 * External link associated with content.
 */
data class ContentLink(
    val name: String,
    val category: String,
    val url: String
)

/**
 * Cast member information.
 */
data class Cast(
    val id: Int,
    val name: String,
    val character: String? = null,
    val profilePath: String? = null
)

/**
 * Trailer stream information.
 */
data class TrailerStream(
    val title: String,
    val ytId: String
)

/**
 * Catalog configuration for browsing content.
 */
data class CatalogConfig(
    val addonId: String,
    val addonName: String,
    val catalogId: String,
    val catalogName: String,
    val type: String // "movie" or "series"
)

/**
 * Catalog content with items and pagination info.
 */
data class CatalogContent(
    val config: CatalogConfig,
    val items: List<StreamingContent>,
    val hasMore: Boolean = false
)
