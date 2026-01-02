package com.nuvio.tv.ui.screens.player.components

import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material.icons.filled.FastForward
import androidx.compose.material.icons.filled.FastRewind
import androidx.compose.material.icons.filled.Fullscreen
import androidx.compose.material.icons.filled.Headphones
import androidx.compose.material.icons.filled.HighQuality
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material.icons.filled.Subtitles
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
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.nuvio.tv.ui.theme.NuvioShapes
import com.nuvio.tv.ui.theme.NuvioTypography

/**
 * Main playback control button (Play/Pause).
 */
@Composable
fun PlayPauseButton(
    isPlaying: Boolean,
    focusRequester: FocusRequester? = null,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    PlayerControlButton(
        icon = if (isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow,
        contentDescription = if (isPlaying) "Pause" else "Play",
        size = 64.dp,
        iconSize = 40.dp,
        focusRequester = focusRequester,
        onClick = onClick,
        modifier = modifier
    )
}

/**
 * Seek backward button (rewind).
 */
@Composable
fun RewindButton(
    seconds: Int = 10,
    focusRequester: FocusRequester? = null,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    PlayerControlButton(
        icon = Icons.Filled.FastRewind,
        contentDescription = "Rewind $seconds seconds",
        size = 52.dp,
        iconSize = 32.dp,
        focusRequester = focusRequester,
        onClick = onClick,
        modifier = modifier
    )
}

/**
 * Seek forward button (fast forward).
 */
@Composable
fun FastForwardButton(
    seconds: Int = 10,
    focusRequester: FocusRequester? = null,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    PlayerControlButton(
        icon = Icons.Filled.FastForward,
        contentDescription = "Forward $seconds seconds",
        size = 52.dp,
        iconSize = 32.dp,
        focusRequester = focusRequester,
        onClick = onClick,
        modifier = modifier
    )
}

/**
 * Skip to next episode button.
 */
@Composable
fun SkipNextButton(
    enabled: Boolean = true,
    focusRequester: FocusRequester? = null,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    PlayerControlButton(
        icon = Icons.Filled.SkipNext,
        contentDescription = "Next episode",
        size = 48.dp,
        iconSize = 28.dp,
        enabled = enabled,
        focusRequester = focusRequester,
        onClick = onClick,
        modifier = modifier
    )
}

/**
 * Generic player control button with focus handling.
 * Always focusable for TV navigation, but action only works when enabled.
 */
@Composable
fun PlayerControlButton(
    icon: ImageVector,
    contentDescription: String,
    size: Dp = 48.dp,
    iconSize: Dp = 28.dp,
    enabled: Boolean = true,
    focusRequester: FocusRequester? = null,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    var isFocused by remember { mutableStateOf(false) }

    Box(
        modifier = modifier
            .size(size)
            .clip(NuvioShapes.playerButton)
            .background(
                when {
                    isFocused && enabled -> MaterialTheme.colorScheme.primary
                    isFocused && !enabled -> Color.White.copy(alpha = 0.2f)
                    !enabled -> Color.White.copy(alpha = 0.05f)
                    else -> Color.White.copy(alpha = 0.15f)
                }
            )
            .then(
                if (focusRequester != null) Modifier.focusRequester(focusRequester)
                else Modifier
            )
            .onFocusChanged { isFocused = it.isFocused }
            .focusable() // Always focusable for TV navigation
            .onKeyEvent { event ->
                if (event.type == KeyEventType.KeyDown &&
                    (event.key == Key.DirectionCenter || event.key == Key.Enter)
                ) {
                    if (enabled) {
                        onClick()
                    }
                    true // Consume the event even if disabled
                } else {
                    false
                }
            },
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = icon,
            contentDescription = contentDescription,
            modifier = Modifier.size(iconSize),
            tint = when {
                isFocused && enabled -> Color.Black
                isFocused && !enabled -> Color.White.copy(alpha = 0.5f)
                !enabled -> Color.White.copy(alpha = 0.3f)
                else -> Color.White
            }
        )
    }
}

/**
 * Secondary control button (smaller, for audio/subtitle/quality).
 * Always focusable for TV navigation, but action only works when enabled.
 */
@Composable
fun SecondaryControlButton(
    icon: ImageVector,
    contentDescription: String,
    label: String? = null,
    enabled: Boolean = true,
    focusRequester: FocusRequester? = null,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    var isFocused by remember { mutableStateOf(false) }

    Box(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(
                when {
                    isFocused && enabled -> MaterialTheme.colorScheme.primary
                    isFocused && !enabled -> Color.White.copy(alpha = 0.2f)
                    !enabled -> Color.Transparent
                    else -> Color.White.copy(alpha = 0.1f)
                }
            )
            .then(
                if (focusRequester != null) Modifier.focusRequester(focusRequester)
                else Modifier
            )
            .onFocusChanged { isFocused = it.isFocused }
            .focusable() // Always focusable for TV navigation
            .onKeyEvent { event ->
                if (event.type == KeyEventType.KeyDown &&
                    (event.key == Key.DirectionCenter || event.key == Key.Enter)
                ) {
                    if (enabled) {
                        onClick()
                    }
                    true // Consume the event even if disabled
                } else {
                    false
                }
            },
        contentAlignment = Alignment.Center
    ) {
        if (label != null) {
            Row(
                modifier = Modifier
                    .size(width = 80.dp, height = 44.dp),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = contentDescription,
                    modifier = Modifier.size(22.dp),
                    tint = when {
                        isFocused && enabled -> Color.Black
                        isFocused && !enabled -> Color.White.copy(alpha = 0.5f)
                        !enabled -> Color.White.copy(alpha = 0.3f)
                        else -> Color.White.copy(alpha = 0.8f)
                    }
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = label,
                    style = NuvioTypography.labelSmall,
                    color = when {
                        isFocused && enabled -> Color.Black
                        isFocused && !enabled -> Color.White.copy(alpha = 0.5f)
                        !enabled -> Color.White.copy(alpha = 0.3f)
                        else -> Color.White.copy(alpha = 0.8f)
                    }
                )
            }
        } else {
            Box(
                modifier = Modifier.size(44.dp),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = contentDescription,
                    modifier = Modifier.size(24.dp),
                    tint = when {
                        isFocused && enabled -> Color.Black
                        isFocused && !enabled -> Color.White.copy(alpha = 0.5f)
                        !enabled -> Color.White.copy(alpha = 0.3f)
                        else -> Color.White.copy(alpha = 0.8f)
                    }
                )
            }
        }
    }
}

