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
    val cast: List<CastMember> = emptyList(),
    val crew: List<CrewMember> = emptyList(),
    val director: String? = null,
    val writers: List<String> = emptyList(),
    val trailerStreams: List<TrailerStream> = emptyList(),
    // TV Series specific
    val seasons: List<SeasonInfo> = emptyList(),
    val numberOfSeasons: Int? = null,
    val numberOfEpisodes: Int? = null,
    val status: String? = null, // "Returning Series", "Ended", etc.
    val networks: List<String> = emptyList(),
    // Collection (for movie series)
    val collectionId: Int? = null,
    val collectionName: String? = null,
    // Additional metadata
    val tagline: String? = null,
    val voteAverage: Float? = null,
    val voteCount: Int? = null,
    val popularity: Float? = null,
    val originalLanguage: String? = null,
    val productionCompanies: List<String> = emptyList(),
    val productionCountries: List<String> = emptyList(),
    // User state
    val inLibrary: Boolean = false,
    val inWatchlist: Boolean = false,
    val watched: Boolean = false,
    val watchProgress: Float = 0f // 0.0 to 1.0
) {
    /**
     * Check if this is a movie.
     */
    val isMovie: Boolean
        get() = type == "movie"

    /**
     * Check if this is a TV series.
     */
    val isSeries: Boolean
        get() = type == "series"

    /**
     * Get formatted runtime (e.g., "2h 15m" or "45m").
     */
    val formattedRuntime: String?
        get() {
            val minutes = runtime?.replace(Regex("[^0-9]"), "")?.toIntOrNull() ?: return runtime
            return when {
                minutes >= 60 -> {
                    val hours = minutes / 60
                    val mins = minutes % 60
                    if (mins > 0) "${hours}h ${mins}m" else "${hours}h"
                }
                else -> "${minutes}m"
            }
        }

    /**
     * Get Stremio-compatible ID (imdb:tt1234567 or tmdb:12345).
     */
    val stremioId: String
        get() = imdbId ?: id
}

// PosterShape is defined in Addon.kt to avoid duplication

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
data class CastMember(
    val id: Int,
    val name: String,
    val character: String? = null,
    val profilePath: String? = null,
    val order: Int = 0
) {
    val profileUrl: String?
        get() = profilePath?.let { "https://image.tmdb.org/t/p/w185$it" }
}

/**
 * Crew member information.
 */
data class CrewMember(
    val id: Int,
    val name: String,
    val job: String? = null,
    val department: String? = null,
    val profilePath: String? = null
) {
    val profileUrl: String?
        get() = profilePath?.let { "https://image.tmdb.org/t/p/w185$it" }
}

/**
 * Season summary information.
 */
data class SeasonInfo(
    val seasonNumber: Int,
    val name: String? = null,
    val overview: String? = null,
    val posterPath: String? = null,
    val airDate: String? = null,
    val episodeCount: Int = 0
) {
    val displayName: String
        get() = name ?: "Season $seasonNumber"

    val posterUrl: String?
        get() = posterPath?.let { "https://image.tmdb.org/t/p/w342$it" }
}

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
