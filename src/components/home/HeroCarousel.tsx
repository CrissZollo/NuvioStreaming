import React, { useMemo, useState, useEffect, useCallback, memo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle, TextStyle, ImageStyle, ScrollView, StyleProp, Platform, Image, useWindowDimensions, findNodeHandle } from 'react-native';
import Animated, { FadeIn, FadeOut, Easing, useSharedValue, withTiming, useAnimatedStyle, useAnimatedScrollHandler, useAnimatedReaction, runOnJS, SharedValue, interpolate, Extrapolation } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import FastImage from '@d11/react-native-fast-image';
import { Pagination } from 'react-native-reanimated-carousel';
import { Ionicons } from '@expo/vector-icons';

// Optional iOS Glass effect (expo-glass-effect) with safe fallback for HeroCarousel
let GlassViewComp: any = null;
let liquidGlassAvailable = false;
if (Platform.OS === 'ios') {
  try {
    // Dynamically require so app still runs if the package isn't installed yet
    const glass = require('expo-glass-effect');
    GlassViewComp = glass.GlassView;
    liquidGlassAvailable = typeof glass.isLiquidGlassAvailable === 'function' ? glass.isLiquidGlassAvailable() : false;
  } catch {
    GlassViewComp = null;
    liquidGlassAvailable = false;
  }
}
import { useNavigation } from '@react-navigation/native';
import { NavigationProp } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { StreamingContent } from '../../services/catalogService';
import { useTheme } from '../../contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettings } from '../../hooks/useSettings';
import { useIsTV } from '../../contexts/TVContext';
import { useTVFocus } from '../../contexts/TVFocusContext';
import { Focusable, FocusableRef } from '../tv/Focusable';

// Memoized background component - defined outside to prevent recreation
// On TV: NO blur at all - just darkened image for performance on weak CPUs
const BackgroundImage = React.memo(({
  imageUri,
  insets,
  isTVDevice,
}: {
  imageUri: string;
  insets: any;
  isTVDevice: boolean;
}) => {
  // TV: Simple dark overlay without any blur - critical for 2-core CPUs
  if (isTVDevice) {
    return (
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: -insets.top,
          bottom: 0,
        }}
        pointerEvents="none"
      >
        <FastImage
          source={{
            uri: imageUri,
            priority: FastImage.priority.low,
            cache: FastImage.cacheControl.immutable
          }}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            opacity: 0.3, // Darken instead of blur
          }}
          resizeMode={FastImage.resizeMode.cover}
        />
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
          }}
        />
      </View>
    );
  }

  // Mobile/tablet: Keep blur effect
  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: -insets.top,
        bottom: 0,
      }}
      pointerEvents="none"
    >
      <View style={{ flex: 1 }}>
        {Platform.OS === 'android' ? (
          <Image
            source={{ uri: imageUri }}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
            }}
            resizeMode="cover"
            blurRadius={20}
          />
        ) : (
          <>
            <FastImage
              source={{
                uri: imageUri,
                priority: FastImage.priority.low,
                cache: FastImage.cacheControl.immutable
              }}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
              }}
              resizeMode={FastImage.resizeMode.cover}
            />
            {Platform.OS === 'ios' && GlassViewComp && liquidGlassAvailable ? (
              <GlassViewComp
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 0,
                  bottom: 0,
                }}
                glassEffectStyle="regular"
              />
            ) : (
              <BlurView
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 0,
                  bottom: 0,
                }}
                intensity={30}
                tint="dark"
              />
            )}
          </>
        )}
        <LinearGradient
          colors={["rgba(0,0,0,0.45)", "rgba(0,0,0,0.75)"]}
          locations={[0.4, 1]}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
          }}
        />
      </View>
    </View>
  );
});

interface HeroCarouselProps {
  items: StreamingContent[];
  loading?: boolean;
  /** Ref to the first focusable item in Continue Watching section (for TV down navigation) */
  continueWatchingFirstRef?: React.RefObject<View>;
}

// Offset to keep cards below a top tab navigator
const TOP_TABS_OFFSET = Platform.OS === 'ios' ? 44 : 48;

