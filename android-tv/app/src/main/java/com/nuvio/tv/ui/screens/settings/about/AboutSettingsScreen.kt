package com.nuvio.tv.ui.screens.settings.about

import androidx.compose.foundation.background
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
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.BugReport
import androidx.compose.material.icons.filled.Code
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Policy
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.tv.foundation.lazy.list.TvLazyColumn
import com.nuvio.tv.ui.screens.settings.SettingsViewModel
import com.nuvio.tv.ui.screens.settings.content.SettingsHeader
import com.nuvio.tv.ui.screens.settings.content.SettingsNavigationItem
import com.nuvio.tv.ui.screens.settings.content.SettingsSectionHeader
import com.nuvio.tv.ui.theme.NuvioShapes
import com.nuvio.tv.ui.theme.NuvioTypography

/**
 * About settings screen.
 * Matches the mobile app's AboutSettingsScreen.
 */
@Composable
fun AboutSettingsScreen(
    viewModel: SettingsViewModel = hiltViewModel(),
    onBackClick: () -> Unit = {},
    onPrivacyPolicyClick: () -> Unit = {},
    onReportIssueClick: () -> Unit = {},
    onContributorsClick: () -> Unit = {},
    onLicensesClick: () -> Unit = {}
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
                title = "About",
                onBackClick = onBackClick
            )

            Spacer(modifier = Modifier.height(24.dp))

            TvLazyColumn(
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // App Info Card
                item {
                    AppInfoCard(version = uiState.appVersion)
                }

                // Information Section
                item {
                    Spacer(modifier = Modifier.height(8.dp))
                    SettingsSectionHeader(title = "INFORMATION")
                }

                item {
                    SettingsNavigationItem(
                        title = "Privacy Policy",
                        description = "View our privacy policy",
                        icon = Icons.Filled.Policy,
                        onClick = onPrivacyPolicyClick
                    )
                }

                item {
                    SettingsNavigationItem(
                        title = "Report Issue",
                        description = "Report a bug or request a feature",
                        icon = Icons.Filled.BugReport,
                        onClick = onReportIssueClick
                    )
                }

                item {
                    AboutInfoItem(
                        title = "Version",
                        value = uiState.appVersion,
                        icon = Icons.Filled.Info
                    )
                }

                item {
                    SettingsNavigationItem(
                        title = "Contributors",
                        description = "View all contributors",
                        icon = Icons.Filled.People,
                        onClick = onContributorsClick
                    )
                }

                item {
                    SettingsNavigationItem(
                        title = "Open Source Licenses",
                        description = "Third-party libraries used",
                        icon = Icons.Filled.Code,
                        onClick = onLicensesClick
                    )
                }

                // Footer
                item {
                    Spacer(modifier = Modifier.height(24.dp))
                    AboutFooter()
                }
            }
        }
    }
}

@Composable
private fun AppInfoCard(version: String) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(NuvioShapes.medium)
            .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.1f))
            .padding(32.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // App icon placeholder
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .clip(NuvioShapes.medium)
                    .background(MaterialTheme.colorScheme.primary),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "N",
                    style = NuvioTypography.headlineLarge,
                    color = MaterialTheme.colorScheme.onPrimary
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "Nuvio",
                style = NuvioTypography.headlineMedium,
                color = MaterialTheme.colorScheme.onBackground
            )

            Spacer(modifier = Modifier.height(4.dp))

            Text(
                text = "Version $version",
                style = NuvioTypography.bodyMedium,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f)
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = "Your personal streaming hub",
                style = NuvioTypography.bodySmall,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f)
            )
        }
    }
}

@Composable
private fun AboutInfoItem(
    title: String,
    value: String,
    icon: ImageVector
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(NuvioShapes.medium)
            .background(MaterialTheme.colorScheme.surface)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.size(28.dp)
        )

        Spacer(modifier = Modifier.width(16.dp))

        Text(
            text = title,
            style = NuvioTypography.titleMedium,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.weight(1f)
        )

        Text(
            text = value,
            style = NuvioTypography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
        )
    }
}

@Composable
private fun AboutFooter() {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = "Made with passion for streaming",
            style = NuvioTypography.bodySmall,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f),
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "Nuvio is open source software",
            style = NuvioTypography.bodySmall,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.4f),
            textAlign = TextAlign.Center
        )
    }
}
