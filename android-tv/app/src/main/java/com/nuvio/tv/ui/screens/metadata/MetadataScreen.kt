package com.nuvio.tv.ui.screens.metadata

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.tv.foundation.lazy.list.TvLazyColumn
import androidx.tv.foundation.lazy.list.TvLazyRow
import androidx.tv.foundation.lazy.list.items
import coil.compose.AsyncImage
import com.nuvio.tv.domain.model.CastMember
import com.nuvio.tv.domain.model.Episode
import com.nuvio.tv.domain.model.Season
import com.nuvio.tv.domain.model.StreamingContent
import com.nuvio.tv.ui.components.cards.ContentCard
import com.nuvio.tv.ui.theme.NuvioShapes
import com.nuvio.tv.ui.theme.NuvioTypography

/**
 * Metadata screen showing movie/series details.
 */
@Composable
fun MetadataScreen(
    contentType: String,
    contentId: String,
    viewModel: MetadataViewModel = hiltViewModel(),
    onPlayClick: (StreamingContent, String?) -> Unit,
    onEpisodeClick: (StreamingContent, Episode) -> Unit = { _, _ -> },
    onContentClick: (StreamingContent) -> Unit = {},
    onBackClick: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(contentType, contentId) {
        viewModel.loadMetadata(contentType, contentId)
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        when {
            uiState.isLoading -> {
                LoadingState()
            }
            uiState.error != null -> {
                ErrorState(error = uiState.error ?: "", onRetry = { viewModel.refresh() })
            }
            uiState.content != null -> {
                MetadataContent(
                    uiState = uiState,
                    onPlayClick = { onPlayClick(uiState.content!!, null) },
                    onEpisodeClick = { episode -> onEpisodeClick(uiState.content!!, episode) },
                    onContentClick = onContentClick,
                    onSeasonSelect = { viewModel.selectSeason(it) },
                    onToggleLibrary = { viewModel.toggleLibrary() },
                    onToggleWatchlist = { viewModel.toggleWatchlist() },
                    onMarkWatched = { viewModel.markAsWatched() }
                )
            }
        }
    }
}

@Composable
private fun LoadingState() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "Loading...",
                style = NuvioTypography.bodyMedium,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f)
            )
        }
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
                text = "Error loading content",
                style = NuvioTypography.headlineMedium,
                color = MaterialTheme.colorScheme.error
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = error,
                style = NuvioTypography.bodyMedium,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f)
            )
            Spacer(modifier = Modifier.height(24.dp))
            Button(onClick = onRetry) {
                Text("Retry")
            }
        }
    }
}

@Composable
private fun MetadataContent(
    uiState: MetadataUiState,
    onPlayClick: () -> Unit,
    onEpisodeClick: (Episode) -> Unit,
    onContentClick: (StreamingContent) -> Unit,
    onSeasonSelect: (Int) -> Unit,
    onToggleLibrary: () -> Unit,
    onToggleWatchlist: () -> Unit,
    onMarkWatched: () -> Unit
) {
    val content = uiState.content ?: return

    Box(modifier = Modifier.fillMaxSize()) {
        // Background Image with Gradient
        AsyncImage(
            model = content.background ?: content.poster,
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier
                .fillMaxWidth()
                .height(500.dp)
        )

        // Gradient overlay
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(600.dp)
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            Color.Transparent,
                            MaterialTheme.colorScheme.background.copy(alpha = 0.8f),
                            MaterialTheme.colorScheme.background
                        ),
                        startY = 0f,
                        endY = 1200f
                    )
                )
        )

        // Content
        TvLazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 48.dp)
        ) {
            // Hero Section
            item(key = "hero") {
                HeroSection(
                    content = content,
                    watchProgress = uiState.watchProgress?.progress,
                    isInLibrary = uiState.isInLibrary,
                    isInWatchlist = uiState.isInWatchlist,
                    onPlayClick = onPlayClick,
                    onToggleLibrary = onToggleLibrary,
                    onToggleWatchlist = onToggleWatchlist
                )
            }

            // Cast Section
            if (uiState.cast.isNotEmpty()) {
                item(key = "cast") {
                    CastSection(cast = uiState.cast)
                }
            }

            // Seasons & Episodes (for series)
            if (content.isSeries && uiState.seasons.isNotEmpty()) {
                item(key = "seasons") {
                    SeasonsSection(
                        seasons = uiState.seasons,
                        selectedSeason = uiState.selectedSeason,
                        onSeasonSelect = onSeasonSelect
                    )
                }

                item(key = "episodes") {
                    EpisodesSection(
                        episodes = uiState.episodes,
                        isLoading = uiState.isLoadingEpisodes,
                        nextEpisode = uiState.nextEpisode,
                        onEpisodeClick = onEpisodeClick
                    )
                }
            }

            // Recommendations
            if (uiState.recommendations.isNotEmpty()) {
                item(key = "recommendations") {
                    RecommendationsSection(
                        recommendations = uiState.recommendations,
                        onContentClick = onContentClick
                    )
                }
            }
        }
    }
}

