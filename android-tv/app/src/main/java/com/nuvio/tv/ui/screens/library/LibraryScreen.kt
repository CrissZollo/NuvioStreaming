package com.nuvio.tv.ui.screens.library

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.PlayCircle
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.tv.foundation.lazy.grid.TvGridCells
import androidx.tv.foundation.lazy.grid.TvLazyVerticalGrid
import androidx.tv.foundation.lazy.grid.items
import coil.compose.AsyncImage
import com.nuvio.tv.data.repository.LibraryItem
import com.nuvio.tv.domain.model.StreamingContent
import com.nuvio.tv.domain.model.WatchProgress
import com.nuvio.tv.ui.components.cards.ContentCard
import com.nuvio.tv.ui.theme.NuvioShapes
import com.nuvio.tv.ui.theme.NuvioTypography

/**
 * Library screen displaying user's watchlist and history.
 */
@Composable
fun LibraryScreen(
    viewModel: LibraryViewModel = hiltViewModel(),
    onContentClick: (StreamingContent) -> Unit,
    focusRequester: FocusRequester? = null
) {
    val uiState by viewModel.uiState.collectAsState()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(horizontal = 48.dp, vertical = 24.dp)
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            // Header with title and Trakt status
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Library",
                    style = NuvioTypography.headlineLarge,
                    color = MaterialTheme.colorScheme.onBackground
                )

                if (uiState.isTraktConnected) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.Sync,
                            contentDescription = "Synced with Trakt",
                            tint = Color(0xFFED1C24),
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Trakt Connected",
                            style = NuvioTypography.labelMedium,
                            color = Color(0xFFED1C24)
                        )
                    }
                }
            }

            // Tab Bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                LibraryTab.entries.forEach { tab ->
                    TabItem(
                        tab = tab,
                        isSelected = uiState.selectedTab == tab,
                        count = getTabCount(uiState, tab),
                        onClick = { viewModel.selectTab(tab) },
                        focusRequester = if (tab == LibraryTab.FAVORITES) focusRequester else null
                    )
                }
            }

            // Filter Row
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                LibraryFilter.entries.forEach { filter ->
                    FilterChip(
                        label = filter.displayName,
                        isSelected = uiState.filter == filter,
                        onClick = { viewModel.setFilter(filter) }
                    )
                }

                Spacer(modifier = Modifier.weight(1f))

                // Sort dropdown (simplified as chips for TV)
                Text(
                    text = "Sort:",
                    style = NuvioTypography.labelMedium,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f)
                )
                Spacer(modifier = Modifier.width(8.dp))
                LibrarySort.entries.forEach { sort ->
                    FilterChip(
                        label = sort.displayName,
                        isSelected = uiState.sort == sort,
                        onClick = { viewModel.setSort(sort) }
                    )
                }
            }

            // Content Area
            when {
                uiState.isLoading -> {
                    LoadingState()
                }

                uiState.error != null -> {
                    ErrorState(
                        error = uiState.error ?: "",
                        onRetry = { viewModel.refresh() }
                    )
                }

                else -> {
                    val items = viewModel.getFilteredItems()
                    if (items.isEmpty()) {
                        EmptyState(tab = uiState.selectedTab)
                    } else {
                        LibraryContent(
                            items = items,
                            selectedTab = uiState.selectedTab,
                            onItemClick = { item ->
                                val content = when (item) {
                                    is LibraryItem -> StreamingContent(
                                        id = item.id,
                                        type = item.type,
                                        name = item.name,
                                        poster = item.poster,
                                        year = item.year
                                    )
                                    is WatchProgress -> StreamingContent(
                                        id = item.contentId,
                                        type = item.type,
                                        name = item.title ?: "",
                                        poster = item.poster
                                    )
                                    else -> null
                                }
                                content?.let { onContentClick(it) }
                            }
                        )
                    }
                }
            }
        }
    }
}

private fun getTabCount(state: LibraryUiState, tab: LibraryTab): Int {
    return when (tab) {
        LibraryTab.FAVORITES -> state.favorites.size
        LibraryTab.WATCHLIST -> state.watchlist.size
        LibraryTab.HISTORY -> state.history.size
        LibraryTab.CONTINUE -> state.continueWatching.size
    }
}

