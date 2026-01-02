package com.nuvio.tv.ui.screens.streams

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Cloud
import androidx.compose.material.icons.filled.HighQuality
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Storage
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.tv.foundation.lazy.list.TvLazyColumn
import androidx.tv.foundation.lazy.list.items
import androidx.tv.material3.Border
import androidx.tv.material3.Card
import androidx.tv.material3.CardDefaults
import androidx.tv.material3.ExperimentalTvMaterial3Api
import coil.compose.AsyncImage
import com.nuvio.tv.domain.model.Stream
import com.nuvio.tv.ui.theme.NuvioShapes
import com.nuvio.tv.ui.theme.NuvioTypography

/**
 * Streams screen for selecting a stream source.
 * Matches the mobile app's TabletStreamsLayout design.
 */
@Composable
fun StreamsScreen(
    contentType: String,
    contentId: String,
    episodeId: String? = null,
    viewModel: StreamsViewModel = hiltViewModel(),
    onStreamSelected: (Stream) -> Unit,
    onBackClick: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(contentType, contentId, episodeId) {
        viewModel.loadStreams(contentType, contentId, episodeId)
    }

    // Animation states
    var contentVisible by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        contentVisible = true
    }

    Box(modifier = Modifier.fillMaxSize()) {
        // Full Screen Background with blur
        BackdropLayer(
            backdropUrl = uiState.content?.background ?: uiState.content?.poster,
            isVisible = contentVisible
        )

        // Main content: Left panel (logo/info) + Right panel (streams)
        Row(modifier = Modifier.fillMaxSize()) {
            // Left Panel - Movie Logo or Episode Info (40%)
            AnimatedVisibility(
                visible = contentVisible,
                enter = fadeIn(tween(600, delayMillis = 300)) + slideInHorizontally(
                    tween(600, delayMillis = 300)
                ) { -it / 3 },
                modifier = Modifier
                    .fillMaxHeight()
                    .weight(0.4f)
            ) {
                LeftPanel(
                    uiState = uiState,
                    contentType = contentType,
                    modifier = Modifier.fillMaxSize()
                )
            }

            // Right Panel - Streams List (60%)
            AnimatedVisibility(
                visible = contentVisible,
                enter = fadeIn(tween(600, delayMillis = 500)) + slideInHorizontally(
                    tween(600, delayMillis = 500)
                ) { it / 3 },
                modifier = Modifier
                    .fillMaxHeight()
                    .weight(0.6f)
            ) {
                RightPanel(
                    uiState = uiState,
                    onStreamClick = onStreamSelected,
                    onRetry = { viewModel.refresh() },
                    modifier = Modifier.fillMaxSize()
                )
            }
        }
    }
}

@Composable
private fun BackdropLayer(
    backdropUrl: String?,
    isVisible: Boolean
) {
    val alpha by animateFloatAsState(
        targetValue = if (isVisible) 1f else 0f,
        animationSpec = tween(800),
        label = "backdropAlpha"
    )

    Box(modifier = Modifier.fillMaxSize()) {
        // Background Image with blur
        if (backdropUrl != null) {
            AsyncImage(
                model = backdropUrl,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .fillMaxSize()
                    .blur(15.dp)
                    .scale(1.1f) // Slightly larger to avoid blur edges
            )
        }

        // Dark overlay for blur effect (simulates iOS/Android blur tint)
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.7f * alpha))
        )

        // Gradient overlay
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.horizontalGradient(
                        colors = listOf(
                            Color.Black.copy(alpha = 0.3f),
                            Color.Black.copy(alpha = 0.5f),
                            Color.Black.copy(alpha = 0.6f)
                        )
                    )
                )
        )
    }
}

