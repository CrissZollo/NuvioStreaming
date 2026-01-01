package com.nuvio.tv.data.remote.api

import com.nuvio.tv.data.remote.dto.CatalogResponseDto
import com.nuvio.tv.data.remote.dto.ManifestDto
import com.nuvio.tv.data.remote.dto.MetaResponseDto
import com.nuvio.tv.data.remote.dto.StreamsResponseDto
import com.nuvio.tv.data.remote.dto.SubtitlesResponseDto
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Url

/**
 * Retrofit interface for Stremio addon protocol.
 *
 * Stremio addons follow a RESTful protocol where each addon is a separate HTTP server.
 * The base URL is the addon manifest URL, and resources are fetched relative to that.
 */
interface StremioApi {

    /**
     * Fetch addon manifest.
     * The manifest describes the addon's capabilities, catalogs, and resources.
     */
    @GET
    suspend fun getManifest(@Url manifestUrl: String): Response<ManifestDto>

    /**
     * Fetch catalog content.
     *
     * @param baseUrl The addon base URL (without trailing slash)
     * @param type Content type (movie, series, channel, etc.)
     * @param id Catalog ID as defined in the manifest
     * @param extra Optional extra parameters (genre, search, skip, etc.) formatted as "key=value:key2=value2"
     */
    @GET("{baseUrl}/catalog/{type}/{id}.json")
    suspend fun getCatalog(
        @Path("baseUrl", encoded = true) baseUrl: String,
        @Path("type") type: String,
        @Path("id") id: String
    ): Response<CatalogResponseDto>

    @GET("{baseUrl}/catalog/{type}/{id}/{extra}.json")
    suspend fun getCatalogWithExtra(
        @Path("baseUrl", encoded = true) baseUrl: String,
        @Path("type") type: String,
        @Path("id") id: String,
        @Path("extra", encoded = true) extra: String
    ): Response<CatalogResponseDto>

    /**
     * Fetch content metadata.
     *
     * @param baseUrl The addon base URL
     * @param type Content type
     * @param id Content ID (e.g., "tt1234567" for IMDB IDs)
     */
    @GET("{baseUrl}/meta/{type}/{id}.json")
    suspend fun getMeta(
        @Path("baseUrl", encoded = true) baseUrl: String,
        @Path("type") type: String,
        @Path("id") id: String
    ): Response<MetaResponseDto>

    /**
     * Fetch streams for content.
     *
     * @param baseUrl The addon base URL
     * @param type Content type
     * @param id Content ID, for episodes use format "imdb_id:season:episode"
     */
    @GET("{baseUrl}/stream/{type}/{id}.json")
    suspend fun getStreams(
        @Path("baseUrl", encoded = true) baseUrl: String,
        @Path("type") type: String,
        @Path("id") id: String
    ): Response<StreamsResponseDto>

    /**
     * Fetch subtitles for content.
     *
     * @param baseUrl The addon base URL
     * @param type Content type
     * @param id Content ID
     */
    @GET("{baseUrl}/subtitles/{type}/{id}.json")
    suspend fun getSubtitles(
        @Path("baseUrl", encoded = true) baseUrl: String,
        @Path("type") type: String,
        @Path("id") id: String
    ): Response<SubtitlesResponseDto>
}

/**
 * Helper object for building Stremio addon URLs and extras.
 */
object StremioUrlHelper {

    /**
     * Extract the base URL from a manifest URL.
     * E.g., "https://addon.example.com/manifest.json" -> "https://addon.example.com"
     */
    fun getBaseUrl(manifestUrl: String): String {
        return manifestUrl.removeSuffix("/manifest.json").removeSuffix("/")
    }

    /**
     * Build extra parameters string for catalog requests.
     * Format: "key=value&key2=value2" (URL-safe encoding)
     */
    fun buildExtraParams(params: Map<String, String>): String {
        return params.entries.joinToString("&") { (key, value) ->
            "$key=$value"
        }
    }

    /**
     * Build stream ID for episodes.
     * Format: "imdb_id:season:episode"
     */
    fun buildEpisodeStreamId(imdbId: String, season: Int, episode: Int): String {
        return "$imdbId:$season:$episode"
    }

    /**
     * Parse a stream ID to extract episode info.
     * Returns null if not a valid episode ID format.
     */
    fun parseEpisodeStreamId(streamId: String): Triple<String, Int, Int>? {
        val parts = streamId.split(":")
        if (parts.size != 3) return null

        val imdbId = parts[0]
        val season = parts[1].toIntOrNull() ?: return null
        val episode = parts[2].toIntOrNull() ?: return null

        return Triple(imdbId, season, episode)
    }
}
