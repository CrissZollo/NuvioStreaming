package com.nuvio.tv.ui.screens.player

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.media3.exoplayer.ExoPlayer
import com.nuvio.tv.domain.model.Stream
import com.nuvio.tv.player.NuvioPlayer
import com.nuvio.tv.player.PlayerState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class PlayerViewModel @Inject constructor(
    private val nuvioPlayer: NuvioPlayer
) : ViewModel() {

    val playerState: StateFlow<PlayerState> = nuvioPlayer.playerState

    init {
        nuvioPlayer.initialize()
        startPositionUpdates()
    }

    fun getExoPlayer(): ExoPlayer? = nuvioPlayer.exoPlayer

    fun playStream(stream: Stream, startPosition: Long = 0L) {
        nuvioPlayer.playStream(stream, startPosition)
    }

    fun togglePlayPause() {
        nuvioPlayer.togglePlayPause()
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
        nuvioPlayer.selectSubtitleTrack(trackIndex)
    }

    fun selectQualityLevel(levelIndex: Int) {
        nuvioPlayer.selectQualityLevel(levelIndex)
    }

    fun release() {
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
        nuvioPlayer.release()
    }
}
