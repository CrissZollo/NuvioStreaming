package com.nuvio.tv.ui.components.dialogs

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Movie
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.tv.foundation.lazy.list.TvLazyRow
import androidx.tv.foundation.lazy.list.items
import androidx.tv.material3.Border
import androidx.tv.material3.Card
import androidx.tv.material3.CardDefaults
import androidx.tv.material3.ExperimentalTvMaterial3Api
import coil.compose.AsyncImage
import com.nuvio.tv.domain.model.CastMember
import com.nuvio.tv.domain.model.PersonCredit
import com.nuvio.tv.domain.model.PersonDetails
import com.nuvio.tv.ui.theme.NuvioShapes
import com.nuvio.tv.ui.theme.NuvioTypography

/**
 * Dialog showing cast member details with biography and filmography.
 */
@Composable
fun CastDetailsDialog(
    castMember: CastMember,
    personDetails: PersonDetails?,
    isLoading: Boolean,
    onDismiss: () -> Unit,
    onFilmographyClick: (PersonDetails) -> Unit = {}
) {
    val focusRequester = remember { FocusRequester() }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(
            dismissOnBackPress = true,
            dismissOnClickOutside = true,
            usePlatformDefaultWidth = false
        )
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.85f))
                .onKeyEvent { event ->
                    if (event.type == KeyEventType.KeyDown && event.key == Key.Escape) {
                        onDismiss()
                        true
                    } else {
                        false
                    }
                }
                .focusable()
                .focusRequester(focusRequester),
            contentAlignment = Alignment.Center
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(0.7f)
                    .fillMaxHeight(0.8f)
                    .clip(RoundedCornerShape(16.dp))
                    .background(MaterialTheme.colorScheme.surface)
            ) {
                // Close button
                IconButton(
                    onClick = onDismiss,
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(8.dp),
                    colors = IconButtonDefaults.iconButtonColors(
                        containerColor = Color.Transparent,
                        contentColor = MaterialTheme.colorScheme.onSurface
                    )
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Close"
                    )
                }

                if (isLoading) {
                    // Loading state
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            CircularProgressIndicator(
                                color = MaterialTheme.colorScheme.primary
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                text = "Loading...",
                                style = NuvioTypography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                            )
                        }
                    }
                } else {
                    CastDetailsContent(
                        castMember = castMember,
                        personDetails = personDetails,
                        onFilmographyClick = { personDetails?.let { onFilmographyClick(it) } }
                    )
                }
            }
        }

        LaunchedEffect(Unit) {
            focusRequester.requestFocus()
        }
    }
}

