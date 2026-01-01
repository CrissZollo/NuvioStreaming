package com.nuvio.tv.ui.components.carousels

import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.unit.dp
import androidx.tv.foundation.lazy.list.TvLazyRow
import androidx.tv.foundation.lazy.list.items
import androidx.tv.foundation.lazy.list.rememberTvLazyListState
import com.nuvio.tv.domain.model.StreamingContent
import com.nuvio.tv.ui.components.cards.ContentCard
import com.nuvio.tv.ui.theme.NuvioTypography

/**
 * Horizontal content carousel for displaying content rows.
 * Supports D-pad navigation with smooth scrolling.
 */
@Composable
fun ContentCarousel(
    title: String,
    items: List<StreamingContent>,
    onItemClick: (StreamingContent) -> Unit,
    modifier: Modifier = Modifier,
    onSeeAllClick: (() -> Unit)? = null
) {
    val listState = rememberTvLazyListState()

    Column(modifier = modifier.fillMaxWidth()) {
        // Header Row
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = title,
                style = NuvioTypography.headlineSmall,
                color = MaterialTheme.colorScheme.onBackground
            )

            if (onSeeAllClick != null) {
                TextButton(
                    onClick = onSeeAllClick,
                    modifier = Modifier.focusable()
                ) {
                    Text(
                        text = "See All",
                        style = NuvioTypography.labelMedium,
                        color = MaterialTheme.colorScheme.primary
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary
                    )
                }
            }
        }

        // Content Row
        TvLazyRow(
            state = listState,
            contentPadding = PaddingValues(end = 48.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            items(
                items = items,
                key = { it.id }
            ) { content ->
                ContentCard(
                    content = content,
                    onClick = { onItemClick(content) }
                )
            }
        }
    }
}

/**
 * Content carousel with custom card content.
 */
@Composable
fun <T> GenericCarousel(
    title: String,
    items: List<T>,
    onItemClick: (T) -> Unit,
    modifier: Modifier = Modifier,
    itemKey: (T) -> Any,
    onSeeAllClick: (() -> Unit)? = null,
    itemContent: @Composable (T) -> Unit
) {
    val listState = rememberTvLazyListState()

    Column(modifier = modifier.fillMaxWidth()) {
        // Header Row
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = title,
                style = NuvioTypography.headlineSmall,
                color = MaterialTheme.colorScheme.onBackground
            )

            if (onSeeAllClick != null) {
                TextButton(
                    onClick = onSeeAllClick,
                    modifier = Modifier.focusable()
                ) {
                    Text(
                        text = "See All",
                        style = NuvioTypography.labelMedium,
                        color = MaterialTheme.colorScheme.primary
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary
                    )
                }
            }
        }

        // Content Row
        TvLazyRow(
            state = listState,
            contentPadding = PaddingValues(end = 48.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            items(
                items = items,
                key = itemKey
            ) { item ->
                itemContent(item)
            }
        }
    }
}
