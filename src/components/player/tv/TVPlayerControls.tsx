import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Focusable } from '../../tv/Focusable';
import { useTVRemoteControls } from '../hooks/useTVRemoteControls';
import { useTheme } from '../../../contexts/ThemeContext';

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
}

/**
 * TV-optimized player controls with remote control support
 * Large, focusable buttons designed for 10-foot UI
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
  onSeek,
  onClose,
  onShowControls,
  onShowSubtitles,
  onShowAudioTracks,
  onShowEpisodes,
  playbackSpeed = 1,
  buffered = 0,
}) => {
  const { currentTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const [controlsFocused, setControlsFocused] = useState(false);

  // Note: Focus navigation is handled automatically by React Native TV
  // Refs are removed as they caused TypeScript issues with FocusableRef type

  // Animate controls visibility
  useEffect(() => {
    Animated.timing(opacityAnim, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [visible, opacityAnim]);

  // Handle TV remote controls
  useTVRemoteControls({
    onPlayPause: onTogglePlayback,
    onSeekForward: (s) => onSeek(s),
    onSeekBackward: (s) => onSeek(-s),
    onBack: onClose,
    onSelect: () => {
      if (!visible) {
        onShowControls();
      } else {
        onTogglePlayback();
      }
    },
    onUp: () => {
      if (!visible) onShowControls();
    },
    onDown: () => {
      if (!visible) onShowControls();
    },
    enabled: true,
  });

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

  // Calculate progress percentage
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedProgress = duration > 0 ? buffered * 100 : 0;

  // Build title display
  const displayTitle = episodeTitle
    ? `${title} - S${season}E${episode}: ${episodeTitle}`
    : title;

  if (!visible) {
    return null;
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

      {/* Center controls */}
      <View style={styles.centerControls}>
        {/* Rewind 10s */}
        <Focusable
          onPress={() => onSeek(-10)}
          style={styles.sideButton}
          borderRadius={40}
        >
          <MaterialIcons name="replay-10" size={48} color="white" />
        </Focusable>

        {/* Play/Pause */}
        <Focusable
          onPress={onTogglePlayback}
          autoFocus
          style={styles.playButton}
          borderRadius={48}
        >
          <MaterialIcons
            name={paused ? 'play-arrow' : 'pause'}
            size={72}
            color="white"
          />
        </Focusable>

        {/* Forward 10s */}
        <Focusable
          onPress={() => onSeek(10)}
          style={styles.sideButton}
          borderRadius={40}
        >
          <MaterialIcons name="forward-10" size={48} color="white" />
        </Focusable>
      </View>

      {/* Bottom gradient with progress and secondary controls */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.8)']}
        style={[styles.bottomGradient, { paddingBottom: insets.bottom + 20 }]}
      >
        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
          <View style={styles.progressBarContainer}>
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
                  backgroundColor: currentTheme.colors.primary,
                },
              ]}
            />
          </View>
          <Text style={styles.timeText}>{formatTime(duration)}</Text>
        </View>

        {/* Secondary controls */}
        <View style={styles.secondaryControls}>
          {onShowSubtitles && (
            <Focusable
              onPress={onShowSubtitles}
              style={styles.secondaryButton}
              borderRadius={8}
            >
              <MaterialIcons name="subtitles" size={28} color="white" />
              <Text style={styles.secondaryButtonText}>Subtitles</Text>
            </Focusable>
          )}

          {onShowAudioTracks && (
            <Focusable
              onPress={onShowAudioTracks}
              style={styles.secondaryButton}
              borderRadius={8}
            >
              <MaterialIcons name="audiotrack" size={28} color="white" />
              <Text style={styles.secondaryButtonText}>Audio</Text>
            </Focusable>
          )}

          {onShowEpisodes && (
            <Focusable
              onPress={onShowEpisodes}
              style={styles.secondaryButton}
              borderRadius={8}
            >
              <MaterialIcons name="playlist-play" size={28} color="white" />
              <Text style={styles.secondaryButtonText}>Episodes</Text>
            </Focusable>
          )}
        </View>
      </LinearGradient>
    </Animated.View>
  );
};

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
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
  centerControls: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    transform: [{ translateY: -48 }],
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 60,
  },
  playButton: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sideButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  timeText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    minWidth: 70,
  },
  progressBarContainer: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
    marginHorizontal: 16,
    position: 'relative',
    overflow: 'visible',
  },
  progressBuffered: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 3,
  },
  progressFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    borderRadius: 3,
  },
  progressThumb: {
    position: 'absolute',
    top: -5,
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: -8,
  },
  secondaryControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    gap: 8,
  },
  secondaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default TVPlayerControls;