@Composable
private fun TabItem(
    tab: LibraryTab,
    isSelected: Boolean,
    count: Int,
    onClick: () -> Unit,
    focusRequester: FocusRequester? = null
) {
    var isFocused by remember { mutableStateOf(false) }

    val backgroundColor by animateColorAsState(
        targetValue = when {
            isFocused -> MaterialTheme.colorScheme.primary
            isSelected -> MaterialTheme.colorScheme.primary.copy(alpha = 0.15f)
            else -> Color.Transparent
        },
        animationSpec = tween(150),
        label = "tabBg"
    )

    val icon = when (tab) {
        LibraryTab.FAVORITES -> Icons.Default.Favorite
        LibraryTab.WATCHLIST -> Icons.Default.Bookmark
        LibraryTab.HISTORY -> Icons.Default.History
        LibraryTab.CONTINUE -> Icons.Default.PlayCircle
    }

    Row(
        modifier = Modifier
            .then(
                if (focusRequester != null) Modifier.focusRequester(focusRequester)
                else Modifier
            )
            .clip(RoundedCornerShape(8.dp))
            .background(backgroundColor)
            .onFocusChanged { isFocused = it.isFocused }
            .focusable()
            .onKeyEvent { event ->
                if (event.type == KeyEventType.KeyDown &&
                    (event.key == Key.DirectionCenter || event.key == Key.Enter)
                ) {
                    onClick()
                    true
                } else false
            }
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = when {
                isFocused -> Color.Black
                isSelected -> MaterialTheme.colorScheme.primary
                else -> MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f)
            },
            modifier = Modifier.size(20.dp)
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            text = tab.title,
            style = NuvioTypography.labelLarge,
            color = when {
                isFocused -> Color.Black
                isSelected -> MaterialTheme.colorScheme.primary
                else -> MaterialTheme.colorScheme.onBackground
            },
            fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal
        )
        if (count > 0) {
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                text = count.toString(),
                style = NuvioTypography.labelSmall,
                color = when {
                    isFocused -> Color.Black.copy(alpha = 0.7f)
                    else -> MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f)
                }
            )
        }
    }
}

@Composable
private fun FilterChip(
    label: String,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    var isFocused by remember { mutableStateOf(false) }

    val backgroundColor by animateColorAsState(
        targetValue = when {
            isFocused -> MaterialTheme.colorScheme.primary
            isSelected -> MaterialTheme.colorScheme.surface
            else -> Color.Transparent
        },
        animationSpec = tween(150),
        label = "filterBg"
    )

    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(6.dp))
            .background(backgroundColor)
            .onFocusChanged { isFocused = it.isFocused }
            .focusable()
            .onKeyEvent { event ->
                if (event.type == KeyEventType.KeyDown &&
                    (event.key == Key.DirectionCenter || event.key == Key.Enter)
                ) {
                    onClick()
                    true
                } else false
            }
            .padding(horizontal = 12.dp, vertical = 6.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = label,
            style = NuvioTypography.labelMedium,
            color = when {
                isFocused -> Color.Black
                isSelected -> MaterialTheme.colorScheme.onSurface
                else -> MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f)
            }
        )
    }
}

@Composable
private fun LoadingState() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
    }
}

@Composable
private fun ErrorState(error: String, onRetry: () -> Unit) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "Failed to load library",
                style = NuvioTypography.headlineMedium,
                color = MaterialTheme.colorScheme.error
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = error,
                style = NuvioTypography.bodyMedium,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f)
            )
        }
    }
}

@Composable
private fun EmptyState(tab: LibraryTab) {
    val (icon, title, subtitle) = when (tab) {
        LibraryTab.FAVORITES -> Triple(
            Icons.Default.Favorite,
            "No favorites yet",
            "Mark content as favorite to see it here"
        )
        LibraryTab.WATCHLIST -> Triple(
            Icons.Default.Bookmark,
            "Watchlist is empty",
            "Add movies and shows to watch later"
        )
        LibraryTab.HISTORY -> Triple(
            Icons.Default.History,
            "No watch history",
            "Your watched content will appear here"
        )
        LibraryTab.CONTINUE -> Triple(
            Icons.Default.PlayCircle,
            "Nothing to continue",
            "Start watching something to continue later"
        )
    }

    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.3f),
                modifier = Modifier.size(64.dp)
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = title,
                style = NuvioTypography.headlineMedium,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f)
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = subtitle,
                style = NuvioTypography.bodyMedium,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f)
            )
        }
    }
}

