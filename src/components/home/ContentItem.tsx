import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { DeviceEventEmitter } from 'react-native';
import { View, TouchableOpacity, ActivityIndicator, StyleSheet, Dimensions, Platform, Text, Share } from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useSettings } from '../../hooks/useSettings';
import { catalogService, StreamingContent } from '../../services/catalogService';
import { DropUpMenu } from './DropUpMenu';
import { mmkvStorage } from '../../services/mmkvStorage';
import { storageService } from '../../services/storageService';
import { TraktService } from '../../services/traktService';
import { useTraktContext } from '../../contexts/TraktContext';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useIsTV } from '../../contexts/TVContext';
import { Focusable } from '../tv/Focusable';

interface ContentItemProps {
  item: StreamingContent;
  onPress: (id: string, type: string) => void;
  shouldLoadImage?: boolean;
  deferMs?: number;
  /** Called when this item receives focus (TV only) */
  onItemFocus?: () => void;
  /** Whether this is the first item in the row (TV only - constrains left navigation) */
  isFirstInRow?: boolean;
  /** Whether this is the last item in the row (TV only - constrains right navigation) */
  isLastInRow?: boolean;
  /** Whether this row is the last catalog row (TV only - constrains down navigation) */
  isLastRow?: boolean;
  /** Ref to this item's view for focus navigation (TV only) */
  focusRef?: React.RefObject<View>;
  /** Node handle for left focus navigation - used for first item to navigate to menu (TV only) */
  nextFocusLeftId?: number | null;
  /** Callback to register this item's node handle for sibling navigation (TV only) */
  onRegisterNodeHandle?: (view: View | null) => void;
  /** Override poster width (TV only - used for fixed grid layout) */
  tvPosterWidth?: number;
}

const { width } = Dimensions.get('window');

// Enhanced responsive breakpoints
const BREAKPOINTS = {
  phone: 0,
  tablet: 768,
  largeTablet: 1024,
  tv: 1440,
};

const getDeviceType = (screenWidth: number) => {
  if (screenWidth >= BREAKPOINTS.tv) return 'tv';
  if (screenWidth >= BREAKPOINTS.largeTablet) return 'largeTablet';
  if (screenWidth >= BREAKPOINTS.tablet) return 'tablet';
  return 'phone';
};

// Dynamic poster calculation based on screen width - show 1/4 of next poster
const calculatePosterLayout = (screenWidth: number) => {
  const deviceType = getDeviceType(screenWidth);

  // Responsive sizing based on device type - TV uses smaller posters to fit 2 rows on screen
  const MIN_POSTER_WIDTH = deviceType === 'tv' ? 120 : deviceType === 'largeTablet' ? 160 : deviceType === 'tablet' ? 140 : 100;
  const MAX_POSTER_WIDTH = deviceType === 'tv' ? 150 : deviceType === 'largeTablet' ? 200 : deviceType === 'tablet' ? 180 : 130;
  const LEFT_PADDING = deviceType === 'tv' ? 24 : deviceType === 'largeTablet' ? 28 : deviceType === 'tablet' ? 24 : 16;
  const SPACING = deviceType === 'tv' ? 10 : deviceType === 'largeTablet' ? 10 : deviceType === 'tablet' ? 8 : 8;

  // Calculate available width for posters (reserve space for left padding)
  const availableWidth = screenWidth - LEFT_PADDING;

  // Try different numbers of full posters to find the best fit
  let bestLayout = {
    numFullPosters: 3,
    posterWidth: deviceType === 'tv' ? 200 : deviceType === 'largeTablet' ? 180 : deviceType === 'tablet' ? 160 : 120
  };

  for (let n = 3; n <= 6; n++) {
    // Calculate poster width needed for N full posters + 0.25 partial poster
    // Formula: N * posterWidth + (N-1) * spacing + 0.25 * posterWidth = availableWidth - rightPadding
    // Simplified: posterWidth * (N + 0.25) + (N-1) * spacing = availableWidth - rightPadding
    // We'll use minimal right padding (8px) to maximize space
    const usableWidth = availableWidth - 8;
    const posterWidth = (usableWidth - (n - 1) * SPACING) / (n + 0.25);

    if (posterWidth >= MIN_POSTER_WIDTH && posterWidth <= MAX_POSTER_WIDTH) {
      bestLayout = { numFullPosters: n, posterWidth };
    }
  }

  return {
    numFullPosters: bestLayout.numFullPosters,
    posterWidth: bestLayout.posterWidth,
    spacing: SPACING,
    partialPosterWidth: bestLayout.posterWidth * 0.25 // 1/4 of next poster
  };
};

