package com.nuvio.app
import com.reactnative.googlecast.api.RNGCCastContext

import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.KeyEvent

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

import com.nuvio.app.tv.TVKeyEventModule

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    setTheme(R.style.AppTheme);
    super.onCreate(null)
// @generated begin react-native-google-cast-onCreate - expo prebuild (DO NOT MODIFY) sync-489050f2bf9933a98bbd9d93137016ae14c22faa
    RNGCCastContext.getSharedInstance(this)
// @generated end react-native-google-cast-onCreate
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  /**
    * Align the back button behavior with Android S
    * where moving root activities to background instead of finishing activities.
    * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
    */
  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              // For non-root activities, use the default implementation to finish them.
              super.invokeDefaultOnBackPressed()
          }
          return
      }

      // Use the default back button implementation on Android S
      // because it's doing more than [Activity.moveTaskToBack] in fact.
      super.invokeDefaultOnBackPressed()
  }

  /**
   * Intercept ALL key events before they reach React Native's view hierarchy
   * This is called before onKeyDown/onKeyUp and allows us to fully block repeat events
   */
  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
      val keyCode = event.keyCode
      val action = event.action
      val repeatCount = event.repeatCount

      // Check if this is a D-pad direction key
      val isDpadDirection = keyCode == KeyEvent.KEYCODE_DPAD_UP ||
                           keyCode == KeyEvent.KEYCODE_DPAD_DOWN ||
                           keyCode == KeyEvent.KEYCODE_DPAD_LEFT ||
                           keyCode == KeyEvent.KEYCODE_DPAD_RIGHT

      // Block repeat events for D-pad directions (unless player explicitly allows it)
      // Default to blocking if module not yet initialized
      if (isDpadDirection && action == KeyEvent.ACTION_DOWN && repeatCount > 0) {
          val module = TVKeyEventModule.getInstance()
          val allowRepeat = module?.shouldAllowRepeat() == true
          if (!allowRepeat) {
              // Fully consume the event - don't let it reach React Native at all
              return true
          }
      }

      // Send first press to JS for custom handling (not repeats unless allowed)
      val module = TVKeyEventModule.getInstance()
      if (module != null) {
          if (action == KeyEvent.ACTION_DOWN) {
              module.sendKeyEvent(keyCode, KeyEvent.ACTION_DOWN, repeatCount)
          } else if (action == KeyEvent.ACTION_UP) {
              module.sendKeyEvent(keyCode, KeyEvent.ACTION_UP, 0)
          }
      }

      // Let React Native handle the event for focus navigation
      return super.dispatchKeyEvent(event)
  }

  /**
   * Also override onKeyDown as a backup - some devices route keys differently
   */
  override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
      val repeatCount = event?.repeatCount ?: 0

      val isDpadDirection = keyCode == KeyEvent.KEYCODE_DPAD_UP ||
                           keyCode == KeyEvent.KEYCODE_DPAD_DOWN ||
                           keyCode == KeyEvent.KEYCODE_DPAD_LEFT ||
                           keyCode == KeyEvent.KEYCODE_DPAD_RIGHT

      // Block repeat events - default to blocking if module not initialized
      if (isDpadDirection && repeatCount > 0) {
          val allowRepeat = TVKeyEventModule.getInstance()?.shouldAllowRepeat() == true
          if (!allowRepeat) {
              return true
          }
      }

      return super.onKeyDown(keyCode, event)
  }
}