const HeroCarousel: React.FC<HeroCarouselProps> = ({ items, loading = false, continueWatchingFirstRef }) => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { currentTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isTVDevice = useIsTV();
  const { menuFirstItemNodeHandle } = useTVFocus();

  // Responsive sizing computed per-render so rotation updates layout
  const isTablet = useMemo(
    () => Math.min(windowWidth, windowHeight) >= 600 || (Platform.OS === 'ios' && (Platform as any).isPad),
    [windowWidth, windowHeight]
  );

  // Keep height based on baseline phone width; widen only on tablets
  // For TV: use narrower width to keep vertical poster shape
  const baseCardWidthForHeight = useMemo(
    () => isTVDevice ? Math.min(windowWidth * 0.16, 240) : Math.min(windowWidth * 0.8, 480),
    [windowWidth, isTVDevice]
  );

  const cardWidth = useMemo(
    () => {
      if (isTVDevice) {
        // TV: smaller cards - around 16% of screen width for compact hero section
        return Math.min(windowWidth * 0.16, 240);
      }
      return isTablet ? Math.max(560, windowWidth - 2 * Math.round(0.1 * windowWidth)) : Math.min(windowWidth * 0.8, 480);
    },
    [isTablet, windowWidth, isTVDevice]
  );

  const cardHeight = useMemo(
    () => {
      if (isTVDevice) {
        // TV: standard movie poster aspect ratio (2:3) to show full poster without cropping
        return Math.round(cardWidth * 1.5);
      }
      return Math.round(baseCardWidthForHeight * 9 / 16) + 310;
    },
    [baseCardWidthForHeight, cardWidth, isTVDevice]
  );

  // For TV: account for the focus border padding (4px each side) and item spacing
  // focusableWidth = cardWidth + 8, wrapper width = focusableWidth + 12
  const interval = useMemo(() => {
    if (isTVDevice) {
      const borderPadding = 4;
      const focusableWidth = cardWidth + borderPadding * 2;
      return focusableWidth + 12; // Match TVHeroCardWrapper container width
    }
    return cardWidth + 16;
  }, [cardWidth, isTVDevice]);

  // Reduce top padding on phones while keeping tablets unchanged
  // TV: minimal top offset since no status bar
  const effectiveTopOffset = useMemo(() => {
    if (isTVDevice) return 0;
    return isTablet ? TOP_TABS_OFFSET : 8;
  }, [isTablet, isTVDevice]);

  const data = useMemo(() => (items && items.length ? items.slice(0, 10) : []), [items]);
  // Disable looping on TV to prevent focus jumping issues with duplicated items
  const loopingEnabled = data.length > 1 && !isTVDevice;
  // Duplicate head/tail for seamless looping (only on non-TV)
  const loopData = useMemo(() => {
    if (!loopingEnabled) return data;
    const head = data[0];
    const tail = data[data.length - 1];
    return [tail, ...data, head];
  }, [data, loopingEnabled]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [failedLogoIds, setFailedLogoIds] = useState<Set<string>>(new Set());
  const scrollViewRef = useRef<any>(null);
  const [isScrollReady, setIsScrollReady] = useState(false);
  const [flippedMap, setFlippedMap] = useState<Record<string, boolean>>({});
  const toggleFlipById = useCallback((id: string) => {
    setFlippedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // TV navigation - store View refs for each card for directional focus wrap-around
  const tvCardViewRefs = useRef<React.RefObject<View>[]>([]);
  // Cache for item node handles (like CatalogSection) - avoids findNodeHandle on every render
  const tvItemNodeHandles = useRef<Map<number, number>>(new Map());
  // Use ref for immediate focus tracking (no re-render) - cards read from shared value
  const tvFocusedIndexRef = useRef(0);
  // State only for text display below carousel - debounced to reduce re-renders
  const [tvDisplayIndex, setTvDisplayIndex] = useState(0);
  const [tvRefsReady, setTvRefsReady] = useState(false);
  const [tvNodeHandlesReady, setTvNodeHandlesReady] = useState(false);
  // Shared value for TV focused index - cards read this in worklets to avoid re-renders
  const tvFocusedIndexShared = useSharedValue(0);

  // Debounce for TV focus events to prevent jumping on fast navigation
  const lastTVFocusTime = useRef<number>(0);
  const TV_FOCUS_DEBOUNCE_MS = 50; // Minimum ms between focus events - kept low for responsive feel
  const isScrollingRef = useRef(false); // Track if a scroll is in progress
  // Debounce timer for display text update
  const tvDisplayDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Callback to register item's node handle when it mounts (cached lookup)
  const registerTVItemNodeHandle = useCallback((index: number, view: View | null) => {
    if (view) {
      const handle = findNodeHandle(view);
      if (handle) {
        tvItemNodeHandles.current.set(index, handle);
      }
    }
  }, []);

  // Initialize refs array when data changes
  useEffect(() => {
    // Create stable ref objects for each card
    tvCardViewRefs.current = data.map(() => React.createRef<View>());
    tvItemNodeHandles.current.clear();
    setTvRefsReady(false);
    setTvNodeHandlesReady(false);
    // Mark refs ready after a short delay to allow all Focusables to mount
    const timer = setTimeout(() => {
      setTvRefsReady(true);
      setTvNodeHandlesReady(true);
    }, 150);
    return () => clearTimeout(timer);
  }, [data.length]);


  // Note: do not early-return before hooks. Loading UI is returned later.

  const hasData = data.length > 0;

  // Optimized: update background as soon as scroll starts, without waiting for momentum end
  const scrollX = useSharedValue(0);
  const paginationProgress = useSharedValue(0);

  // Parallel image prefetch: start fetching banners and logos as soon as data arrives
  const itemsToPreload = useMemo(() => data.slice(0, 3), [data]);
  useEffect(() => {
    if (!itemsToPreload.length) return;
    try {
      const sources = itemsToPreload.flatMap((it) => {
        const result: { uri: string; priority?: any }[] = [];
        const bannerOrPoster = it.banner || it.poster;
        if (bannerOrPoster) {
          result.push({ uri: bannerOrPoster, priority: (FastImage as any).priority?.low });
        }
        if (it.logo) {
          result.push({ uri: it.logo, priority: (FastImage as any).priority?.normal });
        }
        return result;
      });
      // de-duplicate by uri
      const uniqueSources = Array.from(new Map(sources.map((s) => [s.uri, s])).values());
      if (uniqueSources.length && (FastImage as any).preload) {
        (FastImage as any).preload(uniqueSources);
      }
    } catch {
      // no-op: prefetch is best-effort
    }
  }, [itemsToPreload]);

  // Dynamic prefetch for adjacent cards when focus changes (TV optimization)
  // Uses tvDisplayIndex since it's debounced - no need to prefetch on every rapid focus change
  const lastPrefetchedIndex = useRef<number>(-1);
  useEffect(() => {
    if (!isTVDevice || !data.length) return;
    const currentIndex = tvDisplayIndex;
    // Skip if we already prefetched for this index
    if (lastPrefetchedIndex.current === currentIndex) return;
    lastPrefetchedIndex.current = currentIndex;

    try {
      const indicesToPrefetch: number[] = [];
      // Prefetch previous and next 2 items
      for (let offset = -2; offset <= 2; offset++) {
        if (offset === 0) continue; // Skip current
        let idx = currentIndex + offset;
        // Wrap around
        if (idx < 0) idx = data.length + idx;
        if (idx >= data.length) idx = idx - data.length;
        if (idx >= 0 && idx < data.length) {
          indicesToPrefetch.push(idx);
        }
      }

      const sources = indicesToPrefetch.flatMap((idx) => {
        const it = data[idx];
        if (!it) return [];
        const result: { uri: string; priority?: any }[] = [];
        // For TV, prefetch poster (shown on cards) and banner (shown in background)
        if (it.poster) {
          result.push({ uri: it.poster, priority: (FastImage as any).priority?.low });
        }
        if (it.banner && it.banner !== it.poster) {
          result.push({ uri: it.banner, priority: (FastImage as any).priority?.low });
        }
        return result;
      });

      const uniqueSources = Array.from(new Map(sources.map((s) => [s.uri, s])).values());
      if (uniqueSources.length && (FastImage as any).preload) {
        (FastImage as any).preload(uniqueSources);
      }
    } catch {
      // no-op: prefetch is best-effort
    }
  }, [tvDisplayIndex, data, isTVDevice]);

  // Comprehensive reset when component mounts/remounts to prevent glitching
  useEffect(() => {
    // Start at the first real item for looping
    scrollX.value = loopingEnabled ? interval : 0;
    setActiveIndex(0);
    setIsScrollReady(false);

    // Scroll to position and mark ready after layout
    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollTo({ x: loopingEnabled ? interval : 0, y: 0, animated: false });
      setIsScrollReady(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // Reset scroll when data becomes available
  useEffect(() => {
    if (data.length > 0) {
      scrollX.value = loopingEnabled ? interval : 0;
      setActiveIndex(0);
      setIsScrollReady(false);

      const timer = setTimeout(() => {
        scrollViewRef.current?.scrollTo({ x: loopingEnabled ? interval : 0, y: 0, animated: false });
        setIsScrollReady(true);
      }, 150);

      return () => clearTimeout(timer);
    }
  }, [data.length]);

  // Re-center on rotation using current interval and activeIndex
  useEffect(() => {
    if (!hasData) return;
    const timer = setTimeout(() => {
      scrollToLogicalIndex(activeIndex, false);
    }, 50);
    return () => clearTimeout(timer);
  }, [windowWidth, windowHeight, interval, loopingEnabled]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
    onBeginDrag: () => {
      // Smooth scroll start - could add haptic feedback here
    },
    onEndDrag: () => {
      // Smooth scroll end
    },
    onMomentumBegin: () => {
      // Momentum scroll start
    },
    onMomentumEnd: () => {
      // Momentum scroll end
    },
  });

  // Debounced activeIndex update to reduce JS bridge crossings
  const lastIndexUpdateRef = useRef(0);
  useAnimatedReaction(
    () => {
      // Convert scroll position to logical data index (exclude duplicated items)
      let idx = Math.round(scrollX.value / interval);
      if (loopingEnabled) {
        idx -= 1; // account for leading duplicate
      }
      if (idx < 0) idx = data.length - 1;
      if (idx > data.length - 1) idx = 0;
      return idx;
    },
    (idx, prevIdx) => {
      if (idx == null || idx === prevIdx) return;

      // Debounce updates to reduce JS bridge crossings
      const now = Date.now();
      if (now - lastIndexUpdateRef.current < 100) return; // 100ms debounce
      lastIndexUpdateRef.current = now;

      // Clamp to bounds to avoid out-of-range access
      const clamped = Math.max(0, Math.min(idx, data.length - 1));
      runOnJS(setActiveIndex)(clamped);
    },
    [data.length]
  );

  // Keep pagination progress in sync with scrollX so we can animate dots like FeaturedContent
  useAnimatedReaction(
    () => scrollX.value / interval,
    (val) => {
      // Align pagination progress with logical index space
      paginationProgress.value = loopingEnabled ? val - 1 : val;
    },
    [interval, loopingEnabled]
  );

  // JS helper to jump without flicker when hitting clones
  const scrollToLogicalIndex = useCallback((logicalIndex: number, animated = true) => {
    const target = loopingEnabled ? (logicalIndex + 1) * interval : logicalIndex * interval;
    scrollViewRef.current?.scrollTo({ x: target, y: 0, animated });
  }, [interval, loopingEnabled]);

  // Smooth scroll using Reanimated for TV wrap-around
  const smoothScrollToIndex = useCallback((logicalIndex: number, duration: number = 300) => {
    const target = logicalIndex * interval;
    scrollX.value = withTiming(target, { duration, easing: Easing.out(Easing.cubic) });
    scrollViewRef.current?.scrollTo({ x: target, y: 0, animated: true });
  }, [interval, scrollX]);

  // Handle TV card focus - scroll to the focused card
  // Uses instant scroll (no animation) to prevent conflicts during fast navigation
  // CRITICAL: This does NOT trigger a parent re-render - only updates refs and shared values
  const handleTVCardFocus = useCallback((logicalIndex: number) => {
    // Debounce rapid focus events to prevent scroll conflicts
    const now = Date.now();
    if (now - lastTVFocusTime.current < TV_FOCUS_DEBOUNCE_MS) {
      return; // Skip this focus event - too soon after last one
    }

    // Skip if already scrolling
    if (isScrollingRef.current) {
      return;
    }

    lastTVFocusTime.current = now;
    isScrollingRef.current = true;

    // Update ref immediately (no re-render)
    tvFocusedIndexRef.current = logicalIndex;
    // Update shared value immediately for card animations (no re-render)
    tvFocusedIndexShared.value = logicalIndex;

    // Debounce state update for text display - 150ms delay so fast navigation doesn't cause re-renders
    if (tvDisplayDebounceRef.current) {
      clearTimeout(tvDisplayDebounceRef.current);
    }
    tvDisplayDebounceRef.current = setTimeout(() => {
      setTvDisplayIndex(logicalIndex);
    }, 150);

    // Use instant scroll (animated: false) to prevent animation conflicts
    // This eliminates the "jumping back" issue when navigating quickly
    scrollToLogicalIndex(logicalIndex, false);

    // Reset scrolling flag after a short delay
    setTimeout(() => {
      isScrollingRef.current = false;
    }, 50);
  }, [scrollToLogicalIndex, tvFocusedIndexShared]);

  const contentPadding = useMemo(() => {
    if (isTVDevice) {
      // TV: The content area already has paddingLeft: 60 from TVSideRail
      // So we're working within (windowWidth - 60) visible width
      // To center the card: padding = (visibleWidth - cardWidth) / 2
      const visibleWidth = windowWidth - 60;
      const horizontalPadding = (visibleWidth - cardWidth) / 2;
      return {
        paddingLeft: horizontalPadding,
        paddingRight: horizontalPadding
      };
    }
    // Mobile/tablet: center in full screen width
    const horizontalPadding = (windowWidth - cardWidth) / 2;
    return { paddingHorizontal: horizontalPadding };
  }, [windowWidth, cardWidth, isTVDevice]);

  const handleNavigateToMetadata = useCallback((id: string, type: any) => {
    navigation.navigate('Metadata', { id, type });
  }, [navigation]);

  // Stable callback factories for TV cards - prevents re-renders from inline arrow functions
  // Creates one callback per item that is stable across renders
  const tvPressHandlers = useMemo(() => {
    if (!isTVDevice) return [];
    return data.map((item) => () => handleNavigateToMetadata(item.id, item.type));
  }, [isTVDevice, data, handleNavigateToMetadata]);

  // TV blur handler - reset carousel to first item when focus leaves any hero card
  // This ensures when navigating back up, the first hero card (not behind sidebar) is focused
  const tvBlurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tvBlurHandler = useCallback(() => {
    if (!isTVDevice) return;

    // Use a small timeout to check if focus moved to another hero card
    // If focus moved within the carousel, the timeout will be cleared by the next focus handler
    if (tvBlurTimeoutRef.current) {
      clearTimeout(tvBlurTimeoutRef.current);
    }

    tvBlurTimeoutRef.current = setTimeout(() => {
      // Reset to first item after focus leaves the hero section
      if (tvFocusedIndexRef.current !== 0) {
        scrollToLogicalIndex(0, true);
        tvFocusedIndexRef.current = 0;
        tvFocusedIndexShared.value = 0;
        setTvDisplayIndex(0);
      }
    }, 100);
  }, [isTVDevice, scrollToLogicalIndex, tvFocusedIndexShared]);

  // TV focus handlers that also clear any pending blur reset
  const tvFocusHandlers = useMemo(() => {
    if (!isTVDevice) return [];
    return data.map((_, idx) => () => {
      // Clear any pending blur reset since focus is still in the carousel
      if (tvBlurTimeoutRef.current) {
        clearTimeout(tvBlurTimeoutRef.current);
        tvBlurTimeoutRef.current = null;
      }
      handleTVCardFocus(idx);
    });
  }, [isTVDevice, data.length, handleTVCardFocus]);

  // Container animation based on scroll - must be before early returns
  // TEMPORARILY DISABLED FOR PERFORMANCE TESTING
  // const containerAnimatedStyle = useAnimatedStyle(() => {
  //   const translateX = scrollX.value;
  //   const progress = Math.abs(translateX) / (data.length * (CARD_WIDTH + 16));
  //
  //   // Very subtle scale animation for the entire container
  //   const scale = 1 - progress * 0.01;
  //   const clampedScale = Math.max(0.99, Math.min(1, scale));
  //
  //   return {
  //     transform: [{ scale: clampedScale }],
  //   };
  // });

  // Debounced background image URI for TV - prevents rapid background changes during fast navigation
  // This is critical for low-powered devices where image loading is expensive
  const [debouncedTvIndex, setDebouncedTvIndex] = useState(0);
  const tvBackgroundDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isTVDevice) return;

    // Clear any pending debounce
    if (tvBackgroundDebounceRef.current) {
      clearTimeout(tvBackgroundDebounceRef.current);
    }

    // Debounce background changes by 200ms on TV
    // This prevents background flickering during rapid D-pad navigation
    tvBackgroundDebounceRef.current = setTimeout(() => {
      setDebouncedTvIndex(tvDisplayIndex);
    }, 200);

    return () => {
      if (tvBackgroundDebounceRef.current) {
        clearTimeout(tvBackgroundDebounceRef.current);
      }
    };
  }, [tvDisplayIndex, isTVDevice]);

  // Memoize background image URI to prevent unnecessary re-renders
  // IMPORTANT: This must be before any early returns to satisfy React hooks rules
  const backgroundImageUri = useMemo(() => {
    // For TV, use debounced index to prevent rapid background changes
    // For mobile, use activeIndex directly
    const idx = isTVDevice ? debouncedTvIndex : activeIndex;
    const item = data[idx];
    return item?.banner || item?.poster || '';
  }, [isTVDevice, debouncedTvIndex, activeIndex, data]);

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: 12 + effectiveTopOffset }] as StyleProp<ViewStyle>}>
        <View style={{ height: cardHeight }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: (windowWidth - cardWidth) / 2 }}
          >
            {[1, 2, 3].map((_, index) => (
              <View key={index} style={{ width: cardWidth + 16 }}>
                <View style={[
                  styles.card,
                  {
                    backgroundColor: currentTheme.colors.elevation1,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.18)',
                    width: cardWidth,
                    height: cardHeight,
                  }
                ] as StyleProp<ViewStyle>}>
                  <View style={styles.skeletonBannerFull as ViewStyle} />
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    );
  }

  if (!hasData) return null;

  return (
    <View>
      <Animated.View style={[styles.container as ViewStyle, { paddingTop: 12 + effectiveTopOffset }]}>
        {/* Removed preload images for performance - let FastImage cache handle it naturally */}
        {settings.enableHomeHeroBackground && backgroundImageUri && (
          <BackgroundImage
            imageUri={backgroundImageUri}
            insets={insets}
            isTVDevice={isTVDevice}
          />
        )}
        {/* Bottom blend to HomeScreen background (not the card) */}
        {settings.enableHomeHeroBackground && (
          <LinearGradient
            colors={["transparent", currentTheme.colors.darkBackground]}
            locations={[0, 1]}
            style={styles.bottomBlend as ViewStyle}
            pointerEvents="none"
          />
        )}
        <Animated.ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={isTVDevice ? undefined : interval}
          decelerationRate={isTVDevice ? 'normal' : 'fast'}
          contentContainerStyle={contentPadding}
          onScroll={scrollHandler}
          scrollEventThrottle={32}
          disableIntervalMomentum={!isTVDevice}
          pagingEnabled={false}
          bounces={false}
          overScrollMode="never"
          scrollEnabled={!isTVDevice}
          style={{ opacity: isScrollReady ? 1 : 0 }}
          contentOffset={{ x: loopingEnabled ? interval : 0, y: 0 }}
          onMomentumScrollEnd={(e) => {
            if (!loopingEnabled) return;
            // Determine current page index in cloned space
            const x = e?.nativeEvent?.contentOffset?.x ?? 0;
            const page = Math.round(x / interval);
            // If at leading clone (0), jump to last real item
            if (page === 0) {
              scrollToLogicalIndex(data.length - 1, false);
            }
            // If at trailing clone (last), jump to first real item
            const lastPage = loopData.length - 1;
            if (page === lastPage) {
              scrollToLogicalIndex(0, false);
            }
          }}
        >
          {(loopingEnabled ? loopData : data).map((item, index) => {
            // Calculate logical index (for non-looping or for the real items in looping)
            let logicalIndex = index;
            if (loopingEnabled) {
              // In loopData: [tail, ...data, head], so real items are at indices 1 to data.length
              logicalIndex = index - 1;
              if (logicalIndex < 0) logicalIndex = data.length - 1; // tail clone maps to last
              if (logicalIndex >= data.length) logicalIndex = 0; // head clone maps to first
            }

            // TV: Use ultra-simple static card - NO Reanimated at all
            // Critical for 2-core CPUs (Fire TV Stick, budget Android TV)
            if (isTVDevice) {
              // Calculate indices for navigation (no wrap-around)
              const prevIndex = logicalIndex > 0 ? logicalIndex - 1 : -1;
              const nextIndex = logicalIndex < data.length - 1 ? logicalIndex + 1 : -1;
              const isFirstItem = logicalIndex === 0;
              const isLastItem = logicalIndex === data.length - 1;

              // Get ref for this card
              const currentViewRef = tvCardViewRefs.current[logicalIndex];

              // Use cached node handles for navigation (avoids findNodeHandle on every render)
              // First item: left goes to menu; others: go to previous item (cached handle)
              const leftNodeHandle = isFirstItem
                ? menuFirstItemNodeHandle
                : (tvNodeHandlesReady ? tvItemNodeHandles.current.get(prevIndex) : undefined);

              // Last item: block right; others: go to next item (cached handle)
              const rightNodeHandle = isLastItem
                ? undefined
                : (tvNodeHandlesReady ? tvItemNodeHandles.current.get(nextIndex) : undefined);

              // For first item: block left if menu handle not available yet
              const shouldBlockLeft = isFirstItem && !menuFirstItemNodeHandle;

              return (
                <TVHeroCardWrapper
                  key={`tv-${item.id}-${logicalIndex}`}
                  item={item}
                  cardWidth={cardWidth}
                  cardHeight={cardHeight}
                  colors={currentTheme.colors}
                  onPress={tvPressHandlers[logicalIndex]}
                  onFocus={tvFocusHandlers[logicalIndex]}
                  onBlur={tvBlurHandler}
                  viewRef={currentViewRef}
                  downRef={continueWatchingFirstRef}
                  blockRight={isLastItem}
                  blockLeft={shouldBlockLeft}
                  nextFocusLeftId={leftNodeHandle}
                  nextFocusRightId={rightNodeHandle}
                  onRegisterNodeHandle={(view) => registerTVItemNodeHandle(logicalIndex, view)}
                />
              );
            }

            // Mobile/tablet: Full animation support with CarouselCard
            const card = (
              <CarouselCard
                key={`${item.id}-${index}-${loopingEnabled ? 'loop' : 'base'}`}
                item={item}
                colors={currentTheme.colors}
                logoFailed={failedLogoIds.has(item.id)}
                onLogoError={() => setFailedLogoIds((prev) => new Set(prev).add(item.id))}
                onPressInfo={() => handleNavigateToMetadata(item.id, item.type)}
                scrollX={scrollX}
                index={index}
                flipped={!!flippedMap[item.id]}
                onToggleFlip={() => toggleFlipById(item.id)}
                interval={interval}
                cardWidth={cardWidth}
                cardHeight={cardHeight}
                isTablet={isTablet}
                isTVDevice={false}
              />
            );

            return card;
          })}
        </Animated.ScrollView>
      </Animated.View>
      {/* TV: Show media type and genres below the focused item */}
      {/* Uses tvDisplayIndex (debounced) so text only updates after user stops navigating */}
      {isTVDevice && data[tvDisplayIndex] && (
        <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 2 }}>
          <Text style={{
            color: currentTheme.colors.white,
            fontSize: 13,
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: 1.5,
            marginBottom: 4,
          }}>
            {data[tvDisplayIndex].type === 'series' ? 'TV Show' : 'Movie'}
          </Text>
          {data[tvDisplayIndex].genres && data[tvDisplayIndex].genres.length > 0 && (
            <Text style={{
              color: currentTheme.colors.textMuted,
              fontSize: 12,
              fontWeight: '500',
              letterSpacing: 0.5,
            }}>
              {data[tvDisplayIndex].genres.slice(0, 3).join('  •  ')}
            </Text>
          )}
        </View>
      )}
      {/* Pagination below the card row (library-based, worklet-driven) */}
      <View style={{ alignItems: 'center', paddingTop: isTVDevice ? 6 : 8, paddingBottom: 6, position: 'relative', zIndex: 1 }} pointerEvents={isTVDevice ? 'none' : 'auto'}>
        <Pagination.Basic
          progress={paginationProgress}
          data={data}
          size={isTVDevice ? 8 : 10}
          dotStyle={{
            width: isTVDevice ? 6 : 8,
            height: isTVDevice ? 6 : 8,
            borderRadius: 999,
            backgroundColor: currentTheme.colors.elevation3,
          }}
          activeDotStyle={{
            width: isTVDevice ? 8 : 10,
            height: isTVDevice ? 8 : 10,
            borderRadius: 999,
            backgroundColor: currentTheme.colors.white,
          }}
          containerStyle={{ gap: isTVDevice ? 6 : 8 }}
          horizontal
          onPress={isTVDevice ? undefined : (index: number) => {
            scrollToLogicalIndex(index, true);
          }}
        />
      </View>
    </View>
  );
};

