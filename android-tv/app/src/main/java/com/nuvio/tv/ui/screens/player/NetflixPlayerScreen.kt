package com.nuvio.tv.ui.screens.player

import android.view.SurfaceView
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
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
import com.nuvio.tv.player.PlaybackStateHolder
import com.nuvio.tv.player.engine.EngineType
import com.nuvio.tv.ui.screens.player.components.BufferingOverlay
import com.nuvio.tv.ui.screens.player.components.EngineSwitchNotification
import com.nuvio.tv.ui.screens.player.components.ErrorOverlay
import com.nuvio.tv.ui.screens.player.components.PlayPauseIndicator
import com.nuvio.tv.ui.screens.player.components.PlaybackInfoOverlay
import com.nuvio.tv.ui.screens.player.components.PlayerBottomBar
import com.nuvio.tv.ui.screens.player.components.PlayerTopBar
import com.nuvio.tv.ui.screens.player.components.SkipDirection
import com.nuvio.tv.ui.screens.player.components.SkipIndicator
import com.nuvio.tv.ui.screens.player.panels.NextEpisodeInfo
import com.nuvio.tv.ui.screens.player.panels.TrackPanelType
import com.nuvio.tv.ui.screens.player.panels.TrackSelectionPanel
import com.nuvio.tv.ui.screens.player.panels.UpNextPanel
import kotlinx.coroutines.delay

/**
 * Netflix-style video player screen with unified engine support.
 *
 * This screen can be called in two ways:
 * 1. With navigation parameters (contentType, contentId) - stream is obtained from PlaybackStateHolder
 * 2. Directly with a Stream object for testing or embedding
 */
