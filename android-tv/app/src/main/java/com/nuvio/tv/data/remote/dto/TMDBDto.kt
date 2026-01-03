package com.nuvio.tv.data.remote.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * TMDB movie details response.
 */
@Serializable
data class TMDBMovieDto(
    val id: Int,
    val title: String,
    val overview: String? = null,
    @SerialName("poster_path")
    val posterPath: String? = null,
    @SerialName("backdrop_path")
    val backdropPath: String? = null,
    @SerialName("release_date")
    val releaseDate: String? = null,
    val runtime: Int? = null,
    @SerialName("vote_average")
    val voteAverage: Float? = null,
    @SerialName("vote_count")
    val voteCount: Int? = null,
    val genres: List<TMDBGenreDto>? = null,
    @SerialName("imdb_id")
    val imdbId: String? = null,
    val tagline: String? = null,
    val status: String? = null,
    val budget: Long? = null,
    val revenue: Long? = null,
    @SerialName("production_companies")
    val productionCompanies: List<TMDBProductionCompanyDto>? = null,
    @SerialName("production_countries")
    val productionCountries: List<TMDBProductionCountryDto>? = null,
    @SerialName("spoken_languages")
    val spokenLanguages: List<TMDBSpokenLanguageDto>? = null,
    val credits: TMDBCreditsDto? = null,
    val videos: TMDBVideosResponseDto? = null,
    val recommendations: TMDBMovieResultsDto? = null,
    val similar: TMDBMovieResultsDto? = null,
    @SerialName("external_ids")
    val externalIds: TMDBExternalIdsDto? = null
)

/**
 * TMDB TV show details response.
 */
@Serializable
data class TMDBTVShowDto(
    val id: Int,
    val name: String,
    val overview: String? = null,
    @SerialName("poster_path")
    val posterPath: String? = null,
    @SerialName("backdrop_path")
    val backdropPath: String? = null,
    @SerialName("first_air_date")
    val firstAirDate: String? = null,
    @SerialName("last_air_date")
    val lastAirDate: String? = null,
    @SerialName("episode_run_time")
    val episodeRunTime: List<Int>? = null,
    @SerialName("vote_average")
    val voteAverage: Float? = null,
    @SerialName("vote_count")
    val voteCount: Int? = null,
    val genres: List<TMDBGenreDto>? = null,
    val tagline: String? = null,
    val status: String? = null,
    val type: String? = null,
    @SerialName("number_of_episodes")
    val numberOfEpisodes: Int? = null,
    @SerialName("number_of_seasons")
    val numberOfSeasons: Int? = null,
    val seasons: List<TMDBSeasonSummaryDto>? = null,
    @SerialName("created_by")
    val createdBy: List<TMDBCreatorDto>? = null,
    val networks: List<TMDBNetworkDto>? = null,
    @SerialName("production_companies")
    val productionCompanies: List<TMDBProductionCompanyDto>? = null,
    val credits: TMDBCreditsDto? = null,
    val videos: TMDBVideosResponseDto? = null,
    val recommendations: TMDBTVResultsDto? = null,
    val similar: TMDBTVResultsDto? = null,
    @SerialName("external_ids")
    val externalIds: TMDBExternalIdsDto? = null
)

@Serializable
data class TMDBGenreDto(
    val id: Int,
    val name: String
)

@Serializable
data class TMDBProductionCompanyDto(
    val id: Int,
    val name: String,
    @SerialName("logo_path")
    val logoPath: String? = null,
    @SerialName("origin_country")
    val originCountry: String? = null
)

@Serializable
data class TMDBProductionCountryDto(
    @SerialName("iso_3166_1")
    val iso31661: String,
    val name: String
)

@Serializable
data class TMDBSpokenLanguageDto(
    @SerialName("english_name")
    val englishName: String? = null,
    @SerialName("iso_639_1")
    val iso6391: String,
    val name: String
)

@Serializable
data class TMDBCreditsDto(
    val cast: List<TMDBCastMemberDto>? = null,
    val crew: List<TMDBCrewMemberDto>? = null
)

