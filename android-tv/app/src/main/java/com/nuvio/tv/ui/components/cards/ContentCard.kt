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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.Check
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
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
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
 * Styled to match the mobile app's ContentItem component.
 */
@OptIn(ExperimentalTvMaterial3Api::class)
@Composable
fun ContentCard(
    content: StreamingContent,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    showTitle: Boolean = true,
    cardWidth: Int = 160
) {
    var isFocused by remember { mutableStateOf(false) }

    val scale by animateFloatAsState(
        targetValue = if (isFocused) 1.05f else 1f,
        animationSpec = tween(durationMillis = 150),
        label = "cardScale"
    )

    val aspectRatio = when (content.posterShape) {
        PosterShape.POSTER -> 2f / 3f
        PosterShape.SQUARE -> 1f
        PosterShape.LANDSCAPE -> 16f / 9f
    }

    // Fixed height container to prevent jumping during focus animation
    val cardHeight = (cardWidth / aspectRatio).dp

    Column(
        modifier = modifier
            .width(cardWidth.dp)
            .height(cardHeight + 56.dp) // Card height + space for title
    ) {
        // Container box with fixed size to prevent layout shifts
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
                    .aspectRatio(aspectRatio)
                    .graphicsLayer {
                        scaleX = scale
                        scaleY = scale
                    }
                    .onFocusChanged { focusState ->
                        isFocused = focusState.isFocused
                    },
                scale = CardDefaults.scale(
                    focusedScale = 1f // We handle scale via graphicsLayer
                ),
                border = CardDefaults.border(
                    focusedBorder = Border(
                        border = BorderStroke(3.dp, MaterialTheme.colorScheme.primary),
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

                // Subtle gradient overlay at bottom
                Box(
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .fillMaxWidth()
                        .aspectRatio(3f)
                        .background(
                            Brush.verticalGradient(
                                colors = listOf(
                                    Color.Transparent,
                                    Color.Black.copy(alpha = 0.35f)
                                )
                            )
                        )
                )

                // Watched Badge (green checkmark - top right)
                if (content.watched) {
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .padding(6.dp)
                            .size(24.dp)
                            .clip(CircleShape)
                            .background(Color(0xFF4CAF50)), // Green
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Check,
                            contentDescription = "Watched",
                            tint = Color.White,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }

                // Library Badge (bookmark - top left)
                if (content.inLibrary) {
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopStart)
                            .padding(6.dp)
                            .size(24.dp)
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.primary),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Bookmark,
                            contentDescription = "In Library",
                            tint = Color.White,
                            modifier = Modifier.size(14.dp)
                        )
                    }
                }

                // Rating Badge (bottom right, only if no watched badge)
                if (!content.watched) {
                    content.imdbRating?.let { rating ->
                        Box(
                            modifier = Modifier
                                .align(Alignment.TopEnd)
                                .padding(6.dp)
                                .clip(NuvioShapes.badge)
                                .background(Color.Black.copy(alpha = 0.75f))
                                .padding(horizontal = 6.dp, vertical = 3.dp)
                        ) {
                            Text(
                                text = "★ $rating",
                                style = NuvioTypography.badge,
                                color = Color(0xFFF5C518) // IMDB Yellow
                            )
                        }
                    }
                }

                // Year Badge (for landscape cards only)
                if (content.posterShape == PosterShape.LANDSCAPE && content.year != null && !content.inLibrary) {
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopStart)
                            .padding(6.dp)
                            .clip(NuvioShapes.badge)
                            .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.9f))
                            .padding(horizontal = 6.dp, vertical = 3.dp)
                    ) {
                        Text(
                            text = content.year.toString(),
                            style = NuvioTypography.badge,
                            color = Color.White
                        )
                    }
                }

                // Watch Progress Indicator (bottom)
                if (content.watchProgress > 0f && content.watchProgress < 1f) {
                    Box(
                        modifier = Modifier
                            .align(Alignment.BottomCenter)
                            .fillMaxWidth()
                            .padding(horizontal = 4.dp, vertical = 4.dp)
                    ) {
                        // Track
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(NuvioShapes.progressBar)
                                .background(Color.White.copy(alpha = 0.3f))
                        ) {
                            // Progress
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth(content.watchProgress)
                                    .background(MaterialTheme.colorScheme.primary)
                                    .padding(vertical = 2.dp)
                            )
                        }
                    }
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
    modifier: Modifier = Modifier,
    cardWidth: Int = 140
) {
    ContentCard(
        content = content,
        onClick = onClick,
        modifier = modifier,
        showTitle = false,
        cardWidth = cardWidth
    )
}

/**
 * Large content card for featured sections.
 */
@Composable
fun LargeContentCard(
    content: StreamingContent,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    ContentCard(
        content = content,
        onClick = onClick,
        modifier = modifier,
        showTitle = true,
        cardWidth = 200
    )
}
