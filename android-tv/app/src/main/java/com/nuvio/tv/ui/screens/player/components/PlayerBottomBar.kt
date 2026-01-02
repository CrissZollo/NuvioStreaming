package com.nuvio.tv.ui.screens.player.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.nuvio.tv.ui.theme.NuvioTypography

/**
 * Bottom bar for the Netflix-style player.
 * Contains seek bar, time display, and playback controls.
 */
@Composable
fun PlayerBottomBar(
    currentPosition: Long,
    duration: Long,
    bufferedPosition: Long,
    isPlaying: Boolean,
    isSeeking: Boolean = false,
    seekPreviewPosition: Long = currentPosition,
    hasSubtitles: Boolean = false,
    hasAudioTracks: Boolean = false,
    hasQualityLevels: Boolean = false,
    subtitleSelected: Boolean = false,
    currentAudioTrack: String? = null,
    currentQuality: String? = null,
    currentSpeed: Float = 1f,
    // Focus requesters for navigation
    seekBarFocusRequester: FocusRequester? = null,
    subtitleFocusRequester: FocusRequester? = null,
    audioFocusRequester: FocusRequester? = null,
    rewindFocusRequester: FocusRequester? = null,
    playPauseFocusRequester: FocusRequester? = null,
    forwardFocusRequester: FocusRequester? = null,
    qualityFocusRequester: FocusRequester? = null,
    speedFocusRequester: FocusRequester? = null,
    // Callbacks
    onSeekStart: () -> Unit = {},
    onSeekChange: (Float) -> Unit = {},
    onSeekEnd: (Float) -> Unit = {},
    onPlayPause: () -> Unit = {},
    onRewind: () -> Unit = {},
    onForward: () -> Unit = {},
    onSubtitleClick: () -> Unit = {},
    onAudioClick: () -> Unit = {},
    onQualityClick: () -> Unit = {},
    onSpeedClick: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val progress = if (duration > 0) currentPosition.toFloat() / duration else 0f
    val bufferedProgress = if (duration > 0) bufferedPosition.toFloat() / duration else 0f
    val seekPreviewProgress = if (duration > 0) seekPreviewPosition.toFloat() / duration else 0f

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(240.dp)
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        Color.Transparent,
                        Color.Black.copy(alpha = 0.6f),
                        Color.Black.copy(alpha = 0.9f)
                    )
                )
            )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.BottomCenter)
                .padding(horizontal = 48.dp, vertical = 32.dp)
        ) {
            // Seek bar
            SeekBar(
                progress = progress,
                bufferedProgress = bufferedProgress,
                isSeeking = isSeeking,
                seekPreviewProgress = seekPreviewProgress,
                focusRequester = seekBarFocusRequester,
                onSeekStart = onSeekStart,
                onSeekChange = onSeekChange,
                onSeekEnd = onSeekEnd
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Time display
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = formatTime(if (isSeeking) seekPreviewPosition else currentPosition),
                    style = NuvioTypography.playerTime,
                    color = Color.White
                )
                Text(
                    text = formatTime(duration),
                    style = NuvioTypography.playerTime,
                    color = Color.White.copy(alpha = 0.6f)
                )
            }

            Spacer(modifier = Modifier.height(20.dp))

            // Controls row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Left controls (Subtitles, Audio)
                SecondaryLeftControls(
                    hasSubtitles = hasSubtitles,
                    hasAudioTracks = hasAudioTracks,
                    subtitleSelected = subtitleSelected,
                    currentAudioTrack = currentAudioTrack,
                    subtitleFocusRequester = subtitleFocusRequester,
                    audioFocusRequester = audioFocusRequester,
                    onSubtitleClick = onSubtitleClick,
                    onAudioClick = onAudioClick
                )

                // Center controls (Rewind, Play/Pause, Forward)
                MainPlaybackControls(
                    isPlaying = isPlaying,
                    rewindFocusRequester = rewindFocusRequester,
                    playPauseFocusRequester = playPauseFocusRequester,
                    forwardFocusRequester = forwardFocusRequester,
                    onRewind = onRewind,
                    onPlayPause = onPlayPause,
                    onForward = onForward
                )

                // Right controls (Quality, Speed)
                SecondaryRightControls(
                    hasQualityLevels = hasQualityLevels,
                    currentQuality = currentQuality,
                    currentSpeed = currentSpeed,
                    qualityFocusRequester = qualityFocusRequester,
                    speedFocusRequester = speedFocusRequester,
                    onQualityClick = onQualityClick,
                    onSpeedClick = onSpeedClick
                )
            }
        }
    }
}

/**
 * Format milliseconds to time string (H:MM:SS or M:SS).
 */
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
