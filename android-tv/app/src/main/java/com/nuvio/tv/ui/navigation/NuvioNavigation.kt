package com.nuvio.tv.ui.navigation

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.nuvio.tv.ui.screens.home.HomeScreen
import com.nuvio.tv.ui.screens.library.LibraryScreen
import com.nuvio.tv.ui.screens.metadata.MetadataScreen
import com.nuvio.tv.ui.screens.search.SearchScreen
import com.nuvio.tv.ui.screens.settings.SettingsScreen
import com.nuvio.tv.ui.screens.settings.addons.AddonsSettingsScreen
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

    Row(modifier = modifier.fillMaxSize()) {
        // Navigation Rail
        NuvioNavigationRail(
            selectedDestination = selectedDestination,
            onDestinationSelected = { destination ->
                selectedDestination = destination
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
            }
        )

        // Main Content Area
        NavHost(
            navController = navController,
            startDestination = NavRoutes.HOME,
            modifier = Modifier.weight(1f)
        ) {
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
                    }
                )
            }

            composable(NavRoutes.LIBRARY) {
                LibraryScreen(
                    onContentClick = { content ->
                        navController.navigate(NavRoutes.metadata(content.type, content.id))
                    }
                )
            }

            composable(NavRoutes.SEARCH) {
                SearchScreen(
                    onContentClick = { content ->
                        navController.navigate(NavRoutes.metadata(content.type, content.id))
                    }
                )
            }

            composable(NavRoutes.SETTINGS) {
                SettingsScreen(
                    onNavigateToTheme = {
                        navController.navigate(NavRoutes.SETTINGS_THEME)
                    },
                    onNavigateToPlayback = {
                        navController.navigate(NavRoutes.SETTINGS_PLAYBACK)
                    },
                    onNavigateToIntegrations = {
                        navController.navigate(NavRoutes.SETTINGS_INTEGRATIONS)
                    },
                    onNavigateToAddons = {
                        navController.navigate(NavRoutes.SETTINGS_ADDONS)
                    },
                    onNavigateToAbout = {
                        navController.navigate(NavRoutes.SETTINGS_ABOUT)
                    }
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
                        navController.navigate(NavRoutes.PLAYER)
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
            composable(NavRoutes.PLAYER) {
                // PlayerScreen will be implemented in Phase 3
            }

            // Settings Sub-screens
            composable(NavRoutes.SETTINGS_THEME) {
                // ThemeSettingsScreen
            }

            composable(NavRoutes.SETTINGS_PLAYBACK) {
                // PlaybackSettingsScreen
            }

            composable(NavRoutes.SETTINGS_INTEGRATIONS) {
                // IntegrationsSettingsScreen
            }

            composable(NavRoutes.SETTINGS_ADDONS) {
                AddonsSettingsScreen(
                    onBackClick = {
                        navController.popBackStack()
                    }
                )
            }

            composable(NavRoutes.SETTINGS_ABOUT) {
                // AboutSettingsScreen
            }
        }
    }
}
