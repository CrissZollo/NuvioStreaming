package com.nuvio.tv.ui.screens.metadata

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.runtime.derivedStateOf
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
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.tv.foundation.lazy.list.TvLazyColumn
import androidx.tv.foundation.lazy.list.TvLazyRow
import androidx.tv.foundation.lazy.list.items
import androidx.tv.foundation.lazy.list.rememberTvLazyListState
import androidx.tv.material3.Border
import androidx.tv.material3.Card
import androidx.tv.material3.CardDefaults
import androidx.tv.material3.ExperimentalTvMaterial3Api
import coil.compose.AsyncImage
import com.nuvio.tv.domain.model.CastMember
import com.nuvio.tv.domain.model.Episode
import com.nuvio.tv.domain.model.Season
import com.nuvio.tv.domain.model.StreamingContent
import com.nuvio.tv.ui.components.cards.ContentCard
import com.nuvio.tv.ui.components.dialogs.CastDetailsDialog
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
    onFilmographyClick: (Int, String) -> Unit = { _, _ -> },
    onBackClick: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    val playButtonFocusRequester = remember { FocusRequester() }

    LaunchedEffect(contentType, contentId) {
        viewModel.loadMetadata(contentType, contentId)
    }

    // Request focus on play button when content loads
    LaunchedEffect(uiState.content) {
        if (uiState.content != null && !uiState.isLoading) {
            // Small delay to ensure the button is composed
            kotlinx.coroutines.delay(100)
            try {
                playButtonFocusRequester.requestFocus()
            } catch (e: Exception) {
                // Focus request may fail if element not yet composed
            }
        }
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
                    onMarkWatched = { viewModel.markAsWatched() },
                    onCastMemberClick = { viewModel.onCastMemberClick(it) },
                    playButtonFocusRequester = playButtonFocusRequester
                )

                // Cast Details Dialog
                val selectedCast = uiState.selectedCastMember
                if (uiState.showCastDialog && selectedCast != null) {
                    CastDetailsDialog(
                        castMember = selectedCast,
                        personDetails = uiState.personDetails,
                        isLoading = uiState.isLoadingPersonDetails,
                        onDismiss = { viewModel.closeCastDialog() },
                        onFilmographyClick = { personDetails ->
                            viewModel.closeCastDialog()
                            onFilmographyClick(personDetails.id, personDetails.name)
                        }
                    )
                }
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
    onMarkWatched: () -> Unit,
    onCastMemberClick: (CastMember) -> Unit,
    playButtonFocusRequester: FocusRequester
) {
    val content = uiState.content ?: return

    val listState = rememberTvLazyListState()

    // Cache background image URL to prevent recomposition
    val backgroundImage = remember(content.id) { content.background ?: content.poster }
    val backgroundColor = MaterialTheme.colorScheme.background

    // Calculate scroll offset for parallax effect using derivedStateOf for reactivity
    val scrollOffset by remember {
        derivedStateOf {
            if (listState.firstVisibleItemIndex == 0) {
                listState.firstVisibleItemScrollOffset.toFloat()
            } else {
                // If we've scrolled past the first item, use a large value to keep image scrolled up
                listState.firstVisibleItemScrollOffset.toFloat() + (listState.firstVisibleItemIndex * 1000f)
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        // Layer 1: Background Image that follows scroll (parallax effect)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.6f)
                .align(Alignment.TopStart)
                .graphicsLayer {
                    // Move backdrop up as user scrolls down (parallax at 0.5x speed)
                    translationY = -scrollOffset * 0.5f
                }
        ) {
            AsyncImage(
                model = backgroundImage,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize()
            )

            // Gradient overlay on image - follows with the backdrop
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(
                                Color.Transparent,
                                Color.Transparent,
                                backgroundColor.copy(alpha = 0.8f),
                                backgroundColor
                            )
                        )
                    )
            )
        }

        // Layer 2: Full screen background color (behind scrollable content)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.5f)
                .align(Alignment.BottomCenter)
                .background(backgroundColor)
        )

        // Layer 3: Scrollable content on top
        TvLazyColumn(
            state = listState,
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 48.dp)
        ) {
            // Hero Section - takes full screen height when focused
            item(key = "hero") {
                HeroSection(
                    content = content,
                    watchProgress = uiState.watchProgress?.progress,
                    isInLibrary = uiState.isInLibrary,
                    isInWatchlist = uiState.isInWatchlist,
                    onPlayClick = onPlayClick,
                    onToggleLibrary = onToggleLibrary,
                    onToggleWatchlist = onToggleWatchlist,
                    playButtonFocusRequester = playButtonFocusRequester
                )
            }

            // Cast Section - with solid background for readability
            if (uiState.cast.isNotEmpty()) {
                item(key = "cast") {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(backgroundColor)
                    ) {
                        CastSection(
                            cast = uiState.cast,
                            onCastMemberClick = onCastMemberClick
                        )
                    }
                }
            }

            // Seasons & Episodes (for series) - with solid background
            if (content.isSeries && uiState.seasons.isNotEmpty()) {
                item(key = "seasons") {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(backgroundColor)
                    ) {
                        SeasonsSection(
                            seasons = uiState.seasons,
                            selectedSeason = uiState.selectedSeason,
                            onSeasonSelect = onSeasonSelect
                        )
                    }
                }

                item(key = "episodes") {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(backgroundColor)
                    ) {
                        EpisodesSection(
                            episodes = uiState.episodes,
                            isLoading = uiState.isLoadingEpisodes,
                            nextEpisode = uiState.nextEpisode,
                            onEpisodeClick = onEpisodeClick
                        )
                    }
                }
            }

            // Recommendations - with solid background
            if (uiState.recommendations.isNotEmpty()) {
                item(key = "recommendations") {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(backgroundColor)
                    ) {
                        RecommendationsSection(
                            recommendations = uiState.recommendations,
                            onContentClick = onContentClick
                        )
                    }
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
    onToggleWatchlist: () -> Unit,
    playButtonFocusRequester: FocusRequester
) {
    var isPlayButtonFocused by remember { mutableStateOf(false) }
    var isWatchlistButtonFocused by remember { mutableStateOf(false) }
    var isFavoriteButtonFocused by remember { mutableStateOf(false) }

    // Hero section with padding to center content vertically
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 80.dp, bottom = 24.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 48.dp),
            verticalAlignment = Alignment.CenterVertically
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

            Spacer(modifier = Modifier.width(40.dp))

            // Details column
            Column(modifier = Modifier.weight(1f)) {
                // Title
                Text(
                    text = content.name,
                    style = NuvioTypography.displaySmall,
                    color = MaterialTheme.colorScheme.onBackground,
                    fontWeight = FontWeight.Bold,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Action Buttons - right after title
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    // Play Button - auto-focused on load
                    Button(
                        onClick = onPlayClick,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (isPlayButtonFocused) {
                                Color.White
                            } else {
                                MaterialTheme.colorScheme.primary
                            },
                            contentColor = if (isPlayButtonFocused) {
                                Color.Black
                            } else {
                                Color.White
                            }
                        ),
                        modifier = Modifier
                            .focusRequester(playButtonFocusRequester)
                            .onFocusChanged { focusState ->
                                isPlayButtonFocused = focusState.isFocused
                            }
                            .then(
                                if (isPlayButtonFocused) {
                                    Modifier.border(
                                        width = 3.dp,
                                        color = Color.White,
                                        shape = ButtonDefaults.shape
                                    )
                                } else {
                                    Modifier
                                }
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
                            style = NuvioTypography.labelLarge,
                            fontWeight = if (isPlayButtonFocused) FontWeight.Bold else FontWeight.Medium
                        )
                    }

                    // Watchlist Button
                    OutlinedButton(
                        onClick = onToggleWatchlist,
                        colors = ButtonDefaults.outlinedButtonColors(
                            containerColor = if (isWatchlistButtonFocused) {
                                Color.White
                            } else {
                                Color.White.copy(alpha = 0.15f)
                            },
                            contentColor = if (isWatchlistButtonFocused) {
                                Color.Black
                            } else {
                                Color.White
                            }
                        ),
                        border = BorderStroke(
                            width = if (isWatchlistButtonFocused) 3.dp else 2.dp,
                            color = if (isWatchlistButtonFocused) Color.White else Color.White.copy(alpha = 0.5f)
                        ),
                        modifier = Modifier.onFocusChanged { focusState ->
                            isWatchlistButtonFocused = focusState.isFocused
                        }
                    ) {
                        Icon(
                            imageVector = if (isInWatchlist) Icons.Default.Check else Icons.Default.Add,
                            contentDescription = null,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = if (isInWatchlist) "In Watchlist" else "Watchlist",
                            style = NuvioTypography.labelLarge,
                            fontWeight = if (isWatchlistButtonFocused) FontWeight.Bold else FontWeight.Medium
                        )
                    }

                    // Favorite Button
                    OutlinedButton(
                        onClick = onToggleLibrary,
                        colors = ButtonDefaults.outlinedButtonColors(
                            containerColor = if (isFavoriteButtonFocused) {
                                Color.White
                            } else {
                                Color.White.copy(alpha = 0.15f)
                            },
                            contentColor = if (isFavoriteButtonFocused) {
                                Color.Black
                            } else {
                                Color.White
                            }
                        ),
                        border = BorderStroke(
                            width = if (isFavoriteButtonFocused) 3.dp else 2.dp,
                            color = if (isFavoriteButtonFocused) Color.White else Color.White.copy(alpha = 0.5f)
                        ),
                        modifier = Modifier.onFocusChanged { focusState ->
                            isFavoriteButtonFocused = focusState.isFocused
                        }
                    ) {
                        Icon(
                            imageVector = if (isInLibrary) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                            contentDescription = null,
                            tint = when {
                                isFavoriteButtonFocused && isInLibrary -> Color.Red
                                isFavoriteButtonFocused -> Color.Black
                                isInLibrary -> Color.Red
                                else -> Color.White
                            },
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Metadata Row (year, runtime, rating)
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

                // Description
                content.description?.let { desc ->
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = desc,
                        style = NuvioTypography.bodyMedium,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.8f),
                        maxLines = 3,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            } // Column
    } // Row (poster + details)
} // Box
}

