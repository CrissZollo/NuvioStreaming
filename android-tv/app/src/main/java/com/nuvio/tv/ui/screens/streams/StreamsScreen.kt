package com.nuvio.tv.ui.screens.streams

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.nuvio.tv.domain.model.Stream
import com.nuvio.tv.ui.theme.NuvioTypography

/**
 * Streams screen for selecting a stream source.
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

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(48.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            when {
                uiState.isLoading -> {
                    Text(
                        text = "Loading streams...",
                        style = NuvioTypography.headlineMedium,
                        color = MaterialTheme.colorScheme.onBackground
                    )
                }
                uiState.streams.isEmpty() -> {
                    Text(
                        text = "No streams available",
                        style = NuvioTypography.headlineMedium,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f)
                    )
                }
                else -> {
                    Text(
                        text = "${uiState.streams.size} streams found",
                        style = NuvioTypography.headlineMedium,
                        color = MaterialTheme.colorScheme.onBackground
                    )
                    // Stream list will be implemented here
                }
            }
        }
    }
}
