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
 * All methods use @Url to allow dynamic base URLs per addon.
 */
interface StremioApi {

    /**
     * Fetch addon manifest.
     * The manifest describes the addon's capabilities, catalogs, and resources.
     */
    @GET
    suspend fun getManifest(@Url manifestUrl: String): Response<ManifestDto>

    /**
     * Fetch catalog content using dynamic URL.
     * URL should be: {baseUrl}/catalog/{type}/{id}.json
     */
    @GET
    suspend fun getCatalog(@Url url: String): Response<CatalogResponseDto>

    /**
     * Fetch content metadata.
     * URL should be: {baseUrl}/meta/{type}/{id}.json
     */
    @GET
    suspend fun getMeta(@Url url: String): Response<MetaResponseDto>

    /**
     * Fetch streams for content.
     * URL should be: {baseUrl}/stream/{type}/{id}.json
     */
    @GET
    suspend fun getStreams(@Url url: String): Response<StreamsResponseDto>

    /**
     * Fetch subtitles for content.
     * URL should be: {baseUrl}/subtitles/{type}/{id}.json
     */
    @GET
    suspend fun getSubtitles(@Url url: String): Response<SubtitlesResponseDto>
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
