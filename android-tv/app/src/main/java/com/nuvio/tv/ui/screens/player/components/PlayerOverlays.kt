package com.nuvio.tv.ui.screens.player.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FastForward
import androidx.compose.material.icons.filled.FastRewind
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.nuvio.tv.player.engine.EngineType
import com.nuvio.tv.ui.theme.NuvioTypography
import kotlinx.coroutines.delay

/**
 * Direction for skip indicator.
 */
enum class SkipDirection {
    FORWARD,
    BACKWARD
}

/**
 * Skip indicator that shows when seeking.
 */
@Composable
fun SkipIndicator(
    direction: SkipDirection,
    seconds: Int = 10,
    visible: Boolean,
    modifier: Modifier = Modifier
) {
    AnimatedVisibility(
        visible = visible,
        enter = fadeIn(animationSpec = tween(150)) + scaleIn(initialScale = 0.8f),
        exit = fadeOut(animationSpec = tween(150)) + scaleOut(targetScale = 0.8f),
        modifier = modifier
    ) {
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(16.dp))
                .background(Color.Black.copy(alpha = 0.7f))
                .padding(horizontal = 24.dp, vertical = 16.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                Icon(
                    imageVector = if (direction == SkipDirection.FORWARD) {
                        Icons.Filled.FastForward
                    } else {
                        Icons.Filled.FastRewind
                    },
                    contentDescription = null,
                    modifier = Modifier.size(32.dp),
                    tint = Color.White
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "${if (direction == SkipDirection.FORWARD) "+" else "-"}${seconds}s",
                    style = NuvioTypography.titleMedium,
                    color = Color.White
                )
            }
        }
    }
}

/**
 * Buffering overlay with spinner and optional percentage.
 */
@Composable
fun BufferingOverlay(
    isBuffering: Boolean,
    bufferedPercent: Int = 0,
    showPercentage: Boolean = true,
    modifier: Modifier = Modifier
) {
    AnimatedVisibility(
        visible = isBuffering,
        enter = fadeIn(animationSpec = tween(200)),
        exit = fadeOut(animationSpec = tween(200)),
        modifier = modifier
    ) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                CircularProgressIndicator(
                    modifier = Modifier.size(64.dp),
                    color = MaterialTheme.colorScheme.primary,
                    strokeWidth = 4.dp
                )
                if (showPercentage && bufferedPercent > 0) {
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = "${bufferedPercent}%",
                        style = NuvioTypography.labelMedium,
                        color = Color.White.copy(alpha = 0.7f)
                    )
                }
            }
        }
    }
}

/**
 * Play/Pause state indicator that briefly shows when toggling.
 */
