package com.nuvio.tv.ui.components.carousels

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
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
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Border
import androidx.tv.material3.Card
import androidx.tv.material3.CardDefaults
import androidx.tv.material3.ExperimentalTvMaterial3Api
import coil.compose.AsyncImage
import com.nuvio.tv.domain.model.StreamingContent
import com.nuvio.tv.ui.theme.NuvioShapes
import com.nuvio.tv.ui.theme.NuvioTypography
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.abs

/**
 * Hero carousel for featured content at the top of the home screen.
 * Features auto-advancement, parallax effects, and D-pad navigation.
 * The entire hero item is selectable - clicking navigates to content details.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun HeroCarousel(
    items: List<StreamingContent>,
    onItemClick: (StreamingContent) -> Unit,
    modifier: Modifier = Modifier,
    onHeroFocusChanged: ((Boolean) -> Unit)? = null,
    autoAdvanceDelayMs: Long = 8000
) {
    if (items.isEmpty()) return

    val pagerState = rememberPagerState(
        initialPage = 0,
        pageCount = { items.size }
    )
    val coroutineScope = rememberCoroutineScope()

    var isHeroFocused by remember { mutableStateOf(true) }

    // Animate content alpha based on focus
    val contentAlpha by animateFloatAsState(
        targetValue = if (isHeroFocused) 1f else 0.5f,
        animationSpec = tween(300),
        label = "heroContentAlpha"
    )

    // Auto-advance when not focused
    LaunchedEffect(pagerState, isHeroFocused) {
        if (!isHeroFocused && items.size > 1) {
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
            modifier = Modifier.fillMaxSize()
        ) { page ->
            val content = items[page]

            // Calculate parallax offset
            val pageOffset = (pagerState.currentPage - page) + pagerState.currentPageOffsetFraction

            HeroItem(
                content = content,
                pageOffset = pageOffset,
                isCurrentPage = page == pagerState.currentPage,
                contentAlpha = contentAlpha,
                // Always use the CURRENT page from pagerState, not the page this composable was created for
                onClick = { onItemClick(items[pagerState.currentPage]) },
                onFocusChanged = { hasFocus ->
                    if (hasFocus) {
                        isHeroFocused = true
                        onHeroFocusChanged?.invoke(true)
                    }
                },
                onNavigateLeft = {
                    if (pagerState.currentPage > 0) {
                        coroutineScope.launch {
                            pagerState.animateScrollToPage(pagerState.currentPage - 1)
                        }
                        true
                    } else false
                },
                onNavigateRight = {
                    if (pagerState.currentPage < items.size - 1) {
                        coroutineScope.launch {
                            pagerState.animateScrollToPage(pagerState.currentPage + 1)
                        }
                        true
                    } else false
                },
                modifier = Modifier.fillMaxSize()
            )
        }

        // Page Indicators with smooth animations
        if (items.size > 1) {
            Row(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 24.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                repeat(items.size) { index ->
                    PageIndicator(
                        isSelected = pagerState.currentPage == index,
                        primaryColor = MaterialTheme.colorScheme.primary
                    )
                }
            }
        }
    }
}

/**
 * Animated page indicator dot that smoothly transitions between states.
 */
@Composable
private fun PageIndicator(
    isSelected: Boolean,
    primaryColor: Color
) {
    val animatedWidth by animateDpAsState(
        targetValue = if (isSelected) 32.dp else 8.dp,
        animationSpec = tween(durationMillis = 300, easing = FastOutSlowInEasing),
        label = "indicatorWidth"
    )

    val animatedColor by animateColorAsState(
        targetValue = if (isSelected) primaryColor else Color.White.copy(alpha = 0.4f),
        animationSpec = tween(durationMillis = 300),
        label = "indicatorColor"
    )

    Box(
        modifier = Modifier
            .size(width = animatedWidth, height = 8.dp)
            .clip(CircleShape)
            .background(animatedColor)
    )
}

/**
 * Individual hero item - the entire item is focusable and clickable.
 * Clicking navigates to the content details page.
 */
