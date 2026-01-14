package com.nuvio.app.tv

import android.view.KeyEvent
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

class TVKeyEventModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "TVKeyEvent"

    // Flag to allow/block repeat events (controlled from JS for player seeking)
    private var allowRepeatEnabled = false

    companion object {
        private var instance: TVKeyEventModule? = null

        fun getInstance(): TVKeyEventModule? = instance

        // Map Android key codes to our event types
        fun keyCodeToEventType(keyCode: Int): String? {
            return when (keyCode) {
                KeyEvent.KEYCODE_DPAD_LEFT -> "left"
                KeyEvent.KEYCODE_DPAD_RIGHT -> "right"
                KeyEvent.KEYCODE_DPAD_UP -> "up"
                KeyEvent.KEYCODE_DPAD_DOWN -> "down"
                KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER -> "select"
                KeyEvent.KEYCODE_BACK -> "back"
                KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE, KeyEvent.KEYCODE_MEDIA_PLAY, KeyEvent.KEYCODE_MEDIA_PAUSE -> "playPause"
                KeyEvent.KEYCODE_MEDIA_FAST_FORWARD -> "fastForward"
                KeyEvent.KEYCODE_MEDIA_REWIND -> "rewind"
                KeyEvent.KEYCODE_MENU -> "menu"
                else -> null
            }
        }
    }

    init {
        instance = this
    }

    /**
     * Check if repeat events should be allowed (for player seeking)
     * Called from MainActivity to decide whether to block repeat D-pad events
     */
    fun shouldAllowRepeat(): Boolean = allowRepeatEnabled

    /**
     * Enable/disable repeat events from JavaScript
     * Call setAllowRepeat(true) when entering player, setAllowRepeat(false) when exiting
     */
    @ReactMethod
    fun setAllowRepeat(allow: Boolean) {
        allowRepeatEnabled = allow
    }

    fun sendKeyEvent(keyCode: Int, action: Int, repeatCount: Int = 0) {
        val eventType = keyCodeToEventType(keyCode) ?: return
        val actionStr = if (action == KeyEvent.ACTION_DOWN) "down" else "up"

        val params = Arguments.createMap().apply {
            putString("key", eventType)
            putString("action", actionStr)
            putInt("keyCode", keyCode)
            putInt("repeatCount", repeatCount)
        }

        try {
            if (reactApplicationContext.hasActiveReactInstance()) {
                reactApplicationContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("onTVKeyEvent", params)
            }
        } catch (e: Exception) {
            // Silently ignore errors
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Required for RN event emitter
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for RN event emitter
    }
}
