package com.nuvio.tv.ui.screens.settings.integrations

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Api
import androidx.compose.material.icons.filled.Movie
import androidx.compose.material.icons.filled.SmartToy
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.tv.foundation.lazy.list.TvLazyColumn
import com.nuvio.tv.ui.screens.settings.SettingsViewModel
import com.nuvio.tv.ui.screens.settings.content.SettingsHeader
import com.nuvio.tv.ui.screens.settings.content.SettingsNavigationItem
import com.nuvio.tv.ui.screens.settings.content.SettingsSectionHeader

/**
 * Integrations settings screen.
 * Matches the mobile app's IntegrationsSettingsScreen.
 */
@Composable
fun IntegrationsSettingsScreen(
    viewModel: SettingsViewModel = hiltViewModel(),
    onBackClick: () -> Unit = {},
    onNavigateToTrakt: () -> Unit = {},
    onNavigateToMdblist: () -> Unit = {},
    onNavigateToTmdb: () -> Unit = {},
    onNavigateToAI: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsState()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(horizontal = 48.dp, vertical = 24.dp)
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            SettingsHeader(
                title = "Integrations",
                onBackClick = onBackClick
            )

            Spacer(modifier = Modifier.height(24.dp))

            TvLazyColumn(
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Account Section
                item {
                    SettingsSectionHeader(title = "ACCOUNT")
                }

                item {
                    SettingsNavigationItem(
                        title = "Trakt",
                        description = if (uiState.traktConnected)
                            "Connected as ${uiState.traktUsername}"
                        else
                            "Sign in for sync",
                        icon = Icons.Filled.Sync,
                        onClick = onNavigateToTrakt
                    )
                }

                // Metadata Section
                item {
                    Spacer(modifier = Modifier.height(8.dp))
                    SettingsSectionHeader(title = "METADATA")
                }

                item {
                    SettingsNavigationItem(
                        title = "MDBList",
                        description = if (uiState.mdblistConnected)
                            "Connected"
                        else
                            "Enable to add ratings & reviews",
                        icon = Icons.Filled.Api,
                        onClick = onNavigateToMdblist
                    )
                }

                item {
                    SettingsNavigationItem(
                        title = "TMDB",
                        description = "Metadata & logo source",
                        icon = Icons.Filled.Movie,
                        onClick = onNavigateToTmdb
                    )
                }

                // AI Section
                item {
                    Spacer(modifier = Modifier.height(8.dp))
                    SettingsSectionHeader(title = "AI ASSISTANT")
                }

                item {
                    SettingsNavigationItem(
                        title = "OpenRouter API",
                        description = if (uiState.openRouterConnected)
                            "Connected"
                        else
                            "Add API key to enable AI chat",
                        icon = Icons.Filled.SmartToy,
                        onClick = onNavigateToAI
                    )
                }
            }
        }
    }
}
