package com.nuvio.tv.ui.screens.metadata

import androidx.compose.foundation.background
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
import com.nuvio.tv.domain.model.StreamingContent
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
            .padding(48.dp)
    ) {
        when {
            uiState.isLoading -> {
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
            }
            uiState.error != null -> {
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
                        Text(
                            text = uiState.error ?: "",
                            style = NuvioTypography.bodyMedium,
                            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f)
                        )
                    }
                }
            }
            uiState.content != null -> {
                // Content loaded - display metadata
                Column(modifier = Modifier.fillMaxSize()) {
                    Text(
                        text = uiState.content?.name ?: "",
                        style = NuvioTypography.displaySmall,
                        color = MaterialTheme.colorScheme.onBackground
                    )
                    // More content will be added here
                }
            }
        }
    }
}
