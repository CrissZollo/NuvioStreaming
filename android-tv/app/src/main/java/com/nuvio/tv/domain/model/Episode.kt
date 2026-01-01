package com.nuvio.tv.domain.model

/**
 * Represents a TV show episode.
 */
data class Episode(
    val id: String,
    val title: String,
    val seasonNumber: Int,
    val episodeNumber: Int,
    val overview: String? = null,
    val thumbnail: String? = null,
    val airDate: String? = null,
    val runtime: Int? = null, // in minutes
    val imdbRating: Float? = null,
    val stremioId: String // Format: tt1234567:1:1 (imdbId:season:episode)
) {
    /**
     * Returns a formatted episode identifier (e.g., "S01E05").
     */
    val episodeCode: String
        get() = String.format("S%02dE%02d", seasonNumber, episodeNumber)

    /**
     * Returns the formatted runtime string.
     */
    val formattedRuntime: String?
        get() = runtime?.let { "${it}m" }
}

/**
 * Represents a TV show season.
 */
data class Season(
    val seasonNumber: Int,
    val name: String? = null,
    val overview: String? = null,
    val posterPath: String? = null,
    val airDate: String? = null,
    val episodeCount: Int = 0,
    val episodes: List<Episode> = emptyList()
) {
    /**
     * Returns the display name for this season.
     */
    val displayName: String
        get() = name ?: "Season $seasonNumber"
}

/**
 * Watch progress for a content item or episode.
 */
data class WatchProgress(
    val contentId: String,
    val type: String,
    val episodeId: String? = null,
    val position: Long, // in milliseconds
    val duration: Long, // in milliseconds
    val updatedAt: Long = System.currentTimeMillis(),
    val title: String? = null,
    val poster: String? = null
) {
    /**
     * Returns the progress as a fraction (0.0 to 1.0).
     */
    val progress: Float
        get() = if (duration > 0) (position.toFloat() / duration.toFloat()).coerceIn(0f, 1f) else 0f

    /**
     * Returns the progress percentage (0-100).
     */
    val progressPercent: Int
        get() = if (duration > 0) ((position * 100) / duration).toInt() else 0

    /**
     * Returns true if the content is considered "watched" (>= 90% progress).
     */
    val isWatched: Boolean
        get() = progressPercent >= 90

    /**
     * Returns true if the content has been started but not finished.
     */
    val isInProgress: Boolean
        get() = progressPercent in 5..89
}
