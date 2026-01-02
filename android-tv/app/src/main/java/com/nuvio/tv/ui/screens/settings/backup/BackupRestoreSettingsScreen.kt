package com.nuvio.tv.ui.screens.settings.backup

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
import androidx.compose.material.icons.filled.Backup
import androidx.compose.material.icons.filled.CloudDownload
import androidx.compose.material.icons.filled.CloudUpload
import androidx.compose.material.icons.filled.Extension
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.tv.foundation.lazy.list.TvLazyColumn
import com.nuvio.tv.ui.screens.settings.SettingsViewModel
import com.nuvio.tv.ui.screens.settings.content.SettingsHeader
import com.nuvio.tv.ui.screens.settings.content.SettingsSectionHeader
import com.nuvio.tv.ui.theme.NuvioShapes
import com.nuvio.tv.ui.theme.NuvioTypography

/**
 * Backup & Restore settings screen.
 * Matches the mobile app's BackupScreen.
 */
@Composable
fun BackupRestoreSettingsScreen(
    viewModel: SettingsViewModel = hiltViewModel(),
    onBackClick: () -> Unit = {},
    onCreateBackup: () -> Unit = {},
    onRestoreBackup: () -> Unit = {}
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(horizontal = 48.dp, vertical = 24.dp)
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            SettingsHeader(
                title = "Backup & Restore",
                onBackClick = onBackClick
            )

            Spacer(modifier = Modifier.height(24.dp))

            TvLazyColumn(
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Info Section
                item {
                    BackupInfoCard()
                }

                // Core Data Section
                item {
                    Spacer(modifier = Modifier.height(8.dp))
                    SettingsSectionHeader(title = "CORE DATA")
                }

                item {
                    BackupCategoryItem(
                        title = "Watch History",
                        description = "Your viewing history and progress",
                        icon = Icons.Filled.History
                    )
                }

                // Addons & Integrations Section
                item {
                    Spacer(modifier = Modifier.height(8.dp))
                    SettingsSectionHeader(title = "ADDONS & INTEGRATIONS")
                }

                item {
                    BackupCategoryItem(
                        title = "Installed Addons",
                        description = "All addon configurations and settings",
                        icon = Icons.Filled.Extension
                    )
                }

                // Settings Section
                item {
                    Spacer(modifier = Modifier.height(8.dp))
                    SettingsSectionHeader(title = "SETTINGS & PREFERENCES")
                }

                item {
                    BackupCategoryItem(
                        title = "App Settings",
                        description = "Display, playback, and other preferences",
                        icon = Icons.Filled.Settings
                    )
                }

                // Actions
                item {
                    Spacer(modifier = Modifier.height(24.dp))
                    BackupActionButtons(
                        onCreateBackup = onCreateBackup,
                        onRestoreBackup = onRestoreBackup
                    )
                }
            }
        }
    }
}

@Composable
private fun BackupInfoCard() {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(NuvioShapes.medium)
            .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.1f))
            .padding(24.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Filled.Backup,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(48.dp)
            )

            Spacer(modifier = Modifier.width(16.dp))

            Column {
                Text(
                    text = "Backup Your Data",
                    style = NuvioTypography.titleLarge,
                    color = MaterialTheme.colorScheme.onBackground
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Create a backup of your settings, watch history, and addons. Restore anytime to recover your data.",
                    style = NuvioTypography.bodyMedium,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f)
                )
            }
        }
    }
}

@Composable
private fun BackupCategoryItem(
    title: String,
    description: String,
    icon: ImageVector
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(NuvioShapes.medium)
            .background(MaterialTheme.colorScheme.surface)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(28.dp)
        )

        Spacer(modifier = Modifier.width(16.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                style = NuvioTypography.titleMedium,
                color = MaterialTheme.colorScheme.onSurface
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = description,
                style = NuvioTypography.bodySmall,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
            )
        }
    }
}

@Composable
private fun BackupActionButtons(
    onCreateBackup: () -> Unit,
    onRestoreBackup: () -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        var createFocused by remember { mutableStateOf(false) }
        var restoreFocused by remember { mutableStateOf(false) }

        Button(
            onClick = onCreateBackup,
            modifier = Modifier
                .weight(1f)
                .onFocusChanged { createFocused = it.isFocused }
                .focusable()
                .onKeyEvent { event ->
                    if (event.type == KeyEventType.KeyDown &&
                        (event.key == Key.DirectionCenter || event.key == Key.Enter)
                    ) {
                        onCreateBackup()
                        true
                    } else {
                        false
                    }
                },
            colors = ButtonDefaults.buttonColors(
                containerColor = if (createFocused) MaterialTheme.colorScheme.primary
                else MaterialTheme.colorScheme.primary.copy(alpha = 0.8f)
            ),
            shape = NuvioShapes.medium
        ) {
            Icon(
                imageVector = Icons.Filled.CloudUpload,
                contentDescription = null,
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text("Create Backup", style = NuvioTypography.labelLarge)
        }

        OutlinedButton(
            onClick = onRestoreBackup,
            modifier = Modifier
                .weight(1f)
                .onFocusChanged { restoreFocused = it.isFocused }
                .focusable()
                .onKeyEvent { event ->
                    if (event.type == KeyEventType.KeyDown &&
                        (event.key == Key.DirectionCenter || event.key == Key.Enter)
                    ) {
                        onRestoreBackup()
                        true
                    } else {
                        false
                    }
                },
            shape = NuvioShapes.medium
        ) {
            Icon(
                imageVector = Icons.Filled.CloudDownload,
                contentDescription = null,
                modifier = Modifier.size(20.dp),
                tint = if (restoreFocused) MaterialTheme.colorScheme.primary
                else MaterialTheme.colorScheme.onSurface
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                "Restore Backup",
                style = NuvioTypography.labelLarge,
                color = if (restoreFocused) MaterialTheme.colorScheme.primary
                else MaterialTheme.colorScheme.onSurface
            )
        }
    }
}
