package com.nuvio.tv.ui.screens.settings.playback

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Icon
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
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.tv.foundation.lazy.list.TvLazyColumn
import androidx.tv.foundation.lazy.list.itemsIndexed
import com.nuvio.tv.ui.screens.settings.LanguageOptions
import com.nuvio.tv.ui.screens.settings.SettingsViewModel
import com.nuvio.tv.ui.screens.settings.content.SettingsHeader
import com.nuvio.tv.ui.theme.NuvioShapes
import com.nuvio.tv.ui.theme.NuvioTypography

/**
 * Audio language selection screen.
 */
@Composable
fun AudioLanguageSelectionScreen(
    viewModel: SettingsViewModel = hiltViewModel(),
    onBackClick: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsState()

    LanguageSelectionContent(
        title = "Preferred Audio Language",
        subtitle = "Automatically select audio track in this language when available",
        options = LanguageOptions.audioLanguages,
        selectedCode = uiState.preferredAudioLanguageCode,
        onSelect = { code ->
            viewModel.setPreferredAudioLanguage(code)
            onBackClick()
        },
        onBackClick = onBackClick
    )
}

/**
 * Subtitle language selection screen.
 */
@Composable
fun SubtitleLanguageSelectionScreen(
    viewModel: SettingsViewModel = hiltViewModel(),
    onBackClick: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsState()

    LanguageSelectionContent(
        title = "Preferred Subtitle Language",
        subtitle = "Automatically select subtitles in this language when available. Set to 'None' to disable auto-selection.",
        options = LanguageOptions.subtitleLanguages,
        selectedCode = uiState.preferredSubtitleLanguageCode,
        onSelect = { code ->
            viewModel.setPreferredSubtitleLanguage(code)
            onBackClick()
        },
        onBackClick = onBackClick
    )
}

/**
 * Subtitle source priority selection screen.
 */
@Composable
fun SubtitleSourceSelectionScreen(
    viewModel: SettingsViewModel = hiltViewModel(),
    onBackClick: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsState()

    LanguageSelectionContent(
        title = "Subtitle Source Priority",
        subtitle = "Choose whether to prefer embedded (internal) or external subtitles. If your preferred language isn't found in the primary source, the other source will be checked.",
        options = LanguageOptions.subtitleSourceOptions,
        selectedCode = uiState.subtitleSourcePriorityCode,
        onSelect = { code ->
            viewModel.setSubtitleSourcePriority(code)
            onBackClick()
        },
        onBackClick = onBackClick
    )
}

/**
 * Reusable selection list content.
 */
@Composable
private fun LanguageSelectionContent(
    title: String,
    subtitle: String,
    options: List<Pair<String, String>>,
    selectedCode: String,
    onSelect: (String) -> Unit,
    onBackClick: () -> Unit
) {
    val focusRequester = remember { FocusRequester() }
    val selectedIndex = options.indexOfFirst { it.first == selectedCode }.coerceAtLeast(0)

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(horizontal = 48.dp, vertical = 24.dp)
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            SettingsHeader(
                title = title,
                onBackClick = onBackClick
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = subtitle,
                style = NuvioTypography.bodyMedium,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f),
                modifier = Modifier.padding(bottom = 16.dp)
            )

            TvLazyColumn(
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                itemsIndexed(options) { index, (code, displayName) ->
                    SelectionItem(
                        label = displayName,
                        isSelected = code == selectedCode,
                        onClick = { onSelect(code) },
                        modifier = if (index == selectedIndex) {
                            Modifier.focusRequester(focusRequester)
                        } else {
                            Modifier
                        }
                    )
                }
            }
        }
    }

    LaunchedEffect(Unit) {
        focusRequester.requestFocus()
    }
}

/**
 * Individual selection item with checkmark.
 */
@Composable
private fun SelectionItem(
    label: String,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    var isFocused by remember { mutableStateOf(false) }

    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(NuvioShapes.medium)
            .background(
                when {
                    isFocused -> MaterialTheme.colorScheme.primary.copy(alpha = 0.15f)
                    isSelected -> MaterialTheme.colorScheme.primary.copy(alpha = 0.08f)
                    else -> MaterialTheme.colorScheme.surface
                }
            )
            .then(
                if (isFocused) {
                    Modifier.border(
                        width = 2.dp,
                        color = MaterialTheme.colorScheme.primary,
                        shape = NuvioShapes.medium
                    )
                } else {
                    Modifier
                }
            )
            .onFocusChanged { focusState ->
                isFocused = focusState.isFocused
            }
            .focusable()
            .onKeyEvent { event ->
                if (event.type == KeyEventType.KeyDown &&
                    (event.key == Key.DirectionCenter || event.key == Key.Enter)
                ) {
                    onClick()
                    true
                } else {
                    false
                }
            }
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = label,
            style = NuvioTypography.titleMedium,
            color = when {
                isFocused -> MaterialTheme.colorScheme.primary
                isSelected -> MaterialTheme.colorScheme.primary
                else -> MaterialTheme.colorScheme.onSurface
            },
            modifier = Modifier.weight(1f)
        )

        if (isSelected) {
            Icon(
                imageVector = Icons.Filled.Check,
                contentDescription = "Selected",
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(24.dp)
            )
        }
    }
}