@Composable
private fun HeroSection(
    content: StreamingContent,
    watchProgress: Float?,
    isInLibrary: Boolean,
    isInWatchlist: Boolean,
    onPlayClick: () -> Unit,
    onToggleLibrary: () -> Unit,
    onToggleWatchlist: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 48.dp, vertical = 24.dp)
            .padding(top = 200.dp)
    ) {
        // Poster
        AsyncImage(
            model = content.poster,
            contentDescription = content.name,
            contentScale = ContentScale.Crop,
            modifier = Modifier
                .width(200.dp)
                .aspectRatio(2f / 3f)
                .clip(NuvioShapes.card)
        )

        Spacer(modifier = Modifier.width(32.dp))

        // Details
        Column(modifier = Modifier.weight(1f)) {
            // Title
            Text(
                text = content.name,
                style = NuvioTypography.displaySmall,
                color = MaterialTheme.colorScheme.onBackground,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(8.dp))

            // Metadata Row
            Row(verticalAlignment = Alignment.CenterVertically) {
                content.year?.let { year ->
                    Text(
                        text = year.toString(),
                        style = NuvioTypography.bodyMedium,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f)
                    )
                    Spacer(modifier = Modifier.width(16.dp))
                }

                content.formattedRuntime?.let { runtime ->
                    Text(
                        text = runtime,
                        style = NuvioTypography.bodyMedium,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f)
                    )
                    Spacer(modifier = Modifier.width(16.dp))
                }

                content.imdbRating?.let { rating ->
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.Star,
                            contentDescription = null,
                            tint = Color(0xFFF5C518),
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = rating,
                            style = NuvioTypography.bodyMedium,
                            color = Color(0xFFF5C518),
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            // Genres
            if (content.genres.isNotEmpty()) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = content.genres.joinToString(" • "),
                    style = NuvioTypography.bodySmall,
                    color = MaterialTheme.colorScheme.primary
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Description
            content.description?.let { desc ->
                Text(
                    text = desc,
                    style = NuvioTypography.bodyMedium,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.8f),
                    maxLines = 4,
                    overflow = TextOverflow.Ellipsis
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Action Buttons
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                // Play Button
                Button(
                    onClick = onPlayClick,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.primary
                    )
                ) {
                    Icon(
                        imageVector = Icons.Default.PlayArrow,
                        contentDescription = null,
                        modifier = Modifier.size(24.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = if (watchProgress != null && watchProgress > 0.05f) "Resume" else "Play",
                        style = NuvioTypography.labelLarge
                    )
                }

                // Watchlist Button
                OutlinedButton(onClick = onToggleWatchlist) {
                    Icon(
                        imageVector = if (isInWatchlist) Icons.Default.Check else Icons.Default.Add,
                        contentDescription = null,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = if (isInWatchlist) "In Watchlist" else "Watchlist",
                        style = NuvioTypography.labelLarge
                    )
                }

                // Favorite Button
                OutlinedButton(onClick = onToggleLibrary) {
                    Icon(
                        imageVector = if (isInLibrary) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                        contentDescription = null,
                        tint = if (isInLibrary) Color.Red else MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun CastSection(cast: List<CastMember>) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 48.dp, vertical = 16.dp)
    ) {
        Text(
            text = "Cast",
            style = NuvioTypography.headlineSmall,
            color = MaterialTheme.colorScheme.onBackground
        )

        Spacer(modifier = Modifier.height(12.dp))

        TvLazyRow(
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            contentPadding = PaddingValues(end = 48.dp)
        ) {
            items(items = cast.take(10), key = { it.id }) { member ->
                CastCard(cast = member)
            }
        }
    }
}

@Composable
private fun CastCard(cast: CastMember) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.width(100.dp)
    ) {
        AsyncImage(
            model = cast.profileUrl,
            contentDescription = cast.name,
            contentScale = ContentScale.Crop,
            modifier = Modifier
                .size(80.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.surfaceVariant)
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = cast.name,
            style = NuvioTypography.labelSmall,
            color = MaterialTheme.colorScheme.onBackground,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )

        cast.character?.let { character ->
            Text(
                text = character,
                style = NuvioTypography.labelSmall,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

@Composable
private fun SeasonsSection(
    seasons: List<Season>,
    selectedSeason: Int,
    onSeasonSelect: (Int) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 48.dp, vertical = 16.dp)
    ) {
        Text(
            text = "Seasons",
            style = NuvioTypography.headlineSmall,
            color = MaterialTheme.colorScheme.onBackground
        )

        Spacer(modifier = Modifier.height(12.dp))

        TvLazyRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(items = seasons, key = { it.seasonNumber }) { season ->
                val isSelected = season.seasonNumber == selectedSeason

                Button(
                    onClick = { onSeasonSelect(season.seasonNumber) },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (isSelected) {
                            MaterialTheme.colorScheme.primary
                        } else {
                            MaterialTheme.colorScheme.surfaceVariant
                        }
                    ),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        text = season.displayName,
                        color = if (isSelected) {
                            MaterialTheme.colorScheme.onPrimary
                        } else {
                            MaterialTheme.colorScheme.onSurface
                        }
                    )
                }
            }
        }
    }
}

