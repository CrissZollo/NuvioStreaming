package com.nuvio.tv.ui.screens.filmography

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
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.tv.foundation.lazy.grid.TvGridCells
import androidx.tv.foundation.lazy.grid.TvLazyVerticalGrid
import androidx.tv.foundation.lazy.grid.items
import androidx.tv.material3.Border
import androidx.tv.material3.Card
import androidx.tv.material3.CardDefaults
import androidx.tv.material3.ExperimentalTvMaterial3Api
import coil.compose.AsyncImage
import com.nuvio.tv.domain.model.PersonCredit
import com.nuvio.tv.ui.theme.NuvioShapes
import com.nuvio.tv.ui.theme.NuvioTypography

/**
 * Screen showing all movies and TV shows for a person/actor.
 */
@Composable
fun FilmographyScreen(
    personId: Int,
    personName: String,
    viewModel: FilmographyViewModel = hiltViewModel(),
    onContentClick: (String, Int) -> Unit, // mediaType, tmdbId
    onBackClick: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    val focusRequester = remember { FocusRequester() }

    LaunchedEffect(personId) {
        viewModel.loadFilmography(personId, personName)
    }

    LaunchedEffect(uiState.isLoading) {
        if (!uiState.isLoading && uiState.filmography.isNotEmpty()) {
            try {
                focusRequester.requestFocus()
            } catch (e: Exception) {
                // Ignore focus failures
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 48.dp, vertical = 24.dp)
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                var isBackFocused by remember { mutableStateOf(false) }

                IconButton(
                    onClick = onBackClick,
                    modifier = Modifier
                        .onFocusChanged { isBackFocused = it.isFocused }
                        .then(
                            if (isBackFocused) {
                                Modifier.border(
                                    width = 2.dp,
                                    color = MaterialTheme.colorScheme.primary,
                                    shape = RoundedCornerShape(8.dp)
                                )
                            } else {
                                Modifier
                            }
                        ),
                    colors = IconButtonDefaults.iconButtonColors(
                        containerColor = if (isBackFocused) {
                            MaterialTheme.colorScheme.primary.copy(alpha = 0.2f)
                        } else {
                            Color.Transparent
                        }
                    )
                ) {
                    Icon(
                        imageVector = Icons.Default.ArrowBack,
                        contentDescription = "Back",
                        tint = MaterialTheme.colorScheme.onBackground
                    )
                }

                Spacer(modifier = Modifier.width(16.dp))

                Column {
                    Text(
                        text = uiState.personName.ifEmpty { personName },
                        style = NuvioTypography.headlineMedium,
                        color = MaterialTheme.colorScheme.onBackground,
                        fontWeight = FontWeight.Bold
                    )

                    Text(
                        text = "Filmography (${uiState.filmography.size} titles)",
                        style = NuvioTypography.bodyMedium,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f)
                    )
                }

                Spacer(modifier = Modifier.weight(1f))

                // Sort options
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    SortButton(
                        text = "Popular",
                        isSelected = uiState.sortBy == SortOption.POPULARITY,
                        onClick = { viewModel.setSortBy(SortOption.POPULARITY) }
                    )
                    SortButton(
                        text = "Recent",
                        isSelected = uiState.sortBy == SortOption.RECENT,
                        onClick = { viewModel.setSortBy(SortOption.RECENT) }
                    )
                    SortButton(
                        text = "Rating",
                        isSelected = uiState.sortBy == SortOption.RATING,
                        onClick = { viewModel.setSortBy(SortOption.RATING) }
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Content
            when {
                uiState.isLoading -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                text = "Loading filmography...",
                                style = NuvioTypography.bodyMedium,
                                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f)
                            )
                        }
                    }
                }
                uiState.error != null -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = "Failed to load filmography",
                                style = NuvioTypography.headlineSmall,
                                color = MaterialTheme.colorScheme.error
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = uiState.error ?: "",
                                style = NuvioTypography.bodyMedium,
                                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f)
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Button(onClick = { viewModel.loadFilmography(personId, personName) }) {
                                Text("Retry")
                            }
                        }
                    }
                }
                uiState.filmography.isEmpty() -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "No filmography found",
                            style = NuvioTypography.headlineSmall,
                            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f)
                        )
                    }
                }
                else -> {
                    TvLazyVerticalGrid(
                        columns = TvGridCells.Adaptive(minSize = 150.dp),
                        horizontalArrangement = Arrangement.spacedBy(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                        contentPadding = PaddingValues(bottom = 48.dp)
                    ) {
                        items(
                            items = uiState.filmography,
                            key = { credit ->
                                // Use index + id + mediaType to ensure uniqueness even with duplicates
                                val index = uiState.filmography.indexOf(credit)
                                "${index}_${credit.id}_${credit.mediaType}"
                            }
                        ) { credit ->
                            val index = uiState.filmography.indexOf(credit)
                            FilmographyCard(
                                credit = credit,
                                onClick = { onContentClick(credit.mediaType, credit.id) },
                                modifier = if (index == 0) {
                                    Modifier.focusRequester(focusRequester)
                                } else {
                                    Modifier
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SortButton(
    text: String,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    var isFocused by remember { mutableStateOf(false) }

    Button(
        onClick = onClick,
        colors = ButtonDefaults.buttonColors(
            containerColor = when {
                isFocused -> Color.White
                isSelected -> MaterialTheme.colorScheme.primary
                else -> MaterialTheme.colorScheme.surfaceVariant
            },
            contentColor = when {
                isFocused -> Color.Black
                isSelected -> Color.White
                else -> MaterialTheme.colorScheme.onSurface
            }
        ),
        modifier = Modifier
            .onFocusChanged { isFocused = it.isFocused }
            .then(
                if (isFocused) {
                    Modifier.border(
                        width = 2.dp,
                        color = Color.White,
                        shape = ButtonDefaults.shape
                    )
                } else {
                    Modifier
                }
            )
    ) {
        Text(
            text = text,
            style = NuvioTypography.labelMedium,
            fontWeight = if (isSelected || isFocused) FontWeight.Bold else FontWeight.Medium
        )
    }
}

@OptIn(ExperimentalTvMaterial3Api::class)
@Composable
private fun FilmographyCard(
    credit: PersonCredit,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    var isFocused by remember { mutableStateOf(false) }

    Column(
        modifier = modifier.width(150.dp)
    ) {
        Card(
            onClick = onClick,
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(2f / 3f)
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
                AsyncImage(
                    model = credit.posterUrl,
                    contentDescription = credit.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )

                // Rating badge
                credit.voteAverage?.takeIf { it > 0 }?.let { rating ->
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .padding(8.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .background(Color.Black.copy(alpha = 0.7f))
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.Star,
                                contentDescription = null,
                                tint = Color(0xFFF5C518),
                                modifier = Modifier.size(12.dp)
                            )
                            Spacer(modifier = Modifier.width(2.dp))
                            Text(
                                text = String.format("%.1f", rating),
                                style = NuvioTypography.labelSmall,
                                color = Color.White
                            )
                        }
                    }
                }

                // Media type badge
                Box(
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(8.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.9f))
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                ) {
                    Text(
                        text = if (credit.mediaType == "movie") "Movie" else "TV",
                        style = NuvioTypography.labelSmall,
                        color = Color.White
                    )
                }

                // Gradient overlay
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            Brush.verticalGradient(
                                colors = listOf(
                                    Color.Transparent,
                                    Color.Transparent,
                                    Color.Black.copy(alpha = 0.7f)
                                )
                            )
                        )
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Title
        Text(
            text = credit.title,
            style = NuvioTypography.bodySmall,
            color = if (isFocused) Color.White else MaterialTheme.colorScheme.onBackground,
            fontWeight = if (isFocused) FontWeight.Bold else FontWeight.Normal,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis
        )

        // Year and character
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            credit.year?.let { year ->
                Text(
                    text = year.toString(),
                    style = NuvioTypography.labelSmall,
                    color = if (isFocused) Color.White.copy(alpha = 0.7f) else MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f)
                )
            }
        }

        credit.character?.let { character ->
            Text(
                text = character,
                style = NuvioTypography.labelSmall,
                color = if (isFocused) Color.White.copy(alpha = 0.6f) else MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}
