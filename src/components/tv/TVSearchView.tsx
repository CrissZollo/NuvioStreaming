import React, { useCallback, useMemo, useRef, memo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  TextInput,
  DeviceEventEmitter,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { Focusable } from './Focusable';
import { useTheme } from '../../contexts/ThemeContext';
import { StreamingContent, AddonSearchResults } from '../../services/catalogService';
import { catalogService } from '../../services/catalogService';
import { mmkvStorage } from '../../services/mmkvStorage';
import { getTVDeviceCapabilities, getListRenderingConfig } from '../../utils/tvDeviceCapabilities';
import { useTVFocus } from '../../contexts/TVFocusContext';

// Cache device capabilities
const deviceCapabilities = getTVDeviceCapabilities();
const listConfig = getListRenderingConfig();

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// TV Layout Constants - Compact design
const SEARCH_BAR_HEIGHT = 56;
const CONTENT_PADDING = 48;
const POSTER_WIDTH = 100;
const POSTER_HEIGHT = 150; // 2:3 aspect ratio
const POSTER_SPACING = 12;
const ROW_MARGIN_BOTTOM = 4;
const SECTION_MARGIN_BOTTOM = 8;

const PLACEHOLDER_POSTER = 'https://placehold.co/300x450/222222/CCCCCC?text=No+Poster';

interface TVSearchViewProps {
  query: string;
  onQueryChange: (query: string) => void;
  results: { byAddon: AddonSearchResults[]; allResults: StreamingContent[] };
  searching: boolean;
  searched: boolean;
  recentSearches: string[];
  onRecentSearchSelect: (search: string) => void;
  onItemPress: (item: StreamingContent) => void;
  onItemLongPress?: (item: StreamingContent) => void;
  onClearSearch: () => void;
}

// Memoized search result item component - compact for TV
interface SearchItemProps {
  item: StreamingContent;
  index: number;
  onPress: () => void;
  onLongPress?: () => void;
  colors: any;
  isFirst: boolean;
  isLast: boolean;
  onFocus?: () => void;
  menuNodeHandle?: number | null;
}

const SearchItem = memo<SearchItemProps>(({
  item,
  index,
  onPress,
  onLongPress,
  colors,
  isFirst,
  isLast,
  onFocus,
  menuNodeHandle,
}) => {
  const [inLibrary, setInLibrary] = useState(!!item.inLibrary);
  const [watched, setWatched] = useState(false);

  useEffect(() => {
    const updateWatched = () => {
      mmkvStorage.getItem(`watched:${item.type}:${item.id}`).then(val => setWatched(val === 'true'));
    };
    updateWatched();
    const sub = DeviceEventEmitter.addListener('watchedStatusChanged', updateWatched);
    return () => sub.remove();
  }, [item.id, item.type]);

  useEffect(() => {
    const unsubscribe = catalogService.subscribeToLibraryUpdates((items) => {
      const found = items.find((libItem) => libItem.id === item.id && libItem.type === item.type);
      setInLibrary(!!found);
    });
    return () => unsubscribe();
  }, [item.id, item.type]);

  const optimizedPosterUrl = useMemo(() => {
    if (!item.poster || item.poster.includes('placeholder')) {
      return PLACEHOLDER_POSTER;
    }
    if (item.poster.includes('image.tmdb.org')) {
      return item.poster.replace(/\/w\d+\//, '/w185/');
    }
    return item.poster;
  }, [item.poster]);

  return (
    <View style={styles.itemContainer}>
      <Focusable
        onPress={onPress}
        onLongPress={onLongPress}
        onFocus={onFocus}
        style={styles.itemFocusable}
        focusScale={1.0}
        showFocusBorder={true}
        borderRadius={8}
        nextFocusLeftId={isFirst && menuNodeHandle ? menuNodeHandle : undefined}
      >
        <FastImage
          source={{ uri: optimizedPosterUrl }}
          style={styles.itemPoster}
          resizeMode={FastImage.resizeMode.cover}
        />
        {/* Badges */}
        {inLibrary && (
          <View style={styles.libraryBadge}>
            <Feather name="bookmark" size={12} color="#fff" />
          </View>
        )}
        {watched && (
          <View style={styles.watchedBadge}>
            <MaterialIcons name="check-circle" size={14} color="#4CAF50" />
          </View>
        )}
        {item.imdbRating && (
          <View style={styles.ratingBadge}>
            <MaterialIcons name="star" size={10} color="#FFC107" />
            <Text style={styles.ratingText}>{item.imdbRating}</Text>
          </View>
        )}
      </Focusable>
      <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={2}>
        {item.name}
      </Text>
      {item.year && (
        <Text style={[styles.itemYear, { color: colors.textMuted }]}>
          {item.year}
        </Text>
      )}
    </View>
  );
}, (prev, next) => {
  return prev.item.id === next.item.id && prev.onFocus === next.onFocus && prev.isFirst === next.isFirst && prev.menuNodeHandle === next.menuNodeHandle;
});

// Content row for a type (Movies/TV Shows)
interface ContentTypeRowProps {
  title: string;
  items: StreamingContent[];
  onItemPress: (item: StreamingContent) => void;
  onItemLongPress?: (item: StreamingContent) => void;
  colors: any;
  onItemFocus?: () => void;
  menuNodeHandle?: number | null;
}

const ContentTypeRow = memo<ContentTypeRowProps>(({
  title,
  items,
  onItemPress,
  onItemLongPress,
  colors,
  onItemFocus,
  menuNodeHandle,
}) => {
  if (items.length === 0) return null;

  return (
    <View style={styles.typeRowContainer}>
      <Text style={[styles.typeTitle, { color: colors.textMuted }]}>
        {title} ({items.length})
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        contentContainerStyle={styles.typeRowContent}
      >
        {items.map((item, index) => (
          <SearchItem
            key={`${item.id}-${item.type}`}
            item={item}
            index={index}
            onPress={() => onItemPress(item)}
            onLongPress={onItemLongPress ? () => onItemLongPress(item) : undefined}
            colors={colors}
            isFirst={index === 0}
            isLast={index === items.length - 1}
            onFocus={onItemFocus}
            menuNodeHandle={menuNodeHandle}
          />
        ))}
      </ScrollView>
    </View>
  );
});

// Addon filter tab component
interface AddonTabProps {
  addon: AddonSearchResults;
  isSelected: boolean;
  onPress: () => void;
  colors: any;
  autoFocus?: boolean;
  isFirst?: boolean;
  menuNodeHandle?: number | null;
}

const AddonTab = memo<AddonTabProps>(({
  addon,
  isSelected,
  onPress,
  colors,
  autoFocus,
  isFirst,
  menuNodeHandle,
}) => {
  return (
    <Focusable
      onPress={onPress}
      style={[
        styles.addonTab,
        isSelected && { backgroundColor: colors.primary + '30', borderColor: colors.primary }
      ]}
      focusScale={1.0}
      showFocusBorder={true}
      borderRadius={8}
      autoFocus={autoFocus}
      nextFocusLeftId={menuNodeHandle ?? undefined}
    >
      <Text style={[
        styles.addonTabName,
        { color: isSelected ? colors.primary : colors.text }
      ]} numberOfLines={1}>
        {addon.addonName}
      </Text>
      <View style={[
        styles.addonTabBadge,
        { backgroundColor: isSelected ? colors.primary : colors.elevation2 }
      ]}>
        <Text style={[
          styles.addonTabBadgeText,
          { color: isSelected ? '#fff' : colors.textMuted }
        ]}>
          {addon.results.length}
        </Text>
      </View>
    </Focusable>
  );
});

// Results section for selected addon
interface AddonResultsProps {
  addonGroup: AddonSearchResults;
  onItemPress: (item: StreamingContent) => void;
  onItemLongPress?: (item: StreamingContent) => void;
  colors: any;
  onRowFocus?: (rowIndex: number) => void;
  menuNodeHandle?: number | null;
}

const AddonResults = memo<AddonResultsProps>(({
  addonGroup,
  onItemPress,
  onItemLongPress,
  colors,
  onRowFocus,
  menuNodeHandle,
}) => {
  const movieResults = useMemo(() =>
    addonGroup.results.filter(item => item.type === 'movie'),
    [addonGroup.results]
  );
  const seriesResults = useMemo(() =>
    addonGroup.results.filter(item => item.type === 'series'),
    [addonGroup.results]
  );
  const otherResults = useMemo(() =>
    addonGroup.results.filter(item => item.type !== 'movie' && item.type !== 'series'),
    [addonGroup.results]
  );

  const getOtherTypeLabel = () => {
    if (otherResults.length === 0) return '';
    const firstType = otherResults[0].type;
    return firstType.charAt(0).toUpperCase() + firstType.slice(1);
  };

  // Calculate row indices dynamically based on which sections are visible
  let currentRowIndex = 0;
  const movieRowIndex = movieResults.length > 0 ? currentRowIndex++ : -1;
  const seriesRowIndex = seriesResults.length > 0 ? currentRowIndex++ : -1;
  const otherRowIndex = otherResults.length > 0 ? currentRowIndex++ : -1;

  return (
    <View style={styles.addonResults}>
      <ContentTypeRow
        title="Movies"
        items={movieResults}
        onItemPress={onItemPress}
        onItemLongPress={onItemLongPress}
        colors={colors}
        onItemFocus={movieRowIndex >= 0 ? () => onRowFocus?.(movieRowIndex) : undefined}
        menuNodeHandle={menuNodeHandle}
      />

      <ContentTypeRow
        title="TV Shows"
        items={seriesResults}
        onItemPress={onItemPress}
        onItemLongPress={onItemLongPress}
        colors={colors}
        onItemFocus={seriesRowIndex >= 0 ? () => onRowFocus?.(seriesRowIndex) : undefined}
        menuNodeHandle={menuNodeHandle}
      />

      <ContentTypeRow
        title={getOtherTypeLabel()}
        items={otherResults}
        onItemPress={onItemPress}
        onItemLongPress={onItemLongPress}
        colors={colors}
        onItemFocus={otherRowIndex >= 0 ? () => onRowFocus?.(otherRowIndex) : undefined}
        menuNodeHandle={menuNodeHandle}
      />
    </View>
  );
});

// Recent search item
interface RecentSearchItemProps {
  search: string;
  onPress: () => void;
  colors: any;
  isFirst: boolean;
  autoFocus?: boolean;
}

const RecentSearchItem = memo<RecentSearchItemProps>(({
  search,
  onPress,
  colors,
  isFirst,
  autoFocus,
}) => {
  return (
    <Focusable
      onPress={onPress}
      style={styles.recentItem}
      focusScale={1.0}
      showFocusBorder={true}
      borderRadius={8}
      autoFocus={autoFocus}
    >
      <MaterialIcons name="history" size={18} color={colors.textMuted} />
      <Text style={[styles.recentText, { color: colors.text }]}>{search}</Text>
    </Focusable>
  );
});

// Height of each content row (title + poster + item text)
const ITEM_TITLE_HEIGHT = 14 + 6 + 10 + 2; // lineHeight + marginTop + year fontSize + marginTop
const ROW_HEIGHT = POSTER_HEIGHT + ITEM_TITLE_HEIGHT + 8; // poster + text + title marginBottom

export const TVSearchView: React.FC<TVSearchViewProps> = ({
  query,
  onQueryChange,
  results,
  searching,
  searched,
  recentSearches,
  onRecentSearchSelect,
  onItemPress,
  onItemLongPress,
  onClearSearch,
}) => {
  const { currentTheme } = useTheme();
  const colors = currentTheme.colors;
  const inputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const { getMenuFirstItemNodeHandle } = useTVFocus();

  // Selected addon filter - null means show all, or the addon ID
  const [selectedAddonId, setSelectedAddonId] = useState<string | null>(null);

  // Handle row focus to auto-scroll
  const handleRowFocus = useCallback((rowIndex: number) => {
    // Calculate offset: each row needs enough space to show poster + title below
    // Row 0 (Movies): no scroll needed, it's at top
    // Row 1 (TV Shows): scroll so TV Shows row is visible with title below
    // Row 2 (Other): scroll so Other row is visible with title below
    if (rowIndex > 0 && scrollViewRef.current) {
      // Each row takes ROW_HEIGHT, scroll to show the focused row properly
      const scrollOffset = rowIndex * (ROW_HEIGHT + SECTION_MARGIN_BOTTOM);
      scrollViewRef.current.scrollTo({ y: scrollOffset, animated: true });
    } else if (rowIndex === 0 && scrollViewRef.current) {
      // Scroll back to top for first row
      scrollViewRef.current.scrollTo({ y: 0, animated: true });
    }
  }, []);

  // Reset selection when results change
  useEffect(() => {
    if (results.byAddon.length > 0) {
      // Auto-select first addon when results come in
      setSelectedAddonId(results.byAddon[0].addonId);
    } else {
      setSelectedAddonId(null);
    }
  }, [results.byAddon.length > 0 ? results.byAddon.map(a => a.addonId).join(',') : '']);

  const hasResults = results.byAddon.length > 0;
  const showRecentSearches = !query.trim() && recentSearches.length > 0;

  // Get the selected addon's results
  const selectedAddon = useMemo(() => {
    if (!selectedAddonId) return null;
    return results.byAddon.find(a => a.addonId === selectedAddonId) || null;
  }, [selectedAddonId, results.byAddon]);

  return (
    <View style={[styles.container, { backgroundColor: colors.darkBackground }]}>
      {/* Search bar */}
      <View style={styles.searchBarContainer}>
        <View style={[styles.searchBar, { backgroundColor: colors.elevation2 }]}>
          <Focusable
            onPress={() => inputRef.current?.focus()}
            style={styles.searchIconButton}
            focusScale={1.0}
            showFocusBorder={true}
            borderRadius={8}
            nextFocusLeftId={getMenuFirstItemNodeHandle() ?? undefined}
          >
            <MaterialIcons name="search" size={24} color={colors.textMuted} />
          </Focusable>
          <TextInput
            ref={inputRef}
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search movies and TV shows..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={onQueryChange}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Focusable
              onPress={onClearSearch}
              style={styles.clearButton}
              focusScale={1.0}
              showFocusBorder={true}
              borderRadius={16}
            >
              <MaterialIcons name="close" size={20} color={colors.textMuted} />
            </Focusable>
          )}
        </View>
      </View>

      {/* Addon tabs - show when there are results from multiple addons */}
      {hasResults && results.byAddon.length > 0 && (
        <View style={styles.addonTabsContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.addonTabsContent}
          >
            {results.byAddon.map((addon, index) => (
              <AddonTab
                key={addon.addonId}
                addon={addon}
                isSelected={selectedAddonId === addon.addonId}
                onPress={() => setSelectedAddonId(addon.addonId)}
                colors={colors}
                autoFocus={index === 0}
                isFirst={index === 0}
                menuNodeHandle={getMenuFirstItemNodeHandle()}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Content */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Loading state */}
        {searching && (
          <View style={styles.statusContainer}>
            <MaterialIcons name="search" size={48} color={colors.textMuted} />
            <Text style={[styles.statusText, { color: colors.text }]}>Searching...</Text>
          </View>
        )}

        {/* Minimum characters message */}
        {!searching && query.trim().length === 1 && (
          <View style={styles.statusContainer}>
            <MaterialIcons name="keyboard" size={48} color={colors.textMuted} />
            <Text style={[styles.statusText, { color: colors.text }]}>Keep typing...</Text>
            <Text style={[styles.statusSubtext, { color: colors.textMuted }]}>
              Type at least 2 characters to search
            </Text>
          </View>
        )}

        {/* No results */}
        {!searching && searched && !hasResults && query.trim().length >= 2 && (
          <View style={styles.statusContainer}>
            <MaterialIcons name="search-off" size={48} color={colors.textMuted} />
            <Text style={[styles.statusText, { color: colors.text }]}>No results found</Text>
            <Text style={[styles.statusSubtext, { color: colors.textMuted }]}>
              Try different keywords
            </Text>
          </View>
        )}

        {/* Recent searches */}
        {showRecentSearches && (
          <View style={styles.recentSection}>
            <Text style={[styles.recentTitle, { color: colors.text }]}>Recent Searches</Text>
            <View style={styles.recentList}>
              {recentSearches.map((search, index) => (
                <RecentSearchItem
                  key={`recent-${index}`}
                  search={search}
                  onPress={() => onRecentSearchSelect(search)}
                  colors={colors}
                  isFirst={index === 0}
                  autoFocus={index === 0}
                />
              ))}
            </View>
          </View>
        )}

        {/* Search results for selected addon */}
        {!searching && selectedAddon && (
          <AddonResults
            addonGroup={selectedAddon}
            onItemPress={onItemPress}
            onItemLongPress={onItemLongPress}
            colors={colors}
            onRowFocus={handleRowFocus}
            menuNodeHandle={getMenuFirstItemNodeHandle()}
          />
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Search bar
  searchBarContainer: {
    paddingHorizontal: CONTENT_PADDING,
    paddingTop: 24,
    paddingBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: SEARCH_BAR_HEIGHT,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchIconButton: {
    padding: 8,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 18,
    height: '100%',
  },
  clearButton: {
    padding: 8,
  },
  // Addon tabs
  addonTabsContainer: {
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  addonTabsContent: {
    paddingHorizontal: CONTENT_PADDING,
    gap: 10,
  },
  addonTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    gap: 8,
  },
  addonTabName: {
    fontSize: 14,
    fontWeight: '600',
    maxWidth: 120,
  },
  addonTabBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
  },
  addonTabBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  // Content
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: CONTENT_PADDING,
    paddingTop: 20,
    paddingBottom: 40,
  },
  // Status messages
  statusContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  statusSubtext: {
    fontSize: 14,
    marginTop: 8,
  },
  // Recent searches
  recentSection: {
    marginBottom: 24,
  },
  recentTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  recentList: {
    gap: 4,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 12,
  },
  recentText: {
    fontSize: 15,
  },
  // Addon results
  addonResults: {
    gap: SECTION_MARGIN_BOTTOM,
  },
  // Type row
  typeRowContainer: {
    marginBottom: ROW_MARGIN_BOTTOM,
  },
  typeTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  typeRowContent: {
    flexDirection: 'row',
    gap: POSTER_SPACING,
  },
  // Search item
  itemContainer: {
    width: POSTER_WIDTH,
  },
  itemFocusable: {
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT,
    borderRadius: 8,
    overflow: 'hidden',
  },
  itemPoster: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  itemTitle: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 6,
    lineHeight: 14,
  },
  itemYear: {
    fontSize: 10,
    marginTop: 2,
  },
  // Badges
  libraryBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
  },
  watchedBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
  ratingBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.75)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 2,
  },
  ratingText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },
});

export default TVSearchView;
