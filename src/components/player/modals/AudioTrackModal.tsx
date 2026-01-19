import React, { useEffect, useCallback, useRef, memo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, useWindowDimensions, StyleSheet, Platform, BackHandler, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { getTrackDisplayName, DEBUG_MODE } from '../utils/playerUtils';

// Debug logging for performance analysis
const DEBUG_AUDIO_MODAL = false; // Disabled after debugging
let audioModalRenderCount = 0;
import { logger } from '../../../utils/logger';
import { useIsTV } from '../../../contexts/TVContext';
import { Focusable } from '../../tv/Focusable';
import { perfMonitor, PERF_MONITOR_ENABLED } from '../../../utils/performanceMonitor';

interface AudioTrack {
  id: number;
  name: string;
  language?: string;
  supported?: boolean;
}

interface AudioTrackModalProps {
  showAudioModal: boolean;
  setShowAudioModal: (show: boolean) => void;
  ksAudioTracks: Array<AudioTrack>;
  selectedAudioTrack: number | null;
  selectAudioTrack: (trackId: number) => void;
  /** Whether track switching is in progress */
  isLoading?: boolean;
  /** Called when modal is closed (for TV focus restoration) */
  onModalClosed?: () => void;
}

export const AudioTrackModal: React.FC<AudioTrackModalProps> = ({
  showAudioModal,
  setShowAudioModal,
  ksAudioTracks,
  selectedAudioTrack,
  selectAudioTrack,
  isLoading = false,
  onModalClosed,
}) => {
  const renderStartTime = PERF_MONITOR_ENABLED ? performance.now() : 0;
  audioModalRenderCount++;
  if (DEBUG_AUDIO_MODAL) {
    console.log(`[AudioTrackModal] RENDER START #${audioModalRenderCount} showAudioModal=${showAudioModal}`);
  }

  const { width, height } = useWindowDimensions();
  const isTVDevice = useIsTV();

  // Size constants matching SubtitleModal aesthetics
  const menuWidth = isTVDevice ? Math.min(width * 0.5, 500) : Math.min(width * 0.9, 420);
  const menuMaxHeight = height * 0.9;

  // Ref for focus trapping - first focusable item
  const firstItemRef = useRef<View>(null);

  // Use useCallback to ensure stable reference for BackHandler
  const handleClose = useCallback(() => {
    setShowAudioModal(false);
    // Call onModalClosed immediately for TV focus restoration
    if (isTVDevice && onModalClosed) {
      onModalClosed();
    }
  }, [setShowAudioModal, isTVDevice, onModalClosed]);

  // Handle Android TV back button to close modal
  useEffect(() => {
    if (!showAudioModal) return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Always close on back press when modal is open
      setShowAudioModal(false);
      if (isTVDevice && onModalClosed) {
        onModalClosed();
      }
      return true; // Prevent default back behavior
    });

    return () => backHandler.remove();
  }, [showAudioModal, setShowAudioModal, isTVDevice, onModalClosed]);

  if (!showAudioModal) {
    if (PERF_MONITOR_ENABLED) {
      perfMonitor.recordRender('AudioTrackModal(hidden)', performance.now() - renderStartTime);
    }
    return null;
  }

  if (PERF_MONITOR_ENABLED) {
    const renderTime = performance.now() - renderStartTime;
    perfMonitor.recordRender('AudioTrackModal(visible)', renderTime);
  }

  return (
    <View style={StyleSheet.absoluteFill} zIndex={9999}>
      {/* Backdrop matching SubtitleModal */}
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={handleClose}
      >
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}
        />
      </TouchableOpacity>

      {/* Center Alignment Container */}
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }} pointerEvents="box-none">
        <Animated.View
          entering={SlideInDown.duration(300)}
          exiting={SlideOutDown.duration(250)}
          style={{
            width: menuWidth,
            maxHeight: menuMaxHeight,
            backgroundColor: 'rgba(15, 15, 15, 0.98)', // Matches SubtitleModal
            borderRadius: 24,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.1)',
            overflow: 'hidden'
          }}
        >
          {/* Header with shared aesthetics */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, position: 'relative' }}>
            <Text style={{ color: 'white', fontSize: 18, fontWeight: '700' }}>Audio Tracks</Text>
            {isLoading && (
              <ActivityIndicator size="small" color="white" />
            )}
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
          >
            <View style={{ gap: 8 }}>
              {ksAudioTracks.map((track, index) => {
                const isSelected = selectedAudioTrack === track.id;
                const isUnsupported = track.supported === false;

                const handleSelect = () => {
                  selectAudioTrack(track.id);
                  handleClose();
                };

                const trackContent = (focused?: boolean) => (
                  <>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {isUnsupported && (
                        <MaterialIcons name="warning" size={16} color={(isSelected || focused) ? '#B45309' : '#F59E0B'} />
                      )}
                      <Text style={{
                        color: isUnsupported
                          ? ((isSelected || focused) ? '#B45309' : '#F59E0B')
                          : ((isSelected || focused) ? 'black' : 'white'),
                        fontWeight: (isSelected || focused) ? '700' : '400',
                        fontSize: isTVDevice ? 18 : 15,
                        flex: 1
                      }}>
                        {getTrackDisplayName(track)}
                      </Text>
                    </View>
                    {isSelected && <MaterialIcons name="check" size={18} color={isUnsupported ? '#B45309' : 'black'} />}
                  </>
                );

                if (isTVDevice) {
                  const isFirst = index === 0;
                  const isLast = index === ksAudioTracks.length - 1;

                  return (
                    <Focusable
                      key={track.id}
                      onPress={handleSelect}
                      autoFocus={isFirst}
                      viewRef={isFirst ? firstItemRef : undefined}
                      blockUp={isFirst}
                      blockDown={isLast}
                      style={{
                        padding: 14,
                        borderRadius: 12,
                        backgroundColor: isSelected ? 'white' : 'rgba(255,255,255,0.05)',
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                      borderRadius={12}
                      focusScale={1.02}
                      animateBackground={true}
                      showFocusBorder={true}
                    >
                      {(focused) => trackContent(focused)}
                    </Focusable>
                  );
                }

                return (
                  <TouchableOpacity
                    key={track.id}
                    onPress={handleSelect}
                    style={{
                      padding: 10,
                      borderRadius: 12,
                      backgroundColor: isSelected ? 'white' : 'rgba(255,255,255,0.05)',
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    {trackContent()}
                  </TouchableOpacity>
                );
              })}

              {ksAudioTracks.length === 0 && (
                <View style={{ padding: 40, alignItems: 'center', opacity: 0.5 }}>
                  <MaterialIcons name="volume-off" size={32} color="white" />
                  <Text style={{ color: 'white', marginTop: 10 }}>No audio tracks available</Text>
                </View>
              )}
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </View>
  );
};

// Memoize to prevent re-renders when parent re-renders but props haven't changed
// This is critical for performance - the modal was re-rendering on every currentTime update
export default memo(AudioTrackModal, (prevProps, nextProps) => {
  // Only re-render if these specific props change
  return (
    prevProps.showAudioModal === nextProps.showAudioModal &&
    prevProps.selectedAudioTrack === nextProps.selectedAudioTrack &&
    prevProps.isLoading === nextProps.isLoading &&
    prevProps.ksAudioTracks === nextProps.ksAudioTracks
  );
});
