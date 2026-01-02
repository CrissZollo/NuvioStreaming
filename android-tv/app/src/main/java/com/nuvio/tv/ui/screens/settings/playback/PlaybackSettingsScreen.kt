package com.nuvio.tv.ui.screens.settings.playback

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ClosedCaption
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.SlowMotionVideo
import androidx.compose.material.icons.filled.Subtitles
import androidx.compose.material.icons.filled.VideoSettings
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.tv.foundation.lazy.list.TvLazyColumn
import com.nuvio.tv.ui.screens.settings.SettingsViewModel
import com.nuvio.tv.ui.screens.settings.appearance.SettingsToggleItem
import com.nuvio.tv.ui.screens.settings.content.SettingsHeader
import com.nuvio.tv.ui.screens.settings.content.SettingsNavigationItem
import com.nuvio.tv.ui.screens.settings.content.SettingsSectionHeader

/**
 * Playback settings screen.
 * Matches the mobile app's PlaybackSettingsScreen.
 */
@Composable
fun PlaybackSettingsScreen(
    viewModel: SettingsViewModel = hiltViewModel(),
    onBackClick: () -> Unit = {},
    onNavigateToPlayer: () -> Unit = {},
    onNavigateToAudioLanguage: () -> Unit = {},
    onNavigateToSubtitleLanguage: () -> Unit = {},
    onNavigateToSubtitleSource: () -> Unit = {},
    onNavigateToNotifications: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsState()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(horizontal = 48.dp, vertical = 24.dp)
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            SettingsHeader(
                title = "Playback",
                onBackClick = onBackClick
            )

            Spacer(modifier = Modifier.height(24.dp))

            TvLazyColumn(
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Video Player Section
                item {
                    SettingsSectionHeader(title = "VIDEO PLAYER")
                }

                item {
                    SettingsNavigationItem(
                        title = "Video Player",
                        description = uiState.selectedPlayer,
                        icon = Icons.Filled.VideoSettings,
                        onClick = onNavigateToPlayer
                    )
                }

                // Audio & Subtitles Section
                item {
                    Spacer(modifier = Modifier.height(8.dp))
                    SettingsSectionHeader(title = "AUDIO & SUBTITLES")
                }

                item {
                    SettingsNavigationItem(
                        title = "Preferred Audio Language",
                        description = uiState.preferredAudioLanguage,
                        icon = Icons.Filled.Language,
                        onClick = onNavigateToAudioLanguage
                    )
                }

                item {
                    SettingsNavigationItem(
                        title = "Preferred Subtitle Language",
                        description = uiState.preferredSubtitleLanguage,
                        icon = Icons.Filled.Subtitles,
                        onClick = onNavigateToSubtitleLanguage
                    )
                }

                item {
                    SettingsNavigationItem(
                        title = "Subtitle Source Priority",
                        description = uiState.subtitleSourcePriority,
                        icon = Icons.Filled.ClosedCaption,
                        onClick = onNavigateToSubtitleSource
                    )
                }

                item {
                    SettingsToggleItem(
                        title = "Auto-Select Subtitles",
                        description = "Automatically select subtitles",
                        icon = Icons.Filled.ClosedCaption,
                        checked = uiState.autoSelectSubtitles,
                        onCheckedChange = { viewModel.setAutoSelectSubtitles(it) }
                    )
                }

                // Media Section
                item {
                    Spacer(modifier = Modifier.height(8.dp))
                    SettingsSectionHeader(title = "MEDIA")
                }

                item {
                    SettingsToggleItem(
                        title = "Show Trailers",
                        description = "Display trailers in hero section",
                        icon = Icons.Filled.SlowMotionVideo,
                        checked = uiState.showTrailers,
                        onCheckedChange = { viewModel.setShowTrailers(it) }
                    )
                }

                item {
                    SettingsToggleItem(
                        title = "Enable Downloads",
                        description = "Show Downloads tab and enable saving streams",
                        icon = Icons.Filled.Download,
                        checked = uiState.downloadsEnabled,
                        onCheckedChange = { viewModel.setDownloadsEnabled(it) }
                    )
                }

                // Notifications Section
                item {
                    Spacer(modifier = Modifier.height(8.dp))
                    SettingsSectionHeader(title = "NOTIFICATIONS")
                }

                item {
                    SettingsNavigationItem(
                        title = "Notifications",
                        description = "Episode reminders",
                        icon = Icons.Filled.Notifications,
                        onClick = onNavigateToNotifications
                    )
                }
            }
        }
    }
}
