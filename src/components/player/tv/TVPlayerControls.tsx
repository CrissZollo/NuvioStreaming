import React, { useEffect, useRef, useCallback, useState, memo, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
  BackHandler,
} from 'react-native';
import ReanimatedLib, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  runOnJS,
  interpolate,
  interpolateColor,
  SharedValue,
  withTiming,
} from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Focusable, FocusableRef } from '../../tv/Focusable';
import { useTheme } from '../../../contexts/ThemeContext';
import { useTVKeyEvent } from '../../../hooks/useTVKeyEvent';
import { ExitConfirmationBanner } from './ExitConfirmationBanner';
import { perfMonitor, PERF_MONITOR_ENABLED } from '../../../utils/performanceMonitor';

const AnimatedView = ReanimatedLib.createAnimatedComponent(View);
const AnimatedText = ReanimatedLib.createAnimatedComponent(Text);

// Optimized button component that uses Reanimated shared values for focus styling
// This avoids React state updates on focus/blur which cause lag during rapid navigation
interface TVButtonProps {
  iconName: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onPress: () => void;
  focusableRef?: React.RefObject<FocusableRef | null>;
  onFocusCallback?: () => void; // Called on focus (e.g., to reset auto-hide timer)
}

const TVButton = memo(({ iconName, label, onPress, focusableRef, onFocusCallback }: TVButtonProps) => {
  const internalRef = useRef<FocusableRef | null>(null);
  const actualRef = focusableRef || internalRef;

  // Create local shared value for focus animation
  const focusProgress = useSharedValue(0);

  // Debounce onFocusCallback to avoid rapid timer resets during fast navigation
  const lastFocusCallbackTime = useRef(0);
  const FOCUS_CALLBACK_DEBOUNCE_MS = 200;

  // Sync with Focusable's shared value via onFocus/onBlur
  // Use 165ms (5 frames at 30fps) for smooth animations on low-end TV devices
  const handleFocus = useCallback(() => {
    focusProgress.value = withTiming(1, { duration: 165 });
    // Debounced callback
    if (onFocusCallback) {
      const now = Date.now();
      if (now - lastFocusCallbackTime.current >= FOCUS_CALLBACK_DEBOUNCE_MS) {
        lastFocusCallbackTime.current = now;
        onFocusCallback();
      }
    }
  }, [focusProgress, onFocusCallback]);

  const handleBlur = useCallback(() => {
    focusProgress.value = withTiming(0, { duration: 165 });
  }, [focusProgress]);

  return (
    <Focusable
      ref={actualRef}
      onPress={onPress}
      onFocus={handleFocus}
      onBlur={handleBlur}
      style={buttonStyles.container}
      borderRadius={8}
      focusScale={1.05}
      animateBackground={false}
      showFocusBorder={true}
    >
      <View style={buttonStyles.iconContainer}>
        <MaterialIcons name={iconName} size={12} color="white" />
      </View>
      <Text style={buttonStyles.text}>
        {label}
      </Text>
    </Focusable>
  );
});

TVButton.displayName = 'TVButton';

const buttonStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginHorizontal: 4,
    minWidth: 60,
  },
  iconContainer: {
    width: 12,
    height: 12,
    marginRight: 4,
  },
  text: {
    fontSize: 8,
    fontWeight: '500',
    color: 'white',
  },
});

interface TVPlayerControlsProps {
  /** Whether controls are currently visible */
  visible: boolean;
  /** Whether video is paused */
  paused: boolean;
  /** Set paused state */
  setPaused?: (paused: boolean) => void;
  /** Current playback position in seconds */
  currentTime: number;
  /** Total video duration in seconds */
  duration: number;
  /** Video title */
  title: string;
  /** Episode title (for series) */
  episodeTitle?: string;
  /** Season number (for series) */
  season?: number;
  /** Episode number (for series) */
  episode?: number;
  /** Toggle play/pause */
  onTogglePlayback: () => void;
  /** Seek to specific time (optional - currently unused) */
  onSeekTo?: (seconds: number) => void;
  /** Seek by seconds (positive = forward, negative = backward) */
  onSeek: (seconds: number) => void;
  /** Close the player */
  onClose: () => void;
  /** Show controls */
  onShowControls: () => void;
  /** Show subtitle modal */
  onShowSubtitles?: () => void;
  /** Show audio tracks modal */
  onShowAudioTracks?: () => void;
  /** Show episodes modal */
  onShowEpisodes?: () => void;
  /** Show sources modal */
  onShowSources?: () => void;
  /** Open external player */
  onOpenExternal?: () => void;
  /** Current playback speed */
  playbackSpeed?: number;
  /** Buffered amount (0-1) */
  buffered?: number;
  /** Hide controls callback */
  onHideControls?: () => void;
  /** When true, focus will be restored to the timeline (used after modal closes) */
  restoreFocus?: boolean;
  /** Callback when focus has been restored */
  onFocusRestored?: () => void;
  /** When true, a modal is open and key events should be ignored */
  modalOpen?: boolean;
}

const AUTO_HIDE_DELAY = 3000; // 3 seconds
const EXIT_CONFIRM_TIMEOUT = 5000; // 5 seconds for exit confirmation
const DEBUG_UI = false; // Disabled after debugging

// Performance tracking
const DEBUG_PERF = true; // ENABLED for debugging performance issues
const DEBUG_SEEK = true; // ENABLED for debugging seek operations
let tvControlsRenderCount = 0;
let lastSeekLogTime = 0;

// Module-level variable to track if seeking is active
// This is used by the memo comparison function which can't access component state
let isCurrentlySeeking = false;

/**
 * TV-optimized player controls with remote control support
 * Minimal design: timeline + bottom action buttons
 * - D-pad shows controls when hidden
 * - OK/Select always toggles play/pause
 * - Left/right on timeline seeks
 */
