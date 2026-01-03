package com.nuvio.tv.ui.screens.player.panels

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
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
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.nuvio.tv.ui.theme.NuvioShapes
import com.nuvio.tv.ui.theme.NuvioTypography
import kotlinx.coroutines.delay

/**
 * Data for the next episode.
 */
data class NextEpisodeInfo(
    val contentId: String,
    val episodeId: String,
    val title: String,
    val episodeNumber: Int,
    val seasonNumber: Int,
    val thumbnail: String? = null,
    val duration: Long = 0L,
    val description: String? = null
)

/**
 * "Up Next" panel that slides up from the bottom.
 * Appears near the end of an episode with a countdown.
 */
@Composable
fun UpNextPanel(
    visible: Boolean,
    nextEpisode: NextEpisodeInfo?,
    countdownSeconds: Int = 10,
    autoPlayEnabled: Boolean = true,
    onPlayNext: () -> Unit = {},
    onCancel: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    if (nextEpisode == null) return

    val playNowFocusRequester = remember { FocusRequester() }
    val cancelFocusRequester = remember { FocusRequester() }

    var remainingSeconds by remember(countdownSeconds) { mutableIntStateOf(countdownSeconds) }

    // Countdown timer
    LaunchedEffect(visible, autoPlayEnabled) {
        if (visible && autoPlayEnabled) {
            remainingSeconds = countdownSeconds
            while (remainingSeconds > 0) {
                delay(1000)
                remainingSeconds--
            }
            if (remainingSeconds <= 0) {
                onPlayNext()
            }
        }
    }

    AnimatedVisibility(
        visible = visible,
        enter = slideInVertically(initialOffsetY = { it }),
        exit = slideOutVertically(targetOffsetY = { it }),
        modifier = modifier
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            Color.Transparent,
                            Color.Black.copy(alpha = 0.95f)
                        )
                    )
                )
                .padding(horizontal = 48.dp, vertical = 32.dp)
                .onKeyEvent { event ->
                    if (event.type == KeyEventType.KeyDown && event.key == Key.Back) {
                        onCancel()
                        true
                    } else {
                        false
                    }
                }
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                // Left side: Episode info
                Row(
                    modifier = Modifier.weight(1f),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Thumbnail
                    EpisodeThumbnail(
                        thumbnailUrl = nextEpisode.thumbnail,
                        modifier = Modifier
                            .width(200.dp)
                            .aspectRatio(16f / 9f)
                    )

                    Spacer(modifier = Modifier.width(24.dp))

                    // Episode details
                    Column {
                        Text(
                            text = "Up Next",
                            style = NuvioTypography.labelMedium,
                            color = Color.White.copy(alpha = 0.6f)
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "S${nextEpisode.seasonNumber} E${nextEpisode.episodeNumber}",
                            style = NuvioTypography.titleSmall,
                            color = MaterialTheme.colorScheme.primary
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = nextEpisode.title,
                            style = NuvioTypography.titleMedium,
                            color = Color.White,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        if (nextEpisode.description != null) {
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = nextEpisode.description,
                                style = NuvioTypography.bodySmall,
                                color = Color.White.copy(alpha = 0.6f),
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
                }

                // Right side: Actions
                Row(
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Cancel button
                    CancelButton(
                        focusRequester = cancelFocusRequester,
                        onClick = onCancel
                    )

                    // Play now button with countdown
                    PlayNextButton(
                        remainingSeconds = if (autoPlayEnabled) remainingSeconds else null,
                        focusRequester = playNowFocusRequester,
                        onClick = onPlayNext
                    )
                }
            }
        }
    }

    // Request focus when panel becomes visible
    LaunchedEffect(visible) {
        if (visible) {
            playNowFocusRequester.requestFocus()
        }
    }
}

@Composable
private fun EpisodeThumbnail(
    thumbnailUrl: String?,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(Color.White.copy(alpha = 0.1f))
    ) {
        if (thumbnailUrl != null) {
            AsyncImage(
                model = thumbnailUrl,
                contentDescription = "Next episode thumbnail",
                contentScale = ContentScale.Crop,
                modifier = Modifier.matchParentSize()
            )
        }

        // Play icon overlay
        Box(
            modifier = Modifier
                .matchParentSize()
                .background(Color.Black.copy(alpha = 0.4f)),
            contentAlignment = Alignment.Center
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(NuvioShapes.playerButton)
                    .background(Color.White.copy(alpha = 0.9f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Filled.PlayArrow,
                    contentDescription = "Play",
                    modifier = Modifier.size(32.dp),
                    tint = Color.Black
                )
            }
        }
    }
}

