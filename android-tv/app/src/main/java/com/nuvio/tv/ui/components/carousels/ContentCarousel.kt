package com.nuvio.tv.ui.components.carousels

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import com.nuvio.tv.domain.model.StreamingContent
import com.nuvio.tv.ui.components.cards.ContentCard
import com.nuvio.tv.ui.theme.NuvioTypography

// Smaller card size for more content on screen
private const val CARD_WIDTH = 120
private const val CARD_HEIGHT = 180 // 120 / (2/3) = 180
private const val TITLE_SPACE = 56 // Space for title below card
private const val ROW_HEIGHT = CARD_HEIGHT + TITLE_SPACE // 236dp total

/**
 * Horizontal content carousel for displaying content rows.
 * Supports D-pad navigation with smooth scrolling.
 * Features enhanced focus handling for TV navigation.
 */
@Composable
fun ContentCarousel(
    title: String,
    items: List<StreamingContent>,
    onItemClick: (StreamingContent) -> Unit,
    modifier: Modifier = Modifier,
    onSeeAllClick: (() -> Unit)? = null,
    showTitle: Boolean = true,
    onRowFocused: (() -> Unit)? = null,
    cardWidth: Int = CARD_WIDTH
) {
    val listState = rememberLazyListState()
    var seeAllFocused by remember { mutableStateOf(false) }
    var anyCardFocused by remember { mutableStateOf(false) }

    val seeAllScale by animateFloatAsState(
        targetValue = if (seeAllFocused) 1.1f else 1f,
        animationSpec = tween(150),
        label = "seeAllScale"
    )

    Column(modifier = modifier.fillMaxWidth()) {
        // Header Row - styled like mobile app
        if (showTitle) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Section Title with colored underline (like mobile app)
                Column {
                    Text(
                        text = title,
                        style = NuvioTypography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                        color = MaterialTheme.colorScheme.onBackground
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    // Colored underline accent
                    Box(
                        modifier = Modifier
                            .width(40.dp)
                            .height(3.dp)
                            .clip(RoundedCornerShape(2.dp))
                            .background(MaterialTheme.colorScheme.primary)
                    )
                }

                // View All Button - styled like mobile app
                if (onSeeAllClick != null) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(20.dp))
                            .background(
                                if (seeAllFocused) MaterialTheme.colorScheme.primary
                                else Color.White.copy(alpha = 0.1f)
                            )
                            .graphicsLayer {
                                scaleX = seeAllScale
                                scaleY = seeAllScale
                            }
                            .onFocusChanged { focusState ->
                                seeAllFocused = focusState.isFocused
                            }
                            .focusable()
                            .onKeyEvent { event ->
                                if (event.type == KeyEventType.KeyDown &&
                                    (event.key == Key.DirectionCenter || event.key == Key.Enter)
                                ) {
                                    onSeeAllClick()
                                    true
                                } else false
                            }
                            .padding(horizontal = 16.dp, vertical = 8.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "View All",
                                style = NuvioTypography.labelLarge,
                                color = if (seeAllFocused) Color.White
                                else MaterialTheme.colorScheme.onBackground.copy(alpha = 0.9f)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                                contentDescription = null,
                                tint = if (seeAllFocused) Color.White
                                else MaterialTheme.colorScheme.onBackground.copy(alpha = 0.9f),
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }
                }
            }
        }

        // Content Row - with proper TV lazy list for D-pad navigation
        // Fixed height container prevents vertical jumping during horizontal scroll
        // Calculate height based on card aspect ratio (2/3 for poster)
        val cardHeight = (cardWidth / (2f / 3f)).toInt()
        val rowHeight = cardHeight + TITLE_SPACE

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(rowHeight.dp)
        ) {
            LazyRow(
                state = listState,
                contentPadding = PaddingValues(end = 48.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(
                    items = items,
                    key = { it.id }
                ) { content ->
                    ContentCard(
                        content = content,
                        onClick = { onItemClick(content) },
                        cardWidth = cardWidth,
                        modifier = Modifier.onFocusChanged { focusState ->
                            if (focusState.isFocused) {
                                // Always trigger scroll when any card gets focus
                                // This handles both horizontal navigation within row
                                // and vertical navigation between rows
                                onRowFocused?.invoke()
                                anyCardFocused = true
                            } else if (!focusState.isFocused) {
                                anyCardFocused = false
                            }
                        }
                    )
                }
            }
        }
    }
}

