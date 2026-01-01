package com.nuvio.tv.ui.screens.settings.addons

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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowDownward
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Extension
import androidx.compose.material.icons.filled.Movie
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Stream
import androidx.compose.material.icons.filled.Subtitles
import androidx.compose.material.icons.filled.Tv
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.tv.foundation.lazy.list.TvLazyColumn
import androidx.tv.foundation.lazy.list.itemsIndexed
import coil.compose.AsyncImage
import com.nuvio.tv.domain.model.Addon
import com.nuvio.tv.ui.theme.NuvioShapes
import com.nuvio.tv.ui.theme.NuvioTypography

/**
 * Settings screen for managing Stremio addons.
 */
@Composable
fun AddonsSettingsScreen(
    viewModel: AddonsSettingsViewModel = hiltViewModel(),
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
            // Header with back button
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
                    text = "Addons",
                    style = NuvioTypography.headlineLarge,
                    color = MaterialTheme.colorScheme.onBackground,
                    modifier = Modifier.weight(1f)
                )

                // Install addon button
                var addFocused by remember { mutableStateOf(false) }

                Button(
                    onClick = { viewModel.showInstallDialog() },
                    modifier = Modifier
                        .onFocusChanged { addFocused = it.isFocused }
                        .focusable()
                        .onKeyEvent { event ->
                            if (event.type == KeyEventType.KeyDown &&
                                (event.key == Key.DirectionCenter || event.key == Key.Enter)
                            ) {
                                viewModel.showInstallDialog()
                                true
                            } else {
                                false
                            }
                        },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (addFocused) MaterialTheme.colorScheme.primary
                        else MaterialTheme.colorScheme.primary.copy(alpha = 0.8f)
                    ),
                    shape = NuvioShapes.full
                ) {
                    Icon(
                        imageVector = Icons.Filled.Add,
                        contentDescription = null,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Install Addon", style = NuvioTypography.labelLarge)
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            when {
                uiState.isLoading -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                    }
                }

                uiState.addons.isEmpty() -> {
                    EmptyAddonsState(
                        onInstallDefaults = { viewModel.installDefaultAddons() },
                        isInstalling = uiState.isInstalling
                    )
                }

                else -> {
                    AddonsList(
                        addons = uiState.addons,
                        onMoveUp = { viewModel.moveAddonUp(it) },
                        onMoveDown = { viewModel.moveAddonDown(it) },
                        onRemove = { viewModel.removeAddon(it) }
                    )
                }
            }
        }

        // Install dialog
        if (uiState.showInstallDialog) {
            InstallAddonDialog(
                url = uiState.addonUrlInput,
                onUrlChange = { viewModel.updateAddonUrl(it) },
                onInstall = { viewModel.installAddon(uiState.addonUrlInput) },
                onDismiss = { viewModel.hideInstallDialog() },
                isInstalling = uiState.isInstalling,
                error = uiState.installError
            )
        }
    }
}

@Composable
private fun EmptyAddonsState(
    onInstallDefaults: () -> Unit,
    isInstalling: Boolean
) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(48.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .clip(RoundedCornerShape(40.dp))
                    .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.1f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Filled.Extension,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(40.dp)
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            Text(
                text = "No Addons Installed",
                style = NuvioTypography.headlineMedium,
                color = MaterialTheme.colorScheme.onBackground
            )

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = "Addons provide content catalogs, metadata, streams, and subtitles.\nInstall the recommended addons to get started.",
                style = NuvioTypography.bodyMedium,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f),
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(32.dp))

            var buttonFocused by remember { mutableStateOf(false) }

            Button(
                onClick = onInstallDefaults,
                enabled = !isInstalling,
                modifier = Modifier
                    .onFocusChanged { buttonFocused = it.isFocused }
                    .focusable()
                    .onKeyEvent { event ->
                        if (event.type == KeyEventType.KeyDown &&
                            (event.key == Key.DirectionCenter || event.key == Key.Enter) &&
                            !isInstalling
                        ) {
                            onInstallDefaults()
                            true
                        } else {
                            false
                        }
                    },
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary
                ),
                shape = NuvioShapes.full
            ) {
                if (isInstalling) {
                    CircularProgressIndicator(
                        color = MaterialTheme.colorScheme.onPrimary,
                        modifier = Modifier.size(20.dp),
                        strokeWidth = 2.dp
                    )
                } else {
                    Icon(
                        imageVector = Icons.Filled.Add,
                        contentDescription = null,
                        modifier = Modifier.size(20.dp)
                    )
                }
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = if (isInstalling) "Installing..." else "Install Recommended Addons",
                    style = NuvioTypography.labelLarge
                )
            }
        }
    }
}

