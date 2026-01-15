import React, { useCallback, useRef, useMemo, memo, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Dimensions, FlatList, findNodeHandle } from 'react-native';
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
import { focusLog } from '../../utils/focusPerformanceLogger';
import { navLog } from '../../utils/navigationDebugLogger';

interface CatalogSectionProps {
  catalog: CatalogContent;
  /** Called when any item in this section receives focus (TV only) */
  onSectionFocus?: () => void;
  /** Whether this is the first catalog section (TV only - registers first item for side menu navigation) */
  isFirstSection?: boolean;
  /** Whether this is the last catalog section (TV only - constrains down navigation) */
  isLastSection?: boolean;
  /** Node handle of first item in PREVIOUS section (for explicit UP navigation - bypasses native search) */
  prevSectionFirstItemHandle?: number | null;
  /** Node handle of first item in NEXT section (for explicit DOWN navigation - bypasses native search) */
  nextSectionFirstItemHandle?: number | null;
  /** Callback to report this section's first item's node handle (TV only) */
  onFirstItemHandleReady?: (handle: number | null) => void;
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
  /** Node handle of previous item for left navigation constraint */
  prevItemNodeHandle?: number | null;
  /** Override poster width (TV only - used for fixed grid layout) */
  tvPosterWidth?: number;
  /** Explicit UP navigation handle (bypasses native focus search) */
  nextFocusUpId?: number | null;
  /** Explicit DOWN navigation handle (bypasses native focus search) */
  nextFocusDownId?: number | null;
}