const TVPlayerControlsInner: React.FC<TVPlayerControlsProps> = ({
  visible,
  paused,
  setPaused,
  currentTime,
  duration,
  title,
  episodeTitle,
  season,
  episode,
  onTogglePlayback,
  onSeekTo,
  onSeek,
  onClose,
  onShowControls,
  onHideControls,
  onShowSubtitles,
  onShowAudioTracks,
  onShowEpisodes,
  onShowSources,
  onOpenExternal,
  playbackSpeed = 1,
  buffered = 0,
  restoreFocus = false,
  onFocusRestored,
  modalOpen = false,
}) => {
  const renderStartTime = PERF_MONITOR_ENABLED ? performance.now() : 0;
  tvControlsRenderCount++;
  if (DEBUG_PERF) {
    console.log(`[TVPlayerControls] RENDER START #${tvControlsRenderCount} visible=${visible} modalOpen=${modalOpen} paused=${paused}`);
  }

  const { currentTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const autoHideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [timelineFocused, setTimelineFocused] = useState(false);

  // Exit confirmation state
  const [exitConfirmVisible, setExitConfirmVisible] = useState(false);
  const exitConfirmVisibleRef = useRef(exitConfirmVisible);
  exitConfirmVisibleRef.current = exitConfirmVisible;

  // Track visible state in ref for use in callbacks
  // Update synchronously during render AND in effect to ensure ref is always current
  const visibleRef = useRef(visible);
  visibleRef.current = visible; // Sync update during render
  useEffect(() => {
    if (DEBUG_UI) console.log('[TVPlayerControls] visible changed:', visible, 'prev:', visibleRef.current);
    visibleRef.current = visible;
  }, [visible]);

  // Track timeline focus state in ref for use in callbacks
  const timelineFocusedRef = useRef(timelineFocused);
  timelineFocusedRef.current = timelineFocused; // Sync update during render
  useEffect(() => {
    timelineFocusedRef.current = timelineFocused;
  }, [timelineFocused]);

  // Store callbacks in refs to avoid stale closures and dependency issues
  const onHideControlsRef = useRef(onHideControls);
  const onShowControlsRef = useRef(onShowControls);
  // Sync update during render for immediate access
  onHideControlsRef.current = onHideControls;
  onShowControlsRef.current = onShowControls;
  useEffect(() => {
    onHideControlsRef.current = onHideControls;
    onShowControlsRef.current = onShowControls;
  }, [onHideControls, onShowControls]);

  // Track if we just hid controls via back button to prevent immediate re-show
  const justHiddenRef = useRef(false);
  const justHiddenTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Track the last time controls were hidden to prevent immediate re-show
  const lastHideTimeRef = useRef<number>(0);

  // Track if focus restoration is in progress to prevent spurious show/hide cycles
  const isRestoringFocusRef = useRef(false);

  // Track if back was already handled by useTVKeyEvent to prevent double-handling
  const backHandledRef = useRef(false);

  // Track if a show/hide action is already in progress to prevent duplicate calls
  const actionInProgressRef = useRef(false);

  // Track modal open state in ref for use in callbacks
  const modalOpenRef = useRef(modalOpen);
  modalOpenRef.current = modalOpen; // Sync update during render
  useEffect(() => {
    if (DEBUG_UI) console.log('[TVPlayerControls] modalOpen changed:', modalOpen);
    modalOpenRef.current = modalOpen;
  }, [modalOpen]);

  // Seeking state - shows visual feedback and preview time during seek
  // We use Reanimated shared values which update on the UI thread directly,
  // bypassing React's batching which blocks rapid state updates
  const seekPreviewTimeRef = useRef<number | null>(null);
  const seekDisplayTimeShared = useSharedValue<number>(currentTime);
  const isSeekingShared = useSharedValue<boolean>(false);

  // Update shared value when currentTime changes (but not during seeking)
  useEffect(() => {
    if (!isSeekingShared.value) {
      seekDisplayTimeShared.value = currentTime;
    }
  }, [currentTime, seekDisplayTimeShared, isSeekingShared]);

  // For compatibility with existing code that reads seekPreviewTime
  const seekPreviewTime = seekPreviewTimeRef.current;

  // Update the shared value directly (called from addToSeekPreview)
  const updateSeekDisplay = useCallback((newTime: number | null) => {
    if (newTime !== null) {
      seekDisplayTimeShared.value = newTime;
      isSeekingShared.value = true;
    } else {
      isSeekingShared.value = false;
      // Let the next currentTime prop update handle the display
    }
  }, [seekDisplayTimeShared, isSeekingShared]);
  // Base time - the position when seeking started (so we accumulate from a fixed point)
  const seekBaseTimeRef = useRef<number | null>(null);
  // Last committed seek position - used to continue from where we left off
  const lastCommittedSeekRef = useRef<number | null>(null);
  const lastCommitTimeRef = useRef<number>(0);
  // Track if we paused during seek so we can resume after
  const wasPausedBeforeSeekRef = useRef<boolean | null>(null);
  // Interval for continuous seeking when holding button
  const seekIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isSeekingRef = useRef(false);

  // Refs for focus navigation
  const timelineRef = useRef<FocusableRef>(null);
  const closeRef = useRef<FocusableRef>(null);
  const subtitlesRef = useRef<FocusableRef>(null);
  const audioRef = useRef<FocusableRef>(null);
  const episodesRef = useRef<FocusableRef>(null);

  // Ref for resetAutoHideTimer callback (defined below) so it can be used in effects
  const resetAutoHideTimerRef = useRef<() => void>(() => {});

  // Handle focus restoration (e.g., after modal closes)
  useEffect(() => {
    if (DEBUG_UI) console.log('[TVPlayerControls] Focus restoration effect - restoreFocus:', restoreFocus, 'visible:', visible);
    if (restoreFocus && visible) {
      if (DEBUG_UI) console.log('[TVPlayerControls] Restoring focus - setting isRestoringFocusRef=true');
      // Set flag to prevent spurious show/hide during restoration
      isRestoringFocusRef.current = true;

      // Focus the timeline
      if (timelineRef.current) {
        if (DEBUG_UI) console.log('[TVPlayerControls] Focusing timeline');
        timelineRef.current.focus();
      }

      // Reset auto-hide timer so controls stay visible for the full duration
      resetAutoHideTimerRef.current();

      // Clear the restoration flag after a short delay
      setTimeout(() => {
        if (DEBUG_UI) console.log('[TVPlayerControls] Clearing isRestoringFocusRef');
        isRestoringFocusRef.current = false;
      }, 100);

      onFocusRestored?.();
    }
  }, [restoreFocus, visible, onFocusRestored]);

  // Seek interval in seconds
  const SEEK_INTERVAL = 10;
  // How often to repeat seek when holding (ms)
  const SEEK_REPEAT_INTERVAL = 200;

  // Reset auto-hide timer
  const resetAutoHideTimer = useCallback(() => {
    if (DEBUG_UI) console.log('[TVPlayerControls] resetAutoHideTimer called, visible:', visibleRef.current);
    if (autoHideTimerRef.current) {
      clearTimeout(autoHideTimerRef.current);
      autoHideTimerRef.current = null;
    }
    // Use refs to get current state and avoid stale closures
    if (visibleRef.current) {
      if (DEBUG_UI) console.log('[TVPlayerControls] Starting auto-hide timer (', AUTO_HIDE_DELAY, 'ms)');
      autoHideTimerRef.current = setTimeout(() => {
        // Don't hide if currently seeking, restoring focus, or modal is open
        if (seekPreviewTimeRef.current !== null || isRestoringFocusRef.current || modalOpenRef.current) {
          if (DEBUG_UI) console.log('[TVPlayerControls] Auto-hide blocked - seeking:', seekPreviewTimeRef.current !== null, 'restoring:', isRestoringFocusRef.current, 'modal:', modalOpenRef.current);
          return;
        }

        if (DEBUG_UI) console.log('[TVPlayerControls] Auto-hide timer fired - setting lastHideTime, calling onHideControls');
        // Record the hide time for debouncing
        lastHideTimeRef.current = Date.now();
        // Set justHiddenRef BEFORE calling onHideControls to prevent immediate re-show from focus events
        justHiddenRef.current = true;
        if (justHiddenTimerRef.current) {
          clearTimeout(justHiddenTimerRef.current);
        }
        // Short timeout (200ms) - timestamp check is primary mechanism now
        justHiddenTimerRef.current = setTimeout(() => {
          if (DEBUG_UI) console.log('[TVPlayerControls] justHiddenRef cleared');
          justHiddenRef.current = false;
        }, 200);

        onHideControlsRef.current?.();
      }, AUTO_HIDE_DELAY);
    }
  }, []); // No dependencies - uses refs

  // Keep ref updated for use in effects that need to call resetAutoHideTimer
  useEffect(() => {
    resetAutoHideTimerRef.current = resetAutoHideTimer;
  }, [resetAutoHideTimer]);

  // Store duration in ref for use in interval callback
  const durationRef = useRef(duration);
  durationRef.current = duration;

  // Store currentTime in ref for initial seek position
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;

  // Store onSeek in ref for use in callbacks
  const onSeekRef = useRef(onSeek);
  onSeekRef.current = onSeek;

  // Timer to auto-commit seek after no key events for a while
  const seekCommitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const SEEK_COMMIT_DELAY = 600; // Commit seek 600ms after last key press (increased for key repeat gaps)

  // Throttle rapid key events - TV remotes often send 30+ events per second when held
  // At 30fps target, process at most 1 key event per 100ms (10 fps for seek updates)
  const lastSeekKeyTimeRef = useRef<number>(0);
  const SEEK_KEY_THROTTLE_MS = 100; // Only process 1 key event per 100ms (10 fps max)

  // Ref to hold commitSeek so addToSeekPreview can call it without circular dependency
  const commitSeekRef = useRef<() => void>(() => {});

  // Commit the seek to the preview position
  const commitSeek = useCallback(() => {
    const previewTime = seekPreviewTimeRef.current;
    const baseTime = seekBaseTimeRef.current;
    const commitStartTime = performance.now();

    if (DEBUG_SEEK) {
      console.log(`[TVPlayerControls] COMMIT_SEEK START previewTime=${previewTime?.toFixed(2)} baseTime=${baseTime?.toFixed(2)}`);
    }

    if (previewTime !== null && baseTime !== null) {
      // Save the committed position for potential follow-up seeks
      lastCommittedSeekRef.current = previewTime;
      lastCommitTimeRef.current = Date.now();

      // Calculate total offset from where we started
      const totalOffset = previewTime - baseTime;

      if (totalOffset !== 0) {
        if (DEBUG_SEEK) {
          console.log(`[TVPlayerControls] COMMIT_SEEK calling ${onSeekTo ? 'onSeekTo' : 'onSeek'} with ${onSeekTo ? previewTime.toFixed(2) : totalOffset.toFixed(2)}`);
        }
        // Use onSeekTo for absolute positioning if available
        if (onSeekTo) {
          onSeekTo(previewTime);
        } else {
          // Fall back to relative seek from base position
          onSeekRef.current(totalOffset);
        }
      }

      // Resume playback if we paused it during seek
      // Do this after seeking so the video starts from the new position
      if (setPaused && wasPausedBeforeSeekRef.current === false) {
        if (DEBUG_SEEK) {
          console.log(`[TVPlayerControls] COMMIT_SEEK scheduling resume in 150ms`);
        }
        setTimeout(() => {
          if (DEBUG_SEEK) {
            console.log(`[TVPlayerControls] COMMIT_SEEK resuming playback (setPaused=false)`);
          }
          setPaused(false);
        }, 150);
      }
    }

    wasPausedBeforeSeekRef.current = null;

    // Clear seeking state
    isCurrentlySeeking = false;
    seekPreviewTimeRef.current = null;
    seekBaseTimeRef.current = null;
    updateSeekDisplay(null);

    if (DEBUG_SEEK) {
      console.log(`[TVPlayerControls] COMMIT_SEEK END took ${(performance.now() - commitStartTime).toFixed(2)}ms`);
    }
  }, [onSeekTo, setPaused, updateSeekDisplay]);

  // Update ref whenever commitSeek changes
  useEffect(() => {
    commitSeekRef.current = commitSeek;
  }, [commitSeek]);

  // Add to seek preview (called on each key press)
  // CRITICAL: This must update the UI IMMEDIATELY before anything else
  // The function is split into two parts:
  // 1. Synchronous: Calculate and set UI state (instant)
  // 2. Async: Everything else (pause, commit scheduling)
  const addToSeekPreview = useCallback((direction: 'forward' | 'backward') => {
    const keyPressTime = performance.now();
    const now = Date.now();

    // THROTTLE: Skip rapid key events (TV remotes send 30+ events/sec when held)
    // First press is never throttled, subsequent presses are throttled
    const isFirstPress = seekBaseTimeRef.current === null;
    const timeSinceLastKey = now - lastSeekKeyTimeRef.current;
    if (!isFirstPress && timeSinceLastKey < SEEK_KEY_THROTTLE_MS) {
      // Still update the commit timeout so we don't commit early
      if (seekCommitTimeoutRef.current) {
        clearTimeout(seekCommitTimeoutRef.current);
      }
      seekCommitTimeoutRef.current = setTimeout(() => {
        commitSeekRef.current();
      }, SEEK_COMMIT_DELAY);
      return; // Skip this key event
    }
    lastSeekKeyTimeRef.current = now;

    const offset = direction === 'forward' ? SEEK_INTERVAL : -SEEK_INTERVAL;

    if (DEBUG_SEEK) {
      const timeSinceLastLog = keyPressTime - lastSeekLogTime;
      lastSeekLogTime = keyPressTime;
      console.log(`[TVPlayerControls] SEEK_PREVIEW ${direction} isFirstPress=${isFirstPress} timeSinceLastPress=${timeSinceLastLog.toFixed(0)}ms`);
    }

    // ===== PART 1: SYNCHRONOUS - Calculate and update UI =====
    let newPreviewTime: number;
    if (isFirstPress) {
      const timeSinceLastCommit = now - lastCommitTimeRef.current;
      const startPosition = (lastCommittedSeekRef.current !== null && timeSinceLastCommit < 1500)
        ? lastCommittedSeekRef.current
        : currentTimeRef.current;
      seekBaseTimeRef.current = startPosition;
      newPreviewTime = Math.max(0, Math.min(startPosition + offset, durationRef.current));
      if (DEBUG_SEEK) {
        console.log(`[TVPlayerControls] SEEK_PREVIEW first press, startPosition=${startPosition.toFixed(2)}, newPreview=${newPreviewTime.toFixed(2)}`);
      }
    } else {
      newPreviewTime = Math.max(0, Math.min(seekPreviewTimeRef.current! + offset, durationRef.current));
    }

    // Update ref immediately - this is synchronous and always up-to-date
    seekPreviewTimeRef.current = newPreviewTime;
    // Update module-level flag for memo comparison BEFORE any state changes
    // This prevents re-renders from being triggered by setPaused
    isCurrentlySeeking = true;
    // Update the Reanimated shared value directly (updates on UI thread)
    updateSeekDisplay(newPreviewTime);

    const uiUpdateTime = performance.now() - keyPressTime;
    if (DEBUG_SEEK && uiUpdateTime > 5) {
      // Only log slow updates to reduce log spam
      console.log(`[TVPlayerControls] SEEK_PREVIEW slow UI update: ${uiUpdateTime.toFixed(2)}ms`);
    }

    // ===== PART 2: ASYNC - Everything else (runs after React commit) =====
    // Use setImmediate (or setTimeout 0) to run after the current frame
    const asyncWork = () => {
      // Track pause state and pause on first press
      if (isFirstPress && setPaused && wasPausedBeforeSeekRef.current === null) {
        wasPausedBeforeSeekRef.current = paused;
        if (!paused) {
          if (DEBUG_SEEK) {
            console.log(`[TVPlayerControls] SEEK_PREVIEW pausing video for seek`);
          }
          setPaused(true);
        }
      }

      // Clear existing commit timeout
      if (seekCommitTimeoutRef.current) {
        clearTimeout(seekCommitTimeoutRef.current);
        seekCommitTimeoutRef.current = null;
      }

      // Schedule commit after delay (when user stops pressing)
      seekCommitTimeoutRef.current = setTimeout(() => {
        if (DEBUG_SEEK) {
          console.log(`[TVPlayerControls] SEEK_PREVIEW commit timeout fired (${SEEK_COMMIT_DELAY}ms)`);
        }
        commitSeekRef.current();
      }, SEEK_COMMIT_DELAY);
    };

    // Run async work after current execution context
    // setImmediate is more reliable than setTimeout(0) for this purpose
    if (typeof setImmediate !== 'undefined') {
      setImmediate(asyncWork);
    } else {
      setTimeout(asyncWork, 0);
    }
  }, [setPaused, paused, updateSeekDisplay]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (seekIntervalRef.current) {
        clearInterval(seekIntervalRef.current);
      }
      if (seekCommitTimeoutRef.current) {
        clearTimeout(seekCommitTimeoutRef.current);
      }
    };
  }, []);

  // Handle TV key events
  // Left/right: seek only when timeline is focused or UI is hidden
  // Up/down/select: show controls when hidden
  // Select also toggles playback when hidden
  useTVKeyEvent({
    enabled: true, // Always listen
    allowRepeat: true, // Allow holding direction buttons for continuous seeking
    onLeft: () => {
      if (DEBUG_UI) console.log('[TVPlayerControls] onLeft - modal:', modalOpenRef.current, 'visible:', visibleRef.current);
      // Don't process if modal is open
      if (modalOpenRef.current) return;

      // Show UI if hidden (don't block on isRestoringFocusRef - that only affects where focus goes)
      if (!visibleRef.current) {
        if (DEBUG_UI) console.log('[TVPlayerControls] onLeft - showing controls');
        onShowControlsRef.current?.();
        // Seek when UI is hidden
        addToSeekPreview('backward');
      } else if (timelineFocusedRef.current) {
        // Only seek when timeline is focused (not when navigating bottom buttons)
        addToSeekPreview('backward');
      }
      // When bottom buttons are focused, let native focus system handle left/right navigation
    },
    onRight: () => {
      if (DEBUG_UI) console.log('[TVPlayerControls] onRight - modal:', modalOpenRef.current, 'visible:', visibleRef.current);
      // Don't process if modal is open
      if (modalOpenRef.current) return;

      // Show UI if hidden (don't block on isRestoringFocusRef - that only affects where focus goes)
      if (!visibleRef.current) {
        if (DEBUG_UI) console.log('[TVPlayerControls] onRight - showing controls');
        onShowControlsRef.current?.();
        // Seek when UI is hidden
        addToSeekPreview('forward');
      } else if (timelineFocusedRef.current) {
        // Only seek when timeline is focused (not when navigating bottom buttons)
        addToSeekPreview('forward');
      }
      // When bottom buttons are focused, let native focus system handle left/right navigation
    },
    onUp: () => {
      if (DEBUG_UI) console.log('[TVPlayerControls] onUp - modal:', modalOpenRef.current, 'visible:', visibleRef.current);
      // Don't process if modal is open
      if (modalOpenRef.current) return;

      if (!visibleRef.current) {
        if (DEBUG_UI) console.log('[TVPlayerControls] onUp - showing controls');
        onShowControlsRef.current?.();
      }
      // Only reset timer if visible and not seeking
      if (visibleRef.current && seekPreviewTimeRef.current === null) {
        resetAutoHideTimer();
      }
    },
    onDown: () => {
      if (DEBUG_UI) console.log('[TVPlayerControls] onDown - modal:', modalOpenRef.current, 'visible:', visibleRef.current);
      // Don't process if modal is open
      if (modalOpenRef.current) return;

      if (!visibleRef.current) {
        if (DEBUG_UI) console.log('[TVPlayerControls] onDown - showing controls');
        onShowControlsRef.current?.();
      }
      // Only reset timer if visible and not seeking
      if (visibleRef.current && seekPreviewTimeRef.current === null) {
        resetAutoHideTimer();
      }
    },
    onSelect: () => {
      if (DEBUG_UI) console.log('[TVPlayerControls] onSelect - modal:', modalOpenRef.current, 'visible:', visibleRef.current);
      // Don't process if modal is open
      if (modalOpenRef.current) return;

      if (!visibleRef.current) {
        // When hidden, show UI and toggle playback
        if (DEBUG_UI) console.log('[TVPlayerControls] onSelect - showing controls');
        onShowControlsRef.current?.();
        onTogglePlayback();
      } else {
        // When visible, just reset timer (don't toggle during seeking)
        if (seekPreviewTimeRef.current === null) {
          resetAutoHideTimer();
        }
      }
    },
    onBack: () => {
      if (DEBUG_UI) console.log('[TVPlayerControls] onBack - modal:', modalOpenRef.current, 'visible:', visibleRef.current, 'exitConfirm:', exitConfirmVisibleRef.current);
      // If a modal is open, don't handle here - let the modal's BackHandler handle it
      if (modalOpenRef.current) return;

      // Set flag to prevent BackHandler from also handling this event
      backHandledRef.current = true;
      setTimeout(() => {
        backHandledRef.current = false;
      }, 100);

      if (visibleRef.current) {
        // If controls are visible, hide them
        if (DEBUG_UI) console.log('[TVPlayerControls] onBack - hiding controls');
        lastHideTimeRef.current = Date.now();
        justHiddenRef.current = true;
        if (justHiddenTimerRef.current) {
          clearTimeout(justHiddenTimerRef.current);
        }
        justHiddenTimerRef.current = setTimeout(() => {
          justHiddenRef.current = false;
        }, 200);
        onHideControlsRef.current?.();
      } else {
        // Controls are hidden - handle exit confirmation flow
        if (exitConfirmVisibleRef.current) {
          // Exit confirmation is showing and back pressed again - exit player
          if (DEBUG_UI) console.log('[TVPlayerControls] onBack - confirming exit');
          setExitConfirmVisible(false);
          onClose();
        } else {
          // Show exit confirmation banner
          if (DEBUG_UI) console.log('[TVPlayerControls] onBack - showing exit confirmation');
          setExitConfirmVisible(true);
        }
      }
    },
  });

  // Start/reset auto-hide timer when controls become visible
  useEffect(() => {
    if (DEBUG_UI) console.log('[TVPlayerControls] visible effect triggered, visible:', visible);
    if (visible) {
      // Clear any existing timer first
      if (autoHideTimerRef.current) {
        if (DEBUG_UI) console.log('[TVPlayerControls] Clearing existing auto-hide timer');
        clearTimeout(autoHideTimerRef.current);
      }
      // Start new auto-hide timer
      if (DEBUG_UI) console.log('[TVPlayerControls] Starting auto-hide timer from visible effect');
      autoHideTimerRef.current = setTimeout(() => {
        // Don't hide if currently seeking, restoring focus, or modal is open
        if (seekPreviewTimeRef.current !== null || isRestoringFocusRef.current || modalOpenRef.current) {
          if (DEBUG_UI) console.log('[TVPlayerControls] visible effect auto-hide blocked - seeking:', seekPreviewTimeRef.current !== null, 'restoring:', isRestoringFocusRef.current, 'modal:', modalOpenRef.current);
          return;
        }

        if (DEBUG_UI) console.log('[TVPlayerControls] visible effect auto-hide fired - setting lastHideTime, calling onHideControls');
        // Record the hide time for debouncing
        lastHideTimeRef.current = Date.now();
        // Set justHiddenRef BEFORE calling onHideControls to prevent immediate re-show from focus events
        justHiddenRef.current = true;
        if (justHiddenTimerRef.current) {
          clearTimeout(justHiddenTimerRef.current);
        }
        // Short timeout (200ms) - timestamp check is primary mechanism now
        justHiddenTimerRef.current = setTimeout(() => {
          if (DEBUG_UI) console.log('[TVPlayerControls] justHiddenRef cleared (from visible effect)');
          justHiddenRef.current = false;
        }, 200);

        onHideControlsRef.current?.();
      }, AUTO_HIDE_DELAY);
    } else {
      // Controls hidden - clear timer
      if (autoHideTimerRef.current) {
        if (DEBUG_UI) console.log('[TVPlayerControls] Controls hidden - clearing timer');
        clearTimeout(autoHideTimerRef.current);
        autoHideTimerRef.current = null;
      }
    }
    return () => {
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
      }
    };
  }, [visible]); // Only depend on visible - use ref for callback

  // Animate controls visibility - fast fade for responsive feel
  useEffect(() => {
    Animated.timing(opacityAnim, {
      toValue: visible ? 1 : 0,
      duration: 100, // Reduced from 200ms for faster response
      useNativeDriver: true,
    }).start();
  }, [visible, opacityAnim]);

  // Handle back button via BackHandler (fallback, useTVKeyEvent.onBack is primary)
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // If already handled by useTVKeyEvent.onBack, skip
      if (backHandledRef.current) {
        if (DEBUG_UI) console.log('[TVPlayerControls] BackHandler - already handled by useTVKeyEvent');
        return true; // Consume the event to prevent default behavior
      }

      const isVisible = visibleRef.current;
      const isModalOpen = modalOpenRef.current;
      const isExitConfirmVisible = exitConfirmVisibleRef.current;
      if (DEBUG_UI) console.log('[TVPlayerControls] BackHandler pressed - visible:', isVisible, 'modal:', isModalOpen, 'exitConfirm:', isExitConfirmVisible);

      // If a modal is open, let the modal's BackHandler handle it
      if (isModalOpen) {
        if (DEBUG_UI) console.log('[TVPlayerControls] BackHandler - modal open, letting modal handle it');
        return false; // Let the event propagate to modal's BackHandler
      }

      if (isVisible) {
        // If controls are visible, hide them
        // Set flag to prevent immediate re-show from focus/key events
        if (DEBUG_UI) console.log('[TVPlayerControls] BackHandler - hiding controls, setting lastHideTime');
        lastHideTimeRef.current = Date.now();
        justHiddenRef.current = true;
        if (justHiddenTimerRef.current) {
          clearTimeout(justHiddenTimerRef.current);
        }
        // Short timeout (200ms) - timestamp check is primary mechanism now
        justHiddenTimerRef.current = setTimeout(() => {
          if (DEBUG_UI) console.log('[TVPlayerControls] BackHandler - justHiddenRef cleared');
          justHiddenRef.current = false;
        }, 200);

        onHideControlsRef.current?.();
        return true;
      } else {
        // Controls are hidden - handle exit confirmation flow
        if (isExitConfirmVisible) {
          // Exit confirmation is showing and back pressed again - exit player
          if (DEBUG_UI) console.log('[TVPlayerControls] BackHandler - confirming exit');
          setExitConfirmVisible(false);
          onClose();
        } else {
          // Show exit confirmation banner
          if (DEBUG_UI) console.log('[TVPlayerControls] BackHandler - showing exit confirmation');
          setExitConfirmVisible(true);
        }
        return true;
      }
    });

    return () => {
      backHandler.remove();
      // Don't clear justHiddenTimerRef here - let it complete naturally
      // to ensure justHiddenRef gets reset even if component re-renders
    };
  }, []); // No dependencies - uses refs for callbacks

  // Handle timeline press - toggle playback
  const handleTimelinePress = useCallback(() => {
    onTogglePlayback();
    resetAutoHideTimer();
  }, [onTogglePlayback, resetAutoHideTimer]);

  // Format time display
  const formatTime = useCallback((seconds: number): string => {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  }, []);

  // Store duration in shared value for animated calculations
  const durationShared = useSharedValue(duration);
  useEffect(() => {
    durationShared.value = duration;
  }, [duration, durationShared]);

  // Calculate progress using derived value (runs on UI thread)
  const progressShared = useDerivedValue(() => {
    'worklet';
    const dur = durationShared.value;
    if (dur <= 0) return 0;
    return (seekDisplayTimeShared.value / dur) * 100;
  });

  // Animated style for progress bar fill
  const progressFillStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      width: `${progressShared.value}%`,
    };
  });

  // Animated style for progress thumb
  const progressThumbStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      left: `${progressShared.value}%`,
    };
  });

  // State for time text display - ONLY updated when seeking commits, not during preview
  // This prevents re-renders during rapid seeking
  const [displayTimeState, setDisplayTimeState] = useState(currentTime);
  const lastDisplayUpdateRef = useRef(0);
  const DISPLAY_UPDATE_INTERVAL_MS = 500; // Only update display text every 500ms max

  // Update display time state - heavily throttled to prevent re-renders during seeking
  const updateDisplayTimeJS = useCallback((time: number) => {
    const now = Date.now();
    // Only update if enough time has passed
    if (now - lastDisplayUpdateRef.current >= DISPLAY_UPDATE_INTERVAL_MS) {
      lastDisplayUpdateRef.current = now;
      setDisplayTimeState(time);
    }
  }, []);

  // Sync shared value changes to React state for text display
  // DISABLED during rapid seeking - we use refs instead
  // Only sync when NOT seeking to keep the displayed time accurate after seek completes
  useDerivedValue(() => {
    'worklet';
    // Only call runOnJS when not actively seeking (checked via module-level variable)
    // This prevents the constant re-renders during seeking
    if (!isCurrentlySeeking) {
      runOnJS(updateDisplayTimeJS)(seekDisplayTimeShared.value);
    }
    return seekDisplayTimeShared.value;
  });

  // For non-animated elements that need the current values
  // Use the ref value during seeking for instant UI updates, state otherwise
  const displayTime = seekPreviewTimeRef.current !== null ? seekPreviewTimeRef.current : displayTimeState;
  const bufferedProgress = duration > 0 ? buffered * 100 : 0;
  const isSeeking = seekPreviewTime !== null;

  // Build title display
  const displayTitle = episodeTitle
    ? `${title} - S${season}E${episode}: ${episodeTitle}`
    : title;

  // Callback to hide exit confirmation banner after timeout
  const handleExitConfirmTimeout = useCallback(() => {
    setExitConfirmVisible(false);
  }, []);

  // When controls are hidden, render a transparent focusable overlay
  // Key events are handled by useTVKeyEvent - no need for onFocus handler
  // (onFocus was causing controls to immediately re-show after hiding)
  if (!visible) {
    if (PERF_MONITOR_ENABLED) {
      const renderTime = performance.now() - renderStartTime;
      perfMonitor.recordRender('TVPlayerControls(hidden)', renderTime);
    }
    return (
      <View style={styles.hiddenOverlay} pointerEvents="box-only">
        <Focusable
          onPress={handleTimelinePress}
          autoFocus
          style={styles.hiddenFocusable}
          borderRadius={0}
          focusScale={1}
          animateBackground={false}
          showFocusBorder={false}
        >
          <View />
        </Focusable>
        {/* Exit confirmation banner - visible when user presses back with controls hidden */}
        <ExitConfirmationBanner
          visible={exitConfirmVisible}
          onTimeout={handleExitConfirmTimeout}
          timeoutDuration={EXIT_CONFIRM_TIMEOUT}
        />
      </View>
    );
  }

  if (PERF_MONITOR_ENABLED) {
    const renderTime = performance.now() - renderStartTime;
    perfMonitor.recordRender('TVPlayerControls(visible)', renderTime);
  }

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity: opacityAnim },
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      {/* Top gradient with title */}
      <LinearGradient
        colors={['rgba(0,0,0,0.8)', 'transparent']}
        style={[styles.topGradient, { paddingTop: insets.top + 20 }]}
      >
        <View style={styles.topBar}>
          <View style={styles.titleContainer}>
            <Text style={styles.title} numberOfLines={1}>
              {displayTitle}
            </Text>
            {playbackSpeed !== 1 && (
              <Text style={styles.speedBadge}>{playbackSpeed}x</Text>
            )}
          </View>
        </View>
      </LinearGradient>

      {/* Bottom gradient with progress and controls */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.9)']}
        style={[styles.bottomGradient, { paddingBottom: insets.bottom + 20 }]}
      >
        {/* Focusable Timeline - left/right seeks, shows play state */}
        <Focusable
          ref={timelineRef}
          onFocus={() => {
            setTimelineFocused(true);
            resetAutoHideTimer();
          }}
          onBlur={() => setTimelineFocused(false)}
          onPress={handleTimelinePress}
          autoFocus
          style={styles.timelineContainer}
          borderRadius={8}
          focusScale={1}
          animateBackground={false}
          showFocusBorder={false}
        >
          <View style={styles.timelineContent}>
            {/* Progress section - minimal design */}
            <View style={styles.progressSection}>
              <View style={[
                styles.progressBarContainer,
                timelineFocused && styles.progressBarFocused,
              ]}>
                {/* Buffered progress */}
                <View
                  style={[
                    styles.progressBuffered,
                    { width: `${bufferedProgress}%` },
                  ]}
                />
                {/* Current progress - uses Reanimated for smooth seeking updates */}
                <AnimatedView
                  style={[
                    styles.progressFill,
                    { backgroundColor: currentTheme.colors.primary },
                    progressFillStyle,
                  ]}
                />
                {/* Progress thumb - uses Reanimated for smooth seeking updates */}
                <AnimatedView
                  style={[
                    styles.progressThumb,
                    {
                      backgroundColor: timelineFocused ? 'white' : currentTheme.colors.primary,
                      transform: [{ scale: timelineFocused ? 1.5 : 1 }],
                    },
                    progressThumbStyle,
                  ]}
                />
              </View>
              <View style={styles.timeRow}>
                <Text style={[styles.timeText, isSeeking && styles.timeTextSeeking]}>
                  {formatTime(displayTime)}
                </Text>
                <Text style={styles.timeText}>{formatTime(duration)}</Text>
              </View>
            </View>
          </View>
        </Focusable>

        {/* Bottom buttons - using optimized TVButton to avoid React state updates on focus */}
        <View style={styles.bottomButtons}>
          {onShowSubtitles && (
            <TVButton
              focusableRef={subtitlesRef}
              iconName="subtitles"
              label="Subtitles"
              onPress={onShowSubtitles}
              onFocusCallback={resetAutoHideTimer}
            />
          )}

          {onShowAudioTracks && (
            <TVButton
              focusableRef={audioRef}
              iconName="audiotrack"
              label="Audio"
              onPress={onShowAudioTracks}
              onFocusCallback={resetAutoHideTimer}
            />
          )}

          {onShowSources && (
            <TVButton
              iconName="cloud"
              label="Sources"
              onPress={onShowSources}
              onFocusCallback={resetAutoHideTimer}
            />
          )}

          {onOpenExternal && (
            <TVButton
              iconName="open-in-new"
              label="External"
              onPress={onOpenExternal}
              onFocusCallback={resetAutoHideTimer}
            />
          )}

          {onShowEpisodes && (
            <TVButton
              focusableRef={episodesRef}
              iconName="playlist-play"
              label="Episodes"
              onPress={onShowEpisodes}
              onFocusCallback={resetAutoHideTimer}
            />
          )}

          <TVButton
            focusableRef={closeRef}
            iconName="close"
            label="Exit"
            onPress={onClose}
            onFocusCallback={resetAutoHideTimer}
          />
        </View>
      </LinearGradient>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  hiddenOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    backgroundColor: 'transparent',
  },
  hiddenFocusable: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 40,
    paddingBottom: 60,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    color: 'white',
    fontSize: 24,
    fontWeight: '600',
    flex: 1,
  },
  speedBadge: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 12,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 40,
    paddingTop: 80,
  },
  timelineContainer: {
    paddingVertical: 6,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    marginBottom: 10,
  },
  timelineContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressSection: {
    flex: 1,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timeText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '500',
  },
  timeTextSeeking: {
    color: 'white',
    fontWeight: '700',
  },
  progressBarContainer: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 1.5,
    position: 'relative',
    overflow: 'visible',
  },
  progressBarFocused: {
    height: 4,
    borderRadius: 2,
  },
  progressBuffered: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 1.5,
  },
  progressFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    borderRadius: 1.5,
  },
  progressThumb: {
    position: 'absolute',
    top: -2.5,
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: -4,
  },
  bottomButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  bottomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    gap: 5,
  },
  bottomButtonText: {
    color: 'white',
    fontSize: 8,
    fontWeight: '500',
  },
  bottomButtonTextFocused: {
    color: '#000',
  },
});