@Composable
private fun LibraryContent(
    items: List<Any>,
    selectedTab: LibraryTab,
    onItemClick: (Any) -> Unit
) {
    TvLazyVerticalGrid(
        columns = TvGridCells.Adaptive(160.dp),
        contentPadding = PaddingValues(bottom = 32.dp),
        horizontalArrangement = Arrangement.spacedBy(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        items(
            items = items,
            key = { item ->
                when (item) {
                    is LibraryItem -> item.id
                    is WatchProgress -> "${item.contentId}:${item.episodeId ?: ""}"
                    else -> item.hashCode()
                }
            }
        ) { item ->
            when (item) {
                is LibraryItem -> {
                    LibraryItemCard(
                        item = item,
                        onClick = { onItemClick(item) }
                    )
                }
                is WatchProgress -> {
                    WatchProgressCard(
                        progress = item,
                        onClick = { onItemClick(item) }
                    )
                }
            }
        }
    }
}

@Composable
private fun LibraryItemCard(
    item: LibraryItem,
    onClick: () -> Unit
) {
    var isFocused by remember { mutableStateOf(false) }

    Box(
        modifier = Modifier
            .width(160.dp)
            .aspectRatio(2f / 3f)
            .clip(NuvioShapes.card)
            .background(MaterialTheme.colorScheme.surface)
            .onFocusChanged { isFocused = it.isFocused }
            .focusable()
            .onKeyEvent { event ->
                if (event.type == KeyEventType.KeyDown &&
                    (event.key == Key.DirectionCenter || event.key == Key.Enter)
                ) {
                    onClick()
                    true
                } else false
            }
    ) {
        AsyncImage(
            model = item.poster,
            contentDescription = item.name,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize()
        )

        // Focus border
        if (isFocused) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(
                                Color.Transparent,
                                MaterialTheme.colorScheme.primary.copy(alpha = 0.3f)
                            )
                        )
                    )
            )
        }

        // Bottom info
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.BottomCenter)
                .background(
                    Brush.verticalGradient(
                        colors = listOf(Color.Transparent, Color.Black.copy(alpha = 0.8f))
                    )
                )
                .padding(8.dp)
        ) {
            Column {
                Text(
                    text = item.name,
                    style = NuvioTypography.labelMedium,
                    color = Color.White,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
                item.year?.let {
                    Text(
                        text = it.toString(),
                        style = NuvioTypography.labelSmall,
                        color = Color.White.copy(alpha = 0.7f)
                    )
                }
            }
        }
    }
}

@Composable
private fun WatchProgressCard(
    progress: WatchProgress,
    onClick: () -> Unit
) {
    var isFocused by remember { mutableStateOf(false) }

    Box(
        modifier = Modifier
            .width(160.dp)
            .aspectRatio(2f / 3f)
            .clip(NuvioShapes.card)
            .background(MaterialTheme.colorScheme.surface)
            .onFocusChanged { isFocused = it.isFocused }
            .focusable()
            .onKeyEvent { event ->
                if (event.type == KeyEventType.KeyDown &&
                    (event.key == Key.DirectionCenter || event.key == Key.Enter)
                ) {
                    onClick()
                    true
                } else false
            }
    ) {
        AsyncImage(
            model = progress.poster,
            contentDescription = progress.title,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize()
        )

        // Focus overlay
        if (isFocused) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(
                                Color.Transparent,
                                MaterialTheme.colorScheme.primary.copy(alpha = 0.3f)
                            )
                        )
                    )
            )
        }

        // Bottom info with progress
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.BottomCenter)
                .background(
                    Brush.verticalGradient(
                        colors = listOf(Color.Transparent, Color.Black.copy(alpha = 0.9f))
                    )
                )
                .padding(8.dp)
        ) {
            Text(
                text = progress.title ?: "Unknown",
                style = NuvioTypography.labelMedium,
                color = Color.White,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )

            Spacer(modifier = Modifier.height(4.dp))

            // Progress bar
            LinearProgressIndicator(
                progress = { progress.progress },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(3.dp)
                    .clip(RoundedCornerShape(2.dp)),
                color = MaterialTheme.colorScheme.primary,
                trackColor = Color.White.copy(alpha = 0.3f)
            )

            Spacer(modifier = Modifier.height(4.dp))

            Text(
                text = "${progress.progressPercent}% watched",
                style = NuvioTypography.labelSmall,
                color = Color.White.copy(alpha = 0.7f)
            )
        }
    }
}
