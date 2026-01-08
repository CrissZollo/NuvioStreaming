import React, { useCallback, useRef, useMemo, memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Dimensions, FlatList } from 'react-native';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { CatalogContent, StreamingContent } from '../../services/catalogService';
import { useTheme } from '../../contexts/ThemeContext';
import ContentItem from './ContentItem';
import Animated, { FadeIn } from 'react-native-reanimated';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useIsTV } from '../../contexts/TVContext';
import { Focusable } from '../tv/Focusable';
import { useTVFocus } from '../../contexts/TVFocusContext';

interface CatalogSectionProps {
  catalog: CatalogContent;
  /** Called when any item in this section receives focus (TV only) */
  onSectionFocus?: () => void;
  /** Whether this is the first catalog section (TV only - registers first item for side menu navigation) */
  isFirstSection?: boolean;
  /** Whether this is the last catalog section (TV only - constrains down navigation) */
  isLastSection?: boolean;
}

const { width } = Dimensions.get('window');

// Enhanced responsive breakpoints
const BREAKPOINTS = {
  phone: 0,
  tablet: 768,
  largeTablet: 1024,
  tv: 1440,
};

const getDeviceType = (deviceWidth: number) => {
  if (deviceWidth >= BREAKPOINTS.tv) return 'tv';
  if (deviceWidth >= BREAKPOINTS.largeTablet) return 'largeTablet';
  if (deviceWidth >= BREAKPOINTS.tablet) return 'tablet';
  return 'phone';
};

const deviceType = getDeviceType(width);
const isTablet = deviceType === 'tablet';
const isLargeTablet = deviceType === 'largeTablet';
const isTV = deviceType === 'tv';

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

// Calculate poster width matching ContentItem's logic
const calculateContentItemPosterWidth = (screenWidth: number, isTVDevice: boolean) => {
  const deviceType = getDeviceType(screenWidth);

  // Match ContentItem's calculatePosterLayout constants
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

  // Apply same sizeMultiplier as ContentItem (0.7 for TV)
  const sizeMultiplier = isTVDevice ? 0.7 : deviceType === 'largeTablet' ? 1.1 : deviceType === 'tablet' ? 1.0 : 0.9;
  return bestPosterWidth * sizeMultiplier;
};

// ViewAllCard component - looks like a movie poster but opens the full catalog
interface ViewAllCardProps {
  onPress: () => void;
  onItemFocus?: () => void;
  isLastInRow?: boolean;
  isLastRow?: boolean;
  focusRef?: React.RefObject<View>;
  isTVDevice: boolean;
  colors: any;
}

const ViewAllCard = memo<ViewAllCardProps>(({
  onPress,
  onItemFocus,
  isLastInRow,
  isLastRow,
  focusRef,
  isTVDevice,
  colors,
}) => {
  // Calculate poster dimensions matching ContentItem exactly
  const posterWidth = calculateContentItemPosterWidth(width, isTVDevice);
  const posterHeight = posterWidth * 1.5; // 2:3 aspect ratio
  const borderRadius = isTV ? 12 : isLargeTablet ? 14 : isTablet ? 12 : 12;

  const cardContent = (
    <View style={[
      styles.viewAllCardContent,
      {
        width: posterWidth,
        height: posterHeight,
        borderRadius,
        backgroundColor: colors.elevation2 || 'rgba(255,255,255,0.08)',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.15)',
      }
    ]}>
      <MaterialIcons
        name="arrow-forward"
        size={isTV ? 40 : isLargeTablet ? 36 : isTablet ? 32 : 28}
        color={colors.textMuted || '#888'}
      />
      <Text style={[
        styles.viewAllCardText,
        {
          color: colors.text || '#fff',
          fontSize: isTV ? 16 : isLargeTablet ? 15 : isTablet ? 14 : 13,
          marginTop: 8,
        }
      ]}>
        View All
      </Text>
    </View>
  );

  if (isTVDevice) {
    return (
      <Animated.View style={{ width: posterWidth }} entering={FadeIn.duration(300)}>
        <Focusable
          style={{ width: posterWidth, aspectRatio: 2/3, borderRadius }}
          onPress={onPress}
          onFocus={onItemFocus}
          borderRadius={borderRadius}
          animateBackground={false}
          focusScale={1.08}
          viewRef={focusRef}
          blockRight={isLastInRow}
          blockDown={isLastRow}
        >
          {cardContent}
        </Focusable>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={{ width: posterWidth }} entering={FadeIn.duration(300)}>
      <TouchableOpacity
        style={{ width: posterWidth, aspectRatio: 2/3, borderRadius }}
        activeOpacity={0.7}
        onPress={onPress}
      >
        {cardContent}
      </TouchableOpacity>
    </Animated.View>
  );
});