// MINIMAL ANIMATED CARD FOR PERFORMANCE TESTING
interface AnimatedCardWrapperProps {
  item: StreamingContent;
  index: number;
  scrollX: SharedValue<number>;
  interval: number;
  cardWidth: number;
  cardHeight: number;
  colors: any;
  isTablet: boolean;
}

const AnimatedCardWrapper: React.FC<AnimatedCardWrapperProps> = memo(({
  item, index, scrollX, interval, cardWidth, cardHeight, colors, isTablet
}) => {
  const cardAnimatedStyle = useAnimatedStyle(() => {
    const translateX = scrollX.value;
    const cardOffset = index * interval;
    const distance = Math.abs(translateX - cardOffset);

    if (distance > interval * 1.5) {
      return {
        transform: [{ scale: isTablet ? 0.95 : 0.9 }],
        opacity: isTablet ? 0.85 : 0.7
      };
    }

    const maxDistance = interval;
    const scale = 1 - (distance / maxDistance) * 0.1;
    const clampedScale = Math.max(isTablet ? 0.95 : 0.9, Math.min(1, scale));
    const opacity = 1 - (distance / maxDistance) * 0.3;
    const clampedOpacity = Math.max(isTablet ? 0.85 : 0.7, Math.min(1, opacity));

    return {
      transform: [{ scale: clampedScale }],
      opacity: clampedOpacity,
    };
  });

  const logoOpacity = useSharedValue(0);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const isFlipped = useSharedValue(0);

  useEffect(() => {
    if (logoLoaded) {
      logoOpacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.ease) });
    }
  }, [logoLoaded]);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
  }));

  // TEST 4: FLIP STYLES
  const frontFlipStyle = useAnimatedStyle(() => {
    const rotate = interpolate(isFlipped.value, [0, 1], [0, 180]);
    return {
      transform: [
        { perspective: 1000 },
        { rotateY: `${rotate}deg` },
      ],
    } as any;
  });

  const backFlipStyle = useAnimatedStyle(() => {
    const rotate = interpolate(isFlipped.value, [0, 1], [-180, 0]);
    return {
      transform: [
        { perspective: 1000 },
        { rotateY: `${rotate}deg` },
      ],
    } as any;
  });

  // TEST 4: OVERLAY ANIMATED STYLE (genres opacity on scroll)
  const overlayAnimatedStyle = useAnimatedStyle(() => {
    const translateX = scrollX.value;
    const cardOffset = index * interval;
    const distance = Math.abs(translateX - cardOffset);

    if (distance > interval * 1.2) {
      return { opacity: 0 };
    }

    const maxDistance = interval * 0.5;
    const progress = Math.min(distance / maxDistance, 1);
    const opacity = 1 - progress;
    const clampedOpacity = Math.max(0, Math.min(1, opacity));

    return {
      opacity: clampedOpacity,
    };
  });

  return (
    <View style={{ width: cardWidth + 16 }}>
      <Animated.View style={[
        {
          width: cardWidth,
          height: cardHeight,
          backgroundColor: colors.elevation1,
          borderRadius: 16,
          overflow: 'hidden',
        },
        cardAnimatedStyle
      ]}>
        <FastImage
          source={{
            uri: item.banner || item.poster,
            priority: FastImage.priority.normal,
            cache: FastImage.cacheControl.immutable
          }}
          style={{ width: '100%', height: '100%', position: 'absolute' }}
          resizeMode={FastImage.resizeMode.cover}
        />
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.2)", "rgba(0,0,0,0.6)"]}
          locations={[0.4, 0.7, 1]}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        />
        {item.logo && (
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 40, alignItems: 'center' }}>
            <Animated.View style={logoAnimatedStyle}>
              <FastImage
                source={{
                  uri: item.logo,
                  priority: FastImage.priority.high,
                  cache: FastImage.cacheControl.immutable
                }}
                style={{ width: Math.round(cardWidth * 0.72), height: 64 }}
                resizeMode={FastImage.resizeMode.contain}
                onLoad={() => setLogoLoaded(true)}
              />
            </Animated.View>
          </View>
        )}
        {/* TEST 4: GENRES with overlayAnimatedStyle */}
        {item.genres && (
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 12, alignItems: 'center' }}>
            <Animated.Text
              style={[{ color: 'rgba(255,255,255,0.7)', fontSize: 13, textAlign: 'center' }, overlayAnimatedStyle]}
              numberOfLines={1}
            >
              {item.genres.slice(0, 3).join(' • ')}
            </Animated.Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
});