@Composable
private fun LeftPanel(
    uiState: StreamsUiState,
    contentType: String,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier.padding(32.dp),
        contentAlignment = Alignment.Center
    ) {
        when {
            contentType == "movie" && uiState.content != null -> {
                // Movie: Show logo or title
                MovieLogoSection(
                    logoUrl = uiState.content.logo,
                    title = uiState.content.name
                )
            }
            contentType == "series" && uiState.content != null -> {
                // Series: Show episode info
                EpisodeInfoSection(
                    showName = uiState.content.name,
                    episodeTitle = uiState.episodeTitle,
                    overview = uiState.content.description
                )
            }
            else -> {
                // Loading or no content
                Text(
                    text = "Loading...",
                    style = NuvioTypography.bodyLarge,
                    color = Color.White.copy(alpha = 0.6f)
                )
            }
        }
    }
}

@Composable
private fun MovieLogoSection(
    logoUrl: String?,
    title: String
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.fillMaxWidth(0.8f)
    ) {
        if (logoUrl != null) {
            AsyncImage(
                model = logoUrl,
                contentDescription = title,
                contentScale = ContentScale.Fit,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(120.dp)
            )
        } else {
            Text(
                text = title,
                style = NuvioTypography.headlineLarge.copy(
                    fontSize = 36.sp,
                    fontWeight = FontWeight.Black
                ),
                color = Color.White,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

@Composable
private fun EpisodeInfoSection(
    showName: String,
    episodeTitle: String?,
    overview: String?
) {
    Column(
        modifier = Modifier.fillMaxWidth(0.85f)
    ) {
        // Episode number (S1 E5 format)
        if (episodeTitle != null) {
            Text(
                text = episodeTitle,
                style = NuvioTypography.titleMedium.copy(
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold
                ),
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(bottom = 8.dp)
            )
        }

        // Show title
        Text(
            text = showName,
            style = NuvioTypography.headlineLarge.copy(
                fontSize = 32.sp,
                fontWeight = FontWeight.Bold,
                lineHeight = 38.sp
            ),
            color = Color.White,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(bottom = 16.dp)
        )

        // Episode overview
        if (overview != null) {
            Text(
                text = overview,
                style = NuvioTypography.bodyMedium.copy(
                    fontSize = 16.sp,
                    lineHeight = 24.sp
                ),
                color = Color.White.copy(alpha = 0.8f),
                maxLines = 4,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

@Composable
private fun RightPanel(
    uiState: StreamsUiState,
    onStreamClick: (Stream) -> Unit,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .padding(vertical = 24.dp, horizontal = 16.dp)
    ) {
        // Blurred container for streams
        Box(
            modifier = Modifier
                .fillMaxSize()
                .clip(RoundedCornerShape(24.dp))
                .background(Color.Black.copy(alpha = 0.4f))
        ) {
            when {
                uiState.isLoading && uiState.streamGroups.isEmpty() -> {
                    LoadingState()
                }

                uiState.error != null && uiState.streamGroups.isEmpty() -> {
                    ErrorState(
                        error = uiState.error ?: "",
                        onRetry = onRetry
                    )
                }

                else -> {
                    StreamsContent(
                        uiState = uiState,
                        onStreamClick = onStreamClick
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
            CircularProgressIndicator(
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(48.dp)
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "Finding streams...",
                style = NuvioTypography.bodyMedium,
                color = Color.White.copy(alpha = 0.7f)
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
                text = "No streams found",
                style = NuvioTypography.headlineMedium,
                color = MaterialTheme.colorScheme.error
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = error,
                style = NuvioTypography.bodyMedium,
                color = Color.White.copy(alpha = 0.7f)
            )
            Spacer(modifier = Modifier.height(24.dp))
            Button(onClick = onRetry) {
                Text("Retry")
            }
        }
    }
}

@Composable
private fun StreamsContent(
    uiState: StreamsUiState,
    onStreamClick: (Stream) -> Unit
) {
    // Tab state: 0 = All, 1+ = specific addon
    var selectedTabIndex by remember { mutableIntStateOf(0) }

    // Build tab list: "All" + each addon
    val tabs = remember(uiState.streamGroups) {
        listOf("All") + uiState.streamGroups.map { it.addonName }
    }

    // Filter streams based on selected tab
    val filteredGroups = remember(selectedTabIndex, uiState.streamGroups) {
        if (selectedTabIndex == 0) {
            uiState.streamGroups
        } else {
            val selectedAddonIndex = selectedTabIndex - 1
            if (selectedAddonIndex < uiState.streamGroups.size) {
                listOf(uiState.streamGroups[selectedAddonIndex])
            } else {
                uiState.streamGroups
            }
        }
    }

    // Count for selected tab
    val displayedStreamCount = remember(filteredGroups) {
        filteredGroups.sumOf { it.streams.size }
    }

    // Show tabs only when there are 2+ sources
    val showTabs = uiState.streamGroups.size >= 2

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        // Header showing stream count
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = if (showTabs) 8.dp else 16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Select Source",
                style = NuvioTypography.titleLarge,
                color = Color.White,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = if (selectedTabIndex == 0) {
                    "${uiState.totalStreams} sources found"
                } else {
                    "$displayedStreamCount of ${uiState.totalStreams} sources"
                },
                style = NuvioTypography.bodySmall,
                color = Color.White.copy(alpha = 0.6f)
            )
        }

        // Tab bar (only show when 2+ sources)
        if (showTabs) {
            SourceTabBar(
                tabs = tabs,
                selectedTabIndex = selectedTabIndex,
                onTabSelected = { selectedTabIndex = it },
                modifier = Modifier.padding(bottom = 12.dp)
            )
        }

        // Streams list
        TvLazyColumn(
            verticalArrangement = Arrangement.spacedBy(8.dp),
            contentPadding = PaddingValues(bottom = 24.dp)
        ) {
            filteredGroups.forEach { group ->
                // Section header (only show in "All" tab when there are multiple sources)
                if (selectedTabIndex == 0 && showTabs) {
                    item(key = "header_${group.addonId}") {
                        StreamGroupHeader(
                            title = group.addonName,
                            isLoading = group.isLoading
                        )
                    }
                }

                // Stream items
                items(
                    items = group.streams,
                    key = { "${group.addonId}:${it.url ?: it.infoHash}" }
                ) { stream ->
                    StreamCard(
                        stream = stream,
                        onClick = { onStreamClick(stream) }
                    )
                }
            }

            // Loading more indicator
            if (uiState.isLoading && uiState.streamGroups.isNotEmpty()) {
                item(key = "loading_more") {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 16.dp),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            color = MaterialTheme.colorScheme.primary,
                            strokeWidth = 2.dp
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Text(
                            text = "Loading more sources...",
                            style = NuvioTypography.bodySmall,
                            color = Color.White.copy(alpha = 0.6f)
                        )
                    }
                }
            }

            // Empty state
            if (!uiState.isLoading && filteredGroups.isEmpty()) {
                item(key = "empty") {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(200.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "No streams available for this content",
                            style = NuvioTypography.bodyMedium,
                            color = Color.White.copy(alpha = 0.7f)
                        )
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalTvMaterial3Api::class)
@Composable
private fun SourceTabBar(
    tabs: List<String>,
    selectedTabIndex: Int,
    onTabSelected: (Int) -> Unit,
    modifier: Modifier = Modifier
) {
    val scrollState = rememberScrollState()

    Row(
        modifier = modifier
            .fillMaxWidth()
            .horizontalScroll(scrollState),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        tabs.forEachIndexed { index, tabName ->
            SourceTab(
                text = tabName,
                isSelected = selectedTabIndex == index,
                onClick = { onTabSelected(index) }
            )
        }
    }
}

@OptIn(ExperimentalTvMaterial3Api::class)
@Composable
private fun SourceTab(
    text: String,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    var isFocused by remember { mutableStateOf(false) }

    val backgroundColor = when {
        isSelected -> MaterialTheme.colorScheme.primary
        isFocused -> MaterialTheme.colorScheme.primary.copy(alpha = 0.3f)
        else -> Color.White.copy(alpha = 0.1f)
    }

    val textColor = when {
        isSelected -> Color.White
        isFocused -> MaterialTheme.colorScheme.primary
        else -> Color.White.copy(alpha = 0.8f)
    }

    val borderColor = when {
        isFocused && !isSelected -> MaterialTheme.colorScheme.primary
        else -> Color.Transparent
    }

    Card(
        onClick = onClick,
        modifier = Modifier.onFocusChanged { isFocused = it.isFocused },
        scale = CardDefaults.scale(focusedScale = 1.05f),
        border = CardDefaults.border(
            focusedBorder = Border(
                border = BorderStroke(2.dp, borderColor),
                shape = RoundedCornerShape(20.dp)
            )
        ),
        shape = CardDefaults.shape(shape = RoundedCornerShape(20.dp)),
        colors = CardDefaults.colors(containerColor = backgroundColor)
    ) {
        Box(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = text,
                style = NuvioTypography.labelMedium.copy(
                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium
                ),
                color = textColor
            )
        }
    }
}

@Composable
private fun StreamGroupHeader(
    title: String,
    isLoading: Boolean
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp, horizontal = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = title,
            style = NuvioTypography.labelLarge.copy(
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold
            ),
            color = Color.White.copy(alpha = 0.9f)
        )

        if (isLoading) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                CircularProgressIndicator(
                    modifier = Modifier.size(14.dp),
                    color = MaterialTheme.colorScheme.primary,
                    strokeWidth = 2.dp
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Loading...",
                    style = NuvioTypography.labelSmall,
                    color = MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}

@OptIn(ExperimentalTvMaterial3Api::class)
@Composable
private fun StreamCard(
    stream: Stream,
    onClick: () -> Unit
) {
    var isFocused by remember { mutableStateOf(false) }

    val scale by animateFloatAsState(
        targetValue = if (isFocused) 1.02f else 1f,
        animationSpec = tween(durationMillis = 150),
        label = "cardScale"
    )

    val borderWidth by animateDpAsState(
        targetValue = if (isFocused) 2.dp else 0.dp,
        animationSpec = tween(durationMillis = 150),
        label = "borderWidth"
    )

    // Card background color - highlighted for debrid/cached streams
    val backgroundColor = when {
        stream.isCached -> MaterialTheme.colorScheme.surface.copy(alpha = 0.98f)
        stream.isDebrid -> MaterialTheme.colorScheme.surface.copy(alpha = 0.95f)
        else -> MaterialTheme.colorScheme.surface.copy(alpha = 0.85f)
    }

    Card(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .scale(scale)
            .onFocusChanged { isFocused = it.isFocused },
        scale = CardDefaults.scale(focusedScale = 1f),
        border = CardDefaults.border(
            focusedBorder = Border(
                border = BorderStroke(borderWidth, MaterialTheme.colorScheme.primary),
                shape = RoundedCornerShape(12.dp)
            )
        ),
        shape = CardDefaults.shape(shape = RoundedCornerShape(12.dp)),
        colors = CardDefaults.colors(containerColor = backgroundColor)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalAlignment = Alignment.Top
        ) {
            // Stream details
            Column(modifier = Modifier.weight(1f)) {
                // Row 1: Quality badge + Name
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    // Quality Badge (prominent)
                    val quality = stream.parsedQuality ?: stream.quality
                    if (quality != null) {
                        QualityBadge(quality = quality)
                        Spacer(modifier = Modifier.width(10.dp))
                    }

                    // Stream name
                    Text(
                        text = stream.displayName,
                        style = NuvioTypography.bodyMedium.copy(
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold
                        ),
                        color = if (isFocused) {
                            MaterialTheme.colorScheme.primary
                        } else {
                            MaterialTheme.colorScheme.onSurface
                        },
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f)
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Row 2: Size, Source, Type/Codec
                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    // File Size
                    stream.formattedSize?.let { size ->
                        InfoChip(label = "Size", value = size)
                    }

                    // Source type
                    InfoChip(label = "Source", value = stream.sourceType)

                    // Codec/Type
                    stream.parsedCodec?.let { codec ->
                        InfoChip(label = "Type", value = codec)
                    }
                }

                Spacer(modifier = Modifier.height(6.dp))

                // Row 3: Language, HDR, Seeds/Age
                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    // Language
                    stream.parsedLanguage?.let { lang ->
                        InfoChip(label = "Lang", value = lang)
                    }

                    // HDR info
                    stream.parsedHdr?.let { hdr ->
                        Chip(
                            text = hdr,
                            backgroundColor = Color(0xFF9C27B0) // Purple for HDR
                        )
                    }

                    // Seeds (for torrents)
                    stream.parsedSeeds?.let { seeds ->
                        InfoChip(label = "Seeds", value = seeds.toString())
                    }

                    // Debrid/Instant Badge (TorBox calls cached streams "Instant")
                    if (stream.isCached) {
                        Chip(
                            text = "⚡ INSTANT",
                            backgroundColor = Color(0xFF4CAF50)
                        )
                    } else if (stream.isDebrid) {
                        Chip(
                            text = "DEBRID",
                            backgroundColor = Color(0xFF2196F3)
                        )
                    }
                }
            }

            // Play indicator when focused
            if (isFocused) {
                Spacer(modifier = Modifier.width(12.dp))
                Icon(
                    imageVector = Icons.Default.PlayArrow,
                    contentDescription = "Play",
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(32.dp)
                )
            }
        }
    }
}

@Composable
private fun InfoChip(
    label: String,
    value: String
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .clip(RoundedCornerShape(6.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.7f))
            .padding(horizontal = 8.dp, vertical = 4.dp)
    ) {
        Text(
            text = "$label:",
            style = NuvioTypography.labelSmall.copy(
                fontSize = 10.sp,
                fontWeight = FontWeight.Medium
            ),
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
        )
        Spacer(modifier = Modifier.width(4.dp))
        Text(
            text = value,
            style = NuvioTypography.labelSmall.copy(
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold
            ),
            color = MaterialTheme.colorScheme.onSurface
        )
    }
}

@Composable
private fun QualityBadge(quality: String) {
    val backgroundColor = getQualityColor(quality)

    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .clip(RoundedCornerShape(4.dp))
            .background(backgroundColor)
            .padding(horizontal = 8.dp, vertical = 4.dp)
    ) {
        Icon(
            imageVector = Icons.Default.HighQuality,
            contentDescription = null,
            tint = Color.White,
            modifier = Modifier.size(12.dp)
        )
        Spacer(modifier = Modifier.width(4.dp))
        Text(
            text = quality,
            style = NuvioTypography.labelSmall.copy(
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold
            ),
            color = Color.White
        )
    }
}

@Composable
private fun Chip(
    text: String,
    backgroundColor: Color
) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(12.dp))
            .background(backgroundColor)
            .padding(horizontal = 8.dp, vertical = 3.dp)
    ) {
        Text(
            text = text,
            style = NuvioTypography.labelSmall.copy(
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold
            ),
            color = Color.White
        )
    }
}

private fun getQualityColor(quality: String): Color {
    val qualityLower = quality.lowercase()
    return when {
        qualityLower.contains("4k") || qualityLower.contains("2160") -> Color(0xFFFF9800) // Orange
        qualityLower.contains("1080") -> Color(0xFF4CAF50) // Green
        qualityLower.contains("720") -> Color(0xFF2196F3) // Blue
        qualityLower.contains("480") -> Color(0xFF9E9E9E) // Gray
        else -> Color(0xFF607D8B) // Blue Gray
    }
}
