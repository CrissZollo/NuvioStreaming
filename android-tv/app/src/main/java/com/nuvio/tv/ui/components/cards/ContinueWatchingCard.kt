package com.nuvio.tv.ui.components.cards

import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.LinearProgressIndicator
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
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Border
import androidx.tv.material3.Card
import androidx.tv.material3.CardDefaults
import androidx.tv.material3.ExperimentalTvMaterial3Api
import coil.compose.AsyncImage
import com.nuvio.tv.ui.screens.home.ContinueWatchingItem
import com.nuvio.tv.ui.theme.NuvioShapes
import com.nuvio.tv.ui.theme.NuvioTypography

/**
 * Card for Continue Watching section with progress bar overlay.
 */
@OptIn(ExperimentalTvMaterial3Api::class)
@Composable
fun ContinueWatchingCard(
    item: ContinueWatchingItem,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    var isFocused by remember { mutableStateOf(false) }

    val scale by animateFloatAsState(
        targetValue = if (isFocused) 1.08f else 1f,
        animationSpec = tween(durationMillis = 150),
        label = "cardScale"
    )

    val borderWidth by animateDpAsState(
        targetValue = if (isFocused) 3.dp else 0.dp,
        animationSpec = tween(durationMillis = 150),
        label = "borderWidth"
    )

    // Fixed height container to prevent layout jumping
    // 220dp width, 16/9 aspect = ~124dp + 40dp title space = 164dp
    // Add extra for scale animation overflow
    val cardHeight = 124.dp
    val totalHeight = cardHeight + 48.dp

    Column(
        modifier = modifier
            .width(220.dp)
            .height(totalHeight)
    ) {
        // Fixed height box to contain the scaling card
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(cardHeight),
            contentAlignment = Alignment.Center
        ) {
        Card(
            onClick = onClick,
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(16f / 9f)
                .graphicsLayer {
                    scaleX = scale
                    scaleY = scale
                }
                .onFocusChanged { focusState ->
                    isFocused = focusState.isFocused
                },
            scale = CardDefaults.scale(focusedScale = 1f),
            border = CardDefaults.border(
                focusedBorder = Border(
                    border = BorderStroke(borderWidth, MaterialTheme.colorScheme.primary),
                    shape = NuvioShapes.card
                )
            ),
            shape = CardDefaults.shape(shape = NuvioShapes.card),
            colors = CardDefaults.colors(containerColor = MaterialTheme.colorScheme.surface)
        ) {
            Box(modifier = Modifier.fillMaxSize()) {
                // Poster/Thumbnail
                AsyncImage(
                    model = item.content.poster,
                    contentDescription = item.content.name,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )

                // Gradient Overlay
                Box(
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .fillMaxWidth()
                        .height(60.dp)
                        .background(
                            Brush.verticalGradient(
                                colors = listOf(
                                    Color.Transparent,
                                    Color.Black.copy(alpha = 0.9f)
                                )
                            )
                        )
                )

                // Episode Info Badge
                item.episodeInfo?.let { epInfo ->
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopStart)
                            .padding(8.dp)
                            .clip(NuvioShapes.badge)
                            .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.9f))
                            .padding(horizontal = 8.dp, vertical = 4.dp)
                    ) {
                        Text(
                            text = epInfo,
                            style = NuvioTypography.badge,
                            color = Color.White
                        )
                    }
                }

                // Progress Bar at bottom
                Column(
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .fillMaxWidth()
                        .padding(horizontal = 8.dp, vertical = 8.dp)
                ) {
                    // Time remaining
                    val remainingMinutes = ((1 - item.progress.progress) * item.progress.duration / 60000).toInt()
                    if (remainingMinutes > 0) {
                        Text(
                            text = "${remainingMinutes}m remaining",
                            style = NuvioTypography.labelSmall,
                            color = Color.White.copy(alpha = 0.8f),
                            modifier = Modifier.padding(bottom = 4.dp)
                        )
                    }

                    // Progress indicator
                    LinearProgressIndicator(
                        progress = { item.progress.progress },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(4.dp)
                            .clip(RoundedCornerShape(2.dp)),
                        color = MaterialTheme.colorScheme.primary,
                        trackColor = Color.White.copy(alpha = 0.3f)
                    )
                }
            }
        }
        }

        // Title below card
        Text(
            text = item.content.name,
            style = NuvioTypography.bodySmall,
            color = if (isFocused) {
                MaterialTheme.colorScheme.primary
            } else {
                MaterialTheme.colorScheme.onBackground.copy(alpha = 0.8f)
            },
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 8.dp, start = 4.dp, end = 4.dp)
        )
    }
}