/**
 * Content carousel with custom card content.
 * Useful for specialized sections like Continue Watching or This Week.
 */
@Composable
fun <T> GenericCarousel(
    title: String,
    items: List<T>,
    onItemClick: (T) -> Unit,
    modifier: Modifier = Modifier,
    itemKey: (T) -> Any,
    onSeeAllClick: (() -> Unit)? = null,
    rowHeight: Dp = 200.dp, // Default height for generic carousels
    onRowFocused: (() -> Unit)? = null,
    itemContent: @Composable (T) -> Unit
) {
    val listState = rememberLazyListState()
    var seeAllFocused by remember { mutableStateOf(false) }
    var anyCardFocused by remember { mutableStateOf(false) }

    val seeAllScale by animateFloatAsState(
        targetValue = if (seeAllFocused) 1.1f else 1f,
        animationSpec = tween(150),
        label = "seeAllScale"
    )

    Column(modifier = modifier.fillMaxWidth()) {
        // Header Row - styled like mobile app
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Section Title with colored underline
            Column {
                Text(
                    text = title,
                    style = NuvioTypography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                    color = MaterialTheme.colorScheme.onBackground
                )
                Spacer(modifier = Modifier.height(6.dp))
                Box(
                    modifier = Modifier
                        .width(40.dp)
                        .height(3.dp)
                        .clip(RoundedCornerShape(2.dp))
                        .background(MaterialTheme.colorScheme.primary)
                )
            }

            // View All Button - styled like mobile app
            if (onSeeAllClick != null) {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(20.dp))
                        .background(
                            if (seeAllFocused) MaterialTheme.colorScheme.primary
                            else Color.White.copy(alpha = 0.1f)
                        )
                        .graphicsLayer {
                            scaleX = seeAllScale
                            scaleY = seeAllScale
                        }
                        .onFocusChanged { focusState ->
                            seeAllFocused = focusState.isFocused
                        }
                        .focusable()
                        .onKeyEvent { event ->
                            if (event.type == KeyEventType.KeyDown &&
                                (event.key == Key.DirectionCenter || event.key == Key.Enter)
                            ) {
                                onSeeAllClick()
                                true
                            } else false
                        }
                        .padding(horizontal = 16.dp, vertical = 8.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "View All",
                            style = NuvioTypography.labelLarge,
                            color = if (seeAllFocused) Color.White
                            else MaterialTheme.colorScheme.onBackground.copy(alpha = 0.9f)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                            contentDescription = null,
                            tint = if (seeAllFocused) Color.White
                            else MaterialTheme.colorScheme.onBackground.copy(alpha = 0.9f),
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }
            }
        }

        // Content Row
        // Fixed height container prevents vertical jumping during horizontal scroll
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(rowHeight)
        ) {
            LazyRow(
                state = listState,
                contentPadding = PaddingValues(end = 48.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(
                    items = items,
                    key = itemKey
                ) { item ->
                    Box(
                        modifier = Modifier.onFocusChanged { focusState ->
                            if (focusState.hasFocus) {
                                // Always trigger scroll when any card gets focus
                                // This handles both horizontal navigation within row
                                // and vertical navigation between rows
                                onRowFocused?.invoke()
                                anyCardFocused = true
                            } else if (!focusState.hasFocus) {
                                anyCardFocused = false
                            }
                        }
                    ) {
                        itemContent(item)
                    }
                }
            }
        }
    }
}

/**
 * Compact carousel without "See All" button, for smaller sections.
 */
@Composable
fun CompactCarousel(
    title: String,
    items: List<StreamingContent>,
    onItemClick: (StreamingContent) -> Unit,
    modifier: Modifier = Modifier
) {
    ContentCarousel(
        title = title,
        items = items,
        onItemClick = onItemClick,
        modifier = modifier,
        onSeeAllClick = null,
        showTitle = true
    )
}
