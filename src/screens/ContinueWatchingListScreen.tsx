import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  RefreshControl,
  Dimensions,
  Platform,
  findNodeHandle,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NavigationProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useTheme } from '../contexts/ThemeContext';
import FastImage from '@d11/react-native-fast-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useIsTV } from '../contexts/TVContext';
import { Focusable } from '../components/tv/Focusable';
import { useTVFocus } from '../contexts/TVFocusContext';
import { StreamingContent, catalogService } from '../services/catalogService';
import { storageService } from '../services/storageService';
import { logger } from '../utils/logger';
import { TraktService } from '../services/traktService';
import { stremioService } from '../services/stremioService';
import { streamCacheService } from '../services/streamCacheService';
import { useSettings } from '../hooks/useSettings';
import * as Haptics from 'expo-haptics';
import CustomAlert from '../components/CustomAlert';

// Interface for continue watching items
interface ContinueWatchingItem extends StreamingContent {
  progress: number;
  lastUpdated: number;
  season?: number;
  episode?: number;
  episodeTitle?: string;
}

// Constants
const ANDROID_STATUSBAR_HEIGHT = StatusBar.currentHeight || 0;
const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

// Dynamic layout calculation
const calculateLayout = (screenWidth: number, isTV: boolean = false) => {
  const MIN_ITEM_WIDTH = 280;
  const MAX_ITEM_WIDTH = isTV ? 320 : 350;
  const TV_ITEM_GAP = 16;
  const HORIZONTAL_PADDING = screenWidth >= 1200 ? SPACING.xl * 3 : screenWidth >= 1000 ? SPACING.xl * 2 : SPACING.lg * 2;
  const ITEM_SPACING = isTV ? TV_ITEM_GAP : SPACING.md;

  const availableWidth = screenWidth - HORIZONTAL_PADDING;
  const maxColumns = Math.floor(availableWidth / (MIN_ITEM_WIDTH + ITEM_SPACING));

  let numColumns;
  if (screenWidth < 600) {
    numColumns = 1;
  } else if (screenWidth < 900) {
    numColumns = Math.min(Math.max(maxColumns, 1), 2);
  } else if (screenWidth < 1200) {
    numColumns = Math.min(Math.max(maxColumns, 2), 3);
  } else {
    numColumns = Math.min(Math.max(maxColumns, 3), 4);
  }

  const totalSpacing = ITEM_SPACING * (numColumns - 1);
  const itemWidth = (availableWidth - totalSpacing) / numColumns;
  const finalItemWidth = Math.floor(Math.min(itemWidth, MAX_ITEM_WIDTH));

  return {
    numColumns,
    itemWidth: finalItemWidth,
    itemSpacing: ITEM_SPACING,
    containerPadding: HORIZONTAL_PADDING / 2,
  };
};

// Check if episode is released
const isEpisodeReleased = (video: any): boolean => {
  if (!video.released) return false;
  try {
    const releaseDate = new Date(video.released);
    return releaseDate <= new Date();
  } catch {
    return false;
  }
};

// Find next episode
const findNextEpisode = (currentSeason: number, currentEpisode: number, videos: any[]) => {
  if (!videos || !Array.isArray(videos)) return null;

  const sortedVideos = [...videos].sort((a, b) => {
    if (a.season !== b.season) return a.season - b.season;
    return a.episode - b.episode;
  });

  let nextEp = sortedVideos.find(v => v.season === currentSeason && v.episode === currentEpisode + 1);
  if (!nextEp) {
    nextEp = sortedVideos.find(v => v.season === currentSeason + 1 && v.episode === 1);
  }
  if (!nextEp) {
    const currentIndex = sortedVideos.findIndex(v => v.season === currentSeason && v.episode === currentEpisode);
    if (currentIndex !== -1 && currentIndex + 1 < sortedVideos.length) {
      nextEp = sortedVideos[currentIndex + 1];
    }
  }

  if (nextEp && isEpisodeReleased(nextEp)) {
    return nextEp;
  }
  return null;
};

