package com.nuvio.tv.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * Theme preset matching the NuvioStreaming React Native app's theme system.
 * Each preset defines primary, secondary, and background colors.
 */
data class ThemePreset(
    val id: String,
    val name: String,
    val primary: Color,
    val secondary: Color,
    val background: Color,
    val isEditable: Boolean = false
) {
    companion object {
        val DEFAULT = ThemePreset(
            id = "default",
            name = "Default Dark",
            primary = Color(0xFF2D9CDB),
            secondary = Color(0xFFFF6B6B),
            background = Color(0xFF020404)
        )
    }
}

/**
 * All 12 built-in themes from the React Native app.
 */
object ThemePresets {

    val Default = ThemePreset(
        id = "default",
        name = "Default Dark",
        primary = Color(0xFF2D9CDB),
        secondary = Color(0xFFFF6B6B),
        background = Color(0xFF020404)
    )

    val Ocean = ThemePreset(
        id = "ocean",
        name = "Ocean Blue",
        primary = Color(0xFF3498DB),
        secondary = Color(0xFF2ECC71),
        background = Color(0xFF0A192F)
    )

    val Sunset = ThemePreset(
        id = "sunset",
        name = "Sunset",
        primary = Color(0xFFFF7E5F),
        secondary = Color(0xFFFEB47B),
        background = Color(0xFF1A0F0B)
    )

    val Moonlight = ThemePreset(
        id = "moonlight",
        name = "Moonlight",
        primary = Color(0xFFC084FC),
        secondary = Color(0xFF60A5FA),
        background = Color(0xFF060609)
    )

    val Emerald = ThemePreset(
        id = "emerald",
        name = "Emerald",
        primary = Color(0xFF2ECC71),
        secondary = Color(0xFF3498DB),
        background = Color(0xFF0E1E13)
    )

    val Ruby = ThemePreset(
        id = "ruby",
        name = "Ruby",
        primary = Color(0xFFE74C3C),
        secondary = Color(0xFF9B59B6),
        background = Color(0xFF1A0A0A)
    )

    val Amethyst = ThemePreset(
        id = "amethyst",
        name = "Amethyst",
        primary = Color(0xFF9B59B6),
        secondary = Color(0xFF3498DB),
        background = Color(0xFF140A1C)
    )

    val Amber = ThemePreset(
        id = "amber",
        name = "Amber",
        primary = Color(0xFFF39C12),
        secondary = Color(0xFFD35400),
        background = Color(0xFF1A140A)
    )

    val Mint = ThemePreset(
        id = "mint",
        name = "Mint",
        primary = Color(0xFF1ABC9C),
        secondary = Color(0xFF16A085),
        background = Color(0xFF0A1A17)
    )

    val Slate = ThemePreset(
        id = "slate",
        name = "Slate",
        primary = Color(0xFF7F8C8D),
        secondary = Color(0xFF95A5A6),
        background = Color(0xFF10191A)
    )

    val Neon = ThemePreset(
        id = "neon",
        name = "Neon",
        primary = Color(0xFF00FF00),
        secondary = Color(0xFFFF00FF),
        background = Color(0xFF0A0A0A)
    )

    val RetroWave = ThemePreset(
        id = "retro",
        name = "Retro Wave",
        primary = Color(0xFFFF00FF),
        secondary = Color(0xFF00FFFF),
        background = Color(0xFF150036)
    )

    /**
     * All available built-in themes.
     */
    val allThemes: List<ThemePreset> = listOf(
        Default,
        Ocean,
        Sunset,
        Moonlight,
        Emerald,
        Ruby,
        Amethyst,
        Amber,
        Mint,
        Slate,
        Neon,
        RetroWave
    )

    /**
     * Get a theme by its ID.
     */
    fun getById(id: String): ThemePreset {
        return allThemes.find { it.id == id } ?: Default
    }
}
