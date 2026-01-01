package com.nuvio.tv.data.remote.dto

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.descriptors.buildClassSerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonPrimitive

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
    @Serializable(with = ResourceListSerializer::class)
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

/**
 * Resource can be either a string ("catalog") or an object with name, types, idPrefixes.
 */
@Serializable
data class ResourceDto(
    val name: String,
    val types: List<String>? = null,
    val idPrefixes: List<String>? = null
)

/**
 * Custom serializer to handle resources as either strings or objects.
 * Stremio manifests can have resources like ["catalog", "meta"] or [{name: "stream", types: ["movie"]}]
 */
@OptIn(ExperimentalSerializationApi::class)
object ResourceListSerializer : KSerializer<List<ResourceDto>?> {
    override val descriptor: SerialDescriptor = buildClassSerialDescriptor("ResourceList")

    override fun serialize(encoder: Encoder, value: List<ResourceDto>?) {
        if (value == null) {
            encoder.encodeNull()
        } else {
            encoder.encodeSerializableValue(ListSerializer(ResourceDto.serializer()), value)
        }
    }

    override fun deserialize(decoder: Decoder): List<ResourceDto>? {
        val jsonDecoder = decoder as? JsonDecoder
            ?: return decoder.decodeSerializableValue(ListSerializer(ResourceDto.serializer()))

        val element = jsonDecoder.decodeJsonElement()
        if (element !is JsonArray) return null

        return element.map { item ->
            when (item) {
                is JsonPrimitive -> {
                    // Simple string like "catalog"
                    ResourceDto(name = item.content)
                }
                is JsonObject -> {
                    // Full object like {name: "stream", types: ["movie"]}
                    val name = item["name"]?.jsonPrimitive?.content ?: "unknown"
                    val types = item["types"]?.jsonArray?.map { it.jsonPrimitive.content }
                    val idPrefixes = item["idPrefixes"]?.jsonArray?.map { it.jsonPrimitive.content }
                    ResourceDto(name = name, types = types, idPrefixes = idPrefixes)
                }
                else -> ResourceDto(name = "unknown")
            }
        }
    }
}

@Serializable
data class BehaviorHintsDto(
    val configurable: Boolean? = null,
    val configurationRequired: Boolean? = null,
    val adult: Boolean? = null,
    val p2p: Boolean? = null
)

/**
 * Custom serializer to handle year field that can be:
 * - An integer: 2016
 * - A string: "2016"
 * - A year range: "2016–2025" or "2016-2025"
 * Extracts the start year as Int.
 */
@OptIn(ExperimentalSerializationApi::class)
object YearSerializer : KSerializer<Int?> {
    override val descriptor: SerialDescriptor = buildClassSerialDescriptor("Year")

    override fun serialize(encoder: Encoder, value: Int?) {
        if (value == null) {
            encoder.encodeNull()
        } else {
            encoder.encodeInt(value)
        }
    }

    override fun deserialize(decoder: Decoder): Int? {
        val jsonDecoder = decoder as? JsonDecoder
            ?: return try { decoder.decodeInt() } catch (e: Exception) { null }

        val element = jsonDecoder.decodeJsonElement()
        if (element !is JsonPrimitive) return null

        // Try to parse as integer first
        element.content.toIntOrNull()?.let { return it }

        // Handle year ranges like "2016–2025" or "2016-2025"
        val yearString = element.content
        // Split by various dash types (en-dash, em-dash, hyphen)
        val parts = yearString.split("–", "—", "-")
        return parts.firstOrNull()?.trim()?.toIntOrNull()
    }
}

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
    @Serializable(with = YearSerializer::class)
    val year: Int? = null, // Can be "2016" or "2016–2025", we extract the start year
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
    val title: String? = null,
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
