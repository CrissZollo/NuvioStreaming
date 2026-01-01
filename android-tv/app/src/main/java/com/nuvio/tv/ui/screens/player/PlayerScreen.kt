package com.nuvio.tv.ui.screens.player

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FastForward
import androidx.compose.material.icons.filled.FastRewind
import androidx.compose.material.icons.filled.Headphones
import androidx.compose.material.icons.filled.HighQuality
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material.icons.filled.Subtitles
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
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
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.media3.ui.PlayerView
import com.nuvio.tv.domain.model.Stream
import com.nuvio.tv.ui.screens.player.dialogs.AudioTrackDialog
import com.nuvio.tv.ui.screens.player.dialogs.QualityDialog
import com.nuvio.tv.ui.screens.player.dialogs.SpeedDialog
import com.nuvio.tv.ui.screens.player.dialogs.SubtitleDialog
import com.nuvio.tv.ui.theme.NuvioTypography
import kotlinx.coroutines.delay

/**
 * Full-screen video player with TV controls.
 */
@Composable
fun PlayerScreen(
    stream: Stream,
    contentId: String,
    contentType: String,
    contentTitle: String,
    episodeTitle: String? = null,
    episodeId: String? = null,
    seasonNumber: Int? = null,
    episodeNumber: Int? = null,
    poster: String? = null,
    startPosition: Long = 0L,
    viewModel: PlayerViewModel = hiltViewModel(),
    onBackClick: () -> Unit
) {
    val playerState by viewModel.playerState.collectAsState()
    val externalSubtitles by viewModel.externalSubtitles.collectAsState()
    val availableSpeeds by viewModel.availableSpeeds.collectAsState()
    val exoPlayer = viewModel.getExoPlayer()

    var showControls by remember { mutableStateOf(true) }
    var lastInteractionTime by remember { mutableStateOf(System.currentTimeMillis()) }

    // Dialog states
    var showSubtitleDialog by remember { mutableStateOf(false) }
    var showAudioDialog by remember { mutableStateOf(false) }
    var showQualityDialog by remember { mutableStateOf(false) }
    var showSpeedDialog by remember { mutableStateOf(false) }

    val focusRequester = remember { FocusRequester() }

    // Auto-hide controls after 5 seconds
    LaunchedEffect(showControls, lastInteractionTime) {
        if (showControls && !playerState.isBuffering) {
            delay(5000)
            if (System.currentTimeMillis() - lastInteractionTime >= 5000) {
                showControls = false
            }
        }
    }

    // Start playback with tracking info
    LaunchedEffect(stream) {
        val playbackInfo = PlaybackInfo(
            contentId = contentId,
            contentType = contentType,
            contentTitle = contentTitle,
            episodeId = episodeId,
            episodeTitle = episodeTitle,
            poster = poster,
            seasonNumber = seasonNumber,
            episodeNumber = episodeNumber
        )
        viewModel.playStream(stream, startPosition, playbackInfo)
    }

    // Handle lifecycle
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_PAUSE -> viewModel.pause()
                Lifecycle.Event.ON_RESUME -> if (playerState.isPlaying) viewModel.play()
                Lifecycle.Event.ON_DESTROY -> viewModel.release()
                else -> {}
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
        }
    }

    // Handle back button
    BackHandler {
        viewModel.release()
        onBackClick()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
            .focusRequester(focusRequester)
            .focusable()
            .onKeyEvent { event ->
                if (event.type == KeyEventType.KeyDown) {
                    lastInteractionTime = System.currentTimeMillis()
                    when (event.key) {
                        Key.DirectionCenter, Key.Enter -> {
                            if (showControls) {
                                viewModel.togglePlayPause()
                            } else {
                                showControls = true
                            }
                            true
                        }
                        Key.DirectionLeft -> {
                            if (showControls) {
                                viewModel.seekBackward()
                            } else {
                                showControls = true
                            }
                            true
                        }
                        Key.DirectionRight -> {
                            if (showControls) {
                                viewModel.seekForward()
                            } else {
                                showControls = true
                            }
                            true
                        }
                        Key.DirectionUp, Key.DirectionDown -> {
                            showControls = true
                            true
                        }
                        Key.Back, Key.Escape -> {
                            if (showControls) {
                                showControls = false
                            } else {
                                viewModel.release()
                                onBackClick()
                            }
                            true
                        }
                        Key.MediaPlayPause -> {
                            viewModel.togglePlayPause()
                            true
                        }
                        Key.MediaPlay -> {
                            viewModel.play()
                            true
                        }
                        Key.MediaPause -> {
                            viewModel.pause()
                            true
                        }
                        Key.MediaFastForward -> {
                            viewModel.seekForward()
                            true
                        }
                        Key.MediaRewind -> {
                            viewModel.seekBackward()
                            true
                        }
                        else -> false
                    }
                } else {
                    false
                }
            }
    ) {
        // Video Player Surface
        if (exoPlayer != null) {
            AndroidView(
                factory = { context ->
                    PlayerView(context).apply {
                        player = exoPlayer
                        useController = false
                        setShowBuffering(PlayerView.SHOW_BUFFERING_NEVER)
                    }
                },
                modifier = Modifier.fillMaxSize()
            )
        }

        // Buffering Indicator
        if (playerState.isBuffering) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(
                    modifier = Modifier.size(64.dp),
                    color = MaterialTheme.colorScheme.primary
                )
            }
        }

        // Player Controls Overlay
        AnimatedVisibility(
            visible = showControls,
            enter = fadeIn(),
            exit = fadeOut()
        ) {
            PlayerControlsOverlay(
                title = contentTitle,
                episodeTitle = episodeTitle,
                isPlaying = playerState.isPlaying,
                currentPosition = playerState.currentPosition,
                duration = playerState.duration,
                bufferedPosition = playerState.bufferedPosition,
                playbackSpeed = playerState.playbackSpeed,
                hasSubtitles = playerState.subtitleTracks.isNotEmpty() || externalSubtitles.subtitles.isNotEmpty(),
                hasAudioTracks = playerState.audioTracks.size > 1,
                hasQualityLevels = playerState.qualityLevels.isNotEmpty(),
                onPlayPauseClick = { viewModel.togglePlayPause() },
                onSeekBackward = { viewModel.seekBackward() },
                onSeekForward = { viewModel.seekForward() },
                onSeek = { viewModel.seekTo(it) },
                onSubtitleClick = { showSubtitleDialog = true },
                onAudioClick = { showAudioDialog = true },
                onQualityClick = { showQualityDialog = true },
                onSpeedClick = { showSpeedDialog = true }
            )
        }

        // Dialogs
        if (showSubtitleDialog) {
            SubtitleDialog(
                embeddedTracks = playerState.subtitleTracks,
                externalSubtitles = externalSubtitles.subtitles,
                selectedEmbeddedIndex = playerState.selectedSubtitleTrack,
                selectedExternalIndex = externalSubtitles.selectedIndex,
                onSelectEmbedded = { viewModel.selectSubtitleTrack(it) },
                onSelectExternal = { viewModel.selectExternalSubtitle(it) },
                onDismiss = { showSubtitleDialog = false }
            )
        }

        if (showAudioDialog) {
            AudioTrackDialog(
                tracks = playerState.audioTracks,
                selectedIndex = playerState.selectedAudioTrack,
                onSelect = { viewModel.selectAudioTrack(it) },
                onDismiss = { showAudioDialog = false }
            )
        }

        if (showQualityDialog) {
            QualityDialog(
                levels = playerState.qualityLevels,
                selectedIndex = playerState.selectedQualityLevel,
                onSelect = { viewModel.selectQualityLevel(it) },
                onDismiss = { showQualityDialog = false }
            )
        }

        if (showSpeedDialog) {
            SpeedDialog(
                speeds = availableSpeeds,
                currentSpeed = playerState.playbackSpeed,
                onSelect = { viewModel.setPlaybackSpeed(it) },
                onDismiss = { showSpeedDialog = false }
            )
        }

        // Error Display
        playerState.error?.let { error ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.8f)),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "Playback Error",
                        style = NuvioTypography.headlineMedium,
                        color = Color.White
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = error,
                        style = NuvioTypography.bodyMedium,
                        color = Color.White.copy(alpha = 0.7f)
                    )
                }
            }
        }
    }

    LaunchedEffect(Unit) {
        focusRequester.requestFocus()
    }
}

