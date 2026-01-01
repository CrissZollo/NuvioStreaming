package com.nuvio.tv.ui.screens.home

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.hilt.navigation.compose.hiltViewModel
import kotlinx.coroutines.launch
import com.nuvio.tv.domain.model.CatalogConfig
import com.nuvio.tv.domain.model.StreamingContent
import com.nuvio.tv.ui.components.cards.ContinueWatchingCard
import com.nuvio.tv.ui.components.cards.ThisWeekCard
import com.nuvio.tv.ui.components.carousels.ContentCarousel
import com.nuvio.tv.ui.components.carousels.GenericCarousel
import com.nuvio.tv.ui.components.carousels.HeroCarousel
import com.nuvio.tv.ui.theme.NuvioShapes
import com.nuvio.tv.ui.theme.NuvioTypography

/**
 * Home screen displaying featured content, continue watching, and catalog rows.
 * Styled to match the mobile app's HomeScreen component.
 */
@Composable
fun HomeScreen(
    viewModel: HomeViewModel = hiltViewModel(),
    onContentClick: (StreamingContent) -> Unit,
    onCatalogClick: (CatalogConfig) -> Unit,
    onAddAddonsClick: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsState()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        // Main content with animated visibility
        AnimatedVisibility(
            visible = !uiState.isLoading || uiState.featuredContent.isNotEmpty(),
            enter = fadeIn(animationSpec = tween(300)),
            exit = fadeOut(animationSpec = tween(200))
        ) {
            when {
                // No addons installed
                !uiState.hasAddons -> {
                    NoAddonsState(onAddAddonsClick = onAddAddonsClick)
                }

                // Error state (only show if no content at all)
                uiState.error != null && uiState.featuredContent.isEmpty() && uiState.catalogs.isEmpty() -> {
                    ErrorState(
                        error = uiState.error ?: "Unknown error",
                        onRetry = { viewModel.refresh() }
                    )
                }

                // Content loaded (show even if still loading more)
                else -> {
                    HomeContent(
                        uiState = uiState,
                        onContentClick = onContentClick,
                        onCatalogClick = onCatalogClick,
                        onThisWeekItemClick = { item ->
                            // Navigate to the show's metadata screen
                            onContentClick(
                                StreamingContent(
                                    id = item.showId,
                                    type = "series",
                                    name = item.showTitle
                                )
                            )
                        }
                    )
                }
            }
        }

        // Loading overlay (shows on initial load only)
        AnimatedVisibility(
            visible = uiState.isLoading && uiState.featuredContent.isEmpty() && uiState.catalogs.isEmpty(),
            enter = fadeIn(),
            exit = fadeOut()
        ) {
            LoadingState()
        }
    }
}

@Composable
private fun LoadingState() {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            CircularProgressIndicator(
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(48.dp),
                strokeWidth = 4.dp
            )
            Spacer(modifier = Modifier.height(24.dp))
            Text(
                text = "Loading content...",
                style = NuvioTypography.bodyLarge,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f)
            )
        }
    }
}

@Composable
private fun NoAddonsState(onAddAddonsClick: () -> Unit) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(48.dp)
        ) {
            // Icon
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .clip(RoundedCornerShape(40.dp))
                    .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.1f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Filled.Add,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(40.dp)
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            Text(
                text = "No Addons Installed",
                style = NuvioTypography.headlineMedium,
                color = MaterialTheme.colorScheme.onBackground
            )

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = "Install addons to start browsing movies and TV shows.\nAddons provide catalogs and streaming sources.",
                style = NuvioTypography.bodyMedium,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f),
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(32.dp))

            Button(
                onClick = onAddAddonsClick,
                modifier = Modifier.focusable(),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary
                ),
                shape = NuvioShapes.full
            ) {
                Icon(
                    imageVector = Icons.Filled.Add,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Add Addons",
                    style = NuvioTypography.labelLarge
                )
            }
        }
    }
}

