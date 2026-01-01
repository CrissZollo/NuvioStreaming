package com.nuvio.tv.ui.screens.player

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.media3.common.MimeTypes
import androidx.media3.exoplayer.ExoPlayer
import com.nuvio.tv.data.repository.ContentRepository
import com.nuvio.tv.data.repository.TraktRepository
import com.nuvio.tv.data.repository.WatchProgressRepository
import com.nuvio.tv.domain.model.Episode
import com.nuvio.tv.domain.model.Stream
import com.nuvio.tv.domain.model.StreamingContent
import com.nuvio.tv.domain.model.Subtitle
import com.nuvio.tv.domain.model.WatchProgress
import com.nuvio.tv.player.NuvioPlayer
import com.nuvio.tv.player.PlayerState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Playback info for tracking progress and scrobbling.
 */
data class PlaybackInfo(
    val contentId: String,
    val contentType: String,
    val contentTitle: String,
    val episodeId: String? = null,
    val episodeTitle: String? = null,
    val poster: String? = null,
    val seasonNumber: Int? = null,
    val episodeNumber: Int? = null
)

/**
 * External subtitles state.
 */
data class ExternalSubtitlesState(
    val subtitles: List<Subtitle> = emptyList(),
    val selectedIndex: Int = -1,
    val isLoading: Boolean = false
)

