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
  enabled?: boolean;
}

const DEBOUNCE_MS = 150;

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
    enabled = true,
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
    enabled,
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
      enabled,
    };
  }, [onKeyDown, onKeyUp, onLeft, onRight, onUp, onDown, onSelect, onBack, onPlayPause, enabled]);

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

      const { key, action } = event;
      const now = Date.now();
      const eventKey = `${key}-${action}`;

      // Debounce rapid key presses
      if (now - (lastEventTime.current[eventKey] || 0) < DEBOUNCE_MS) {
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