@Composable
private fun PlayNextButton(
    remainingSeconds: Int?,
    focusRequester: FocusRequester,
    onClick: () -> Unit
) {
    var isFocused by remember { mutableStateOf(false) }

    val progress by animateFloatAsState(
        targetValue = if (remainingSeconds != null) remainingSeconds / 10f else 1f,
        animationSpec = tween(durationMillis = 900),
        label = "countdown_progress"
    )

    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(
                if (isFocused) MaterialTheme.colorScheme.primary
                else Color.White.copy(alpha = 0.15f)
            )
            .focusRequester(focusRequester)
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
            .padding(horizontal = 20.dp, vertical = 14.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Countdown indicator
            if (remainingSeconds != null) {
                Box(
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(
                        progress = { progress },
                        modifier = Modifier.size(24.dp),
                        strokeWidth = 2.dp,
                        color = if (isFocused) Color.Black else Color.White,
                        trackColor = if (isFocused) Color.Black.copy(alpha = 0.3f) else Color.White.copy(alpha = 0.3f)
                    )
                    Text(
                        text = "$remainingSeconds",
                        style = NuvioTypography.labelSmall,
                        color = if (isFocused) Color.Black else Color.White
                    )
                }
            }

            Icon(
                imageVector = Icons.Filled.SkipNext,
                contentDescription = null,
                modifier = Modifier.size(24.dp),
                tint = if (isFocused) Color.Black else Color.White
            )

            Text(
                text = if (remainingSeconds != null) "Play Now" else "Play Next",
                style = NuvioTypography.labelLarge,
                color = if (isFocused) Color.Black else Color.White
            )
        }
    }
}

@Composable
private fun CancelButton(
    focusRequester: FocusRequester,
    onClick: () -> Unit
) {
    var isFocused by remember { mutableStateOf(false) }

    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(
                if (isFocused) Color.White.copy(alpha = 0.9f)
                else Color.White.copy(alpha = 0.1f)
            )
            .focusRequester(focusRequester)
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
            .padding(horizontal = 16.dp, vertical = 14.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Icon(
                imageVector = Icons.Filled.Close,
                contentDescription = null,
                modifier = Modifier.size(20.dp),
                tint = if (isFocused) Color.Black else Color.White.copy(alpha = 0.8f)
            )
            Text(
                text = "Cancel",
                style = NuvioTypography.labelMedium,
                color = if (isFocused) Color.Black else Color.White.copy(alpha = 0.8f)
            )
        }
    }
}

/**
 * Mini "Up Next" indicator shown in the bottom corner.
 * Less intrusive than the full panel.
 */
@Composable
fun UpNextMiniIndicator(
    visible: Boolean,
    nextEpisode: NextEpisodeInfo?,
    onExpand: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    if (nextEpisode == null) return

    AnimatedVisibility(
        visible = visible,
        enter = slideInVertically(initialOffsetY = { it }),
        exit = slideOutVertically(targetOffsetY = { it }),
        modifier = modifier
    ) {
        var isFocused by remember { mutableStateOf(false) }

        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(8.dp))
                .background(Color.Black.copy(alpha = 0.85f))
                .onFocusChanged { isFocused = it.isFocused }
                .focusable()
                .onKeyEvent { event ->
                    if (event.type == KeyEventType.KeyDown &&
                        (event.key == Key.DirectionCenter || event.key == Key.Enter)
                    ) {
                        onExpand()
                        true
                    } else {
                        false
                    }
                }
                .padding(12.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Icon(
                    imageVector = Icons.Filled.SkipNext,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp),
                    tint = MaterialTheme.colorScheme.primary
                )
                Column {
                    Text(
                        text = "Up Next",
                        style = NuvioTypography.labelSmall,
                        color = Color.White.copy(alpha = 0.6f)
                    )
                    Text(
                        text = "S${nextEpisode.seasonNumber} E${nextEpisode.episodeNumber}",
                        style = NuvioTypography.labelMedium,
                        color = Color.White
                    )
                }
            }
        }
    }
}
