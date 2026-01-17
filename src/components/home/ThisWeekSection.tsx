import React, { useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NavigationProp } from '@react-navigation/native';
import FastImage from '@d11/react-native-fast-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useIsTV } from '../../contexts/TVContext';
import { Focusable } from '../tv/Focusable';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { parseISO, format, isBefore } from 'date-fns';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useCalendarData } from '../../hooks/useCalendarData';
import { memoryManager } from '../../utils/memoryManager';

// Compute base sizes; actual tablet sizes will be adjusted inside component for responsiveness
const { width } = Dimensions.get('window');

// Dynamic poster calculation based on screen width - similar to CatalogSection
const calculatePosterLayout = (screenWidth: number, deviceType: string) => {
  const MIN_POSTER_WIDTH = deviceType === 'tv' ? 120 : deviceType === 'largeTablet' ? 160 : deviceType === 'tablet' ? 140 : 100;
  const MAX_POSTER_WIDTH = deviceType === 'tv' ? 150 : deviceType === 'largeTablet' ? 200 : deviceType === 'tablet' ? 180 : 130;
  const LEFT_PADDING = deviceType === 'tv' ? 24 : deviceType === 'largeTablet' ? 28 : deviceType === 'tablet' ? 24 : 16;
  const SPACING = deviceType === 'tv' ? 10 : deviceType === 'largeTablet' ? 10 : deviceType === 'tablet' ? 8 : 8;

  const availableWidth = screenWidth - LEFT_PADDING;
  let bestPosterWidth = deviceType === 'tv' ? 200 : deviceType === 'largeTablet' ? 180 : deviceType === 'tablet' ? 160 : 120;

  for (let n = 3; n <= 6; n++) {
    const usableWidth = availableWidth - 8;
    const posterWidth = (usableWidth - (n - 1) * SPACING) / (n + 0.25);
    if (posterWidth >= MIN_POSTER_WIDTH && posterWidth <= MAX_POSTER_WIDTH) {
      bestPosterWidth = posterWidth;
    }
  }

  return bestPosterWidth;
};

// Enhanced responsive breakpoints
const BREAKPOINTS = {
  phone: 0,
  tablet: 768,
  largeTablet: 1024,
  tv: 1440,
};

interface ThisWeekEpisode {
  id: string;
  seriesId: string;
  seriesName: string;
  title: string;
  poster: string;
  releaseDate: string;
  season: number;
  episode: number;
  isReleased: boolean;
  overview: string;
  vote_average: number;
  still_path: string | null;
  season_poster_path: string | null;
  // Grouping fields
  isGroup?: boolean;
  episodeCount?: number;
  episodeRange?: string;
}

