package com.nuvio.app.exoplayer

import android.util.Log
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.common.MapBuilder
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.uimanager.events.RCTEventEmitter

class ExoPlayerViewManager : SimpleViewManager<ExoPlayerView>() {

    companion object {
        private const val TAG = "ExoPlayerViewManager"
        private const val REACT_CLASS = "ExoPlayer"

        // Command IDs
        const val COMMAND_SEEK = 0
        const val COMMAND_SET_AUDIO_TRACK = 1
        const val COMMAND_SET_SUBTITLE_TRACK = 2
    }

    override fun getName(): String = REACT_CLASS

    override fun createViewInstance(reactContext: ThemedReactContext): ExoPlayerView {
        Log.d(TAG, "Creating ExoPlayerView instance")
        val view = ExoPlayerView(reactContext)

        // Set up callbacks
        view.onLoadCallback = { duration, width, height ->
            Log.d(TAG, "onLoad callback: duration=$duration, size=${width}x${height}")
            val event = com.facebook.react.bridge.Arguments.createMap().apply {
                putDouble("duration", duration)
                putInt("width", width)
                putInt("height", height)
            }
            reactContext.getJSModule(RCTEventEmitter::class.java)
                .receiveEvent(view.id, "onLoad", event)
        }

        view.onProgressCallback = { position, duration ->
            val event = com.facebook.react.bridge.Arguments.createMap().apply {
                putDouble("currentTime", position)
                putDouble("duration", duration)
            }
            reactContext.getJSModule(RCTEventEmitter::class.java)
                .receiveEvent(view.id, "onProgress", event)
        }

        view.onEndCallback = {
            Log.d(TAG, "onEnd callback")
            val event = com.facebook.react.bridge.Arguments.createMap()
            reactContext.getJSModule(RCTEventEmitter::class.java)
                .receiveEvent(view.id, "onEnd", event)
        }

        view.onErrorCallback = { message ->
            Log.e(TAG, "onError callback: $message")
            val event = com.facebook.react.bridge.Arguments.createMap().apply {
                putString("error", message)
            }
            reactContext.getJSModule(RCTEventEmitter::class.java)
                .receiveEvent(view.id, "onError", event)
        }

        view.onTracksChangedCallback = { audioTracks, subtitleTracks ->
            Log.d(TAG, "onTracksChanged callback: audio=${audioTracks.size}, subs=${subtitleTracks.size}")
            val audioArray = com.facebook.react.bridge.Arguments.createArray()
            audioTracks.forEach { track ->
                val trackMap = com.facebook.react.bridge.Arguments.createMap().apply {
                    putInt("id", track["id"] as Int)
                    putString("name", track["name"] as String)
                    putString("language", track["language"] as String)
                    putString("codec", track["codec"] as String)
                    putBoolean("supported", track["supported"] as? Boolean ?: true)
                }
                audioArray.pushMap(trackMap)
            }

            val subtitleArray = com.facebook.react.bridge.Arguments.createArray()
            subtitleTracks.forEach { track ->
                val trackMap = com.facebook.react.bridge.Arguments.createMap().apply {
                    putInt("id", track["id"] as Int)
                    putString("name", track["name"] as String)
                    putString("language", track["language"] as String)
                    putString("codec", track["codec"] as String)
                }
                subtitleArray.pushMap(trackMap)
            }

            val event = com.facebook.react.bridge.Arguments.createMap().apply {
                putArray("audioTracks", audioArray)
                putArray("subtitleTracks", subtitleArray)
            }
            reactContext.getJSModule(RCTEventEmitter::class.java)
                .receiveEvent(view.id, "onTracksChanged", event)
        }

        return view
    }

    override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> {
        return MapBuilder.builder<String, Any>()
            .put("onLoad", MapBuilder.of("registrationName", "onLoad"))
            .put("onProgress", MapBuilder.of("registrationName", "onProgress"))
            .put("onEnd", MapBuilder.of("registrationName", "onEnd"))
            .put("onError", MapBuilder.of("registrationName", "onError"))
            .put("onTracksChanged", MapBuilder.of("registrationName", "onTracksChanged"))
            .build()
    }

    override fun getCommandsMap(): Map<String, Int> {
        return MapBuilder.builder<String, Int>()
            .put("seek", COMMAND_SEEK)
            .put("setAudioTrack", COMMAND_SET_AUDIO_TRACK)
            .put("setSubtitleTrack", COMMAND_SET_SUBTITLE_TRACK)
            .build()
    }

    override fun receiveCommand(view: ExoPlayerView, commandId: String, args: ReadableArray?) {
        Log.d(TAG, "receiveCommand: $commandId, args: $args")
        when (commandId) {
            "seek" -> {
                val position = args?.getDouble(0) ?: 0.0
                Log.d(TAG, "Seek command: position=$position")
                view.seekTo(position)
            }
            "setAudioTrack" -> {
                val trackId = args?.getInt(0) ?: 0
                Log.d(TAG, "setAudioTrack command: trackId=$trackId")
                view.setAudioTrack(trackId)
            }
            "setSubtitleTrack" -> {
                val trackId = args?.getInt(0) ?: 0
                Log.d(TAG, "setSubtitleTrack command: trackId=$trackId")
                view.setSubtitleTrack(trackId)
            }
        }
    }

    @ReactProp(name = "source")
    fun setSource(view: ExoPlayerView, source: String?) {
        Log.d(TAG, "setSource: $source")
        source?.let { view.setDataSource(it) }
    }

    @ReactProp(name = "headers")
    fun setHeaders(view: ExoPlayerView, headers: ReadableMap?) {
        Log.d(TAG, "setHeaders: $headers")
        headers?.let {
            val map = mutableMapOf<String, String>()
            val iterator = it.keySetIterator()
            while (iterator.hasNextKey()) {
                val key = iterator.nextKey()
                map[key] = it.getString(key) ?: ""
            }
            view.setHeaders(map)
        }
    }

    @ReactProp(name = "paused")
    fun setPaused(view: ExoPlayerView, paused: Boolean) {
        Log.d(TAG, "setPaused: $paused")
        view.setPaused(paused)
    }

    @ReactProp(name = "volume")
    fun setVolume(view: ExoPlayerView, volume: Double) {
        view.setVolume(volume)
    }

    @ReactProp(name = "rate")
    fun setRate(view: ExoPlayerView, rate: Double) {
        view.setSpeed(rate)
    }

    @ReactProp(name = "resizeMode")
    fun setResizeMode(view: ExoPlayerView, mode: String?) {
        Log.d(TAG, "setResizeMode: $mode")
        mode?.let { view.setResizeMode(it) }
    }

    @ReactProp(name = "enableAudioPassthrough")
    fun setEnableAudioPassthrough(view: ExoPlayerView, enabled: Boolean) {
        Log.d(TAG, "setEnableAudioPassthrough: $enabled")
        view.setAudioPassthrough(enabled)
    }

    override fun onDropViewInstance(view: ExoPlayerView) {
        Log.d(TAG, "onDropViewInstance")
        view.release()
        super.onDropViewInstance(view)
    }
}
