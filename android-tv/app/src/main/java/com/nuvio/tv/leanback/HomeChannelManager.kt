package com.nuvio.tv.leanback

import android.content.ContentResolver
import android.content.ContentUris
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Log
import androidx.tvprovider.media.tv.Channel
import androidx.tvprovider.media.tv.ChannelLogoUtils
import androidx.tvprovider.media.tv.PreviewProgram
import androidx.tvprovider.media.tv.TvContractCompat
import com.nuvio.tv.R
import com.nuvio.tv.domain.model.StreamingContent
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.InputStream
import java.net.URL
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Manages home screen channels for Android TV.
 * Creates and updates channels that appear on the Android TV home screen.
 */
@Singleton
class HomeChannelManager @Inject constructor(
    @ApplicationContext private val context: Context
) {

    companion object {
        private const val TAG = "HomeChannelManager"
        private const val CONTINUE_WATCHING_CHANNEL_ID = "continue_watching_channel"
        private const val RECOMMENDATIONS_CHANNEL_ID = "recommendations_channel"

        const val CHANNEL_TYPE_CONTINUE_WATCHING = "continue_watching"
        const val CHANNEL_TYPE_RECOMMENDATIONS = "recommendations"
    }

    /**
     * Create or update the Continue Watching channel.
     */
    suspend fun updateContinueWatchingChannel(items: List<StreamingContent>): Long {
        return withContext(Dispatchers.IO) {
            try {
                val channelId = getOrCreateChannel(
                    internalId = CONTINUE_WATCHING_CHANNEL_ID,
                    displayName = "Continue Watching",
                    description = "Resume where you left off"
                )

                if (channelId > 0) {
                    // Clear existing programs
                    deleteChannelPrograms(channelId)

                    // Add new programs
                    items.forEachIndexed { index, content ->
                        addProgramToChannel(channelId, content, index)
                    }
                }

                channelId
            } catch (e: Exception) {
                Log.e(TAG, "Error updating Continue Watching channel", e)
                -1L
            }
        }
    }

    /**
     * Create or update the Recommendations channel.
     */
    suspend fun updateRecommendationsChannel(items: List<StreamingContent>): Long {
        return withContext(Dispatchers.IO) {
            try {
                val channelId = getOrCreateChannel(
                    internalId = RECOMMENDATIONS_CHANNEL_ID,
                    displayName = "Recommended for You",
                    description = "Content you might enjoy"
                )

                if (channelId > 0) {
                    // Clear existing programs
                    deleteChannelPrograms(channelId)

                    // Add new programs
                    items.forEachIndexed { index, content ->
                        addProgramToChannel(channelId, content, index)
                    }
                }

                channelId
            } catch (e: Exception) {
                Log.e(TAG, "Error updating Recommendations channel", e)
                -1L
            }
        }
    }

    /**
     * Get existing channel or create a new one.
     */
    private fun getOrCreateChannel(
        internalId: String,
        displayName: String,
        description: String
    ): Long {
        val existingChannelId = findChannelByInternalId(internalId)

        if (existingChannelId > 0) {
            return existingChannelId
        }

        // Create new channel
        val channel = Channel.Builder()
            .setType(TvContractCompat.Channels.TYPE_PREVIEW)
            .setDisplayName(displayName)
            .setDescription(description)
            .setAppLinkIntentUri(Uri.parse("nuviotv://home"))
            .setInternalProviderId(internalId)
            .build()

        val channelUri = context.contentResolver.insert(
            TvContractCompat.Channels.CONTENT_URI,
            channel.toContentValues()
        )

        val channelId = channelUri?.let { ContentUris.parseId(it) } ?: -1L

        if (channelId > 0) {
            // Set channel logo
            try {
                val logo = BitmapFactory.decodeResource(context.resources, R.drawable.title_logo)
                if (logo != null) {
                    ChannelLogoUtils.storeChannelLogo(context, channelId, logo)
                }
            } catch (e: Exception) {
                Log.w(TAG, "Failed to set channel logo", e)
            }

            // Request channel to be made visible
            TvContractCompat.requestChannelBrowsable(context, channelId)
        }

        return channelId
    }

    /**
     * Find an existing channel by internal ID.
     */
    private fun findChannelByInternalId(internalId: String): Long {
        val cursor = context.contentResolver.query(
            TvContractCompat.Channels.CONTENT_URI,
            arrayOf(
                TvContractCompat.Channels._ID,
                TvContractCompat.Channels.COLUMN_INTERNAL_PROVIDER_ID
            ),
            "${TvContractCompat.Channels.COLUMN_INTERNAL_PROVIDER_ID} = ?",
            arrayOf(internalId),
            null
        )

        cursor?.use {
            if (it.moveToFirst()) {
                val idIndex = it.getColumnIndex(TvContractCompat.Channels._ID)
                if (idIndex >= 0) {
                    return it.getLong(idIndex)
                }
            }
        }

        return -1L
    }

    /**
     * Delete all programs from a channel.
     */
    private fun deleteChannelPrograms(channelId: Long) {
        context.contentResolver.delete(
            TvContractCompat.PreviewPrograms.CONTENT_URI,
            "${TvContractCompat.PreviewPrograms.COLUMN_CHANNEL_ID} = ?",
            arrayOf(channelId.toString())
        )
    }

    /**
     * Add a program to a channel.
     */
    private fun addProgramToChannel(
        channelId: Long,
        content: StreamingContent,
        weight: Int
    ) {
        val intentUri = Uri.parse("nuviotv://content/${content.type}/${content.id}")

        val programBuilder = PreviewProgram.Builder()
            .setChannelId(channelId)
            .setType(
                when (content.type) {
                    "movie" -> TvContractCompat.PreviewPrograms.TYPE_MOVIE
                    "series" -> TvContractCompat.PreviewPrograms.TYPE_TV_SERIES
                    else -> TvContractCompat.PreviewPrograms.TYPE_CLIP
                }
            )
            .setTitle(content.name)
            .setDescription(content.description ?: "")
            .setIntentUri(intentUri)
            .setInternalProviderId(content.id)
            .setWeight(1000 - weight) // Higher weight = higher priority

        // Set poster
        content.poster?.let { posterUrl ->
            programBuilder.setPosterArtUri(Uri.parse(posterUrl))
            programBuilder.setPosterArtAspectRatio(TvContractCompat.PreviewPrograms.ASPECT_RATIO_2_3)
        }

        // Set year
        content.year?.let { year ->
            programBuilder.setReleaseDate(year.toString())
        }

        // Set rating
        content.imdbRating?.let { rating ->
            try {
                val ratingFloat = rating.toFloatOrNull()
                if (ratingFloat != null) {
                    programBuilder.setReviewRating(ratingFloat.toString())
                    programBuilder.setReviewRatingStyle(TvContractCompat.PreviewPrograms.REVIEW_RATING_STYLE_STARS)
                }
            } catch (e: Exception) {
                // Ignore rating parsing errors
            }
        }

        // Set genres
        if (content.genres.isNotEmpty()) {
            programBuilder.setGenre(content.genres.joinToString(", "))
        }

        val program = programBuilder.build()

        context.contentResolver.insert(
            TvContractCompat.PreviewPrograms.CONTENT_URI,
            program.toContentValues()
        )
    }

    /**
     * Delete a channel.
     */
    fun deleteChannel(channelId: Long) {
        context.contentResolver.delete(
            TvContractCompat.buildChannelUri(channelId),
            null,
            null
        )
    }

    /**
     * Delete all app channels.
     */
    fun deleteAllChannels() {
        listOf(CONTINUE_WATCHING_CHANNEL_ID, RECOMMENDATIONS_CHANNEL_ID).forEach { internalId ->
            val channelId = findChannelByInternalId(internalId)
            if (channelId > 0) {
                deleteChannel(channelId)
            }
        }
    }
}