@Composable
private fun AddonsList(
    addons: List<Addon>,
    onMoveUp: (String) -> Unit,
    onMoveDown: (String) -> Unit,
    onRemove: (String) -> Unit
) {
    TvLazyColumn(
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        itemsIndexed(
            items = addons,
            key = { _, addon -> addon.id }
        ) { index, addon ->
            AddonListItem(
                addon = addon,
                canMoveUp = index > 0,
                canMoveDown = index < addons.size - 1,
                onMoveUp = { onMoveUp(addon.id) },
                onMoveDown = { onMoveDown(addon.id) },
                onRemove = { onRemove(addon.id) }
            )
        }
    }
}

@Composable
private fun AddonListItem(
    addon: Addon,
    canMoveUp: Boolean,
    canMoveDown: Boolean,
    onMoveUp: () -> Unit,
    onMoveDown: () -> Unit,
    onRemove: () -> Unit
) {
    var isFocused by remember { mutableStateOf(false) }
    var showDeleteConfirm by remember { mutableStateOf(false) }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(NuvioShapes.medium)
            .background(
                if (isFocused) MaterialTheme.colorScheme.primary.copy(alpha = 0.15f)
                else MaterialTheme.colorScheme.surface
            )
            .onFocusChanged { isFocused = it.isFocused }
            .focusable()
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Addon logo
        Box(
            modifier = Modifier
                .size(56.dp)
                .clip(NuvioShapes.small)
                .background(MaterialTheme.colorScheme.surfaceVariant),
            contentAlignment = Alignment.Center
        ) {
            if (addon.logo != null) {
                AsyncImage(
                    model = addon.logo,
                    contentDescription = addon.name,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Fit
                )
            } else {
                Icon(
                    imageVector = Icons.Filled.Extension,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(28.dp)
                )
            }
        }

        Spacer(modifier = Modifier.width(16.dp))

        // Addon info
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = addon.name,
                style = NuvioTypography.titleMedium,
                color = if (isFocused) MaterialTheme.colorScheme.primary
                else MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )

            Spacer(modifier = Modifier.height(4.dp))

            // Version and capabilities
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "v${addon.version}",
                    style = NuvioTypography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                )

                // Capability badges
                if (addon.providesCatalogs) {
                    CapabilityBadge(icon = Icons.Filled.Movie, label = "Catalog")
                }
                if (addon.providesMeta) {
                    CapabilityBadge(icon = Icons.Filled.Tv, label = "Meta")
                }
                if (addon.providesStreams) {
                    CapabilityBadge(icon = Icons.Filled.Stream, label = "Streams")
                }
                if (addon.providesSubtitles) {
                    CapabilityBadge(icon = Icons.Filled.Subtitles, label = "Subs")
                }
                if (addon.supportsSearch) {
                    CapabilityBadge(icon = Icons.Filled.Search, label = "Search")
                }
            }

            if (addon.description != null) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = addon.description,
                    style = NuvioTypography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }

        Spacer(modifier = Modifier.width(16.dp))

        // Action buttons (only visible when focused)
        if (isFocused) {
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                if (canMoveUp) {
                    ActionIconButton(
                        icon = Icons.Filled.ArrowUpward,
                        contentDescription = "Move up",
                        onClick = onMoveUp
                    )
                }
                if (canMoveDown) {
                    ActionIconButton(
                        icon = Icons.Filled.ArrowDownward,
                        contentDescription = "Move down",
                        onClick = onMoveDown
                    )
                }
                ActionIconButton(
                    icon = Icons.Filled.Delete,
                    contentDescription = "Remove",
                    onClick = { showDeleteConfirm = true },
                    isDestructive = true
                )
            }
        }
    }

    // Delete confirmation dialog
    if (showDeleteConfirm) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = false },
            title = { Text("Remove Addon?") },
            text = { Text("Are you sure you want to remove ${addon.name}?") },
            confirmButton = {
                TextButton(
                    onClick = {
                        showDeleteConfirm = false
                        onRemove()
                    }
                ) {
                    Text("Remove", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirm = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}

@Composable
private fun CapabilityBadge(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String
) {
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(4.dp))
            .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.1f))
            .padding(horizontal = 6.dp, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(12.dp)
        )
        Text(
            text = label,
            style = NuvioTypography.labelSmall,
            color = MaterialTheme.colorScheme.primary
        )
    }
}

