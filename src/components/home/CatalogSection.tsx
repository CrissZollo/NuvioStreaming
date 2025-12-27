import React, { useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Dimensions, FlatList } from 'react-native';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CatalogContent, StreamingContent } from '../../services/catalogService';
import { useTheme } from '../../contexts/ThemeContext';
import ContentItem from './ContentItem';
import Animated, { FadeIn, Layout } from 'react-native-reanimated';
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

const CatalogSection = ({ catalog, onSectionFocus, isFirstSection }: CatalogSectionProps) => {
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

  const renderContentItem = useCallback(({ item, index }: { item: StreamingContent, index: number }) => {
    const isFirst = index === 0;
    const isLast = index === catalog.items.length - 1;

    return (
      <ContentItem
        item={item}
        onPress={handleContentPress}
        onItemFocus={handleSectionItemFocus}
        isFirstInRow={isTVDevice ? isFirst : undefined}
        isLastInRow={isTVDevice ? isLast : undefined}
        focusRef={isTVDevice ? (isFirst ? firstItemRef : isLast ? lastItemRef : undefined) : undefined}
      />
    );
  }, [handleContentPress, handleSectionItemFocus, isTVDevice, catalog.items.length]);

  // Memoize the ItemSeparatorComponent to prevent re-creation (responsive spacing)
  const separatorWidth = isTVLayout ? 8 : isLargeTablet ? 10 : isTablet ? 8 : 8;
  const ItemSeparator = useCallback(() => <View style={{ width: separatorWidth }} />, [separatorWidth]);

  // Memoize the keyExtractor to prevent re-creation
  const keyExtractor = useCallback((item: StreamingContent) => `${item.id}-${item.type}`, []);



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
        {isTVDevice ? (
          <Focusable
            onPress={() =>
              navigation.navigate('Catalog', {
                id: catalog.id,
                type: catalog.type,
                addonId: catalog.addon
              })
            }
            style={[
              styles.viewAllButton,
              {
                paddingVertical: 6,
                paddingHorizontal: 10,
              }
            ]}
            borderRadius={16}
            focusScale={1.05}
          >
            {(focused) => (
              <>
                <Text style={[
                  styles.viewAllText,
                  {
                    color: focused ? '#0A0A0A' : currentTheme.colors.textMuted,
                    fontSize: 13,
                    marginRight: 4,
                  }
                ]}>View All</Text>
                <MaterialIcons
                  name="chevron-right"
                  size={18}
                  color={focused ? '#0A0A0A' : currentTheme.colors.textMuted}
                />
              </>
            )}
          </Focusable>
        ) : (
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('Catalog', {
                id: catalog.id,
                type: catalog.type,
                addonId: catalog.addon
              })
            }
            style={[
              styles.viewAllButton,
              {
                paddingVertical: isLargeTablet ? 9 : isTablet ? 8 : 8,
                paddingHorizontal: isLargeTablet ? 11 : isTablet ? 10 : 10,
                borderRadius: isLargeTablet ? 20 : isTablet ? 20 : 20,
              }
            ]}
          >
            <Text style={[
              styles.viewAllText,
              {
                color: currentTheme.colors.textMuted,
                fontSize: isLargeTablet ? 15 : isTablet ? 14 : 14,
                marginRight: isLargeTablet ? 5 : 4,
              }
            ]}>View All</Text>
            <MaterialIcons
              name="chevron-right"
              size={isLargeTablet ? 22 : isTablet ? 20 : 20}
              color={currentTheme.colors.textMuted}
            />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={catalog.items}
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
          isTVLayout && styles.catalogListTV,
          {
            paddingHorizontal: isTVLayout ? 24 : isLargeTablet ? 28 : isTablet ? 24 : 16,
            paddingRight: (isTVLayout ? 24 : isLargeTablet ? 28 : isTablet ? 24 : 16) - posterLayout.partialPosterWidth,
          }
        ])}
        style={isTVDevice ? { overflow: 'visible' } : undefined}
        ItemSeparatorComponent={ItemSeparator}
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
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8, // overridden responsively
    paddingHorizontal: 10, // overridden responsively
    borderRadius: 20, // overridden responsively
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  viewAllText: {
    fontSize: 14, // overridden responsively
    fontWeight: '600',
    marginRight: 4, // overridden responsively
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
  // Only re-render if the catalog data actually changes
  return (
    prevProps.catalog.addon === nextProps.catalog.addon &&
    prevProps.catalog.id === nextProps.catalog.id &&
    prevProps.catalog.name === nextProps.catalog.name &&
    prevProps.catalog.items.length === nextProps.catalog.items.length &&
    // Deep compare the first few items to detect changes
    prevProps.catalog.items.slice(0, 3).every((item, index) =>
      nextProps.catalog.items[index] &&
      item.id === nextProps.catalog.items[index].id &&
      item.poster === nextProps.catalog.items[index].poster
    )
  );
});