/**
 * Subtitle button.
 */
@Composable
fun SubtitleButton(
    enabled: Boolean = true,
    hasSelection: Boolean = false,
    focusRequester: FocusRequester? = null,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    SecondaryControlButton(
        icon = Icons.Filled.Subtitles,
        contentDescription = "Subtitles",
        label = if (hasSelection) "CC" else null,
        enabled = enabled,
        focusRequester = focusRequester,
        onClick = onClick,
        modifier = modifier
    )
}

/**
 * Audio track button.
 */
@Composable
fun AudioTrackButton(
    enabled: Boolean = true,
    currentTrack: String? = null,
    focusRequester: FocusRequester? = null,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    SecondaryControlButton(
        icon = Icons.Filled.Headphones,
        contentDescription = "Audio tracks",
        label = currentTrack?.take(3)?.uppercase(),
        enabled = enabled,
        focusRequester = focusRequester,
        onClick = onClick,
        modifier = modifier
    )
}

/**
 * Quality selection button.
 */
@Composable
fun QualityButton(
    enabled: Boolean = true,
    currentQuality: String? = null,
    focusRequester: FocusRequester? = null,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    SecondaryControlButton(
        icon = Icons.Filled.HighQuality,
        contentDescription = "Quality",
        label = currentQuality,
        enabled = enabled,
        focusRequester = focusRequester,
        onClick = onClick,
        modifier = modifier
    )
}

/**
 * Speed selection button.
 */
@Composable
fun SpeedButton(
    currentSpeed: Float = 1f,
    focusRequester: FocusRequester? = null,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    SecondaryControlButton(
        icon = Icons.Filled.Speed,
        contentDescription = "Playback speed",
        label = if (currentSpeed != 1f) "${currentSpeed}x" else null,
        enabled = true,
        focusRequester = focusRequester,
        onClick = onClick,
        modifier = modifier
    )
}

/**
 * Main playback controls row (center controls).
 */
@Composable
fun MainPlaybackControls(
    isPlaying: Boolean,
    rewindFocusRequester: FocusRequester? = null,
    playPauseFocusRequester: FocusRequester? = null,
    forwardFocusRequester: FocusRequester? = null,
    onRewind: () -> Unit,
    onPlayPause: () -> Unit,
    onForward: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically
    ) {
        RewindButton(
            focusRequester = rewindFocusRequester,
            onClick = onRewind
        )

        Spacer(modifier = Modifier.width(28.dp))

        PlayPauseButton(
            isPlaying = isPlaying,
            focusRequester = playPauseFocusRequester,
            onClick = onPlayPause
        )

        Spacer(modifier = Modifier.width(28.dp))

        FastForwardButton(
            focusRequester = forwardFocusRequester,
            onClick = onForward
        )
    }
}

/**
 * Secondary controls row (left side - subtitles, audio).
 */
@Composable
fun SecondaryLeftControls(
    hasSubtitles: Boolean,
    hasAudioTracks: Boolean,
    subtitleSelected: Boolean = false,
    currentAudioTrack: String? = null,
    subtitleFocusRequester: FocusRequester? = null,
    audioFocusRequester: FocusRequester? = null,
    onSubtitleClick: () -> Unit,
    onAudioClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        SubtitleButton(
            enabled = hasSubtitles,
            hasSelection = subtitleSelected,
            focusRequester = subtitleFocusRequester,
            onClick = onSubtitleClick
        )

        AudioTrackButton(
            enabled = hasAudioTracks,
            currentTrack = currentAudioTrack,
            focusRequester = audioFocusRequester,
            onClick = onAudioClick
        )
    }
}

/**
 * Secondary controls row (right side - quality, speed).
 */
@Composable
fun SecondaryRightControls(
    hasQualityLevels: Boolean,
    currentQuality: String? = null,
    currentSpeed: Float = 1f,
    qualityFocusRequester: FocusRequester? = null,
    speedFocusRequester: FocusRequester? = null,
    onQualityClick: () -> Unit,
    onSpeedClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        QualityButton(
            enabled = hasQualityLevels,
            currentQuality = currentQuality,
            focusRequester = qualityFocusRequester,
            onClick = onQualityClick
        )

        SpeedButton(
            currentSpeed = currentSpeed,
            focusRequester = speedFocusRequester,
            onClick = onSpeedClick
        )
    }
}
