package com.nuvio.tv.ui.components.carousels

import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.focusGroup
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
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
 * Styled to match the mobile app's FeaturedContent component.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun HeroCarousel(
    items: List<StreamingContent>,
    onItemClick: (StreamingContent) -> Unit,
    modifier: Modifier = Modifier,
    onInfoClick: ((StreamingContent) -> Unit)? = null,
    onLibraryClick: ((StreamingContent) -> Unit)? = null,
    autoAdvanceDelayMs: Long = 8000
) {
    if (items.isEmpty()) return

    val pagerState = rememberPagerState(
        initialPage = 0,
        pageCount = { items.size }
    )
    val coroutineScope = rememberCoroutineScope()

    var isPaused by remember { mutableStateOf(false) }

    // Auto-advance when not focused
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
                .onKeyEvent { event ->
                    if (event.type == KeyEventType.KeyDown) {
                        when (event.key) {
                            Key.DirectionLeft -> {
                                if (pagerState.currentPage > 0) {
                                    coroutineScope.launch {
                                        pagerState.animateScrollToPage(pagerState.currentPage - 1)
                                    }
                                    true
                                } else false
                            }
                            Key.DirectionRight -> {
                                if (pagerState.currentPage < items.size - 1) {
                                    coroutineScope.launch {
                                        pagerState.animateScrollToPage(pagerState.currentPage + 1)
                                    }
                                    true
                                } else false
                            }
                            else -> false
                        }
                    } else false
                }
        ) { page ->
            val content = items[page]

            // Calculate parallax offset
            val pageOffset = (pagerState.currentPage - page) + pagerState.currentPageOffsetFraction

            HeroItem(
                content = content,
                pageOffset = pageOffset,
                onPlayClick = { onItemClick(content) },
                onInfoClick = onInfoClick?.let { { it(content) } },
                onLibraryClick = onLibraryClick?.let { { it(content) } },
                modifier = Modifier.fillMaxSize()
            )
        }

        // Page Indicators
        if (items.size > 1) {
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
                                width = if (isSelected) 32.dp else 8.dp,
                                height = 8.dp
                            )
                            .clip(CircleShape)
                            .background(
                                if (isSelected) {
                                    MaterialTheme.colorScheme.primary
                                } else {
                                    Color.White.copy(alpha = 0.4f)
                                }
                            )
                            .animateContentSize(animationSpec = tween(200))
                    )
                }
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
    onInfoClick: (() -> Unit)?,
    onLibraryClick: (() -> Unit)?,
    modifier: Modifier = Modifier
) {
    var playButtonFocused by remember { mutableStateOf(false) }
    var infoButtonFocused by remember { mutableStateOf(false) }
    var libraryButtonFocused by remember { mutableStateOf(false) }

    val playButtonScale by animateFloatAsState(
        targetValue = if (playButtonFocused) 1.1f else 1f,
        animationSpec = tween(150),
        label = "playScale"
    )

    val infoButtonScale by animateFloatAsState(
        targetValue = if (infoButtonFocused) 1.1f else 1f,
        animationSpec = tween(150),
        label = "infoScale"
    )

    val libraryButtonScale by animateFloatAsState(
        targetValue = if (libraryButtonFocused) 1.1f else 1f,
        animationSpec = tween(150),
        label = "libraryScale"
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

        // Content Info - Left Side (positioned lower to avoid being cut off)
        Column(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(start = 48.dp, end = 48.dp, bottom = 80.dp)
                .fillMaxWidth(0.45f)
                .focusGroup()
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

            Spacer(modifier = Modifier.height(16.dp))

            // Logo or Title
            // TODO: Add logo support when available
            Text(
                text = content.name,
                style = NuvioTypography.displayMedium,
                color = Color.White,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )

            Spacer(modifier = Modifier.height(16.dp))

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
                Spacer(modifier = Modifier.height(12.dp))
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
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = description,
                    style = NuvioTypography.bodyMedium,
                    color = Color.White.copy(alpha = 0.7f),
                    maxLines = 3,
                    overflow = TextOverflow.Ellipsis
                )
            }

            Spacer(modifier = Modifier.height(28.dp))

            // Action Buttons Row
            Row(
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Play Button (Primary)
                Button(
                    onClick = onPlayClick,
                    modifier = Modifier
                        .height(52.dp)
                        .graphicsLayer {
                            scaleX = playButtonScale
                            scaleY = playButtonScale
                        }
                        .onFocusChanged { focusState ->
                            playButtonFocused = focusState.isFocused
                        }
                        .focusable()
                        .onKeyEvent { event ->
                            if (event.type == KeyEventType.KeyDown &&
                                (event.key == Key.DirectionCenter || event.key == Key.Enter)
                            ) {
                                onPlayClick()
                                true
                            } else false
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
                        modifier = Modifier.size(26.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Watch Now",
                        style = NuvioTypography.labelLarge.copy(fontWeight = FontWeight.SemiBold)
                    )
                }

                // Info Button (Secondary)
                if (onInfoClick != null) {
                    OutlinedButton(
                        onClick = onInfoClick,
                        modifier = Modifier
                            .height(52.dp)
                            .graphicsLayer {
                                scaleX = infoButtonScale
                                scaleY = infoButtonScale
                            }
                            .onFocusChanged { focusState ->
                                infoButtonFocused = focusState.isFocused
                            }
                            .focusable()
                            .onKeyEvent { event ->
                                if (event.type == KeyEventType.KeyDown &&
                                    (event.key == Key.DirectionCenter || event.key == Key.Enter)
                                ) {
                                    onInfoClick()
                                    true
                                } else false
                            },
                        colors = ButtonDefaults.outlinedButtonColors(
                            contentColor = Color.White
                        ),
                        shape = NuvioShapes.full
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Info,
                            contentDescription = null,
                            modifier = Modifier.size(22.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "More Info",
                            style = NuvioTypography.labelLarge
                        )
                    }
                }

                // Library Button
                if (onLibraryClick != null) {
                    OutlinedButton(
                        onClick = onLibraryClick,
                        modifier = Modifier
                            .size(52.dp)
                            .graphicsLayer {
                                scaleX = libraryButtonScale
                                scaleY = libraryButtonScale
                            }
                            .onFocusChanged { focusState ->
                                libraryButtonFocused = focusState.isFocused
                            }
                            .focusable()
                            .onKeyEvent { event ->
                                if (event.type == KeyEventType.KeyDown &&
                                    (event.key == Key.DirectionCenter || event.key == Key.Enter)
                                ) {
                                    onLibraryClick()
                                    true
                                } else false
                            },
                        colors = ButtonDefaults.outlinedButtonColors(
                            contentColor = Color.White
                        ),
                        shape = CircleShape,
                        contentPadding = ButtonDefaults.TextButtonContentPadding
                    ) {
                        Icon(
                            imageVector = if (content.inLibrary) Icons.Filled.Check else Icons.Filled.Add,
                            contentDescription = if (content.inLibrary) "In Library" else "Add to Library",
                            modifier = Modifier.size(24.dp)
                        )
                    }
                }
            }
        }
    }
}