@Composable
fun PlayPauseIndicator(
    isPlaying: Boolean,
    trigger: Int, // Increment to trigger animation
    modifier: Modifier = Modifier
) {
    var showIndicator by remember { mutableStateOf(false) }

    LaunchedEffect(trigger) {
        if (trigger > 0) {
            showIndicator = true
            delay(800)
            showIndicator = false
        }
    }

    AnimatedVisibility(
        visible = showIndicator,
        enter = fadeIn(animationSpec = tween(100)) + scaleIn(initialScale = 0.6f),
        exit = fadeOut(animationSpec = tween(300)) + scaleOut(targetScale = 1.2f),
        modifier = modifier
    ) {
        Box(
            modifier = Modifier
                .size(100.dp)
                .clip(RoundedCornerShape(50))
                .background(Color.Black.copy(alpha = 0.6f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = if (isPlaying) Icons.Filled.PlayArrow else Icons.Filled.Pause,
                contentDescription = if (isPlaying) "Playing" else "Paused",
                modifier = Modifier.size(56.dp),
                tint = Color.White
            )
        }
    }
}

/**
 * Playback debug info overlay.
 */
@Composable
fun PlaybackInfoOverlay(
    visible: Boolean,
    currentBitrate: Int,
    currentResolution: String,
    currentCodec: String,
    decoderType: String,
    activeEngine: EngineType,
    bufferedPercent: Int,
    position: Long,
    duration: Long,
    modifier: Modifier = Modifier
) {
    AnimatedVisibility(
        visible = visible,
        enter = fadeIn(),
        exit = fadeOut(),
        modifier = modifier
    ) {
        Box(
            modifier = Modifier
                .padding(16.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(Color.Black.copy(alpha = 0.8f))
                .padding(16.dp)
        ) {
            Column(
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                InfoRow("Engine", activeEngine.name)
                InfoRow("Decoder", decoderType)
                InfoRow("Resolution", currentResolution.ifEmpty { "N/A" })
                InfoRow("Codec", currentCodec.ifEmpty { "N/A" })
                InfoRow("Bitrate", if (currentBitrate > 0) "${currentBitrate / 1000} kbps" else "N/A")
                InfoRow("Buffer", "$bufferedPercent%")
                InfoRow("Position", formatTimeDebug(position))
                InfoRow("Duration", formatTimeDebug(duration))
            }
        }
    }
}

@Composable
private fun InfoRow(
    label: String,
    value: String
) {
    Row {
        Text(
            text = "$label: ",
            style = NuvioTypography.labelSmall,
            color = Color.White.copy(alpha = 0.6f)
        )
        Text(
            text = value,
            style = NuvioTypography.labelSmall,
            color = Color.White
        )
    }
}

private fun formatTimeDebug(milliseconds: Long): String {
    if (milliseconds <= 0) return "0:00:00.000"

    val ms = milliseconds % 1000
    val totalSeconds = milliseconds / 1000
    val hours = totalSeconds / 3600
    val minutes = (totalSeconds % 3600) / 60
    val seconds = totalSeconds % 60

    return String.format("%d:%02d:%02d.%03d", hours, minutes, seconds, ms)
}

/**
 * Engine switch notification.
 */
@Composable
fun EngineSwitchNotification(
    visible: Boolean,
    fromEngine: EngineType,
    toEngine: EngineType,
    reason: String,
    modifier: Modifier = Modifier
) {
    AnimatedVisibility(
        visible = visible,
        enter = fadeIn() + scaleIn(initialScale = 0.9f),
        exit = fadeOut() + scaleOut(targetScale = 0.9f),
        modifier = modifier
    ) {
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(12.dp))
                .background(Color(0xFF1A1A2E))
                .padding(20.dp)
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "Switching Player Engine",
                    style = NuvioTypography.titleMedium,
                    color = Color.White
                )
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    EngineBadgeSmall(fromEngine)
                    Text(
                        text = " → ",
                        style = NuvioTypography.bodyMedium,
                        color = Color.White.copy(alpha = 0.6f)
                    )
                    EngineBadgeSmall(toEngine)
                }
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = reason,
                    style = NuvioTypography.bodySmall,
                    color = Color.White.copy(alpha = 0.5f)
                )
            }
        }
    }
}

@Composable
private fun EngineBadgeSmall(
    engineType: EngineType
) {
    val (text, color) = when (engineType) {
        EngineType.MPV -> "MPV" to Color(0xFF9C27B0)
        EngineType.EXOPLAYER -> "ExoPlayer" to Color(0xFF2196F3)
    }

    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(4.dp))
            .background(color)
            .padding(horizontal = 8.dp, vertical = 4.dp)
    ) {
        Text(
            text = text,
            style = NuvioTypography.labelSmall,
            color = Color.White
        )
    }
}

/**
 * Error overlay for playback errors.
 */
@Composable
fun ErrorOverlay(
    visible: Boolean,
    errorMessage: String,
    canRetry: Boolean = true,
    onRetry: () -> Unit = {},
    onDismiss: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    AnimatedVisibility(
        visible = visible,
        enter = fadeIn(),
        exit = fadeOut(),
        modifier = modifier
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.85f)),
            contentAlignment = Alignment.Center
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(48.dp)
            ) {
                Text(
                    text = "Playback Error",
                    style = NuvioTypography.headlineMedium,
                    color = Color.White
                )
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = errorMessage,
                    style = NuvioTypography.bodyMedium,
                    color = Color.White.copy(alpha = 0.7f)
                )
                if (canRetry) {
                    Spacer(modifier = Modifier.height(24.dp))
                    Text(
                        text = "Press Enter to retry or Back to exit",
                        style = NuvioTypography.bodySmall,
                        color = Color.White.copy(alpha = 0.5f)
                    )
                }
            }
        }
    }
}
