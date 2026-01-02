package com.nuvio.tv.ui.screens.settings.debrid

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Cloud
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material.icons.automirrored.filled.Sort
import androidx.compose.material.icons.filled.Storage
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.tv.foundation.lazy.list.TvLazyColumn
import com.nuvio.tv.domain.model.TorBoxUser
import com.nuvio.tv.ui.screens.settings.content.SettingsHeader
import com.nuvio.tv.ui.screens.settings.content.SettingsSectionHeader
import com.nuvio.tv.ui.theme.NuvioShapes
import com.nuvio.tv.ui.theme.NuvioTypography

/**
 * Debrid Integration settings screen.
 * Allows users to connect TorBox for premium stream resolution.
 */
@Composable
fun DebridIntegrationScreen(
    viewModel: DebridViewModel = hiltViewModel(),
    onBackClick: () -> Unit = {}
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
                title = "Debrid Integration",
                onBackClick = onBackClick
            )

            Spacer(modifier = Modifier.height(24.dp))

            if (uiState.isLoading) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                }
            } else {
                TvLazyColumn(
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    // TorBox Section
                    item {
                        SettingsSectionHeader(title = "TORBOX")
                    }

                    item {
                        if (uiState.torBoxConfig.isConnected) {
                            TorBoxConnectedCard(
                                user = uiState.torBoxUser,
                                isEnabled = uiState.torBoxConfig.isEnabled,
                                onEnabledChange = { viewModel.setTorBoxEnabled(it) },
                                onDisconnectClick = { viewModel.showDisconnectDialog() },
                                onRefreshClick = { viewModel.refreshTorBoxUser() }
                            )
                        } else {
                            TorBoxConnectCard(
                                apiKey = uiState.torBoxApiKeyInput,
                                onApiKeyChange = { viewModel.updateTorBoxApiKey(it) },
                                onConnectClick = { viewModel.connectTorBox() },
                                isLoading = uiState.isLoading,
                                error = uiState.error
                            )
                        }
                    }

                    // Stream Sort Settings Section
                    item {
                        Spacer(modifier = Modifier.height(16.dp))
                        SettingsSectionHeader(title = "STREAM SETTINGS")
                    }

                    item {
                        StreamSortSettingsCard(
                            currentSortMode = uiState.streamSortMode,
                            onSortModeChange = { viewModel.setStreamSortMode(it) }
                        )
                    }

                    // Info Section
                    item {
                        Spacer(modifier = Modifier.height(8.dp))
                        DebridInfoCard()
                    }
                }
            }
        }

        // Disconnect confirmation dialog
        if (uiState.showDisconnectDialog) {
            AlertDialog(
                onDismissRequest = { viewModel.hideDisconnectDialog() },
                title = { Text("Disconnect TorBox?") },
                text = { Text("This will remove the TorBox addon and disconnect your account.") },
                confirmButton = {
                    TextButton(onClick = { viewModel.disconnectTorBox() }) {
                        Text("Disconnect", color = MaterialTheme.colorScheme.error)
                    }
                },
                dismissButton = {
                    TextButton(onClick = { viewModel.hideDisconnectDialog() }) {
                        Text("Cancel")
                    }
                }
            )
        }
    }
}

