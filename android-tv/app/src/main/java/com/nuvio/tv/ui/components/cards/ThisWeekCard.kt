package com.nuvio.tv.ui.components.cards

import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
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
import androidx.compose.ui.draw.scale
import androidx.compose.ui.focus.onFocusChanged
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
import com.nuvio.tv.ui.screens.home.ThisWeekItem
import com.nuvio.tv.ui.theme.NuvioShapes
import com.nuvio.tv.ui.theme.NuvioTypography

/**
 * Card for This Week section (upcoming episodes from Trakt calendar).
 */
@OptIn(ExperimentalTvMaterial3Api::class)
@Composable
fun ThisWeekCard(
    item: ThisWeekItem,
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

    Column(
        modifier = modifier.width(200.dp)
    ) {
        Card(
            onClick = onClick,
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(16f / 9f)
                .scale(scale)
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
                if (item.poster != null) {
                    AsyncImage(
                        model = item.poster,
                        contentDescription = item.showTitle,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize()
                    )
                } else {
                    // Placeholder gradient when no poster
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(
                                Brush.linearGradient(
                                    colors = listOf(
                                        MaterialTheme.colorScheme.primary.copy(alpha = 0.5f),
                                        MaterialTheme.colorScheme.secondary.copy(alpha = 0.3f)
                                    )
                                )
                            )
                    )
                }

                // Gradient Overlay
                Box(
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .fillMaxWidth()
                        .height(80.dp)
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
                Box(
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(8.dp)
                        .clip(NuvioShapes.badge)
                        .background(MaterialTheme.colorScheme.tertiary.copy(alpha = 0.9f))
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = item.episodeInfo,
                        style = NuvioTypography.badge,
                        color = Color.White
                    )
                }

                // Air Date Badge
                Box(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(8.dp)
                        .clip(NuvioShapes.badge)
                        .background(Color.Black.copy(alpha = 0.7f))
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = formatDisplayDate(item.airDate),
                        style = NuvioTypography.badge,
                        color = Color.White
                    )
                }

                // Episode Title at bottom
                Column(
                    modifier = Modifier
                        .align(Alignment.BottomStart)
                        .fillMaxWidth()
                        .padding(horizontal = 10.dp, vertical = 10.dp)
                ) {
                    Text(
                        text = item.episodeTitle,
                        style = NuvioTypography.labelMedium,
                        color = Color.White,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
        }

        // Show Title below card
        Text(
            text = item.showTitle,
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

/**
 * Format date for display (e.g., "Today", "Tomorrow", "Mon", etc.)
 */
private fun formatDisplayDate(dateString: String): String {
    return try {
        val today = java.time.LocalDate.now()
        val date = java.time.LocalDate.parse(dateString.substringBefore("T"))

        when {
            date == today -> "Today"
            date == today.plusDays(1) -> "Tomorrow"
            else -> date.dayOfWeek.name.take(3).lowercase().replaceFirstChar { it.uppercase() }
        }
    } catch (e: Exception) {
        dateString.take(10)
    }
}
