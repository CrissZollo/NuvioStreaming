package com.nuvio.tv.ui.navigation

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandHorizontally
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkHorizontally
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.tv.material3.ExperimentalTvMaterial3Api
import coil.compose.AsyncImage
import com.nuvio.tv.R
import com.nuvio.tv.ui.theme.NuvioTypography

private val COLLAPSED_WIDTH = 56.dp
private val EXPANDED_WIDTH = 180.dp
private val ANIMATION_DURATION = 250

/**
 * Navigation rail for the Nuvio TV app.
 * Displays on the left side of the screen with main navigation items.
 * Collapses to icons only when not focused, expands with labels when focused.
 */
@Composable
fun NuvioNavigationRail(
    selectedDestination: MainNavDestination,
    onDestinationSelected: (MainNavDestination) -> Unit,
    modifier: Modifier = Modifier
) {
    // Track if any item in the navigation rail has focus
    var isRailFocused by remember { mutableStateOf(false) }

    // Animate width between collapsed and expanded states
    val railWidth by animateDpAsState(
        targetValue = if (isRailFocused) EXPANDED_WIDTH else COLLAPSED_WIDTH,
        animationSpec = tween(durationMillis = ANIMATION_DURATION),
        label = "railWidth"
    )

    // Gradient background that fades from solid to transparent
    // Extended gradient for better text readability when expanded
    val surfaceColor = MaterialTheme.colorScheme.surface
    val gradientBrush = Brush.horizontalGradient(
        colorStops = arrayOf(
            0.0f to surfaceColor,
            0.4f to surfaceColor.copy(alpha = 0.98f),
            0.6f to surfaceColor.copy(alpha = 0.90f),
            0.75f to surfaceColor.copy(alpha = 0.70f),
            0.85f to surfaceColor.copy(alpha = 0.40f),
            0.95f to surfaceColor.copy(alpha = 0.15f),
            1.0f to Color.Transparent
        )
    )

    Box(
        modifier = modifier
            .width(railWidth)
            .fillMaxHeight()
            .background(brush = gradientBrush)
    ) {
        Column(
            modifier = Modifier
                .fillMaxHeight()
                .padding(vertical = 24.dp, horizontal = 4.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Top
        ) {
            // App Logo
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .padding(bottom = 8.dp),
                contentAlignment = Alignment.Center
            ) {
                Image(
                    painter = painterResource(id = R.drawable.nuvio_logo),
                    contentDescription = "Nuvio",
                    modifier = Modifier.size(40.dp)
                )
            }

            Spacer(modifier = Modifier.height(32.dp))

            // Navigation Items
            MainNavDestination.entries.forEach { destination ->
                NavigationRailItem(
                    destination = destination,
                    isSelected = selectedDestination == destination,
                    isExpanded = isRailFocused,
                    onClick = { onDestinationSelected(destination) },
                    onFocusChanged = { focused ->
                        if (focused) isRailFocused = true
                    },
                    onFocusLost = {
                        // Check if focus moved outside the rail
                        isRailFocused = false
                    },
                    modifier = Modifier.padding(vertical = 4.dp)
                )
            }

            Spacer(modifier = Modifier.weight(1f))
        }
    }
}

/**
 * Individual navigation rail item with focus handling for D-pad navigation.
 * Supports expanded (with label) and collapsed (icon only) states.
 */
@Composable
private fun NavigationRailItem(
    destination: MainNavDestination,
    isSelected: Boolean,
    isExpanded: Boolean,
    onClick: () -> Unit,
    onFocusChanged: (Boolean) -> Unit,
    onFocusLost: () -> Unit,
    modifier: Modifier = Modifier
) {
    var isFocused by remember { mutableStateOf(false) }

    val scale by animateFloatAsState(
        targetValue = if (isFocused) 1.05f else 1f,
        animationSpec = tween(durationMillis = 150),
        label = "scale"
    )

    val backgroundColor by animateColorAsState(
        targetValue = when {
            isFocused -> MaterialTheme.colorScheme.primary.copy(alpha = 0.25f)
            isSelected -> MaterialTheme.colorScheme.primary.copy(alpha = 0.12f)
            else -> Color.Transparent
        },
        animationSpec = tween(durationMillis = 150),
        label = "backgroundColor"
    )

    val borderWidth by animateDpAsState(
        targetValue = if (isFocused) 2.dp else 0.dp,
        animationSpec = tween(durationMillis = 150),
        label = "borderWidth"
    )

    val iconColor by animateColorAsState(
        targetValue = when {
            isFocused || isSelected -> MaterialTheme.colorScheme.primary
            else -> MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
        },
        animationSpec = tween(durationMillis = 150),
        label = "iconColor"
    )

    val textColor by animateColorAsState(
        targetValue = when {
            isFocused || isSelected -> MaterialTheme.colorScheme.primary
            else -> MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
        },
        animationSpec = tween(durationMillis = 150),
        label = "textColor"
    )

    // Animate item width based on expanded state
    val itemWidth by animateDpAsState(
        targetValue = if (isExpanded) 128.dp else 48.dp,
        animationSpec = tween(durationMillis = ANIMATION_DURATION),
        label = "itemWidth"
    )

    Row(
        modifier = modifier
            .width(itemWidth)
            .clip(RoundedCornerShape(12.dp))
            .background(backgroundColor)
            .border(
                width = borderWidth,
                color = if (isFocused) MaterialTheme.colorScheme.primary else Color.Transparent,
                shape = RoundedCornerShape(12.dp)
            )
            .scale(scale)
            .onFocusChanged { focusState ->
                val wasFocused = isFocused
                isFocused = focusState.isFocused
                onFocusChanged(focusState.isFocused)
                if (wasFocused && !focusState.isFocused) {
                    onFocusLost()
                }
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
            .padding(vertical = 12.dp, horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = if (isExpanded) Arrangement.Start else Arrangement.Center
    ) {
        Icon(
            imageVector = if (isSelected) destination.selectedIcon else destination.unselectedIcon,
            contentDescription = destination.label,
            tint = iconColor,
            modifier = Modifier.size(24.dp)
        )

        // Animated label visibility
        AnimatedVisibility(
            visible = isExpanded,
            enter = fadeIn(animationSpec = tween(ANIMATION_DURATION)) +
                    expandHorizontally(animationSpec = tween(ANIMATION_DURATION)),
            exit = fadeOut(animationSpec = tween(ANIMATION_DURATION / 2)) +
                    shrinkHorizontally(animationSpec = tween(ANIMATION_DURATION / 2))
        ) {
            Row {
                Spacer(modifier = Modifier.width(12.dp))
                Text(
                    text = destination.label,
                    style = NuvioTypography.navLabel,
                    color = textColor,
                    maxLines = 1
                )
            }
        }
    }
}