const ViewAllCard = memo<ViewAllCardProps>(({
  onPress,
  onItemFocus,
  isLastInRow,
  isLastRow,
  focusRef,
  isTVDevice,
  colors,
  prevItemNodeHandle,
  tvPosterWidth,
  nextFocusUpId,
  nextFocusDownId,
}) => {
  // Calculate poster dimensions - use tvPosterWidth if provided, otherwise calculate
  const posterWidth = (isTVDevice && tvPosterWidth) ? tvPosterWidth : calculateContentItemPosterWidth(width, isTVDevice);
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
        size={isTVDevice ? 28 : isLargeTablet ? 36 : isTablet ? 32 : 28}
        color={colors.textMuted || '#888'}
      />
      <Text style={[
        styles.viewAllCardText,
        {
          color: colors.text || '#fff',
          fontSize: isTVDevice ? 12 : isLargeTablet ? 15 : isTablet ? 14 : 13,
          marginTop: 6,
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
          nextFocusLeftId={prevItemNodeHandle}
          nextFocusUpId={nextFocusUpId}
          nextFocusDownId={nextFocusDownId}
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

// Calculate TV grid layout - how many items fit per row
const calculateTVGridLayout = (screenWidth: number) => {
  const sidebarWidth = 80; // Account for the sidebar menu on the left
  const horizontalPadding = 24 * 2; // Left and right padding
  const itemSpacing = 8; // Space between items (reduced)
  const rowSpacing = 10; // Vertical space between rows

  // Use smaller poster width for TV grid to fit more items
  // This is smaller than the default ContentItem calculation
  const tvPosterWidth = 95; // Fixed smaller width to ensure all items fit

  // Calculate available width accounting for sidebar
  const availableWidth = screenWidth - sidebarWidth - horizontalPadding;
  const itemTotalWidth = tvPosterWidth + itemSpacing;
  const itemsPerRow = Math.floor((availableWidth + itemSpacing) / itemTotalWidth);

  return {
    itemsPerRow: Math.max(itemsPerRow, 6), // Minimum 6 items per row for TV
    rowCount: 2, // Display 2 rows per catalog
    posterWidth: tvPosterWidth,
    itemSpacing,
    rowSpacing,
    horizontalPadding: 24,
  };
};

const CatalogSection = ({ catalog, onSectionFocus, isFirstSection, isLastSection, prevSectionFirstItemHandle, nextSectionFirstItemHandle, onFirstItemHandleReady }: CatalogSectionProps) => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { currentTheme } = useTheme();
  const isTVDevice = useIsTV();
  const { setLastFocusedRowView, getMenuFirstItemNodeHandle } = useTVFocus();

  // Use isTVDevice for TV-specific styling (more reliable than screen width detection)
  const isTVLayout = isTVDevice || isTV;

  // TV grid layout calculations
  const tvGridLayout = useMemo(() => calculateTVGridLayout(width), []);

  // Only create refs for first and last items (for navigation constraints)
  const firstItemRef = useRef<View>(null);
  const lastItemRef = useRef<View>(null);

  // Track this section's first item node handle for vertical navigation
  const firstItemNodeHandleRef = useRef<number | null>(null);

  // Track node handles for all items to constrain left navigation within the row
  // Key: flat item index, Value: node handle
  // Also used for within-section vertical navigation via flat index calculation
  const itemNodeHandles = useRef<Map<number, number>>(new Map());

  // Force re-render when all items have registered their handles (TV only)
  // This ensures row 0 items can see row 1 handles for downward navigation
  const [handlesReady, setHandlesReady] = useState(false);
  const expectedItemCount = useRef(0);

  // Reset node handles when catalog items change
  useEffect(() => {
    itemNodeHandles.current.clear();
    firstItemNodeHandleRef.current = null;
    setHandlesReady(false);
  }, [catalog.items.length]);

  // Report first item handle when it's registered
  // Always call the callback even if handle hasn't changed - HomeScreen handles deduplication
  // This ensures handles are propagated even after FlashList recycling or re-renders
  const reportFirstItemHandle = useCallback((handle: number | null) => {
    if (handle) {
      firstItemNodeHandleRef.current = handle;
      onFirstItemHandleReady?.(handle);
    }
  }, [onFirstItemHandleReady]);

  // Callback to register item's node handle when it mounts
  const registerItemNodeHandle = useCallback((index: number, view: View | null) => {
    if (view) {
      const handle = findNodeHandle(view);
      if (handle) {
        itemNodeHandles.current.set(index, handle);

        // Report first item handle for vertical navigation
        if (index === 0) {
          reportFirstItemHandle(handle);
        }

        // When all items have registered, trigger re-render so row 0 items
        // can get row 1 handles for downward navigation (TV only)
        if (isTVDevice && !handlesReady && itemNodeHandles.current.size >= expectedItemCount.current) {
          setHandlesReady(true);
        }
      }
    }
  }, [reportFirstItemHandle, isTVDevice, handlesReady]);

  // When any item in this section gets focus, update the last focused row
  // so pressing right from menu returns to this row's first item
  const handleSectionItemFocus = useCallback(() => {
    navLog.focus(`CatalogSection[${catalog.name}]`, { handlesReady, itemCount: catalog.items.length });

    if (isTVDevice && firstItemRef.current) {
      setLastFocusedRowView(firstItemRef.current);
    }

    onSectionFocus?.();
  }, [isTVDevice, setLastFocusedRowView, onSectionFocus, catalog.name, handlesReady, catalog.items.length]);

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
  // For TV: limit items to fit in two rows (last slot of row 2 is View All)
  const dataWithViewAll = useMemo(() => {
    const viewAllItem: StreamingContent = {
      id: VIEW_ALL_ITEM_ID,
      type: catalog.type,
      name: 'View All',
      poster: '', // Empty string for type safety, not used since we render a custom card
    };

    if (isTVDevice) {
      // TV: Show items for 2 rows (leaving last slot for View All)
      const totalSlots = tvGridLayout.itemsPerRow * tvGridLayout.rowCount;
      const maxItems = totalSlots - 1; // Reserve last slot for View All
      const limitedItems = catalog.items.slice(0, maxItems);
      const result = [...limitedItems, viewAllItem];
      // Set expected item count for handle registration (excludes ViewAll card)
      expectedItemCount.current = limitedItems.length;
      return result;
    }

    return [...catalog.items, viewAllItem];
  }, [catalog.items, catalog.type, isTVDevice, tvGridLayout.itemsPerRow, tvGridLayout.rowCount]);

  // For TV: organize items into rows for the grid layout
  const tvGridRows = useMemo(() => {
    if (!isTVDevice) return [];

    const rows: StreamingContent[][] = [];
    const itemsPerRow = tvGridLayout.itemsPerRow;

    for (let i = 0; i < dataWithViewAll.length; i += itemsPerRow) {
      rows.push(dataWithViewAll.slice(i, i + itemsPerRow));
    }

    return rows;
  }, [isTVDevice, dataWithViewAll, tvGridLayout.itemsPerRow]);

  // Render a single item for the TV grid with proper row/column awareness
  const renderTVGridItem = useCallback((item: StreamingContent, flatIndex: number, rowIndex: number, colIndex: number) => {
    const isViewAllItem = item.id === VIEW_ALL_ITEM_ID;
    const itemsPerRow = tvGridLayout.itemsPerRow;
    const totalRows = tvGridRows.length;

    // Navigation constraints
    const isFirstInRow = colIndex === 0;
    const isLastInRow = colIndex === itemsPerRow - 1 || flatIndex === dataWithViewAll.length - 1;
    const isFirstRow = rowIndex === 0;
    const isLastRowInCatalog = rowIndex === totalRows - 1;

    // Get previous item's node handle for left navigation (within same row)
    // First item in row: goes to menu; others: go to previous item in same row
    let prevItemHandle: number | null | undefined;
    if (isFirstInRow) {
      prevItemHandle = getMenuFirstItemNodeHandle();
    } else {
      prevItemHandle = itemNodeHandles.current.get(flatIndex - 1);
    }

    // Explicit vertical navigation handles (bypass native focus search)
    // For within-section navigation:
    //   - Row 0 DOWN → Row 1 (same column)
    //   - Row 1 UP → Row 0 (same column)
    // For between-section navigation:
    //   - Row 0 UP → Previous section's first item
    //   - Last row DOWN → Next section's first item
    //
    // Note: We use flat index calculation for within-section navigation:
    //   - Item at (row, col) has flatIndex = row * itemsPerRow + col
    //   - Item below at (row+1, col) has flatIndex = (row+1) * itemsPerRow + col
    let upHandle: number | null | undefined;
    let downHandle: number | null | undefined;

    if (isFirstRow) {
      // First row: UP goes to previous section - let native focus engine find nearest item
      // by not setting explicit handle (undefined lets native handle it)
      upHandle = undefined;
      // First row: DOWN goes to same column in row 1 (within section)
      // Calculate target flat index: next row, same column
      const targetFlatIndex = (rowIndex + 1) * itemsPerRow + colIndex;
      if (targetFlatIndex < dataWithViewAll.length) {
        downHandle = itemNodeHandles.current.get(targetFlatIndex) || undefined;
      }
    } else {
      // Row 1 (or later): UP goes to same column in previous row (within section)
      // Calculate target flat index: previous row, same column
      const targetFlatIndex = (rowIndex - 1) * itemsPerRow + colIndex;
      upHandle = itemNodeHandles.current.get(targetFlatIndex) || undefined;

      if (isLastRowInCatalog) {
        // Last row: DOWN goes to next section - let native focus engine find nearest item
        downHandle = undefined;
      } else {
        // Not last row: DOWN goes to same column in next row (within section)
        const targetFlatIndex = (rowIndex + 1) * itemsPerRow + colIndex;
        if (targetFlatIndex < dataWithViewAll.length) {
          downHandle = itemNodeHandles.current.get(targetFlatIndex) || undefined;
        }
      }
    }

    // Render "View All" card
    if (isViewAllItem) {
      return (
        <ViewAllCard
          onPress={handleViewAllPress}
          onItemFocus={handleSectionItemFocus}
          isLastInRow={true}
          isLastRow={isLastSection && isLastRowInCatalog}
          focusRef={lastItemRef}
          isTVDevice={true}
          colors={currentTheme.colors}
          prevItemNodeHandle={prevItemHandle}
          tvPosterWidth={tvGridLayout.posterWidth}
          nextFocusUpId={upHandle}
          nextFocusDownId={downHandle}
        />
      );
    }

    return (
      <ContentItem
        item={item}
        onPress={handleContentPress}
        onItemFocus={handleSectionItemFocus}
        isFirstInRow={isFirstInRow}
        isLastInRow={isLastInRow}
        isLastRow={isLastSection && isLastRowInCatalog}
        focusRef={flatIndex === 0 ? firstItemRef : undefined}
        nextFocusLeftId={prevItemHandle}
        nextFocusUpId={upHandle}
        nextFocusDownId={downHandle}
        onRegisterNodeHandle={(view) => registerItemNodeHandle(flatIndex, view)}
        tvPosterWidth={tvGridLayout.posterWidth}
      />
    );
  }, [tvGridLayout.itemsPerRow, tvGridLayout.posterWidth, tvGridRows.length, dataWithViewAll.length, getMenuFirstItemNodeHandle, handleViewAllPress, handleSectionItemFocus, isLastSection, currentTheme.colors, handleContentPress, registerItemNodeHandle, prevSectionFirstItemHandle, nextSectionFirstItemHandle, handlesReady]);

  // Mobile/tablet render function (unchanged behavior)
  const renderContentItem = useCallback(({ item, index }: { item: StreamingContent, index: number }) => {
    const isFirst = index === 0;
    const isLast = index === dataWithViewAll.length - 1;
    const isViewAllItem = item.id === VIEW_ALL_ITEM_ID;

    // Get previous item's node handle for left navigation constraint
    // First item goes to menu, others go to previous item in row
    const prevItemHandle = isFirst
      ? getMenuFirstItemNodeHandle()
      : itemNodeHandles.current.get(index - 1);

    // Render "View All" card
    if (isViewAllItem) {
      return (
        <ViewAllCard
          onPress={handleViewAllPress}
          onItemFocus={handleSectionItemFocus}
          isLastInRow={true}
          isLastRow={isLastSection}
          focusRef={lastItemRef}
          isTVDevice={false}
          colors={currentTheme.colors}
          prevItemNodeHandle={prevItemHandle}
        />
      );
    }

    return (
      <ContentItem
        item={item}
        onPress={handleContentPress}
        onItemFocus={handleSectionItemFocus}
        isFirstInRow={isFirst}
        isLastInRow={false} // Never last since View All is after
        isLastRow={isLastSection}
        focusRef={isFirst ? firstItemRef : undefined}
        nextFocusLeftId={prevItemHandle}
        onRegisterNodeHandle={(view) => registerItemNodeHandle(index, view)}
      />
    );
  }, [handleContentPress, handleViewAllPress, handleSectionItemFocus, dataWithViewAll.length, isLastSection, currentTheme.colors, getMenuFirstItemNodeHandle, registerItemNodeHandle]);

  // Memoize the ItemSeparatorComponent to prevent re-creation (responsive spacing)
  const separatorWidth = isTVLayout ? 8 : isLargeTablet ? 10 : isTablet ? 8 : 8;
  const ItemSeparator = useCallback(() => <View style={{ width: separatorWidth }} />, [separatorWidth]);

  // Memoize the keyExtractor to prevent re-creation
  // Include catalog.id to ensure uniqueness across catalogs and prevent duplicate key warnings
  const keyExtractor = useCallback((item: StreamingContent, index: number) => {
    if (item.id === VIEW_ALL_ITEM_ID) return `view-all-${catalog.id}`;
    // Include index as fallback in case same item appears twice in same catalog (data issue)
    return `${catalog.id}-${item.id}-${item.type}-${index}`;
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

      {isTVDevice ? (
        // TV: Fixed 2-row grid layout - no scrolling, items have fixed positions
        <View
          style={[
            styles.tvGridContainer,
            {
              paddingHorizontal: tvGridLayout.horizontalPadding,
            }
          ]}
        >
          {tvGridRows.map((row, rowIndex) => (
            <View
              key={`row-${rowIndex}`}
              style={[
                styles.tvGridRow,
                {
                  marginBottom: rowIndex < tvGridRows.length - 1 ? tvGridLayout.rowSpacing : 0,
                }
              ]}
            >
              {row.map((item, colIndex) => {
                const flatIndex = rowIndex * tvGridLayout.itemsPerRow + colIndex;
                return (
                  <View
                    key={keyExtractor(item, flatIndex)}
                    style={{
                      marginRight: colIndex < row.length - 1 ? tvGridLayout.itemSpacing : 0,
                    }}
                  >
                    {renderTVGridItem(item, flatIndex, rowIndex, colIndex)}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      ) : (
        // Mobile/Tablet: Horizontal scrolling list
        <FlatList
          data={dataWithViewAll}
          renderItem={renderContentItem}
          keyExtractor={keyExtractor}
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          decelerationRate="fast"
          scrollEnabled={true}
          nestedScrollEnabled={true}
          contentContainerStyle={StyleSheet.flatten([
            styles.catalogList,
            {
              paddingHorizontal: isLargeTablet ? 28 : isTablet ? 24 : 16,
              paddingRight: (isLargeTablet ? 28 : isTablet ? 24 : 16) - posterLayout.partialPosterWidth,
            }
          ])}
          ItemSeparatorComponent={ItemSeparator}
          getItemLayout={getItemLayout}
          removeClippedSubviews={true}
          initialNumToRender={isLargeTablet ? 5 : isTablet ? 4 : 3}
          maxToRenderPerBatch={isLargeTablet ? 4 : 3}
          windowSize={isLargeTablet ? 4 : 3}
          updateCellsBatchingPeriod={50}
        />
      )}
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
  tvGridContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    overflow: 'visible', // Allow focused items to scale beyond container
    paddingVertical: 4,
  },
  tvGridRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'flex-start',
    overflow: 'visible',
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
    // Vertical navigation handles - must re-render when these change
    prevProps.prevSectionFirstItemHandle === nextProps.prevSectionFirstItemHandle &&
    prevProps.nextSectionFirstItemHandle === nextProps.nextSectionFirstItemHandle &&
    // Deep compare the first few items to detect changes
    prevProps.catalog.items.slice(0, 3).every((item, index) =>
      nextProps.catalog.items[index] &&
      item.id === nextProps.catalog.items[index].id &&
      item.poster === nextProps.catalog.items[index].poster
    )
  );
});