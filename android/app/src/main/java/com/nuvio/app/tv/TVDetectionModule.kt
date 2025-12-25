package com.nuvio.app.tv

import android.content.pm.PackageManager
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

class TVDetectionModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "TVDetection"
    }

    /**
     * Check if the device is an Android TV
     * Uses PackageManager to check for FEATURE_LEANBACK
     */
    @ReactMethod
    fun isTV(promise: Promise) {
        try {
            val packageManager = reactApplicationContext.packageManager
            val isTV = packageManager.hasSystemFeature(PackageManager.FEATURE_LEANBACK)
            promise.resolve(isTV)
        } catch (e: Exception) {
            promise.reject("TV_DETECTION_ERROR", e.message)
        }
    }

    /**
     * Synchronous check for TV - available as a constant
     */
    override fun getConstants(): Map<String, Any> {
        val packageManager = reactApplicationContext.packageManager
        val isTV = packageManager.hasSystemFeature(PackageManager.FEATURE_LEANBACK)
        val isFireTV = packageManager.hasSystemFeature("amazon.hardware.fire_tv")

        return mapOf(
            "isTV" to isTV,
            "isFireTV" to isFireTV,
            "hasLeanback" to isTV
        )
    }
}
