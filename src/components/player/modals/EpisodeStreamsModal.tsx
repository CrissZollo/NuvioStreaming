import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet, Platform, useWindowDimensions, BackHandler } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideOutRight,
} from 'react-native-reanimated';
import { Episode } from '../../../types/metadata';
import { Stream } from '../../../types/streams';
import { stremioService } from '../../../services/stremioService';
import { logger } from '../../../utils/logger';
import { useIsTV } from '../../../contexts/TVContext';
import { Focusable } from '../../tv/Focusable';

interface EpisodeStreamsModalProps {
  visible: boolean;
  episode: Episode | null;
  onClose: () => void;
  onSelectStream: (stream: Stream) => void;
  metadata?: { id?: string; name?: string };
  /** Called when modal is closed (for TV focus restoration) */
  onModalClosed?: () => void;
}

const QualityBadge = ({ quality }: { quality: string | null }) => {
  if (!quality) return null;

  const qualityNum = parseInt(quality);
  let color = '#8B5CF6';
  let label = `${quality}p`;

  if (qualityNum >= 2160) {
    color = '#F59E0B';
    label = '4K';
  } else if (qualityNum >= 1080) {
    color = '#3B82F6';
    label = '1080p';
  } else if (qualityNum >= 720) {
    color = '#10B981';
    label = '720p';
  }

  return (
    <View style={{
      backgroundColor: color,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      marginLeft: 8,
    }}>
      <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>{label}</Text>
    </View>
  );
};