// Custom memo comparison to prevent re-renders during playback when controls are hidden
// The key insight: when controls are hidden, we don't need to update the time display
// When visible, we need updates but can throttle to ~1 second intervals
let lastRenderTime = 0;
const RENDER_THROTTLE_MS = 1000; // Only re-render for time changes once per second

export const TVPlayerControls = memo(TVPlayerControlsInner, (prevProps, nextProps) => {
  // Always re-render if visibility changes
  if (prevProps.visible !== nextProps.visible) return false;

  // Skip paused state changes during seeking - we use Reanimated shared values
  // for the seek preview display, so we don't need React to re-render
  if (prevProps.paused !== nextProps.paused) {
    // Only re-render for paused changes when NOT seeking
    // During seeking, the play/pause icon isn't visible anyway
    if (!isCurrentlySeeking) {
      return false;
    }
    // During seeking, skip re-render for paused changes
    if (DEBUG_PERF) {
      console.log(`[TVPlayerControls] MEMO skipping paused change during seeking (${prevProps.paused} -> ${nextProps.paused})`);
    }
  }

  // Always re-render if modal state changes
  if (prevProps.modalOpen !== nextProps.modalOpen) return false;

  // Always re-render if restoreFocus changes
  if (prevProps.restoreFocus !== nextProps.restoreFocus) return false;

  // Re-render if duration changes (but not time)
  if (prevProps.duration !== nextProps.duration) return false;

  // Re-render if buffered changes significantly (>5%)
  const bufferedDiff = Math.abs((prevProps.buffered || 0) - (nextProps.buffered || 0));
  if (bufferedDiff > 0.05) return false;

  // Re-render if title/episode info changes
  if (prevProps.title !== nextProps.title ||
      prevProps.episodeTitle !== nextProps.episodeTitle ||
      prevProps.season !== nextProps.season ||
      prevProps.episode !== nextProps.episode) return false;

  // Re-render if playback speed changes
  if (prevProps.playbackSpeed !== nextProps.playbackSpeed) return false;

  // Re-render if callbacks change (they shouldn't with proper memoization, but check anyway)
  // CRITICAL: If this returns false for callback changes, it means callbacks are being
  // recreated unnecessarily in the parent component and causing re-renders
  if (prevProps.onTogglePlayback !== nextProps.onTogglePlayback ||
      prevProps.onClose !== nextProps.onClose ||
      prevProps.onShowControls !== nextProps.onShowControls ||
      prevProps.onHideControls !== nextProps.onHideControls ||
      prevProps.onSeek !== nextProps.onSeek ||
      prevProps.onSeekTo !== nextProps.onSeekTo ||
      prevProps.onShowSubtitles !== nextProps.onShowSubtitles ||
      prevProps.onShowAudioTracks !== nextProps.onShowAudioTracks ||
      prevProps.onShowSources !== nextProps.onShowSources ||
      prevProps.onShowEpisodes !== nextProps.onShowEpisodes ||
      prevProps.onOpenExternal !== nextProps.onOpenExternal ||
      prevProps.onFocusRestored !== nextProps.onFocusRestored) {
    if (DEBUG_PERF) {
      // Log which callback changed for debugging
      const changedCallbacks: string[] = [];
      if (prevProps.onTogglePlayback !== nextProps.onTogglePlayback) changedCallbacks.push('onTogglePlayback');
      if (prevProps.onClose !== nextProps.onClose) changedCallbacks.push('onClose');
      if (prevProps.onShowControls !== nextProps.onShowControls) changedCallbacks.push('onShowControls');
      if (prevProps.onHideControls !== nextProps.onHideControls) changedCallbacks.push('onHideControls');
      if (prevProps.onSeek !== nextProps.onSeek) changedCallbacks.push('onSeek');
      if (prevProps.onSeekTo !== nextProps.onSeekTo) changedCallbacks.push('onSeekTo');
      if (prevProps.onShowSubtitles !== nextProps.onShowSubtitles) changedCallbacks.push('onShowSubtitles');
      if (prevProps.onShowAudioTracks !== nextProps.onShowAudioTracks) changedCallbacks.push('onShowAudioTracks');
      if (prevProps.onShowSources !== nextProps.onShowSources) changedCallbacks.push('onShowSources');
      if (prevProps.onShowEpisodes !== nextProps.onShowEpisodes) changedCallbacks.push('onShowEpisodes');
      if (prevProps.onOpenExternal !== nextProps.onOpenExternal) changedCallbacks.push('onOpenExternal');
      if (prevProps.onFocusRestored !== nextProps.onFocusRestored) changedCallbacks.push('onFocusRestored');
      console.log(`[TVPlayerControls] MEMO callback changed: ${changedCallbacks.join(', ')}`);
    }
    return false;
  }

  // Handle currentTime changes:
  // - If controls are hidden, skip re-render entirely (time not visible)
  // - If seeking is active, SKIP re-render (Reanimated handles display updates)
  // - If controls are visible and not seeking, throttle to once per second
  if (prevProps.currentTime !== nextProps.currentTime) {
    // If controls are hidden, skip re-render for time changes
    if (!nextProps.visible) {
      return true; // Skip re-render
    }

    // If currently seeking, SKIP re-render - Reanimated shared values handle the display
    // This is critical for performance during rapid seeking
    if (isCurrentlySeeking) {
      if (DEBUG_PERF) {
        console.log(`[TVPlayerControls] MEMO skipping currentTime change during seeking`);
      }
      return true; // Skip re-render
    }

    // Throttle time updates to once per second when visible
    const now = Date.now();
    if (now - lastRenderTime < RENDER_THROTTLE_MS) {
      return true; // Skip re-render
    }
    lastRenderTime = now;
    return false; // Re-render
  }

  return true; // Props are equal, skip re-render
});

export default TVPlayerControls;
