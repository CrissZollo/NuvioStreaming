package com.nuvio.tv.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.nuvio.tv.ui.theme.NuvioShapes

/**
 * Creates a shimmer brush effect for skeleton loading animations.
 */
@Composable
fun shimmerBrush(): Brush {
    val shimmerColors = listOf(
        MaterialTheme.colorScheme.surface.copy(alpha = 0.3f),
        MaterialTheme.colorScheme.surface.copy(alpha = 0.5f),
        MaterialTheme.colorScheme.surface.copy(alpha = 0.3f)
    )

    val transition = rememberInfiniteTransition(label = "shimmer")
    val translateAnimation by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1000f,
        animationSpec = infiniteRepeatable(
            animation = tween(
                durationMillis = 1200,
                easing = LinearEasing
            ),
            repeatMode = RepeatMode.Restart
        ),
        label = "shimmerTranslate"
    )

    return Brush.linearGradient(
        colors = shimmerColors,
        start = Offset(translateAnimation - 500f, 0f),
        end = Offset(translateAnimation, 0f)
    )
}

/**
 * Skeleton loader for a single content card.
 */
@Composable
fun SkeletonCard(
    modifier: Modifier = Modifier,
    aspectRatio: Float = 2f / 3f,
    width: Int = 160
) {
    val brush = shimmerBrush()

    Column(modifier = modifier.width(width.dp)) {
        // Card skeleton
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(aspectRatio)
                .clip(NuvioShapes.card)
                .background(brush)
        )

        // Title skeleton
        Spacer(modifier = Modifier.height(8.dp))
        Box(
            modifier = Modifier
                .fillMaxWidth(0.8f)
                .height(14.dp)
                .clip(NuvioShapes.small)
                .background(brush)
        )
        Spacer(modifier = Modifier.height(4.dp))
        Box(
            modifier = Modifier
                .fillMaxWidth(0.5f)
                .height(14.dp)
                .clip(NuvioShapes.small)
                .background(brush)
        )
    }
}

/**
 * Skeleton loader for the hero section.
 */
@Composable
fun SkeletonHero(
    modifier: Modifier = Modifier
) {
    val brush = shimmerBrush()

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(480.dp)
            .background(MaterialTheme.colorScheme.surface.copy(alpha = 0.1f))
    ) {
        // Left content area
        Column(
            modifier = Modifier
                .align(Alignment.CenterStart)
                .padding(start = 48.dp)
                .fillMaxWidth(0.45f)
        ) {
            // Type badge
            Box(
                modifier = Modifier
                    .width(80.dp)
                    .height(24.dp)
                    .clip(NuvioShapes.badge)
                    .background(brush)
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Title
            Box(
                modifier = Modifier
                    .fillMaxWidth(0.9f)
                    .height(40.dp)
                    .clip(NuvioShapes.small)
                    .background(brush)
            )
            Spacer(modifier = Modifier.height(8.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth(0.6f)
                    .height(40.dp)
                    .clip(NuvioShapes.small)
                    .background(brush)
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Metadata row
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(
                    modifier = Modifier
                        .width(60.dp)
                        .height(24.dp)
                        .clip(NuvioShapes.badge)
                        .background(brush)
                )
                Box(
                    modifier = Modifier
                        .width(60.dp)
                        .height(24.dp)
                        .clip(NuvioShapes.badge)
                        .background(brush)
                )
                Box(
                    modifier = Modifier
                        .width(80.dp)
                        .height(24.dp)
                        .clip(NuvioShapes.chip)
                        .background(brush)
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Description
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(20.dp)
                    .clip(NuvioShapes.small)
                    .background(brush)
            )
            Spacer(modifier = Modifier.height(6.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth(0.9f)
                    .height(20.dp)
                    .clip(NuvioShapes.small)
                    .background(brush)
            )
            Spacer(modifier = Modifier.height(6.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth(0.7f)
                    .height(20.dp)
                    .clip(NuvioShapes.small)
                    .background(brush)
            )

            Spacer(modifier = Modifier.height(28.dp))

            // Buttons
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                Box(
                    modifier = Modifier
                        .width(140.dp)
                        .height(52.dp)
                        .clip(NuvioShapes.full)
                        .background(brush)
                )
                Box(
                    modifier = Modifier
                        .width(120.dp)
                        .height(52.dp)
                        .clip(NuvioShapes.full)
                        .background(brush)
                )
            }
        }
    }
}

/**
 * Skeleton loader for a content row/carousel.
 */
@Composable
fun SkeletonContentRow(
    modifier: Modifier = Modifier,
    itemCount: Int = 6
) {
    val brush = shimmerBrush()

    Column(modifier = modifier.padding(horizontal = 48.dp)) {
        // Title skeleton
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .width(180.dp)
                    .height(28.dp)
                    .clip(NuvioShapes.small)
                    .background(brush)
            )
            Box(
                modifier = Modifier
                    .width(80.dp)
                    .height(20.dp)
                    .clip(NuvioShapes.small)
                    .background(brush)
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Cards row
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            contentPadding = PaddingValues(end = 48.dp)
        ) {
            items(itemCount) {
                SkeletonCard()
            }
        }
    }
}

/**
 * Full home screen skeleton loader.
 */
@Composable
fun SkeletonHomeScreen(
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(28.dp)
    ) {
        // Hero skeleton
        SkeletonHero()

        // Content rows
        repeat(3) {
            SkeletonContentRow()
        }
    }
}

/**
 * Skeleton loader for continue watching section.
 */
@Composable
fun SkeletonContinueWatchingCard(
    modifier: Modifier = Modifier
) {
    val brush = shimmerBrush()

    Column(modifier = modifier.width(220.dp)) {
        // Card with 16:9 aspect ratio
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(16f / 9f)
                .clip(NuvioShapes.card)
                .background(brush)
        ) {
            // Episode badge
            Box(
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .padding(8.dp)
                    .width(50.dp)
                    .height(20.dp)
                    .clip(NuvioShapes.badge)
                    .background(MaterialTheme.colorScheme.surface.copy(alpha = 0.5f))
            )

            // Progress bar
            Box(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .padding(8.dp)
                    .height(4.dp)
                    .clip(NuvioShapes.progressBar)
                    .background(MaterialTheme.colorScheme.surface.copy(alpha = 0.3f))
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Title
        Box(
            modifier = Modifier
                .fillMaxWidth(0.8f)
                .height(14.dp)
                .clip(NuvioShapes.small)
                .background(brush)
        )
    }
}
