package com.nuvio.tv.data.remote.api

import com.nuvio.tv.data.remote.dto.TMDBFindResultsDto
import com.nuvio.tv.data.remote.dto.TMDBMovieDto
import com.nuvio.tv.data.remote.dto.TMDBMovieResultsDto
import com.nuvio.tv.data.remote.dto.TMDBMultiSearchResultsDto
import com.nuvio.tv.data.remote.dto.TMDBSeasonDto
import com.nuvio.tv.data.remote.dto.TMDBTVResultsDto
import com.nuvio.tv.data.remote.dto.TMDBTVShowDto
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Retrofit interface for The Movie Database (TMDB) API.
 * Used for enriching content metadata with additional information.
 */
interface TMDBApi {

    companion object {
        const val BASE_URL = "https://api.themoviedb.org/3/"
        const val IMAGE_BASE_URL = "https://image.tmdb.org/t/p/"

        // Image sizes
        const val POSTER_W342 = "w342"
        const val POSTER_W500 = "w500"
        const val POSTER_ORIGINAL = "original"
        const val BACKDROP_W780 = "w780"
        const val BACKDROP_W1280 = "w1280"
        const val BACKDROP_ORIGINAL = "original"
        const val PROFILE_W185 = "w185"
        const val PROFILE_H632 = "h632"

        fun posterUrl(path: String?, size: String = POSTER_W500): String? {
            return path?.let { "$IMAGE_BASE_URL$size$it" }
        }

        fun backdropUrl(path: String?, size: String = BACKDROP_W1280): String? {
            return path?.let { "$IMAGE_BASE_URL$size$it" }
        }

        fun profileUrl(path: String?, size: String = PROFILE_W185): String? {
            return path?.let { "$IMAGE_BASE_URL$size$it" }
        }
    }

    // ==================== Movie Endpoints ====================

    /**
     * Get movie details.
     */
    @GET("movie/{movie_id}")
    suspend fun getMovie(
        @Path("movie_id") movieId: Int,
        @Query("append_to_response") appendToResponse: String = "credits,videos,recommendations,similar,external_ids"
    ): Response<TMDBMovieDto>

    /**
     * Get popular movies.
     */
    @GET("movie/popular")
    suspend fun getPopularMovies(
        @Query("page") page: Int = 1,
        @Query("region") region: String? = null
    ): Response<TMDBMovieResultsDto>

    /**
     * Get top rated movies.
     */
    @GET("movie/top_rated")
    suspend fun getTopRatedMovies(
        @Query("page") page: Int = 1,
        @Query("region") region: String? = null
    ): Response<TMDBMovieResultsDto>

    /**
     * Get now playing movies.
     */
    @GET("movie/now_playing")
    suspend fun getNowPlayingMovies(
        @Query("page") page: Int = 1,
        @Query("region") region: String? = null
    ): Response<TMDBMovieResultsDto>

    /**
     * Get upcoming movies.
     */
    @GET("movie/upcoming")
    suspend fun getUpcomingMovies(
        @Query("page") page: Int = 1,
        @Query("region") region: String? = null
    ): Response<TMDBMovieResultsDto>

    /**
     * Discover movies with filters.
     */
    @GET("discover/movie")
    suspend fun discoverMovies(
        @Query("page") page: Int = 1,
        @Query("sort_by") sortBy: String = "popularity.desc",
        @Query("with_genres") withGenres: String? = null,
        @Query("year") year: Int? = null,
        @Query("primary_release_year") primaryReleaseYear: Int? = null,
        @Query("vote_average.gte") voteAverageGte: Float? = null,
        @Query("with_runtime.gte") withRuntimeGte: Int? = null,
        @Query("with_runtime.lte") withRuntimeLte: Int? = null
    ): Response<TMDBMovieResultsDto>

    // ==================== TV Show Endpoints ====================

    /**
     * Get TV show details.
     */
    @GET("tv/{series_id}")
    suspend fun getTVShow(
        @Path("series_id") seriesId: Int,
        @Query("append_to_response") appendToResponse: String = "credits,videos,recommendations,similar,external_ids"
    ): Response<TMDBTVShowDto>

    /**
     * Get popular TV shows.
     */
    @GET("tv/popular")
    suspend fun getPopularTVShows(
        @Query("page") page: Int = 1
    ): Response<TMDBTVResultsDto>

    /**
     * Get top rated TV shows.
     */
    @GET("tv/top_rated")
    suspend fun getTopRatedTVShows(
        @Query("page") page: Int = 1
    ): Response<TMDBTVResultsDto>

    /**
     * Get TV shows airing today.
     */
    @GET("tv/airing_today")
    suspend fun getAiringTodayTVShows(
        @Query("page") page: Int = 1
    ): Response<TMDBTVResultsDto>

    /**
     * Get TV shows on the air (currently airing).
     */
    @GET("tv/on_the_air")
    suspend fun getOnTheAirTVShows(
        @Query("page") page: Int = 1
    ): Response<TMDBTVResultsDto>

    /**
     * Discover TV shows with filters.
     */
    @GET("discover/tv")
    suspend fun discoverTVShows(
        @Query("page") page: Int = 1,
        @Query("sort_by") sortBy: String = "popularity.desc",
        @Query("with_genres") withGenres: String? = null,
        @Query("first_air_date_year") firstAirDateYear: Int? = null,
        @Query("vote_average.gte") voteAverageGte: Float? = null,
        @Query("with_status") withStatus: String? = null
    ): Response<TMDBTVResultsDto>

    /**
     * Get TV show season details with episodes.
     */
    @GET("tv/{series_id}/season/{season_number}")
    suspend fun getTVSeason(
        @Path("series_id") seriesId: Int,
        @Path("season_number") seasonNumber: Int
    ): Response<TMDBSeasonDto>

    // ==================== Search Endpoints ====================

    /**
     * Search for movies.
     */
    @GET("search/movie")
    suspend fun searchMovies(
        @Query("query") query: String,
        @Query("page") page: Int = 1,
        @Query("include_adult") includeAdult: Boolean = false,
        @Query("year") year: Int? = null,
        @Query("primary_release_year") primaryReleaseYear: Int? = null
    ): Response<TMDBMovieResultsDto>

    /**
     * Search for TV shows.
     */
    @GET("search/tv")
    suspend fun searchTVShows(
        @Query("query") query: String,
        @Query("page") page: Int = 1,
        @Query("include_adult") includeAdult: Boolean = false,
        @Query("first_air_date_year") firstAirDateYear: Int? = null
    ): Response<TMDBTVResultsDto>

    /**
     * Multi-search across movies, TV shows, and people.
     */
    @GET("search/multi")
    suspend fun searchMulti(
        @Query("query") query: String,
        @Query("page") page: Int = 1,
        @Query("include_adult") includeAdult: Boolean = false
    ): Response<TMDBMultiSearchResultsDto>

    // ==================== Find Endpoints ====================

    /**
     * Find content by external ID (IMDB, TVDB, etc.).
     */
    @GET("find/{external_id}")
    suspend fun findByExternalId(
        @Path("external_id") externalId: String,
        @Query("external_source") externalSource: String = "imdb_id"
    ): Response<TMDBFindResultsDto>
}
