package com.nuvio.tv.leanback

import android.content.ContentUris
import android.content.Context
import android.net.Uri
import android.util.Log
import androidx.tvprovider.media.tv.TvContractCompat
import androidx.tvprovider.media.tv.WatchNextProgram
import com.nuvio.tv.domain.model.Episode
import com.nuvio.tv.domain.model.StreamingContent
import com.nuvio.tv.domain.model.WatchProgress
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Manages the Watch Next row on the Android TV home screen.
 * Adds, updates, and removes items from the system "Watch Next" row.
 */
@Singleton
class WatchNextManager @Inject constructor(
    @ApplicationContext private val context: Context
) {

    companion object {
        private const val TAG = "WatchNextManager"
    }

    /**
     * Add or update a movie in Watch Next.
     */
    suspend fun addOrUpdateMovie(
        content: StreamingContent,
        progress: WatchProgress
    ): Long {
        return withContext(Dispatchers.IO) {
            try {
                val existingId = findWatchNextProgram(content.id)

                val watchType = if (progress.progress > 0.9f) {
                    TvContractCompat.WatchNextPrograms.WATCH_NEXT_TYPE_WATCHLIST
                } else if (progress.progress > 0f) {
                    TvContractCompat.WatchNextPrograms.WATCH_NEXT_TYPE_CONTINUE
                } else {
                    TvContractCompat.WatchNextPrograms.WATCH_NEXT_TYPE_NEW
                }

                val intentUri = Uri.parse("nuviotv://play/movie/${content.id}")

                val programBuilder = WatchNextProgram.Builder()
                    .setType(TvContractCompat.WatchNextPrograms.TYPE_MOVIE)
                    .setWatchNextType(watchType)
                    .setTitle(content.name)
                    .setDescription(content.description ?: "")
                    .setIntentUri(intentUri)
                    .setInternalProviderId(content.id)
                    .setLastEngagementTimeUtcMillis(System.currentTimeMillis())

                // Set poster
                content.poster?.let { posterUrl ->
                    programBuilder.setPosterArtUri(Uri.parse(posterUrl))
                    programBuilder.setPosterArtAspectRatio(TvContractCompat.WatchNextPrograms.ASPECT_RATIO_2_3)
                }

                // Set progress for continue watching
                if (watchType == TvContractCompat.WatchNextPrograms.WATCH_NEXT_TYPE_CONTINUE) {
                    programBuilder.setLastPlaybackPositionMillis(progress.position.toInt())
                    if (progress.duration > 0) {
                        programBuilder.setDurationMillis(progress.duration.toInt())
                    }
                }

                // Set year
                content.year?.let { year ->
                    programBuilder.setReleaseDate(year.toString())
                }

                // Set genres
                if (content.genres.isNotEmpty()) {
                    programBuilder.setGenre(content.genres.joinToString(", "))
                }

                val program = programBuilder.build()

                if (existingId > 0) {
                    // Update existing
                    context.contentResolver.update(
                        TvContractCompat.buildWatchNextProgramUri(existingId),
                        program.toContentValues(),
                        null,
                        null
                    )
                    existingId
                } else {
                    // Insert new
                    val uri = context.contentResolver.insert(
                        TvContractCompat.WatchNextPrograms.CONTENT_URI,
                        program.toContentValues()
                    )
                    uri?.let { ContentUris.parseId(it) } ?: -1L
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error adding movie to Watch Next", e)
                -1L
            }
        }
    }

    /**
     * Add or update a TV episode in Watch Next.
     */
    suspend fun addOrUpdateEpisode(
        show: StreamingContent,
        episode: Episode,
        progress: WatchProgress
    ): Long {
        return withContext(Dispatchers.IO) {
            try {
                val programId = "${show.id}:${episode.seasonNumber}:${episode.episodeNumber}"
                val existingId = findWatchNextProgram(programId)

                val watchType = if (progress.progress > 0.9f) {
                    // If episode is finished, show as "next episode"
                    TvContractCompat.WatchNextPrograms.WATCH_NEXT_TYPE_NEXT
                } else if (progress.progress > 0f) {
                    TvContractCompat.WatchNextPrograms.WATCH_NEXT_TYPE_CONTINUE
                } else {
                    TvContractCompat.WatchNextPrograms.WATCH_NEXT_TYPE_NEW
                }

                val intentUri = Uri.parse("nuviotv://play/series/${show.id}/${episode.id}")

                val programBuilder = WatchNextProgram.Builder()
                    .setType(TvContractCompat.WatchNextPrograms.TYPE_TV_EPISODE)
                    .setWatchNextType(watchType)
                    .setTitle(show.name)
                    .setEpisodeTitle(episode.title)
                    .setSeasonNumber(episode.seasonNumber)
                    .setEpisodeNumber(episode.episodeNumber)
                    .setDescription("S${episode.seasonNumber}:E${episode.episodeNumber} - ${episode.title}")
                    .setIntentUri(intentUri)
                    .setInternalProviderId(programId)
                    .setLastEngagementTimeUtcMillis(System.currentTimeMillis())

                // Set poster (use episode thumbnail if available, otherwise show poster)
                val posterUrl = episode.thumbnail ?: show.poster
                posterUrl?.let {
                    programBuilder.setPosterArtUri(Uri.parse(it))
                    programBuilder.setPosterArtAspectRatio(
                        if (episode.thumbnail != null) {
                            TvContractCompat.WatchNextPrograms.ASPECT_RATIO_16_9
                        } else {
                            TvContractCompat.WatchNextPrograms.ASPECT_RATIO_2_3
                        }
                    )
                }

                // Set progress
                if (watchType == TvContractCompat.WatchNextPrograms.WATCH_NEXT_TYPE_CONTINUE) {
                    programBuilder.setLastPlaybackPositionMillis(progress.position.toInt())
                    if (progress.duration > 0) {
                        programBuilder.setDurationMillis(progress.duration.toInt())
                    }
                }

                // Set genres
                if (show.genres.isNotEmpty()) {
                    programBuilder.setGenre(show.genres.joinToString(", "))
                }

                val program = programBuilder.build()

                if (existingId > 0) {
                    // Update existing
                    context.contentResolver.update(
                        TvContractCompat.buildWatchNextProgramUri(existingId),
                        program.toContentValues(),
                        null,
                        null
                    )
                    existingId
                } else {
                    // Insert new
                    val uri = context.contentResolver.insert(
                        TvContractCompat.WatchNextPrograms.CONTENT_URI,
                        program.toContentValues()
                    )
                    uri?.let { ContentUris.parseId(it) } ?: -1L
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error adding episode to Watch Next", e)
                -1L
            }
        }
    }

    /**
     * Find an existing Watch Next program by internal ID.
     */
    private fun findWatchNextProgram(internalId: String): Long {
        val cursor = context.contentResolver.query(
            TvContractCompat.WatchNextPrograms.CONTENT_URI,
            arrayOf(
                TvContractCompat.WatchNextPrograms._ID,
                TvContractCompat.WatchNextPrograms.COLUMN_INTERNAL_PROVIDER_ID
            ),
            "${TvContractCompat.WatchNextPrograms.COLUMN_INTERNAL_PROVIDER_ID} = ?",
            arrayOf(internalId),
            null
        )

        cursor?.use {
            if (it.moveToFirst()) {
                val idIndex = it.getColumnIndex(TvContractCompat.WatchNextPrograms._ID)
                if (idIndex >= 0) {
                    return it.getLong(idIndex)
                }
            }
        }

        return -1L
    }

    /**
     * Remove a program from Watch Next.
     */
    suspend fun removeFromWatchNext(contentId: String) {
        withContext(Dispatchers.IO) {
            try {
                val existingId = findWatchNextProgram(contentId)
                if (existingId > 0) {
                    context.contentResolver.delete(
                        TvContractCompat.buildWatchNextProgramUri(existingId),
                        null,
                        null
                    )
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error removing from Watch Next", e)
            }
        }
    }

    /**
     * Remove all app programs from Watch Next.
     */
    suspend fun clearAllWatchNext() {
        withContext(Dispatchers.IO) {
            try {
                val cursor = context.contentResolver.query(
                    TvContractCompat.WatchNextPrograms.CONTENT_URI,
                    arrayOf(TvContractCompat.WatchNextPrograms._ID),
                    null,
                    null,
                    null
                )

                cursor?.use {
                    while (it.moveToNext()) {
                        val idIndex = it.getColumnIndex(TvContractCompat.WatchNextPrograms._ID)
                        if (idIndex >= 0) {
                            val id = it.getLong(idIndex)
                            context.contentResolver.delete(
                                TvContractCompat.buildWatchNextProgramUri(id),
                                null,
                                null
                            )
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error clearing Watch Next", e)
            }
        }
    }

    /**
     * Mark content as watched (removes from continue watching, adds to history).
     */
    suspend fun markAsWatched(contentId: String) {
        removeFromWatchNext(contentId)
    }
}
