package com.nuvio.tv.data.remote.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Stremio addon manifest response.
 */
@Serializable
data class ManifestDto(
    val id: String,
    val name: String,
    val version: String,
    val description: String? = null,
    val url: String? = null,
    val catalogs: List<CatalogDto>? = null,
    val resources: List<ResourceDto>? = null,
    val types: List<String>? = null,
    val idPrefixes: List<String>? = null,
    val background: String? = null,
    val logo: String? = null,
    val behaviorHints: BehaviorHintsDto? = null
)

@Serializable
data class CatalogDto(
    val type: String,
    val id: String,
    val name: String,
    val extraSupported: List<String>? = null,
    val extraRequired: List<String>? = null,
    val extra: List<CatalogExtraDto>? = null
)

@Serializable
data class CatalogExtraDto(
    val name: String,
    val isRequired: Boolean? = null,
    val options: List<String>? = null,
    val optionsLimit: Int? = null
)

@Serializable
data class ResourceDto(
    val name: String,
    val types: List<String>,
    val idPrefixes: List<String>? = null
)

@Serializable
data class BehaviorHintsDto(
    val configurable: Boolean? = null,
    val configurationRequired: Boolean? = null,
    val adult: Boolean? = null,
    val p2p: Boolean? = null
)

/**
 * Stremio catalog response.
 */
@Serializable
data class CatalogResponseDto(
    val metas: List<MetaDto>? = null
)

/**
 * Stremio meta (content item) DTO.
 */
@Serializable
data class MetaDto(
    val id: String,
    val type: String,
    val name: String,
    val poster: String? = null,
    val posterShape: String? = null,
    val background: String? = null,
    val logo: String? = null,
    val description: String? = null,
    val releaseInfo: String? = null,
    val imdbRating: String? = null,
    val year: Int? = null,
    val genres: List<String>? = null,
    val runtime: String? = null,
    val cast: List<String>? = null,
    val director: List<String>? = null,
    val writer: List<String>? = null,
    @SerialName("imdb_id")
    val imdbId: String? = null,
    val released: String? = null,
    val videos: List<VideoDto>? = null,
    val links: List<MetaLinkDto>? = null,
    val trailerStreams: List<TrailerStreamDto>? = null
)

@Serializable
data class VideoDto(
    val id: String,
    val title: String,
    val released: String? = null,
    val season: Int? = null,
    val episode: Int? = null,
    val thumbnail: String? = null,
    val overview: String? = null,
    val available: Boolean? = null
)

@Serializable
data class MetaLinkDto(
    val name: String,
    val category: String,
    val url: String
)

@Serializable
data class TrailerStreamDto(
    val title: String,
    val ytId: String
)

/**
 * Stremio meta details response.
 */
@Serializable
data class MetaResponseDto(
    val meta: MetaDto? = null
)

/**
 * Stremio streams response.
 */
@Serializable
data class StreamsResponseDto(
    val streams: List<StreamDto>? = null
)

/**
 * Stremio stream DTO.
 */
@Serializable
data class StreamDto(
    val url: String? = null,
    val ytId: String? = null,
    val infoHash: String? = null,
    val externalUrl: String? = null,
    val fileIdx: Int? = null,
    val name: String? = null,
    val title: String? = null,
    val description: String? = null,
    val size: Long? = null,
    val isFree: Boolean? = null,
    val subtitles: List<SubtitleDto>? = null,
    val sources: List<String>? = null,
    val behaviorHints: StreamBehaviorHintsDto? = null
)

@Serializable
data class StreamBehaviorHintsDto(
    val bingeGroup: String? = null,
    val notWebReady: Boolean? = null,
    val countryWhitelist: List<String>? = null,
    val cached: Boolean? = null,
    val proxyHeaders: ProxyHeadersDto? = null,
    val videoHash: String? = null,
    val videoSize: Long? = null,
    val filename: String? = null
)

@Serializable
data class ProxyHeadersDto(
    val request: Map<String, String>? = null,
    val response: Map<String, String>? = null
)

/**
 * Stremio subtitles response.
 */
@Serializable
data class SubtitlesResponseDto(
    val subtitles: List<SubtitleDto>? = null
)

/**
 * Stremio subtitle DTO.
 */
@Serializable
data class SubtitleDto(
    val id: String,
    val url: String,
    val lang: String,
    val fps: Float? = null,
    val format: String? = null
)
