import React, { useCallback, useMemo, useRef, memo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  NativeModules,
  NativeEventEmitter,
  Platform,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../../contexts/ThemeContext';
import { useSettings } from '../../../hooks/useSettings';
import { tmdbService } from '../../../services/tmdbService';
import { StreamingContent } from '../../../services/catalogService';
import { Episode } from '../../../types/metadata';
import { Focusable } from '../../tv/Focusable';
import { storageService } from '../../../services/storageService';
import { watchedService } from '../../../services/watchedService';
import { CustomAlert } from '../../CustomAlert';

const EPISODE_PLACEHOLDER = 'https://via.placeholder.com/500x280/1a1a1a/666666?text=No+Preview';

// Card dimensions for TV - sized to fit in tab section
const CARD_WIDTH = 200;
const CARD_HEIGHT = 112;
const CARD_SPACING = 10;

interface TVEpisodesTabContentProps {
  episodes: Episode[];
  groupedEpisodes: { [season: number]: Episode[] };
  selectedSeason: number;
  onSeasonChange?: (season: number) => void;
  onSelectEpisode?: (episode: Episode) => void;
  metadata: StreamingContent;
  firstContentItemRef: React.RefObject<View>;
  activeTabRef: React.RefObject<View>;
}

const TVEpisodesTabContentComponent: React.FC<TVEpisodesTabContentProps> = ({
  episodes,
  groupedEpisodes,
  selectedSeason,
  onSeasonChange,
  onSelectEpisode,
  metadata,
  firstContentItemRef,
  activeTabRef,
}) => {
  const { currentTheme } = useTheme();
  const { settings } = useSettings();
  const flatListRef = useRef<FlatList<Episode>>(null);

  // Long press detection for TV
  const LONG_PRESS_REPEAT_THRESHOLD = 3;
  const focusedEpisodeIndexRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);

  // Alert state for episode long press menu
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertActions, setAlertActions] = useState<Array<{ label: string; onPress: () => void; style?: object }>>([]);

  // Season dropdown state
  const [isSeasonDropdownOpen, setIsSeasonDropdownOpen] = useState(false);
  const seasonSelectorRef = useRef<View>(null);
  const seasonOptionRefs = useRef<Map<number, React.RefObject<View>>>(new Map());
  const dropdownFocusedRef = useRef(false);

  // Episode progress tracking
  const [episodeProgress, setEpisodeProgress] = useState<{ [key: string]: { currentTime: number; duration: number } }>({});

  // Get current season episodes - defined early for use in long press handler
  const currentSeasonEpisodes = useMemo(() => {
    return groupedEpisodes[selectedSeason] || [];
  }, [groupedEpisodes, selectedSeason]);

  // Get sorted seasons
  const seasons = useMemo(() => {
    return Object.keys(groupedEpisodes).map(Number).sort((a, b) => {
      if (a === 0) return 1;
      if (b === 0) return -1;
      return a - b;
    });
  }, [groupedEpisodes]);

  // Load episode progress
  useEffect(() => {
    const loadProgress = async () => {
      try {
        const allProgress = await storageService.getAllWatchProgress();
        const progressMap: { [key: string]: { currentTime: number; duration: number } } = {};

        // Keys from getAllWatchProgress have format: "series:${showId}:${showId}:${season}:${episode}"
        // We need to match and extract to our local key format: "${showId}:${season}:${episode}"
        const seriesPrefix = `series:${metadata?.id}:`;
        for (const [key, value] of Object.entries(allProgress)) {
          if (key.startsWith(seriesPrefix)) {
            // Extract the episodeId part (showId:season:episode)
            const episodeId = key.substring('series:'.length);
            progressMap[episodeId] = value as { currentTime: number; duration: number };
          }
        }
        setEpisodeProgress(progressMap);
      } catch (error) {
        // Silently fail - progress display is not critical
      }
    };

    if (metadata?.id) {
      loadProgress();
    }
  }, [metadata?.id]);

  // Build episode progress key that matches storage format
  const getEpisodeProgressKey = useCallback((episode: Episode): string => {
    // Storage key format after getAllWatchProgress strips prefix: "series:${showId}:${showId}:${season}:${episode}"
    // But we store in progressMap with just the part after "series:": "${showId}:${showId}:${season}:${episode}"
    return `${metadata?.id}:${metadata?.id}:${episode.season_number}:${episode.episode_number}`;
  }, [metadata?.id]);

  // Check if episode is watched (>= 85%) - defined early for use in long press handler
  const isEpisodeWatched = useCallback((episode: Episode): boolean => {
    const key = getEpisodeProgressKey(episode);
    const progress = episodeProgress[key];
    if (!progress) return false;
    const progressPercent = (progress.currentTime / progress.duration) * 100;
    return progressPercent >= 85;
  }, [episodeProgress, getEpisodeProgressKey]);

  // Check if episode has any progress
  const hasProgress = useCallback((episode: Episode): boolean => {
    const key = getEpisodeProgressKey(episode);
    return !!episodeProgress[key];
  }, [episodeProgress, getEpisodeProgressKey]);

  // Handle episode long press - show mark as watched / clear progress menu
  const handleEpisodeLongPress = useCallback((episode: Episode, episodeIndex: number) => {
    const watched = isEpisodeWatched(episode);
    const localStateKey = getEpisodeProgressKey(episode);

    const displayName = `"${episode.name}" S${episode.season_number}E${episode.episode_number}`;

    setAlertTitle('Episode Options');
    setAlertMessage(`What would you like to do with ${displayName}?`);

    setAlertActions([
      {
        label: 'Cancel',
        style: { color: '#888' },
        onPress: () => {},
      },
      {
        label: 'Clear Progress',
        style: { color: currentTheme.colors.error },
        onPress: async () => {
          try {
            // Clear watch progress for this episode using storageService API
            // storageService.removeWatchProgress expects (id, type, episodeId) where episodeId is "showId:season:episode"
            const storageEpisodeId = `${metadata?.id}:${episode.season_number}:${episode.episode_number}`;
            await storageService.removeWatchProgress(metadata?.id || '', 'series', storageEpisodeId);
            // Update local state with the key format we use for lookups
            setEpisodeProgress(prev => {
              const newProgress = { ...prev };
              delete newProgress[localStateKey];
              return newProgress;
            });
          } catch (error) {
            console.warn('[TVEpisodesTabContent] Error clearing progress:', error);
          }
        },
      },
      {
        label: watched ? 'Mark as Unwatched' : 'Mark as Watched',
        style: { color: currentTheme.colors.primary },
        onPress: async () => {
          try {
            if (watched) {
              // Clear progress to mark as unwatched
              const storageEpisodeId = `${metadata?.id}:${episode.season_number}:${episode.episode_number}`;
              await storageService.removeWatchProgress(metadata?.id || '', 'series', storageEpisodeId);
              setEpisodeProgress(prev => {
                const newProgress = { ...prev };
                delete newProgress[localStateKey];
                return newProgress;
              });
            } else {
              // Mark as watched (100% progress)
              await watchedService.markEpisodeAsWatched(
                metadata?.id || '',
                metadata?.id || '',
                episode.season_number,
                episode.episode_number
              );
              // Update local state to show as watched using the correct key format
              setEpisodeProgress(prev => ({
                ...prev,
                [localStateKey]: { currentTime: 100, duration: 100 }, // 100% progress
              }));
            }
          } catch (error) {
            console.warn('[TVEpisodesTabContent] Error updating watched status:', error);
          }
        },
      },
    ]);
    setAlertVisible(true);
  }, [currentTheme.colors.error, currentTheme.colors.primary, metadata?.id, isEpisodeWatched, getEpisodeProgressKey]);

  // Native event listener for TV long press detection
  useEffect(() => {
    if (Platform.OS !== 'android' || currentSeasonEpisodes.length === 0) return;

    const { TVKeyEvent } = NativeModules;
    if (!TVKeyEvent) return;

    const eventEmitter = new NativeEventEmitter(TVKeyEvent);
    const subscription = eventEmitter.addListener('onTVKeyEvent', (event: any) => {
      const { key, action, repeatCount } = event;

      // Only care about select button
      if (key !== 'select') return;

      // Reset long press flag on key up
      if (action === 'up') {
        longPressTriggeredRef.current = false;
        return;
      }

      // Trigger long press when repeatCount reaches threshold
      if (action === 'down' && repeatCount === LONG_PRESS_REPEAT_THRESHOLD && !longPressTriggeredRef.current) {
        const focusedIndex = focusedEpisodeIndexRef.current;
        if (focusedIndex !== null && focusedIndex >= 0 && focusedIndex < currentSeasonEpisodes.length) {
          longPressTriggeredRef.current = true;
          const episode = currentSeasonEpisodes[focusedIndex];
          handleEpisodeLongPress(episode, focusedIndex);
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [currentSeasonEpisodes, handleEpisodeLongPress]);

  // Episode refs for focus navigation
  const episodeRefs = useRef<Map<number, React.RefObject<View>>>(new Map());

  const getEpisodeRef = useCallback((index: number) => {
    if (!episodeRefs.current.has(index)) {
      episodeRefs.current.set(index, React.createRef<View>());
    }
    return episodeRefs.current.get(index)!;
  }, []);

  // Get season option ref
  const getSeasonOptionRef = useCallback((seasonNum: number) => {
    if (!seasonOptionRefs.current.has(seasonNum)) {
      seasonOptionRefs.current.set(seasonNum, React.createRef<View>());
    }
    return seasonOptionRefs.current.get(seasonNum)!;
  }, []);

  // Handle season selection
  const handleSeasonSelect = useCallback((seasonNum: number) => {
    onSeasonChange?.(seasonNum);
    setIsSeasonDropdownOpen(false);
  }, [onSeasonChange]);

  // Toggle dropdown
  const toggleSeasonDropdown = useCallback(() => {
    setIsSeasonDropdownOpen(prev => !prev);
  }, []);

  // Handle episode focus - scroll to keep in view and track focused index
  const handleEpisodeFocus = useCallback((index: number) => {
    // Track focused episode for long press detection
    focusedEpisodeIndexRef.current = index;

    if (flatListRef.current) {
      const offset = index * (CARD_WIDTH + CARD_SPACING);
      flatListRef.current.scrollToOffset({
        offset: Math.max(0, offset - 48),
        animated: false,
      });
    }
  }, []);

  // Resolve episode image
  const resolveEpisodeImage = useCallback((episode: Episode): string => {
    const candidates: Array<string | undefined | null> = [
      (episode as any).thumbnail,
      (episode as any).image,
      (episode as any).thumb,
      (episode as any)?.images?.still,
      episode.still_path,
    ];

    for (const cand of candidates) {
      if (!cand) continue;
      if (typeof cand === 'string' && (cand.startsWith('http://') || cand.startsWith('https://'))) {
        return cand;
      }
      if (typeof cand === 'string' && cand.startsWith('/') && settings?.enrichMetadataWithTMDB) {
        const tmdbUrl = tmdbService.getImageUrl(cand, 'original');
        if (tmdbUrl) return tmdbUrl;
      }
    }
    return metadata?.poster || EPISODE_PLACEHOLDER;
  }, [settings?.enrichMetadataWithTMDB, metadata?.poster]);

  // Memoize episode image sources to prevent unnecessary re-renders/re-downloads
  const episodeImageSources = useMemo(() => {
    return currentSeasonEpisodes.map(episode => ({
      uri: resolveEpisodeImage(episode)
    }));
  }, [currentSeasonEpisodes, resolveEpisodeImage]);

  // Render episode card
  const renderEpisodeCard = useCallback(({ item: episode, index }: { item: Episode; index: number }) => {
    const imageSource = episodeImageSources[index];
    const episodeNumber = typeof episode.episode_number === 'number' ? episode.episode_number.toString() : '';
    const episodeString = episodeNumber ? `E${episodeNumber}` : '';

    const isFirst = index === 0;
    const isLast = index === currentSeasonEpisodes.length - 1;
    const watched = isEpisodeWatched(episode);
    const hasAnyProgress = hasProgress(episode);

    // Check if we have multiple seasons (season selector is shown)
    const hasSeasonSelector = seasons.length > 1;

    return (
      <View style={[styles.cardWrapper, { width: CARD_WIDTH, marginRight: CARD_SPACING }]}>
        <Focusable
          viewRef={isFirst && !hasSeasonSelector ? firstContentItemRef : getEpisodeRef(index)}
          onPress={() => onSelectEpisode?.(episode)}
          onFocus={() => handleEpisodeFocus(index)}
          style={styles.card}
          borderRadius={16}
          focusScale={1.0}
          animateBackground={false}
          showFocusBorder={true}
          blockUp={false}
          blockLeft={isFirst && !hasSeasonSelector}
          blockRight={isLast}
          nextFocusUp={activeTabRef}
          nextFocusLeft={isFirst ? (hasSeasonSelector ? firstContentItemRef : undefined) : getEpisodeRef(index - 1)}
          nextFocusRight={!isLast ? getEpisodeRef(index + 1) : undefined}
        >
          {/* Background Image */}
          <FastImage
            source={imageSource}
            style={styles.cardImage}
            resizeMode={FastImage.resizeMode.cover}
          />

          {/* Gradient Overlay */}
          <LinearGradient
            colors={[
              'rgba(0,0,0,0.05)',
              'rgba(0,0,0,0.2)',
              'rgba(0,0,0,0.6)',
              'rgba(0,0,0,0.9)',
            ]}
            locations={[0, 0.3, 0.6, 1]}
            style={styles.cardGradient}
          >
            {/* Episode Title at bottom */}
            <View style={styles.cardContent}>
              <Text style={styles.episodeTitle} numberOfLines={2}>
                {episode.name}
              </Text>
            </View>
          </LinearGradient>

          {/* Top Left: Episode Number Badge */}
          <View style={styles.topLeftBadge}>
            <Text style={styles.episodeBadgeText}>{episodeString}</Text>
          </View>

          {/* Watched Indicator - positioned top right */}
          {watched ? (
            <View style={[styles.watchedIndicator, { backgroundColor: currentTheme.colors.primary }]}>
              <MaterialIcons name="check" size={14} color="#fff" />
            </View>
          ) : !hasAnyProgress ? (
            <View style={[styles.unwatchedIndicator, { borderColor: currentTheme.colors.textMuted }]} />
          ) : null}
        </Focusable>
      </View>
    );
  }, [currentSeasonEpisodes.length, currentTheme.colors.primary, currentTheme.colors.textMuted, firstContentItemRef, activeTabRef, getEpisodeRef, handleEpisodeFocus, hasProgress, isEpisodeWatched, onSelectEpisode, episodeImageSources, seasons.length]);

  // Key extractor
  const keyExtractor = useCallback((episode: Episode) => episode.id.toString(), []);

  // Get item layout for fast scrolling
  const getItemLayout = useCallback((_: any, index: number) => ({
    length: CARD_WIDTH + CARD_SPACING,
    offset: (CARD_WIDTH + CARD_SPACING) * index,
    index,
  }), []);

  if (currentSeasonEpisodes.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialIcons name="schedule" size={48} color={currentTheme.colors.textMuted} />
        <Text style={[styles.emptyText, { color: currentTheme.colors.text }]}>
          No episodes available for Season {selectedSeason}
        </Text>
      </View>
    );
  }

  return (
    <>
    <View style={styles.container}>
      {/* Season Selector */}
      {seasons.length > 1 && (
        <View style={styles.seasonHeader}>
          {/* Season Dropdown Button */}
          <View style={styles.seasonSelectorContainer}>
            <Focusable
              viewRef={firstContentItemRef}
              onPress={toggleSeasonDropdown}
              style={[
                styles.seasonSelector,
                { backgroundColor: 'rgba(255,255,255,0.1)' },
              ]}
              borderRadius={8}
              focusScale={1.0}
              animateBackground={false}
              showFocusBorder={true}
              blockLeft={true}
              nextFocusUp={activeTabRef}
              nextFocusDown={getEpisodeRef(0)}
              nextFocusRight={getEpisodeRef(0)}
            >
              <Text style={[styles.seasonSelectorText, { color: currentTheme.colors.highEmphasis }]}>
                Season {selectedSeason}
              </Text>
              <MaterialIcons
                name={isSeasonDropdownOpen ? "keyboard-arrow-up" : "keyboard-arrow-down"}
                size={20}
                color={currentTheme.colors.highEmphasis}
              />
            </Focusable>

            {/* Dropdown Options - appears above the button */}
            {isSeasonDropdownOpen && (
              <View style={[styles.seasonDropdown, { backgroundColor: (currentTheme.colors as any).cardBackground || 'rgba(30,30,30,0.98)' }]}>
                {seasons.map((seasonNum, index) => {
                  const isFirstOption = index === 0;
                  const isLastOption = index === seasons.length - 1;
                  const episodeCount = groupedEpisodes[seasonNum]?.length || 0;
                  const isSelected = selectedSeason === seasonNum;

                  return (
                    <Focusable
                      key={seasonNum}
                      viewRef={getSeasonOptionRef(seasonNum)}
                      onPress={() => handleSeasonSelect(seasonNum)}
                      onFocus={() => {
                        dropdownFocusedRef.current = true;
                      }}
                      onBlur={() => {
                        dropdownFocusedRef.current = false;
                        // Close dropdown after a brief delay to check if focus moved to another option
                        setTimeout(() => {
                          if (!dropdownFocusedRef.current) {
                            setIsSeasonDropdownOpen(false);
                          }
                        }, 100);
                      }}
                      autoFocus={isSelected}
                      style={[
                        styles.seasonOption,
                        isSelected && styles.seasonOptionSelected,
                      ]}
                      borderRadius={6}
                      focusScale={1.0}
                      animateBackground={false}
                      showFocusBorder={true}
                      blockLeft={true}
                      blockRight={true}
                      blockUp={isFirstOption}
                      blockDown={isLastOption}
                      nextFocusUp={!isFirstOption ? getSeasonOptionRef(seasons[index - 1]) : undefined}
                      nextFocusDown={!isLastOption ? getSeasonOptionRef(seasons[index + 1]) : undefined}
                    >
                      {(focused) => (
                        <>
                          <Text style={[
                            styles.seasonOptionText,
                            { color: focused ? '#fff' : (isSelected ? currentTheme.colors.primary : currentTheme.colors.highEmphasis) }
                          ]}>
                            Season {seasonNum === 0 ? 'Specials' : seasonNum}
                          </Text>
                          <Text style={[styles.seasonOptionEpisodes, { color: focused ? 'rgba(255,255,255,0.7)' : currentTheme.colors.textMuted }]}>
                            {episodeCount} eps
                          </Text>
                        </>
                      )}
                    </Focusable>
                  );
                })}
              </View>
            )}
          </View>

          {/* Episode Count */}
          <Text style={[styles.episodeCount, { color: currentTheme.colors.textMuted }]}>
            {currentSeasonEpisodes.length} Episodes
          </Text>
        </View>
      )}

      {/* Episode List */}
      <FlatList
        ref={flatListRef}
        data={currentSeasonEpisodes}
        renderItem={renderEpisodeCard}
        keyExtractor={keyExtractor}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false} // D-pad controls focus, not scrolling
        contentContainerStyle={styles.listContent}
        initialNumToRender={4}
        maxToRenderPerBatch={3}
        windowSize={5}
        removeClippedSubviews={true}
        getItemLayout={getItemLayout}
      />
    </View>

    {/* Long Press Menu Alert */}
    <CustomAlert
      visible={alertVisible}
      title={alertTitle}
      message={alertMessage}
      onClose={() => setAlertVisible(false)}
      actions={alertActions}
    />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  seasonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 16,
    zIndex: 100,
  },
  seasonSelectorContainer: {
    position: 'relative',
    zIndex: 100,
  },
  seasonSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  seasonSelectorText: {
    fontSize: 16,
    fontWeight: '700',
  },
  seasonDropdown: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    marginBottom: 4,
    borderRadius: 8,
    paddingVertical: 6,
    minWidth: 220,
    maxHeight: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  seasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 6,
    borderRadius: 6,
    gap: 24,
  },
  seasonOptionSelected: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  seasonOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  seasonOptionEpisodes: {
    fontSize: 12,
  },
  episodeCount: {
    fontSize: 14,
  },
  listContent: {
    paddingRight: 48,
  },
  cardWrapper: {
    height: CARD_HEIGHT,
  },
  card: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  cardImage: {
    ...StyleSheet.absoluteFillObject,
  },
  cardGradient: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  cardContent: {
    padding: 10,
  },
  topLeftBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  episodeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  episodeTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    lineHeight: 16,
  },
  watchedIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unwatchedIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderStyle: 'dashed',
    opacity: 0.7,
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

export const TVEpisodesTabContent = memo(TVEpisodesTabContentComponent);