@Composable
private fun CastDetailsContent(
    castMember: CastMember,
    personDetails: PersonDetails?,
    onFilmographyClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp)
    ) {
        // Header with profile image and name
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.Top
        ) {
            // Profile image
            AsyncImage(
                model = personDetails?.profileUrl ?: castMember.profileUrl,
                contentDescription = castMember.name,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .size(160.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant)
            )

            Spacer(modifier = Modifier.width(24.dp))

            // Name and details
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = personDetails?.name ?: castMember.name,
                    style = NuvioTypography.headlineMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                    fontWeight = FontWeight.Bold
                )

                castMember.character?.let { character ->
                    Text(
                        text = "as $character",
                        style = NuvioTypography.titleMedium,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.padding(top = 4.dp)
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Personal info
                personDetails?.let { details ->
                    PersonInfoRow(
                        label = "Known for",
                        value = details.knownForDepartment ?: "Acting"
                    )

                    details.formattedBirthday?.let { birthday ->
                        val ageText = details.age?.let { " ($it years old)" } ?: ""
                        PersonInfoRow(
                            label = "Born",
                            value = "$birthday$ageText"
                        )
                    }

                    details.deathday?.let { deathday ->
                        PersonInfoRow(label = "Died", value = deathday)
                    }

                    details.placeOfBirth?.let { place ->
                        PersonInfoRow(label = "Birthplace", value = place)
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // View Filmography button
                if (personDetails != null && personDetails.filmography.isNotEmpty()) {
                    var isButtonFocused by remember { mutableStateOf(false) }

                    Button(
                        onClick = onFilmographyClick,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (isButtonFocused) Color.White else MaterialTheme.colorScheme.primary,
                            contentColor = if (isButtonFocused) Color.Black else Color.White
                        ),
                        modifier = Modifier
                            .onFocusChanged { isButtonFocused = it.isFocused }
                            .then(
                                if (isButtonFocused) {
                                    Modifier.border(
                                        width = 3.dp,
                                        color = Color.White,
                                        shape = ButtonDefaults.shape
                                    )
                                } else {
                                    Modifier
                                }
                            )
                    ) {
                        Icon(
                            imageVector = Icons.Default.Movie,
                            contentDescription = null,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "View Filmography (${personDetails.filmography.size})",
                            style = NuvioTypography.labelLarge,
                            fontWeight = if (isButtonFocused) FontWeight.Bold else FontWeight.Medium
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Biography
        personDetails?.biography?.takeIf { it.isNotBlank() }?.let { biography ->
            Text(
                text = "Biography",
                style = NuvioTypography.titleMedium,
                color = MaterialTheme.colorScheme.onSurface,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = biography,
                style = NuvioTypography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f),
                maxLines = 6,
                overflow = TextOverflow.Ellipsis
            )
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Popular works preview
        if (personDetails != null && personDetails.filmography.isNotEmpty()) {
            Text(
                text = "Known For",
                style = NuvioTypography.titleMedium,
                color = MaterialTheme.colorScheme.onSurface,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(12.dp))

            val filmographyItems = personDetails.filmography.take(8)
            TvLazyRow(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                contentPadding = PaddingValues(end = 24.dp)
            ) {
                items(
                    items = filmographyItems,
                    key = { credit ->
                        // Use index + id + mediaType to ensure uniqueness even with duplicates
                        val index = filmographyItems.indexOf(credit)
                        "${index}_${credit.id}_${credit.mediaType}"
                    }
                ) { credit ->
                    FilmographyCard(credit = credit)
                }
            }
        }
    }
}

@Composable
private fun PersonInfoRow(label: String, value: String) {
    Row(
        modifier = Modifier.padding(vertical = 2.dp)
    ) {
        Text(
            text = "$label: ",
            style = NuvioTypography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
        )
        Text(
            text = value,
            style = NuvioTypography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface
        )
    }
}

@OptIn(ExperimentalTvMaterial3Api::class)
@Composable
private fun FilmographyCard(credit: PersonCredit) {
    var isFocused by remember { mutableStateOf(false) }

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.width(100.dp)
    ) {
        Card(
            onClick = { /* Click handled by parent if needed */ },
            modifier = Modifier
                .size(100.dp, 150.dp)
                .onFocusChanged { focusState ->
                    isFocused = focusState.isFocused
                },
            border = CardDefaults.border(
                focusedBorder = Border(
                    border = BorderStroke(3.dp, Color.White),
                    shape = NuvioShapes.card
                )
            ),
            shape = CardDefaults.shape(shape = NuvioShapes.card),
            colors = CardDefaults.colors(
                containerColor = MaterialTheme.colorScheme.surfaceVariant
            )
        ) {
            AsyncImage(
                model = credit.posterUrl,
                contentDescription = credit.title,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize()
            )
        }

        Spacer(modifier = Modifier.height(4.dp))

        Text(
            text = credit.title,
            style = NuvioTypography.labelSmall,
            color = if (isFocused) Color.White else MaterialTheme.colorScheme.onSurface,
            fontWeight = if (isFocused) FontWeight.Bold else FontWeight.Normal,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )

        credit.year?.let { year ->
            Text(
                text = year.toString(),
                style = NuvioTypography.labelSmall,
                color = if (isFocused) Color.White.copy(alpha = 0.8f) else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
            )
        }
    }
}