@Composable
private fun EpisodesSection(
    episodes: List<Episode>,
    isLoading: Boolean,
    nextEpisode: Episode?,
    onEpisodeClick: (Episode) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 48.dp, vertical = 16.dp)
    ) {
        Text(
            text = "Episodes",
            style = NuvioTypography.headlineSmall,
            color = MaterialTheme.colorScheme.onBackground
        )

        Spacer(modifier = Modifier.height(12.dp))

        if (isLoading) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(120.dp),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(32.dp)
                )
            }
        } else {
            TvLazyRow(
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                contentPadding = PaddingValues(end = 48.dp)
            ) {
                items(items = episodes, key = { it.id }) { episode ->
                    EpisodeCard(
                        episode = episode,
                        isNextEpisode = episode.id == nextEpisode?.id,
                        onClick = { onEpisodeClick(episode) }
                    )
                }
            }
        }
    }
}

@Composable
private fun EpisodeCard(
    episode: Episode,
    isNextEpisode: Boolean,
    onClick: () -> Unit
) {
    Column(
        modifier = Modifier.width(240.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(16f / 9f)
                .clip(NuvioShapes.card)
                .background(MaterialTheme.colorScheme.surfaceVariant)
        ) {
            // Thumbnail
            episode.thumbnail?.let { thumb ->
                AsyncImage(
                    model = thumb,
                    contentDescription = episode.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )
            }

            // Episode Number Badge
            Box(
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .padding(8.dp)
                    .clip(NuvioShapes.badge)
                    .background(
                        if (isNextEpisode) MaterialTheme.colorScheme.primary
                        else Color.Black.copy(alpha = 0.7f)
                    )
                    .padding(horizontal = 8.dp, vertical = 4.dp)
            ) {
                Text(
                    text = episode.episodeCode,
                    style = NuvioTypography.badge,
                    color = Color.White
                )
            }

            // Play button overlay
            if (isNextEpisode) {
                Box(
                    modifier = Modifier
                        .align(Alignment.Center)
                        .size(48.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primary),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.PlayArrow,
                        contentDescription = "Play",
                        tint = MaterialTheme.colorScheme.onPrimary,
                        modifier = Modifier.size(32.dp)
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = episode.title,
            style = NuvioTypography.labelMedium,
            color = MaterialTheme.colorScheme.onBackground,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )

        episode.formattedRuntime?.let { runtime ->
            Text(
                text = runtime,
                style = NuvioTypography.labelSmall,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f)
            )
        }
    }
}

@Composable
private fun RecommendationsSection(
    recommendations: List<StreamingContent>,
    onContentClick: (StreamingContent) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 48.dp, vertical = 16.dp)
    ) {
        Text(
            text = "More Like This",
            style = NuvioTypography.headlineSmall,
            color = MaterialTheme.colorScheme.onBackground
        )

        Spacer(modifier = Modifier.height(12.dp))

        TvLazyRow(
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            contentPadding = PaddingValues(end = 48.dp)
        ) {
            items(items = recommendations, key = { it.id }) { content ->
                ContentCard(
                    content = content,
                    onClick = { onContentClick(content) }
                )
            }
        }
    }
}