@Serializable
data class TMDBCastMemberDto(
    val id: Int,
    val name: String,
    val character: String? = null,
    @SerialName("profile_path")
    val profilePath: String? = null,
    val order: Int? = null,
    @SerialName("known_for_department")
    val knownForDepartment: String? = null
)

@Serializable
data class TMDBCrewMemberDto(
    val id: Int,
    val name: String,
    val job: String? = null,
    val department: String? = null,
    @SerialName("profile_path")
    val profilePath: String? = null
)

@Serializable
data class TMDBVideosResponseDto(
    val results: List<TMDBVideoDto>? = null
)

@Serializable
data class TMDBVideoDto(
    val id: String,
    val key: String,
    val name: String,
    val site: String,
    val type: String,
    val official: Boolean? = null,
    @SerialName("published_at")
    val publishedAt: String? = null
)

@Serializable
data class TMDBSeasonSummaryDto(
    val id: Int,
    val name: String,
    val overview: String? = null,
    @SerialName("poster_path")
    val posterPath: String? = null,
    @SerialName("season_number")
    val seasonNumber: Int,
    @SerialName("episode_count")
    val episodeCount: Int? = null,
    @SerialName("air_date")
    val airDate: String? = null
)

/**
 * TMDB season details response.
 */
@Serializable
data class TMDBSeasonDto(
    val id: Int,
    val name: String,
    val overview: String? = null,
    @SerialName("poster_path")
    val posterPath: String? = null,
    @SerialName("season_number")
    val seasonNumber: Int,
    @SerialName("air_date")
    val airDate: String? = null,
    val episodes: List<TMDBEpisodeDto>? = null
)

/**
 * TMDB episode details.
 */
@Serializable
data class TMDBEpisodeDto(
    val id: Int,
    val name: String,
    val overview: String? = null,
    @SerialName("still_path")
    val stillPath: String? = null,
    @SerialName("episode_number")
    val episodeNumber: Int,
    @SerialName("season_number")
    val seasonNumber: Int,
    @SerialName("air_date")
    val airDate: String? = null,
    @SerialName("vote_average")
    val voteAverage: Float? = null,
    @SerialName("vote_count")
    val voteCount: Int? = null,
    val runtime: Int? = null,
    val crew: List<TMDBCrewMemberDto>? = null,
    @SerialName("guest_stars")
    val guestStars: List<TMDBCastMemberDto>? = null
)

@Serializable
data class TMDBCreatorDto(
    val id: Int,
    val name: String,
    @SerialName("profile_path")
    val profilePath: String? = null
)

@Serializable
data class TMDBNetworkDto(
    val id: Int,
    val name: String,
    @SerialName("logo_path")
    val logoPath: String? = null,
    @SerialName("origin_country")
    val originCountry: String? = null
)

@Serializable
data class TMDBExternalIdsDto(
    @SerialName("imdb_id")
    val imdbId: String? = null,
    @SerialName("tvdb_id")
    val tvdbId: Int? = null,
    @SerialName("facebook_id")
    val facebookId: String? = null,
    @SerialName("instagram_id")
    val instagramId: String? = null,
    @SerialName("twitter_id")
    val twitterId: String? = null
)

/**
 * TMDB search/discover results.
 */
@Serializable
data class TMDBMovieResultsDto(
    val page: Int? = null,
    val results: List<TMDBMovieSummaryDto>? = null,
    @SerialName("total_pages")
    val totalPages: Int? = null,
    @SerialName("total_results")
    val totalResults: Int? = null
)

@Serializable
data class TMDBTVResultsDto(
    val page: Int? = null,
    val results: List<TMDBTVSummaryDto>? = null,
    @SerialName("total_pages")
    val totalPages: Int? = null,
    @SerialName("total_results")
    val totalResults: Int? = null
)

@Serializable
data class TMDBMovieSummaryDto(
    val id: Int,
    val title: String,
    val overview: String? = null,
    @SerialName("poster_path")
    val posterPath: String? = null,
    @SerialName("backdrop_path")
    val backdropPath: String? = null,
    @SerialName("release_date")
    val releaseDate: String? = null,
    @SerialName("vote_average")
    val voteAverage: Float? = null,
    @SerialName("genre_ids")
    val genreIds: List<Int>? = null
)

