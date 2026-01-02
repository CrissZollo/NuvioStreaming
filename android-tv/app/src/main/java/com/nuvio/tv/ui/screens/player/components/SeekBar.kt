package com.nuvio.tv.ui.screens.player.components

import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.nuvio.tv.ui.theme.NuvioShapes

/**
 * Netflix-style seek bar with focus handling for TV remote.
 * Expands on focus for better visibility.
 */
@Composable
fun SeekBar(
    progress: Float,
    bufferedProgress: Float = 0f,
    isSeeking: Boolean = false,
    seekPreviewProgress: Float = progress,
    focusRequester: FocusRequester? = null,
    onSeekStart: () -> Unit = {},
    onSeekChange: (Float) -> Unit = {},
    onSeekEnd: (Float) -> Unit = {},
    modifier: Modifier = Modifier
) {
    val focusManager = LocalFocusManager.current
    var isFocused by remember { mutableStateOf(false) }
    var localProgress by remember(progress) { mutableFloatStateOf(progress) }

    // Animate height based on focus
    val barHeight by animateFloatAsState(
        targetValue = if (isFocused) 12f else 6f,
        animationSpec = tween(durationMillis = 150),
        label = "seekbar_height"
    )

    val displayProgress = if (isSeeking) seekPreviewProgress else localProgress

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(barHeight.dp)
            .clip(NuvioShapes.progressBar)
            .background(Color.White.copy(alpha = 0.2f))
            .then(
                if (focusRequester != null) Modifier.focusRequester(focusRequester)
                else Modifier
            )
            .onFocusChanged {
                isFocused = it.isFocused
                if (!it.isFocused && isSeeking) {
                    onSeekEnd(localProgress)
                }
            }
            .focusable()
            .onKeyEvent { event ->
                if (!isFocused) return@onKeyEvent false

                if (event.type == KeyEventType.KeyDown) {
                    when (event.key) {
                        Key.DirectionLeft -> {
                            if (!isSeeking) onSeekStart()
                            localProgress = (localProgress - 0.01f).coerceIn(0f, 1f)
                            onSeekChange(localProgress)
                            true
                        }
                        Key.DirectionRight -> {
                            if (!isSeeking) onSeekStart()
                            localProgress = (localProgress + 0.01f).coerceIn(0f, 1f)
                            onSeekChange(localProgress)
                            true
                        }
                        Key.DirectionDown -> {
                            // Move focus to controls below
                            if (isSeeking) {
                                onSeekEnd(localProgress)
                            }
                            focusManager.moveFocus(FocusDirection.Down)
                            true
                        }
                        Key.DirectionUp -> {
                            // Move focus to top bar
                            if (isSeeking) {
                                onSeekEnd(localProgress)
                            }
                            focusManager.moveFocus(FocusDirection.Up)
                            true
                        }
                        Key.DirectionCenter, Key.Enter -> {
                            if (isSeeking) {
                                onSeekEnd(localProgress)
                            }
                            true
                        }
                        else -> false
                    }
                } else if (event.type == KeyEventType.KeyUp) {
                    when (event.key) {
                        Key.DirectionLeft, Key.DirectionRight -> {
                            // Commit seek on key release
                            if (isSeeking) {
                                onSeekEnd(localProgress)
                            }
                            true
                        }
                        else -> false
                    }
                } else {
                    false
                }
            }
    ) {
        // Buffered progress
        Box(
            modifier = Modifier
                .fillMaxHeight()
                .fillMaxWidth(bufferedProgress.coerceIn(0f, 1f))
                .background(Color.White.copy(alpha = 0.3f))
        )

        // Current progress
        Box(
            modifier = Modifier
                .fillMaxHeight()
                .fillMaxWidth(displayProgress.coerceIn(0f, 1f))
                .background(MaterialTheme.colorScheme.primary)
        )

        // Focus indicator / thumb
        if (isFocused) {
            Box(
                modifier = Modifier
                    .fillMaxHeight()
                    .align(Alignment.CenterStart)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(displayProgress.coerceIn(0f, 1f))
                        .fillMaxHeight()
                ) {
                    // Thumb indicator at the end
                    Box(
                        modifier = Modifier
                            .align(Alignment.CenterEnd)
                            .height(barHeight.dp + 8.dp)
                            .background(
                                MaterialTheme.colorScheme.primary,
                                shape = NuvioShapes.progressBar
                            )
                    )
                }
            }
        }
    }
}

