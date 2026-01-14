import { useEffect, useRef } from 'react';
import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import { useIsTV } from '../contexts/TVContext';

export type TVKeyType =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'select'
  | 'back'
  | 'playPause'
  | 'menu'
  | 'fastForward'
  | 'rewind';

export type TVKeyAction = 'down' | 'up';

export interface TVKeyEvent {
  key: TVKeyType;
  action: TVKeyAction;
  keyCode: number;
  repeatCount: number;
}

interface UseTVKeyEventConfig {
  onKeyDown?: (key: TVKeyType) => void;
  onKeyUp?: (key: TVKeyType) => void;
  onLeft?: () => void;
  onRight?: () => void;
  onUp?: () => void;
  onDown?: () => void;
  onSelect?: () => void;
  onBack?: () => void;
  onPlayPause?: () => void;
  onLeftUp?: () => void;
  onRightUp?: () => void;
  enabled?: boolean;
  /** Allow key repeat/hold events. Default: false (blocks repeats). Set to true for player seeking. */
  allowRepeat?: boolean;
}

// Debounce times - reduced for faster response
const DEBOUNCE_MS_DEFAULT = 50; // Reduced from 150ms for faster UI response
const DEBOUNCE_MS_SEEK = 0; // No debounce for left/right to allow continuous seeking

/**
 * Hook for listening to TV remote key events
 * Uses native TVKeyEventModule to receive D-pad and media button events
 */
export const useTVKeyEvent = (config: UseTVKeyEventConfig) => {
  const isTV = useIsTV();
  const {
    onKeyDown,
    onKeyUp,
    onLeft,
    onRight,
    onUp,
    onDown,
    onSelect,
    onBack,
    onPlayPause,
    onLeftUp,
    onRightUp,
    enabled = true,
    allowRepeat = false,
  } = config;

  const lastEventTime = useRef<Record<string, number>>({});

  // Store callbacks in refs to avoid recreating the event handler
  const callbacksRef = useRef({
    onKeyDown,
    onKeyUp,
    onLeft,
    onRight,
    onUp,
    onDown,
    onSelect,
    onBack,
    onPlayPause,
    onLeftUp,
    onRightUp,
    enabled,
    allowRepeat,
  });

  // Update refs when callbacks change
  useEffect(() => {
    callbacksRef.current = {
      onKeyDown,
      onKeyUp,
      onLeft,
      onRight,
      onUp,
      onDown,
      onSelect,
      onBack,
      onPlayPause,
      onLeftUp,
      onRightUp,
      enabled,
      allowRepeat,
    };
  }, [onKeyDown, onKeyUp, onLeft, onRight, onUp, onDown, onSelect, onBack, onPlayPause, onLeftUp, onRightUp, enabled, allowRepeat]);

  // Sync allowRepeat state to native module for native-level blocking
  useEffect(() => {
    if (!isTV || Platform.OS !== 'android') return;
    const { TVKeyEvent } = NativeModules;
    if (TVKeyEvent?.setAllowRepeat) {
      TVKeyEvent.setAllowRepeat(allowRepeat);
    }
    return () => {
      // Reset to false when component unmounts
      if (TVKeyEvent?.setAllowRepeat) {
        TVKeyEvent.setAllowRepeat(false);
      }
    };
  }, [isTV, allowRepeat]);

  useEffect(() => {
    if (!isTV || Platform.OS !== 'android') {
      return;
    }

    const { TVKeyEvent } = NativeModules;
    if (!TVKeyEvent) {
      return;
    }

    const handleKeyEvent = (event: TVKeyEvent) => {
      const callbacks = callbacksRef.current;
      if (!callbacks.enabled) return;

      const { key, action, repeatCount } = event;

      // Block repeat events unless explicitly allowed (e.g., for player seeking)
      if (!callbacks.allowRepeat && repeatCount > 0) {
        return;
      }

      const now = Date.now();
      const eventKey = `${key}-${action}`;

      // Use shorter debounce for left/right (seeking), longer for others
      // Skip debounce if allowRepeat is true (player handles its own timing)
      const debounceMs = callbacks.allowRepeat ? 0 :
        (key === 'left' || key === 'right') ? DEBOUNCE_MS_SEEK : DEBOUNCE_MS_DEFAULT;

      // Debounce rapid key presses
      if (debounceMs > 0 && now - (lastEventTime.current[eventKey] || 0) < debounceMs) {
        return;
      }
      lastEventTime.current[eventKey] = now;

      if (action === 'down') {
        callbacks.onKeyDown?.(key);

        // Call specific handlers
        switch (key) {
          case 'left':
            callbacks.onLeft?.();
            break;
          case 'right':
            callbacks.onRight?.();
            break;
          case 'up':
            callbacks.onUp?.();
            break;
          case 'down':
            callbacks.onDown?.();
            break;
          case 'select':
            callbacks.onSelect?.();
            break;
          case 'back':
            callbacks.onBack?.();
            break;
          case 'playPause':
            callbacks.onPlayPause?.();
            break;
        }
      } else if (action === 'up') {
        callbacks.onKeyUp?.(key);

        // Call specific key up handlers for left/right (for seeking)
        switch (key) {
          case 'left':
            callbacks.onLeftUp?.();
            break;
          case 'right':
            callbacks.onRightUp?.();
            break;
        }
      }
    };

    const eventEmitter = new NativeEventEmitter(TVKeyEvent);
    const subscription = eventEmitter.addListener('onTVKeyEvent', handleKeyEvent);

    return () => {
      subscription.remove();
    };
  }, [isTV]); // Only re-subscribe when isTV changes

  return { isTV };
};

export default useTVKeyEvent;
