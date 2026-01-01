package com.nuvio.tv.ui.components.carousels

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
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
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.nuvio.tv.domain.model.StreamingContent
import com.nuvio.tv.ui.theme.NuvioShapes
import com.nuvio.tv.ui.theme.NuvioTypography
import kotlinx.coroutines.delay
import kotlin.math.abs

/**
 * Hero carousel for featured content at the top of the home screen.
 * Features auto-advancement, parallax effects, and D-pad navigation.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun HeroCarousel(
    items: List<StreamingContent>,
    onItemClick: (StreamingContent) -> Unit,
    modifier: Modifier = Modifier,
    autoAdvanceDelayMs: Long = 8000
) {
    if (items.isEmpty()) return

    val pagerState = rememberPagerState(
        initialPage = 0,
        pageCount = { items.size }
    )

    var isPaused by remember { mutableStateOf(false) }

    // Auto-advance
    LaunchedEffect(pagerState, isPaused) {
        if (!isPaused && items.size > 1) {
            while (true) {
                delay(autoAdvanceDelayMs)
                val nextPage = (pagerState.currentPage + 1) % items.size
                pagerState.animateScrollToPage(nextPage)
            }
        }
    }

    Box(modifier = modifier) {
        HorizontalPager(
            state = pagerState,
            modifier = Modifier
                .fillMaxSize()
                .onFocusChanged { focusState ->
                    isPaused = focusState.hasFocus
                }
        ) { page ->
            val content = items[page]

            // Calculate parallax offset
            val pageOffset = (pagerState.currentPage - page) + pagerState.currentPageOffsetFraction

            HeroItem(
                content = content,
                pageOffset = pageOffset,
                onPlayClick = { onItemClick(content) },
                modifier = Modifier.fillMaxSize()
            )
        }

        // Page Indicator
        Row(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 24.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            repeat(items.size) { index ->
                val isSelected = pagerState.currentPage == index

                Box(
                    modifier = Modifier
                        .size(
                            width = if (isSelected) 24.dp else 8.dp,
                            height = 8.dp
                        )
                        .clip(CircleShape)
                        .background(
                            if (isSelected) {
                                MaterialTheme.colorScheme.primary
                            } else {
                                Color.White.copy(alpha = 0.5f)
                            }
                        )
                        .animateContentSize()
                )
            }
        }
    }
}

/**
 * Individual hero item with content information and parallax effect.
 */
@Composable
private fun HeroItem(
    content: StreamingContent,
    pageOffset: Float,
    onPlayClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    var isButtonFocused by remember { mutableStateOf(false) }

    val buttonScale by animateFloatAsState(
        targetValue = if (isButtonFocused) 1.1f else 1f,
        animationSpec = tween(150),
        label = "buttonScale"
    )

    Box(modifier = modifier) {
        // Background Image with Parallax
        AsyncImage(
            model = content.background ?: content.poster,
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier
                .fillMaxSize()
                .graphicsLayer {
                    // Parallax effect
                    translationX = pageOffset * size.width * 0.1f
                    alpha = 1f - abs(pageOffset) * 0.3f
                }
        )

        // Gradient Overlays
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.horizontalGradient(
                        colors = listOf(
                            MaterialTheme.colorScheme.background.copy(alpha = 0.9f),
                            MaterialTheme.colorScheme.background.copy(alpha = 0.5f),
                            Color.Transparent
                        ),
                        startX = 0f,
                        endX = Float.POSITIVE_INFINITY * 0.6f
                    )
                )
        )

        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            Color.Transparent,
                            MaterialTheme.colorScheme.background.copy(alpha = 0.8f)
                        ),
                        startY = Float.POSITIVE_INFINITY * 0.5f
                    )
                )
        )

        // Content Info
        Column(
            modifier = Modifier
                .align(Alignment.CenterStart)
                .padding(start = 48.dp, end = 48.dp)
                .fillMaxWidth(0.5f)
        ) {
            // Title
            Text(
                text = content.name,
                style = NuvioTypography.displaySmall,
                color = Color.White,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Metadata Row
            Row(
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                content.year?.let { year ->
                    Text(
                        text = year.toString(),
                        style = NuvioTypography.bodyLarge,
                        color = Color.White.copy(alpha = 0.8f)
                    )
                }

                content.imdbRating?.let { rating ->
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "⭐",
                            style = NuvioTypography.bodyLarge
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = rating,
                            style = NuvioTypography.bodyLarge,
                            color = Color(0xFFF5C518)
                        )
                    }
                }

                content.genres.take(2).forEach { genre ->
                    Box(
                        modifier = Modifier
                            .clip(NuvioShapes.chip)
                            .background(Color.White.copy(alpha = 0.15f))
                            .padding(horizontal = 12.dp, vertical = 4.dp)
                    ) {
                        Text(
                            text = genre,
                            style = NuvioTypography.labelMedium,
                            color = Color.White.copy(alpha = 0.9f)
                        )
                    }
                }
            }

            // Description
            content.description?.let { description ->
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = description,
                    style = NuvioTypography.bodyLarge,
                    color = Color.White.copy(alpha = 0.7f),
                    maxLines = 3,
                    overflow = TextOverflow.Ellipsis
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Play Button
            Button(
                onClick = onPlayClick,
                modifier = Modifier
                    .graphicsLayer {
                        scaleX = buttonScale
                        scaleY = buttonScale
                    }
                    .onFocusChanged { focusState ->
                        isButtonFocused = focusState.isFocused
                    }
                    .focusable()
                    .onKeyEvent { event ->
                        if (event.type == KeyEventType.KeyDown &&
                            (event.key == Key.DirectionCenter || event.key == Key.Enter)
                        ) {
                            onPlayClick()
                            true
                        } else {
                            false
                        }
                    },
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    contentColor = Color.White
                ),
                shape = NuvioShapes.full
            ) {
                Icon(
                    imageVector = Icons.Filled.PlayArrow,
                    contentDescription = null,
                    modifier = Modifier.size(24.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Watch Now",
                    style = NuvioTypography.labelLarge
                )
            }
        }
    }
}