@Composable
private fun TorBoxConnectCard(
    apiKey: String,
    onApiKeyChange: (String) -> Unit,
    onConnectClick: () -> Unit,
    isLoading: Boolean,
    error: String?
) {
    var inputFocused by remember { mutableStateOf(false) }
    var buttonFocused by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(NuvioShapes.medium)
            .background(MaterialTheme.colorScheme.surface)
            .padding(24.dp)
    ) {
        // Header
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Filled.Cloud,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(24.dp)
                )
            }

            Spacer(modifier = Modifier.width(16.dp))

            Column {
                Text(
                    text = "Connect TorBox",
                    style = NuvioTypography.titleLarge,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Text(
                    text = "Premium debrid service for instant streaming",
                    style = NuvioTypography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                )
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // API Key Input
        Text(
            text = "API Key",
            style = NuvioTypography.labelMedium,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
        )

        Spacer(modifier = Modifier.height(8.dp))

        BasicTextField(
            value = apiKey,
            onValueChange = onApiKeyChange,
            modifier = Modifier
                .fillMaxWidth()
                .clip(NuvioShapes.small)
                .background(MaterialTheme.colorScheme.surfaceVariant)
                .border(
                    width = 2.dp,
                    color = if (inputFocused) MaterialTheme.colorScheme.primary
                    else if (error != null) MaterialTheme.colorScheme.error
                    else MaterialTheme.colorScheme.outline.copy(alpha = 0.3f),
                    shape = NuvioShapes.small
                )
                .onFocusChanged { inputFocused = it.isFocused }
                .focusable()
                .padding(16.dp),
            textStyle = TextStyle(
                color = MaterialTheme.colorScheme.onSurface,
                fontSize = NuvioTypography.bodyMedium.fontSize
            ),
            cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            decorationBox = { innerTextField ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Filled.Key,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Box {
                        if (apiKey.isEmpty()) {
                            Text(
                                text = "Enter your TorBox API key",
                                style = NuvioTypography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f)
                            )
                        }
                        innerTextField()
                    }
                }
            }
        )

        // Error message
        if (error != null) {
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = error,
                style = NuvioTypography.bodySmall,
                color = MaterialTheme.colorScheme.error
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "Get your API key from torbox.app/settings",
            style = NuvioTypography.bodySmall,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Connect Button
        Button(
            onClick = onConnectClick,
            enabled = apiKey.isNotBlank() && !isLoading,
            modifier = Modifier
                .fillMaxWidth()
                .onFocusChanged { buttonFocused = it.isFocused }
                .focusable()
                .onKeyEvent { event ->
                    if (event.type == KeyEventType.KeyDown &&
                        (event.key == Key.DirectionCenter || event.key == Key.Enter) &&
                        apiKey.isNotBlank() && !isLoading
                    ) {
                        onConnectClick()
                        true
                    } else {
                        false
                    }
                },
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary
            ),
            shape = NuvioShapes.medium
        ) {
            if (isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    strokeWidth = 2.dp,
                    color = MaterialTheme.colorScheme.onPrimary
                )
            } else {
                Icon(
                    imageVector = Icons.Filled.Cloud,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp)
                )
            }
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = if (isLoading) "Connecting..." else "Connect & Install",
                style = NuvioTypography.labelLarge
            )
        }
    }
}

@Composable
private fun TorBoxConnectedCard(
    user: TorBoxUser?,
    isEnabled: Boolean,
    onEnabledChange: (Boolean) -> Unit,
    onDisconnectClick: () -> Unit,
    onRefreshClick: () -> Unit
) {
    var enabledFocused by remember { mutableStateOf(false) }
    var disconnectFocused by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(NuvioShapes.medium)
            .background(MaterialTheme.colorScheme.surface)
            .padding(24.dp)
    ) {
        // Connected Status Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.15f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Filled.Check,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(24.dp)
                    )
                }

                Spacer(modifier = Modifier.width(16.dp))

                Column {
                    Text(
                        text = "TorBox Connected",
                        style = NuvioTypography.titleLarge,
                        color = MaterialTheme.colorScheme.primary
                    )
                    Text(
                        text = user?.email ?: "Loading...",
                        style = NuvioTypography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                    )
                }
            }

            // Enable/Disable Switch
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .clip(NuvioShapes.small)
                    .background(
                        if (enabledFocused) MaterialTheme.colorScheme.primary.copy(alpha = 0.15f)
                        else MaterialTheme.colorScheme.surfaceVariant
                    )
                    .onFocusChanged { enabledFocused = it.isFocused }
                    .focusable()
                    .onKeyEvent { event ->
                        if (event.type == KeyEventType.KeyDown &&
                            (event.key == Key.DirectionCenter || event.key == Key.Enter)
                        ) {
                            onEnabledChange(!isEnabled)
                            true
                        } else {
                            false
                        }
                    }
                    .padding(horizontal = 12.dp, vertical = 8.dp)
            ) {
                Text(
                    text = if (isEnabled) "Enabled" else "Disabled",
                    style = NuvioTypography.labelMedium,
                    color = if (enabledFocused) MaterialTheme.colorScheme.primary
                    else MaterialTheme.colorScheme.onSurface
                )
                Spacer(modifier = Modifier.width(8.dp))
                Switch(
                    checked = isEnabled,
                    onCheckedChange = null,
                    colors = SwitchDefaults.colors(
                        checkedThumbColor = MaterialTheme.colorScheme.primary,
                        checkedTrackColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.5f)
                    )
                )
            }
        }

        // Account Info
        if (user != null) {
            Spacer(modifier = Modifier.height(24.dp))

            // Account details grid
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                AccountInfoItem(
                    icon = Icons.Filled.Person,
                    label = "Plan",
                    value = user.plan.displayName,
                    modifier = Modifier.weight(1f)
                )
                AccountInfoItem(
                    icon = Icons.Filled.Speed,
                    label = "Status",
                    value = user.accountStatus,
                    modifier = Modifier.weight(1f)
                )
                AccountInfoItem(
                    icon = Icons.Filled.Storage,
                    label = "Downloaded",
                    value = user.formattedDownloaded,
                    modifier = Modifier.weight(1f)
                )
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Disconnect Button
        OutlinedButton(
            onClick = onDisconnectClick,
            modifier = Modifier
                .fillMaxWidth()
                .onFocusChanged { disconnectFocused = it.isFocused }
                .focusable()
                .onKeyEvent { event ->
                    if (event.type == KeyEventType.KeyDown &&
                        (event.key == Key.DirectionCenter || event.key == Key.Enter)
                    ) {
                        onDisconnectClick()
                        true
                    } else {
                        false
                    }
                },
            shape = NuvioShapes.medium,
            colors = ButtonDefaults.outlinedButtonColors(
                contentColor = if (disconnectFocused) MaterialTheme.colorScheme.error
                else MaterialTheme.colorScheme.onSurface
            )
        ) {
            Text(
                text = "Disconnect & Remove",
                style = NuvioTypography.labelLarge
            )
        }
    }
}