@OptIn(ExperimentalTvMaterial3Api::class)
@Composable
private fun HeroItem(
    content: StreamingContent,
    pageOffset: Float,
    isCurrentPage: Boolean,
    contentAlpha: Float,
    onClick: () -> Unit,
    onFocusChanged: (Boolean) -> Unit,
    onNavigateLeft: () -> Boolean,
    onNavigateRight: () -> Boolean,
    modifier: Modifier = Modifier
) {
    var isFocused by remember { mutableStateOf(false) }

    val scale by animateFloatAsState(
        targetValue = if (isFocused) 1.02f else 1f,
        animationSpec = tween(150),
        label = "heroScale"
    )

    Card(
        onClick = onClick,
        modifier = modifier
            .graphicsLayer {
                scaleX = scale
                scaleY = scale
            }
            .onFocusChanged { focusState ->
                isFocused = focusState.isFocused
                if (focusState.isFocused) {
                    onFocusChanged(true)
                }
            }
            .onKeyEvent { event ->
                if (event.type == KeyEventType.KeyDown) {
                    when (event.key) {
                        Key.DirectionLeft -> onNavigateLeft()
                        Key.DirectionRight -> onNavigateRight()
                        else -> false
                    }
                } else false
            },
        scale = CardDefaults.scale(focusedScale = 1f), // We handle scale via graphicsLayer
        border = CardDefaults.border(
            focusedBorder = Border.None // No border on hero
        ),
        shape = CardDefaults.shape(shape = NuvioShapes.card),
        colors = CardDefaults.colors(containerColor = Color.Transparent)
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            // Background Image with Parallax
            AsyncImage(
                model = content.background ?: content.poster,
                contentDescription = content.name,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .fillMaxSize()
                    .graphicsLayer {
                        // Parallax effect
                        translationX = pageOffset * size.width * 0.15f
                        alpha = 1f - abs(pageOffset) * 0.3f
                    }
            )

            // Left-side gradient overlay (stronger to make text readable)
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.horizontalGradient(
                            colors = listOf(
                                MaterialTheme.colorScheme.background,
                                MaterialTheme.colorScheme.background.copy(alpha = 0.85f),
                                MaterialTheme.colorScheme.background.copy(alpha = 0.4f),
                                Color.Transparent
                            ),
                            startX = 0f,
                            endX = Float.POSITIVE_INFINITY * 0.5f
                        )
                    )
            )

            // Bottom gradient overlay
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(
                                Color.Transparent,
                                Color.Transparent,
                                MaterialTheme.colorScheme.background.copy(alpha = 0.7f),
                                MaterialTheme.colorScheme.background
                            ),
                            startY = 0f
                        )
                    )
            )

            // Content Info - Left Side
            Column(
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .padding(start = 48.dp, end = 48.dp, top = 80.dp)
                    .fillMaxWidth(0.45f)
                    .graphicsLayer { alpha = contentAlpha }
            ) {
                // Content Type Badge
                Box(
                    modifier = Modifier
                        .clip(NuvioShapes.badge)
                        .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.9f))
                        .padding(horizontal = 12.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = if (content.type == "series") "TV SERIES" else "MOVIE",
                        style = NuvioTypography.badge.copy(fontWeight = FontWeight.Bold),
                        color = Color.White
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Title
                Text(
                    text = content.name,
                    style = NuvioTypography.displayMedium,
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
                    // Year
                    content.year?.let { year ->
                        Text(
                            text = year.toString(),
                            style = NuvioTypography.bodyLarge,
                            color = Color.White.copy(alpha = 0.9f)
                        )
                    }

                    // Rating
                    content.imdbRating?.let { rating ->
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .clip(NuvioShapes.badge)
                                .background(Color(0xFFF5C518).copy(alpha = 0.15f))
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Text(
                                text = "★",
                                style = NuvioTypography.bodyLarge,
                                color = Color(0xFFF5C518)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = rating,
                                style = NuvioTypography.bodyLarge.copy(fontWeight = FontWeight.SemiBold),
                                color = Color(0xFFF5C518)
                            )
                        }
                    }

                    // Runtime
                    content.runtime?.let { runtime ->
                        Text(
                            text = runtime,
                            style = NuvioTypography.bodyLarge,
                            color = Color.White.copy(alpha = 0.7f)
                        )
                    }
                }

                // Genres
                if (content.genres.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        content.genres.take(3).forEach { genre ->
                            Box(
                                modifier = Modifier
                                    .clip(NuvioShapes.chip)
                                    .background(Color.White.copy(alpha = 0.12f))
                                    .padding(horizontal = 12.dp, vertical = 6.dp)
                            ) {
                                Text(
                                    text = genre,
                                    style = NuvioTypography.labelMedium,
                                    color = Color.White.copy(alpha = 0.9f)
                                )
                            }
                        }
                    }
                }

                // Description
                content.description?.let { description ->
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = description,
                        style = NuvioTypography.bodyMedium,
                        color = Color.White.copy(alpha = 0.7f),
                        maxLines = 3,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
        }
    }
}
