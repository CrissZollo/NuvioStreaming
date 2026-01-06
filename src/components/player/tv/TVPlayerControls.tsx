import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
  BackHandler,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Focusable, FocusableRef } from '../../tv/Focusable';
import { useTheme } from '../../../contexts/ThemeContext';
import { useTVKeyEvent } from '../../../hooks/useTVKeyEvent';

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
  /** Current playback speed */
  playbackSpeed?: number;
  /** Buffered amount (0-1) */
  buffered?: number;
  /** Hide controls callback */
  onHideControls?: () => void;
}

const AUTO_HIDE_DELAY = 3000; // 3 seconds

/**
 * TV-optimized player controls with remote control support
 * Minimal design: timeline + bottom action buttons
 * - D-pad shows controls when hidden
 * - OK/Select always toggles play/pause
 * - Left/right on timeline seeks
 */
export const TVPlayerControls: React.FC<TVPlayerControlsProps> = ({
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
  playbackSpeed = 1,
  buffered = 0,
}) => {
  const { currentTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const autoHideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [timelineFocused, setTimelineFocused] = useState(false);

  // Track visible state in ref for use in callbacks
  const visibleRef = useRef(visible);
  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  // Track timeline focus state in ref for use in callbacks
  const timelineFocusedRef = useRef(timelineFocused);
  useEffect(() => {
    timelineFocusedRef.current = timelineFocused;
  }, [timelineFocused]);

  // Store callbacks in refs to avoid stale closures and dependency issues
  const onHideControlsRef = useRef(onHideControls);
  const onShowControlsRef = useRef(onShowControls);
  useEffect(() => {
    onHideControlsRef.current = onHideControls;
    onShowControlsRef.current = onShowControls;
  }, [onHideControls, onShowControls]);

  // Track if we just hid controls via back button to prevent immediate re-show
  const justHiddenRef = useRef(false);
  const justHiddenTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Seeking state - shows visual feedback and preview time during seek
  const [seekPreviewTime, setSeekPreviewTime] = useState<number | null>(null);
  const seekPreviewTimeRef = useRef<number | null>(null);
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

  // Seek interval in seconds
  const SEEK_INTERVAL = 10;
  // How often to repeat seek when holding (ms)
  const SEEK_REPEAT_INTERVAL = 200;

  // Reset auto-hide timer
  const resetAutoHideTimer = useCallback(() => {
    if (autoHideTimerRef.current) {
      clearTimeout(autoHideTimerRef.current);
      autoHideTimerRef.current = null;
    }
    // Use refs to get current state and avoid stale closures
    if (visibleRef.current) {
      autoHideTimerRef.current = setTimeout(() => {
        // Don't hide if currently seeking
        if (seekPreviewTimeRef.current !== null) {
          return;
        }

        // Set justHiddenRef to prevent immediate re-show from focus events
        justHiddenRef.current = true;
        if (justHiddenTimerRef.current) {
          clearTimeout(justHiddenTimerRef.current);
        }
        justHiddenTimerRef.current = setTimeout(() => {
          justHiddenRef.current = false;
        }, 500);

        onHideControlsRef.current?.();
      }, AUTO_HIDE_DELAY);
    }
  }, []); // No dependencies - uses refs

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
  const SEEK_COMMIT_DELAY = 300; // Commit seek 300ms after last key press

  // Ref to hold commitSeek so addToSeekPreview can call it without circular dependency
  const commitSeekRef = useRef<() => void>(() => {});

  // Commit the seek to the preview position
  const commitSeek = useCallback(() => {
    const previewTime = seekPreviewTimeRef.current;
    const baseTime = seekBaseTimeRef.current;

    if (previewTime !== null && baseTime !== null) {
      // Save the committed position for potential follow-up seeks
      lastCommittedSeekRef.current = previewTime;
      lastCommitTimeRef.current = Date.now();

      // Calculate total offset from where we started
      const totalOffset = previewTime - baseTime;

      if (totalOffset !== 0) {
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
        setTimeout(() => {
          setPaused(false);
        }, 150);
      }
    }

    wasPausedBeforeSeekRef.current = null;

    // Clear seeking state
    setSeekPreviewTime(null);
    seekPreviewTimeRef.current = null;
    seekBaseTimeRef.current = null;
  }, [onSeekTo, setPaused]);

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
    const offset = direction === 'forward' ? SEEK_INTERVAL : -SEEK_INTERVAL;
    const now = Date.now();
    const isFirstPress = seekBaseTimeRef.current === null;

    // ===== PART 1: SYNCHRONOUS - Calculate and update UI =====
    let newPreviewTime: number;
    if (isFirstPress) {
      const timeSinceLastCommit = now - lastCommitTimeRef.current;
      const startPosition = (lastCommittedSeekRef.current !== null && timeSinceLastCommit < 1500)
        ? lastCommittedSeekRef.current
        : currentTimeRef.current;
      seekBaseTimeRef.current = startPosition;
      newPreviewTime = Math.max(0, Math.min(startPosition + offset, durationRef.current));
    } else {
      newPreviewTime = Math.max(0, Math.min(seekPreviewTimeRef.current! + offset, durationRef.current));
    }

    // Update ref immediately
    seekPreviewTimeRef.current = newPreviewTime;
    // Update state immediately - this MUST be the last sync operation
    setSeekPreviewTime(newPreviewTime);

    // ===== PART 2: ASYNC - Everything else (runs after React commit) =====
    // Use setImmediate (or setTimeout 0) to run after the current frame
    const asyncWork = () => {
      // Track pause state and pause on first press
      if (isFirstPress && setPaused && wasPausedBeforeSeekRef.current === null) {
        wasPausedBeforeSeekRef.current = paused;
        if (!paused) {
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
  }, [setPaused, paused]);

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
    onLeft: () => {
      // Show UI if hidden (only if not just hidden)
      if (!visibleRef.current && !justHiddenRef.current) {
        onShowControlsRef.current?.();
        // Seek when UI is hidden
        addToSeekPreview('backward');
      } else if (visibleRef.current && timelineFocusedRef.current) {
        // Only seek when timeline is focused (not when navigating bottom buttons)
        addToSeekPreview('backward');
      }
      // When bottom buttons are focused, let native focus system handle left/right navigation
    },
    onRight: () => {
      // Show UI if hidden (only if not just hidden)
      if (!visibleRef.current && !justHiddenRef.current) {
        onShowControlsRef.current?.();
        // Seek when UI is hidden
        addToSeekPreview('forward');
      } else if (visibleRef.current && timelineFocusedRef.current) {
        // Only seek when timeline is focused (not when navigating bottom buttons)
        addToSeekPreview('forward');
      }
      // When bottom buttons are focused, let native focus system handle left/right navigation
    },
    onUp: () => {
      if (!visibleRef.current && !justHiddenRef.current) {
        onShowControlsRef.current?.();
      }
      // Only reset timer if visible and not seeking
      if (visibleRef.current && seekPreviewTimeRef.current === null) {
        resetAutoHideTimer();
      }
    },
    onDown: () => {
      if (!visibleRef.current && !justHiddenRef.current) {
        onShowControlsRef.current?.();
      }
      // Only reset timer if visible and not seeking
      if (visibleRef.current && seekPreviewTimeRef.current === null) {
        resetAutoHideTimer();
      }
    },
    onSelect: () => {
      if (!visibleRef.current) {
        // When hidden, show UI and toggle playback
        if (!justHiddenRef.current) {
          onShowControlsRef.current?.();
        }
        onTogglePlayback();
      } else {
        // When visible, just reset timer (don't toggle during seeking)
        if (seekPreviewTimeRef.current === null) {
          resetAutoHideTimer();
        }
      }
    },
  });

  // Start/reset auto-hide timer when controls become visible
  useEffect(() => {
    if (visible) {
      // Clear any existing timer first
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
      }
      // Start new auto-hide timer
      autoHideTimerRef.current = setTimeout(() => {
        // Don't hide if currently seeking
        if (seekPreviewTimeRef.current !== null) {
          return;
        }

        // Set justHiddenRef to prevent immediate re-show from focus events
        justHiddenRef.current = true;
        if (justHiddenTimerRef.current) {
          clearTimeout(justHiddenTimerRef.current);
        }
        justHiddenTimerRef.current = setTimeout(() => {
          justHiddenRef.current = false;
        }, 500);

        onHideControlsRef.current?.();
      }, AUTO_HIDE_DELAY);
    } else {
      // Controls hidden - clear timer
      if (autoHideTimerRef.current) {
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

  // Animate controls visibility
  useEffect(() => {
    Animated.timing(opacityAnim, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [visible, opacityAnim]);

  // Handle back button via BackHandler
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      const isVisible = visibleRef.current;
      if (isVisible) {
        // If controls are visible, hide them
        // Set flag to prevent immediate re-show from focus/key events
        justHiddenRef.current = true;
        if (justHiddenTimerRef.current) {
          clearTimeout(justHiddenTimerRef.current);
        }
        // Use longer timeout to ensure all events have settled
        justHiddenTimerRef.current = setTimeout(() => {
          justHiddenRef.current = false;
        }, 500);

        onHideControlsRef.current?.();
        return true;
      } else {
        // If controls are hidden, exit the player
        onClose();
        return true;
      }
    });

    return () => {
      backHandler.remove();
      // Don't clear justHiddenTimerRef here - let it complete naturally
      // to ensure justHiddenRef gets reset even if component re-renders
    };
  }, []); // No dependencies - uses refs for callbacks

  // Handle interaction to show controls (D-pad navigation when hidden)
  const handleOverlayInteraction = useCallback(() => {
    // Don't show controls if we just hid them via back button
    if (!visibleRef.current && !justHiddenRef.current) {
      onShowControlsRef.current?.();
    }
  }, []); // No dependencies - uses refs

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

  // Calculate progress percentage - use preview time when seeking
  const displayTime = seekPreviewTime ?? currentTime;
  const progress = duration > 0 ? (displayTime / duration) * 100 : 0;
  const bufferedProgress = duration > 0 ? buffered * 100 : 0;
  const isSeeking = seekPreviewTime !== null;

  // Build title display
  const displayTitle = episodeTitle
    ? `${title} - S${season}E${episode}: ${episodeTitle}`
    : title;

  // When controls are hidden, render a transparent focusable overlay
  // that captures D-pad events to show controls
  if (!visible) {
    return (
      <View style={styles.hiddenOverlay} pointerEvents="box-only">
        <Focusable
          onPress={handleTimelinePress}
          onFocus={handleOverlayInteraction}
          autoFocus
          style={styles.hiddenFocusable}
          borderRadius={0}
          focusScale={1}
          animateBackground={false}
          showFocusBorder={false}
        >
          <View />
        </Focusable>
      </View>
    );
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
                {/* Current progress */}
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${progress}%`,
                      backgroundColor: currentTheme.colors.primary,
                    },
                  ]}
                />
                {/* Progress thumb */}
                <View
                  style={[
                    styles.progressThumb,
                    {
                      left: `${progress}%`,
                      backgroundColor: timelineFocused ? 'white' : currentTheme.colors.primary,
                      transform: [{ scale: timelineFocused ? 1.5 : 1 }],
                    },
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

        {/* Bottom buttons */}
        <View style={styles.bottomButtons}>
          {onShowSubtitles && (
            <Focusable
              ref={subtitlesRef}
              onPress={onShowSubtitles}
              onFocus={resetAutoHideTimer}
              style={styles.bottomButton}
              borderRadius={8}
              focusScale={1.05}
              animateBackground={true}
              showFocusBorder={true}
              nextFocusUp={timelineRef.current?.getViewRef()}
            >
              {(focused) => (
                <>
                  <MaterialIcons
                    name="subtitles"
                    size={12}
                    color={focused ? '#000' : 'white'}
                  />
                  <Text style={[
                    styles.bottomButtonText,
                    focused && styles.bottomButtonTextFocused
                  ]}>
                    Subtitles
                  </Text>
                </>
              )}
            </Focusable>
          )}

          {onShowAudioTracks && (
            <Focusable
              ref={audioRef}
              onPress={onShowAudioTracks}
              onFocus={resetAutoHideTimer}
              style={styles.bottomButton}
              borderRadius={8}
              focusScale={1.05}
              animateBackground={true}
              showFocusBorder={true}
              nextFocusUp={timelineRef.current?.getViewRef()}
            >
              {(focused) => (
                <>
                  <MaterialIcons
                    name="audiotrack"
                    size={12}
                    color={focused ? '#000' : 'white'}
                  />
                  <Text style={[
                    styles.bottomButtonText,
                    focused && styles.bottomButtonTextFocused
                  ]}>
                    Audio
                  </Text>
                </>
              )}
            </Focusable>
          )}

          {onShowEpisodes && (
            <Focusable
              ref={episodesRef}
              onPress={onShowEpisodes}
              onFocus={resetAutoHideTimer}
              style={styles.bottomButton}
              borderRadius={8}
              focusScale={1.05}
              animateBackground={true}
              showFocusBorder={true}
              nextFocusUp={timelineRef.current?.getViewRef()}
            >
              {(focused) => (
                <>
                  <MaterialIcons
                    name="playlist-play"
                    size={12}
                    color={focused ? '#000' : 'white'}
                  />
                  <Text style={[
                    styles.bottomButtonText,
                    focused && styles.bottomButtonTextFocused
                  ]}>
                    Episodes
                  </Text>
                </>
              )}
            </Focusable>
          )}

          <Focusable
            ref={closeRef}
            onPress={onClose}
            onFocus={resetAutoHideTimer}
            style={styles.bottomButton}
            borderRadius={8}
            focusScale={1.05}
            animateBackground={true}
            showFocusBorder={true}
            nextFocusUp={timelineRef.current?.getViewRef()}
          >
            {(focused) => (
              <>
                <MaterialIcons
                  name="close"
                  size={12}
                  color={focused ? '#000' : 'white'}
                />
                <Text style={[
                  styles.bottomButtonText,
                  focused && styles.bottomButtonTextFocused
                ]}>
                  Exit
                </Text>
              </>
            )}
          </Focusable>
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

export default TVPlayerControls;