@Composable
fun NetflixPlayerScreen(
    contentId: String,
    contentType: String,
    stream: Stream? = null,
    contentTitle: String? = null,
    episodeTitle: String? = null,
    episodeId: String? = null,
    seasonNumber: Int? = null,
    episodeNumber: Int? = null,
    poster: String? = null,
    startPosition: Long = 0L,
    nextEpisode: NextEpisodeInfo? = null,
    viewModel: UnifiedPlayerViewModel = hiltViewModel(),
    onBackClick: () -> Unit,
    onPlayNextEpisode: ((NextEpisodeInfo) -> Unit)? = null
) {
    val playerState by viewModel.playerState.collectAsState()
    val playerUiState by viewModel.uiState.collectAsState()

    // Get playback request from holder if stream not provided directly
    val playbackRequest = remember { viewModel.getPlaybackRequest() }
    val actualStream = stream ?: playbackRequest?.stream
    val actualContentTitle = contentTitle ?: playbackRequest?.content?.name ?: "Unknown"
    val actualEpisodeTitle = episodeTitle ?: playbackRequest?.episodeTitle
    val actualStartPosition = if (startPosition > 0) startPosition else (playbackRequest?.startPosition ?: 0L)

    // Focus requesters for navigation
    val screenFocusRequester = remember { FocusRequester() }
    val backButtonFocusRequester = remember { FocusRequester() }
    val playPauseFocusRequester = remember { FocusRequester() }
    val seekBarFocusRequester = remember { FocusRequester() }
    // Additional focus requesters for controls below the seek bar
    val subtitleFocusRequester = remember { FocusRequester() }
    val audioFocusRequester = remember { FocusRequester() }
    val rewindFocusRequester = remember { FocusRequester() }
    val forwardFocusRequester = remember { FocusRequester() }
    val qualityFocusRequester = remember { FocusRequester() }
    val speedFocusRequester = remember { FocusRequester() }

    // UI state
    var showControls by remember { mutableStateOf(true) }
    var lastInteractionTime by remember { mutableLongStateOf(System.currentTimeMillis()) }
    var showSkipIndicator by remember { mutableStateOf<SkipDirection?>(null) }
    var playPauseTrigger by remember { mutableIntStateOf(0) }
    var isSeeking by remember { mutableStateOf(false) }
    var seekPreviewPosition by remember { mutableLongStateOf(0L) }
    var showPlaybackInfo by remember { mutableStateOf(false) }
    var showEngineSwitchNotification by remember { mutableStateOf(false) }
    var engineSwitchInfo by remember { mutableStateOf<Triple<EngineType, EngineType, String>?>(null) }

    // Panel state
    var activePanelType by remember { mutableStateOf<TrackPanelType?>(null) }

    // Auto-hide controls after 5 seconds
    LaunchedEffect(showControls, lastInteractionTime) {
        if (showControls && !playerState.engineState.isBuffering && activePanelType == null) {
            delay(5000)
            if (System.currentTimeMillis() - lastInteractionTime >= 5000) {
                showControls = false
            }
        }
    }

    // Hide skip indicator after showing
    LaunchedEffect(showSkipIndicator) {
        if (showSkipIndicator != null) {
            delay(800)
            showSkipIndicator = null
        }
    }

    // Initialize player
    LaunchedEffect(actualStream) {
        viewModel.initialize()
        actualStream?.let { stream ->
            viewModel.playStream(stream, actualStartPosition)
        }
    }

    // If no stream available, show error
    if (actualStream == null) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black),
            contentAlignment = Alignment.Center
        ) {
            ErrorOverlay(
                visible = true,
                errorMessage = "No stream available. Please select a stream first.",
                canRetry = false,
                onRetry = {},
                onDismiss = onBackClick
            )
        }
        return
    }

    // Handle lifecycle
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_PAUSE -> viewModel.pause()
                Lifecycle.Event.ON_RESUME -> if (playerState.engineState.isPlaying) viewModel.play()
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
        when {
            activePanelType != null -> activePanelType = null
            showControls -> showControls = false
            else -> {
                viewModel.release()
                onBackClick()
            }
        }
    }

    // Check for Up Next trigger (90% progress)
    val showUpNext = remember(playerState.engineState.currentPosition, playerState.engineState.duration) {
        nextEpisode != null &&
        contentType == "series" &&
        playerState.engineState.duration > 0 &&
        playerState.engineState.currentPosition > playerState.engineState.duration * 0.90 &&
        !playerState.engineState.isEnded
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
            .focusRequester(screenFocusRequester)
            .focusable()
            .onKeyEvent { event ->
                if (event.type == KeyEventType.KeyDown) {
                    lastInteractionTime = System.currentTimeMillis()

                    // Don't handle keys when panel is open
                    if (activePanelType != null) return@onKeyEvent false

                    when (event.key) {
                        Key.DirectionCenter, Key.Enter -> {
                            if (!showControls) {
                                showControls = true
                                true
                            } else {
                                // Let focused control handle the click
                                false
                            }
                        }
                        Key.DirectionLeft -> {
                            if (!showControls) {
                                showControls = true
                                true
                            } else {
                                // Let focus navigation handle it when controls are visible
                                false
                            }
                        }
                        Key.DirectionRight -> {
                            if (!showControls) {
                                showControls = true
                                true
                            } else {
                                // Let focus navigation handle it when controls are visible
                                false
                            }
                        }
                        Key.DirectionUp, Key.DirectionDown -> {
                            if (!showControls) {
                                showControls = true
                                true
                            } else {
                                // Let focus navigation handle it when controls are visible
                                false
                            }
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
                            playPauseTrigger++
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
                            viewModel.seekForward(30_000L)
                            showSkipIndicator = SkipDirection.FORWARD
                            true
                        }
                        Key.MediaRewind -> {
                            viewModel.seekBackward(30_000L)
                            showSkipIndicator = SkipDirection.BACKWARD
                            true
                        }
                        Key.Info -> {
                            showPlaybackInfo = !showPlaybackInfo
                            true
                        }
                        else -> false
                    }
                } else {
                    false
                }
            }
    ) {
        // Video Surface
        VideoSurface(
            activeEngine = playerState.activeEngine,
            viewModel = viewModel,
            modifier = Modifier.fillMaxSize()
        )

        // Buffering Overlay
        BufferingOverlay(
            isBuffering = playerState.engineState.isBuffering,
            bufferedPercent = playerState.engineState.bufferedPercent
        )

        // Play/Pause Indicator
        PlayPauseIndicator(
            isPlaying = playerState.engineState.isPlaying,
            trigger = playPauseTrigger,
            modifier = Modifier.align(Alignment.Center)
        )

        // Skip Indicator
        SkipIndicator(
            direction = showSkipIndicator ?: SkipDirection.FORWARD,
            seconds = 10,
            visible = showSkipIndicator != null,
            modifier = Modifier.align(Alignment.Center)
        )

        // Controls Overlay
        AnimatedVisibility(
            visible = showControls,
            enter = fadeIn(),
            exit = fadeOut()
        ) {
            Box(modifier = Modifier.fillMaxSize()) {
                // Top Bar
                PlayerTopBar(
                    title = actualContentTitle,
                    episodeInfo = if (actualEpisodeTitle != null && seasonNumber != null && episodeNumber != null) {
                        "S$seasonNumber E$episodeNumber • $actualEpisodeTitle"
                    } else actualEpisodeTitle,
                    playbackSpeed = playerState.engineState.playbackSpeed,
                    activeEngine = playerState.activeEngine,
                    showEngineBadge = playerState.isFallbackActive,
                    backButtonFocusRequester = backButtonFocusRequester,
                    onBackClick = {
                        viewModel.release()
                        onBackClick()
                    },
                    modifier = Modifier.align(Alignment.TopCenter)
                )

                // Bottom Bar
                PlayerBottomBar(
                    currentPosition = playerState.engineState.currentPosition,
                    duration = playerState.engineState.duration,
                    bufferedPosition = playerState.engineState.bufferedPosition,
                    isPlaying = playerState.engineState.isPlaying,
                    isSeeking = isSeeking,
                    seekPreviewPosition = seekPreviewPosition,
                    hasSubtitles = playerState.engineState.subtitleTracks.isNotEmpty(),
                    hasAudioTracks = playerState.engineState.audioTracks.size > 1,
                    hasQualityLevels = playerState.engineState.qualityLevels.isNotEmpty(),
                    subtitleSelected = playerState.engineState.selectedSubtitleTrack >= 0,
                    currentAudioTrack = playerState.engineState.audioTracks
                        .getOrNull(playerState.engineState.selectedAudioTrack)?.language,
                    currentQuality = playerState.engineState.qualityLevels
                        .getOrNull(playerState.engineState.selectedQualityLevel)?.label,
                    currentSpeed = playerState.engineState.playbackSpeed,
                    // Focus requesters for all controls
                    seekBarFocusRequester = seekBarFocusRequester,
                    subtitleFocusRequester = subtitleFocusRequester,
                    audioFocusRequester = audioFocusRequester,
                    rewindFocusRequester = rewindFocusRequester,
                    playPauseFocusRequester = playPauseFocusRequester,
                    forwardFocusRequester = forwardFocusRequester,
                    qualityFocusRequester = qualityFocusRequester,
                    speedFocusRequester = speedFocusRequester,
                    onSeekStart = {
                        isSeeking = true
                        seekPreviewPosition = playerState.engineState.currentPosition
                    },
                    onSeekChange = { progress ->
                        seekPreviewPosition = (progress * playerState.engineState.duration).toLong()
                    },
                    onSeekEnd = { progress ->
                        val position = (progress * playerState.engineState.duration).toLong()
                        viewModel.seekTo(position)
                        isSeeking = false
                    },
                    onPlayPause = {
                        viewModel.togglePlayPause()
                        playPauseTrigger++
                    },
                    onRewind = {
                        viewModel.seekBackward()
                        showSkipIndicator = SkipDirection.BACKWARD
                    },
                    onForward = {
                        viewModel.seekForward()
                        showSkipIndicator = SkipDirection.FORWARD
                    },
                    onSubtitleClick = { activePanelType = TrackPanelType.SUBTITLE },
                    onAudioClick = { activePanelType = TrackPanelType.AUDIO },
                    onQualityClick = { activePanelType = TrackPanelType.QUALITY },
                    onSpeedClick = { activePanelType = TrackPanelType.SPEED },
                    modifier = Modifier.align(Alignment.BottomCenter)
                )
            }
        }

        // Track Selection Panel
        TrackSelectionPanel(
            visible = activePanelType != null,
            panelType = activePanelType ?: TrackPanelType.SUBTITLE,
            subtitleTracks = playerState.engineState.subtitleTracks,
            selectedSubtitleIndex = playerState.engineState.selectedSubtitleTrack,
            audioTracks = playerState.engineState.audioTracks,
            selectedAudioIndex = playerState.engineState.selectedAudioTrack,
            qualityLevels = playerState.engineState.qualityLevels,
            selectedQualityIndex = playerState.engineState.selectedQualityLevel,
            currentSpeed = playerState.engineState.playbackSpeed,
            onSubtitleSelect = { index ->
                viewModel.selectSubtitleTrack(index)
                activePanelType = null
            },
            onAudioSelect = { index ->
                viewModel.selectAudioTrack(index)
                activePanelType = null
            },
            onQualitySelect = { index ->
                viewModel.selectQualityLevel(index)
                activePanelType = null
            },
            onSpeedSelect = { speed ->
                viewModel.setPlaybackSpeed(speed)
                activePanelType = null
            },
            onDismiss = { activePanelType = null }
        )

        // Up Next Panel
        if (showUpNext && nextEpisode != null) {
            UpNextPanel(
                visible = true,
                nextEpisode = nextEpisode,
                countdownSeconds = 10,
                autoPlayEnabled = true,
                onPlayNext = {
                    viewModel.release()
                    onPlayNextEpisode?.invoke(nextEpisode)
                },
                onCancel = {
                    // User cancelled auto-play
                },
                modifier = Modifier.align(Alignment.BottomCenter)
            )
        }

        // Playback Info Overlay (Debug)
        PlaybackInfoOverlay(
            visible = showPlaybackInfo,
            currentBitrate = playerState.engineState.currentBitrate,
            currentResolution = playerState.engineState.currentResolution,
            currentCodec = playerState.engineState.currentCodec,
            decoderType = playerState.engineState.decoderType,
            activeEngine = playerState.activeEngine,
            bufferedPercent = playerState.engineState.bufferedPercent,
            position = playerState.engineState.currentPosition,
            duration = playerState.engineState.duration,
            modifier = Modifier
                .align(Alignment.TopStart)
                .padding(16.dp)
        )

        // Engine Switch Notification
        EngineSwitchNotification(
            visible = showEngineSwitchNotification,
            fromEngine = engineSwitchInfo?.first ?: EngineType.MPV,
            toEngine = engineSwitchInfo?.second ?: EngineType.EXOPLAYER,
            reason = engineSwitchInfo?.third ?: "",
            modifier = Modifier.align(Alignment.Center)
        )

        // Error Overlay
        ErrorOverlay(
            visible = playerState.engineState.error != null,
            errorMessage = playerState.engineState.error ?: "",
            canRetry = true,
            onRetry = {
                actualStream?.let { viewModel.playStream(it, playerState.engineState.currentPosition) }
            },
            onDismiss = {
                viewModel.release()
                onBackClick()
            }
        )
    }

    // Request focus when screen appears
    LaunchedEffect(Unit) {
        screenFocusRequester.requestFocus()
    }

    // Request focus on play/pause button when controls become visible
    LaunchedEffect(showControls) {
        if (showControls) {
            try {
                playPauseFocusRequester.requestFocus()
            } catch (e: Exception) {
                // Focus requester may not be attached yet
            }
        }
    }
}

@Composable
private fun VideoSurface(
    activeEngine: EngineType,
    viewModel: UnifiedPlayerViewModel,
    modifier: Modifier = Modifier
) {
    when (activeEngine) {
        EngineType.MPV -> {
            // MPV uses SurfaceView
            val surfaceView = viewModel.getMpvSurfaceView()
            if (surfaceView != null) {
                AndroidView(
                    factory = { surfaceView },
                    modifier = modifier
                )
            }
        }
        EngineType.EXOPLAYER -> {
            // ExoPlayer uses PlayerView
            val exoPlayer = viewModel.getExoPlayer()
            if (exoPlayer != null) {
                AndroidView(
                    factory = { context ->
                        PlayerView(context).apply {
                            player = exoPlayer
                            useController = false
                            setShowBuffering(PlayerView.SHOW_BUFFERING_NEVER)
                        }
                    },
                    modifier = modifier
                )
            }
        }
    }
}
