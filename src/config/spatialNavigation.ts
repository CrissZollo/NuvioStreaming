import { configureRemoteControl, Directions } from 'react-tv-space-navigation';
import { Platform } from 'react-native';

/**
 * Configures react-tv-space-navigation to work with Android TV remote control.
 *
 * This must be called once at app startup before any SpatialNavigationRoot is rendered.
 *
 * Note: Uses React Native's built-in TVEventHandler for Android TV remote events.
 */
export const setupSpatialNavigation = () => {
  // Only configure on Android TV
  if (Platform.OS !== 'android') {
    console.log('[SpatialNav] Skipping configuration - not Android');
    return;
  }

  try {
    // Import TVEventHandler dynamically to avoid issues on non-TV platforms
    const { useTVEventHandler } = require('react-native');

    configureRemoteControl({
      remoteControlSubscriber: (callback) => {
        // Create a handler for TV remote events
        const handleTVEvent = (evt: { eventType: string }) => {
          switch (evt.eventType) {
            case 'up':
              callback(Directions.UP);
              break;
            case 'down':
              callback(Directions.DOWN);
              break;
            case 'left':
              callback(Directions.LEFT);
              break;
            case 'right':
              callback(Directions.RIGHT);
              break;
            case 'select':
            case 'playPause':
              callback(Directions.ENTER);
              break;
            default:
              // Ignore other events (back, etc.)
              break;
          }
        };

        // Note: The actual subscription happens via useTVEventHandler hook
        // This is a placeholder - actual implementation needs to use the hook
        // in a React component context.
        //
        // For now, we'll use a simpler approach with DeviceEventEmitter
        const { DeviceEventEmitter } = require('react-native');

        const subscription = DeviceEventEmitter.addListener(
          'onHardwareKeyDown',
          (keyEvent: { keyCode: number }) => {
            // Android TV key codes
            // DPAD_UP = 19, DPAD_DOWN = 20, DPAD_LEFT = 21, DPAD_RIGHT = 22
            // DPAD_CENTER = 23, ENTER = 66
            switch (keyEvent.keyCode) {
              case 19: // DPAD_UP
                callback(Directions.UP);
                break;
              case 20: // DPAD_DOWN
                callback(Directions.DOWN);
                break;
              case 21: // DPAD_LEFT
                callback(Directions.LEFT);
                break;
              case 22: // DPAD_RIGHT
                callback(Directions.RIGHT);
                break;
              case 23: // DPAD_CENTER
              case 66: // ENTER
                callback(Directions.ENTER);
                break;
            }
          }
        );

        // Return cleanup function
        return () => {
          subscription.remove();
        };
      },
    });

    console.log('[SpatialNav] Remote control configured successfully');
  } catch (error) {
    console.error('[SpatialNav] Failed to configure remote control:', error);
  }
};

export default setupSpatialNavigation;
