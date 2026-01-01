package com.nuvio.tv.leanback

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Broadcast receiver that handles boot completed events.
 * Used to update home screen channels after device restart.
 */
class BootReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "BootReceiver"
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            Log.d(TAG, "Boot completed, updating home screen channels")

            // Use pending result to keep receiver alive during async work
            val pendingResult = goAsync()

            scope.launch {
                try {
                    // Initialize managers and update channels
                    val homeChannelManager = HomeChannelManager(context)

                    // Request channel visibility
                    // The actual content will be loaded when the app opens
                    // For now, just ensure channels exist
                    homeChannelManager.updateContinueWatchingChannel(emptyList())
                    homeChannelManager.updateRecommendationsChannel(emptyList())

                    Log.d(TAG, "Home screen channels updated successfully")
                } catch (e: Exception) {
                    Log.e(TAG, "Error updating home screen channels", e)
                } finally {
                    pendingResult.finish()
                }
            }
        }
    }
}
