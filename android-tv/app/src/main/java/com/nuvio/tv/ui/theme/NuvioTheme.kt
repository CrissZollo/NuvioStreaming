package com.nuvio.tv.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

/**
 * Provides the current theme preset for components that need direct access.
 */
val LocalThemePreset = staticCompositionLocalOf { ThemePreset.DEFAULT }

/**
 * Create a color scheme from a theme preset.
 */
private fun createColorScheme(preset: ThemePreset) = darkColorScheme(
    primary = preset.primary,
    onPrimary = TextPrimary,
    primaryContainer = preset.primary.copy(alpha = 0.2f),
    onPrimaryContainer = preset.primary,

    secondary = preset.secondary,
    onSecondary = TextPrimary,
    secondaryContainer = preset.secondary.copy(alpha = 0.2f),
    onSecondaryContainer = preset.secondary,

    tertiary = Info,
    onTertiary = TextPrimary,

    background = preset.background,
    onBackground = TextPrimary,

    surface = calculateSurfaceColor(preset.background),
    onSurface = TextPrimary,
    surfaceVariant = calculateSurfaceVariant(preset.background),
    onSurfaceVariant = TextSecondary,

    error = Error,
    onError = TextPrimary,
    errorContainer = Error.copy(alpha = 0.2f),
    onErrorContainer = Error,

    outline = Border,
    outlineVariant = Border.copy(alpha = 0.5f),

    scrim = Color.Black.copy(alpha = 0.7f),
    inverseSurface = TextPrimary,
    inverseOnSurface = preset.background,
    inversePrimary = preset.primary.copy(alpha = 0.8f)
)

/**
 * Calculate a surface color slightly lighter than the background.
 */
private fun calculateSurfaceColor(background: Color): Color {
    return background.copy(
        red = (background.red + 0.03f).coerceAtMost(1f),
        green = (background.green + 0.03f).coerceAtMost(1f),
        blue = (background.blue + 0.03f).coerceAtMost(1f)
    )
}

/**
 * Calculate a surface variant color for elevated surfaces.
 */
private fun calculateSurfaceVariant(background: Color): Color {
    return background.copy(
        red = (background.red + 0.06f).coerceAtMost(1f),
        green = (background.green + 0.06f).coerceAtMost(1f),
        blue = (background.blue + 0.06f).coerceAtMost(1f)
    )
}

/**
 * Material 3 Typography converted from NuvioTypography.
 */
private val MaterialTypography = Typography(
    displayLarge = NuvioTypography.displayLarge,
    displayMedium = NuvioTypography.displayMedium,
    displaySmall = NuvioTypography.displaySmall,
    headlineLarge = NuvioTypography.headlineLarge,
    headlineMedium = NuvioTypography.headlineMedium,
    headlineSmall = NuvioTypography.headlineSmall,
    titleLarge = NuvioTypography.titleLarge,
    titleMedium = NuvioTypography.titleMedium,
    titleSmall = NuvioTypography.titleSmall,
    bodyLarge = NuvioTypography.bodyLarge,
    bodyMedium = NuvioTypography.bodyMedium,
    bodySmall = NuvioTypography.bodySmall,
    labelLarge = NuvioTypography.labelLarge,
    labelMedium = NuvioTypography.labelMedium,
    labelSmall = NuvioTypography.labelSmall
)

/**
 * Material 3 Shapes.
 */
private val MaterialShapes = Shapes(
    extraSmall = NuvioShapes.small,
    small = NuvioShapes.small,
    medium = NuvioShapes.medium,
    large = NuvioShapes.large,
    extraLarge = NuvioShapes.extraLarge
)

/**
 * Main theme composable for the Nuvio TV app.
 *
 * @param themePreset The theme preset to apply.
 * @param content The content to display with the theme applied.
 */
@Composable
fun NuvioTvTheme(
    themePreset: ThemePreset = ThemePreset.DEFAULT,
    content: @Composable () -> Unit
) {
    val colorScheme = createColorScheme(themePreset)

    CompositionLocalProvider(
        LocalThemePreset provides themePreset
    ) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = MaterialTypography,
            shapes = MaterialShapes,
            content = content
        )
    }
}

/**
 * Extension to get the current theme preset from anywhere in the composition.
 */
object NuvioTheme {
    val preset: ThemePreset
        @Composable
        get() = LocalThemePreset.current
}