/**
 * Enhanced seek bar with chapter markers and preview thumbnails support.
 */
@Composable
fun EnhancedSeekBar(
    progress: Float,
    bufferedProgress: Float = 0f,
    duration: Long = 0L,
    chapters: List<ChapterMarker> = emptyList(),
    isSeeking: Boolean = false,
    seekPreviewProgress: Float = progress,
    focusRequester: FocusRequester? = null,
    onSeekStart: () -> Unit = {},
    onSeekChange: (Float) -> Unit = {},
    onSeekEnd: (Float) -> Unit = {},
    modifier: Modifier = Modifier
) {
    val focusManager = LocalFocusManager.current
    var isFocused by remember { mutableStateOf(false) }
    var localProgress by remember(progress) { mutableFloatStateOf(progress) }

    val barHeight by animateFloatAsState(
        targetValue = if (isFocused) 14f else 8f,
        animationSpec = tween(durationMillis = 150),
        label = "seekbar_height"
    )

    val displayProgress = if (isSeeking) seekPreviewProgress else localProgress

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(barHeight.dp)
            .clip(NuvioShapes.progressBar)
            .background(Color.White.copy(alpha = 0.15f))
            .then(
                if (focusRequester != null) Modifier.focusRequester(focusRequester)
                else Modifier
            )
            .onFocusChanged {
                isFocused = it.isFocused
                if (!it.isFocused && isSeeking) {
                    onSeekEnd(localProgress)
                }
            }
            .focusable()
            .onKeyEvent { event ->
                if (!isFocused) return@onKeyEvent false

                if (event.type == KeyEventType.KeyDown) {
                    when (event.key) {
                        Key.DirectionLeft -> {
                            if (!isSeeking) onSeekStart()
                            // Jump 1% or to previous chapter
                            localProgress = (localProgress - 0.01f).coerceIn(0f, 1f)
                            onSeekChange(localProgress)
                            true
                        }
                        Key.DirectionRight -> {
                            if (!isSeeking) onSeekStart()
                            localProgress = (localProgress + 0.01f).coerceIn(0f, 1f)
                            onSeekChange(localProgress)
                            true
                        }
                        Key.DirectionDown -> {
                            // Move focus to controls below
                            if (isSeeking) {
                                onSeekEnd(localProgress)
                            }
                            focusManager.moveFocus(FocusDirection.Down)
                            true
                        }
                        Key.DirectionUp -> {
                            // Move focus to top bar
                            if (isSeeking) {
                                onSeekEnd(localProgress)
                            }
                            focusManager.moveFocus(FocusDirection.Up)
                            true
                        }
                        Key.DirectionCenter, Key.Enter -> {
                            if (isSeeking) {
                                onSeekEnd(localProgress)
                            }
                            true
                        }
                        else -> false
                    }
                } else {
                    false
                }
            }
    ) {
        // Buffered progress
        Box(
            modifier = Modifier
                .fillMaxHeight()
                .fillMaxWidth(bufferedProgress.coerceIn(0f, 1f))
                .background(Color.White.copy(alpha = 0.25f))
        )

        // Current progress
        Box(
            modifier = Modifier
                .fillMaxHeight()
                .fillMaxWidth(displayProgress.coerceIn(0f, 1f))
                .background(MaterialTheme.colorScheme.primary)
        )

        // Chapter markers
        chapters.forEach { chapter ->
            val markerPosition = if (duration > 0) chapter.startTime.toFloat() / duration else 0f
            if (markerPosition in 0.01f..0.99f) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(markerPosition)
                        .fillMaxHeight()
                        .align(Alignment.CenterStart)
                ) {
                    Box(
                        modifier = Modifier
                            .align(Alignment.CenterEnd)
                            .background(Color.White.copy(alpha = 0.8f))
                    )
                }
            }
        }

        // Focus glow effect
        if (isFocused) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(displayProgress.coerceIn(0f, 1f))
                    .fillMaxHeight()
                    .background(
                        MaterialTheme.colorScheme.primary.copy(alpha = 0.3f)
                    )
            )
        }
    }
}

/**
 * Chapter marker for enhanced seek bar.
 */
data class ChapterMarker(
    val title: String,
    val startTime: Long
)
