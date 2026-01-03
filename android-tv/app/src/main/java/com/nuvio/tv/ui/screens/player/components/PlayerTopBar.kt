package com.nuvio.tv.ui.screens.player.components

import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.unit.dp
import com.nuvio.tv.player.engine.EngineType
import com.nuvio.tv.ui.theme.NuvioShapes
import com.nuvio.tv.ui.theme.NuvioTypography

/**
 * Top bar for the video player.
 * Shows title, episode info, back button, and engine badge.
 */
@Composable
fun PlayerTopBar(
    title: String,
    episodeInfo: String? = null,
    playbackSpeed: Float = 1f,
    activeEngine: EngineType = EngineType.MPV,
    showEngineBadge: Boolean = false,
    backButtonFocusRequester: FocusRequester? = null,
    onBackClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(140.dp)
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        Color.Black.copy(alpha = 0.85f),
                        Color.Black.copy(alpha = 0.6f),
                        Color.Transparent
                    )
                )
            )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 48.dp, vertical = 32.dp),
            verticalAlignment = Alignment.Top,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            // Left side - Back button and title
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Back button
                BackButton(
                    focusRequester = backButtonFocusRequester,
                    onClick = onBackClick
                )

                Spacer(modifier = Modifier.width(24.dp))

                // Title and episode info
                Column {
                    Text(
                        text = title,
                        style = NuvioTypography.playerTitle,
                        color = Color.White
                    )
                    if (episodeInfo != null) {
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = episodeInfo,
                            style = NuvioTypography.playerSubtitle,
                            color = Color.White.copy(alpha = 0.7f)
                        )
                    }
                }
            }

            // Right side - Badges
            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Speed badge
                if (playbackSpeed != 1f) {
                    SpeedBadge(speed = playbackSpeed)
                }

                // Engine badge
                if (showEngineBadge) {
                    EngineBadge(engineType = activeEngine)
                }
            }
        }
    }
}

@Composable
private fun BackButton(
    focusRequester: FocusRequester?,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    var isFocused by remember { mutableStateOf(false) }

    Box(
        modifier = modifier
            .size(48.dp)
            .clip(NuvioShapes.playerButton)
            .background(
                if (isFocused) MaterialTheme.colorScheme.primary
                else Color.White.copy(alpha = 0.15f)
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
            },
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
            contentDescription = "Back",
            modifier = Modifier.size(28.dp),
            tint = if (isFocused) Color.Black else Color.White
        )
    }
}

@Composable
private fun SpeedBadge(
    speed: Float,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(4.dp))
            .background(MaterialTheme.colorScheme.primary)
            .padding(horizontal = 10.dp, vertical = 6.dp)
    ) {
        Text(
            text = "${speed}x",
            style = NuvioTypography.labelMedium,
            color = Color.Black
        )
    }
}

@Composable
private fun EngineBadge(
    engineType: EngineType,
    modifier: Modifier = Modifier
) {
    val (text, color) = when (engineType) {
        EngineType.MPV -> "MPV" to Color(0xFF9C27B0)  // Purple for MPV
        EngineType.EXOPLAYER -> "EXO" to Color(0xFF2196F3)  // Blue for ExoPlayer
    }

    Box(
        modifier = modifier
            .clip(RoundedCornerShape(4.dp))
            .background(color.copy(alpha = 0.8f))
            .padding(horizontal = 10.dp, vertical = 6.dp)
    ) {
        Text(
            text = text,
            style = NuvioTypography.labelMedium,
            color = Color.White
        )
    }
}
