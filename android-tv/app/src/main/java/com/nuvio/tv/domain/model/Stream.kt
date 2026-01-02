package com.nuvio.tv.domain.model

/**
 * Represents a video stream source.
 * Matches the Stremio addon protocol stream format.
 */
data class Stream(
    val url: String? = null,
    val name: String? = null,
    val title: String? = null,
    val description: String? = null,
    val quality: String? = null,
    val size: Long? = null,
    val isDebrid: Boolean = false,
    val isCached: Boolean = false,
    val addonId: String,
    val addonName: String,
    val subtitles: List<Subtitle> = emptyList(),
    val headers: Map<String, String> = emptyMap(),
    val infoHash: String? = null,
    val fileIdx: Int? = null,
    val ytId: String? = null,
    val externalUrl: String? = null,
    val behaviorHints: BehaviorHints? = null
) {
    /**
     * Returns the display name for this stream.
     */
    val displayName: String
        get() = name ?: title ?: addonName

    /**
     * Returns the formatted size string.
     */
    val formattedSize: String?
        get() = size?.let { formatFileSize(it) }

    /**
     * Combined text from all fields for parsing metadata.
     * TorBox and other debrid addons often put detailed info in description.
     */
    private val searchableText: String
        get() = listOfNotNull(title, name, description).joinToString(" ").lowercase()

    /**
     * Parse quality from title/name/description (e.g., "1080p", "4K", "720p")
     */
    val parsedQuality: String?
        get() {
            val text = searchableText
            return when {
                text.contains("4k") || text.contains("2160p") -> "4K"
                text.contains("1080p") || text.contains("1080") -> "1080p"
                text.contains("720p") || text.contains("720") -> "720p"
                text.contains("480p") || text.contains("480") -> "480p"
                text.contains("360p") -> "360p"
                quality != null -> quality
                else -> null
            }
        }

    /**
     * Parse language/audio info from title/name/description (e.g., "English", "Multi", "Dual Audio")
     */
    val parsedLanguage: String?
        get() {
            val text = searchableText
            return when {
                text.contains("multi") -> "Multi"
                text.contains("dual audio") || text.contains("dual-audio") -> "Dual Audio"
                text.contains("english") || text.contains("eng ") || text.contains(".eng.") -> "English"
                text.contains("spanish") || text.contains("esp ") || text.contains(".esp.") -> "Spanish"
                text.contains("french") || text.contains("fra ") || text.contains(".fra.") -> "French"
                text.contains("german") || text.contains("ger ") || text.contains(".ger.") -> "German"
                text.contains("italian") || text.contains("ita ") || text.contains(".ita.") -> "Italian"
                text.contains("portuguese") || text.contains("por ") || text.contains(".por.") -> "Portuguese"
                text.contains("russian") || text.contains("rus ") || text.contains(".rus.") -> "Russian"
                text.contains("hindi") || text.contains("hin ") || text.contains(".hin.") -> "Hindi"
                text.contains("japanese") || text.contains("jpn ") || text.contains(".jpn.") -> "Japanese"
                text.contains("korean") || text.contains("kor ") || text.contains(".kor.") -> "Korean"
                text.contains("chinese") || text.contains("chi ") || text.contains(".chi.") -> "Chinese"
                else -> null
            }
        }

    /**
     * Parse video codec/type from title/name/description (e.g., "HEVC", "x265", "x264", "AV1")
     */
    val parsedCodec: String?
        get() {
            val text = searchableText
            return when {
                text.contains("hevc") || text.contains("x265") || text.contains("h265") || text.contains("h.265") -> "HEVC"
                text.contains("x264") || text.contains("h264") || text.contains("h.264") || text.contains("avc") -> "H.264"
                text.contains("av1") -> "AV1"
                text.contains("xvid") -> "XviD"
                text.contains("divx") -> "DivX"
                text.contains("vp9") -> "VP9"
                text.contains("remux") -> "REMUX"
                text.contains("web-dl") || text.contains("webdl") -> "WEB-DL"
                text.contains("webrip") -> "WEBRip"
                text.contains("bluray") || text.contains("blu-ray") -> "BluRay"
                text.contains("hdtv") -> "HDTV"
                text.contains("hdrip") -> "HDRip"
                text.contains("dvdrip") -> "DVDRip"
                text.contains("cam") || text.contains("camrip") -> "CAM"
                else -> null
            }
        }

    /**
     * Parse HDR info from title/name/description
     */
    val parsedHdr: String?
        get() {
            val text = searchableText
            return when {
                text.contains("dolby vision") || text.contains(" dv ") || text.contains(".dv.") || text.contains("dovi") -> "DV"
                text.contains("hdr10+") || text.contains("hdr10plus") -> "HDR10+"
                text.contains("hdr10") -> "HDR10"
                text.contains(" hdr ") || text.contains(".hdr.") || text.contains("hdr ") -> "HDR"
                text.contains("sdr") -> "SDR"
                else -> null
            }
        }

    /**
     * Parse seeds count from title/name/description (for torrents)
     */
    val parsedSeeds: Int?
        get() {
            val text = listOfNotNull(title, name, description).joinToString(" ")
            val seedPattern = Regex("""(\d+)\s*(?:seeds?|seeders?)""", RegexOption.IGNORE_CASE)
            val match = seedPattern.find(text)
            return match?.groupValues?.get(1)?.toIntOrNull()
        }

    /**
     * Source type (Torrent, Debrid, Direct, etc.)
     * TorBox calls cached streams "Instant"
     */
    val sourceType: String
        get() = when {
            isDebrid && isCached -> "Instant"
            isDebrid -> "Debrid"
            infoHash != null -> "Torrent"
            ytId != null -> "YouTube"
            externalUrl != null -> "External"
            else -> "Direct"
        }

    private fun formatFileSize(bytes: Long): String {
        return when {
            bytes >= 1_073_741_824 -> String.format("%.1f GB", bytes / 1_073_741_824.0)
            bytes >= 1_048_576 -> String.format("%.1f MB", bytes / 1_048_576.0)
            bytes >= 1024 -> String.format("%.1f KB", bytes / 1024.0)
            else -> "$bytes B"
        }
    }
}

/**
 * Subtitle track information.
 */
data class Subtitle(
    val id: String,
    val url: String,
    val lang: String,
    val label: String? = null,
    val format: String? = null // srt, vtt, ass
)

/**
 * Behavior hints for stream playback.
 */
data class BehaviorHints(
    val bingeGroup: String? = null,
    val notWebReady: Boolean = false,
    val cached: Boolean = false,
    val proxyHeaders: Map<String, String>? = null,
    val videoHash: String? = null
)

/**
 * Audio track information.
 */
data class AudioTrack(
    val id: Int,
    val language: String,
    val label: String? = null,
    val isDefault: Boolean = false
)

/**
 * Video quality information.
 */
data class VideoQuality(
    val id: Int,
    val label: String,
    val bitrate: Int,
    val width: Int,
    val height: Int
)