@Composable
private fun PlayerControlsOverlay(
    title: String,
    episodeTitle: String?,
    isPlaying: Boolean,
    currentPosition: Long,
    duration: Long,
    bufferedPosition: Long,
    playbackSpeed: Float,
    hasSubtitles: Boolean,
    hasAudioTracks: Boolean,
    hasQualityLevels: Boolean,
    onPlayPauseClick: () -> Unit,
    onSeekBackward: () -> Unit,
    onSeekForward: () -> Unit,
    onSeek: (Long) -> Unit,
    onSubtitleClick: () -> Unit,
    onAudioClick: () -> Unit,
    onQualityClick: () -> Unit,
    onSpeedClick: () -> Unit
) {
    Box(
        modifier = Modifier.fillMaxSize()
    ) {
        // Top Gradient with Title
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(120.dp)
                .align(Alignment.TopCenter)
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            Color.Black.copy(alpha = 0.8f),
                            Color.Transparent
                        )
                    )
                )
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 48.dp, vertical = 24.dp),
                verticalAlignment = Alignment.Top
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = title,
                        style = NuvioTypography.headlineMedium,
                        color = Color.White
                    )
                    episodeTitle?.let {
                        Text(
                            text = it,
                            style = NuvioTypography.bodyLarge,
                            color = Color.White.copy(alpha = 0.7f)
                        )
                    }
                }

                // Speed indicator
                if (playbackSpeed != 1f) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(4.dp))
                            .background(MaterialTheme.colorScheme.primary)
                            .padding(horizontal = 8.dp, vertical = 4.dp)
                    ) {
                        Text(
                            text = "${playbackSpeed}x",
                            style = NuvioTypography.labelMedium,
                            color = Color.Black
                        )
                    }
                }
            }
        }

        // Bottom Gradient with Controls
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(220.dp)
                .align(Alignment.BottomCenter)
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            Color.Transparent,
                            Color.Black.copy(alpha = 0.8f)
                        )
                    )
                )
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.BottomCenter)
                    .padding(horizontal = 48.dp, vertical = 24.dp)
            ) {
                // Progress Bar
                Column {
                    LinearProgressIndicator(
                        progress = { if (duration > 0) currentPosition.toFloat() / duration else 0f },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(4.dp)
                            .clip(CircleShape),
                        color = MaterialTheme.colorScheme.primary,
                        trackColor = Color.White.copy(alpha = 0.3f)
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    // Time Display
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = formatTime(currentPosition),
                            style = NuvioTypography.bodyMedium,
                            color = Color.White
                        )
                        Text(
                            text = formatTime(duration),
                            style = NuvioTypography.bodyMedium,
                            color = Color.White.copy(alpha = 0.7f)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Control Buttons Row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Left side - Secondary controls
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Subtitles
                        SmallControlButton(
                            icon = Icons.Filled.Subtitles,
                            contentDescription = "Subtitles",
                            onClick = onSubtitleClick,
                            enabled = hasSubtitles
                        )

                        // Audio tracks
                        SmallControlButton(
                            icon = Icons.Filled.Headphones,
                            contentDescription = "Audio",
                            onClick = onAudioClick,
                            enabled = hasAudioTracks
                        )
                    }

                    // Center - Main playback controls
                    Row(
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Rewind Button
                        ControlButton(
                            icon = Icons.Filled.FastRewind,
                            contentDescription = "Rewind 10 seconds",
                            onClick = onSeekBackward
                        )

                        Spacer(modifier = Modifier.width(24.dp))

                        // Play/Pause Button
                        ControlButton(
                            icon = if (isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                            contentDescription = if (isPlaying) "Pause" else "Play",
                            onClick = onPlayPauseClick,
                            isLarge = true
                        )

                        Spacer(modifier = Modifier.width(24.dp))

                        // Fast Forward Button
                        ControlButton(
                            icon = Icons.Filled.FastForward,
                            contentDescription = "Forward 10 seconds",
                            onClick = onSeekForward
                        )
                    }

                    // Right side - Quality & Speed
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Quality
                        SmallControlButton(
                            icon = Icons.Filled.HighQuality,
                            contentDescription = "Quality",
                            onClick = onQualityClick,
                            enabled = hasQualityLevels
                        )

                        // Speed
                        SmallControlButton(
                            icon = Icons.Filled.Speed,
                            contentDescription = "Speed",
                            onClick = onSpeedClick
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ControlButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    contentDescription: String,
    onClick: () -> Unit,
    isLarge: Boolean = false
) {
    var isFocused by remember { mutableStateOf(false) }

    val size = if (isLarge) 64.dp else 48.dp
    val iconSize = if (isLarge) 40.dp else 28.dp

    Box(
        modifier = Modifier
            .size(size)
            .clip(CircleShape)
            .background(
                if (isFocused) {
                    MaterialTheme.colorScheme.primary
                } else {
                    Color.White.copy(alpha = 0.2f)
                }
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
            imageVector = icon,
            contentDescription = contentDescription,
            modifier = Modifier.size(iconSize),
            tint = if (isFocused) Color.Black else Color.White
        )
    }
}

@Composable
private fun SmallControlButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    contentDescription: String,
    onClick: () -> Unit,
    enabled: Boolean = true
) {
    var isFocused by remember { mutableStateOf(false) }

    Box(
        modifier = Modifier
            .size(40.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(
                when {
                    isFocused -> MaterialTheme.colorScheme.primary
                    !enabled -> Color.Transparent
                    else -> Color.White.copy(alpha = 0.1f)
                }
            )
            .onFocusChanged { isFocused = it.isFocused }
            .focusable(enabled)
            .onKeyEvent { event ->
                if (enabled && event.type == KeyEventType.KeyDown &&
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
            imageVector = icon,
            contentDescription = contentDescription,
            modifier = Modifier.size(22.dp),
            tint = when {
                isFocused -> Color.Black
                !enabled -> Color.White.copy(alpha = 0.3f)
                else -> Color.White.copy(alpha = 0.8f)
            }
        )
    }
}

private fun formatTime(milliseconds: Long): String {
    if (milliseconds <= 0) return "0:00"

    val totalSeconds = milliseconds / 1000
    val hours = totalSeconds / 3600
    val minutes = (totalSeconds % 3600) / 60
    val seconds = totalSeconds % 60

    return if (hours > 0) {
        String.format("%d:%02d:%02d", hours, minutes, seconds)
    } else {
        String.format("%d:%02d", minutes, seconds)
    }
}