interface CarouselCardProps {
  item: StreamingContent;
  colors: any;
  logoFailed: boolean;
  onLogoError: () => void;
  onPressInfo: () => void;
  scrollX: SharedValue<number>;
  index: number;
  flipped: boolean;
  onToggleFlip: () => void;
  interval: number;
  cardWidth: number;
  cardHeight: number;
  isTablet: boolean;
  isTVDevice?: boolean;
}

// Ultra-simple TV card - completely static, NO Reanimated at all
// Critical for 2-core CPUs like Fire TV Stick
// Focus visuals are handled by Focusable wrapper - this card just renders content
const TVSimpleCard: React.FC<{
  item: StreamingContent;
  colors: any;
  cardWidth: number;
  cardHeight: number;
}> = memo(({ item, colors, cardWidth, cardHeight }) => {
  // Completely static - no hooks, no animations, no shared values
  // Focus scale/border handled by parent Focusable via its animated styles
  return (
    <View style={{
      width: cardWidth,
      height: cardHeight,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: colors.elevation1,
    }}>
      <FastImage
        source={{
          uri: item.poster || item.banner,
          priority: FastImage.priority.normal,
          cache: FastImage.cacheControl.immutable
        }}
        style={{ width: '100%', height: '100%' }}
        resizeMode={FastImage.resizeMode.cover}
      />
    </View>
  );
}, (prevProps, nextProps) => {
  // Only re-render if item or dimensions change
  return prevProps.item.id === nextProps.item.id &&
         prevProps.cardWidth === nextProps.cardWidth;
});

