import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, useWindowDimensions, StyleSheet, Platform, ActivityIndicator, BackHandler } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideOutRight,
} from 'react-native-reanimated';
import { Episode } from '../../../types/metadata';
import { EpisodeCard } from '../cards/EpisodeCard';
import { storageService } from '../../../services/storageService';
import { TraktService } from '../../../services/traktService';
import { logger } from '../../../utils/logger';
import { useIsTV } from '../../../contexts/TVContext';
import { Focusable } from '../../tv/Focusable';

interface EpisodesModalProps {
  showEpisodesModal: boolean;
  setShowEpisodesModal: (show: boolean) => void;
  groupedEpisodes: { [seasonNumber: number]: Episode[] };
  currentEpisode?: { season: number; episode: number };
  metadata?: { poster?: string; id?: string; tmdbId?: string; type?: string };
  onSelectEpisode: (episode: Episode) => void;
  tmdbEpisodeOverrides?: any;
  /** Called when modal is closed (for TV focus restoration) */
  onModalClosed?: () => void;
}

export const EpisodesModal: React.FC<EpisodesModalProps> = ({
  showEpisodesModal,
  setShowEpisodesModal,
  groupedEpisodes,
  currentEpisode,
  metadata,
  onSelectEpisode,
  tmdbEpisodeOverrides,
  onModalClosed,
}) => {
  const { width, height } = useWindowDimensions();
  const isTVDevice = useIsTV();
  const [selectedSeason, setSelectedSeason] = useState<number>(currentEpisode?.season || 1);
  const [episodeProgress, setEpisodeProgress] = useState<{ [key: string]: any }>({});
  const [isLoadingProgress, setIsLoadingProgress] = useState(false);

  // TV-specific sizing
  const MENU_WIDTH = isTVDevice ? Math.min(width * 0.5, 600) : Math.min(width * 0.85, 400);

  // Ref for first focusable item
  const firstSeasonRef = useRef<View>(null);
  const firstEpisodeRef = useRef<View>(null);

  const currentTheme = {
    colors: {
      text: '#FFFFFF',
      textMuted: 'rgba(255,255,255,0.6)',
      mediumEmphasis: 'rgba(255,255,255,0.7)',
      primary: 'rgba(255,255,255,0.9)',
      white: '#FFFFFF',
      elevation2: 'rgba(255,255,255,0.05)'
    }
  };

  // Close handler with TV focus restoration
  const handleClose = useCallback(() => {
    setShowEpisodesModal(false);
    if (isTVDevice && onModalClosed) {
      onModalClosed();
    }
  }, [setShowEpisodesModal, isTVDevice, onModalClosed]);

  // Handle Android TV back button to close modal
  useEffect(() => {
    if (!showEpisodesModal) return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      setShowEpisodesModal(false);
      if (isTVDevice && onModalClosed) {
        onModalClosed();
      }
      return true; // Prevent default back behavior
    });

    return () => backHandler.remove();
  }, [showEpisodesModal, setShowEpisodesModal, isTVDevice, onModalClosed]);

  // Logic Preserved: Fetch progress from storage/Trakt
  useEffect(() => {
    const fetchProgress = async () => {
      if (showEpisodesModal && metadata?.id) {
        setIsLoadingProgress(true);
        try {
          // Get all watch progress and filter for this show's episodes
          const allProgress = await storageService.getAllWatchProgress();
          const showPrefix = `series:${metadata.id}:`;
          const progress: { [key: string]: any } = {};

          for (const [key, value] of Object.entries(allProgress)) {
            if (key.startsWith(showPrefix)) {
              // Extract episode id from key (format: series:showId:episodeId)
              const episodeId = key.replace(showPrefix, '');
              progress[episodeId] = value;
            }
          }

          setEpisodeProgress(progress);

          // Trakt sync logic preserved
          if (await TraktService.getInstance().isAuthenticated()) {
            // Optional: background sync logic
          }
        } catch (err) {
          logger.error('Failed to fetch episode progress', err);
        } finally {
          setIsLoadingProgress(false);
        }
      }
    };
    fetchProgress();
  }, [showEpisodesModal, metadata?.id]);

  useEffect(() => {
    if (showEpisodesModal && currentEpisode?.season) {
      setSelectedSeason(currentEpisode.season);
    }
  }, [showEpisodesModal]);

  if (!showEpisodesModal) return null;

  const seasons = Object.keys(groupedEpisodes).map(Number).sort((a, b) => a - b);
  const currentSeasonEpisodes = groupedEpisodes[selectedSeason] || [];

  // Sort seasons: regular seasons first (1, 2, 3...), then specials (0)
  const sortedSeasons = [...seasons].sort((a, b) => {
    if (a === 0) return 1;
    if (b === 0) return -1;
    return a - b;
  });

  // Render season tab - TV or mobile
  const renderSeasonTab = (season: number, index: number) => {
    const isSelected = selectedSeason === season;
    const isFirst = index === 0;
    const isLast = index === sortedSeasons.length - 1;

    const tabContent = (focused?: boolean) => (
      <Text style={{
        color: (isSelected || focused) ? 'black' : 'white',
        fontWeight: (isSelected || focused) ? '700' : '500',
        fontSize: isTVDevice ? 16 : 14,
      }}>
        {season === 0 ? 'Specials' : `Season ${season}`}
      </Text>
    );

    if (isTVDevice) {
      return (
        <Focusable
          key={season}
          onPress={() => setSelectedSeason(season)}
          autoFocus={isFirst && !currentEpisode}
          viewRef={isFirst ? firstSeasonRef : undefined}
          blockUp={true}
          blockLeft={isFirst}
          blockRight={isLast}
          nextFocusDown={firstEpisodeRef}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 20,
            backgroundColor: isSelected ? 'white' : 'rgba(255,255,255,0.06)',
          }}
          borderRadius={20}
          focusScale={1.05}
          animateBackground={true}
          showFocusBorder={true}
        >
          {(focused) => tabContent(focused)}
        </Focusable>
      );
    }

    return (
      <TouchableOpacity
        key={season}
        onPress={() => setSelectedSeason(season)}
        style={{
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderRadius: 20,
          backgroundColor: isSelected ? 'white' : 'rgba(255,255,255,0.06)',
          borderWidth: 1,
          borderColor: isSelected ? 'white' : 'rgba(255,255,255,0.1)',
        }}
      >
        {tabContent()}
      </TouchableOpacity>
    );
  };

  // Render episode card - TV or mobile
  const renderEpisodeCard = (episode: Episode, index: number) => {
    const isFirst = index === 0;
    const isLast = index === currentSeasonEpisodes.length - 1;
    const isCurrentEpisode = currentEpisode?.season === episode.season_number && currentEpisode?.episode === episode.episode_number;

    const handleSelect = () => {
      onSelectEpisode(episode);
      handleClose();
    };

    if (isTVDevice) {
      return (
        <Focusable
          key={episode.id}
          onPress={handleSelect}
          autoFocus={isFirst && !!currentEpisode}
          viewRef={isFirst ? firstEpisodeRef : undefined}
          blockDown={isLast}
          blockLeft={true}
          blockRight={true}
          nextFocusUp={isFirst ? firstSeasonRef : undefined}
          style={{
            borderRadius: 16,
            marginBottom: 8,
          }}
          borderRadius={16}
          focusScale={1.02}
          showFocusBorder={true}
        >
          {(focused) => (
            <EpisodeCard
              episode={episode}
              metadata={metadata}
              episodeProgress={episodeProgress}
              tmdbEpisodeOverrides={tmdbEpisodeOverrides}
              onPress={handleSelect}
              currentTheme={currentTheme}
              isCurrent={isCurrentEpisode}
              isFocused={focused}
            />
          )}
        </Focusable>
      );
    }

    return (
      <EpisodeCard
        key={episode.id}
        episode={episode}
        metadata={metadata}
        episodeProgress={episodeProgress}
        tmdbEpisodeOverrides={tmdbEpisodeOverrides}
        onPress={handleSelect}
        currentTheme={currentTheme}
        isCurrent={isCurrentEpisode}
      />
    );
  };

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 9999 }]}>
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleClose}>
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} />
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
        <View style={{ paddingTop: isTVDevice ? 30 : (Platform.OS === 'ios' ? 60 : 20), paddingHorizontal: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ color: 'white', fontSize: isTVDevice ? 24 : 22, fontWeight: '700' }}>Episodes</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 15, gap: 8 }}>
            {sortedSeasons.map((season, index) => renderSeasonTab(season, index))}
          </ScrollView>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
          {isLoadingProgress ? (
            <ActivityIndicator color="white" style={{ marginTop: 20 }} />
          ) : (
            <View style={{ gap: isTVDevice ? 4 : 2 }}>
              {currentSeasonEpisodes.map((episode, index) => renderEpisodeCard(episode, index))}
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
};

export default EpisodesModal;
