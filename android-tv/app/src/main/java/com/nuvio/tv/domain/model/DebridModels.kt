package com.nuvio.tv.domain.model

/**
 * Supported debrid services.
 */
enum class DebridService(
    val id: String,
    val displayName: String,
    val keyParam: String
) {
    TORBOX("torbox", "TorBox", "torbox"),
    REAL_DEBRID("realdebrid", "RealDebrid", "realdebrid"),
    ALL_DEBRID("alldebrid", "AllDebrid", "alldebrid"),
    PREMIUMIZE("premiumize", "Premiumize", "premiumize"),
    DEBRID_LINK("debridlink", "DebridLink", "debridlink"),
    OFFCLOUD("offcloud", "Offcloud", "offcloud");

    companion object {
        fun fromId(id: String): DebridService? = entries.find { it.id == id }
    }
}

/**
 * TorBox subscription plans.
 */
enum class TorBoxPlan(val planId: Int, val displayName: String) {
    FREE(0, "Free"),
    ESSENTIAL(1, "Essential"),
    PRO(2, "Pro"),
    STANDARD(3, "Standard");

    companion object {
        fun fromPlanId(planId: Int): TorBoxPlan =
            entries.find { it.planId == planId } ?: FREE
    }
}

/**
 * TorBox configuration stored locally.
 */
data class TorBoxConfig(
    val apiKey: String = "",
    val isConnected: Boolean = false,
    val isEnabled: Boolean = true,
    val addonId: String? = null
)

/**
 * TorBox user information from API.
 */
data class TorBoxUser(
    val id: Int,
    val email: String,
    val plan: TorBoxPlan,
    val totalDownloaded: Long, // in bytes
    val isSubscribed: Boolean,
    val premiumExpiresAt: String?, // ISO date
    val baseEmail: String
) {
    /**
     * Get total downloaded in GB.
     */
    val totalDownloadedGB: Double
        get() = totalDownloaded / (1024.0 * 1024.0 * 1024.0)

    /**
     * Get formatted download amount.
     */
    val formattedDownloaded: String
        get() = "%.2f GB".format(totalDownloadedGB)

    /**
     * Get account status display string.
     */
    val accountStatus: String
        get() = if (isSubscribed) "Active" else "Free"
}

/**
 * Torrentio configuration stored locally.
 */
data class TorrentioConfig(
    val providers: List<String> = DEFAULT_PROVIDERS,
    val sort: String = "quality",
    val qualityFilter: List<String> = listOf("scr", "cam"),
    val priorityLanguages: List<String> = emptyList(),
    val maxResults: String = "",
    val debridService: String = "torbox",
    val debridApiKey: String = "",
    val noDownloadLinks: Boolean = false,
    val noCatalog: Boolean = false,
    val isInstalled: Boolean = false,
    val manifestUrl: String? = null
) {
    companion object {
        val DEFAULT_PROVIDERS = listOf(
            "yts", "eztv", "rarbg", "1337x", "thepiratebay",
            "kickasstorrents", "torrentgalaxy", "magnetdl",
            "horriblesubs", "nyaasi", "tokyotosho", "anidex",
            "rutor", "rutracker", "comando", "torrent9", "ilcorsaronero",
            "mejortorrent", "wolfmax4k", "cinecalidad"
        )
    }

    /**
     * Generate Torrentio manifest URL from config.
     */
    fun generateManifestUrl(): String {
        val configParts = mutableListOf<String>()

        // Providers
        if (providers.isNotEmpty()) {
            configParts.add("providers=${providers.joinToString(",")}")
        }

        // Sort
        configParts.add("sort=$sort")

        // Quality filter
        if (qualityFilter.isNotEmpty()) {
            configParts.add("qualityfilter=${qualityFilter.joinToString(",")}")
        }

        // Priority languages
        if (priorityLanguages.isNotEmpty()) {
            configParts.add("language=${priorityLanguages.joinToString(",")}")
        }

        // Max results
        if (maxResults.isNotEmpty()) {
            configParts.add("limit=$maxResults")
        }

        // Debrid service and key
        if (debridService.isNotEmpty() && debridApiKey.isNotEmpty()) {
            configParts.add("$debridService=$debridApiKey")
        }

        // Options
        if (noDownloadLinks) {
            configParts.add("nodownloadlinks=true")
        }
        if (noCatalog) {
            configParts.add("nocatalog=true")
        }

        val configString = configParts.joinToString("|")
        return "https://torrentio.strem.fun/$configString/manifest.json"
    }
}

/**
 * Torrentio sorting options.
 */
enum class TorrentioSort(val id: String, val displayName: String) {
    QUALITY("quality", "By quality then seeders"),
    QUALITY_SIZE("qualitysize", "By quality then size"),
    SEEDERS("seeders", "By seeders"),
    SIZE("size", "By size")
}

/**
 * Torrentio quality filter options.
 */
enum class TorrentioQuality(val id: String, val displayName: String) {
    BRREMUX("brremux", "BluRay REMUX"),
    HDR("hdr", "HDR"),
    DOLBY_VISION("dolbyvision", "Dolby Vision"),
    FOUR_K("4k", "4K"),
    P1080("1080p", "1080p"),
    P720("720p", "720p"),
    P480("480p", "480p"),
    SCR("scr", "Screener"),
    CAM("cam", "CAM"),
    UNKNOWN("unknown", "Unknown")
}

/**
 * Torrentio language options.
 */
enum class TorrentioLanguage(val id: String, val displayName: String) {
    ENGLISH("english", "English"),
    RUSSIAN("russian", "Russian"),
    ITALIAN("italian", "Italian"),
    PORTUGUESE("portuguese", "Portuguese"),
    SPANISH("spanish", "Spanish"),
    FRENCH("french", "French"),
    GERMAN("german", "German"),
    DUTCH("dutch", "Dutch"),
    CHINESE("chinese", "Chinese"),
    JAPANESE("japanese", "Japanese"),
    KOREAN("korean", "Korean"),
    HINDI("hindi", "Hindi"),
    POLISH("polish", "Polish"),
    ARABIC("arabic", "Arabic"),
    TURKISH("turkish", "Turkish")
}
