package com.nuvio.tv.ui.screens.player.dialogs

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Headphones
import androidx.compose.material.icons.filled.HighQuality
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material.icons.filled.Subtitles
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.tv.foundation.lazy.list.TvLazyColumn
import androidx.tv.foundation.lazy.list.itemsIndexed
import com.nuvio.tv.domain.model.Subtitle
import com.nuvio.tv.player.AudioTrack
import com.nuvio.tv.player.QualityLevel
import com.nuvio.tv.player.SubtitleTrack
import com.nuvio.tv.ui.theme.NuvioTypography
import java.util.Locale

/**
 * Subtitle selection dialog.
 */
@Composable
fun SubtitleDialog(
    embeddedTracks: List<SubtitleTrack>,
    externalSubtitles: List<Subtitle>,
    selectedEmbeddedIndex: Int,
    selectedExternalIndex: Int,
    onSelectEmbedded: (Int) -> Unit,
    onSelectExternal: (Int) -> Unit,
    onDismiss: () -> Unit
) {
    val focusRequester = remember { FocusRequester() }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.7f))
                .onKeyEvent { event ->
                    if (event.type == KeyEventType.KeyDown && event.key == Key.Back) {
                        onDismiss()
                        true
                    } else false
                },
            contentAlignment = Alignment.CenterEnd
        ) {
            DialogPanel(
                title = "Subtitles",
                icon = Icons.Default.Subtitles,
                onDismiss = onDismiss,
                modifier = Modifier.focusRequester(focusRequester)
            ) {
                // Off option
                DialogItem(
                    label = "Off",
                    isSelected = selectedEmbeddedIndex < 0 && selectedExternalIndex < 0,
                    onClick = {
                        onSelectEmbedded(-1)
                        onDismiss()
                    }
                )

                // Embedded tracks section
                if (embeddedTracks.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(8.dp))
                    SectionHeader("Embedded")
                    embeddedTracks.forEachIndexed { index, track ->
                        DialogItem(
                            label = track.label ?: getLanguageName(track.language) ?: "Track ${index + 1}",
                            subtitle = track.language?.let { getLanguageName(it) },
                            isSelected = selectedEmbeddedIndex == index && selectedExternalIndex < 0,
                            onClick = {
                                onSelectEmbedded(index)
                                onDismiss()
                            }
                        )
                    }
                }

                // External subtitles section
                if (externalSubtitles.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(8.dp))
                    SectionHeader("External")
                    externalSubtitles.forEachIndexed { index, subtitle ->
                        DialogItem(
                            label = subtitle.label ?: getLanguageName(subtitle.lang) ?: subtitle.lang,
                            subtitle = subtitle.format?.uppercase(),
                            isSelected = selectedExternalIndex == index,
                            onClick = {
                                onSelectExternal(index)
                                onDismiss()
                            }
                        )
                    }
                }
            }
        }

        LaunchedEffect(Unit) {
            focusRequester.requestFocus()
        }
    }
}

/**
 * Audio track selection dialog.
 */
@Composable
fun AudioTrackDialog(
    tracks: List<AudioTrack>,
    selectedIndex: Int,
    onSelect: (Int) -> Unit,
    onDismiss: () -> Unit
) {
    val focusRequester = remember { FocusRequester() }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.7f))
                .onKeyEvent { event ->
                    if (event.type == KeyEventType.KeyDown && event.key == Key.Back) {
                        onDismiss()
                        true
                    } else false
                },
            contentAlignment = Alignment.CenterEnd
        ) {
            DialogPanel(
                title = "Audio",
                icon = Icons.Default.Headphones,
                onDismiss = onDismiss,
                modifier = Modifier.focusRequester(focusRequester)
            ) {
                if (tracks.isEmpty()) {
                    Text(
                        text = "No audio tracks available",
                        style = NuvioTypography.bodyMedium,
                        color = Color.White.copy(alpha = 0.6f),
                        modifier = Modifier.padding(16.dp)
                    )
                } else {
                    tracks.forEachIndexed { index, track ->
                        DialogItem(
                            label = track.label ?: getLanguageName(track.language) ?: "Track ${index + 1}",
                            subtitle = track.language?.let { getLanguageName(it) },
                            isSelected = selectedIndex == index || track.isSelected,
                            onClick = {
                                onSelect(index)
                                onDismiss()
                            }
                        )
                    }
                }
            }
        }

        LaunchedEffect(Unit) {
            focusRequester.requestFocus()
        }
    }
}

/**
 * Quality selection dialog.
 */
@Composable
fun QualityDialog(
    levels: List<QualityLevel>,
    selectedIndex: Int,
    onSelect: (Int) -> Unit,
    onDismiss: () -> Unit
) {
    val focusRequester = remember { FocusRequester() }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.7f))
                .onKeyEvent { event ->
                    if (event.type == KeyEventType.KeyDown && event.key == Key.Back) {
                        onDismiss()
                        true
                    } else false
                },
            contentAlignment = Alignment.CenterEnd
        ) {
            DialogPanel(
                title = "Quality",
                icon = Icons.Default.HighQuality,
                onDismiss = onDismiss,
                modifier = Modifier.focusRequester(focusRequester)
            ) {
                // Auto option
                DialogItem(
                    label = "Auto",
                    subtitle = "Best quality for your connection",
                    isSelected = selectedIndex < 0,
                    onClick = {
                        onSelect(-1)
                        onDismiss()
                    }
                )

                if (levels.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(8.dp))
                    HorizontalDivider(color = Color.White.copy(alpha = 0.1f))
                    Spacer(modifier = Modifier.height(8.dp))

                    levels.forEachIndexed { index, level ->
                        DialogItem(
                            label = level.label,
                            subtitle = formatBitrate(level.bitrate),
                            isSelected = selectedIndex == index || level.isSelected,
                            onClick = {
                                onSelect(index)
                                onDismiss()
                            }
                        )
                    }
                }
            }
        }

        LaunchedEffect(Unit) {
            focusRequester.requestFocus()
        }
    }
}

