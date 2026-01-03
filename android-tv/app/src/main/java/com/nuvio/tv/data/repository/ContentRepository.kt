package com.nuvio.tv.data.repository

import com.nuvio.tv.data.remote.api.StremioApi
import com.nuvio.tv.data.remote.api.TMDBApi
import com.nuvio.tv.data.remote.dto.MetaDto
import com.nuvio.tv.data.remote.dto.StreamDto
import com.nuvio.tv.data.remote.dto.SubtitleDto
import com.nuvio.tv.domain.model.Addon
import com.nuvio.tv.domain.model.CastMember
import com.nuvio.tv.domain.model.CrewMember
import com.nuvio.tv.domain.model.Episode
import com.nuvio.tv.domain.model.PersonCredit
import com.nuvio.tv.domain.model.PersonDetails
import com.nuvio.tv.domain.model.PosterShape
import com.nuvio.tv.domain.model.Season
import com.nuvio.tv.domain.model.SeasonInfo
import com.nuvio.tv.domain.model.Stream
import com.nuvio.tv.domain.model.StreamingContent
import com.nuvio.tv.domain.model.Subtitle
import com.nuvio.tv.domain.model.TrailerStream
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository for fetching content metadata and streams.
 */
@Singleton
class ContentRepository @Inject constructor(
    private val stremioApi: StremioApi,
    private val tmdbApi: TMDBApi,
    private val addonRepository: AddonRepository
) {

    /**
     * Get detailed metadata for content.
     * Fetches from Stremio addons and enriches with TMDB data.
     */
    suspend fun getMetadata(
        type: String,
        id: String,
        preferredAddonId: String? = null
    ): StreamingContent? = withContext(Dispatchers.IO) {
        // Get metadata from Stremio addon
        val stremioMeta = fetchStremioMetadata(type, id, preferredAddonId)
            ?: return@withContext null

        // Try to enrich with TMDB data
        val enrichedContent = try {
            enrichWithTMDB(stremioMeta)
        } catch (e: Exception) {
            stremioMeta
        }

        enrichedContent
    }

    /**
     * Fetch metadata from Stremio addons.
     */
    private suspend fun fetchStremioMetadata(
        type: String,
        id: String,
        preferredAddonId: String?
    ): StreamingContent? {
        val metaAddons = addonRepository.getMetaAddons()
        if (metaAddons.isEmpty()) return null

        // Try preferred addon first
        if (preferredAddonId != null) {
            val preferredAddon = metaAddons.find { it.id == preferredAddonId }
            if (preferredAddon != null) {
                val result = tryFetchMeta(preferredAddon, type, id)
                if (result != null) return result
            }
        }

        // Try Cinemeta first (usually best for metadata)
        val cinemeta = metaAddons.find { it.id.contains("cinemeta", ignoreCase = true) }
        if (cinemeta != null) {
            val result = tryFetchMeta(cinemeta, type, id)
            if (result != null) return result
        }

        // Try other addons
        for (addon in metaAddons) {
            if (addon.id == preferredAddonId || addon.id.contains("cinemeta", ignoreCase = true)) continue
            if (!addon.supportsType(type)) continue
            if (!addon.supportsIdPrefix(id)) continue

            val result = tryFetchMeta(addon, type, id)
            if (result != null) return result
        }

        return null
    }

    /**
     * Try to fetch metadata from a specific addon.
     */
    private suspend fun tryFetchMeta(
        addon: Addon,
        type: String,
        id: String
    ): StreamingContent? {
        return try {
            val baseUrl = addon.url.removeSuffix("/")
            val metaUrl = "$baseUrl/meta/$type/$id.json"
            val response = stremioApi.getMeta(metaUrl)
            if (response.isSuccessful) {
                response.body()?.meta?.toStreamingContent(addon.id)
            } else {
                null
            }
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Enrich content with TMDB data.
     */
    private suspend fun enrichWithTMDB(content: StreamingContent): StreamingContent {
        val imdbId = content.imdbId ?: content.id.takeIf { it.startsWith("tt") }
            ?: return content

        // Find TMDB ID from IMDb ID
        val findResponse = tmdbApi.findByExternalId(imdbId)
        if (!findResponse.isSuccessful) return content

        val findResult = findResponse.body() ?: return content

        return when (content.type) {
            "movie" -> {
                val tmdbMovie = findResult.movieResults?.firstOrNull()
                    ?: return content

                // Fetch full movie details
                val detailsResponse = tmdbApi.getMovie(tmdbMovie.id)
                if (!detailsResponse.isSuccessful) return content

                val details = detailsResponse.body() ?: return content

                content.copy(
                    tmdbId = details.id,
                    description = details.overview ?: content.description,
                    poster = details.posterPath?.let { TMDBApi.posterUrl(it) } ?: content.poster,
                    background = details.backdropPath?.let { TMDBApi.backdropUrl(it) } ?: content.background,
                    runtime = details.runtime?.let { "${it}m" } ?: content.runtime,
                    tagline = details.tagline,
                    voteAverage = details.voteAverage,
                    voteCount = details.voteCount,
                    genres = details.genres?.map { it.name } ?: content.genres,
                    productionCompanies = details.productionCompanies?.map { it.name } ?: emptyList(),
                    productionCountries = details.productionCountries?.map { it.name } ?: emptyList(),
                    collectionId = details.recommendations?.results?.firstOrNull()?.id, // Simplified
                    cast = details.credits?.cast?.take(20)?.map { cast ->
                        CastMember(
                            id = cast.id,
                            name = cast.name,
                            character = cast.character,
                            profilePath = cast.profilePath,
                            order = cast.order ?: 0
                        )
                    } ?: emptyList(),
                    crew = details.credits?.crew?.filter {
                        it.job in listOf("Director", "Writer", "Screenplay", "Producer")
                    }?.map { crew ->
                        CrewMember(
                            id = crew.id,
                            name = crew.name,
                            job = crew.job,
                            department = crew.department,
                            profilePath = crew.profilePath
                        )
                    } ?: emptyList(),
                    director = details.credits?.crew?.find { it.job == "Director" }?.name,
                    writers = details.credits?.crew?.filter { it.job in listOf("Writer", "Screenplay") }?.map { it.name } ?: emptyList(),
                    trailerStreams = details.videos?.results?.filter {
                        it.site == "YouTube" && it.type in listOf("Trailer", "Teaser")
                    }?.map { video ->
                        TrailerStream(title = video.name, ytId = video.key)
                    } ?: content.trailerStreams
                )
            }
            "series" -> {
                val tmdbShow = findResult.tvResults?.firstOrNull()
                    ?: return content

                // Fetch full TV details
                val detailsResponse = tmdbApi.getTVShow(tmdbShow.id)
                if (!detailsResponse.isSuccessful) return content

                val details = detailsResponse.body() ?: return content

                content.copy(
                    tmdbId = details.id,
                    description = details.overview ?: content.description,
                    poster = details.posterPath?.let { TMDBApi.posterUrl(it) } ?: content.poster,
                    background = details.backdropPath?.let { TMDBApi.backdropUrl(it) } ?: content.background,
                    runtime = details.episodeRunTime?.firstOrNull()?.let { "${it}m" } ?: content.runtime,
                    tagline = details.tagline,
                    voteAverage = details.voteAverage,
                    voteCount = details.voteCount,
                    genres = details.genres?.map { it.name } ?: content.genres,
                    numberOfSeasons = details.numberOfSeasons,
                    numberOfEpisodes = details.numberOfEpisodes,
                    status = details.status,
                    networks = details.networks?.map { it.name } ?: emptyList(),
                    seasons = details.seasons?.map { season ->
                        SeasonInfo(
                            seasonNumber = season.seasonNumber,
                            name = season.name,
                            overview = season.overview,
                            posterPath = season.posterPath,
                            airDate = season.airDate,
                            episodeCount = season.episodeCount ?: 0
                        )
                    } ?: emptyList(),
                    cast = details.credits?.cast?.take(20)?.map { cast ->
                        CastMember(
                            id = cast.id,
                            name = cast.name,
                            character = cast.character,
                            profilePath = cast.profilePath,
                            order = cast.order ?: 0
                        )
                    } ?: emptyList(),
                    crew = details.credits?.crew?.filter {
                        it.job in listOf("Director", "Writer", "Creator", "Executive Producer")
                    }?.map { crew ->
                        CrewMember(
                            id = crew.id,
                            name = crew.name,
                            job = crew.job,
                            department = crew.department,
                            profilePath = crew.profilePath
                        )
                    } ?: emptyList(),
                    trailerStreams = details.videos?.results?.filter {
                        it.site == "YouTube" && it.type in listOf("Trailer", "Teaser")
                    }?.map { video ->
                        TrailerStream(title = video.name, ytId = video.key)
                    } ?: content.trailerStreams
                )
            }
            else -> content
        }
    }

    /**
     * Get episodes for a TV series season.
     */
    suspend fun getSeasonEpisodes(
        tmdbId: Int,
        seasonNumber: Int,
        imdbId: String?
    ): List<Episode> = withContext(Dispatchers.IO) {
        val response = tmdbApi.getTVSeason(tmdbId, seasonNumber)
        if (!response.isSuccessful) return@withContext emptyList()

        val season = response.body() ?: return@withContext emptyList()

        season.episodes?.map { episode ->
            Episode(
                id = "${tmdbId}:${seasonNumber}:${episode.episodeNumber}",
                title = episode.name,
                seasonNumber = seasonNumber,
                episodeNumber = episode.episodeNumber,
                overview = episode.overview,
                thumbnail = episode.stillPath?.let { "https://image.tmdb.org/t/p/w300$it" },
                airDate = episode.airDate,
                runtime = episode.runtime,
                imdbRating = episode.voteAverage,
                stremioId = imdbId?.let { "$it:$seasonNumber:${episode.episodeNumber}" }
                    ?: "${tmdbId}:$seasonNumber:${episode.episodeNumber}"
            )
        } ?: emptyList()
    }

    /**
     * Get streams for content.
     * Returns a Flow that emits streams as they arrive from each addon.
     */
    fun getStreams(
        type: String,
        id: String
    ): Flow<Pair<String, List<Stream>>> = flow {
        val streamAddons = addonRepository.getStreamAddons()

        for (addon in streamAddons) {
            if (!addon.supportsType(type)) continue
            if (!addon.supportsIdPrefix(id)) continue

            try {
                val baseUrl = addon.url.removeSuffix("/")
                val streamUrl = "$baseUrl/stream/$type/$id.json"
                val response = stremioApi.getStreams(streamUrl)
                if (response.isSuccessful) {
                    val streams = response.body()?.streams?.map { streamDto ->
                        streamDto.toStream(addon.id, addon.name)
                    } ?: emptyList()

                    if (streams.isNotEmpty()) {
                        emit(addon.name to streams)
                    }
                }
            } catch (e: Exception) {
                // Continue to next addon
            }
        }
    }

    /**
     * Get streams for content (suspended, returns all at once).
     */
    suspend fun getStreamsAll(
        type: String,
        id: String
    ): List<Stream> = withContext(Dispatchers.IO) {
        val streamAddons = addonRepository.getStreamAddons()

        coroutineScope {
            streamAddons.filter { addon ->
                addon.supportsType(type) && addon.supportsIdPrefix(id)
            }.map { addon ->
                async {
                    try {
                        val baseUrl = addon.url.removeSuffix("/")
                        val streamUrl = "$baseUrl/stream/$type/$id.json"
                        val response = stremioApi.getStreams(streamUrl)
                        if (response.isSuccessful) {
                            response.body()?.streams?.map { it.toStream(addon.id, addon.name) }
                        } else null
                    } catch (e: Exception) {
                        null
                    }
                }
            }.awaitAll().filterNotNull().flatten()
        }
    }

    /**
     * Get subtitles for content.
     */
    suspend fun getSubtitles(
        type: String,
        id: String
    ): List<Subtitle> = withContext(Dispatchers.IO) {
        val subtitleAddons = addonRepository.getSubtitleAddons()

        coroutineScope {
            subtitleAddons.filter { addon ->
                addon.supportsType(type)
            }.map { addon ->
                async {
                    try {
                        val baseUrl = addon.url.removeSuffix("/")
                        val subtitleUrl = "$baseUrl/subtitles/$type/$id.json"
                        val response = stremioApi.getSubtitles(subtitleUrl)
                        if (response.isSuccessful) {
                            response.body()?.subtitles?.map { it.toSubtitle(addon.id, addon.name) }
                        } else null
                    } catch (e: Exception) {
                        null
                    }
                }
            }.awaitAll().filterNotNull().flatten()
        }
    }

    /**
     * Get person (actor/director) details with filmography.
     */
    suspend fun getPersonDetails(personId: Int): PersonDetails? = withContext(Dispatchers.IO) {
        try {
            val response = tmdbApi.getPerson(personId)
            if (!response.isSuccessful) return@withContext null

            val person = response.body() ?: return@withContext null

            // Get cast credits sorted by popularity
            val filmography = person.combinedCredits?.cast?.mapNotNull { credit ->
                val title = credit.title ?: credit.name ?: return@mapNotNull null
                PersonCredit(
                    id = credit.id,
                    mediaType = if (credit.mediaType == "tv") "series" else "movie",
                    title = title,
                    character = credit.character,
                    posterPath = credit.posterPath,
                    releaseDate = credit.releaseDate ?: credit.firstAirDate,
                    voteAverage = credit.voteAverage,
                    popularity = credit.popularity
                )
            }?.sortedByDescending { it.popularity ?: 0f } ?: emptyList()

            PersonDetails(
                id = person.id,
                name = person.name,
                biography = person.biography,
                birthday = person.birthday,
                deathday = person.deathday,
                placeOfBirth = person.placeOfBirth,
                profilePath = person.profilePath,
                knownForDepartment = person.knownForDepartment,
                filmography = filmography
            )
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Get recommendations for content.
     */
    suspend fun getRecommendations(
        type: String,
        tmdbId: Int
    ): List<StreamingContent> = withContext(Dispatchers.IO) {
        val response = when (type) {
            "movie" -> tmdbApi.getMovie(tmdbId)
            "series" -> tmdbApi.getTVShow(tmdbId)
            else -> return@withContext emptyList()
        }

        if (!response.isSuccessful) return@withContext emptyList()

        when (type) {
            "movie" -> {
                val movie = response.body() as? com.nuvio.tv.data.remote.dto.TMDBMovieDto
                movie?.recommendations?.results?.map { rec ->
                    StreamingContent(
                        id = "tmdb:${rec.id}",
                        type = "movie",
                        name = rec.title,
                        poster = rec.posterPath?.let { TMDBApi.posterUrl(it) },
                        background = rec.backdropPath?.let { TMDBApi.backdropUrl(it) },
                        description = rec.overview,
                        voteAverage = rec.voteAverage,
                        year = rec.releaseDate?.take(4)?.toIntOrNull(),
                        tmdbId = rec.id
                    )
                } ?: emptyList()
            }
            "series" -> {
                val show = response.body() as? com.nuvio.tv.data.remote.dto.TMDBTVShowDto
                show?.recommendations?.results?.map { rec ->
                    StreamingContent(
                        id = "tmdb:${rec.id}",
                        type = "series",
                        name = rec.name,
                        poster = rec.posterPath?.let { TMDBApi.posterUrl(it) },
                        background = rec.backdropPath?.let { TMDBApi.backdropUrl(it) },
                        description = rec.overview,
                        voteAverage = rec.voteAverage,
                        year = rec.firstAirDate?.take(4)?.toIntOrNull(),
                        tmdbId = rec.id
                    )
                } ?: emptyList()
            }
            else -> emptyList()
        }
    }

    // Extension functions for DTO conversion

    private fun MetaDto.toStreamingContent(addonId: String): StreamingContent {
        return StreamingContent(
            id = id,
            type = type,
            name = name,
            poster = poster,
            posterShape = when (posterShape) {
                "landscape" -> PosterShape.LANDSCAPE
                "square" -> PosterShape.SQUARE
                else -> PosterShape.POSTER
            },
            background = background,
            logo = logo,
            description = description,
            imdbRating = imdbRating,
            year = year,
            genres = genres ?: emptyList(),
            releaseInfo = releaseInfo,
            runtime = runtime,
            imdbId = imdbId ?: if (id.startsWith("tt")) id else null,
            addonId = addonId,
            trailerStreams = trailerStreams?.map { trailer ->
                TrailerStream(title = trailer.title, ytId = trailer.ytId)
            } ?: emptyList()
        )
    }

    private fun StreamDto.toStream(addonId: String, addonName: String): Stream {
        // Determine if this is a debrid stream based on addon name or cached status
        val isDebridStream = addonName.contains("torbox", ignoreCase = true) ||
            addonName.contains("debrid", ignoreCase = true) ||
            addonName.contains("real-debrid", ignoreCase = true) ||
            addonName.contains("premiumize", ignoreCase = true) ||
            addonName.contains("alldebrid", ignoreCase = true) ||
            behaviorHints?.cached == true

        // Get size from behaviorHints.videoSize if main size is null
        val streamSize = size ?: behaviorHints?.videoSize

        // Use the actual description field - it often contains detailed metadata
        // like codec, HDR, language info (especially from TorBox/debrid addons)
        // Fallback to filename from behaviorHints if description is empty
        val streamDescription = description ?: behaviorHints?.filename

        return Stream(
            url = url,
            title = title ?: name,
            name = name,
            description = streamDescription,
            quality = parseQuality(name ?: title ?: description),
            size = streamSize,
            addonId = addonId,
            addonName = addonName,
            infoHash = infoHash,
            fileIdx = fileIdx,
            isDebrid = isDebridStream,
            isCached = behaviorHints?.cached ?: false,
            subtitles = subtitles?.map { it.toSubtitle(addonId, addonName) } ?: emptyList(),
            headers = behaviorHints?.proxyHeaders?.request ?: emptyMap()
        )
    }

    private fun SubtitleDto.toSubtitle(addonId: String, addonName: String): Subtitle {
        return Subtitle(
            id = id ?: url,
            url = url,
            lang = lang,
            format = format
        )
    }

    private fun parseQuality(text: String?): String? {
        if (text == null) return null
        return when {
            text.contains("4K", ignoreCase = true) || text.contains("2160p", ignoreCase = true) -> "4K"
            text.contains("1080p", ignoreCase = true) -> "1080p"
            text.contains("720p", ignoreCase = true) -> "720p"
            text.contains("480p", ignoreCase = true) -> "480p"
            text.contains("360p", ignoreCase = true) -> "360p"
            else -> null
        }
    }
}
