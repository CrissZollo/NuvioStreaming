package com.nuvio.app
import com.reactnative.googlecast.api.RNGCCastContext

import android.os.Build
import android.os.Bundle
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
   * Intercept key events from TV remote and forward to React Native
   * For D-pad navigation keys, we let React Native's focus system handle them
   * along with our custom module to allow both native focus and custom handling
   */
  override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
      // Send to our module first
      TVKeyEventModule.getInstance()?.sendKeyEvent(keyCode, KeyEvent.ACTION_DOWN)
      // Always pass to super to let the native focus system work
      return super.onKeyDown(keyCode, event)
  }

  override fun onKeyUp(keyCode: Int, event: KeyEvent?): Boolean {
      TVKeyEventModule.getInstance()?.sendKeyEvent(keyCode, KeyEvent.ACTION_UP)
      return super.onKeyUp(keyCode, event)
  }
}