const posterLayout = calculatePosterLayout(width);
const POSTER_WIDTH = posterLayout.posterWidth;

const ContentItem = ({ item, onPress, shouldLoadImage: shouldLoadImageProp, deferMs = 0, onItemFocus, isFirstInRow, isLastInRow, isLastRow, focusRef, nextFocusLeftId, onRegisterNodeHandle, tvPosterWidth }: ContentItemProps) => {
  const isTVDevice = useIsTV();
  // Track inLibrary status locally to force re-render
  const [inLibrary, setInLibrary] = useState(!!item.inLibrary);
  const [menuVisible, setMenuVisible] = useState(false);

  // Internal ref for registering node handle
  const internalViewRef = useRef<View>(null);
  // Use provided focusRef or internal ref
  const actualViewRef = focusRef || internalViewRef;

  // Register node handle when component mounts (for sibling navigation)
  useEffect(() => {
    if (isTVDevice && onRegisterNodeHandle && actualViewRef.current) {
      // Small delay to ensure the view is fully mounted
      const timer = setTimeout(() => {
        onRegisterNodeHandle(actualViewRef.current);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isTVDevice, onRegisterNodeHandle, actualViewRef]);
  const [isWatched, setIsWatched] = useState(false);
  const [imageError, setImageError] = useState(false);

  // On TV, defer subscriptions to reduce initial render overhead
  // Only subscribe after a delay to allow smooth scrolling first
  useEffect(() => {
    if (isTVDevice) {
      // On TV, delay subscription setup for performance
      const timer = setTimeout(() => {
        const unsubscribe = catalogService.subscribeToLibraryUpdates((items) => {
          const found = items.find((libItem) => libItem.id === item.id && libItem.type === item.type);
          const newInLibrary = !!found;
          setInLibrary(prev => prev !== newInLibrary ? newInLibrary : prev);
        });
        return () => unsubscribe();
      }, 500);
      return () => clearTimeout(timer);
    }

    // Mobile: immediate subscription
    const unsubscribe = catalogService.subscribeToLibraryUpdates((items) => {
      const found = items.find((libItem) => libItem.id === item.id && libItem.type === item.type);
      const newInLibrary = !!found;
      setInLibrary(prev => prev !== newInLibrary ? newInLibrary : prev);
    });
    return () => unsubscribe();
  }, [item.id, item.type, isTVDevice]);

  // Load watched state - defer on TV for performance
  useEffect(() => {
    const updateWatched = () => {
      mmkvStorage.getItem(`watched:${item.type}:${item.id}`).then((val: string | null) => setIsWatched(val === 'true'));
    };

    if (isTVDevice) {
      // On TV, delay to reduce initial overhead
      const timer = setTimeout(updateWatched, 300);
      const sub = DeviceEventEmitter.addListener('watchedStatusChanged', updateWatched);
      return () => {
        clearTimeout(timer);
        sub.remove();
      };
    }

    updateWatched();
    const sub = DeviceEventEmitter.addListener('watchedStatusChanged', updateWatched);
    return () => sub.remove();
  }, [item.id, item.type, isTVDevice]);

  // Trakt integration
  const { isAuthenticated, isInWatchlist, isInCollection, addToWatchlist, removeFromWatchlist, addToCollection, removeFromCollection } = useTraktContext();

  useEffect(() => {
    // Reset image error state when item changes, allowing for retry on re-render
    setImageError(false);
  }, [item.id, item.poster]);

  const { currentTheme } = useTheme();
  const { settings, isLoaded } = useSettings();
  const { showSuccess, showInfo } = useToast();
  const posterRadius = typeof settings.posterBorderRadius === 'number' ? settings.posterBorderRadius : 12;
  // Memoize poster width calculation to avoid recalculating on every render
  const posterWidth = React.useMemo(() => {
    // If TV grid specifies a fixed width, use it
    if (isTVDevice && tvPosterWidth) {
      return tvPosterWidth;
    }

    const deviceType = getDeviceType(width);
    // TV uses smaller posters (0.7x) to fit 2 rows on screen
    const sizeMultiplier = isTVDevice ? 0.7 : deviceType === 'largeTablet' ? 1.1 : deviceType === 'tablet' ? 1.0 : 0.9;

    switch (settings.posterSize) {
      case 'small':
        return Math.max(90, POSTER_WIDTH - 15) * sizeMultiplier;
      case 'medium':
        return Math.max(110, POSTER_WIDTH + 10) * sizeMultiplier;
      case 'large':
        return Math.max(130, POSTER_WIDTH + 25) * sizeMultiplier;
      default:
        return POSTER_WIDTH * sizeMultiplier;
    }
  }, [settings.posterSize, width, isTVDevice, tvPosterWidth]);

  // Determine dimensions based on poster shape
  const { finalWidth, finalAspectRatio, borderRadius } = React.useMemo(() => {
    const shape = item.posterShape || 'poster';
    const baseHeight = posterWidth / (2 / 3); // Standard height derived from portrait width

    let w = posterWidth;
    let ratio = 2 / 3;

    if (shape === 'landscape') {
      ratio = 16 / 9;
      // Maintain same height as portrait posters
      w = baseHeight * ratio;
    } else if (shape === 'square') {
      ratio = 1;
      w = baseHeight;
    }

    return {
      finalWidth: w,
      finalAspectRatio: ratio,
      borderRadius: typeof settings.posterBorderRadius === 'number' ? settings.posterBorderRadius : 12
    };
  }, [posterWidth, item.posterShape, settings.posterBorderRadius]);

  // Intersection observer simulation for lazy loading
  const itemRef = useRef<View>(null);

  const handleLongPress = useCallback(() => {
    setMenuVisible(true);
  }, []);

  const handlePress = useCallback(() => {
    // Validate ID before pressing to prevent errors with NaN/undefined IDs
    if (item.id && item.id !== 'NaN' && item.id !== 'undefined') {
      onPress(item.id, item.type);
    }
  }, [item.id, item.type, onPress]);

  const handleOptionSelect = useCallback(async (option: string) => {
    switch (option) {
      case 'library':
        if (inLibrary) {
          catalogService.removeFromLibrary(item.type, item.id);
          showInfo('Removed from Library', 'Removed from your local library');
        } else {
          catalogService.addToLibrary(item);
          showSuccess('Added to Library', 'Added to your local library');
        }
        break;
      case 'watched': {
        const targetWatched = !isWatched;
        setIsWatched(targetWatched);
        try {
          await mmkvStorage.setItem(`watched:${item.type}:${item.id}`, targetWatched ? 'true' : 'false');
        } catch { }
        showInfo(targetWatched ? 'Marked as Watched' : 'Marked as Unwatched', targetWatched ? 'Item marked as watched' : 'Item marked as unwatched');
        setTimeout(() => {
          DeviceEventEmitter.emit('watchedStatusChanged');
        }, 100);

        // Best-effort sync: record local progress and push to Trakt if available
        if (targetWatched) {
          try {
            await storageService.setWatchProgress(
              item.id,
              item.type,
              { currentTime: 1, duration: 1, lastUpdated: Date.now() },
              undefined,
              { forceNotify: true, forceWrite: true }
            );
          } catch { }

          if (item.type === 'movie') {
            try {
              const trakt = TraktService.getInstance();
              if (await trakt.isAuthenticated()) {
                await trakt.addToWatchedMovies(item.id);
                try {
                  await storageService.updateTraktSyncStatus(item.id, item.type, true, 100);
                } catch { }
              }
            } catch { }
          }
        }
        setMenuVisible(false);
        break;
      }
      case 'playlist':
        break;
      case 'share': {
        let url = '';
        if (item.id) {
          url = `https://www.imdb.com/title/${item.id}/`;
        }
        const message = `${item.name}\n${url}`;
        Share.share({ message, url, title: item.name });
        break;
      }
      case 'trakt-watchlist': {
        if (isInWatchlist(item.id, item.type as 'movie' | 'show')) {
          await removeFromWatchlist(item.id, item.type as 'movie' | 'show');
          showInfo('Removed from Watchlist', 'Removed from your Trakt watchlist');
        } else {
          await addToWatchlist(item.id, item.type as 'movie' | 'show');
          showSuccess('Added to Watchlist', 'Added to your Trakt watchlist');
        }
        setMenuVisible(false);
        break;
      }
      case 'trakt-collection': {
        if (isInCollection(item.id, item.type as 'movie' | 'show')) {
          await removeFromCollection(item.id, item.type as 'movie' | 'show');
          showInfo('Removed from Collection', 'Removed from your Trakt collection');
        } else {
          await addToCollection(item.id, item.type as 'movie' | 'show');
          showSuccess('Added to Collection', 'Added to your Trakt collection');
        }
        setMenuVisible(false);
        break;
      }
    }
  }, [item, inLibrary, isWatched, isInWatchlist, isInCollection, addToWatchlist, removeFromWatchlist, addToCollection, removeFromCollection, showSuccess, showInfo]);

  const handleMenuClose = useCallback(() => {
    setMenuVisible(false);
  }, []);

  // Memoize optimized poster URL to prevent recalculating
  const optimizedPosterUrl = React.useMemo(() => {
    if (!item.poster || item.poster.includes('placeholder')) {
      return 'https://via.placeholder.com/154x231/333/666?text=No+Image';
    }
    if (item.poster.includes('image.tmdb.org')) {
      return item.poster.replace(/\/w\d+\//, '/w154/');
    }
    if (item.poster.includes('placeholder')) {
      return item.poster.replace('/medium/', '/small/');
    }
    return item.poster;
  }, [item.poster, item.id]);

  if (!isLoaded) {
    return (
      <View style={[styles.itemContainer, { width: finalWidth }]}>
        <View
          style={[
            styles.contentItem,
            {
              width: finalWidth,
              aspectRatio: finalAspectRatio,
              borderRadius,
              backgroundColor: currentTheme.colors.elevation1,
            },
          ]}
        />
        <View style={{ height: 18, marginTop: 4 }} />
      </View>
    );
  }

  // Shared content render for both TV and non-TV
  const renderPosterContent = () => (
    <View ref={itemRef} style={[styles.contentItemContainer, { borderRadius }]}>
      {/* Image with FastImage for aggressive caching */}
      {item.poster ? (
        <FastImage
          source={{
            uri: optimizedPosterUrl,
            priority: FastImage.priority.normal,
            cache: FastImage.cacheControl.immutable
          }}
          style={[styles.poster, { backgroundColor: currentTheme.colors.elevation1, borderRadius }]}
          resizeMode={FastImage.resizeMode.cover}
          onLoad={() => {
            setImageError(false);
          }}
          onError={() => {
            if (__DEV__) console.warn('Image load error for:', item.poster);
            setImageError(true);
          }}
        />
      ) : (
        // Show placeholder for items without posters
        <View style={[styles.poster, { backgroundColor: currentTheme.colors.elevation1, justifyContent: 'center', alignItems: 'center', borderRadius: posterRadius }]}>
          <Text style={{ color: currentTheme.colors.textMuted, fontSize: 10, textAlign: 'center' }}>
            {item.name ? item.name.substring(0, 20) + '...' : 'No title'}
          </Text>
        </View>
      )}
      {imageError && (
        <View style={[styles.loadingOverlay, { backgroundColor: currentTheme.colors.elevation1 }]}>
          <MaterialIcons name="broken-image" size={24} color={currentTheme.colors.textMuted} />
        </View>
      )}
      {isWatched && (
        <View style={styles.watchedIndicator}>
          <MaterialIcons name="check-circle" size={22} color={currentTheme.colors.success} />
        </View>
      )}
      {inLibrary && (
        <View style={styles.libraryBadge}>
          <Feather name="bookmark" size={16} color={currentTheme.colors.white} />
        </View>
      )}
      {isAuthenticated && isInWatchlist(item.id, item.type as 'movie' | 'show') && (
        <View style={styles.traktWatchlistIcon}>
          <MaterialIcons name="playlist-add-check" size={16} color="#E74C3C" />
        </View>
      )}
      {isAuthenticated && isInCollection(item.id, item.type as 'movie' | 'show') && (
        <View style={styles.traktCollectionIcon}>
          <MaterialIcons name="video-library" size={16} color="#3498DB" />
        </View>
      )}
    </View>
  );

  return (
    <>
      <Animated.View style={[styles.itemContainer, { width: finalWidth }]} entering={FadeIn.duration(300)}>
        {isTVDevice ? (
          <Focusable
            style={[styles.contentItem, { width: finalWidth, aspectRatio: finalAspectRatio, borderRadius }]}
            onPress={handlePress}
            onLongPress={handleLongPress}
            onFocus={onItemFocus}
            borderRadius={borderRadius}
            animateBackground={false}
            focusScale={1.08}
            viewRef={actualViewRef}
            // Constrain right navigation at row end
            blockRight={isLastInRow}
            // Constrain down navigation on last row to prevent wrap-around
            blockDown={isLastRow}
            // Use nextFocusLeftId for constrained left navigation:
            // - First item: points to menu sidebar
            // - Other items: points to previous item in row (passed from parent)
            nextFocusLeftId={nextFocusLeftId}
          >
            {renderPosterContent()}
          </Focusable>
        ) : (
          <TouchableOpacity
            style={[styles.contentItem, { width: finalWidth, aspectRatio: finalAspectRatio, borderRadius }]}
            activeOpacity={0.7}
            onPress={handlePress}
            onLongPress={handleLongPress}
            delayLongPress={300}
          >
            {renderPosterContent()}
          </TouchableOpacity>
        )}
        {settings.showPosterTitles && (
          <Text
            style={[
              styles.title,
              {
                color: currentTheme.colors.mediumEmphasis,
                fontSize: getDeviceType(width) === 'tv' ? 16 : getDeviceType(width) === 'largeTablet' ? 15 : getDeviceType(width) === 'tablet' ? 14 : 13
              }
            ]}
            numberOfLines={2}
          >
            {item.name}
          </Text>
        )}
      </Animated.View>

      <DropUpMenu
        visible={menuVisible}
        onClose={handleMenuClose}
        item={item}
        onOptionSelect={handleOptionSelect}
        isSaved={inLibrary}
        isWatched={isWatched}
      />
    </>
  );
};

const styles = StyleSheet.create({
  itemContainer: {
    width: POSTER_WIDTH,
    overflow: 'visible', // Allow focused items to scale beyond container
  },
  contentItem: {
    width: POSTER_WIDTH,
    aspectRatio: 2 / 3,
    margin: 0,
    borderRadius: 12,
    overflow: 'visible', // Allow focused items to scale beyond container
    position: 'relative',
    elevation: Platform.OS === 'android' ? 1 : 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    marginBottom: 8,
  },
  contentItemContainer: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    overflow: 'hidden', // Keep overflow hidden for image corner clipping
    position: 'relative',
    backgroundColor: 'transparent',
  },
  poster: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  watchedIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    borderRadius: 12,
    padding: 2,
  },
  libraryBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    borderRadius: 8,
    padding: 4,
  },
  traktWatchlistIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 2,
  },
  traktCollectionIcon: {
    position: 'absolute',
    top: 8,
    right: 32, // Positioned to the left of watchlist icon
    padding: 2,
  },
  title: {
    fontSize: 13, // Will be overridden responsively
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  }
});

export default React.memo(ContentItem, (prev, next) => {
  // Re-render when identity, poster, or TV navigation props change
  if (prev.item.id !== next.item.id) return false;
  if (prev.item.poster !== next.item.poster) return false;
  // TV navigation props - must match for proper D-pad behavior
  if (prev.isFirstInRow !== next.isFirstInRow) return false;
  if (prev.isLastInRow !== next.isLastInRow) return false;
  if (prev.isLastRow !== next.isLastRow) return false;
  if (prev.nextFocusLeftId !== next.nextFocusLeftId) return false;
  if (prev.tvPosterWidth !== next.tvPosterWidth) return false;
  // Note: onRegisterNodeHandle callback identity should remain stable
  return true;
});