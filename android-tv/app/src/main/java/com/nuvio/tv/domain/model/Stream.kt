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