/**
 * Playback speed selection dialog.
 */
@Composable
fun SpeedDialog(
    speeds: List<Float>,
    currentSpeed: Float,
    onSelect: (Float) -> Unit,
    onDismiss: () -> Unit
) {
    val focusRequester = remember { FocusRequester() }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.7f))
                .onKeyEvent { event ->
                    if (event.type == KeyEventType.KeyDown && event.key == Key.Back) {
                        onDismiss()
                        true
                    } else false
                },
            contentAlignment = Alignment.CenterEnd
        ) {
            DialogPanel(
                title = "Playback Speed",
                icon = Icons.Default.Speed,
                onDismiss = onDismiss,
                modifier = Modifier.focusRequester(focusRequester)
            ) {
                speeds.forEach { speed ->
                    DialogItem(
                        label = formatSpeed(speed),
                        isSelected = speed == currentSpeed,
                        onClick = {
                            onSelect(speed)
                            onDismiss()
                        }
                    )
                }
            }
        }

        LaunchedEffect(Unit) {
            focusRequester.requestFocus()
        }
    }
}

/**
 * Dialog panel container.
 */
@Composable
private fun DialogPanel(
    title: String,
    icon: ImageVector,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit
) {
    Column(
        modifier = modifier
            .width(400.dp)
            .fillMaxHeight()
            .background(Color(0xFF1A1A1A))
            .padding(vertical = 24.dp)
    ) {
        // Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(28.dp)
            )
            Spacer(modifier = Modifier.width(12.dp))
            Text(
                text = title,
                style = NuvioTypography.headlineSmall,
                color = Color.White,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.weight(1f)
            )
            CloseButton(onClick = onDismiss)
        }

        Spacer(modifier = Modifier.height(16.dp))
        HorizontalDivider(color = Color.White.copy(alpha = 0.1f))
        Spacer(modifier = Modifier.height(8.dp))

        // Content
        TvLazyColumn(
            modifier = Modifier.fillMaxWidth(),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            item { content() }
        }
    }
}

/**
 * Section header within dialog.
 */
@Composable
private fun SectionHeader(title: String) {
    Text(
        text = title.uppercase(),
        style = NuvioTypography.labelSmall,
        color = MaterialTheme.colorScheme.primary,
        fontWeight = FontWeight.Bold,
        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
    )
}

/**
 * Dialog list item.
 */
@Composable
private fun DialogItem(
    label: String,
    subtitle: String? = null,
    isSelected: Boolean = false,
    onClick: () -> Unit
) {
    var isFocused by remember { mutableStateOf(false) }

    val backgroundColor by animateColorAsState(
        targetValue = when {
            isFocused -> MaterialTheme.colorScheme.primary
            isSelected -> MaterialTheme.colorScheme.primary.copy(alpha = 0.2f)
            else -> Color.Transparent
        },
        animationSpec = tween(150),
        label = "itemBg"
    )

    val textColor by animateColorAsState(
        targetValue = when {
            isFocused -> Color.Black
            else -> Color.White
        },
        animationSpec = tween(150),
        label = "itemText"
    )

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(backgroundColor)
            .onFocusChanged { isFocused = it.isFocused }
            .focusable()
            .onKeyEvent { event ->
                if (event.type == KeyEventType.KeyDown &&
                    (event.key == Key.DirectionCenter || event.key == Key.Enter)
                ) {
                    onClick()
                    true
                } else false
            }
            .padding(horizontal = 12.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = label,
                style = NuvioTypography.bodyLarge,
                color = textColor,
                fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal
            )
            subtitle?.let {
                Text(
                    text = it,
                    style = NuvioTypography.bodySmall,
                    color = textColor.copy(alpha = 0.7f)
                )
            }
        }

        if (isSelected) {
            Icon(
                imageVector = Icons.Default.Check,
                contentDescription = "Selected",
                tint = if (isFocused) Color.Black else MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(20.dp)
            )
        }
    }
}

/**
 * Close button for dialog.
 */
@Composable
private fun CloseButton(onClick: () -> Unit) {
    var isFocused by remember { mutableStateOf(false) }

    val backgroundColor by animateColorAsState(
        targetValue = if (isFocused) MaterialTheme.colorScheme.primary else Color.Transparent,
        animationSpec = tween(150),
        label = "closeBg"
    )

    Box(
        modifier = Modifier
            .size(36.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(backgroundColor)
            .onFocusChanged { isFocused = it.isFocused }
            .focusable()
            .onKeyEvent { event ->
                if (event.type == KeyEventType.KeyDown &&
                    (event.key == Key.DirectionCenter || event.key == Key.Enter)
                ) {
                    onClick()
                    true
                } else false
            },
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = Icons.Default.Close,
            contentDescription = "Close",
            tint = if (isFocused) Color.Black else Color.White,
            modifier = Modifier.size(20.dp)
        )
    }
}

// Helper functions

private fun getLanguageName(code: String?): String? {
    if (code == null) return null
    return try {
        Locale(code).displayLanguage
    } catch (e: Exception) {
        code
    }
}

private fun formatBitrate(bitrate: Int): String {
    return when {
        bitrate >= 1_000_000 -> String.format("%.1f Mbps", bitrate / 1_000_000.0)
        bitrate >= 1_000 -> String.format("%.0f Kbps", bitrate / 1_000.0)
        else -> "$bitrate bps"
    }
}

private fun formatSpeed(speed: Float): String {
    return when (speed) {
        1f -> "Normal"
        else -> "${speed}x"
    }
}
