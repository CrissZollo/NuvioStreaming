import { useEffect, useRef, useCallback } from 'react';
import { BackHandler, Platform, NativeModules, NativeEventEmitter } from 'react-native';
import { useIsTV } from '../../../contexts/TVContext';

// TV remote key event types
type TVKeyEventType =
  | 'playPause'
  | 'play'
  | 'pause'
  | 'select'
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'back'
  | 'fastForward'
  | 'rewind'
  | 'menu';

interface TVRemoteControlsConfig {
  /** Handler for play/pause toggle */
  onPlayPause: () => void;
  /** Handler for seeking forward (receives seconds) */
  onSeekForward: (seconds: number) => void;
  /** Handler for seeking backward (receives seconds) */
  onSeekBackward: (seconds: number) => void;
  /** Handler for back button (exit player) */
  onBack: () => void;
  /** Handler for select/enter button */
  onSelect: () => void;
  /** Handler for up button (optional) */
  onUp?: () => void;
  /** Handler for down button (optional) */
  onDown?: () => void;
  /** Handler for menu button (optional) */
  onMenu?: () => void;
  /** Seek interval in seconds for D-Pad (default 10) */
  seekInterval?: number;
  /** Seek interval for fast forward/rewind (default 30) */
  fastSeekInterval?: number;
  /** Whether to enable remote controls (default true) */
  enabled?: boolean;
}

/**
 * Hook for handling TV remote control events in the video player
 * Maps D-Pad and media buttons to player actions
 */
export const useTVRemoteControls = (config: TVRemoteControlsConfig) => {
  const isTV = useIsTV();
  const {
    onPlayPause,
    onSeekForward,
    onSeekBackward,
    onBack,
    onSelect,
    onUp,
    onDown,
    onMenu,
    seekInterval = 10,
    fastSeekInterval = 30,
    enabled = true,
  } = config;

  const lastEventTime = useRef<number>(0);
  const DEBOUNCE_MS = 150; // Debounce rapid key presses

  // Handle key events from TV remote
  const handleKeyEvent = useCallback(
    (eventType: TVKeyEventType) => {
      if (!enabled) return;

      // Debounce rapid key presses
      const now = Date.now();
      if (now - lastEventTime.current < DEBOUNCE_MS) {
        return;
      }
      lastEventTime.current = now;

      switch (eventType) {
        case 'playPause':
        case 'play':
        case 'pause':
          onPlayPause();
          break;

        case 'select':
          onSelect();
          break;

        case 'left':
          onSeekBackward(seekInterval);
          break;

        case 'right':
          onSeekForward(seekInterval);
          break;

        case 'up':
          onUp?.();
          break;

        case 'down':
          onDown?.();
          break;

        case 'fastForward':
          onSeekForward(fastSeekInterval);
          break;

        case 'rewind':
          onSeekBackward(fastSeekInterval);
          break;

        case 'menu':
          onMenu?.();
          break;

        case 'back':
          onBack();
          break;
      }
    },
    [
      enabled,
      onPlayPause,
      onSeekForward,
      onSeekBackward,
      onBack,
      onSelect,
      onUp,
      onDown,
      onMenu,
      seekInterval,
      fastSeekInterval,
    ]
  );

  // Set up TV event listeners
  useEffect(() => {
    if (!isTV || Platform.OS !== 'android' || !enabled) {
      return;
    }

    // Handle hardware back button
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true; // Prevent default back behavior
    });

    // Try to set up native TV event listener if available
    // React Native's TVEventHandler or custom native module
    let tvEventSubscription: any = null;

    try {
      // Check if we have access to TV event handling
      // This may need a native module for full support
      const { TVDetection } = NativeModules;

      if (TVDetection) {
        // If we have a TV detection module, it might also provide key events
        // This is a placeholder for actual implementation
        // You would need to implement key event forwarding in the native module
      }
    } catch (error) {
      // TV event module not available, fall back to basic support
      console.log('TV remote events: using basic back button support only');
    }

    return () => {
      backHandler.remove();
      if (tvEventSubscription) {
        tvEventSubscription.remove();
      }
    };
  }, [isTV, enabled, onBack]);

  // Return handler for manual event triggering (useful for testing)
  return {
    handleKeyEvent,
    isTV,
    enabled,
  };
};

/**
 * Simple hook for handling just the back button in player
 * Use this if you only need back button support
 */
export const useTVBackButton = (onBack: () => void, enabled: boolean = true) => {
  const isTV = useIsTV();

  useEffect(() => {
    if (!enabled) return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });

    return () => backHandler.remove();
  }, [onBack, enabled]);

  return { isTV };
};

export default useTVRemoteControls;
