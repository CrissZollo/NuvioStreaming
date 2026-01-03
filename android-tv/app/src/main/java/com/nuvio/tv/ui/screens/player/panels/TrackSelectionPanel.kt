package com.nuvio.tv.ui.screens.player.panels

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
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
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.unit.dp
import com.nuvio.tv.domain.model.Subtitle
import com.nuvio.tv.player.engine.EngineAudioTrack
import com.nuvio.tv.player.engine.EngineQualityLevel
import com.nuvio.tv.player.engine.EngineSubtitleTrack
import com.nuvio.tv.ui.theme.NuvioShapes
import com.nuvio.tv.ui.theme.NuvioTypography

/**
 * Type of track selection panel.
 */
enum class TrackPanelType {
    SUBTITLE,
    AUDIO,
    QUALITY,
    SPEED
}

/**
 * Slide-in panel for track selection.
 * Supports both embedded subtitle tracks and external subtitles from addons.
 */
@Composable
fun TrackSelectionPanel(
    visible: Boolean,
    panelType: TrackPanelType,
    // Embedded subtitle options
    subtitleTracks: List<EngineSubtitleTrack> = emptyList(),
    selectedSubtitleIndex: Int = -1,
    // External subtitle options (from addons)
    externalSubtitles: List<Subtitle> = emptyList(),
    selectedExternalSubtitleIndex: Int = -1,
    // Audio options
    audioTracks: List<EngineAudioTrack> = emptyList(),
    selectedAudioIndex: Int = -1,
    // Quality options
    qualityLevels: List<EngineQualityLevel> = emptyList(),
    selectedQualityIndex: Int = -1,
    // Speed options
    availableSpeeds: List<Float> = listOf(0.5f, 0.75f, 1f, 1.25f, 1.5f, 2f),
    currentSpeed: Float = 1f,
    // Callbacks
    onSubtitleSelect: (Int) -> Unit = {},
    onExternalSubtitleSelect: (Int) -> Unit = {},
    onAudioSelect: (Int) -> Unit = {},
    onQualitySelect: (Int) -> Unit = {},
    onSpeedSelect: (Float) -> Unit = {},
    onDismiss: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val focusRequester = remember { FocusRequester() }

    AnimatedVisibility(
        visible = visible,
        enter = slideInHorizontally(initialOffsetX = { it }),
        exit = slideOutHorizontally(targetOffsetX = { it }),
        modifier = modifier
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .onKeyEvent { event ->
                    if (event.type == KeyEventType.KeyDown && event.key == Key.Back) {
                        onDismiss()
                        true
                    } else {
                        false
                    }
                }
        ) {
            // Semi-transparent backdrop
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.5f))
            )

            // Panel content
            Box(
                modifier = Modifier
                    .fillMaxHeight()
                    .width(400.dp)
                    .align(Alignment.CenterEnd)
                    .background(
                        Brush.horizontalGradient(
                            colors = listOf(
                                Color(0xE6121212),
                                Color(0xFF121212)
                            )
                        )
                    )
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(vertical = 32.dp)
                ) {
                    // Header
                    PanelHeader(
                        panelType = panelType,
                        onClose = onDismiss
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    HorizontalDivider(
                        color = Color.White.copy(alpha = 0.1f),
                        modifier = Modifier.padding(horizontal = 24.dp)
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    // Content based on panel type
                    when (panelType) {
                        TrackPanelType.SUBTITLE -> {
                            SubtitleList(
                                embeddedTracks = subtitleTracks,
                                selectedEmbeddedIndex = selectedSubtitleIndex,
                                externalSubtitles = externalSubtitles,
                                selectedExternalIndex = selectedExternalSubtitleIndex,
                                focusRequester = focusRequester,
                                onEmbeddedSelect = onSubtitleSelect,
                                onExternalSelect = onExternalSubtitleSelect
                            )
                        }
                        TrackPanelType.AUDIO -> {
                            AudioList(
                                tracks = audioTracks,
                                selectedIndex = selectedAudioIndex,
                                focusRequester = focusRequester,
                                onSelect = onAudioSelect
                            )
                        }
                        TrackPanelType.QUALITY -> {
                            QualityList(
                                levels = qualityLevels,
                                selectedIndex = selectedQualityIndex,
                                focusRequester = focusRequester,
                                onSelect = onQualitySelect
                            )
                        }
                        TrackPanelType.SPEED -> {
                            SpeedList(
                                speeds = availableSpeeds,
                                currentSpeed = currentSpeed,
                                focusRequester = focusRequester,
                                onSelect = onSpeedSelect
                            )
                        }
                    }
                }
            }
        }
    }

    // Request focus when panel becomes visible
    LaunchedEffect(visible) {
        if (visible) {
            focusRequester.requestFocus()
        }
    }
}

