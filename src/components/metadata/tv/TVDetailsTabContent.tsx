import React, { useCallback, useRef, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import { useTheme } from '../../../contexts/ThemeContext';
import { StreamingContent } from '../../../services/catalogService';
import { Focusable } from '../../tv/Focusable';

// Cast card dimensions - sized to fit in tab section
const CAST_CARD_WIDTH = 85;
const CAST_CARD_HEIGHT = 127;
const CAST_SPACING = 8;

interface TVDetailsTabContentProps {
  metadata: StreamingContent;
  type: 'movie' | 'series';
  cast: any[];
  imdbId: string | null;
  firstContentItemRef: React.RefObject<View>;
  activeTabRef: React.RefObject<View>;
}

const TVDetailsTabContentComponent: React.FC<TVDetailsTabContentProps> = ({
  metadata,
  type,
  cast,
  imdbId,
  firstContentItemRef,
  activeTabRef,
}) => {
  const { currentTheme } = useTheme();
  const castListRef = useRef<FlatList<any>>(null);

  // Cast item refs
  const castRefs = useRef<Map<number, React.RefObject<View>>>(new Map());

  const getCastRef = useCallback((index: number) => {
    if (!castRefs.current.has(index)) {
      castRefs.current.set(index, React.createRef<View>());
    }
    return castRefs.current.get(index)!;
  }, []);

  // Handle cast focus
  const handleCastFocus = useCallback((index: number) => {
    if (castListRef.current) {
      const offset = index * (CAST_CARD_WIDTH + CAST_SPACING);
      castListRef.current.scrollToOffset({
        offset: Math.max(0, offset - 24),
        animated: true,
      });
    }
  }, []);

  // Get details based on content type
  const details = type === 'series' ? metadata.tvDetails : metadata.movieDetails;

  // Format date
  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, []);

  // Render cast card
  const renderCastCard = useCallback(({ item, index }: { item: any; index: number }) => {
    const isFirst = index === 0;
    const isLast = index === cast.length - 1;
    const profileImage = item.profile_path
      ? `https://image.tmdb.org/t/p/w185${item.profile_path}`
      : 'https://via.placeholder.com/120x180/1a1a1a/666666?text=No+Image';

    return (
      <View style={[styles.castCardWrapper, { marginRight: CAST_SPACING }]}>
        <Focusable
          viewRef={isFirst ? firstContentItemRef : getCastRef(index)}
          onPress={() => {}}
          onFocus={() => handleCastFocus(index)}
          style={styles.castCard}
          borderRadius={8}
          unfocusedScale={0.95}
          focusScale={1.0}
          animateBackground={false}
          showFocusBorder={true}
          blockUp={false}
          blockLeft={isFirst}
          blockRight={isLast}
          nextFocusUp={activeTabRef}
          nextFocusLeft={!isFirst ? getCastRef(index - 1) : undefined}
          nextFocusRight={!isLast ? getCastRef(index + 1) : undefined}
        >
          <FastImage
            source={{ uri: profileImage }}
            style={styles.castImage}
            resizeMode={FastImage.resizeMode.cover}
          />
        </Focusable>
        <Text
          style={[styles.castName, { color: currentTheme.colors.highEmphasis }]}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        <Text
          style={[styles.castCharacter, { color: currentTheme.colors.textMuted }]}
          numberOfLines={1}
        >
          {item.character}
        </Text>
      </View>
    );
  }, [cast.length, currentTheme.colors, firstContentItemRef, activeTabRef, getCastRef, handleCastFocus]);

  // Key extractor for cast
  const castKeyExtractor = useCallback((item: any) => item.id.toString(), []);

  // Get item layout for cast
  const getCastItemLayout = useCallback((_: any, index: number) => ({
    length: CAST_CARD_WIDTH + CAST_SPACING,
    offset: (CAST_CARD_WIDTH + CAST_SPACING) * index,
    index,
  }), []);

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Cast Section */}
      {cast.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: currentTheme.colors.highEmphasis }]}>
            Cast
          </Text>
          <FlatList
            ref={castListRef}
            data={cast.slice(0, 15)}
            renderItem={renderCastCard}
            keyExtractor={castKeyExtractor}
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEnabled={false}
            contentContainerStyle={styles.castListContent}
            getItemLayout={getCastItemLayout}
          />
        </View>
      )}

      {/* Details Section */}
      {details && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: currentTheme.colors.highEmphasis }]}>
            {type === 'series' ? 'Show Details' : 'Movie Details'}
          </Text>

          <View style={styles.detailsGrid}>
            {/* Movie-specific details */}
            {type === 'movie' && metadata.movieDetails && (
              <>
                {metadata.movieDetails.tagline && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: currentTheme.colors.textMuted }]}>
                      Tagline
                    </Text>
                    <Text style={[styles.detailValue, styles.tagline, { color: currentTheme.colors.mediumEmphasis }]}>
                      "{metadata.movieDetails.tagline}"
                    </Text>
                  </View>
                )}
                {metadata.movieDetails.status && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: currentTheme.colors.textMuted }]}>
                      Status
                    </Text>
                    <Text style={[styles.detailValue, { color: currentTheme.colors.highEmphasis }]}>
                      {metadata.movieDetails.status}
                    </Text>
                  </View>
                )}
                {metadata.movieDetails.releaseDate && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: currentTheme.colors.textMuted }]}>
                      Release Date
                    </Text>
                    <Text style={[styles.detailValue, { color: currentTheme.colors.highEmphasis }]}>
                      {formatDate(metadata.movieDetails.releaseDate)}
                    </Text>
                  </View>
                )}
                {metadata.movieDetails.budget && metadata.movieDetails.budget > 0 && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: currentTheme.colors.textMuted }]}>
                      Budget
                    </Text>
                    <Text style={[styles.detailValue, { color: currentTheme.colors.highEmphasis }]}>
                      ${metadata.movieDetails.budget.toLocaleString()}
                    </Text>
                  </View>
                )}
                {metadata.movieDetails.revenue && metadata.movieDetails.revenue > 0 && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: currentTheme.colors.textMuted }]}>
                      Revenue
                    </Text>
                    <Text style={[styles.detailValue, { color: currentTheme.colors.highEmphasis }]}>
                      ${metadata.movieDetails.revenue.toLocaleString()}
                    </Text>
                  </View>
                )}
              </>
            )}

            {/* Series-specific details */}
            {type === 'series' && metadata.tvDetails && (
              <>
                {metadata.tvDetails.status && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: currentTheme.colors.textMuted }]}>
                      Status
                    </Text>
                    <Text style={[styles.detailValue, { color: currentTheme.colors.highEmphasis }]}>
                      {metadata.tvDetails.status}
                    </Text>
                  </View>
                )}
                {metadata.tvDetails.firstAirDate && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: currentTheme.colors.textMuted }]}>
                      First Air Date
                    </Text>
                    <Text style={[styles.detailValue, { color: currentTheme.colors.highEmphasis }]}>
                      {formatDate(metadata.tvDetails.firstAirDate)}
                    </Text>
                  </View>
                )}
                {metadata.tvDetails.lastAirDate && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: currentTheme.colors.textMuted }]}>
                      Last Air Date
                    </Text>
                    <Text style={[styles.detailValue, { color: currentTheme.colors.highEmphasis }]}>
                      {formatDate(metadata.tvDetails.lastAirDate)}
                    </Text>
                  </View>
                )}
                {metadata.tvDetails.numberOfSeasons && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: currentTheme.colors.textMuted }]}>
                      Seasons
                    </Text>
                    <Text style={[styles.detailValue, { color: currentTheme.colors.highEmphasis }]}>
                      {metadata.tvDetails.numberOfSeasons}
                    </Text>
                  </View>
                )}
                {metadata.tvDetails.numberOfEpisodes && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: currentTheme.colors.textMuted }]}>
                      Total Episodes
                    </Text>
                    <Text style={[styles.detailValue, { color: currentTheme.colors.highEmphasis }]}>
                      {metadata.tvDetails.numberOfEpisodes}
                    </Text>
                  </View>
                )}
              </>
            )}

            {/* Common details */}
            {(details as any)?.originCountry && (details as any).originCountry.length > 0 && (
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: currentTheme.colors.textMuted }]}>
                  Origin Country
                </Text>
                <Text style={[styles.detailValue, { color: currentTheme.colors.highEmphasis }]}>
                  {(details as any).originCountry.join(', ')}
                </Text>
              </View>
            )}
            {(details as any)?.originalLanguage && (
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: currentTheme.colors.textMuted }]}>
                  Original Language
                </Text>
                <Text style={[styles.detailValue, { color: currentTheme.colors.highEmphasis }]}>
                  {(details as any).originalLanguage.toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Director/Creator Section */}
      {(metadata.directors?.length || metadata.creators?.length) && (
        <View style={styles.section}>
          {metadata.directors && metadata.directors.length > 0 && (
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: currentTheme.colors.textMuted }]}>
                Director{metadata.directors.length > 1 ? 's' : ''}
              </Text>
              <Text style={[styles.detailValue, { color: currentTheme.colors.highEmphasis }]}>
                {metadata.directors.join(', ')}
              </Text>
            </View>
          )}
          {metadata.creators && metadata.creators.length > 0 && (
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: currentTheme.colors.textMuted }]}>
                Creator{metadata.creators.length > 1 ? 's' : ''}
              </Text>
              <Text style={[styles.detailValue, { color: currentTheme.colors.highEmphasis }]}>
                {metadata.creators.join(', ')}
              </Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  castListContent: {
    paddingRight: 48,
  },
  castCardWrapper: {
    width: CAST_CARD_WIDTH,
  },
  castCard: {
    width: CAST_CARD_WIDTH,
    height: CAST_CARD_HEIGHT,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  castImage: {
    width: '100%',
    height: '100%',
  },
  castName: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
  castCharacter: {
    fontSize: 11,
    marginTop: 2,
  },
  detailsGrid: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  detailLabel: {
    fontSize: 14,
    width: 140,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    flex: 1,
  },
  tagline: {
    fontStyle: 'italic',
  },
});

export const TVDetailsTabContent = memo(TVDetailsTabContentComponent);
