package com.nuvio.tv

import android.os.Bundle
import android.util.Log
import android.view.KeyEvent
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import com.nuvio.tv.ui.navigation.NuvioNavigation
import com.nuvio.tv.ui.theme.NuvioTvTheme
import com.nuvio.tv.ui.theme.ThemeViewModel
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    companion object {
        private const val TAG = "MainActivity"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            val themeViewModel: ThemeViewModel = hiltViewModel()
            val currentTheme by themeViewModel.currentTheme.collectAsState()

            NuvioTvTheme(themePreset = currentTheme) {
                NuvioNavigation(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(androidx.compose.material3.MaterialTheme.colorScheme.background)
                )
            }
        }
    }

    /**
     * Catch IllegalStateException from Compose focus system during rapid D-pad navigation.
     * This is a known issue with TvLazyColumn/TvLazyRow where items get recycled
     * while the focus system is still calculating layout coordinates.
     */
    override fun dispatchKeyEvent(event: KeyEvent?): Boolean {
        return try {
            super.dispatchKeyEvent(event)
        } catch (e: IllegalStateException) {
            if (e.message?.contains("LayoutCoordinate") == true ||
                e.message?.contains("isAttached") == true) {
                // Swallow the focus calculation error during rapid navigation
                Log.w(TAG, "Focus navigation error (swallowed): ${e.message}")
                true
            } else {
                throw e
            }
        }
    }
}