// Wrapper component for TV hero card
// Extremely simple - just passes props to Focusable
// No focus state tracking needed - Focusable handles all focus visuals
interface TVHeroCardWrapperProps {
  item: StreamingContent;
  cardWidth: number;
  cardHeight: number;
  colors: any;
  onPress: () => void;
  onFocus: () => void;
  onBlur?: () => void;
  viewRef: React.RefObject<View> | undefined;
  downRef: React.RefObject<View> | undefined;
  blockRight?: boolean;
  blockLeft?: boolean;
  /** Direct node handle for left focus (used for first item to navigate to menu) */
  nextFocusLeftId?: number | null;
  /** Cached node handle for right navigation */
  nextFocusRightId?: number | null;
  /** Callback to register this item's node handle */
  onRegisterNodeHandle?: (view: View | null) => void;
}

const TVHeroCardWrapper: React.FC<TVHeroCardWrapperProps> = memo(({
  item,
  cardWidth,
  cardHeight,
  colors,
  onPress,
  onFocus,
  onBlur,
  viewRef,
  downRef,
  blockRight = false,
  blockLeft = false,
  nextFocusLeftId,
  nextFocusRightId,
  onRegisterNodeHandle,
}) => {
  // Border padding - space between poster and focus border frame
  const borderPadding = 4;
  const focusableWidth = cardWidth + borderPadding * 2;
  const focusableHeight = cardHeight + borderPadding * 2;

  return (
    <View style={{ width: focusableWidth + 12, alignItems: 'center', justifyContent: 'center' }}>
      <Focusable
        viewRef={viewRef}
        onPress={onPress}
        onFocus={onFocus}
        onBlur={onBlur}
        onLayout={() => onRegisterNodeHandle?.(viewRef?.current ?? null)}
        style={{
          width: focusableWidth,
          height: focusableHeight,
          padding: borderPadding,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        focusScale={1.0}
        unfocusedScale={1.0}
        borderRadius={20}
        showFocusBorder={true}
        animateBackground={false}
        nextFocusDown={downRef}
        blockRight={blockRight}
        blockLeft={blockLeft}
        nextFocusLeftId={nextFocusLeftId}
        nextFocusRightId={nextFocusRightId}
      >
        <TVSimpleCard
          item={item}
          colors={colors}
          cardWidth={cardWidth}
          cardHeight={cardHeight}
        />
      </Focusable>
    </View>
  );
}, (prevProps, nextProps) => {
  // Only re-render if item, dimensions, or navigation handles change
  // Focus visuals are handled by Focusable internally via animated styles (no re-render)
  return prevProps.item.id === nextProps.item.id &&
         prevProps.cardWidth === nextProps.cardWidth &&
         prevProps.cardHeight === nextProps.cardHeight &&
         prevProps.viewRef === nextProps.viewRef &&
         prevProps.nextFocusLeftId === nextProps.nextFocusLeftId &&
         prevProps.nextFocusRightId === nextProps.nextFocusRightId &&
         prevProps.blockLeft === nextProps.blockLeft;
});

const CarouselCard: React.FC<CarouselCardProps> = memo(({ item, colors, logoFailed, onLogoError, onPressInfo, scrollX, index, flipped, onToggleFlip, interval, cardWidth, cardHeight, isTablet, isTVDevice = false }) => {
  // TV path is now handled by TVSimpleCard in the parent component
  // This component is only for mobile/tablet with full animation support
  const [bannerLoaded, setBannerLoaded] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(false);

  const bannerOpacity = useSharedValue(0);
  const logoOpacity = useSharedValue(0);
  const isFlipped = useSharedValue(flipped ? 1 : 0);

  // Reset animations when component mounts/remounts to prevent glitching
  useEffect(() => {
    bannerOpacity.value = 0;
    logoOpacity.value = 0;
    setBannerLoaded(false);
    setLogoLoaded(false);
  }, [item.id]);

  const bannerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: bannerOpacity.value,
  }));

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
  }));

  // Flip styles
  const frontFlipStyle = useAnimatedStyle(() => {
    const rotate = interpolate(isFlipped.value, [0, 1], [0, 180]);
    return {
      transform: [
        { perspective: 1000 },
        { rotateY: `${rotate}deg` },
      ],
    } as any;
  });

  const backFlipStyle = useAnimatedStyle(() => {
    const rotate = interpolate(isFlipped.value, [0, 1], [-180, 0]);
    return {
      transform: [
        { perspective: 1000 },
        { rotateY: `${rotate}deg` },
      ],
    } as any;
  });

  // Sync animation with prop changes
  useEffect(() => {
    isFlipped.value = withTiming(flipped ? 1 : 0, { duration: 300, easing: Easing.out(Easing.cubic) });
  }, [flipped]);

  // Combined animation for genres and actions
  const overlayAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    const translateX = scrollX.value;
    const cardOffset = index * interval;
    const distance = Math.abs(translateX - cardOffset);

    if (distance > interval * 1.2) {
      return { opacity: 0 };
    }

    const maxDistance = interval * 0.5;
    const progress = Math.min(distance / maxDistance, 1);
    const opacity = 1 - progress;
    return { opacity: Math.max(0, Math.min(1, opacity)) };
  });

  // Mobile scroll-based animation
  const cardAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    const translateX = scrollX.value;
    const cardOffset = index * interval;
    const distance = Math.abs(translateX - cardOffset);

    if (distance > interval * 1.5) {
      return {
        transform: [{ scale: isTablet ? 0.95 : 0.9 }],
        opacity: isTablet ? 0.85 : 0.7
      };
    }

    const maxDistance = interval;
    const scale = 1 - (distance / maxDistance) * 0.1;
    const clampedScale = Math.max(isTablet ? 0.95 : 0.9, Math.min(1, scale));
    const opacity = 1 - (distance / maxDistance) * 0.3;
    const clampedOpacity = Math.max(isTablet ? 0.85 : 0.7, Math.min(1, opacity));

    return {
      transform: [{ scale: clampedScale }],
      opacity: clampedOpacity,
    };
  });

  // TEMPORARILY DISABLED FOR PERFORMANCE TESTING
  // const bannerParallaxStyle = useAnimatedStyle(() => {
  //   const translateX = scrollX.value;
  //   const cardOffset = index * (CARD_WIDTH + 16);
  //   const distance = translateX - cardOffset;
  //   
  //   // Reduced parallax effect to prevent displacement
  //   const parallaxOffset = distance * 0.05;
  //   
  //   return {
  //     transform: [{ translateX: parallaxOffset }],
  //   };
  // });

  // TEMPORARILY DISABLED FOR PERFORMANCE TESTING
  // const infoParallaxStyle = useAnimatedStyle(() => {
  //   const translateX = scrollX.value;
  //   const cardOffset = index * (CARD_WIDTH + 16);
  //   const distance = Math.abs(translateX - cardOffset);
  //   const maxDistance = CARD_WIDTH + 16;
  //   
  //   // Hide info section when scrolling (not centered)
  //   const progress = distance / maxDistance;
  //   const opacity = 1 - progress * 2; // Fade out faster when scrolling
  //   const clampedOpacity = Math.max(0, Math.min(1, opacity));
  //   
  //   // Minimal parallax for info section to prevent displacement
  //   const parallaxOffset = -(translateX - cardOffset) * 0.02;
  //   
  //   return {
  //     transform: [{ translateY: parallaxOffset }],
  //     opacity: clampedOpacity,
  //   };
  // });

  useEffect(() => {
    if (bannerLoaded) {
      bannerOpacity.value = withTiming(1, {
        duration: 250,
        easing: Easing.out(Easing.ease)
      });
    }
  }, [bannerLoaded]);

  useEffect(() => {
    if (logoLoaded) {
      logoOpacity.value = withTiming(1, {
        duration: 300,
        easing: Easing.out(Easing.ease)
      });
    }
  }, [logoLoaded]);

  return (
    <View style={{ width: cardWidth + 16 }}>
      <View style={{ width: cardWidth, height: cardHeight }}>
        <Animated.View style={[
          styles.card,
          cardAnimatedStyle,
          {
            backgroundColor: colors.elevation1,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.18)',
            width: cardWidth,
            height: cardHeight,
          }
        ] as StyleProp<ViewStyle>}>
          {isTablet && !isTVDevice ? (
            <>
              <View style={styles.bannerContainer as ViewStyle}>
                {!bannerLoaded && (
                  <View style={styles.skeletonBannerFull as ViewStyle} />
                )}
                <Animated.View style={[bannerAnimatedStyle, { flex: 1 }]}>
                  <FastImage
                    source={{
                      uri: item.banner || item.poster,
                      priority: FastImage.priority.normal,
                      cache: FastImage.cacheControl.immutable
                    }}
                    style={styles.banner as any}
                    resizeMode={FastImage.resizeMode.cover}
                    onLoad={() => setBannerLoaded(true)}
                  />
                </Animated.View>
                {/* Overlay removed for performance - readability via text shadows */}
              </View>
              <View style={styles.backContent as ViewStyle}>
                {item.logo && !logoFailed ? (
                  <FastImage
                    source={{ uri: item.logo, priority: FastImage.priority.normal, cache: FastImage.cacheControl.immutable }}
                    style={[styles.logo as any, { width: Math.round(cardWidth * 0.72) }]}
                    resizeMode={FastImage.resizeMode.contain}
                  />
                ) : (
                  <Text style={[styles.backTitle as TextStyle, { color: colors.highEmphasis }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                )}
                {item.year && (
                  <View style={styles.infoRow as ViewStyle}>
                    <View style={styles.infoItem as ViewStyle}>
                      <Ionicons name="calendar-outline" size={14} color={colors.mediumEmphasis} />
                      <Text style={[styles.infoText as TextStyle, { color: colors.mediumEmphasis }]}>{item.year}</Text>
                    </View>
                  </View>
                )}
                <ScrollView style={{ maxHeight: 120, width: Math.round(cardWidth * 0.85), alignSelf: 'center' }} showsVerticalScrollIndicator={false}>
                  <Text style={[
                    styles.backDescription as TextStyle,
                    {
                      color: colors.highEmphasis,
                      textAlign: 'center',
                      textShadowColor: 'rgba(0,0,0,0.6)',
                      textShadowOffset: { width: 0, height: 1 },
                      textShadowRadius: 2,
                    }
                  ]}>
                    {item.description || 'No description available'}
                  </Text>
                </ScrollView>
              </View>
              <TouchableOpacity activeOpacity={0.9} onPress={onPressInfo} style={StyleSheet.absoluteFillObject as any} />
            </>
          ) : (
            <>
              {/* FRONT FACE */}
              <Animated.View style={[styles.flipFace as any, styles.frontFace as any, frontFlipStyle]} pointerEvents={flipped ? 'none' : 'auto'}>
                <TouchableOpacity activeOpacity={0.9} onPress={onPressInfo} style={StyleSheet.absoluteFillObject as any}>
                  <View style={styles.bannerContainer as ViewStyle}>
                    {!bannerLoaded && (
                      <View style={styles.skeletonBannerFull as ViewStyle} />
                    )}
                    <Animated.View style={[bannerAnimatedStyle, { flex: 1 }]}>
                      <FastImage
                        source={{
                          // TV: use poster to show full artwork, mobile: use banner or poster
                          uri: isTVDevice ? (item.poster || item.banner) : (item.banner || item.poster),
                          priority: FastImage.priority.normal,
                          cache: FastImage.cacheControl.immutable
                        }}
                        style={styles.banner as any}
                        resizeMode={FastImage.resizeMode.cover}
                        onLoad={() => setBannerLoaded(true)}
                      />
                    </Animated.View>
                    {/* Overlay removed for performance - readability via text shadows */}
                  </View>
                  {/* Hide logo/title/genres on TV to show full poster */}
                  {!isTVDevice && (item.logo && !logoFailed ? (
                    <View style={[styles.logoOverlay as ViewStyle]} pointerEvents="none">
                      <Animated.View style={logoAnimatedStyle}>
                        <FastImage
                          source={{
                            uri: item.logo,
                            priority: FastImage.priority.high,
                            cache: FastImage.cacheControl.immutable
                          }}
                          style={[styles.logo as any, { width: Math.round(cardWidth * 0.72), height: 64 }]}
                          resizeMode={FastImage.resizeMode.contain}
                          onLoad={() => setLogoLoaded(true)}
                          onError={onLogoError}
                        />
                      </Animated.View>
                    </View>
                  ) : (
                    <View style={[styles.titleOverlay as ViewStyle]} pointerEvents="none">
                      <View>
                        <Text style={[styles.title as TextStyle, { color: colors.highEmphasis, textAlign: 'center', fontSize: 18 }]} numberOfLines={1}>
                          {item.name}
                        </Text>
                      </View>
                    </View>
                  ))}
                  {!isTVDevice && item.genres && (
                    <View style={[styles.genresOverlay as ViewStyle]} pointerEvents="none">
                      <View>
                        <Animated.Text
                          style={[styles.genres as TextStyle, { color: colors.mediumEmphasis, textAlign: 'center', fontSize: 13 }, overlayAnimatedStyle]}
                          numberOfLines={1}
                        >
                          {item.genres.slice(0, 3).join(' • ')}
                        </Animated.Text>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              </Animated.View>

              {/* BACK FACE */}
              <Animated.View style={[styles.flipFace as any, styles.backFace as any, backFlipStyle]} pointerEvents={flipped ? 'auto' : 'none'}>
                <View style={styles.bannerContainer as ViewStyle}>
                  <FastImage
                    source={{ uri: item.banner || item.poster, priority: FastImage.priority.low, cache: FastImage.cacheControl.immutable }}
                    style={styles.banner as any}
                    resizeMode={FastImage.resizeMode.cover}
                  />
                  {/* Overlay removed for performance - readability via text shadows */}
                </View>
                <View style={styles.backContent as ViewStyle}>
                  {item.logo && !logoFailed ? (
                    <FastImage
                      source={{ uri: item.logo, priority: FastImage.priority.normal, cache: FastImage.cacheControl.immutable }}
                      style={[styles.logo as any, { width: Math.round(cardWidth * 0.72) }]}
                      resizeMode={FastImage.resizeMode.contain}
                    />
                  ) : (
                    <Text style={[styles.backTitle as TextStyle, { color: colors.highEmphasis }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                  )}
                  {item.year && (
                    <View style={styles.infoRow as ViewStyle}>
                      <View style={styles.infoItem as ViewStyle}>
                        <Ionicons name="calendar-outline" size={14} color={colors.mediumEmphasis} />
                        <Text style={[styles.infoText as TextStyle, { color: colors.mediumEmphasis }]}>{item.year}</Text>
                      </View>
                    </View>
                  )}
                  <ScrollView style={{ maxHeight: 120 }} showsVerticalScrollIndicator={false}>
                    <Text style={[
                      styles.backDescription as TextStyle,
                      {
                        color: colors.highEmphasis,
                        textShadowColor: 'rgba(0,0,0,0.6)',
                        textShadowOffset: { width: 0, height: 1 },
                        textShadowRadius: 2,
                      }
                    ]}>
                      {item.description || 'No description available'}
                    </Text>
                  </ScrollView>
                </View>
              </Animated.View>

              {/* FLIP BUTTON */}
              <View style={styles.flipButtonContainer as ViewStyle} pointerEvents="box-none">
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={onToggleFlip}
                  style={styles.flipButton as ViewStyle}
                >
                  <Ionicons name={flipped ? 'close' : 'information-outline'} size={18} color={colors.white} />
                </TouchableOpacity>
              </View>
            </>
          )}
        </Animated.View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
  },
  backgroundContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  backgroundImage: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  backgroundOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  bottomBlend: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 160,
  },
  card: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  flipFace: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backfaceVisibility: 'hidden',
  },
  frontFace: {
    // front specific adjustments if needed
  },
  backFace: {
    // back specific adjustments if needed
    backfaceVisibility: 'hidden',
  },
  skeletonCard: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  skeletonBannerFull: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.06)'
  },
  bannerOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  skeletonInfo: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  skeletonLine: {
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.08)'
  },
  skeletonActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  skeletonPill: {
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)'
  },
  bannerContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  banner: {
    width: '100%',
    height: '100%',
  },
  bannerGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
  },
  flipButtonContainer: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
  },
  flipButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)'
  },

  info: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  genres: {
    marginTop: 2,
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    justifyContent: 'center',
  },
  logo: {
    width: 200,
    height: 64,
    marginBottom: 6,
  },
  logoOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 40, // Position above genres
  },
  backContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  backTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  backDescription: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 6,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    fontSize: 13,
  },
  titleOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 50, // Position above genres
  },
  genresOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 12, // Position at bottom
  },
});

export default React.memo(HeroCarousel);