@Composable
private fun PanelHeader(
    panelType: TrackPanelType,
    onClose: () -> Unit
) {
    val (icon, title) = when (panelType) {
        TrackPanelType.SUBTITLE -> Icons.Filled.Subtitles to "Subtitles"
        TrackPanelType.AUDIO -> Icons.Filled.Headphones to "Audio"
        TrackPanelType.QUALITY -> Icons.Filled.HighQuality to "Quality"
        TrackPanelType.SPEED -> Icons.Filled.Speed to "Playback Speed"
    }

    Row(
        modifier = Modifier
            .padding(horizontal = 24.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(28.dp),
            tint = MaterialTheme.colorScheme.primary
        )
        Spacer(modifier = Modifier.width(12.dp))
        Text(
            text = title,
            style = NuvioTypography.headlineSmall,
            color = Color.White,
            modifier = Modifier.weight(1f)
        )
        CloseButton(onClick = onClose)
    }
}

@Composable
private fun CloseButton(
    onClick: () -> Unit
) {
    var isFocused by remember { mutableStateOf(false) }

    Box(
        modifier = Modifier
            .size(40.dp)
            .clip(NuvioShapes.playerButton)
            .background(
                if (isFocused) MaterialTheme.colorScheme.primary
                else Color.White.copy(alpha = 0.1f)
            )
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
            },
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = Icons.Filled.Close,
            contentDescription = "Close",
            modifier = Modifier.size(24.dp),
            tint = if (isFocused) Color.Black else Color.White
        )
    }
}