export const EpisodeStreamsModal: React.FC<EpisodeStreamsModalProps> = ({
  visible,
  episode,
  onClose,
  onSelectStream,
  metadata,
  onModalClosed,
}) => {
  const { width } = useWindowDimensions();
  const isTVDevice = useIsTV();

  // TV-specific sizing
  const MENU_WIDTH = isTVDevice ? Math.min(width * 0.5, 600) : Math.min(width * 0.85, 400);

  const [availableStreams, setAvailableStreams] = useState<{ [providerId: string]: { streams: Stream[]; addonName: string } }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [hasErrors, setHasErrors] = useState<string[]>([]);

  // Ref for first focusable stream item
  const firstStreamRef = useRef<View>(null);

  // Close handler with TV focus restoration
  const handleClose = useCallback(() => {
    onClose();
    if (isTVDevice && onModalClosed) {
      onModalClosed();
    }
  }, [onClose, isTVDevice, onModalClosed]);

  // Handle Android TV back button to close modal
  useEffect(() => {
    if (!visible) return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      if (isTVDevice && onModalClosed) {
        onModalClosed();
      }
      return true; // Prevent default back behavior
    });

    return () => backHandler.remove();
  }, [visible, onClose, isTVDevice, onModalClosed]);

  useEffect(() => {
    if (visible && episode && metadata?.id) {
      fetchStreams();
    } else {
      setAvailableStreams({});
      setIsLoading(false);
      setHasErrors([]);
    }
  }, [visible, episode, metadata?.id]);

  const fetchStreams = async () => {
    if (!episode || !metadata?.id) return;

    setIsLoading(true);
    setHasErrors([]);
    setAvailableStreams({});

    try {
      const episodeId = episode.stremioId || `${metadata.id}:${episode.season_number}:${episode.episode_number}`;
      let completedProviders = 0;
      const expectedProviders = new Set<string>();
      const respondedProviders = new Set<string>();

      const installedAddons = stremioService.getInstalledAddons();
      const streamAddons = installedAddons.filter((addon: any) =>
        addon.resources && addon.resources.includes('stream')
      );

      streamAddons.forEach((addon: any) => expectedProviders.add(addon.id));

      logger.log(`[EpisodeStreamsModal] Fetching streams for ${episodeId}, expecting ${expectedProviders.size} providers`);

      await stremioService.getStreams('series', episodeId, (streams: any, addonId: any, addonName: any, error: any) => {
        completedProviders++;
        respondedProviders.add(addonId);

        if (error) {
          setHasErrors(prev => [...prev, `${addonName || addonId}: ${error.message || 'Unknown error'}`]);
        } else if (streams && streams.length > 0) {
          setAvailableStreams(prev => ({
            ...prev,
            [addonId]: {
              streams: streams,
              addonName: addonName || addonId
            }
          }));
        }

        if (completedProviders >= expectedProviders.size) {
          setIsLoading(false);
        }
      });

      setTimeout(() => {
        if (respondedProviders.size === 0) {
          setIsLoading(false);
        }
      }, 8000);

    } catch (error) {
      setIsLoading(false);
    }
  };

  const getQualityFromTitle = (title?: string): string | null => {
    if (!title) return null;
    const match = title.match(/(\d+)p/);
    return match ? match[1] : null;
  };

  if (!visible) return null;

  const sortedProviders = Object.entries(availableStreams);

  // Flatten all streams for focus navigation indexing
  const allStreams: { providerId: string; stream: Stream; index: number }[] = [];
  sortedProviders.forEach(([providerId, providerData]) => {
    providerData.streams.forEach((stream, index) => {
      allStreams.push({ providerId, stream, index });
    });
  });

  // Render stream item - TV or mobile
  const renderStreamItem = (
    providerId: string,
    stream: Stream,
    streamIndex: number,
    globalIndex: number,
    totalStreams: number
  ) => {
    const quality = getQualityFromTitle(stream.title) || stream.quality || null;
    const isFirst = globalIndex === 0;
    const isLast = globalIndex === totalStreams - 1;

    const handleSelect = () => {
      onSelectStream(stream);
      handleClose();
    };

    const streamContent = (focused?: boolean) => (
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <Text style={{
              color: focused ? 'black' : 'white',
              fontWeight: '700',
              fontSize: isTVDevice ? 16 : 14,
              flex: 1
            }} numberOfLines={1}>
              {stream.name || 'Unknown Source'}
            </Text>
            <QualityBadge quality={quality} />
          </View>
          {stream.title && (
            <Text style={{
              color: focused ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.5)',
              fontSize: isTVDevice ? 13 : 11
            }} numberOfLines={2}>
              {stream.title}
            </Text>
          )}
        </View>
      </View>
    );

    if (isTVDevice) {
      return (
        <Focusable
          key={`${providerId}-${streamIndex}`}
          onPress={handleSelect}
          autoFocus={isFirst}
          viewRef={isFirst ? firstStreamRef : undefined}
          blockUp={isFirst}
          blockDown={isLast}
          blockLeft={true}
          blockRight={true}
          style={{
            padding: isTVDevice ? 14 : 8,
            borderRadius: 12,
            backgroundColor: 'rgba(255,255,255,0.05)',
          }}
          borderRadius={12}
          focusScale={1.02}
          animateBackground={true}
          showFocusBorder={true}
        >
          {(focused) => streamContent(focused)}
        </Focusable>
      );
    }

    return (
      <TouchableOpacity
        key={`${providerId}-${streamIndex}`}
        style={{
          padding: 8,
          borderRadius: 12,
          backgroundColor: 'rgba(255,255,255,0.05)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.05)'
        }}
        onPress={handleSelect}
        activeOpacity={0.7}
      >
        {streamContent()}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 10000 }]}>
      {/* Backdrop */}
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={handleClose}
      >
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
        />
      </TouchableOpacity>

      <Animated.View
        entering={SlideInRight.duration(300)}
        exiting={SlideOutRight.duration(250)}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: MENU_WIDTH,
          backgroundColor: '#0f0f0f',
          borderLeftWidth: 1,
          borderColor: 'rgba(255,255,255,0.1)',
        }}
      >
        {/* Header */}
        <View style={{
          paddingTop: isTVDevice ? 30 : (Platform.OS === 'ios' ? 60 : 20),
          paddingHorizontal: 20,
          paddingBottom: 20,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={{ color: 'white', fontSize: isTVDevice ? 24 : 20, fontWeight: '700' }} numberOfLines={1}>
                {episode?.name || 'Sources'}
              </Text>
              {episode && (
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: isTVDevice ? 15 : 13, marginTop: 4 }}>
                  S{episode.season_number} • E{episode.episode_number}
                </Text>
              )}
            </View>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 40 }}
        >
          {isLoading && sortedProviders.length === 0 && (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <ActivityIndicator color="white" />
              <Text style={{ color: 'white', marginTop: 15, opacity: 0.6 }}>Finding sources...</Text>
            </View>
          )}

          {(() => {
            let globalIndex = 0;
            return sortedProviders.map(([providerId, providerData]) => (
              <View key={providerId} style={{ marginBottom: 20 }}>
                <Text style={{
                  color: 'rgba(255, 255, 255, 0.4)',
                  fontSize: isTVDevice ? 14 : 12,
                  fontWeight: '700',
                  marginBottom: 10,
                  marginLeft: 5,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}>
                  {providerData.addonName}
                </Text>

                <View style={{ gap: isTVDevice ? 10 : 8 }}>
                  {providerData.streams.map((stream, index) => {
                    const currentGlobalIndex = globalIndex++;
                    return renderStreamItem(
                      providerId,
                      stream,
                      index,
                      currentGlobalIndex,
                      allStreams.length
                    );
                  })}
                </View>
              </View>
            ));
          })()}

          {!isLoading && sortedProviders.length === 0 && (
            <View style={{ padding: 40, alignItems: 'center', opacity: 0.5 }}>
              <MaterialIcons name="cloud-off" size={48} color="white" />
              <Text style={{ color: 'white', marginTop: 16, textAlign: 'center', fontWeight: '600' }}>No sources found</Text>
            </View>
          )}

          {hasErrors.length > 0 && (
             <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 12, padding: 12, marginTop: 10 }}>
                <Text style={{ color: '#EF4444', fontSize: 11 }}>Sources might be limited due to provider errors.</Text>
             </View>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
};

export default EpisodeStreamsModal;