@Composable
private fun CastSection(
    cast: List<CastMember>,
    onCastMemberClick: (CastMember) -> Unit
) {
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
                CastCard(
                    cast = member,
                    onClick = { onCastMemberClick(member) }
                )
            }
        }
    }
}

@OptIn(ExperimentalTvMaterial3Api::class)
@Composable
private fun CastCard(
    cast: CastMember,
    onClick: () -> Unit
) {
    var isFocused by remember { mutableStateOf(false) }

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.width(100.dp)
    ) {
        Card(
            onClick = onClick,
            modifier = Modifier
                .size(80.dp)
                .onFocusChanged { focusState ->
                    isFocused = focusState.isFocused
                },
            border = CardDefaults.border(
                focusedBorder = Border(
                    border = BorderStroke(3.dp, Color.White),
                    shape = CircleShape
                )
            ),
            shape = CardDefaults.shape(shape = CircleShape),
            colors = CardDefaults.colors(
                containerColor = MaterialTheme.colorScheme.surfaceVariant
            )
        ) {
            AsyncImage(
                model = cast.profileUrl,
                contentDescription = cast.name,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize()
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = cast.name,
            style = NuvioTypography.labelSmall,
            color = if (isFocused) Color.White else MaterialTheme.colorScheme.onBackground,
            fontWeight = if (isFocused) FontWeight.Bold else FontWeight.Normal,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )

        cast.character?.let { character ->
            Text(
                text = character,
                style = NuvioTypography.labelSmall,
                color = if (isFocused) Color.White.copy(alpha = 0.8f) else MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f),
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

@OptIn(ExperimentalTvMaterial3Api::class)
@Composable
private fun EpisodeCard(
    episode: Episode,
    isNextEpisode: Boolean,
    onClick: () -> Unit
) {
    var isFocused by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier.width(240.dp)
    ) {
        Card(
            onClick = onClick,
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(16f / 9f)
                .onFocusChanged { focusState ->
                    isFocused = focusState.isFocused
                },
            border = CardDefaults.border(
                focusedBorder = Border(
                    border = BorderStroke(3.dp, Color.White),
                    shape = NuvioShapes.card
                )
            ),
            shape = CardDefaults.shape(shape = NuvioShapes.card),
            colors = CardDefaults.colors(
                containerColor = MaterialTheme.colorScheme.surfaceVariant
            )
        ) {
            Box(modifier = Modifier.fillMaxSize()) {
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
                            if (isNextEpisode || isFocused) MaterialTheme.colorScheme.primary
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

            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = episode.title,
            style = NuvioTypography.labelMedium,
            color = if (isFocused) Color.White else MaterialTheme.colorScheme.onBackground,
            fontWeight = if (isFocused) FontWeight.Bold else FontWeight.Normal,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )

        episode.formattedRuntime?.let { runtime ->
            Text(
                text = runtime,
                style = NuvioTypography.labelSmall,
                color = if (isFocused) Color.White.copy(alpha = 0.7f) else MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f)
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
