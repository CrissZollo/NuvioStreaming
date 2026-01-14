import React, { useState, useEffect, useCallback, useRef, useMemo, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  useColorScheme,
  Dimensions,
  useWindowDimensions,
  ImageBackground,
  ScrollView,
  Platform,
  Image,
  Modal,
  Pressable,
  Alert,
  InteractionManager,
  AppState
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NavigationProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { StreamingContent, CatalogContent, catalogService } from '../services/catalogService';
import { stremioService } from '../services/stremioService';
import { Stream } from '../types/metadata';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import FastImage from '@d11/react-native-fast-image';
import Animated, { FadeIn, Layout, useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
import { PanGestureHandler } from 'react-native-gesture-handler';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { useCatalogContext } from '../contexts/CatalogContext';
import { ThisWeekSection } from '../components/home/ThisWeekSection';
import ContinueWatchingSection from '../components/home/ContinueWatchingSection';
import * as Haptics from 'expo-haptics';
import { tmdbService } from '../services/tmdbService';
import { logger } from '../utils/logger';
import { focusLog } from '../utils/focusPerformanceLogger';
import { storageService } from '../services/storageService';
import { getCatalogDisplayName, clearCustomNameCache } from '../utils/catalogNameUtils';
import { useHomeCatalogs } from '../hooks/useHomeCatalogs';
import { useFeaturedContent } from '../hooks/useFeaturedContent';
import { useSettings, settingsEmitter } from '../hooks/useSettings';
import FeaturedContent from '../components/home/FeaturedContent';
import HeroCarousel from '../components/home/HeroCarousel';
import AppleTVHero from '../components/home/AppleTVHero';
import CatalogSection from '../components/home/CatalogSection';
import { SkeletonFeatured } from '../components/home/SkeletonLoaders';
import LoadingSpinner from '../components/common/LoadingSpinner';
import homeStyles, { sharedStyles } from '../styles/homeStyles';
import { useTheme } from '../contexts/ThemeContext';
import type { Theme } from '../contexts/ThemeContext';
import { useLoading } from '../contexts/LoadingContext';
import * as ScreenOrientation from 'expo-screen-orientation';
import { mmkvStorage } from '../services/mmkvStorage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '../contexts/ToastContext';
import FirstTimeWelcome from '../components/FirstTimeWelcome';
import { HeaderVisibility } from '../contexts/HeaderVisibility';
import { useTrailer } from '../contexts/TrailerContext';
import { useIsTV } from '../contexts/TVContext';

// Constants
const CATALOG_SETTINGS_KEY = 'catalog_settings';

// In-memory cache for catalog settings to avoid repeated MMKV reads
let cachedCatalogSettings: Record<string, boolean> | null = null;
let catalogSettingsCacheTimestamp = 0;
const CATALOG_SETTINGS_CACHE_TTL = 30000; // 30 seconds

// Define interfaces for our data
interface Category {
  id: string;
  name: string;
}

interface ContinueWatchingRef {
  refresh: () => Promise<boolean>;
  getFirstItemRef: () => React.RefObject<View> | null;
}

type HomeScreenListItem =
  | { type: 'featured'; key: string }
  | { type: 'thisWeek'; key: string }
  | { type: 'continueWatching'; key: string }
  | { type: 'catalog'; catalog: CatalogContent; key: string }
  | { type: 'placeholder'; key: string }
  | { type: 'welcome'; key: string }
  | { type: 'loadMore'; key: string };

// Sample categories (real app would get these from API)
const SAMPLE_CATEGORIES: Category[] = [
  { id: 'movie', name: 'Movies' },
  { id: 'series', name: 'Series' },
  { id: 'channel', name: 'Channels' },
];

const SkeletonCatalog = React.memo(() => {
  const { currentTheme } = useTheme();
  return (
    <View style={styles.catalogContainer}>
      <View style={styles.loadingPlaceholder}>
        <LoadingSpinner size="small" text="" />
      </View>
    </View>
  );
});

const HomeScreen = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const isDarkMode = useColorScheme() === 'dark';
  const { currentTheme } = useTheme();
  const { setHomeLoading } = useLoading();
  const continueWatchingRef = useRef<ContinueWatchingRef>(null);
  const { settings } = useSettings();
  const { lastUpdate } = useCatalogContext(); // Add catalog context to listen for addon changes
  const { showInfo } = useToast();
  const { setTrailerPlaying } = useTrailer();
  const isTVDevice = useIsTV();
  // Use settings directly instead of duplicating state - reduces re-renders
  const showHeroSection = settings.showHeroSection;
  const featuredContentSource = settings.featuredContentSource;
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [hasContinueWatching, setHasContinueWatching] = useState(false);

  // TV navigation: stable ref for the first continue watching item (for hero -> continue watching navigation)
  // This ref is passed to ContinueWatchingSection which will assign its first item's ref to it
  const continueWatchingFirstRef = useRef<View>(null);

  // FlashList ref for TV scroll-to-center on focus
  const flashListRef = useRef<any>(null);

  // Shared value for scroll position (for parallax effects)
  const scrollY = useSharedValue(0);

  const [catalogs, setCatalogs] = useState<(CatalogContent | null)[]>([]);
  const [catalogsLoading, setCatalogsLoading] = useState(true);
  const [loadedCatalogCount, setLoadedCatalogCount] = useState(0);
  const [hasAddons, setHasAddons] = useState<boolean | null>(null);
  const [hintVisible, setHintVisible] = useState(false);
  const totalCatalogsRef = useRef(0);
  // TV needs more catalogs loaded upfront to handle fast D-pad navigation
  // Mobile can lazy load more aggressively
  const initialCatalogCount = isTVDevice ? 8 : 5;
  const [visibleCatalogCount, setVisibleCatalogCount] = useState(initialCatalogCount);
  // Prefetch threshold: load more catalogs when user is within N items of the end
  const prefetchThreshold = isTVDevice ? 3 : 2;
  const insets = useSafeAreaInsets();

  // Stabilize insets to prevent iOS layout shifts
  const [stableInsetsTop, setStableInsetsTop] = useState(insets.top);
  useEffect(() => {
    // Only update insets after initial mount to prevent shifting
    const timer = setTimeout(() => {
      setStableInsetsTop(insets.top);
    }, 100);
    return () => clearTimeout(timer);
  }, [insets.top]);

  const {
    featuredContent,
    allFeaturedContent,
    loading: featuredLoading,
    isSaved,
    handleSaveToLibrary,
    isItemSaved,
    refreshFeatured
  } = useFeaturedContent();

  // Guard to prevent overlapping fetch calls
  const isFetchingRef = useRef(false);

  // Progressive catalog loading function with performance optimizations
  const loadCatalogsProgressively = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    setCatalogsLoading(true);
    setCatalogs([]);
    setLoadedCatalogCount(0);

    try {
      // Check cache first
      let catalogSettings: Record<string, boolean> = {};
      const now = Date.now();

      if (cachedCatalogSettings && (now - catalogSettingsCacheTimestamp) < CATALOG_SETTINGS_CACHE_TTL) {
        catalogSettings = cachedCatalogSettings;
      } else {
        // Load from storage
        const catalogSettingsJson = await mmkvStorage.getItem(CATALOG_SETTINGS_KEY);
        catalogSettings = catalogSettingsJson ? JSON.parse(catalogSettingsJson) : {};

        // Update cache
        cachedCatalogSettings = catalogSettings;
        catalogSettingsCacheTimestamp = now;
      }

      const [addons, addonManifests] = await Promise.all([
        catalogService.getAllAddons(),
        stremioService.getInstalledAddonsAsync()
      ]);

      // Set hasAddons state based on whether we have any addons - ensure on main thread
      InteractionManager.runAfterInteractions(() => {
        setHasAddons(addons.length > 0);
      });

      // Create placeholder array with proper order and track indices
      let catalogIndex = 0;
      const catalogQueue: (() => Promise<void>)[] = [];

      // Launch all catalog loaders in parallel
      const launchAllCatalogs = () => {
        while (catalogQueue.length > 0) {
          const catalogLoader = catalogQueue.shift();
          if (catalogLoader) {
            catalogLoader();
          }
        }
      };

      for (const addon of addons) {
        if (addon.catalogs) {
          for (const catalog of addon.catalogs) {
            // Check if this catalog is enabled (default to true if no setting exists)
            const settingKey = `${addon.id}:${catalog.type}:${catalog.id}`;
            const isEnabled = catalogSettings[settingKey] ?? true;

            // Only load enabled catalogs
            if (isEnabled) {
              const currentIndex = catalogIndex;

              const catalogLoader = async () => {
                try {
                  const manifest = addonManifests.find((a: any) => a.id === addon.id);
                  if (!manifest) return;

                  const metas = await stremioService.getCatalog(manifest, catalog.type, catalog.id, 1);
                  if (metas && metas.length > 0) {
                    // Aggressively limit items per catalog on Android to reduce memory usage
                    const limit = Platform.OS === 'android' ? 18 : 30;
                    const limitedMetas = metas.slice(0, limit);

                    const items = limitedMetas.map((meta: any) => ({
                      id: meta.id,
                      type: meta.type,
                      name: meta.name,
                      poster: meta.poster,
                      posterShape: meta.posterShape,
                      // Remove banner and logo to reduce memory usage
                      imdbRating: meta.imdbRating,
                      year: meta.year,
                      genres: meta.genres,
                      description: meta.description,
                      runtime: meta.runtime,
                      released: meta.released,
                      directors: meta.director,
                      creators: meta.creator,
                      certification: meta.certification
                    }));

                    // Resolve custom display name; if custom exists, use as-is
                    const originalName = catalog.name || catalog.id;
                    let displayName = await getCatalogDisplayName(addon.id, catalog.type, catalog.id, originalName);
                    const isCustom = displayName !== originalName;

                    if (!isCustom) {
                      // De-duplicate repeated words (case-insensitive)
                      const words = displayName.split(' ').filter(Boolean);
                      const uniqueWords: string[] = [];
                      const seen = new Set<string>();
                      for (const w of words) {
                        const lw = w.toLowerCase();
                        if (!seen.has(lw)) { uniqueWords.push(w); seen.add(lw); }
                      }
                      displayName = uniqueWords.join(' ');

                      // Append content type if not present
                      const contentType = catalog.type === 'movie' ? 'Movies' : 'TV Shows';
                      if (!displayName.toLowerCase().includes(contentType.toLowerCase())) {
                        displayName = `${displayName} ${contentType}`;
                      }
                    }

                    const catalogContent = {
                      addon: addon.id,
                      type: catalog.type,
                      id: catalog.id,
                      name: displayName,
                      items
                    };

                    // Update the catalog at its specific position - ensure on main thread
                    InteractionManager.runAfterInteractions(() => {
                      setCatalogs(prevCatalogs => {
                        const newCatalogs = [...prevCatalogs];
                        newCatalogs[currentIndex] = catalogContent;
                        return newCatalogs;
                      });
                    });
                  }
                } catch (error) {
                  if (__DEV__) console.error(`[HomeScreen] Failed to load ${catalog.name} from ${addon.name}:`, error);
                } finally {
                  // Update loading count - ensure on main thread
                  InteractionManager.runAfterInteractions(() => {
                    setLoadedCatalogCount(prev => {
                      const next = prev + 1;
                      // Exit loading screen as soon as first catalog finishes
                      if (prev === 0) {
                        setCatalogsLoading(false);
                      }
                      // ** Crucial: If all catalogs processed, release the fetch guard **
                      if (next >= totalCatalogsRef.current) {
                        isFetchingRef.current = false;
                      }
                      return next;
                    });
                  });
                }
              };

              catalogQueue.push(catalogLoader);
              catalogIndex++;
            }
          }
        }
      }

      totalCatalogsRef.current = catalogIndex;

      // If no catalogs to load, release locks immediately
      if (catalogIndex === 0) {
        setCatalogsLoading(false);
        isFetchingRef.current = false;
        return;
      }

      // Initialize catalogs array with proper length - ensure on main thread
      InteractionManager.runAfterInteractions(() => {
        setCatalogs(new Array(catalogIndex).fill(null));
      });

      // Start all catalog requests in parallel
      launchAllCatalogs();
    } catch (error) {
      if (__DEV__) console.error('[HomeScreen] Error in progressive catalog loading:', error);
      InteractionManager.runAfterInteractions(() => {
        setCatalogsLoading(false);
      });
      isFetchingRef.current = false;
    }
  }, []);

  // Only count feature section as loading if it's enabled in settings
  // For catalogs, we show them progressively, so loading should be false as soon as we have any content
  const isLoading = useMemo(() => {
    // Exit loading as soon as at least one catalog is ready, regardless of featured
    if (loadedCatalogCount > 0) return false;
    const heroLoading = showHeroSection ? featuredLoading : false;
    return heroLoading && (catalogsLoading && loadedCatalogCount === 0);
  }, [showHeroSection, featuredLoading, catalogsLoading, loadedCatalogCount]);

  // Update global loading state
  useEffect(() => {
    setHomeLoading(isLoading);
  }, [isLoading, setHomeLoading]);

  // Load catalogs progressively on mount and when settings change
  useEffect(() => {
    loadCatalogsProgressively();
  }, [loadCatalogsProgressively]);

  // Listen for catalog changes (addon additions/removals) and reload catalogs
  useEffect(() => {
    // Skip initial mount (handled by the loadCatalogsProgressively effect)
    if (lastUpdate === 0) return;

    // Force reset the fetch guard to ensure refresh happens
    isFetchingRef.current = false;

    // Invalidate catalog settings cache so fresh settings are loaded
    cachedCatalogSettings = null;
    catalogSettingsCacheTimestamp = 0;

    // Reset TV navigation handles when catalogs reload
    if (isTVDevice) {
      catalogSectionHandlesRef.current.clear();
      initialHandlesRegisteredRef.current = false;
    }

    // Small delay to ensure previous fetch is fully stopped
    const timer = setTimeout(() => {
      loadCatalogsProgressively();
    }, 100);

    return () => clearTimeout(timer);
  }, [lastUpdate, loadCatalogsProgressively, isTVDevice]);

  // One-time hint after skipping login in onboarding
  useEffect(() => {
    let hideTimer: any;
    (async () => {
      try {
        const flag = await mmkvStorage.getItem('showLoginHintToastOnce');
        if (flag === 'true') {
          setHintVisible(true);
          await mmkvStorage.removeItem('showLoginHintToastOnce');
          hideTimer = setTimeout(() => setHintVisible(false), 2000);
          // Also show a global toast for consistency across screens
          // showInfo('Sign In Available', 'You can sign in anytime from Settings → Account');
        }
      } catch { }
    })();
    return () => {
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, []);

  // Create a refresh function for catalogs
  const refreshCatalogs = useCallback(() => {
    return loadCatalogsProgressively();
  }, [loadCatalogsProgressively]);

  // Settings are now read directly from useSettings() hook - no need for separate subscription
  // The useSettings hook already handles reactivity to settings changes

  useFocusEffect(
    useCallback(() => {
      const statusBarConfig = () => {
        // Ensure status bar is fully transparent and doesn't take up space
        StatusBar.setBarStyle("light-content");
        StatusBar.setTranslucent(true);
        StatusBar.setBackgroundColor('transparent');

        // For iOS specifically
        if (Platform.OS === 'ios') {
          StatusBar.setHidden(false);
        }
      };

      statusBarConfig();

      // Unlock orientation to allow free rotation
      ScreenOrientation.unlockAsync().catch(() => { });

      return () => {
        // Stop trailer when screen loses focus (navigating to other screens)
        setTrailerPlaying(false);
        logger.info('[HomeScreen] Screen blur - stopping trailer');
      };
    }, [setTrailerPlaying])
  );

  // Handle app state changes for smart cache management
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'background') {
        // Only clear memory cache when app goes to background
        // This frees memory while keeping disk cache intact for fast restoration
        try {
          FastImage.clearMemoryCache();
          if (__DEV__) console.log('[HomeScreen] Cleared memory cache on background');
        } catch (error) {
          if (__DEV__) console.warn('[HomeScreen] Failed to clear memory cache:', error);
        }
      }
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  useEffect(() => {
    // Only run cleanup when component unmounts completely
    return () => {
      if (Platform.OS === 'android') {
        StatusBar.setTranslucent(false);
        StatusBar.setBackgroundColor(currentTheme.colors.darkBackground);
      }

      // Clean up any lingering timeouts
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Don't clear FastImage cache on unmount - it causes broken images on remount
      // FastImage's native libraries (SDWebImage/Glide) handle memory automatically
      // Cache clearing only happens on app background (see AppState handler above)
    };
  }, [currentTheme.colors.darkBackground]);

  // Removed periodic forced cache clearing to avoid churn under load
  // useEffect(() => {}, [catalogs]);

  // Balanced preload images function using FastImage
  const preloadImages = useCallback(async (content: StreamingContent[]) => {
    if (!content.length) return;

    try {
      // Moderate prefetching for better performance balance
      const MAX_IMAGES = 10; // Preload 10 most important images

      // Only preload poster images (skip banner and logo entirely)
      const posterImages = content.slice(0, MAX_IMAGES)
        .map(item => item.poster)
        .filter(Boolean) as string[];

      // FastImage preload with proper source format
      const sources = posterImages.map(uri => ({
        uri,
        priority: FastImage.priority.normal,
        cache: FastImage.cacheControl.immutable
      }));

      // Preload all images at once - FastImage handles batching internally
      FastImage.preload(sources);
    } catch (error) {
      // Silently handle preload errors
      if (__DEV__) console.warn('Image preload error:', error);
    }
  }, []);

  const handleContentPress = useCallback((id: string, type: string) => {
    navigation.navigate('Metadata', { id, type });
  }, [navigation]);

  const handlePlayStream = useCallback(async (stream: Stream) => {
    if (!featuredContent) return;

    try {
      // Don't clear cache before player - causes broken images on return
      // FastImage's native libraries handle memory efficiently

      // Lock orientation to landscape before navigation to prevent glitches
      try {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);

        // Longer delay to ensure orientation is fully set before navigation
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (orientationError) {
        // If orientation lock fails, continue anyway but log it
        logger.warn('[HomeScreen] Orientation lock failed:', orientationError);
        // Still add a small delay
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // @ts-ignore
      navigation.navigate(Platform.OS === 'ios' ? 'PlayerIOS' : 'PlayerAndroid', {
        uri: stream.url as any,
        title: featuredContent.name,
        year: featuredContent.year,
        quality: stream.title?.match(/(\d+)p/)?.[1] || undefined,
        streamProvider: stream.name,
        id: featuredContent.id,
        type: featuredContent.type
      });
    } catch (error) {
      logger.error('[HomeScreen] Error in handlePlayStream:', error);

      // Fallback: navigate anyway
      // Fallback: navigate anyway
      // @ts-ignore
      navigation.navigate(Platform.OS === 'ios' ? 'PlayerIOS' : 'PlayerAndroid', {
        uri: stream.url as any,
        title: featuredContent.name,
        year: featuredContent.year,
        quality: stream.title?.match(/(\d+)p/)?.[1] || undefined,
        streamProvider: stream.name,
        id: featuredContent.id,
        type: featuredContent.type
      });
    }
  }, [featuredContent, navigation]);

  const refreshContinueWatching = useCallback(async () => {
    if (continueWatchingRef.current) {
      try {
        const hasContent = await continueWatchingRef.current.refresh();
        setHasContinueWatching(hasContent);

      } catch (error) {
        if (__DEV__) console.error('[HomeScreen] Error refreshing continue watching:', error);
        setHasContinueWatching(false);
      }
    }
  }, []);

  // Use refs to track state for event listeners without triggering re-effects
  const catalogsLengthRef = useRef(catalogs.length);
  const catalogsLoadingRef = useRef(catalogsLoading);

  useEffect(() => {
    catalogsLengthRef.current = catalogs.length;
  }, [catalogs.length]);

  useEffect(() => {
    catalogsLoadingRef.current = catalogsLoading;
  }, [catalogsLoading]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // Only refresh continue watching section on focus
      refreshContinueWatching();
      // Don't reload catalogs unless they haven't been loaded yet
      // Uses refs to avoid re-binding the listener on every state change
      if (catalogsLengthRef.current === 0 && !catalogsLoadingRef.current) {
        loadCatalogsProgressively();
      }
    });

    return unsubscribe;
  }, [navigation, refreshContinueWatching, loadCatalogsProgressively]);

  // Memoize the loading screen to prevent unnecessary re-renders
  const renderLoadingScreen = useMemo(() => {
    if (isLoading) {
      return (
        <View style={[styles.container, { backgroundColor: currentTheme.colors.darkBackground }]}>
          <StatusBar
            barStyle="light-content"
            backgroundColor="transparent"
            translucent
          />
          <View style={styles.loadingMainContainer}>
            <LoadingSpinner size="large" offsetY={-20} />
          </View>
        </View>
      );
    }
    return null;
  }, [isLoading, currentTheme.colors]);

  // Stabilize listData to prevent FlashList re-renders
  const listData = useMemo(() => {
    const data: HomeScreenListItem[] = [];

    // If no addons are installed, just show the welcome component
    if (hasAddons === false) {
      data.push({ type: 'welcome', key: 'welcome' });
      return data;
    }

    // Normal flow when addons are present (featured moved to ListHeaderComponent)
    data.push({ type: 'thisWeek', key: 'thisWeek' });

    // Only show a limited number of catalogs initially for performance
    const catalogsToShow = catalogs.slice(0, visibleCatalogCount);

    catalogsToShow.forEach((catalog, index) => {
      if (catalog) {
        // Include addon, type, id, AND index to ensure uniqueness
        // Some addons may have duplicate catalog IDs across different types
        data.push({ type: 'catalog', catalog, key: `${catalog.addon}-${catalog.type}-${catalog.id}-${index}` });
      } else {
        // Add a key for placeholders
        data.push({ type: 'placeholder', key: `placeholder-${index}` });
      }
    });

    // Add a "Load More" button if there are more catalogs to show
    if (catalogs.length > visibleCatalogCount && catalogs.filter(c => c).length > visibleCatalogCount) {
      data.push({ type: 'loadMore', key: 'load-more' });
    }

    return data;
  }, [hasAddons, catalogs, visibleCatalogCount]);

  const handleLoadMoreCatalogs = useCallback(() => {
    setVisibleCatalogCount(prev => Math.min(prev + 3, catalogs.length));
  }, [catalogs.length]);

  // Stable keyExtractor for FlashList
  const keyExtractor = useCallback((item: HomeScreenListItem) => item.key, []);

  // Use reactive window dimensions that update on orientation changes
  const { width: windowWidth } = useWindowDimensions();
  const isTablet = useMemo(() => {
    return windowWidth >= 768;
  }, [windowWidth]);

  // Memoize individual section components to prevent re-renders
  const memoizedFeaturedContent = useMemo(() => {
    // TV uses carousel by default, mobile uses user preference
    const heroStyleToUse = isTVDevice ? 'carousel' : settings.heroStyle;

    // AppleTVHero is only available on mobile devices (not tablets or TV)
    if (heroStyleToUse === 'appletv' && !isTablet && !isTVDevice) {
      return (
        <AppleTVHero
          featuredContent={featuredContent || null}
          allFeaturedContent={allFeaturedContent || []}
          loading={featuredLoading}
          scrollY={scrollY}
        />
      );
    } else if (heroStyleToUse === 'carousel') {
      // Carousel works on both TV and mobile
      return (
        <HeroCarousel
          items={allFeaturedContent || (featuredContent ? [featuredContent] : [])}
          loading={featuredLoading}
          continueWatchingFirstRef={continueWatchingFirstRef}
        />
      );
    } else {
      // Legacy style
      return (
        <>
          <FeaturedContent
            featuredContent={featuredContent || null}
            isSaved={isSaved}
            handleSaveToLibrary={handleSaveToLibrary}
            loading={featuredLoading}
          />
          <LinearGradient
            colors={["transparent", currentTheme.colors.darkBackground]}
            locations={[0, 1]}
            style={{
              height: isTablet ? 40 : 30,
              width: '100%',
              marginTop: -(isTablet ? 40 : 30),
              position: 'relative',
              zIndex: -1,
            }}
            pointerEvents="none"
          />
        </>
      );
    }
  }, [isTablet, isTVDevice, settings.heroStyle, allFeaturedContent, featuredContent, isSaved, handleSaveToLibrary, featuredLoading, currentTheme.colors.darkBackground]);

  const memoizedThisWeekSection = useMemo(() => <ThisWeekSection />, []);
  const memoizedContinueWatchingSection = useMemo(() => (
    <ContinueWatchingSection
      ref={continueWatchingRef}
      firstItemRef={isTVDevice ? continueWatchingFirstRef : undefined}
    />
  ), [isTVDevice]);
  const memoizedHeader = useMemo(() => (
    <>
      {showHeroSection ? memoizedFeaturedContent : null}
      {memoizedContinueWatchingSection}
    </>
  ), [showHeroSection, memoizedFeaturedContent, memoizedContinueWatchingSection]);
  // Track scroll direction manually for reliable behavior across platforms
  const lastScrollYRef = useRef(0);
  const lastToggleRef = useRef(0);
  const scrollAnimationFrameRef = useRef<number | null>(null);
  const isScrollingRef = useRef(false);

  const toggleHeader = useCallback((hide: boolean) => {
    const now = Date.now();
    if (now - lastToggleRef.current < 120) return; // debounce
    lastToggleRef.current = now;
    HeaderVisibility.setHidden(hide);
  }, []);

  // TV: Scroll to keep focused catalog row visible (only scroll when needed)
  const lastFocusedIndexRef = useRef<number>(-1);
  const isTVScrollingRef = useRef(false);
  // Track visible range to avoid unnecessary scrolls
  const visibleRangeRef = useRef<{ first: number; last: number }>({ first: 0, last: 5 });
  // Debounce scroll calls to prevent jitter during rapid navigation
  const lastScrollTimeRef = useRef(0);
  // Ref to track listData without causing callback recreation
  const listDataRef = useRef<HomeScreenListItem[]>([]);
  // Pre-computed catalog indices to avoid O(n) searches in renderListItem
  const catalogIndicesRef = useRef<{ firstCatalogIndex: number; lastCatalogIndex: number; hasLoadMore: boolean }>({
    firstCatalogIndex: -1,
    lastCatalogIndex: -1,
    hasLoadMore: false,
  });
  // Update refs when listData changes
  listDataRef.current = listData;
  // Pre-compute indices once when listData changes (in the same render)
  let firstIdx = -1;
  let lastIdx = -1;
  let hasLoadMoreFlag = false;
  for (let i = 0; i < listData.length; i++) {
    if (listData[i].type === 'catalog') {
      if (firstIdx === -1) firstIdx = i;
      lastIdx = i;
    } else if (listData[i].type === 'loadMore') {
      hasLoadMoreFlag = true;
    }
  }
  catalogIndicesRef.current = { firstCatalogIndex: firstIdx, lastCatalogIndex: lastIdx, hasLoadMore: hasLoadMoreFlag };

  // Track each catalog section's first item node handle for explicit vertical navigation
  // This allows pressing UP/DOWN to directly jump to the target section without native focus search
  // Key: listData index, Value: node handle of first focusable item in that section
  const catalogSectionHandlesRef = useRef<Map<number, number>>(new Map());

  // Track when section handles are ready to trigger re-render of CatalogSections
  // This ensures sections get updated navigation props after all handles are registered
  const [sectionHandlesVersion, setSectionHandlesVersion] = useState(0);
  const pendingHandleUpdateRef = useRef<NodeJS.Timeout | null>(null);
  // Track if initial handles have been registered (for immediate update on first sections)
  const initialHandlesRegisteredRef = useRef(false);

  // Callback to register a catalog section's first item handle
  const handleCatalogFirstItemReady = useCallback((listIndex: number, handle: number | null) => {
    if (handle) {
      const prevHandle = catalogSectionHandlesRef.current.get(listIndex);
      const prevSize = catalogSectionHandlesRef.current.size;
      catalogSectionHandlesRef.current.set(listIndex, handle);
      const newSize = catalogSectionHandlesRef.current.size;

      // Check if this is a new registration or if the handle value changed
      const isNewKey = newSize > prevSize;
      const handleChanged = prevHandle !== handle;

      // Trigger re-render when a new handle is registered OR when handle value changes
      // Handle changes can occur due to FlashList recycling views
      if ((isNewKey || handleChanged) && newSize >= 2) {
        // Clear any pending update to batch multiple registrations
        if (pendingHandleUpdateRef.current) {
          clearTimeout(pendingHandleUpdateRef.current);
        }

        // For first few sections, use immediate update (no debounce) for faster initial navigation
        // After initial sections are set up, use debounce to batch later registrations
        const isInitialSetup = !initialHandlesRegisteredRef.current;

        if (isInitialSetup && newSize >= 3) {
          // First 3+ sections are ready - update immediately
          initialHandlesRegisteredRef.current = true;
          setSectionHandlesVersion(v => v + 1);
        } else {
          // Schedule update after a short delay to batch registrations
          // Use shorter delay (16ms = 1 frame) for responsiveness
          pendingHandleUpdateRef.current = setTimeout(() => {
            setSectionHandlesVersion(v => v + 1);
            pendingHandleUpdateRef.current = null;
          }, 16);
        }
      }
    }
  }, []);

  // Cleanup pending timeout on unmount
  useEffect(() => {
    return () => {
      if (pendingHandleUpdateRef.current) {
        clearTimeout(pendingHandleUpdateRef.current);
      }
    };
  }, []);

  // Stable getter function for adjacent section handles
  // This is passed to CatalogSection and called at render time to get latest handles from ref
  // Using a ref-based function ensures it always returns current values without needing re-renders
  const getAdjacentSectionHandlesRef = useRef((listIndex: number) => {
    const currentListData = listDataRef.current;

    // Find previous catalog section
    let prevHandle: number | null = null;
    for (let i = listIndex - 1; i >= 0; i--) {
      if (currentListData[i]?.type === 'catalog') {
        prevHandle = catalogSectionHandlesRef.current.get(i) || null;
        break;
      }
    }

    // Find next catalog section
    let nextHandle: number | null = null;
    for (let i = listIndex + 1; i < currentListData.length; i++) {
      if (currentListData[i]?.type === 'catalog') {
        nextHandle = catalogSectionHandlesRef.current.get(i) || null;
        break;
      }
    }

    return { prevHandle, nextHandle };
  });

  // Also keep the useCallback version for cases where we need dependency tracking
  const getAdjacentSectionHandles = useCallback((listIndex: number) => {
    return getAdjacentSectionHandlesRef.current(listIndex);
  }, [sectionHandlesVersion]);

  const handleCatalogFocus = useCallback((index: number) => {
    if (!isTVDevice || !flashListRef.current) return;

    const currentListData = listDataRef.current;

    // Skip if same index to avoid unnecessary scrolls
    if (lastFocusedIndexRef.current === index) return;

    // Validate index is within bounds
    if (index < 0 || index >= currentListData.length) return;

    // Skip scrolling for placeholder items (catalogs still loading)
    const item = currentListData[index];
    if (!item || item.type === 'placeholder') return;

    lastFocusedIndexRef.current = index;

    // TV Prefetch: Auto-load more catalogs when approaching the end
    const { lastCatalogIndex } = catalogIndicesRef.current;
    const catalogItemsFromEnd = lastCatalogIndex - index;

    if (catalogItemsFromEnd <= prefetchThreshold && catalogs.length > visibleCatalogCount) {
      setVisibleCatalogCount(prev => Math.min(prev + 4, catalogs.length));
    }

    // Only scroll if item is near edges or outside visible range
    // This prevents unnecessary scroll adjustments when item is already well-positioned
    const { first, last } = visibleRangeRef.current;
    const isNearTop = index <= first + 1;
    const isNearBottom = index >= last - 1;
    const needsScroll = isNearTop || isNearBottom;

    if (needsScroll) {
      // Debounce rapid scroll calls (100ms minimum between scrolls)
      const now = Date.now();
      if (now - lastScrollTimeRef.current < 100) {
        return;
      }
      lastScrollTimeRef.current = now;

      try {
        flashListRef.current.scrollToIndex({
          index,
          animated: false,
          viewPosition: 0.3,
        });
      } catch (e) {
        // FlashList may throw if index is out of bounds during loading
      }
    }
  }, [isTVDevice, prefetchThreshold, catalogs.length, visibleCatalogCount]);

  // Track visible items to optimize scroll decisions
  const handleViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
    if (!isTVDevice || viewableItems.length === 0) return;
    const indices = viewableItems.map(item => item.index).filter((i): i is number => i !== null);
    if (indices.length > 0) {
      visibleRangeRef.current = {
        first: Math.min(...indices),
        last: Math.max(...indices),
      };
    }
  }, [isTVDevice]);

  // Stabilize renderItem to prevent FlashList re-renders
  const renderListItem = useCallback(({ item, index }: { item: HomeScreenListItem; index: number }) => {
    switch (item.type) {
      case 'thisWeek':
        return memoizedThisWeekSection;
      case 'continueWatching':
        return null; // Moved to ListHeaderComponent to avoid remounts on scroll
      case 'catalog':
        // Use pre-computed indices from ref (O(1) instead of O(n) searches)
        const { firstCatalogIndex, lastCatalogIndex, hasLoadMore } = catalogIndicesRef.current;
        const isFirstCatalog = isTVDevice && index === firstCatalogIndex;
        const isLastCatalog = isTVDevice && !hasLoadMore && index === lastCatalogIndex;
        // Get adjacent section handles for explicit vertical navigation
        const { prevHandle, nextHandle } = isTVDevice ? getAdjacentSectionHandles(index) : { prevHandle: null, nextHandle: null };
        return (
          <CatalogSection
            catalog={item.catalog}
            onSectionFocus={isTVDevice ? () => handleCatalogFocus(index) : undefined}
            isFirstSection={isFirstCatalog}
            isLastSection={isLastCatalog}
            prevSectionFirstItemHandle={prevHandle}
            nextSectionFirstItemHandle={nextHandle}
            onFirstItemHandleReady={isTVDevice ? (handle) => handleCatalogFirstItemReady(index, handle) : undefined}
          />
        );
      case 'placeholder':
        return (
          <Animated.View>
            <View style={styles.catalogPlaceholder}>
              <View style={styles.placeholderHeader}>
                <View style={[styles.placeholderTitle, { backgroundColor: currentTheme.colors.elevation1 }]} />
                <LoadingSpinner size="small" text="" />
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.placeholderPosters}>
                {[...Array(3)].map((_, posterIndex) => (
                  <View
                    key={posterIndex}
                    style={[styles.placeholderPoster, { backgroundColor: currentTheme.colors.elevation1 }]}
                  />
                ))}
              </ScrollView>
            </View>
          </Animated.View>
        );
      case 'loadMore':
        return (
          <View>
            <View style={styles.loadMoreContainer}>
              <TouchableOpacity
                style={[styles.loadMoreButton, { backgroundColor: currentTheme.colors.primary }]}
                onPress={handleLoadMoreCatalogs}
              >
                <MaterialIcons name="expand-more" size={20} color={currentTheme.colors.white} />
                <Text style={[styles.loadMoreText, { color: currentTheme.colors.white }]}>
                  Load More Catalogs
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      case 'welcome':
        return <FirstTimeWelcome />;
      default:
        return null;
    }
  }, [memoizedThisWeekSection, currentTheme.colors.elevation1, currentTheme.colors.primary, currentTheme.colors.white, handleLoadMoreCatalogs, isTVDevice, handleCatalogFocus, getAdjacentSectionHandles, handleCatalogFirstItemReady, sectionHandlesVersion]); // Removed listData - using ref

  // FlashList: using minimal props per installed version

  const ListFooterComponent = useMemo(() => (
    <>
      {catalogsLoading && loadedCatalogCount > 0 && loadedCatalogCount < totalCatalogsRef.current && null}
      {!catalogsLoading && catalogs.filter(c => c).length === 0 && (
        <View style={[styles.emptyCatalog, { backgroundColor: currentTheme.colors.elevation1 }]}>
          <MaterialIcons name="movie-filter" size={40} color={currentTheme.colors.textDark} />
          <Text style={{ color: currentTheme.colors.textDark, marginTop: 8, fontSize: 16, textAlign: 'center' }}>
            No content available
          </Text>
          <TouchableOpacity
            style={[styles.addCatalogButton, { backgroundColor: currentTheme.colors.primary }]}
            onPress={() => navigation.navigate('Settings')}
          >
            <MaterialIcons name="add-circle" size={20} color={currentTheme.colors.white} />
            <Text style={[styles.addCatalogButtonText, { color: currentTheme.colors.white }]}>Add Catalogs</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  ), [catalogsLoading, catalogs, loadedCatalogCount, totalCatalogsRef.current, navigation, currentTheme.colors]);

  // Memoize scroll handler with requestAnimationFrame throttling for better performance
  const handleScroll = useCallback((event: any) => {
    // Persist the event before using requestAnimationFrame to prevent event pooling issues
    event.persist();

    // Cancel any pending animation frame
    if (scrollAnimationFrameRef.current !== null) {
      cancelAnimationFrame(scrollAnimationFrameRef.current);
    }

    // Capture scroll values immediately before async operation
    const scrollYValue = event.nativeEvent.contentOffset.y;

    // Update shared value for parallax (on UI thread)
    scrollY.value = scrollYValue;

    // Use requestAnimationFrame to throttle scroll handling
    scrollAnimationFrameRef.current = requestAnimationFrame(() => {
      const y = scrollYValue;
      const dy = y - lastScrollYRef.current;
      lastScrollYRef.current = y;

      isScrollingRef.current = Math.abs(dy) > 0;

      if (y <= 10) {
        toggleHeader(false);
        return;
      }
      // Threshold to avoid jitter
      if (dy > 6) {
        toggleHeader(true); // scrolling down
      } else if (dy < -6) {
        toggleHeader(false); // scrolling up
      }

      scrollAnimationFrameRef.current = null;
    });
  }, [toggleHeader]);

  // Memoize content container style - use stable insets to prevent iOS shifting
  // Don't add paddingTop when using AppleTVHero as it handles its own top spacing
  const contentContainerStyle = useMemo(() => {
    const heroStyleToUse = settings.heroStyle;
    const isUsingAppleTVHero = heroStyleToUse === 'appletv' && !isTablet && showHeroSection;

    return StyleSheet.flatten([
      styles.scrollContent,
      { paddingTop: isUsingAppleTVHero ? 0 : stableInsetsTop }
    ]);
  }, [stableInsetsTop, settings.heroStyle, isTablet, showHeroSection]);

  // Memoize the main content section
  const renderMainContent = useMemo(() => {
    if (isLoading) return null;

    return (
      <View style={[styles.container, { backgroundColor: currentTheme.colors.darkBackground }]}>
        <StatusBar
          barStyle="light-content"
          backgroundColor="transparent"
          translucent
        />
        <FlashList
          ref={flashListRef}
          data={listData}
          renderItem={renderListItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={contentContainerStyle}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          nestedScrollEnabled={true}
          estimatedItemSize={300}
          drawDistance={isTVDevice ? 900 : 250}
          ListHeaderComponent={memoizedHeader}
          ListFooterComponent={ListFooterComponent}
          onEndReached={handleLoadMoreCatalogs}
          onEndReachedThreshold={0.6}
          onScroll={handleScroll}
          onViewableItemsChanged={isTVDevice ? handleViewableItemsChanged : undefined}
          viewabilityConfig={isTVDevice ? { itemVisiblePercentThreshold: 50 } : undefined}
          extraData={isTVDevice ? sectionHandlesVersion : undefined}
        />
        {/* Toasts are rendered globally at root */}
      </View>
    );
  }, [
    isLoading,
    currentTheme.colors.darkBackground,
    listData,
    renderListItem,
    keyExtractor,
    contentContainerStyle,
    memoizedHeader,
    ListFooterComponent,
    handleLoadMoreCatalogs,
    handleScroll,
    isTVDevice,
    handleViewableItemsChanged,
    sectionHandlesVersion
  ]);

  return isLoading ? renderLoadingScreen : renderMainContent;
};

const { width, height } = Dimensions.get('window');

// Dynamic poster calculation based on screen width - show 1/4 of next poster
const calculatePosterLayout = (screenWidth: number) => {
  const MIN_POSTER_WIDTH = 100; // Reduced minimum for more posters
  const MAX_POSTER_WIDTH = 130; // Reduced maximum for more posters
  const LEFT_PADDING = 16; // Left padding
  const SPACING = 8; // Space between posters

  // Calculate available width for posters (reserve space for left padding)
  const availableWidth = screenWidth - LEFT_PADDING;

  // Try different numbers of full posters to find the best fit
  let bestLayout = { numFullPosters: 3, posterWidth: 120 };

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

const styles = StyleSheet.create<any>({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 90,
  },
  loadingMainContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    // Ensure perfect centering
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  loadingMoreCatalogs: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 8,
  },
  loadingMoreText: {
    marginLeft: 12,
    fontSize: 14,
  },
  catalogPlaceholder: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  placeholderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  placeholderTitle: {
    width: 150,
    height: 20,
    borderRadius: 4,
  },
  placeholderPosters: {
    flexDirection: 'row',
    paddingVertical: 8,
    gap: 8,
  },
  placeholderPoster: {
    width: POSTER_WIDTH,
    aspectRatio: 2 / 3,
    borderRadius: 12,
    marginRight: 2,
  },
  emptyCatalog: {
    padding: 32,
    alignItems: 'center',
    margin: 16,
    borderRadius: 16,
  },
  addCatalogButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 30,
    marginTop: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  addCatalogButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  loadMoreContainer: {
    padding: 16,
    alignItems: 'center',
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  loadMoreText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  toast: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(99, 102, 241, 0.95)',
    borderRadius: 12,
  },
  toastText: {
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
    fontSize: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featuredContainer: {
    width: '100%',
    height: height * 0.6,
    marginTop: Platform.OS === 'ios' ? 0 : 0,
    marginBottom: 8,
    position: 'relative',
  },
  featuredBanner: {
    width: '100%',
    height: '100%',
  },
  featuredGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'space-between',
  },
  featuredContent: {
    padding: 24,
    paddingBottom: 16,
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
    gap: 12,
  },
  featuredLogo: {
    width: width * 0.7,
    height: 100,
    marginBottom: 0,
    alignSelf: 'center',
  },
  featuredTitle: {
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 0,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  genreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 4,
  },
  genreText: {
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.9,
  },
  genreDot: {
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.6,
    marginHorizontal: 4,
  },
  featuredButtons: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-evenly',
    width: '100%',
    flex: 1,
    maxHeight: 65,
    paddingTop: 16,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    flex: 0,
    width: 150,
  },
  myListButton: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 0,
    gap: 6,
    width: 44,
    height: 44,
    flex: null,
  },
  infoButton: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 0,
    gap: 4,
    width: 44,
    height: 44,
    flex: null,
  },
  playButtonText: {
    color: '#000000',
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 16,
  },
  myListButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  infoButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  catalogContainer: {
    marginBottom: 24,
    paddingTop: 0,
    marginTop: 16,
  },
  catalogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  titleContainer: {
    position: 'relative',
  },
  catalogTitle: {
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  titleUnderline: {
    position: 'absolute',
    bottom: -2,
    left: 0,
    width: 35,
    height: 2,
    borderRadius: 1,
    opacity: 0.8,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '700',
    marginRight: 4,
  },
  catalogList: {
    paddingLeft: 16,
    paddingRight: 16 - posterLayout.partialPosterWidth,
    paddingBottom: 12,
    paddingTop: 6,
  },
  contentItem: {
    width: POSTER_WIDTH,
    aspectRatio: 2 / 3,
    margin: 0,
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  poster: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
  },
  imdbLogo: {
    width: 35,
    height: 17,
    marginRight: 4,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  ratingBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 3,
  },
  skeletonBox: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  skeletonFeatured: {
    width: '100%',
    height: height * 0.6,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    marginBottom: 0,
  },
  skeletonPoster: {
    marginHorizontal: 4,
    borderRadius: 16,
  },
  contentItemContainer: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  libraryIndicatorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  libraryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalOverlayPressable: {
    flex: 1,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 10,
  },
  menuContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.select({ ios: 40, android: 24 }),
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  menuHeader: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuPoster: {
    width: 60,
    height: 90,
    borderRadius: 12,
  },
  menuTitleContainer: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  menuYear: {
    fontSize: 14,
  },
  menuOptions: {
    paddingTop: 8,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lastMenuOption: {
    borderBottomWidth: 0,
  },
  menuOptionText: {
    fontSize: 16,
    marginLeft: 16,
  },
  watchedIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    padding: 2,
  },
  libraryBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 8,
    padding: 4,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  featuredImage: {
    width: '100%',
    height: '100%',
  },
  featuredContentContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  featuredTitleText: {
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  loadingPlaceholder: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    marginHorizontal: 16,
  },
  featuredLoadingContainer: {
    height: height * 0.4,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

import { DeviceEventEmitter } from 'react-native';

const HomeScreenWithFocusSync = (props: any) => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      DeviceEventEmitter.emit('watchedStatusChanged');
    });
    return () => unsubscribe();
  }, [navigation]);
  return <HomeScreen {...props} />;
};

export default React.memo(HomeScreenWithFocusSync);