@Composable
private fun AccountInfoItem(
    icon: ImageVector,
    label: String,
    value: String,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .clip(NuvioShapes.small)
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(24.dp)
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = label,
            style = NuvioTypography.labelSmall,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = value,
            style = NuvioTypography.titleMedium,
            color = MaterialTheme.colorScheme.onSurface
        )
    }
}

@Composable
private fun DebridInfoCard() {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(NuvioShapes.medium)
            .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.08f))
            .padding(24.dp)
    ) {
        Text(
            text = "What is a Debrid Service?",
            style = NuvioTypography.titleMedium,
            color = MaterialTheme.colorScheme.primary
        )

        Spacer(modifier = Modifier.height(12.dp))

        Text(
            text = "A debrid service provides instant access to cached torrents without waiting for downloads. Benefits include:",
            style = NuvioTypography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f)
        )

        Spacer(modifier = Modifier.height(12.dp))

        val benefits = listOf(
            "Instant streaming of cached content",
            "High-speed premium servers",
            "No need to wait for torrent downloads",
            "Access to more sources and higher quality"
        )

        benefits.forEach { benefit ->
            Row(
                modifier = Modifier.padding(vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(6.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primary)
                )
                Spacer(modifier = Modifier.width(12.dp))
                Text(
                    text = benefit,
                    style = NuvioTypography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                )
            }
        }
    }
}

@Composable
private fun StreamSortSettingsCard(
    currentSortMode: String,
    onSortModeChange: (String) -> Unit
) {
    val sortOptions = listOf(
        "addon_order" to "Addon Order (Recommended)",
        "quality" to "Quality (4K > 1080p > 720p)",
        "size" to "File Size (Largest first)",
        "addon" to "Addon Name (Alphabetically)"
    )

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(NuvioShapes.medium)
            .background(MaterialTheme.colorScheme.surface)
            .padding(24.dp)
    ) {
        // Header
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.Sort,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(24.dp)
                )
            }

            Spacer(modifier = Modifier.width(16.dp))

            Column {
                Text(
                    text = "Sort Streams By",
                    style = NuvioTypography.titleLarge,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Text(
                    text = "Choose how streams are sorted. Instant streams always appear first.",
                    style = NuvioTypography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                )
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Sort Options
        sortOptions.forEach { (mode, label) ->
            var optionFocused by remember { mutableStateOf(false) }
            val isSelected = currentSortMode == mode

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(NuvioShapes.small)
                    .background(
                        when {
                            isSelected -> MaterialTheme.colorScheme.primary.copy(alpha = 0.15f)
                            optionFocused -> MaterialTheme.colorScheme.surfaceVariant
                            else -> MaterialTheme.colorScheme.surface
                        }
                    )
                    .border(
                        width = if (optionFocused) 2.dp else 1.dp,
                        color = when {
                            isSelected && optionFocused -> MaterialTheme.colorScheme.primary
                            optionFocused -> MaterialTheme.colorScheme.primary
                            isSelected -> MaterialTheme.colorScheme.primary.copy(alpha = 0.5f)
                            else -> MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)
                        },
                        shape = NuvioShapes.small
                    )
                    .onFocusChanged { optionFocused = it.isFocused }
                    .focusable()
                    .onKeyEvent { event ->
                        if (event.type == KeyEventType.KeyDown &&
                            (event.key == Key.DirectionCenter || event.key == Key.Enter)
                        ) {
                            onSortModeChange(mode)
                            true
                        } else {
                            false
                        }
                    }
                    .padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = label,
                    style = NuvioTypography.bodyMedium,
                    color = if (isSelected) MaterialTheme.colorScheme.primary
                    else MaterialTheme.colorScheme.onSurface
                )

                if (isSelected) {
                    Icon(
                        imageVector = Icons.Filled.Check,
                        contentDescription = "Selected",
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))
        }
    }
}
