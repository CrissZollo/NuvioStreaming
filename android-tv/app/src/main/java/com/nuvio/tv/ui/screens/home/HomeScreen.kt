package com.nuvio.tv.ui.screens.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.tv.foundation.lazy.list.TvLazyColumn
import androidx.tv.foundation.lazy.list.items
import com.nuvio.tv.domain.model.CatalogConfig
import com.nuvio.tv.domain.model.StreamingContent
import com.nuvio.tv.ui.components.carousels.ContentCarousel
import com.nuvio.tv.ui.components.carousels.HeroCarousel
import com.nuvio.tv.ui.theme.NuvioTypography

/**
 * Home screen displaying featured content, continue watching, and catalog rows.
 */
@Composable
fun HomeScreen(
    viewModel: HomeViewModel = hiltViewModel(),
    onContentClick: (StreamingContent) -> Unit,
    onCatalogClick: (CatalogConfig) -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        if (uiState.isLoading && uiState.featuredContent.isEmpty()) {
            // Loading state
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "Loading...",
                    style = NuvioTypography.headlineMedium,
                    color = MaterialTheme.colorScheme.onBackground
                )
            }
        } else if (uiState.error != null && uiState.featuredContent.isEmpty()) {
            // Error state
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "Error loading content",
                        style = NuvioTypography.headlineMedium,
                        color = MaterialTheme.colorScheme.error
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = uiState.error ?: "",
                        style = NuvioTypography.bodyMedium,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f)
                    )
                }
            }
        } else {
            // Content
            TvLazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(bottom = 32.dp),
                verticalArrangement = Arrangement.spacedBy(24.dp)
            ) {
                // Hero Carousel
                if (uiState.featuredContent.isNotEmpty()) {
                    item {
                        HeroCarousel(
                            items = uiState.featuredContent,
                            onItemClick = onContentClick,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(400.dp)
                        )
                    }
                }

                // Continue Watching
                if (uiState.continueWatching.isNotEmpty()) {
                    item {
                        ContentCarousel(
                            title = "Continue Watching",
                            items = uiState.continueWatching,
                            onItemClick = onContentClick,
                            modifier = Modifier.padding(horizontal = 48.dp)
                        )
                    }
                }

                // Catalog Rows
                items(uiState.catalogs) { catalog ->
                    ContentCarousel(
                        title = catalog.config.catalogName,
                        items = catalog.items,
                        onItemClick = onContentClick,
                        onSeeAllClick = { onCatalogClick(catalog.config) },
                        modifier = Modifier.padding(horizontal = 48.dp)
                    )
                }
            }
        }
    }
}
