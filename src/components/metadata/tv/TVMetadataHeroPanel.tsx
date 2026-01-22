import React, { useMemo, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import FastImage from '@d11/react-native-fast-image';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '../../../contexts/ThemeContext';
import { StreamingContent } from '../../../services/catalogService';
import AgeRatingBadge from '../../common/AgeRatingBadge';
import { TVMetadataActionButtons } from './TVMetadataActionButtons';
import { Episode } from '../../../types/metadata';

interface TVMetadataHeroPanelProps {
  metadata: StreamingContent;
  type: 'movie' | 'series';
  logoUri: string | null;
  watchProgress: {
    currentTime: number;
    duration: number;
    lastUpdated: number;
    episodeId?: string;
  } | null;
  getPlayButtonText: () => string;
  handleShowStreams: () => void;
  handleToggleLibrary: () => void;
  inLibrary: boolean;
  isAuthenticated?: boolean;
  isInWatchlist?: boolean;
  isInCollection?: boolean;
  onToggleWatchlist?: () => void;
  onToggleCollection?: () => void;
  navigation: any;
  handleBack: () => void;
  playButtonRef: React.RefObject<View>;
  firstTabNodeHandle?: number | null;
  contentId: string;
  groupedEpisodes?: { [season: number]: Episode[] };
}

const IMDb_LOGO = 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/IMDB_Logo_2016.svg/575px-IMDB_Logo_2016.svg.png';

const TVMetadataHeroPanelComponent: React.FC<TVMetadataHeroPanelProps> = ({
  metadata,
  type,
  logoUri,
  watchProgress,
  getPlayButtonText,
  handleShowStreams,
  handleToggleLibrary,
  inLibrary,
  isAuthenticated,
  isInWatchlist,
  isInCollection,
  onToggleWatchlist,
  onToggleCollection,
  navigation,
  handleBack,
  playButtonRef,
  firstTabNodeHandle,
  contentId,
  groupedEpisodes,
}) => {
  const { currentTheme } = useTheme();

  // Format runtime
  const formattedRuntime = useMemo(() => {
    if (!metadata.runtime) return null;
    const runtime = metadata.runtime;
    const match = runtime.match(/(?:(\d+)\s*h\s*)?(\d+)\s*min/i);
    if (match) {
      const h = match[1] ? parseInt(match[1], 10) : 0;
      const m = match[2] ? parseInt(match[2], 10) : 0;
      if (h > 0) return `${h}h ${m}m`;
      if (m < 60) return `${m} min`;
      const hours = Math.floor(m / 60);
      const mins = m % 60;
      return hours > 0 ? `${hours}h ${mins}m` : `${mins} min`;
    }
    const r = parseInt(runtime, 10);
    if (!isNaN(r)) {
      if (r < 60) return `${r} min`;
      const h = Math.floor(r / 60);
      const m = r % 60;
      return h > 0 ? `${h}h ${m}m` : `${m} min`;
    }
    return runtime;
  }, [metadata.runtime]);

  // Check if watched
  const isWatched = useMemo(() => {
    if (!watchProgress) return false;
    const progressPercent = (watchProgress.currentTime / watchProgress.duration) * 100;
    return progressPercent >= 85;
  }, [watchProgress]);

  // Genres (max 4)
  const displayGenres = useMemo(() => {
    return metadata.genres?.slice(0, 4) || [];
  }, [metadata.genres]);

  return (
    <View style={styles.container}>
      {/* Logo or Title */}
      <Animated.View style={styles.titleContainer} entering={FadeIn.duration(300)}>
        {logoUri ? (
          <FastImage
            source={{ uri: logoUri, priority: FastImage.priority.high }}
            style={styles.logo}
            resizeMode={FastImage.resizeMode.contain}
          />
        ) : (
          <Text style={[styles.title, { color: currentTheme.colors.highEmphasis }]} numberOfLines={2}>
            {metadata.name}
          </Text>
        )}
      </Animated.View>

      {/* Meta Info Row */}
      <Animated.View
        style={styles.metaRow}
        entering={FadeIn.duration(300).delay(50)}
      >
        {metadata.year && (
          <Text style={[styles.metaText, { color: currentTheme.colors.text }]}>
            {metadata.year}
          </Text>
        )}
        {formattedRuntime && (
          <>
            <View style={styles.metaDot} />
            <Text style={[styles.metaText, { color: currentTheme.colors.text }]}>
              {formattedRuntime}
            </Text>
          </>
        )}
        {metadata.certification && (
          <>
            <View style={styles.metaDot} />
            <AgeRatingBadge rating={metadata.certification} />
          </>
        )}
      </Animated.View>

      {/* IMDb Rating */}
      {metadata.imdbRating && (
        <Animated.View
          style={styles.ratingContainer}
          entering={FadeIn.duration(300).delay(100)}
        >
          <FastImage
            source={{ uri: IMDb_LOGO }}
            style={styles.imdbLogo}
            resizeMode={FastImage.resizeMode.contain}
          />
          <Text style={[styles.ratingText, { color: '#F5C518' }]}>
            {metadata.imdbRating}
          </Text>
        </Animated.View>
      )}

      {/* Description */}
      {metadata.description && (
        <Animated.View
          style={styles.descriptionContainer}
          entering={FadeIn.duration(300).delay(150)}
        >
          <Text
            style={[styles.description, { color: currentTheme.colors.mediumEmphasis }]}
            numberOfLines={3}
          >
            {metadata.description}
          </Text>
        </Animated.View>
      )}

      {/* Genres */}
      {displayGenres.length > 0 && (
        <Animated.View
          style={styles.genresContainer}
          entering={FadeIn.duration(300).delay(200)}
        >
          {displayGenres.map((genre, index) => (
            <React.Fragment key={genre}>
              <Text style={[styles.genreText, { color: currentTheme.colors.mediumEmphasis }]}>
                {genre}
              </Text>
              {index < displayGenres.length - 1 && (
                <Text style={[styles.genreSeparator, { color: currentTheme.colors.textMuted }]}>
                  |
                </Text>
              )}
            </React.Fragment>
          ))}
        </Animated.View>
      )}

      {/* Action Buttons */}
      <Animated.View
        style={styles.actionsContainer}
        entering={FadeIn.duration(300).delay(250)}
      >
        <TVMetadataActionButtons
          handleShowStreams={handleShowStreams}
          handleToggleLibrary={handleToggleLibrary}
          inLibrary={inLibrary}
          type={type}
          isWatched={isWatched}
          watchProgress={watchProgress}
          playButtonText={getPlayButtonText()}
          isAuthenticated={isAuthenticated}
          isInWatchlist={isInWatchlist}
          isInCollection={isInCollection}
          onToggleWatchlist={onToggleWatchlist}
          onToggleCollection={onToggleCollection}
          playButtonRef={playButtonRef}
          firstTabNodeHandle={firstTabNodeHandle}
          groupedEpisodes={groupedEpisodes}
          contentId={contentId}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  titleContainer: {
    marginBottom: 8,
  },
  logo: {
    width: '80%',
    height: 60,
    maxWidth: 350,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.5)',
    marginHorizontal: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  imdbLogo: {
    width: 32,
    height: 16,
    marginRight: 6,
  },
  ratingText: {
    fontSize: 15,
    fontWeight: '700',
  },
  descriptionContainer: {
    marginBottom: 6,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  genresContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  genreText: {
    fontSize: 12,
    fontWeight: '600',
  },
  genreSeparator: {
    marginHorizontal: 6,
    fontSize: 12,
  },
  actionsContainer: {
    marginTop: 2,
  },
});

export const TVMetadataHeroPanel = memo(TVMetadataHeroPanelComponent);