@Composable
private fun SubtitleList(
    embeddedTracks: List<EngineSubtitleTrack>,
    selectedEmbeddedIndex: Int,
    externalSubtitles: List<Subtitle>,
    selectedExternalIndex: Int,
    focusRequester: FocusRequester,
    onEmbeddedSelect: (Int) -> Unit,
    onExternalSelect: (Int) -> Unit
) {
    val listState = rememberLazyListState()
    val hasEmbedded = embeddedTracks.isNotEmpty()
    val hasExternal = externalSubtitles.isNotEmpty()

    // Determine if "Off" should be focused (no subtitle selected)
    val isOffSelected = selectedEmbeddedIndex == -1 && selectedExternalIndex == -1

    LazyColumn(
        state = listState,
        contentPadding = PaddingValues(horizontal = 24.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        // Off option
        item {
            TrackItem(
                label = "Off",
                isSelected = isOffSelected,
                focusRequester = if (isOffSelected) focusRequester else null,
                onClick = {
                    onEmbeddedSelect(-1)
                    onExternalSelect(-1)
                }
            )
        }

        // Embedded tracks section
        if (hasEmbedded) {
            item {
                SectionHeader(title = "Embedded")
            }

            itemsIndexed(embeddedTracks) { index, track ->
                TrackItem(
                    label = track.label ?: track.language ?: "Track ${index + 1}",
                    subtitle = buildSubtitleInfo(track),
                    isSelected = index == selectedEmbeddedIndex,
                    focusRequester = if (index == selectedEmbeddedIndex) focusRequester
                                     else if (isOffSelected && index == 0 && !hasExternal) focusRequester
                                     else null,
                    onClick = {
                        onExternalSelect(-1) // Deselect external
                        onEmbeddedSelect(index)
                    }
                )
            }
        }

        // External subtitles section (from addons)
        if (hasExternal) {
            item {
                SectionHeader(title = "External")
            }

            itemsIndexed(externalSubtitles) { index, subtitle ->
                TrackItem(
                    label = subtitle.label ?: subtitle.lang,
                    subtitle = buildExternalSubtitleInfo(subtitle),
                    isSelected = index == selectedExternalIndex,
                    focusRequester = if (index == selectedExternalIndex) focusRequester
                                     else if (isOffSelected && index == 0 && !hasEmbedded) focusRequester
                                     else null,
                    onClick = {
                        onEmbeddedSelect(-1) // Deselect embedded
                        onExternalSelect(index)
                    }
                )
            }
        }
    }
}

@Composable
private fun SectionHeader(title: String) {
    Text(
        text = title.uppercase(),
        style = NuvioTypography.labelSmall,
        color = Color.White.copy(alpha = 0.5f),
        modifier = Modifier.padding(vertical = 8.dp, horizontal = 16.dp)
    )
}

private fun buildExternalSubtitleInfo(subtitle: Subtitle): String? {
    val parts = mutableListOf<String>()
    subtitle.format?.let { parts.add(it.uppercase()) }
    if (subtitle.lang != subtitle.label) {
        parts.add(subtitle.lang.uppercase())
    }
    return if (parts.isNotEmpty()) parts.joinToString(" • ") else null
}

private fun buildSubtitleInfo(track: EngineSubtitleTrack): String? {
    val parts = mutableListOf<String>()
    track.language?.let { if (it != track.label) parts.add(it.uppercase()) }
    if (track.isExternal) parts.add("External")
    if (track.isDefault) parts.add("Default")
    return if (parts.isNotEmpty()) parts.joinToString(" • ") else null
}

@Composable
private fun AudioList(
    tracks: List<EngineAudioTrack>,
    selectedIndex: Int,
    focusRequester: FocusRequester,
    onSelect: (Int) -> Unit
) {
    val listState = rememberLazyListState()

    LazyColumn(
        state = listState,
        contentPadding = PaddingValues(horizontal = 24.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        itemsIndexed(tracks) { index, track ->
            TrackItem(
                label = track.label ?: track.language ?: "Audio ${index + 1}",
                subtitle = buildAudioInfo(track),
                isSelected = index == selectedIndex,
                focusRequester = if (index == selectedIndex || (selectedIndex == -1 && index == 0)) focusRequester else null,
                onClick = { onSelect(index) }
            )
        }
    }
}

private fun buildAudioInfo(track: EngineAudioTrack): String? {
    val parts = mutableListOf<String>()
    track.language?.let { if (it != track.label) parts.add(it.uppercase()) }
    track.codec?.let { parts.add(it.uppercase()) }
    if (track.channels > 0) {
        val channelLabel = when (track.channels) {
            1 -> "Mono"
            2 -> "Stereo"
            6 -> "5.1"
            8 -> "7.1"
            else -> "${track.channels}ch"
        }
        parts.add(channelLabel)
    }
    if (track.isDefault) parts.add("Default")
    return if (parts.isNotEmpty()) parts.joinToString(" • ") else null
}

@Composable
private fun QualityList(
    levels: List<EngineQualityLevel>,
    selectedIndex: Int,
    focusRequester: FocusRequester,
    onSelect: (Int) -> Unit
) {
    val listState = rememberLazyListState()

    LazyColumn(
        state = listState,
        contentPadding = PaddingValues(horizontal = 24.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        // Auto option
        item {
            TrackItem(
                label = "Auto",
                subtitle = "Adjusts to network conditions",
                isSelected = selectedIndex == -1,
                focusRequester = if (selectedIndex == -1) focusRequester else null,
                onClick = { onSelect(-1) }
            )
        }

        itemsIndexed(levels) { index, level ->
            TrackItem(
                label = level.label,
                subtitle = buildQualityInfo(level),
                isSelected = index == selectedIndex,
                focusRequester = if (index == selectedIndex) focusRequester else null,
                onClick = { onSelect(index) }
            )
        }
    }
}

private fun buildQualityInfo(level: EngineQualityLevel): String {
    val parts = mutableListOf<String>()
    if (level.width > 0 && level.height > 0) {
        parts.add("${level.width}x${level.height}")
    }
    if (level.bitrate > 0) {
        parts.add("${level.bitrate / 1_000_000.0} Mbps")
    }
    level.codec?.let { parts.add(it.uppercase()) }
    return parts.joinToString(" • ")
}

@Composable
private fun SpeedList(
    speeds: List<Float>,
    currentSpeed: Float,
    focusRequester: FocusRequester,
    onSelect: (Float) -> Unit
) {
    val listState = rememberLazyListState()

    LazyColumn(
        state = listState,
        contentPadding = PaddingValues(horizontal = 24.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        itemsIndexed(speeds) { index, speed ->
            val label = when (speed) {
                0.5f -> "0.5x (Slow)"
                0.75f -> "0.75x"
                1f -> "1x (Normal)"
                1.25f -> "1.25x"
                1.5f -> "1.5x"
                2f -> "2x (Fast)"
                else -> "${speed}x"
            }

            TrackItem(
                label = label,
                isSelected = speed == currentSpeed,
                focusRequester = if (speed == currentSpeed || (currentSpeed == 1f && index == 2)) focusRequester else null,
                onClick = { onSelect(speed) }
            )
        }
    }
}

@Composable
private fun TrackItem(
    label: String,
    subtitle: String? = null,
    isSelected: Boolean,
    focusRequester: FocusRequester? = null,
    onClick: () -> Unit
) {
    var isFocused by remember { mutableStateOf(false) }

    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(
                when {
                    isFocused -> MaterialTheme.colorScheme.primary
                    isSelected -> Color.White.copy(alpha = 0.1f)
                    else -> Color.Transparent
                }
            )
            .then(
                if (focusRequester != null) Modifier.focusRequester(focusRequester)
                else Modifier
            )
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
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Selection indicator
        Box(
            modifier = Modifier.size(24.dp),
            contentAlignment = Alignment.Center
        ) {
            if (isSelected) {
                Icon(
                    imageVector = Icons.Filled.Check,
                    contentDescription = "Selected",
                    modifier = Modifier.size(20.dp),
                    tint = if (isFocused) Color.Black else MaterialTheme.colorScheme.primary
                )
            }
        }

        Spacer(modifier = Modifier.width(12.dp))

        Column(
            modifier = Modifier.weight(1f)
        ) {
            Text(
                text = label,
                style = NuvioTypography.titleSmall,
                color = if (isFocused) Color.Black else Color.White
            )
            if (subtitle != null) {
                Text(
                    text = subtitle,
                    style = NuvioTypography.bodySmall,
                    color = if (isFocused) Color.Black.copy(alpha = 0.7f) else Color.White.copy(alpha = 0.5f)
                )
            }
        }
    }
}
