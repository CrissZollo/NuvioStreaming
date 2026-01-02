package com.nuvio.tv.ui.screens.settings.content

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
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Extension
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.PlayCircle
import androidx.compose.material.icons.filled.Source
import androidx.compose.material.icons.filled.ViewList
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
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
import com.nuvio.tv.ui.screens.settings.SettingsViewModel
import com.nuvio.tv.ui.theme.NuvioShapes
import com.nuvio.tv.ui.theme.NuvioTypography

/**
 * Content & Discovery settings screen.
 * Matches the mobile app's ContentDiscoverySettingsScreen.
 */
@Composable
fun ContentDiscoverySettingsScreen(
    viewModel: SettingsViewModel = hiltViewModel(),
    onBackClick: () -> Unit = {},
    onNavigateToAddons: () -> Unit = {},
    onNavigateToCatalogs: () -> Unit = {},
    onNavigateToHomeScreen: () -> Unit = {},
    onNavigateToContinueWatching: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsState()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(horizontal = 48.dp, vertical = 24.dp)
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            // Header with back button
            SettingsHeader(
                title = "Content & Discovery",
                onBackClick = onBackClick
            )

            Spacer(modifier = Modifier.height(24.dp))

            TvLazyColumn(
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Sources Section
                item {
                    SettingsSectionHeader(title = "SOURCES")
                }

                item {
                    SettingsNavigationItem(
                        title = "Addons",
                        description = "${uiState.addonCount} installed",
                        icon = Icons.Filled.Extension,
                        onClick = onNavigateToAddons
                    )
                }

                item {
                    SettingsNavigationItem(
                        title = "Debrid Integration",
                        description = "Connect Torbox for premium streams",
                        icon = Icons.Filled.Source,
                        onClick = { /* TODO: Navigate to Debrid settings */ }
                    )
                }

                // Catalogs Section
                item {
                    Spacer(modifier = Modifier.height(8.dp))
                    SettingsSectionHeader(title = "CATALOGS")
                }

                item {
                    SettingsNavigationItem(
                        title = "Catalogs",
                        description = "Enable or disable content catalogs",
                        icon = Icons.Filled.ViewList,
                        onClick = onNavigateToCatalogs
                    )
                }

                item {
                    SettingsNavigationItem(
                        title = "Home Screen",
                        description = "Layout and content configuration",
                        icon = Icons.Filled.Home,
                        onClick = onNavigateToHomeScreen
                    )
                }

                item {
                    SettingsNavigationItem(
                        title = "Continue Watching",
                        description = "Cache and playback behavior",
                        icon = Icons.Filled.PlayCircle,
                        onClick = onNavigateToContinueWatching
                    )
                }
            }
        }
    }
}

@Composable
fun SettingsHeader(
    title: String,
    onBackClick: () -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        var backFocused by remember { mutableStateOf(false) }

        IconButton(
            onClick = onBackClick,
            modifier = Modifier
                .onFocusChanged { backFocused = it.isFocused }
                .focusable()
                .onKeyEvent { event ->
                    if (event.type == KeyEventType.KeyDown &&
                        (event.key == Key.DirectionCenter || event.key == Key.Enter)
                    ) {
                        onBackClick()
                        true
                    } else {
                        false
                    }
                }
                .background(
                    if (backFocused) MaterialTheme.colorScheme.primary.copy(alpha = 0.15f)
                    else MaterialTheme.colorScheme.surface,
                    shape = NuvioShapes.small
                )
        ) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                contentDescription = "Back",
                tint = if (backFocused) MaterialTheme.colorScheme.primary
                else MaterialTheme.colorScheme.onSurface
            )
        }

        Spacer(modifier = Modifier.width(16.dp))

        Text(
            text = title,
            style = NuvioTypography.headlineLarge,
            color = MaterialTheme.colorScheme.onBackground
        )
    }
}

@Composable
fun SettingsSectionHeader(title: String) {
    Text(
        text = title,
        style = NuvioTypography.labelMedium,
        color = MaterialTheme.colorScheme.primary,
        modifier = Modifier.padding(vertical = 8.dp)
    )
}

@Composable
fun SettingsNavigationItem(
    title: String,
    description: String,
    icon: ImageVector,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    var isFocused by remember { mutableStateOf(false) }

    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(NuvioShapes.medium)
            .background(
                if (isFocused) MaterialTheme.colorScheme.primary.copy(alpha = 0.15f)
                else MaterialTheme.colorScheme.surface
            )
            .onFocusChanged { focusState ->
                isFocused = focusState.isFocused
            }
            .focusable()
            .onKeyEvent { event ->
                if (event.type == KeyEventType.KeyDown &&
                    (event.key == Key.DirectionCenter || event.key == Key.Enter)
                ) {
                    onClick()
                    true
                } else {
                    false
                }
            }
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = if (isFocused) MaterialTheme.colorScheme.primary
            else MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.size(28.dp)
        )

        Spacer(modifier = Modifier.width(16.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                style = NuvioTypography.titleMedium,
                color = if (isFocused) MaterialTheme.colorScheme.primary
                else MaterialTheme.colorScheme.onSurface
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = description,
                style = NuvioTypography.bodySmall,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
            )
        }

        Icon(
            imageVector = Icons.AutoMirrored.Filled.ArrowForward,
            contentDescription = null,
            tint = if (isFocused) MaterialTheme.colorScheme.primary
            else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
            modifier = Modifier.size(20.dp)
        )
    }
}