@Composable
private fun ErrorState(
    error: String,
    onRetry: () -> Unit
) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(48.dp)
        ) {
            // Error Icon
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .clip(RoundedCornerShape(40.dp))
                    .background(MaterialTheme.colorScheme.error.copy(alpha = 0.1f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Filled.Error,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.error,
                    modifier = Modifier.size(40.dp)
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            Text(
                text = "Error Loading Content",
                style = NuvioTypography.headlineMedium,
                color = MaterialTheme.colorScheme.onBackground
            )

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = error,
                style = NuvioTypography.bodyMedium,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f),
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(32.dp))

            Button(
                onClick = onRetry,
                modifier = Modifier.focusable(),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary
                ),
                shape = NuvioShapes.full
            ) {
                Icon(
                    imageVector = Icons.Filled.Refresh,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Retry",
                    style = NuvioTypography.labelLarge
                )
            }
        }
    }
}

@Composable
private fun HomeContent(
    uiState: HomeUiState,
    onContentClick: (StreamingContent) -> Unit,
    onCatalogClick: (CatalogConfig) -> Unit,
    onThisWeekItemClick: (ThisWeekItem) -> Unit
) {
    val scrollState = rememberScrollState()
    val coroutineScope = rememberCoroutineScope()

    // Use regular Column with verticalScroll instead of TvLazyColumn
    // This prevents the automatic "bring focused item into view" behavior
    // that causes vertical jumping during horizontal navigation
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(bottom = 48.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp)
    ) {
        // Hero Carousel - Full width, scrolls with content
        if (uiState.featuredContent.isNotEmpty()) {
            HeroCarousel(
                items = uiState.featuredContent,
                onItemClick = onContentClick,
                onHeroFocusChanged = { hasFocus ->
                    if (hasFocus) {
                        // Scroll to top when hero receives focus
                        coroutineScope.launch {
                            scrollState.animateScrollTo(0)
                        }
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(480.dp)
            )
        }

        // Continue Watching Section
        if (uiState.continueWatching.isNotEmpty()) {
            GenericCarousel(
                title = "Continue Watching",
                items = uiState.continueWatching,
                onItemClick = { item -> onContentClick(item.content) },
                itemKey = { it.content.id + (it.progress.episodeId ?: "") },
                modifier = Modifier.padding(horizontal = 48.dp),
                rowHeight = 172.dp // 124dp card + 48dp title space
            ) { item ->
                ContinueWatchingCard(
                    item = item,
                    onClick = { onContentClick(item.content) }
                )
            }
        }

        // This Week Section (Trakt Calendar)
        if (uiState.thisWeek.isNotEmpty()) {
            GenericCarousel(
                title = "This Week",
                items = uiState.thisWeek,
                onItemClick = onThisWeekItemClick,
                itemKey = { "${it.showId}:${it.episodeInfo}" },
                modifier = Modifier.padding(horizontal = 48.dp),
                rowHeight = 160.dp // 112dp card + 48dp title space
            ) { item ->
                ThisWeekCard(
                    item = item,
                    onClick = { onThisWeekItemClick(item) }
                )
            }
        }

        // Catalog Rows - Each with their own section
        uiState.catalogs.forEach { catalog ->
            // Add content type suffix (Movies/TV Shows) to catalog name
            val typeLabel = when (catalog.config.type.lowercase()) {
                "movie" -> "Movies"
                "series" -> "TV Shows"
                else -> catalog.config.type.replaceFirstChar { it.uppercase() }
            }
            val displayTitle = "${catalog.config.catalogName} - $typeLabel"

            ContentCarousel(
                title = displayTitle,
                items = catalog.items,
                onItemClick = onContentClick,
                onSeeAllClick = { onCatalogClick(catalog.config) },
                modifier = Modifier.padding(horizontal = 48.dp)
            )
        }

        // Empty state if no content at all (but has addons)
        if (uiState.catalogs.isEmpty() && uiState.featuredContent.isEmpty() &&
            uiState.continueWatching.isEmpty() && !uiState.isLoading && uiState.hasAddons) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(300.dp)
                    .padding(horizontal = 48.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "No Content Available",
                        style = NuvioTypography.headlineSmall,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f)
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Try adding more addons or check your connection",
                        style = NuvioTypography.bodyMedium,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f)
                    )
                }
            }
        }

        // Loading indicator at bottom when loading more catalogs
        if (uiState.isLoading && uiState.catalogs.isNotEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 16.dp),
                contentAlignment = Alignment.Center
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center
                ) {
                    CircularProgressIndicator(
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(24.dp),
                        strokeWidth = 2.dp
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(
                        text = "Loading more...",
                        style = NuvioTypography.bodyMedium,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f)
                    )
                }
            }
        }
    }
}
