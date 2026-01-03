package com.nuvio.tv.ui.navigation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import kotlinx.coroutines.delay
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.nuvio.tv.ui.screens.home.HomeScreen
import com.nuvio.tv.ui.screens.library.LibraryScreen
import com.nuvio.tv.ui.screens.metadata.MetadataScreen
import com.nuvio.tv.ui.screens.search.SearchScreen
import com.nuvio.tv.ui.screens.settings.SettingsScreen
import com.nuvio.tv.ui.screens.settings.about.AboutSettingsScreen
import com.nuvio.tv.ui.screens.settings.addons.AddonsSettingsScreen
import com.nuvio.tv.ui.screens.settings.appearance.AppearanceSettingsScreen
import com.nuvio.tv.ui.screens.settings.backup.BackupRestoreSettingsScreen
import com.nuvio.tv.ui.screens.settings.content.ContentDiscoverySettingsScreen
import com.nuvio.tv.ui.screens.settings.debrid.DebridIntegrationScreen
import com.nuvio.tv.ui.screens.settings.integrations.IntegrationsSettingsScreen
import com.nuvio.tv.ui.screens.settings.playback.PlaybackSettingsScreen
import com.nuvio.tv.ui.screens.player.NuvioPlayerScreen
import com.nuvio.tv.ui.screens.splash.SplashScreen
import com.nuvio.tv.ui.screens.streams.StreamsScreen

/**
 * Main navigation composable for the Nuvio TV app.
 * Sets up the navigation rail and NavHost for all screens.
 */
