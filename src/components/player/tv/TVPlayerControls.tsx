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

  // Seek preview state - accumulates seek offset while user is seeking
  const [seekPreviewOffset, setSeekPreviewOffset] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const seekCommitTimerRef = useRef<NodeJS.Timeout | null>(null);
  const seekPreviewOffsetRef = useRef(0);

  // Keep ref in sync with state
  useEffect(() => {
    seekPreviewOffsetRef.current = seekPreviewOffset;
  }, [seekPreviewOffset]);

  // Refs for focus navigation
  const timelineRef = useRef<FocusableRef>(null);
  const closeRef = useRef<FocusableRef>(null);
  const subtitlesRef = useRef<FocusableRef>(null);
  const audioRef = useRef<FocusableRef>(null);
  const episodesRef = useRef<FocusableRef>(null);

  // Seek interval in seconds
  const SEEK_INTERVAL = 10;
  // Delay before committing seek (ms)
  const SEEK_COMMIT_DELAY = 800;

  // Reset auto-hide timer
  const resetAutoHideTimer = useCallback(() => {
    if (autoHideTimerRef.current) {
      clearTimeout(autoHideTimerRef.current);
      autoHideTimerRef.current = null;
    }
    // Use refs to get current state and avoid stale closures
    if (visibleRef.current) {
      autoHideTimerRef.current = setTimeout(() => {
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

  // Commit the accumulated seek offset (uses ref to avoid stale closure)
  const commitSeek = useCallback(() => {
    const offset = seekPreviewOffsetRef.current;
    if (offset !== 0) {
      onSeek(offset);
    }
    setSeekPreviewOffset(0);
    setIsSeeking(false);
  }, [onSeek]);

  // Add to seek preview and schedule commit
  const addSeekOffset = useCallback((offset: number) => {
    setIsSeeking(true);
    setSeekPreviewOffset(prev => {
      // Calculate the new preview time and clamp it
      const previewTime = currentTime + prev + offset;
      const clampedPreviewTime = Math.max(0, Math.min(previewTime, duration));
      // Return the offset needed to reach the clamped time
      return clampedPreviewTime - currentTime;
    });

    // Clear existing commit timer
    if (seekCommitTimerRef.current) {
      clearTimeout(seekCommitTimerRef.current);
    }

    // Schedule new commit
    seekCommitTimerRef.current = setTimeout(() => {
      commitSeek();
    }, SEEK_COMMIT_DELAY);

    resetAutoHideTimer();
  }, [currentTime, duration, commitSeek, resetAutoHideTimer]);

  // Cleanup seek commit timer on unmount
  useEffect(() => {
    return () => {
      if (seekCommitTimerRef.current) {
        clearTimeout(seekCommitTimerRef.current);
      }
    };
  }, []);

  // Handle TV key events
  // Left/right seek when UI is hidden OR when timeline is focused
  // Up/down show controls when hidden
  // Select toggles playback when hidden
  useTVKeyEvent({
    enabled: true, // Always listen
    onLeft: () => {
      const isVisible = visibleRef.current;
      const isTimelineFocused = timelineFocusedRef.current;
      // Only seek if UI is hidden OR timeline is focused
      if (!isVisible || isTimelineFocused) {
        addSeekOffset(-SEEK_INTERVAL);
      }
      if (isVisible) {
        resetAutoHideTimer();
      }
    },
    onRight: () => {
      const isVisible = visibleRef.current;
      const isTimelineFocused = timelineFocusedRef.current;
      // Only seek if UI is hidden OR timeline is focused
      if (!isVisible || isTimelineFocused) {
        addSeekOffset(SEEK_INTERVAL);
      }
      if (isVisible) {
        resetAutoHideTimer();
      }
    },
    onUp: () => {
      const isVisible = visibleRef.current;
      if (!isVisible) {
        if (!justHiddenRef.current) {
          onShowControlsRef.current?.();
        }
      } else {
        resetAutoHideTimer();
      }
    },
    onDown: () => {
      const isVisible = visibleRef.current;
      if (!isVisible) {
        if (!justHiddenRef.current) {
          onShowControlsRef.current?.();
        }
      } else {
        resetAutoHideTimer();
      }
    },
    onSelect: () => {
      const isVisible = visibleRef.current;
      if (!isVisible) {
        // When hidden, select toggles playback
        onTogglePlayback();
      } else {
        resetAutoHideTimer();
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

  // Calculate progress percentage - show preview position while seeking
  const displayTime = isSeeking ? currentTime + seekPreviewOffset : currentTime;
  const progress = duration > 0 ? (displayTime / duration) * 100 : 0;
  const bufferedProgress = duration > 0 ? buffered * 100 : 0;

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
                  {isSeeking && seekPreviewOffset !== 0 && (
                    <Text style={styles.seekOffsetText}>
                      {` (${seekPreviewOffset > 0 ? '+' : ''}${Math.round(seekPreviewOffset)}s)`}
                    </Text>
                  )}
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
  seekOffsetText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '600',
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