const ContinueWatchingListScreen = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { currentTheme } = useTheme();
  const { settings } = useSettings();
  const isTVDevice = useIsTV();
  const { getMenuFirstItemNodeHandle } = useTVFocus();

  const [items, setItems] = useState<ContinueWatchingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  // Alert state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertActions, setAlertActions] = useState<any[]>([]);

  // Layout
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));
  const layout = useMemo(() => calculateLayout(dimensions.width, isTVDevice), [dimensions.width, isTVDevice]);

  // TV refs
  const itemRefs = useRef<Map<number, View | null>>(new Map());
  const itemNodeHandles = useRef<Map<number, number>>(new Map());
  const backButtonRef = useRef<View>(null);

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });
    return () => subscription?.remove();
  }, []);

  // Metadata cache
  const metadataCache = useRef<Record<string, { metadata: any; basicContent: StreamingContent | null; timestamp: number }>>({});
  const CACHE_DURATION = 5 * 60 * 1000;

  const getCachedMetadata = useCallback(async (type: string, id: string) => {
    const cacheKey = `${type}:${id}`;
    const cached = metadataCache.current[cacheKey];
    const now = Date.now();

    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      return cached;
    }

    try {
      const shouldFetchMeta = await stremioService.isValidContentId(type, id);
      const [metadata, basicContent] = await Promise.all([
        shouldFetchMeta ? stremioService.getMetaDetails(type, id) : Promise.resolve(null),
        catalogService.getBasicContentDetails(type, id)
      ]);

      if (basicContent) {
        const result = { metadata, basicContent, timestamp: now };
        metadataCache.current[cacheKey] = result;
        return result;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  // Load continue watching items
  const loadItems = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);

    try {
      const allProgress = await storageService.getAllWatchProgress();
      if (Object.keys(allProgress).length === 0) {
        setItems([]);
        return;
      }

      // Group progress items by content ID
      const contentGroups: Record<string, { type: string; id: string; episodes: Array<{ key: string; episodeId?: string; progress: any; progressPercent: number }> }> = {};
      for (const key in allProgress) {
        const keyParts = key.split(':');
        const [type, id, ...episodeIdParts] = keyParts;
        const episodeId = episodeIdParts.length > 0 ? episodeIdParts.join(':') : undefined;
        const progress = allProgress[key];
        const progressPercent = (progress.currentTime / progress.duration) * 100;

        if (type === 'movie' && progressPercent >= 85) continue;
        if (type === 'movie' && (!isFinite(progressPercent) || progressPercent <= 0)) continue;

        const contentKey = `${type}:${id}`;
        if (!contentGroups[contentKey]) contentGroups[contentKey] = { type, id, episodes: [] };
        contentGroups[contentKey].episodes.push({ key, episodeId, progress, progressPercent });
      }

      const results: ContinueWatchingItem[] = [];

      // Process each content group
      for (const group of Object.values(contentGroups)) {
        try {
          const cachedData = await getCachedMetadata(group.type, group.id);
          if (!cachedData?.basicContent) continue;
          const { metadata, basicContent } = cachedData;

          for (const episode of group.episodes) {
            const { episodeId, progress, progressPercent } = episode;

            // Check if removed
            const isRemoved = await storageService.isContinueWatchingRemoved(group.id, group.type);
            if (isRemoved) continue;

            if (group.type === 'series' && progressPercent >= 85) {
              // Find next episode
              if (episodeId) {
                let currentSeason: number | undefined;
                let currentEpisode: number | undefined;

                const match = episodeId.match(/s(\d+)e(\d+)/i);
                if (match) {
                  currentSeason = parseInt(match[1], 10);
                  currentEpisode = parseInt(match[2], 10);
                } else {
                  const parts = episodeId.split(':');
                  if (parts.length >= 2) {
                    const seasonNum = parseInt(parts[parts.length - 2], 10);
                    const episodeNum = parseInt(parts[parts.length - 1], 10);
                    if (!isNaN(seasonNum) && !isNaN(episodeNum)) {
                      currentSeason = seasonNum;
                      currentEpisode = episodeNum;
                    }
                  }
                }

                if (currentSeason !== undefined && currentEpisode !== undefined && metadata?.videos) {
                  const nextEpisodeVideo = findNextEpisode(currentSeason, currentEpisode, metadata.videos);
                  if (nextEpisodeVideo) {
                    results.push({
                      ...basicContent,
                      id: group.id,
                      type: group.type,
                      progress: 0,
                      lastUpdated: progress.lastUpdated,
                      season: nextEpisodeVideo.season,
                      episode: nextEpisodeVideo.episode,
                      episodeTitle: `Episode ${nextEpisodeVideo.episode}`,
                    } as ContinueWatchingItem);
                  }
                }
              }
              continue;
            }

            let season: number | undefined;
            let episodeNumber: number | undefined;
            let episodeTitle: string | undefined;

            if (episodeId && group.type === 'series') {
              let match = episodeId.match(/s(\d+)e(\d+)/i);
              if (match) {
                season = parseInt(match[1], 10);
                episodeNumber = parseInt(match[2], 10);
                episodeTitle = `Episode ${episodeNumber}`;
              } else {
                const parts = episodeId.split(':');
                if (parts.length >= 3) {
                  const seasonPart = parts[parts.length - 2];
                  const episodePart = parts[parts.length - 1];
                  const seasonNum = parseInt(seasonPart, 10);
                  const episodeNum = parseInt(episodePart, 10);
                  if (!isNaN(seasonNum) && !isNaN(episodeNum)) {
                    season = seasonNum;
                    episodeNumber = episodeNum;
                    episodeTitle = `Episode ${episodeNumber}`;
                  }
                }
              }
            }

            results.push({
              ...basicContent,
              progress: progressPercent,
              lastUpdated: progress.lastUpdated,
              season,
              episode: episodeNumber,
              episodeTitle,
            } as ContinueWatchingItem);
          }
        } catch {
          // Continue with other groups
        }
      }

      // Sort by last updated
      results.sort((a, b) => (b.lastUpdated ?? 0) - (a.lastUpdated ?? 0));
      setItems(results);
    } catch (error) {
      logger.error('[ContinueWatchingList] Error loading items:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getCachedMetadata]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useFocusEffect(
    useCallback(() => {
      loadItems(true);
      return () => {};
    }, [loadItems])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadItems(true);
  }, [loadItems]);

  const handleContentPress = useCallback(async (item: ContinueWatchingItem) => {
    try {
      if (!settings.useCachedStreams) {
        if (settings.openMetadataScreenWhenCacheDisabled) {
          if (item.type === 'series' && item.season && item.episode) {
            const episodeId = `${item.id}:${item.season}:${item.episode}`;
            navigation.navigate('Metadata', { id: item.id, type: item.type, episodeId });
          } else {
            navigation.navigate('Metadata', { id: item.id, type: item.type });
          }
        } else {
          if (item.type === 'series' && item.season && item.episode) {
            const episodeId = `${item.id}:${item.season}:${item.episode}`;
            navigation.navigate('Streams', { id: item.id, type: item.type, episodeId });
          } else {
            navigation.navigate('Streams', { id: item.id, type: item.type });
          }
        }
        return;
      }

      const episodeId = item.type === 'series' && item.season && item.episode
        ? `${item.id}:${item.season}:${item.episode}`
        : undefined;

      const cachedStream = await streamCacheService.getCachedStream(item.id, item.type, episodeId);

      if (cachedStream) {
        const playerRoute = Platform.OS === 'ios' ? 'PlayerIOS' : 'PlayerAndroid';
        navigation.navigate(playerRoute as any, {
          uri: cachedStream.stream.url,
          title: cachedStream.metadata?.name || item.name,
          episodeTitle: cachedStream.episodeTitle || (item.type === 'series' ? `Episode ${item.episode}` : undefined),
          season: cachedStream.season || item.season,
          episode: cachedStream.episode || item.episode,
          quality: (cachedStream.stream.title?.match(/(\d+)p/) || [])[1] || undefined,
          year: cachedStream.metadata?.year || item.year,
          streamProvider: cachedStream.stream.addonId || cachedStream.stream.addonName || cachedStream.stream.name,
          streamName: cachedStream.stream.name || cachedStream.stream.title || 'Unnamed Stream',
          headers: cachedStream.stream.headers || undefined,
          id: item.id,
          type: item.type,
          episodeId: episodeId,
          imdbId: cachedStream.imdbId || cachedStream.metadata?.imdbId || item.imdb_id,
          backdrop: cachedStream.metadata?.backdrop || item.banner,
          videoType: undefined,
        } as any);
        return;
      }

      if (item.type === 'series' && item.season && item.episode) {
        navigation.navigate('Streams', { id: item.id, type: item.type, episodeId });
      } else {
        navigation.navigate('Streams', { id: item.id, type: item.type });
      }
    } catch (error) {
      if (item.type === 'series' && item.season && item.episode) {
        const episodeId = `${item.id}:${item.season}:${item.episode}`;
        navigation.navigate('Streams', { id: item.id, type: item.type, episodeId });
      } else {
        navigation.navigate('Streams', { id: item.id, type: item.type });
      }
    }
  }, [navigation, settings.useCachedStreams, settings.openMetadataScreenWhenCacheDisabled]);

  const handleLongPress = useCallback((item: ContinueWatchingItem) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    setAlertTitle('Remove from Continue Watching');
    setAlertMessage(`Remove "${item.name}" from your continue watching list?`);
    setAlertActions([
      {
        label: 'Cancel',
        style: { color: '#888' },
        onPress: () => {},
      },
      {
        label: 'Remove',
        style: { color: currentTheme.colors.error },
        onPress: async () => {
          setDeletingItemId(item.id);
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await storageService.removeAllWatchProgressForContent(item.id, item.type, { addBaseTombstone: true });
            const traktService = TraktService.getInstance();
            const isAuthed = await traktService.isAuthenticated();
            if (isAuthed) {
              if (item.type === 'movie') {
                await traktService.removeMovieFromHistory(item.id);
              } else if (item.type === 'series' && item.season !== undefined && item.episode !== undefined) {
                await traktService.removeEpisodeFromHistory(item.id, item.season, item.episode);
              } else {
                await traktService.removeShowFromHistory(item.id);
              }
            }
            await storageService.addContinueWatchingRemoved(item.id, item.type);
            setItems(prev => prev.filter(i => i.id !== item.id));
          } catch (error) {
            logger.error('[ContinueWatchingList] Error removing item:', error);
          } finally {
            setDeletingItemId(null);
          }
        },
      },
    ]);
    setAlertVisible(true);
  }, [currentTheme.colors.error]);

  const registerItemRef = useCallback((index: number, view: View | null) => {
    if (view) {
      itemRefs.current.set(index, view);
      const handle = findNodeHandle(view);
      if (handle) {
        itemNodeHandles.current.set(index, handle);
      }
    }
  }, []);

  const renderItem = useCallback(({ item, index }: { item: ContinueWatchingItem; index: number }) => {
    const isUpNext = item.type === 'series' && item.progress === 0;

    const card = (
      <View
        style={[
          styles.item,
          {
            backgroundColor: currentTheme.colors.elevation1,
            borderColor: currentTheme.colors.border,
            width: layout.itemWidth,
          }
        ]}
      >
        {/* Poster */}
        <View style={styles.posterContainer}>
          <FastImage
            source={{
              uri: item.poster || 'https://via.placeholder.com/300x450',
              priority: FastImage.priority.high,
              cache: FastImage.cacheControl.immutable
            }}
            style={styles.poster}
            resizeMode={FastImage.resizeMode.cover}
          />
          {deletingItemId === item.id && (
            <View style={styles.deletingOverlay}>
              <ActivityIndicator size="small" color="#FFFFFF" />
            </View>
          )}
        </View>

        {/* Content Details */}
        <View style={styles.contentDetails}>
          <View style={styles.titleRow}>
            <Text style={[styles.contentTitle, { color: currentTheme.colors.highEmphasis }]} numberOfLines={1}>
              {item.name}
            </Text>
            {isUpNext && (
              <View style={[styles.badge, { backgroundColor: currentTheme.colors.primary }]}>
                <Text style={styles.badgeText}>Up Next</Text>
              </View>
            )}
          </View>

          {item.type === 'series' && item.season && item.episode ? (
            <Text style={[styles.subtitle, { color: currentTheme.colors.mediumEmphasis }]}>
              Season {item.season} - Episode {item.episode}
            </Text>
          ) : (
            <Text style={[styles.subtitle, { color: currentTheme.colors.mediumEmphasis }]}>
              {item.year} - {item.type === 'movie' ? 'Movie' : 'Series'}
            </Text>
          )}

          {/* Progress Bar */}
          {item.progress > 0 && (
            <View style={styles.progressContainer}>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressBar,
                    { width: `${item.progress}%`, backgroundColor: currentTheme.colors.primary }
                  ]}
                />
              </View>
              <Text style={[styles.progressText, { color: currentTheme.colors.textMuted }]}>
                {Math.round(item.progress)}% watched
              </Text>
            </View>
          )}
        </View>
      </View>
    );

    if (isTVDevice) {
      const rowIndex = Math.floor(index / layout.numColumns);
      const colIndex = index % layout.numColumns;
      const isFirstInRow = colIndex === 0;
      const isLastInRow = colIndex === layout.numColumns - 1 || index === items.length - 1;
      const isFirstRow = rowIndex === 0;

      let prevItemHandle: number | undefined;
      if (isFirstInRow) {
        prevItemHandle = getMenuFirstItemNodeHandle() ?? undefined;
      } else {
        prevItemHandle = itemNodeHandles.current.get(index - 1);
      }

      return (
        <Focusable
          key={`cw-list-${item.id}-${index}`}
          onPress={() => handleContentPress(item)}
          onLongPress={() => handleLongPress(item)}
          onLayout={() => registerItemRef(index, itemRefs.current.get(index) ?? null)}
          focusScale={1.03}
          borderRadius={12}
          showFocusBorder={true}
          animateBackground={false}
          nextFocusUp={isFirstRow ? backButtonRef : undefined}
          blockRight={isLastInRow}
          nextFocusLeftId={prevItemHandle}
        >
          {card}
        </Focusable>
      );
    }

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => handleContentPress(item)}
        onLongPress={() => handleLongPress(item)}
        delayLongPress={800}
      >
        {card}
      </TouchableOpacity>
    );
  }, [
    currentTheme.colors,
    layout,
    isTVDevice,
    items.length,
    deletingItemId,
    handleContentPress,
    handleLongPress,
    registerItemRef,
    getMenuFirstItemNodeHandle,
  ]);

  const styles = useMemo(() => createStyles(currentTheme.colors), [currentTheme.colors]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.colors.darkBackground }]}>
        <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={currentTheme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const backButton = (
    <TouchableOpacity
      style={styles.backButton}
      onPress={() => navigation.goBack()}
    >
      <MaterialIcons name="arrow-back" size={24} color={currentTheme.colors.primary} />
      <Text style={[styles.backText, { color: currentTheme.colors.primary }]}>Back</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.colors.darkBackground }]}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        {isTVDevice ? (
          <Focusable
            viewRef={backButtonRef}
            onPress={() => navigation.goBack()}
            focusScale={1.05}
            borderRadius={8}
            showFocusBorder={true}
            nextFocusLeftId={getMenuFirstItemNodeHandle() ?? undefined}
          >
            {backButton}
          </Focusable>
        ) : (
          backButton
        )}
      </View>

      <Text style={[styles.headerTitle, { color: currentTheme.colors.white }]}>
        Continue Watching
      </Text>

      {items.length === 0 ? (
        <View style={styles.centered}>
          <MaterialIcons name="play-circle-outline" size={64} color={currentTheme.colors.mediumEmphasis} />
          <Text style={[styles.emptyText, { color: currentTheme.colors.mediumEmphasis }]}>
            No items in your continue watching list
          </Text>
          <Text style={[styles.emptySubtext, { color: currentTheme.colors.textMuted }]}>
            Start watching something to see it here
          </Text>
        </View>
      ) : (
        <FlashList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item, index) => `cw-${item.id}-${item.type}-${index}`}
          numColumns={layout.numColumns}
          estimatedItemSize={120}
          contentContainerStyle={{
            padding: layout.containerPadding,
          }}
          ItemSeparatorComponent={() => <View style={{ height: layout.itemSpacing }} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={currentTheme.colors.primary}
              colors={[currentTheme.colors.primary]}
            />
          }
        />
      )}

      <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        actions={alertActions}
        onClose={() => setAlertVisible(false)}
      />
    </SafeAreaView>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? ANDROID_STATUSBAR_HEIGHT + 8 : 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  backText: {
    fontSize: 17,
    fontWeight: '400',
    marginLeft: 4,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 8,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: SPACING.lg,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  item: {
    flexDirection: 'row',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    height: 100,
  },
  posterContainer: {
    width: 70,
    height: '100%',
    position: 'relative',
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  deletingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentDetails: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  contentTitle: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  progressContainer: {
    marginTop: 'auto',
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    marginBottom: 4,
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '500',
  },
});

export default ContinueWatchingListScreen;