@Serializable
data class TMDBTVSummaryDto(
    val id: Int,
    val name: String,
    val overview: String? = null,
    @SerialName("poster_path")
    val posterPath: String? = null,
    @SerialName("backdrop_path")
    val backdropPath: String? = null,
    @SerialName("first_air_date")
    val firstAirDate: String? = null,
    @SerialName("vote_average")
    val voteAverage: Float? = null,
    @SerialName("genre_ids")
    val genreIds: List<Int>? = null
)

/**
 * TMDB multi-search result (can contain movies, TV shows, or people).
 */
@Serializable
data class TMDBMultiSearchResultsDto(
    val page: Int? = null,
    val results: List<TMDBMultiSearchItemDto>? = null,
    @SerialName("total_pages")
    val totalPages: Int? = null,
    @SerialName("total_results")
    val totalResults: Int? = null
)

@Serializable
data class TMDBMultiSearchItemDto(
    val id: Int,
    @SerialName("media_type")
    val mediaType: String,
    // Movie fields
    val title: String? = null,
    @SerialName("release_date")
    val releaseDate: String? = null,
    // TV fields
    val name: String? = null,
    @SerialName("first_air_date")
    val firstAirDate: String? = null,
    // Common fields
    val overview: String? = null,
    @SerialName("poster_path")
    val posterPath: String? = null,
    @SerialName("backdrop_path")
    val backdropPath: String? = null,
    @SerialName("vote_average")
    val voteAverage: Float? = null,
    @SerialName("genre_ids")
    val genreIds: List<Int>? = null,
    // Person fields
    @SerialName("profile_path")
    val profilePath: String? = null,
    @SerialName("known_for_department")
    val knownForDepartment: String? = null
)

/**
 * TMDB find by external ID response.
 */
@Serializable
data class TMDBFindResultsDto(
    @SerialName("movie_results")
    val movieResults: List<TMDBMovieSummaryDto>? = null,
    @SerialName("tv_results")
    val tvResults: List<TMDBTVSummaryDto>? = null,
    @SerialName("tv_episode_results")
    val tvEpisodeResults: List<TMDBEpisodeDto>? = null
)

/**
 * TMDB person details response.
 */
@Serializable
data class TMDBPersonDto(
    val id: Int,
    val name: String,
    val biography: String? = null,
    val birthday: String? = null,
    val deathday: String? = null,
    @SerialName("place_of_birth")
    val placeOfBirth: String? = null,
    @SerialName("profile_path")
    val profilePath: String? = null,
    @SerialName("known_for_department")
    val knownForDepartment: String? = null,
    val popularity: Float? = null,
    val gender: Int? = null,
    @SerialName("also_known_as")
    val alsoKnownAs: List<String>? = null,
    val homepage: String? = null,
    @SerialName("imdb_id")
    val imdbId: String? = null,
    @SerialName("combined_credits")
    val combinedCredits: TMDBPersonCombinedCreditsDto? = null
)

/**
 * TMDB person combined credits (movies and TV shows).
 */
@Serializable
data class TMDBPersonCombinedCreditsDto(
    val cast: List<TMDBPersonCreditDto>? = null,
    val crew: List<TMDBPersonCreditDto>? = null
)

/**
 * TMDB person credit item (movie or TV show they appeared in).
 */
@Serializable
data class TMDBPersonCreditDto(
    val id: Int,
    @SerialName("media_type")
    val mediaType: String,
    // Movie fields
    val title: String? = null,
    @SerialName("release_date")
    val releaseDate: String? = null,
    // TV fields
    val name: String? = null,
    @SerialName("first_air_date")
    val firstAirDate: String? = null,
    // Common fields
    val character: String? = null,
    @SerialName("poster_path")
    val posterPath: String? = null,
    @SerialName("backdrop_path")
    val backdropPath: String? = null,
    @SerialName("vote_average")
    val voteAverage: Float? = null,
    val popularity: Float? = null,
    @SerialName("episode_count")
    val episodeCount: Int? = null,
    // Crew fields
    val job: String? = null,
    val department: String? = null
)