// Special marker for "View All" item
const VIEW_ALL_ITEM_ID = '__VIEW_ALL__';

const CatalogSection = ({ catalog, onSectionFocus, isFirstSection, isLastSection }: CatalogSectionProps) => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { currentTheme } = useTheme();
  const isTVDevice = useIsTV();
  const { setLastFocusedRowView } = useTVFocus();

  // Use isTVDevice for TV-specific styling (more reliable than screen width detection)
  const isTVLayout = isTVDevice || isTV;

  // Only create refs for first and last items (for navigation constraints)
  const firstItemRef = useRef<View>(null);
  const lastItemRef = useRef<View>(null);

  // When any item in this section gets focus, update the last focused row
  // so pressing right from menu returns to this row's first item
  const handleSectionItemFocus = useCallback(() => {
    if (isTVDevice && firstItemRef.current) {
      setLastFocusedRowView(firstItemRef.current);
    }
    onSectionFocus?.();
  }, [isTVDevice, setLastFocusedRowView, onSectionFocus]);

  const handleContentPress = useCallback((id: string, type: string) => {
    navigation.navigate('Metadata', { id, type, addonId: catalog.addon });
  }, [navigation, catalog.addon]);

  const handleViewAllPress = useCallback(() => {
    navigation.navigate('Catalog', {
      id: catalog.id,
      type: catalog.type,
      addonId: catalog.addon
    });
  }, [navigation, catalog.id, catalog.type, catalog.addon]);

  // Create data array with "View All" item at the end
  const dataWithViewAll = useMemo(() => {
    const viewAllItem: StreamingContent = {
      id: VIEW_ALL_ITEM_ID,
      type: catalog.type,
      name: 'View All',
      poster: '', // Empty string for type safety, not used since we render a custom card
    };
    return [...catalog.items, viewAllItem];
  }, [catalog.items, catalog.type]);

  const renderContentItem = useCallback(({ item, index }: { item: StreamingContent, index: number }) => {
    const isFirst = index === 0;
    const isLast = index === dataWithViewAll.length - 1;
    const isViewAllItem = item.id === VIEW_ALL_ITEM_ID;

    // Render "View All" card
    if (isViewAllItem) {
      return (
        <ViewAllCard
          onPress={handleViewAllPress}
          onItemFocus={handleSectionItemFocus}
          isLastInRow={isTVDevice}
          isLastRow={isTVDevice ? isLastSection : undefined}
          focusRef={isTVDevice ? lastItemRef : undefined}
          isTVDevice={isTVDevice}
          colors={currentTheme.colors}
        />
      );
    }

    return (
      <ContentItem
        item={item}
        onPress={handleContentPress}
        onItemFocus={handleSectionItemFocus}
        isFirstInRow={isTVDevice ? isFirst : undefined}
        isLastInRow={false} // Never last since View All is after
        isLastRow={isTVDevice ? isLastSection : undefined}
        focusRef={isTVDevice ? (isFirst ? firstItemRef : undefined) : undefined}
      />
    );
  }, [handleContentPress, handleViewAllPress, handleSectionItemFocus, isTVDevice, dataWithViewAll.length, isLastSection, currentTheme.colors]);

  // Memoize the ItemSeparatorComponent to prevent re-creation (responsive spacing)
  const separatorWidth = isTVLayout ? 8 : isLargeTablet ? 10 : isTablet ? 8 : 8;
  const ItemSeparator = useCallback(() => <View style={{ width: separatorWidth }} />, [separatorWidth]);

  // Memoize the keyExtractor to prevent re-creation
  const keyExtractor = useCallback((item: StreamingContent) => {
    if (item.id === VIEW_ALL_ITEM_ID) return `view-all-${catalog.id}`;
    return `${item.id}-${item.type}`;
  }, [catalog.id]);

  // Calculate item width including separator for getItemLayout
  const itemWidth = useMemo(() => {
    // ContentItem poster width varies by device, but we can use the computed layout
    // For TV: poster width is ~180px, for others use the calculated posterLayout
    const posterW = isTVLayout ? 180 : POSTER_WIDTH;
    const aspectRatio = 1.5; // poster height / width ratio
    return posterW;
  }, [isTVLayout]);

  // getItemLayout for optimized scrolling
  const getItemLayout = useCallback((_: any, index: number) => ({
    length: itemWidth + separatorWidth,
    offset: (itemWidth + separatorWidth) * index,
    index,
  }), [itemWidth, separatorWidth]);



  return (
    <View
      style={[styles.catalogContainer, isTVLayout && styles.catalogContainerTV]}
    >
      <View style={[
        styles.catalogHeader,
        {
          paddingHorizontal: isTVLayout ? 24 : isLargeTablet ? 28 : isTablet ? 24 : 16,
          marginBottom: isTVLayout ? 6 : 16,
        }
      ]}>
        <View style={styles.titleContainer}>
          <Text
            style={[
              styles.catalogTitle,
              {
                color: currentTheme.colors.text,
                fontSize: isTVLayout ? 18 : isLargeTablet ? 26 : isTablet ? 24 : 22,
              }
            ]}
            numberOfLines={1}
          >
            {catalog.name}
          </Text>
          <View
            style={[
              styles.titleUnderline,
              {
                backgroundColor: currentTheme.colors.primary,
                width: isTVLayout ? 40 : isLargeTablet ? 56 : isTablet ? 48 : 40,
                height: isTVLayout ? 2 : isLargeTablet ? 3 : 3,
              }
            ]}
          />
        </View>
      </View>

      <FlatList
        data={dataWithViewAll}
        renderItem={renderContentItem}
        keyExtractor={keyExtractor}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        decelerationRate="fast"
        scrollEnabled={!isTVDevice}
        nestedScrollEnabled={!isTVDevice}
        contentContainerStyle={StyleSheet.flatten([
          styles.catalogList,
          isTVLayout && styles.catalogListTV,
          {
            paddingHorizontal: isTVLayout ? 24 : isLargeTablet ? 28 : isTablet ? 24 : 16,
            paddingRight: (isTVLayout ? 24 : isLargeTablet ? 28 : isTablet ? 24 : 16) - posterLayout.partialPosterWidth,
          }
        ])}
        style={isTVDevice ? { overflow: 'visible' } : undefined}
        ItemSeparatorComponent={ItemSeparator}
        getItemLayout={getItemLayout}
        removeClippedSubviews={!isTVDevice} // Disable on TV to prevent clipping focused items
        initialNumToRender={isTVLayout ? 10 : isLargeTablet ? 5 : isTablet ? 4 : 3}
        maxToRenderPerBatch={isTVLayout ? 5 : isLargeTablet ? 4 : 3}
        windowSize={isTVLayout ? 5 : isLargeTablet ? 4 : 3}
        updateCellsBatchingPeriod={50}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  catalogContainer: {
    marginBottom: 28,
    overflow: 'visible', // Allow focused items to scale beyond container
    zIndex: 1,
  },
  catalogContainerTV: {
    marginBottom: 8, // Reduced margin for TV to fit more rows
  },
  catalogHeader: {
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
  catalogTitle: {
    fontSize: 24, // will be overridden responsively
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  titleUnderline: {
    position: 'absolute',
    bottom: -2,
    left: 0,
    width: 40, // overridden responsively
    height: 3,  // overridden responsively
    borderRadius: 2,
    opacity: 0.8,
  },
  viewAllCardContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  viewAllCardText: {
    fontWeight: '600',
    textAlign: 'center',
  },
  catalogList: {
    // padding will be applied responsively in JSX
    overflow: 'visible', // Allow focused items to scale beyond container
    paddingVertical: 8, // Extra vertical space for scaled items
  },
  catalogListTV: {
    paddingVertical: 4, // Reduced vertical padding for TV
  },
});

export default React.memo(CatalogSection, (prevProps, nextProps) => {
  // Only re-render if the catalog data or TV navigation props change
  return (
    prevProps.catalog.addon === nextProps.catalog.addon &&
    prevProps.catalog.id === nextProps.catalog.id &&
    prevProps.catalog.name === nextProps.catalog.name &&
    prevProps.catalog.items.length === nextProps.catalog.items.length &&
    prevProps.isFirstSection === nextProps.isFirstSection &&
    prevProps.isLastSection === nextProps.isLastSection &&
    // Deep compare the first few items to detect changes
    prevProps.catalog.items.slice(0, 3).every((item, index) =>
      nextProps.catalog.items[index] &&
      item.id === nextProps.catalog.items[index].id &&
      item.poster === nextProps.catalog.items[index].poster
    )
  );
});