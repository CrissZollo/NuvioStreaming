package com.nuvio.tv.ui.screens.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Backup
import androidx.compose.material.icons.filled.ColorLens
import androidx.compose.material.icons.filled.Extension
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.PlayCircle
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material.icons.filled.VideoLibrary
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.tv.foundation.lazy.list.TvLazyColumn
import androidx.tv.foundation.lazy.list.items
import com.nuvio.tv.ui.theme.NuvioShapes
import com.nuvio.tv.ui.theme.NuvioTypography

/**
 * Settings screen with navigation to sub-settings.
 * Matches the mobile app's settings menu structure.
 */
@Composable
fun SettingsScreen(
    viewModel: SettingsViewModel = hiltViewModel(),
    onNavigateToContentDiscovery: () -> Unit,
    onNavigateToAppearance: () -> Unit,
    onNavigateToIntegrations: () -> Unit,
    onNavigateToPlayback: () -> Unit,
    onNavigateToBackup: () -> Unit,
    onNavigateToAbout: () -> Unit
) {
    val settingsItems = remember {
        listOf(
            SettingsSection(
                title = "GENERAL",
                items = listOf(
                    SettingsItem(
                        title = "Content & Discovery",
                        description = "Addons, catalogs, and sources",
                        icon = Icons.Filled.VideoLibrary,
                        onClick = onNavigateToContentDiscovery
                    ),
                    SettingsItem(
                        title = "Appearance",
                        description = "Theme and layout",
                        icon = Icons.Filled.ColorLens,
                        onClick = onNavigateToAppearance
                    ),
                    SettingsItem(
                        title = "Integrations",
                        description = "Trakt, MDBList, TMDB, AI",
                        icon = Icons.Filled.Sync,
                        onClick = onNavigateToIntegrations
                    ),
                    SettingsItem(
                        title = "Playback",
                        description = "Player, audio, subtitles",
                        icon = Icons.Filled.PlayCircle,
                        onClick = onNavigateToPlayback
                    )
                )
            ),
            SettingsSection(
                title = "DATA",
                items = listOf(
                    SettingsItem(
                        title = "Backup & Restore",
                        description = "Create and restore app backups",
                        icon = Icons.Filled.Backup,
                        onClick = onNavigateToBackup
                    )
                )
            ),
            SettingsSection(
                title = "ABOUT",
                items = listOf(
                    SettingsItem(
                        title = "About Nuvio",
                        description = "App info and support",
                        icon = Icons.Filled.Info,
                        onClick = onNavigateToAbout
                    )
                )
            )
        )
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(horizontal = 48.dp, vertical = 24.dp)
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            Text(
                text = "Settings",
                style = NuvioTypography.headlineLarge,
                color = MaterialTheme.colorScheme.onBackground,
                modifier = Modifier.padding(bottom = 24.dp)
            )

            TvLazyColumn(
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                settingsItems.forEach { section ->
                    item {
                        Text(
                            text = section.title,
                            style = NuvioTypography.labelMedium,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.padding(vertical = 12.dp, horizontal = 4.dp)
                        )
                    }

                    items(section.items) { item ->
                        SettingsListItem(
                            item = item,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }

                    item {
                        Spacer(modifier = Modifier.height(8.dp))
                    }
                }
            }
        }
    }
}

private data class SettingsSection(
    val title: String,
    val items: List<SettingsItem>
)

private data class SettingsItem(
    val title: String,
    val description: String,
    val icon: ImageVector,
    val onClick: () -> Unit
)

@Composable
private fun SettingsListItem(
    item: SettingsItem,
    modifier: Modifier = Modifier
) {
    var isFocused by remember { mutableStateOf(false) }

    Row(
        modifier = modifier
            .clip(NuvioShapes.medium)
            .background(
                if (isFocused) {
                    MaterialTheme.colorScheme.primary.copy(alpha = 0.15f)
                } else {
                    MaterialTheme.colorScheme.surface
                }
            )
            .onFocusChanged { focusState ->
                isFocused = focusState.isFocused
            }
            .focusable()
            .onKeyEvent { event ->
                if (event.type == KeyEventType.KeyDown &&
                    (event.key == Key.DirectionCenter || event.key == Key.Enter)
                ) {
                    item.onClick()
                    true
                } else {
                    false
                }
            }
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = item.icon,
            contentDescription = null,
            tint = if (isFocused) {
                MaterialTheme.colorScheme.primary
            } else {
                MaterialTheme.colorScheme.onSurface
            },
            modifier = Modifier.size(28.dp)
        )

        Spacer(modifier = Modifier.width(16.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = item.title,
                style = NuvioTypography.titleMedium,
                color = if (isFocused) {
                    MaterialTheme.colorScheme.primary
                } else {
                    MaterialTheme.colorScheme.onSurface
                }
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = item.description,
                style = NuvioTypography.bodySmall,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
            )
        }

        Icon(
            imageVector = Icons.AutoMirrored.Filled.ArrowForward,
            contentDescription = null,
            tint = if (isFocused) {
                MaterialTheme.colorScheme.primary
            } else {
                MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
            },
            modifier = Modifier.size(20.dp)
        )
    }
}