@Composable
fun NuvioNavigation(
    modifier: Modifier = Modifier,
    navController: NavHostController = rememberNavController()
) {
    var selectedDestination by rememberSaveable { mutableStateOf(MainNavDestination.HOME) }

    // FocusRequesters for each main screen's initial focus target
    val homeFocusRequester = remember { FocusRequester() }
    val libraryFocusRequester = remember { FocusRequester() }
    val searchFocusRequester = remember { FocusRequester() }
    val settingsFocusRequester = remember { FocusRequester() }

    // Track route changes to request focus after navigation
    var previousRoute by remember { mutableStateOf<String?>(null) }
    var pendingFocusDestination by remember { mutableStateOf<MainNavDestination?>(null) }

    // Track current route to determine if nav rail should be hidden
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    // Routes where navigation rail should be hidden (full-screen experiences)
    val isFullScreenRoute = currentRoute == NavRoutes.SPLASH ||
        currentRoute?.startsWith("streams/") == true ||
        currentRoute?.startsWith("player/") == true

    // Request focus on the target element after navigation completes
    LaunchedEffect(currentRoute) {
        if (pendingFocusDestination != null && currentRoute != null && currentRoute != previousRoute) {
            // Route has changed - wait for new screen to render then request focus
            delay(200)
            try {
                when (pendingFocusDestination) {
                    MainNavDestination.HOME -> homeFocusRequester.requestFocus()
                    MainNavDestination.LIBRARY -> libraryFocusRequester.requestFocus()
                    MainNavDestination.SEARCH -> searchFocusRequester.requestFocus()
                    MainNavDestination.SETTINGS -> settingsFocusRequester.requestFocus()
                    else -> {}
                }
            } catch (e: Exception) {
                // Focus request may fail if element not yet composed
            }
            pendingFocusDestination = null
        }
        previousRoute = currentRoute
    }

    Box(modifier = modifier.fillMaxSize()) {
        // Main Content Area - Full screen, with padding for collapsed nav rail
        NavHost(
            navController = navController,
            startDestination = NavRoutes.SPLASH,
            modifier = Modifier
                .fillMaxSize()
                .padding(start = if (!isFullScreenRoute) 56.dp else 0.dp)
        ) {
            // Splash Screen
            composable(NavRoutes.SPLASH) {
                SplashScreen(
                    onSplashComplete = {
                        navController.navigate(NavRoutes.HOME) {
                            popUpTo(NavRoutes.SPLASH) { inclusive = true }
                        }
                    }
                )
            }

            // Main Tab Screens
            composable(NavRoutes.HOME) {
                HomeScreen(
                    onContentClick = { content ->
                        navController.navigate(NavRoutes.metadata(content.type, content.id))
                    },
                    onCatalogClick = { catalog ->
                        navController.navigate(
                            NavRoutes.catalog(catalog.addonId, catalog.type, catalog.catalogId)
                        )
                    },
                    onAddAddonsClick = {
                        navController.navigate(NavRoutes.SETTINGS_ADDONS)
                    },
                    focusRequester = homeFocusRequester
                )
            }

            composable(NavRoutes.LIBRARY) {
                LibraryScreen(
                    onContentClick = { content ->
                        navController.navigate(NavRoutes.metadata(content.type, content.id))
                    },
                    focusRequester = libraryFocusRequester
                )
            }

            composable(NavRoutes.SEARCH) {
                SearchScreen(
                    onContentClick = { content ->
                        navController.navigate(NavRoutes.metadata(content.type, content.id))
                    },
                    focusRequester = searchFocusRequester
                )
            }

            composable(NavRoutes.SETTINGS) {
                SettingsScreen(
                    onNavigateToContentDiscovery = {
                        navController.navigate(NavRoutes.SETTINGS_CONTENT_DISCOVERY)
                    },
                    onNavigateToAppearance = {
                        navController.navigate(NavRoutes.SETTINGS_APPEARANCE)
                    },
                    onNavigateToIntegrations = {
                        navController.navigate(NavRoutes.SETTINGS_INTEGRATIONS)
                    },
                    onNavigateToPlayback = {
                        navController.navigate(NavRoutes.SETTINGS_PLAYBACK)
                    },
                    onNavigateToBackup = {
                        navController.navigate(NavRoutes.SETTINGS_BACKUP)
                    },
                    onNavigateToAbout = {
                        navController.navigate(NavRoutes.SETTINGS_ABOUT)
                    },
                    focusRequester = settingsFocusRequester
                )
            }

            // Content Screens
            composable(
                route = NavRoutes.METADATA,
                arguments = listOf(
                    navArgument(NavArgs.TYPE) { type = NavType.StringType },
                    navArgument(NavArgs.ID) { type = NavType.StringType }
                )
            ) { backStackEntry ->
                val type = backStackEntry.arguments?.getString(NavArgs.TYPE) ?: "movie"
                val id = backStackEntry.arguments?.getString(NavArgs.ID) ?: ""

                MetadataScreen(
                    contentType = type,
                    contentId = id,
                    onPlayClick = { content, episodeId ->
                        navController.navigate(NavRoutes.streams(content.type, content.id))
                    },
                    onBackClick = {
                        navController.popBackStack()
                    }
                )
            }

            composable(
                route = NavRoutes.STREAMS,
                arguments = listOf(
                    navArgument(NavArgs.TYPE) { type = NavType.StringType },
                    navArgument(NavArgs.ID) { type = NavType.StringType }
                )
            ) { backStackEntry ->
                val type = backStackEntry.arguments?.getString(NavArgs.TYPE) ?: "movie"
                val id = backStackEntry.arguments?.getString(NavArgs.ID) ?: ""

                StreamsScreen(
                    contentType = type,
                    contentId = id,
                    onStreamSelected = { stream ->
                        // The viewModel.selectStream() is called from StreamsScreen
                        // Navigate to player with content info
                        navController.navigate(NavRoutes.player(type, id))
                    },
                    onBackClick = {
                        navController.popBackStack()
                    }
                )
            }

            composable(
                route = NavRoutes.CATALOG,
                arguments = listOf(
                    navArgument(NavArgs.ADDON_ID) { type = NavType.StringType },
                    navArgument(NavArgs.TYPE) { type = NavType.StringType },
                    navArgument(NavArgs.CATALOG_ID) { type = NavType.StringType }
                )
            ) { backStackEntry ->
                val addonId = backStackEntry.arguments?.getString(NavArgs.ADDON_ID) ?: ""
                val type = backStackEntry.arguments?.getString(NavArgs.TYPE) ?: "movie"
                val catalogId = backStackEntry.arguments?.getString(NavArgs.CATALOG_ID) ?: ""

                // CatalogScreen will be implemented later
                // For now, navigate back
                HomeScreen(
                    onContentClick = { content ->
                        navController.navigate(NavRoutes.metadata(content.type, content.id))
                    },
                    onCatalogClick = { }
                )
            }

            // Player Screen (full-screen, no navigation rail)
            composable(
                route = NavRoutes.PLAYER,
                arguments = listOf(
                    navArgument(NavArgs.TYPE) { type = NavType.StringType },
                    navArgument(NavArgs.ID) { type = NavType.StringType }
                )
            ) { backStackEntry ->
                val type = backStackEntry.arguments?.getString(NavArgs.TYPE) ?: "movie"
                val id = backStackEntry.arguments?.getString(NavArgs.ID) ?: ""

                // Get the stream from the PlaybackStateHolder
                // The stream should be set before navigating here from StreamsScreen
                NuvioPlayerScreen(
                    contentType = type,
                    contentId = id,
                    onBackClick = {
                        navController.popBackStack()
                    }
                )
            }

            // Settings Sub-screens - Level 1
            composable(NavRoutes.SETTINGS_CONTENT_DISCOVERY) {
                ContentDiscoverySettingsScreen(
                    onBackClick = { navController.popBackStack() },
                    onNavigateToAddons = { navController.navigate(NavRoutes.SETTINGS_ADDONS) },
                    onNavigateToDebrid = { navController.navigate(NavRoutes.SETTINGS_DEBRID) },
                    onNavigateToCatalogs = { navController.navigate(NavRoutes.SETTINGS_CATALOGS) },
                    onNavigateToHomeScreen = { navController.navigate(NavRoutes.SETTINGS_HOME_SCREEN) },
                    onNavigateToContinueWatching = { navController.navigate(NavRoutes.SETTINGS_CONTINUE_WATCHING) }
                )
            }

            composable(NavRoutes.SETTINGS_APPEARANCE) {
                AppearanceSettingsScreen(
                    onBackClick = { navController.popBackStack() },
                    onNavigateToTheme = { navController.navigate(NavRoutes.SETTINGS_THEME) }
                )
            }

            composable(NavRoutes.SETTINGS_INTEGRATIONS) {
                IntegrationsSettingsScreen(
                    onBackClick = { navController.popBackStack() },
                    onNavigateToTrakt = { navController.navigate(NavRoutes.SETTINGS_TRAKT) },
                    onNavigateToMdblist = { navController.navigate(NavRoutes.SETTINGS_MDBLIST) },
                    onNavigateToTmdb = { navController.navigate(NavRoutes.SETTINGS_TMDB) },
                    onNavigateToAI = { navController.navigate(NavRoutes.SETTINGS_AI) }
                )
            }

            composable(NavRoutes.SETTINGS_PLAYBACK) {
                PlaybackSettingsScreen(
                    onBackClick = { navController.popBackStack() },
                    onNavigateToPlayer = { navController.navigate(NavRoutes.SETTINGS_PLAYER) },
                    onNavigateToAudioLanguage = { navController.navigate(NavRoutes.SETTINGS_AUDIO_LANGUAGE) },
                    onNavigateToSubtitleLanguage = { navController.navigate(NavRoutes.SETTINGS_SUBTITLE_LANGUAGE) },
                    onNavigateToSubtitleSource = { navController.navigate(NavRoutes.SETTINGS_SUBTITLE_SOURCE) },
                    onNavigateToNotifications = { navController.navigate(NavRoutes.SETTINGS_NOTIFICATIONS) }
                )
            }

            composable(NavRoutes.SETTINGS_BACKUP) {
                BackupRestoreSettingsScreen(
                    onBackClick = { navController.popBackStack() },
                    onCreateBackup = { /* TODO: Implement backup */ },
                    onRestoreBackup = { /* TODO: Implement restore */ }
                )
            }

            composable(NavRoutes.SETTINGS_ABOUT) {
                AboutSettingsScreen(
                    onBackClick = { navController.popBackStack() },
                    onPrivacyPolicyClick = { /* TODO: Open privacy policy */ },
                    onReportIssueClick = { /* TODO: Open issue reporter */ },
                    onContributorsClick = { /* TODO: Show contributors */ },
                    onLicensesClick = { /* TODO: Show licenses */ }
                )
            }

            // Settings Sub-screens - Level 2 (placeholders for now)
            composable(NavRoutes.SETTINGS_ADDONS) {
                AddonsSettingsScreen(
                    onBackClick = { navController.popBackStack() }
                )
            }

            composable(NavRoutes.SETTINGS_DEBRID) {
                DebridIntegrationScreen(
                    onBackClick = { navController.popBackStack() }
                )
            }

            composable(NavRoutes.SETTINGS_THEME) {
                // ThemeSettingsScreen - TODO
            }

            composable(NavRoutes.SETTINGS_CATALOGS) {
                // CatalogsSettingsScreen - TODO
            }

            composable(NavRoutes.SETTINGS_HOME_SCREEN) {
                // HomeScreenSettingsScreen - TODO
            }

            composable(NavRoutes.SETTINGS_CONTINUE_WATCHING) {
                // ContinueWatchingSettingsScreen - TODO
            }

            composable(NavRoutes.SETTINGS_TRAKT) {
                // TraktSettingsScreen - TODO
            }

            composable(NavRoutes.SETTINGS_MDBLIST) {
                // MDBListSettingsScreen - TODO
            }

            composable(NavRoutes.SETTINGS_TMDB) {
                // TMDBSettingsScreen - TODO
            }

            composable(NavRoutes.SETTINGS_AI) {
                // AISettingsScreen - TODO
            }

            composable(NavRoutes.SETTINGS_PLAYER) {
                // PlayerSettingsScreen - TODO
            }

            composable(NavRoutes.SETTINGS_AUDIO_LANGUAGE) {
                // AudioLanguageSettingsScreen - TODO
            }

            composable(NavRoutes.SETTINGS_SUBTITLE_LANGUAGE) {
                // SubtitleLanguageSettingsScreen - TODO
            }

            composable(NavRoutes.SETTINGS_SUBTITLE_SOURCE) {
                // SubtitleSourceSettingsScreen - TODO
            }

            composable(NavRoutes.SETTINGS_NOTIFICATIONS) {
                // NotificationsSettingsScreen - TODO
            }
        }

        // Navigation Rail - Overlay on top of content, hidden on full-screen routes
        if (!isFullScreenRoute) {
            NuvioNavigationRail(
                selectedDestination = selectedDestination,
                onDestinationSelected = { destination ->
                    selectedDestination = destination
                    pendingFocusDestination = destination
                    navController.navigate(destination.route) {
                        // Pop up to the start destination to avoid building up a large stack
                        popUpTo(NavRoutes.HOME) {
                            saveState = true
                        }
                        // Avoid multiple copies of the same destination
                        launchSingleTop = true
                        // Restore state when reselecting a previously selected item
                        restoreState = true
                    }
                },
                modifier = Modifier.zIndex(1f)
            )
        }
    }
}