@Composable
private fun ActionIconButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    contentDescription: String,
    onClick: () -> Unit,
    isDestructive: Boolean = false
) {
    var isFocused by remember { mutableStateOf(false) }
    val color = if (isDestructive) MaterialTheme.colorScheme.error
    else MaterialTheme.colorScheme.primary

    IconButton(
        onClick = onClick,
        modifier = Modifier
            .onFocusChanged { isFocused = it.isFocused }
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
            .background(
                if (isFocused) color.copy(alpha = 0.15f) else MaterialTheme.colorScheme.surface,
                shape = NuvioShapes.small
            )
            .size(40.dp)
    ) {
        Icon(
            imageVector = icon,
            contentDescription = contentDescription,
            tint = if (isFocused) color else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
            modifier = Modifier.size(20.dp)
        )
    }
}

@Composable
private fun InstallAddonDialog(
    url: String,
    onUrlChange: (String) -> Unit,
    onInstall: () -> Unit,
    onDismiss: () -> Unit,
    isInstalling: Boolean,
    error: String?
) {
    AlertDialog(
        onDismissRequest = { if (!isInstalling) onDismiss() },
        title = { Text("Install Addon") },
        text = {
            Column {
                Text(
                    text = "Enter the addon manifest URL:",
                    style = NuvioTypography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                )

                Spacer(modifier = Modifier.height(16.dp))

                BasicTextField(
                    value = url,
                    onValueChange = onUrlChange,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(NuvioShapes.small)
                        .background(MaterialTheme.colorScheme.surfaceVariant)
                        .border(
                            width = 1.dp,
                            color = if (error != null) MaterialTheme.colorScheme.error
                            else MaterialTheme.colorScheme.outline,
                            shape = NuvioShapes.small
                        )
                        .padding(12.dp),
                    textStyle = TextStyle(
                        color = MaterialTheme.colorScheme.onSurface,
                        fontSize = NuvioTypography.bodyMedium.fontSize
                    ),
                    cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
                    singleLine = true,
                    enabled = !isInstalling
                )

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
                    text = "Example: https://v3-cinemeta.strem.io/manifest.json",
                    style = NuvioTypography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                )
            }
        },
        confirmButton = {
            Button(
                onClick = onInstall,
                enabled = !isInstalling && url.isNotBlank()
            ) {
                if (isInstalling) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(16.dp),
                        strokeWidth = 2.dp,
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                }
                Text(if (isInstalling) "Installing..." else "Install")
            }
        },
        dismissButton = {
            if (!isInstalling) {
                OutlinedButton(onClick = onDismiss) {
                    Text("Cancel")
                }
            }
        }
    )
}
