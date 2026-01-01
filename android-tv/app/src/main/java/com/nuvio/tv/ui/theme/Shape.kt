package com.nuvio.tv.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.unit.dp

/**
 * Shape definitions for the Nuvio TV app.
 * Matches the border radius values from the React Native app.
 */
object NuvioShapes {

    // Small radius - for buttons, badges, chips
    val small = RoundedCornerShape(4.dp)

    // Medium radius - for cards, dialogs
    val medium = RoundedCornerShape(8.dp)

    // Large radius - for larger cards, panels
    val large = RoundedCornerShape(12.dp)

    // Extra large radius - for modals, sheets
    val extraLarge = RoundedCornerShape(16.dp)

    // Full rounded - for pills, circular buttons
    val full = RoundedCornerShape(50)

    // Card shapes
    val card = RoundedCornerShape(8.dp)
    val posterCard = RoundedCornerShape(8.dp)
    val episodeCard = RoundedCornerShape(6.dp)

    // Navigation
    val navItem = RoundedCornerShape(8.dp)
    val focusIndicator = RoundedCornerShape(8.dp)

    // Player
    val progressBar = RoundedCornerShape(4.dp)
    val playerButton = RoundedCornerShape(50)
    val controlsOverlay = RoundedCornerShape(topStart = 0.dp, topEnd = 0.dp, bottomStart = 0.dp, bottomEnd = 0.dp)

    // Dialog
    val dialog = RoundedCornerShape(12.dp)
    val bottomSheet = RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp, bottomStart = 0.dp, bottomEnd = 0.dp)

    // Badge
    val badge = RoundedCornerShape(4.dp)
    val chip = RoundedCornerShape(16.dp)
}
