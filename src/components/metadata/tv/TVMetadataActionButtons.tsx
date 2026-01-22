import React, { useMemo, useCallback, memo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../../contexts/ThemeContext';
import { useToast } from '../../../contexts/ToastContext';
import { Focusable } from '../../tv/Focusable';
import { Episode } from '../../../types/metadata';

interface TVMetadataActionButtonsProps {
  handleShowStreams: () => void;
  handleToggleLibrary: () => void;
  inLibrary: boolean;
  type: 'movie' | 'series';
  isWatched: boolean;
  watchProgress: {
    currentTime: number;
    duration: number;
    lastUpdated: number;
    episodeId?: string;
  } | null;
  playButtonText: string;
  isAuthenticated?: boolean;
  isInWatchlist?: boolean;
  isInCollection?: boolean;
  onToggleWatchlist?: () => void;
  onToggleCollection?: () => void;
  playButtonRef: React.RefObject<View>;
  firstTabNodeHandle?: number | null;
  groupedEpisodes?: { [season: number]: Episode[] };
  contentId: string;
}

const TVMetadataActionButtonsComponent: React.FC<TVMetadataActionButtonsProps> = ({
  handleShowStreams,
  handleToggleLibrary,
  inLibrary,
  type,
  isWatched,
  watchProgress,
  playButtonText,
  isAuthenticated,
  isInWatchlist,
  isInCollection,
  onToggleWatchlist,
  onToggleCollection,
  playButtonRef,
  firstTabNodeHandle,
  groupedEpisodes,
  contentId,
}) => {
  const { currentTheme } = useTheme();
  const { showSaved, showTraktSaved, showRemoved, showTraktRemoved, showSuccess, showInfo } = useToast();

  // Refs for button navigation
  const addButtonRef = useRef<View>(null);
  const favoriteButtonRef = useRef<View>(null);

  // Handle save action
  const handleSaveAction = useCallback(async () => {
    const wasInLibrary = inLibrary;
    handleToggleLibrary();

    if (isAuthenticated && onToggleWatchlist) {
      await onToggleWatchlist();
    }

    if (isAuthenticated) {
      wasInLibrary ? showTraktRemoved() : showTraktSaved();
    } else {
      wasInLibrary ? showRemoved() : showSaved();
    }
  }, [handleToggleLibrary, isAuthenticated, onToggleWatchlist, inLibrary, showSaved, showTraktSaved, showRemoved, showTraktRemoved]);

  // Handle collection action
  const handleCollectionAction = useCallback(async () => {
    const wasInCollection = isInCollection;
    if (onToggleCollection) {
      await onToggleCollection();
    }
    wasInCollection
      ? showInfo('Removed from Collection', 'Removed from your Trakt collection')
      : showSuccess('Added to Collection', 'Added to your Trakt collection');
  }, [onToggleCollection, isInCollection, showSuccess, showInfo]);

  // Calculate final play button text for series
  const finalPlayButtonText = useMemo(() => {
    if (type === 'movie') {
      return isWatched ? 'Watch Again' : playButtonText;
    }

    if (type === 'series' && watchProgress?.episodeId && groupedEpisodes) {
      let seasonNum: number | null = null;
      let episodeNum: number | null = null;

      const parts = watchProgress.episodeId.split(':');
      if (parts.length === 3) {
        seasonNum = parseInt(parts[1], 10);
        episodeNum = parseInt(parts[2], 10);
      } else if (parts.length === 2) {
        seasonNum = parseInt(parts[0], 10);
        episodeNum = parseInt(parts[1], 10);
      } else {
        const match = watchProgress.episodeId.match(/s(\d+)e(\d+)/i);
        if (match) {
          seasonNum = parseInt(match[1], 10);
          episodeNum = parseInt(match[2], 10);
        }
      }

      if (seasonNum !== null && episodeNum !== null && !isNaN(seasonNum) && !isNaN(episodeNum)) {
        if (isWatched) {
          const nextEpisode = episodeNum + 1;
          const currentSeasonEpisodes = groupedEpisodes[seasonNum] || [];
          const nextEpisodeExists = currentSeasonEpisodes.some(ep => ep.episode_number === nextEpisode);

          if (nextEpisodeExists) {
            const seasonStr = seasonNum.toString().padStart(2, '0');
            const episodeStr = nextEpisode.toString().padStart(2, '0');
            return `Play S${seasonStr}E${episodeStr}`;
          } else {
            return 'Completed';
          }
        } else {
          return playButtonText;
        }
      }

      return isWatched ? 'Play Next Episode' : playButtonText;
    }

    return isWatched ? 'Play' : playButtonText;
  }, [isWatched, playButtonText, type, watchProgress, groupedEpisodes]);

  // Play icon
  const playIcon = useMemo(() => {
    if (isWatched) {
      return type === 'movie' ? 'replay' : 'play-arrow';
    }
    return playButtonText === 'Resume' ? 'play-circle-outline' : 'play-arrow';
  }, [isWatched, playButtonText, type]);

  // Play button style based on watched state
  const isWatchedMovie = isWatched && type === 'movie';

  return (
    <View style={styles.container}>
      {/* Play/Resume Button - Primary action with gradient */}
      <Focusable
        viewRef={playButtonRef}
        onPress={handleShowStreams}
        style={[
          styles.playButton,
          isWatchedMovie && styles.watchedPlayButton,
        ]}
        borderRadius={30}
        focusScale={1.03}
        animateBackground={false}
        autoFocus={true}
        nextFocusRight={addButtonRef}
        nextFocusDownId={firstTabNodeHandle}
        blockUp={true}
        blockLeft={true}
      >
        {!isWatchedMovie && (
          <LinearGradient
            colors={['#3B82F6', '#8B5CF6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.playButtonGradient}
          />
        )}
        <View style={styles.playButtonContent}>
          <MaterialIcons
            name={playIcon}
            size={20}
            color={isWatchedMovie ? '#fff' : '#fff'}
          />
          <Text style={[
            styles.playButtonText,
            isWatchedMovie && styles.watchedPlayButtonText,
          ]}>
            {finalPlayButtonText}
          </Text>
        </View>
      </Focusable>

      {/* Add/Save Button */}
      <Focusable
        viewRef={addButtonRef}
        onPress={handleSaveAction}
        style={styles.iconButton}
        borderRadius={30}
        focusScale={1.05}
        animateBackground={false}
        nextFocusLeft={playButtonRef}
        nextFocusRight={isAuthenticated ? favoriteButtonRef : undefined}
        nextFocusDownId={firstTabNodeHandle}
        blockUp={true}
        blockRight={!isAuthenticated}
      >
        <View style={styles.iconButtonInner}>
          <MaterialIcons
            name={inLibrary ? 'check' : 'add'}
            size={22}
            color={inLibrary ? currentTheme.colors.primary : currentTheme.colors.white}
          />
        </View>
      </Focusable>

      {/* Favorite/Collection Button - Only for authenticated users */}
      {isAuthenticated && (
        <Focusable
          viewRef={favoriteButtonRef}
          onPress={handleCollectionAction}
          style={styles.iconButton}
          borderRadius={30}
          focusScale={1.05}
          animateBackground={false}
          nextFocusLeft={addButtonRef}
          nextFocusDownId={firstTabNodeHandle}
          blockUp={true}
          blockRight={true}
        >
          <View style={styles.iconButtonInner}>
            <MaterialIcons
              name={isInCollection ? 'favorite' : 'favorite-outline'}
              size={20}
              color={isInCollection ? '#E74C3C' : currentTheme.colors.white}
            />
          </View>
        </Focusable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playButton: {
    height: 42,
    paddingHorizontal: 20,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    minWidth: 140,
  },
  watchedPlayButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  playButtonGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  playButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  playButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  watchedPlayButtonText: {
    color: '#fff',
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  iconButtonInner: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export const TVMetadataActionButtons = memo(TVMetadataActionButtonsComponent);