export const ThisWeekSection = React.memo(() => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { currentTheme } = useTheme();
  const { calendarData, loading } = useCalendarData();
  const isTVDevice = useIsTV();
  const flatListRef = useRef<FlatList>(null);

  // Enhanced responsive sizing for tablets and TV screens
  const deviceWidth = Dimensions.get('window').width;
  const deviceHeight = Dimensions.get('window').height;

  // Determine device type based on width
  const getDeviceType = useCallback(() => {
    if (deviceWidth >= BREAKPOINTS.tv) return 'tv';
    if (deviceWidth >= BREAKPOINTS.largeTablet) return 'largeTablet';
    if (deviceWidth >= BREAKPOINTS.tablet) return 'tablet';
    return 'phone';
  }, [deviceWidth]);

  const deviceType = getDeviceType();
  const isTablet = deviceType === 'tablet';
  const isLargeTablet = deviceType === 'largeTablet';
  const isTV = deviceType === 'tv';
  const isLargeScreen = isTablet || isLargeTablet || isTV;

  // Enhanced responsive sizing - poster style (2:3 aspect ratio like CatalogSection)
  const computedItemWidth = useMemo(() => {
    const baseWidth = calculatePosterLayout(deviceWidth, deviceType);
    // Apply size multiplier similar to ContentItem
    const sizeMultiplier = isTVDevice ? 0.7 : isLargeTablet ? 1.1 : isTablet ? 1.0 : 0.9;
    return baseWidth * sizeMultiplier;
  }, [deviceType, deviceWidth, isTVDevice, isLargeTablet, isTablet]);

  // Height calculated from width using 2:3 aspect ratio (poster style)
  const computedItemHeight = useMemo(() => {
    return computedItemWidth * 1.5; // 2:3 aspect ratio
  }, [computedItemWidth]);

  // Enhanced spacing and padding
  const horizontalPadding = useMemo(() => {
    switch (deviceType) {
      case 'tv':
        return 32;
      case 'largeTablet':
        return 28;
      case 'tablet':
        return 24;
      default:
        return 16; // phone
    }
  }, [deviceType]);

  const itemSpacing = useMemo(() => {
    switch (deviceType) {
      case 'tv':
        return 20;
      case 'largeTablet':
        return 18;
      case 'tablet':
        return 16;
      default:
        return 16; // phone
    }
  }, [deviceType]);

  // Use the already memory-optimized calendar data instead of fetching separately
  const thisWeekEpisodes = useMemo(() => {
    const thisWeekSection = calendarData.find(section => section.title === 'This Week');
    if (!thisWeekSection) return [];

    // Get raw episodes (limit to 60 to be safe for performance but allow grouping)
    const rawEpisodes = memoryManager.limitArraySize(thisWeekSection.data, 60);

    // Group by series and date
    const groups: Record<string, typeof rawEpisodes> = {};

    rawEpisodes.forEach(ep => {
      // Create a unique key for series + date
      const dateKey = ep.releaseDate || 'unknown';
      const key = `${ep.seriesId}_${dateKey}`;

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(ep);
    });

    const processedItems: ThisWeekEpisode[] = [];

    Object.values(groups).forEach(group => {
      // Sort episodes in the group by episode number
      group.sort((a, b) => a.episode - b.episode);

      const firstEp = group[0];
      const isReleased = firstEp.releaseDate ? isBefore(parseISO(firstEp.releaseDate), new Date()) : false;

      if (group.length === 1) {
        processedItems.push({
          ...firstEp,
          isReleased
        });
      } else {
        // Create group item
        const lastEp = group[group.length - 1];
        processedItems.push({
          ...firstEp,
          id: `group_${firstEp.seriesId}_${firstEp.releaseDate}`, // Unique ID for the group
          title: `${group.length} New Episodes`,
          isReleased,
          isGroup: true,
          episodeCount: group.length,
          episodeRange: `E${firstEp.episode}-${lastEp.episode}`
        });
      }
    });

    // Sort by release date
    processedItems.sort((a, b) => {
      if (!a.releaseDate) return 1;
      if (!b.releaseDate) return -1;
      return a.releaseDate.localeCompare(b.releaseDate);
    });

    return memoryManager.limitArraySize(processedItems, 20);
  }, [calendarData]);

  const handleEpisodePress = (episode: ThisWeekEpisode) => {
    // For grouped episodes, always go to series details
    if (episode.isGroup) {
      navigation.navigate('Metadata', {
        id: episode.seriesId,
        type: 'series'
      });
      return;
    }

    // For upcoming episodes, go to the metadata screen
    if (!episode.isReleased) {
      const episodeId = `${episode.seriesId}:${episode.season}:${episode.episode}`;
      navigation.navigate('Metadata', {
        id: episode.seriesId,
        type: 'series',
        episodeId
      });
      return;
    }

    // For released episodes, go to the streams screen
    const episodeId = `${episode.seriesId}:${episode.season}:${episode.episode}`;
    navigation.navigate('Streams', {
      id: episode.seriesId,
      type: 'series',
      episodeId
    });
  };

  const handleViewAll = () => {
    navigation.navigate('Calendar' as any);
  };

  // Handle focus on episode item to scroll it into view for TV
  const handleEpisodeFocus = useCallback((index: number) => {
    if (isTVDevice && flatListRef.current) {
      flatListRef.current.scrollToIndex({
        index,
        animated: false,
        viewPosition: 0.1, // Align near the left
      });
    }
  }, [isTVDevice]);

  if (thisWeekEpisodes.length === 0) {
    return null;
  }

  const renderEpisodeItem = ({ item, index }: { item: ThisWeekEpisode, index: number }) => {
    // Handle episodes without release dates gracefully
    const releaseDate = item.releaseDate ? parseISO(item.releaseDate) : null;
    const formattedDate = releaseDate ? format(releaseDate, 'MMM d') : 'TBA';
    const isReleased = item.isReleased;

    // Use series poster as primary image (like catalog sections)
    const imageUrl = item.poster;

    // Calculate border radius similar to ContentItem
    const borderRadius = isTV ? 12 : isLargeTablet ? 14 : isTablet ? 12 : 12;

    const cardContent = (focused?: boolean) => (
      <View style={[styles.imageContainer, { borderRadius }]}>
        <FastImage
          source={{
            uri: imageUrl || undefined,
            priority: FastImage.priority.normal,
            cache: FastImage.cacheControl.immutable
          }}
          style={[styles.poster, { borderRadius }]}
          resizeMode={FastImage.resizeMode.cover}
        />

        {/* Status badge in top-right corner */}
        <View style={[
          styles.statusBadge,
          { backgroundColor: isReleased ? currentTheme.colors.primary : 'rgba(0,0,0,0.7)' }
        ]}>
          <Text style={[styles.statusText, { fontSize: isTV ? 10 : 9 }]}>
            {isReleased ? (item.isGroup ? 'Released' : 'New') : formattedDate}
          </Text>
        </View>

        {/* Episode count badge for grouped episodes */}
        {item.isGroup && (
          <View style={[styles.episodeCountBadge, { backgroundColor: currentTheme.colors.primary }]}>
            <Text style={[styles.episodeCountText, { fontSize: isTV ? 10 : 9 }]}>
              {item.episodeCount}
            </Text>
          </View>
        )}
      </View>
    );

    // Total height including metadata below card
    const metadataHeight = isTV ? 50 : isLargeTablet ? 46 : isTablet ? 44 : 42;
    const totalHeight = computedItemHeight + metadataHeight;

    // Metadata section below the poster (like catalog titles)
    const metadataSection = (
      <View style={styles.metadataContainer}>
        <Text
          style={[
            styles.seriesName,
            {
              color: currentTheme.colors.text,
              fontSize: isTV ? 14 : isLargeTablet ? 14 : isTablet ? 13 : 12
            }
          ]}
          numberOfLines={1}
        >
          {item.seriesName}
        </Text>
        <Text
          style={[
            styles.episodeInfo,
            {
              color: currentTheme.colors.textMuted,
              fontSize: isTV ? 12 : isLargeTablet ? 12 : isTablet ? 11 : 10
            }
          ]}
          numberOfLines={1}
        >
          S{item.season} {item.isGroup ? item.episodeRange : `E${item.episode}`} • {isReleased ? (item.isGroup ? 'Released' : 'New') : formattedDate}
        </Text>
      </View>
    );

    if (isTVDevice) {
      return (
        <View style={[styles.episodeItemContainer, { width: computedItemWidth }]}>
          {/* Stack effect for grouped episodes */}
          {item.isGroup && (
            <View style={[
              styles.cardStackEffect,
              {
                backgroundColor: 'rgba(255,255,255,0.08)',
                borderColor: 'rgba(255,255,255,0.05)',
                height: computedItemHeight,
              }
            ]} />
          )}
          <Focusable
            style={[
              styles.episodeItem,
              {
                width: computedItemWidth,
                height: computedItemHeight,
                backgroundColor: currentTheme.colors.elevation1,
                borderColor: 'rgba(255,255,255,0.15)',
                borderWidth: 1.5,
              }
            ]}
            onPress={() => handleEpisodePress(item)}
            onFocus={() => handleEpisodeFocus(index)}
            borderRadius={borderRadius}
            focusScale={1.08}
            showFocusBorder={true}
          >
            {(focused) => cardContent(focused)}
          </Focusable>
          {metadataSection}
        </View>
      );
    }

    return (
      <View style={[styles.episodeItemContainer, { width: computedItemWidth }]}>
        {/* Stack effect for grouped episodes */}
        {item.isGroup && (
          <View style={[
            styles.cardStackEffect,
            {
              backgroundColor: 'rgba(255,255,255,0.08)',
              borderColor: 'rgba(255,255,255,0.05)',
              height: computedItemHeight,
            }
          ]} />
        )}
        <TouchableOpacity
          style={[
            styles.episodeItem,
            {
              width: computedItemWidth,
              height: computedItemHeight,
              backgroundColor: currentTheme.colors.elevation1,
              borderColor: 'rgba(255,255,255,0.15)',
              borderWidth: 1.5,
            }
          ]}
          onPress={() => handleEpisodePress(item)}
          activeOpacity={0.7}
        >
          {cardContent()}
        </TouchableOpacity>
        {metadataSection}
      </View>
    );
  };

  return (
    <Animated.View
      style={styles.container}
      entering={FadeIn.duration(350)}
    >
      <View style={[styles.header, { paddingHorizontal: horizontalPadding }]}>
        <View style={styles.titleContainer}>
          <Text style={[
            styles.title,
            {
              color: currentTheme.colors.text,
              fontSize: isTV ? 32 : isLargeTablet ? 28 : isTablet ? 26 : 24
            }
          ]}>This Week</Text>
          <View style={[
            styles.titleUnderline,
            {
              backgroundColor: currentTheme.colors.primary,
              width: isTV ? 50 : isLargeTablet ? 45 : isTablet ? 40 : 40,
              height: isTV ? 4 : isLargeTablet ? 3.5 : isTablet ? 3 : 3
            }
          ]} />
        </View>
        {isTVDevice ? (
          <Focusable
            onPress={handleViewAll}
            style={[
              styles.viewAllButton,
              {
                paddingVertical: isTV ? 12 : isLargeTablet ? 10 : isTablet ? 8 : 8,
                paddingHorizontal: isTV ? 16 : isLargeTablet ? 14 : isTablet ? 12 : 10
              }
            ]}
            borderRadius={20}
            focusScale={1.1}
            showFocusBorder={true}
          >
            {(focused) => (
              <>
                <Text style={[
                  styles.viewAllText,
                  {
                    color: focused ? currentTheme.colors.primary : currentTheme.colors.textMuted,
                    fontSize: isTV ? 18 : isLargeTablet ? 16 : isTablet ? 15 : 14
                  }
                ]}>View All</Text>
                <MaterialIcons
                  name="chevron-right"
                  size={isTV ? 24 : isLargeTablet ? 22 : isTablet ? 20 : 20}
                  color={focused ? currentTheme.colors.primary : currentTheme.colors.textMuted}
                />
              </>
            )}
          </Focusable>
        ) : (
          <TouchableOpacity onPress={handleViewAll} style={[
            styles.viewAllButton,
            {
              paddingVertical: isTV ? 12 : isLargeTablet ? 10 : isTablet ? 8 : 8,
              paddingHorizontal: isTV ? 16 : isLargeTablet ? 14 : isTablet ? 12 : 10
            }
          ]}>
            <Text style={[
              styles.viewAllText,
              {
                color: currentTheme.colors.textMuted,
                fontSize: isTV ? 18 : isLargeTablet ? 16 : isTablet ? 15 : 14
              }
            ]}>View All</Text>
            <MaterialIcons
              name="chevron-right"
              size={isTV ? 24 : isLargeTablet ? 22 : isTablet ? 20 : 20}
              color={currentTheme.colors.textMuted}
            />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        ref={flatListRef}
        data={thisWeekEpisodes}
        keyExtractor={(item) => item.id}
        renderItem={renderEpisodeItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEnabled={!isTVDevice}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingLeft: horizontalPadding,
            paddingRight: horizontalPadding
          }
        ]}
        snapToInterval={computedItemWidth + itemSpacing}
        decelerationRate="fast"
        snapToAlignment="start"
        initialNumToRender={isTV ? 6 : isLargeTablet ? 5 : isTablet ? 4 : 3}
        windowSize={isTV ? 4 : isLargeTablet ? 4 : 3}
        maxToRenderPerBatch={isTV ? 4 : isLargeTablet ? 4 : 3}
        removeClippedSubviews
        getItemLayout={(data, index) => {
          const length = computedItemWidth + itemSpacing;
          const offset = length * index;
          return { length, offset, index };
        }}
        ItemSeparatorComponent={() => <View style={{ width: itemSpacing }} />}
      />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginBottom: 28,
    overflow: 'visible',
    zIndex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleContainer: {
    position: 'relative',
    flex: 1,
    marginRight: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  titleUnderline: {
    position: 'absolute',
    bottom: -2,
    left: 0,
    width: 40,
    height: 3,
    borderRadius: 2,
    opacity: 0.8,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '600',
    marginRight: 4,
  },
  listContent: {
    paddingBottom: 8,
    overflow: 'visible',
    paddingVertical: 8,
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '500',
  },
  episodeItemContainer: {
    overflow: 'visible',
  },
  episodeItem: {
    borderRadius: 12,
    overflow: 'visible',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
    marginBottom: 8,
  },
  imageContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  statusBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  statusText: {
    color: '#fff',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  episodeCountBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    minWidth: 22,
    alignItems: 'center',
  },
  episodeCountText: {
    color: '#fff',
    fontWeight: '700',
  },
  metadataContainer: {
    marginTop: 6,
    paddingHorizontal: 2,
  },
  seriesName: {
    fontWeight: '600',
    marginBottom: 2,
  },
  episodeInfo: {
    fontWeight: '500',
  },
  cardStackEffect: {
    position: 'absolute',
    top: -4,
    width: '92%',
    left: '4%',
    borderRadius: 12,
    borderWidth: 1,
    zIndex: -1,
  },
}); 