@HiltViewModel
class PlayerViewModel @Inject constructor(
    private val nuvioPlayer: NuvioPlayer,
    private val contentRepository: ContentRepository,
    private val watchProgressRepository: WatchProgressRepository,
    private val traktRepository: TraktRepository
) : ViewModel() {

    companion object {
        private const val TAG = "PlayerViewModel"
        private const val PROGRESS_SAVE_INTERVAL = 15_000L // Save every 15 seconds
        private const val SCROBBLE_START_PERCENT = 0.05f // Start scrobble at 5%
        private const val SCROBBLE_STOP_PERCENT = 0.90f // Mark as watched at 90%
    }

    val playerState: StateFlow<PlayerState> = nuvioPlayer.playerState

    private val _externalSubtitles = MutableStateFlow(ExternalSubtitlesState())
    val externalSubtitles: StateFlow<ExternalSubtitlesState> = _externalSubtitles.asStateFlow()

    private val _availableSpeeds = MutableStateFlow(listOf(0.5f, 0.75f, 1f, 1.25f, 1.5f, 1.75f, 2f))
    val availableSpeeds: StateFlow<List<Float>> = _availableSpeeds.asStateFlow()

    private var playbackInfo: PlaybackInfo? = null
    private var progressSaveJob: Job? = null
    private var hasScrobbledStart = false
    private var hasScrobbledStop = false
    private var lastSavedPosition: Long = 0L

    init {
        nuvioPlayer.initialize()
        startPositionUpdates()
    }

    fun getExoPlayer(): ExoPlayer? = nuvioPlayer.exoPlayer

    /**
     * Start playing a stream with metadata for tracking.
     */
    fun playStream(
        stream: Stream,
        startPosition: Long = 0L,
        info: PlaybackInfo
    ) {
        playbackInfo = info
        hasScrobbledStart = false
        hasScrobbledStop = false
        lastSavedPosition = 0L

        nuvioPlayer.playStream(stream, startPosition)

        // Load external subtitles
        loadExternalSubtitles(info.contentType, info.contentId, info.episodeId)

        // Start progress saving
        startProgressSaving()

        Log.d(TAG, "Playing: ${info.contentTitle} ${info.episodeTitle ?: ""}")
    }

    /**
     * Load external subtitles from addons.
     */
    private fun loadExternalSubtitles(type: String, contentId: String, episodeId: String?) {
        viewModelScope.launch {
            _externalSubtitles.value = _externalSubtitles.value.copy(isLoading = true)

            try {
                val id = episodeId ?: contentId
                val subtitles = contentRepository.getSubtitles(type, id)
                _externalSubtitles.value = _externalSubtitles.value.copy(
                    subtitles = subtitles,
                    isLoading = false
                )
                Log.d(TAG, "Loaded ${subtitles.size} external subtitles")
            } catch (e: Exception) {
                Log.e(TAG, "Error loading subtitles", e)
                _externalSubtitles.value = _externalSubtitles.value.copy(isLoading = false)
            }
        }
    }

    /**
     * Select an external subtitle track.
     */
    fun selectExternalSubtitle(index: Int) {
        val subtitles = _externalSubtitles.value.subtitles
        if (index < 0 || index >= subtitles.size) {
            // Disable external subtitles
            _externalSubtitles.value = _externalSubtitles.value.copy(selectedIndex = -1)
            nuvioPlayer.selectSubtitleTrack(-1)
            return
        }

        val subtitle = subtitles[index]
        val mimeType = when {
            subtitle.format?.contains("srt", ignoreCase = true) == true -> MimeTypes.APPLICATION_SUBRIP
            subtitle.format?.contains("vtt", ignoreCase = true) == true -> MimeTypes.TEXT_VTT
            subtitle.format?.contains("ass", ignoreCase = true) == true -> MimeTypes.TEXT_SSA
            subtitle.url.endsWith(".srt", ignoreCase = true) -> MimeTypes.APPLICATION_SUBRIP
            subtitle.url.endsWith(".vtt", ignoreCase = true) -> MimeTypes.TEXT_VTT
            subtitle.url.endsWith(".ass", ignoreCase = true) -> MimeTypes.TEXT_SSA
            else -> MimeTypes.TEXT_VTT
        }

        nuvioPlayer.addSubtitle(subtitle.url, subtitle.lang, mimeType)
        _externalSubtitles.value = _externalSubtitles.value.copy(selectedIndex = index)
        Log.d(TAG, "Selected external subtitle: ${subtitle.lang}")
    }

    /**
     * Start periodic progress saving.
     */
    private fun startProgressSaving() {
        progressSaveJob?.cancel()
        progressSaveJob = viewModelScope.launch {
            while (isActive) {
                delay(PROGRESS_SAVE_INTERVAL)
                saveCurrentProgress()
                checkScrobbleState()
            }
        }
    }

    /**
     * Save current watch progress.
     */
    private suspend fun saveCurrentProgress() {
        val info = playbackInfo ?: return
        val state = playerState.value

        if (state.duration <= 0) return
        if (state.currentPosition == lastSavedPosition) return

        lastSavedPosition = state.currentPosition

        val progress = WatchProgress(
            contentId = info.contentId,
            type = info.contentType,
            episodeId = info.episodeId,
            position = state.currentPosition,
            duration = state.duration,
            title = info.contentTitle,
            poster = info.poster
        )

        watchProgressRepository.saveProgress(progress)
        Log.d(TAG, "Saved progress: ${state.currentPosition}/${state.duration}")
    }

    /**
     * Check and update Trakt scrobble state.
     */
    private suspend fun checkScrobbleState() {
        val info = playbackInfo ?: return
        val state = playerState.value

        if (state.duration <= 0) return
        if (!traktRepository.isAuthenticated()) return

        val progressPercent = state.currentPosition.toFloat() / state.duration.toFloat()

        // Create StreamingContent for scrobble
        val content = StreamingContent(
            id = info.contentId,
            type = info.contentType,
            name = info.contentTitle
        )

        // Create Episode if applicable
        val episode = if (info.episodeId != null && info.seasonNumber != null && info.episodeNumber != null) {
            Episode(
                id = info.episodeId,
                title = info.episodeTitle ?: "",
                seasonNumber = info.seasonNumber,
                episodeNumber = info.episodeNumber,
                stremioId = info.episodeId
            )
        } else null

        // Start scrobble at 5%
        if (!hasScrobbledStart && progressPercent >= SCROBBLE_START_PERCENT && state.isPlaying) {
            hasScrobbledStart = true
            traktRepository.startScrobble(content, episode, progressPercent)
            Log.d(TAG, "Trakt scrobble started")
        }

        // Stop scrobble (mark as watched) at 90%
        if (!hasScrobbledStop && progressPercent >= SCROBBLE_STOP_PERCENT) {
            hasScrobbledStop = true
            traktRepository.stopScrobble(content, episode, progressPercent)

            // Mark as watched in local database
            watchProgressRepository.markAsWatched(info.contentId, info.episodeId, state.duration)
            Log.d(TAG, "Trakt scrobble stopped - marked as watched")
        }
    }

    fun togglePlayPause() {
        nuvioPlayer.togglePlayPause()

        // Scrobble pause/resume
        viewModelScope.launch {
            val info = playbackInfo ?: return@launch
            val state = playerState.value
            if (!traktRepository.isAuthenticated()) return@launch

            val progressPercent = if (state.duration > 0) {
                state.currentPosition.toFloat() / state.duration.toFloat()
            } else 0f

            // Create StreamingContent for scrobble
            val content = StreamingContent(
                id = info.contentId,
                type = info.contentType,
                name = info.contentTitle
            )

            // Create Episode if applicable
            val episode = if (info.episodeId != null && info.seasonNumber != null && info.episodeNumber != null) {
                Episode(
                    id = info.episodeId,
                    title = info.episodeTitle ?: "",
                    seasonNumber = info.seasonNumber,
                    episodeNumber = info.episodeNumber,
                    stremioId = info.episodeId
                )
            } else null

            if (state.isPlaying) {
                traktRepository.pauseScrobble(content, episode, progressPercent)
            }
        }
    }

    fun play() {
        nuvioPlayer.play()
    }

    fun pause() {
        nuvioPlayer.pause()
    }

    fun seekTo(positionMs: Long) {
        nuvioPlayer.seekTo(positionMs)
    }

    fun seekForward(amountMs: Long = 10_000) {
        nuvioPlayer.seekForward(amountMs)
    }

    fun seekBackward(amountMs: Long = 10_000) {
        nuvioPlayer.seekBackward(amountMs)
    }

    fun setPlaybackSpeed(speed: Float) {
        nuvioPlayer.setPlaybackSpeed(speed)
    }

    fun selectAudioTrack(trackIndex: Int) {
        nuvioPlayer.selectAudioTrack(trackIndex)
    }

    fun selectSubtitleTrack(trackIndex: Int) {
        // Clear external subtitle selection when selecting embedded
        if (trackIndex >= 0) {
            _externalSubtitles.value = _externalSubtitles.value.copy(selectedIndex = -1)
        }
        nuvioPlayer.selectSubtitleTrack(trackIndex)
    }

    fun selectQualityLevel(levelIndex: Int) {
        nuvioPlayer.selectQualityLevel(levelIndex)
    }

    fun release() {
        // Save final progress before release
        viewModelScope.launch {
            saveCurrentProgress()
        }

        progressSaveJob?.cancel()
        nuvioPlayer.release()
    }

    private fun startPositionUpdates() {
        viewModelScope.launch {
            while (isActive) {
                nuvioPlayer.updatePlayerState()
                delay(500) // Update every 500ms
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        progressSaveJob?.cancel()
        nuvioPlayer.release()
    }
}
