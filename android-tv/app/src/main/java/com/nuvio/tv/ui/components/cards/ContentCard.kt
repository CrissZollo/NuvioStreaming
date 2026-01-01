package com.nuvio.tv.ui.components.cards

import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
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
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Border
import androidx.tv.material3.Card
import androidx.tv.material3.CardDefaults
import androidx.tv.material3.ExperimentalTvMaterial3Api
import coil.compose.AsyncImage
import com.nuvio.tv.domain.model.PosterShape
import com.nuvio.tv.domain.model.StreamingContent
import com.nuvio.tv.ui.theme.NuvioShapes
import com.nuvio.tv.ui.theme.NuvioTypography

/**
 * Content card for displaying movies and TV shows.
 * Features focus animations optimized for D-pad navigation.
 */
@OptIn(ExperimentalTvMaterial3Api::class)
@Composable
fun ContentCard(
    content: StreamingContent,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    showTitle: Boolean = true
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

    val aspectRatio = when (content.posterShape) {
        PosterShape.POSTER -> 2f / 3f
        PosterShape.SQUARE -> 1f
        PosterShape.LANDSCAPE -> 16f / 9f
    }

    Column(
        modifier = modifier.width(160.dp)
    ) {
        Card(
            onClick = onClick,
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(aspectRatio)
                .scale(scale)
                .onFocusChanged { focusState ->
                    isFocused = focusState.isFocused
                },
            scale = CardDefaults.scale(
                focusedScale = 1f // We handle scale manually
            ),
            border = CardDefaults.border(
                focusedBorder = Border(
                    border = BorderStroke(borderWidth, MaterialTheme.colorScheme.primary),
                    shape = NuvioShapes.card
                )
            ),
            shape = CardDefaults.shape(
                shape = NuvioShapes.card
            ),
            colors = CardDefaults.colors(
                containerColor = MaterialTheme.colorScheme.surface
            )
        ) {
            Box(modifier = Modifier.fillMaxSize()) {
                // Poster Image
                AsyncImage(
                    model = content.poster,
                    contentDescription = content.name,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )

                // Gradient Overlay at bottom
                Box(
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .fillMaxWidth()
                        .aspectRatio(2f)
                        .background(
                            Brush.verticalGradient(
                                colors = listOf(
                                    Color.Transparent,
                                    Color.Black.copy(alpha = 0.8f)
                                )
                            )
                        )
                )

                // Rating Badge
                content.imdbRating?.let { rating ->
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .padding(8.dp)
                            .clip(NuvioShapes.badge)
                            .background(Color.Black.copy(alpha = 0.7f))
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = rating,
                            style = NuvioTypography.badge,
                            color = Color(0xFFF5C518) // IMDB Yellow
                        )
                    }
                }

                // Year Badge (for landscape cards)
                if (content.posterShape == PosterShape.LANDSCAPE && content.year != null) {
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopStart)
                            .padding(8.dp)
                            .clip(NuvioShapes.badge)
                            .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.9f))
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = content.year.toString(),
                            style = NuvioTypography.badge,
                            color = Color.White
                        )
                    }
                }
            }
        }

        // Title below card
        if (showTitle) {
            Text(
                text = content.name,
                style = NuvioTypography.bodySmall,
                color = if (isFocused) {
                    MaterialTheme.colorScheme.primary
                } else {
                    MaterialTheme.colorScheme.onBackground.copy(alpha = 0.8f)
                },
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp, start = 4.dp, end = 4.dp)
            )
        }
    }
}

/**
 * Compact content card without title, for use in carousels.
 */
@Composable
fun CompactContentCard(
    content: StreamingContent,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    ContentCard(
        content = content,
        onClick = onClick,
        modifier = modifier,
        showTitle = false
    )
}
