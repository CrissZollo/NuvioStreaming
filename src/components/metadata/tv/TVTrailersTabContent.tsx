import React, { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import FastImage from '@d11/react-native-fast-image';
import { useTheme } from '../../../contexts/ThemeContext';
import { useTrailer } from '../../../contexts/TrailerContext';
import { logger } from '../../../utils/logger';
import TrailerModal from '../TrailerModal';
import { Focusable } from '../../tv/Focusable';

// Card dimensions for TV - sized to fit in tab section
const CARD_WIDTH = 200;
const CARD_HEIGHT = 112;
const CARD_SPACING = 10;

interface TrailerVideo {
  id: string;
  key: string;
  name: string;
  site: string;
  size: number;
  type: string;
  official: boolean;
  published_at: string;
  seasonNumber: number | null;
  displayName?: string;
}

interface TVTrailersTabContentProps {
  tmdbId: number | null;
  type: 'movie' | 'tv';
  contentId: string;
  contentTitle: string;
  firstContentItemRef: React.RefObject<View>;
  activeTabRef: React.RefObject<View>;
}

const TVTrailersTabContentComponent: React.FC<TVTrailersTabContentProps> = ({
  tmdbId,
  type,
  contentId,
  contentTitle,
  firstContentItemRef,
  activeTabRef,
}) => {
  const { currentTheme } = useTheme();
  const { pauseTrailer } = useTrailer();

  const [trailers, setTrailers] = useState<TrailerVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrailer, setSelectedTrailer] = useState<TrailerVideo | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const flatListRef = useRef<FlatList<TrailerVideo>>(null);

  // Item refs for focus navigation
  const itemRefs = useRef<Map<number, React.RefObject<View>>>(new Map());

  const getItemRef = useCallback((index: number) => {
    if (!itemRefs.current.has(index)) {
      itemRefs.current.set(index, React.createRef<View>());
    }
    return itemRefs.current.get(index)!;
  }, []);

  // Fetch trailers from TMDB API
  useEffect(() => {
    const fetchTrailers = async () => {
      if (!tmdbId) return;

      setLoading(true);
      setError(null);

      try {
        const apiKey = 'd131017ccc6e5462a81c9304d21476de';
        let allVideos: TrailerVideo[] = [];

        if (type === 'movie') {
          const response = await fetch(
            `https://api.themoviedb.org/3/movie/${tmdbId}/videos?api_key=${apiKey}&language=en-US`
          );
          if (response.ok) {
            const data = await response.json();
            allVideos = (data.results || []).map((v: any) => ({
              ...v,
              seasonNumber: null,
            }));
          }
        } else {
          // TV show - fetch main videos and season videos
          const tvResponse = await fetch(
            `https://api.themoviedb.org/3/tv/${tmdbId}/videos?api_key=${apiKey}&language=en-US`
          );
          if (tvResponse.ok) {
            const tvData = await tvResponse.json();
            allVideos = (tvData.results || []).map((v: any) => ({
              ...v,
              seasonNumber: null,
            }));
          }
        }

        // Filter to YouTube trailers and teasers, sorted by date
        const filtered = allVideos
          .filter((v: TrailerVideo) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'))
          .sort((a: TrailerVideo, b: TrailerVideo) =>
            new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
          );
        setTrailers(filtered);
      } catch (err) {
        logger.error('[TVTrailersTabContent] Error fetching trailers:', err);
        setError('Failed to load trailers');
      } finally {
        setLoading(false);
      }
    };

    fetchTrailers();
  }, [tmdbId, type]);

  // Handle item focus - scroll to keep in view
  const handleItemFocus = useCallback((index: number) => {
    if (flatListRef.current) {
      const offset = index * (CARD_WIDTH + CARD_SPACING);
      flatListRef.current.scrollToOffset({
        offset: Math.max(0, offset - 48),
        animated: false,
      });
    }
  }, []);

  // Handle trailer press
  const handleTrailerPress = useCallback((trailer: TrailerVideo) => {
    pauseTrailer();
    setSelectedTrailer(trailer);
    setModalVisible(true);
  }, [pauseTrailer]);

  // Close modal
  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
    setSelectedTrailer(null);
  }, []);

  // Get thumbnail URL
  const getThumbnailUrl = useCallback((key: string) => {
    return `https://img.youtube.com/vi/${key}/hqdefault.jpg`;
  }, []);

  // Render trailer card
  const renderItem = useCallback(({ item, index }: { item: TrailerVideo; index: number }) => {
    const isFirst = index === 0;
    const isLast = index === trailers.length - 1;

    return (
      <View style={[styles.cardWrapper, { marginRight: CARD_SPACING }]}>
        <Focusable
          viewRef={isFirst ? firstContentItemRef : getItemRef(index)}
          onPress={() => handleTrailerPress(item)}
          onFocus={() => handleItemFocus(index)}
          style={styles.card}
          borderRadius={12}
          focusScale={1.0}
          animateBackground={false}
          showFocusBorder={true}
          blockUp={false}
          blockLeft={isFirst}
          blockRight={isLast}
          nextFocusUp={activeTabRef}
          nextFocusLeft={!isFirst ? getItemRef(index - 1) : undefined}
          nextFocusRight={!isLast ? getItemRef(index + 1) : undefined}
        >
          {/* Thumbnail */}
          <FastImage
            source={{ uri: getThumbnailUrl(item.key) }}
            style={styles.thumbnail}
            resizeMode={FastImage.resizeMode.cover}
          />

          {/* Play overlay */}
          <View style={styles.playOverlay}>
            <View style={styles.playButton}>
              <MaterialIcons name="play-arrow" size={36} color="#fff" />
            </View>
          </View>

          {/* Type badge */}
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{item.type}</Text>
          </View>
        </Focusable>

        {/* Title below card */}
        <Text
          style={[styles.title, { color: currentTheme.colors.mediumEmphasis }]}
          numberOfLines={2}
        >
          {item.name}
        </Text>
      </View>
    );
  }, [trailers.length, currentTheme.colors.mediumEmphasis, firstContentItemRef, activeTabRef, getItemRef, getThumbnailUrl, handleItemFocus, handleTrailerPress]);

  // Key extractor
  const keyExtractor = useCallback((item: TrailerVideo) => item.id, []);

  // Get item layout
  const getItemLayout = useCallback((_: any, index: number) => ({
    length: CARD_WIDTH + CARD_SPACING,
    offset: (CARD_WIDTH + CARD_SPACING) * index,
    index,
  }), []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={currentTheme.colors.primary} />
      </View>
    );
  }

  if (error || trailers.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialIcons name="movie" size={48} color={currentTheme.colors.textMuted} />
        <Text style={[styles.emptyText, { color: currentTheme.colors.textMuted }]}>
          {error || 'No trailers available'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={trailers}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false} // D-pad controls focus
        contentContainerStyle={styles.listContent}
        initialNumToRender={4}
        maxToRenderPerBatch={3}
        windowSize={5}
        removeClippedSubviews={true}
        getItemLayout={getItemLayout}
      />

      {/* Trailer Modal */}
      <TrailerModal
        visible={modalVisible}
        onClose={handleCloseModal}
        trailer={selectedTrailer}
        contentTitle={contentTitle}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingRight: 48,
  },
  cardWrapper: {
    width: CARD_WIDTH,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 13,
    marginTop: 8,
    lineHeight: 18,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
  },
});

export const TVTrailersTabContent = memo(TVTrailersTabContentComponent);
