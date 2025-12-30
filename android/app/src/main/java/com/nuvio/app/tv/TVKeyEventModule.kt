package com.nuvio.app.tv

import android.view.KeyEvent
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

class TVKeyEventModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private var instance: TVKeyEventModule? = null

        fun getInstance(): TVKeyEventModule? = instance

        // Key codes for D-pad
        const val KEY_UP = "up"
        const val KEY_DOWN = "down"
        const val KEY_LEFT = "left"
        const val KEY_RIGHT = "right"
        const val KEY_SELECT = "select"
        const val KEY_BACK = "back"
        const val KEY_PLAY_PAUSE = "playPause"
        const val KEY_MENU = "menu"
        const val KEY_FAST_FORWARD = "fastForward"
        const val KEY_REWIND = "rewind"
    }

    private var listenerCount = 0

    init {
        instance = this
    }

    override fun getName(): String = "TVKeyEvent"

    @ReactMethod
    fun addListener(eventName: String) {
        listenerCount++
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        listenerCount -= count
        if (listenerCount < 0) listenerCount = 0
    }

    /**
     * Called from MainActivity when a key event occurs
     */
    fun sendKeyEvent(keyCode: Int, action: Int) {
        if (listenerCount <= 0) return

        val keyName = when (keyCode) {
            KeyEvent.KEYCODE_DPAD_UP -> KEY_UP
            KeyEvent.KEYCODE_DPAD_DOWN -> KEY_DOWN
            KeyEvent.KEYCODE_DPAD_LEFT -> KEY_LEFT
            KeyEvent.KEYCODE_DPAD_RIGHT -> KEY_RIGHT
            KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER -> KEY_SELECT
            KeyEvent.KEYCODE_BACK -> KEY_BACK
            KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE -> KEY_PLAY_PAUSE
            KeyEvent.KEYCODE_MENU -> KEY_MENU
            KeyEvent.KEYCODE_MEDIA_FAST_FORWARD -> KEY_FAST_FORWARD
            KeyEvent.KEYCODE_MEDIA_REWIND -> KEY_REWIND
            else -> return // Ignore other keys
        }

        val actionName = when (action) {
            KeyEvent.ACTION_DOWN -> "down"
            KeyEvent.ACTION_UP -> "up"
            else -> return
        }

        val params = Arguments.createMap().apply {
            putString("key", keyName)
            putString("action", actionName)
            putInt("keyCode", keyCode)
        }

        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("onTVKeyEvent", params)
    }
}
