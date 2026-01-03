package com.nuvio.tv.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.VideoLibrary
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.VideoLibrary
import androidx.compose.ui.graphics.vector.ImageVector

/**
 * Main navigation destinations for the navigation rail.
 */
enum class MainNavDestination(
    val route: String,
    val label: String,
    val selectedIcon: ImageVector,
    val unselectedIcon: ImageVector
) {
    HOME(
        route = "home",
        label = "Home",
        selectedIcon = Icons.Filled.Home,
        unselectedIcon = Icons.Outlined.Home
    ),
    LIBRARY(
        route = "library",
        label = "Library",
        selectedIcon = Icons.Filled.VideoLibrary,
        unselectedIcon = Icons.Outlined.VideoLibrary
    ),
    SEARCH(
        route = "search",
        label = "Search",
        selectedIcon = Icons.Filled.Search,
        unselectedIcon = Icons.Outlined.Search
    ),
    SETTINGS(
        route = "settings",
        label = "Settings",
        selectedIcon = Icons.Filled.Settings,
        unselectedIcon = Icons.Outlined.Settings
    )
}

/**
 * All navigation routes in the app.
 */
object NavRoutes {
    // Splash screen
    const val SPLASH = "splash"

    // Main tabs
    const val HOME = "home"
    const val LIBRARY = "library"
    const val SEARCH = "search"
    const val SETTINGS = "settings"

    // Content screens
    const val METADATA = "metadata/{type}/{id}"
    const val STREAMS = "streams/{type}/{id}"
    const val CATALOG = "catalog/{addonId}/{type}/{catalogId}"
    const val PLAYER = "player/{type}/{id}"

    // Settings sub-screens
    const val SETTINGS_CONTENT_DISCOVERY = "settings/content-discovery"
    const val SETTINGS_APPEARANCE = "settings/appearance"
    const val SETTINGS_INTEGRATIONS = "settings/integrations"
    const val SETTINGS_PLAYBACK = "settings/playback"
    const val SETTINGS_BACKUP = "settings/backup"
    const val SETTINGS_ABOUT = "settings/about"

    // Settings sub-sub-screens
    const val SETTINGS_ADDONS = "settings/addons"
    const val SETTINGS_DEBRID = "settings/debrid"
    const val SETTINGS_CATALOGS = "settings/catalogs"
    const val SETTINGS_HOME_SCREEN = "settings/home-screen"
    const val SETTINGS_CONTINUE_WATCHING = "settings/continue-watching"
    const val SETTINGS_THEME = "settings/theme"
    const val SETTINGS_TRAKT = "settings/trakt"
    const val SETTINGS_MDBLIST = "settings/mdblist"
    const val SETTINGS_TMDB = "settings/tmdb"
    const val SETTINGS_AI = "settings/ai"
    const val SETTINGS_PLAYER = "settings/player"
    const val SETTINGS_AUDIO_LANGUAGE = "settings/audio-language"
    const val SETTINGS_SUBTITLE_LANGUAGE = "settings/subtitle-language"
    const val SETTINGS_SUBTITLE_SOURCE = "settings/subtitle-source"
    const val SETTINGS_NOTIFICATIONS = "settings/notifications"

    // Helper functions for building routes with arguments
    fun metadata(type: String, id: String): String = "metadata/$type/$id"
    fun streams(type: String, id: String): String = "streams/$type/$id"
    fun catalog(addonId: String, type: String, catalogId: String): String =
        "catalog/$addonId/$type/$catalogId"
    fun player(type: String, id: String): String = "player/$type/$id"
}

/**
 * Navigation arguments for screens that receive data.
 */
object NavArgs {
    const val TYPE = "type"
    const val ID = "id"
    const val ADDON_ID = "addonId"
    const val CATALOG_ID = "catalogId"
    const val EPISODE_ID = "episodeId"
}
