import React, { useCallback, useMemo, useRef, memo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import FastImage from '@d11/react-native-fast-image';
import { MaterialIcons } from '@expo/vector-icons';
import { Focusable } from './Focusable';
import { useTheme } from '../../contexts/ThemeContext';
import { Meta } from '../../services/stremioService';
import { getTVDeviceCapabilities, getListRenderingConfig } from '../../utils/tvDeviceCapabilities';

// Cache device capabilities
const deviceCapabilities = getTVDeviceCapabilities();
const listConfig = getListRenderingConfig();

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// TV Layout Constants
const SIDEBAR_WIDTH = 260;
const CONTENT_PADDING = 48;
const ROW_HEIGHT = 240; // Height of each content row
const POSTER_WIDTH = 120;
const POSTER_HEIGHT = 180; // 2:3 aspect ratio
const POSTER_SPACING = 12;
const ROW_TITLE_HEIGHT = 40;
const ROW_MARGIN_BOTTOM = 24;

// Number of items per row (fills the screen width minus sidebar)
const ITEMS_PER_ROW = Math.floor((SCREEN_WIDTH - SIDEBAR_WIDTH - CONTENT_PADDING * 2 + POSTER_SPACING) / (POSTER_WIDTH + POSTER_SPACING));

// Generate year options (current year down to 1970)
const generateYearOptions = (): string[] => {
  const currentYear = new Date().getFullYear();
  const years: string[] = [];
  for (let year = currentYear; year >= 1970; year--) {
    years.push(year.toString());
  }
  return years;
};

const YEAR_OPTIONS = generateYearOptions();

interface TVCatalogViewProps {
  items: Meta[];
  title: string;
  genres: string[];
  selectedGenre: string | undefined;
  onGenreSelect: (genre: string | undefined) => void;
  selectedYear?: string | undefined;
  onYearSelect?: (year: string | undefined) => void;
  onItemPress: (item: Meta) => void;
  loading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

// Memoized poster item component
interface PosterItemProps {
  item: Meta;
  index: number;
  rowIndex: number;
  onPress: () => void;
  colors: any;
  isFirstInRow: boolean;
  isLastInRow: boolean;
}

const PosterItem = memo<PosterItemProps>(({
  item,
  index,
  rowIndex,
  onPress,
  colors,
  isFirstInRow,
  isLastInRow,
}) => {
  const optimizedPosterUrl = useMemo(() => {
    if (!item.poster || item.poster.includes('placeholder')) {
      return null;
    }
    if (item.poster.includes('image.tmdb.org')) {
      return item.poster.replace(/\/w\d+\//, '/w342/');
    }
    return item.poster;
  }, [item.poster]);

  return (
    <View style={styles.posterContainer}>
      {/* Focusable wraps only the poster image, not the title */}
      <Focusable
        onPress={onPress}
        style={styles.posterFocusable}
        focusScale={1.0}
        showFocusBorder={true}
        borderRadius={8}
        autoFocus={rowIndex === 0 && index === 0}
      >
        {optimizedPosterUrl ? (
          <FastImage
            source={{ uri: optimizedPosterUrl }}
            style={styles.poster}
            resizeMode={FastImage.resizeMode.cover}
          />
        ) : (
          <View style={[styles.poster, styles.posterPlaceholder, { backgroundColor: colors.elevation2 }]}>
            <MaterialIcons name="movie" size={40} color={colors.textMuted} />
          </View>
        )}
      </Focusable>
      {/* Title is outside the Focusable so border doesn't include it */}
      <View style={styles.posterTitleContainer}>
        <Text style={[styles.posterTitle, { color: colors.text }]} numberOfLines={2}>
          {item.name}
        </Text>
      </View>
    </View>
  );
}, (prev, next) => {
  return prev.item.id === next.item.id && prev.item.poster === next.item.poster;
});

// Row of items component
interface ContentRowProps {
  items: Meta[];
  rowIndex: number;
  onItemPress: (item: Meta) => void;
  colors: any;
}

const ContentRow = memo<ContentRowProps>(({ items, rowIndex, onItemPress, colors }) => {
  return (
    <View style={styles.rowContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false} // D-pad handles horizontal navigation
        contentContainerStyle={styles.rowContent}
      >
        {items.map((item, index) => (
          <View key={`${item.id}-${item.type}`} style={styles.posterItemWrapper}>
            <PosterItem
              item={item}
              index={index}
              rowIndex={rowIndex}
              onPress={() => onItemPress(item)}
              colors={colors}
              isFirstInRow={index === 0}
              isLastInRow={index === items.length - 1}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
});

// Dropdown option item component
interface DropdownOptionProps {
  label: string;
  isSelected: boolean;
  onPress: () => void;
  colors: any;
}

const DropdownOption = memo<DropdownOptionProps>(({ label, isSelected, onPress, colors }) => {
  return (
    <Focusable
      onPress={onPress}
      style={[
        styles.dropdownOption,
        isSelected && { backgroundColor: colors.primary + '30' }
      ]}
      focusScale={1.0}
      showFocusBorder={true}
      borderRadius={6}
    >
      <Text style={[
        styles.dropdownOptionText,
        { color: isSelected ? colors.primary : colors.text }
      ]}>
        {label}
      </Text>
      {isSelected && (
        <MaterialIcons name="check" size={18} color={colors.primary} />
      )}
    </Focusable>
  );
});

// Dropdown component for filters
interface FilterDropdownProps {
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  options: string[];
  selectedValue: string | undefined;
  onSelect: (value: string | undefined) => void;
  colors: any;
  defaultExpanded?: boolean;
}

const FilterDropdown = memo<FilterDropdownProps>(({
  label,
  icon,
  options,
  selectedValue,
  onSelect,
  colors,
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const scrollViewRef = useRef<ScrollView>(null);

  const displayValue = selectedValue || 'All';

  const handleToggle = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const handleSelect = useCallback((value: string | undefined) => {
    onSelect(value);
    setIsExpanded(false);
  }, [onSelect]);

  return (
    <View style={styles.dropdownContainer}>
      {/* Dropdown header */}
      <Focusable
        onPress={handleToggle}
        style={[styles.dropdownHeader, { backgroundColor: colors.elevation2 }]}
        focusScale={1.0}
        showFocusBorder={true}
        borderRadius={8}
      >
        <View style={styles.dropdownHeaderLeft}>
          <MaterialIcons name={icon} size={20} color={colors.textMuted} />
          <Text style={[styles.dropdownLabel, { color: colors.textMuted }]}>{label}</Text>
        </View>
        <View style={styles.dropdownHeaderRight}>
          <Text style={[styles.dropdownValue, { color: colors.text }]} numberOfLines={1}>
            {displayValue}
          </Text>
          <MaterialIcons
            name={isExpanded ? 'expand-less' : 'expand-more'}
            size={24}
            color={colors.textMuted}
          />
        </View>
      </Focusable>

      {/* Dropdown options */}
      {isExpanded && (
        <View style={[styles.dropdownOptions, { backgroundColor: colors.elevation2 }]}>
          <ScrollView
            ref={scrollViewRef}
            style={styles.dropdownScroll}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
          >
            {/* All option */}
            <DropdownOption
              label="All"
              isSelected={!selectedValue}
              onPress={() => handleSelect(undefined)}
              colors={colors}
            />

            {/* Options */}
            {options.map((option) => (
              <DropdownOption
                key={option}
                label={option}
                isSelected={selectedValue === option}
                onPress={() => handleSelect(option)}
                colors={colors}
              />
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
});

// Sidebar with dropdown filters
interface FilterSidebarProps {
  genres: string[];
  selectedGenre: string | undefined;
  onGenreSelect: (genre: string | undefined) => void;
  selectedYear: string | undefined;
  onYearSelect: (year: string | undefined) => void;
  colors: any;
  title: string;
}

const FilterSidebar = memo<FilterSidebarProps>(({
  genres,
  selectedGenre,
  onGenreSelect,
  selectedYear,
  onYearSelect,
  colors,
  title,
}) => {
  return (
    <View style={[styles.sidebar, { backgroundColor: colors.elevation1 }]}>
      <Text style={[styles.sidebarTitle, { color: colors.text }]}>{title}</Text>

      <View style={styles.filtersContainer}>
        {/* Year Dropdown */}
        <FilterDropdown
          label="Year"
          icon="calendar-today"
          options={YEAR_OPTIONS}
          selectedValue={selectedYear}
          onSelect={onYearSelect}
          colors={colors}
        />

        {/* Genre Dropdown */}
        {genres.length > 0 && (
          <FilterDropdown
            label="Genre"
            icon="category"
            options={genres}
            selectedValue={selectedGenre}
            onSelect={onGenreSelect}
            colors={colors}
          />
        )}
      </View>

      {/* Active filters summary */}
      {(selectedYear || selectedGenre) && (
        <View style={styles.activeFilters}>
          <Text style={[styles.activeFiltersLabel, { color: colors.textMuted }]}>
            Active Filters:
          </Text>
          {selectedYear && (
            <View style={[styles.filterTag, { backgroundColor: colors.primary + '20' }]}>
              <Text style={[styles.filterTagText, { color: colors.primary }]}>
                {selectedYear}
              </Text>
            </View>
          )}
          {selectedGenre && (
            <View style={[styles.filterTag, { backgroundColor: colors.primary + '20' }]}>
              <Text style={[styles.filterTagText, { color: colors.primary }]}>
                {selectedGenre}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
});

export const TVCatalogView: React.FC<TVCatalogViewProps> = ({
  items,
  title,
  genres,
  selectedGenre,
  onGenreSelect,
  selectedYear,
  onYearSelect,
  onItemPress,
  loading,
  onLoadMore,
  hasMore,
}) => {
  const { currentTheme } = useTheme();
  const colors = currentTheme.colors;
  const listRef = useRef<any>(null); // FlashList ref type is complex, use any

  // Internal year state if not provided externally
  const [internalYear, setInternalYear] = useState<string | undefined>(undefined);
  const effectiveYear = selectedYear !== undefined ? selectedYear : internalYear;
  const handleYearSelect = onYearSelect || setInternalYear;

  // Filter items by year if year is selected
  const filteredItems = useMemo(() => {
    if (!effectiveYear) return items;
    return items.filter(item => {
      // Check releaseInfo or year property
      const itemYear = item.year?.toString() || item.releaseInfo?.substring(0, 4);
      return itemYear === effectiveYear;
    });
  }, [items, effectiveYear]);

  // Group items into rows
  const rows = useMemo(() => {
    const result: Meta[][] = [];
    for (let i = 0; i < filteredItems.length; i += ITEMS_PER_ROW) {
      result.push(filteredItems.slice(i, i + ITEMS_PER_ROW));
    }
    return result;
  }, [filteredItems]);

  // Render a single row
  const renderRow = useCallback(({ item: rowItems, index }: { item: Meta[]; index: number }) => {
    return (
      <ContentRow
        items={rowItems}
        rowIndex={index}
        onItemPress={onItemPress}
        colors={colors}
      />
    );
  }, [onItemPress, colors]);

  const keyExtractor = useCallback((item: Meta[], index: number) => `row-${index}`, []);

  // Handle end reached for pagination
  const handleEndReached = useCallback(() => {
    if (hasMore && onLoadMore && !loading) {
      onLoadMore();
    }
  }, [hasMore, onLoadMore, loading]);

  const showSidebar = genres.length > 0 || true; // Always show sidebar for year filter

  return (
    <View style={[styles.container, { backgroundColor: colors.darkBackground }]}>
      {/* Left sidebar with filters */}
      {showSidebar && (
        <FilterSidebar
          genres={genres}
          selectedGenre={selectedGenre}
          onGenreSelect={onGenreSelect}
          selectedYear={effectiveYear}
          onYearSelect={handleYearSelect}
          colors={colors}
          title={title}
        />
      )}

      {/* Main content area */}
      <View style={[styles.content, !showSidebar && styles.contentFull]}>
        {/* Title when no sidebar */}
        {!showSidebar && (
          <Text style={[styles.contentTitle, { color: colors.text }]}>{title}</Text>
        )}

        {filteredItems.length > 0 ? (
          <FlashList
            ref={listRef}
            data={rows}
            renderItem={renderRow}
            keyExtractor={keyExtractor}
            estimatedItemSize={ROW_HEIGHT + ROW_MARGIN_BOTTOM}
            showsVerticalScrollIndicator={false}
            scrollEnabled={false} // D-pad handles vertical navigation
            drawDistance={listConfig.drawDistance * 2}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.5}
            contentContainerStyle={styles.listContent}
          />
        ) : loading ? (
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading...</Text>
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="search-off" size={64} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              {effectiveYear || selectedGenre ? 'No content matches your filters' : 'No content found'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: SIDEBAR_WIDTH,
    paddingTop: 40,
    paddingHorizontal: 16,
  },
  sidebarTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  filtersContainer: {
    gap: 16,
  },
  // Dropdown styles
  dropdownContainer: {
    marginBottom: 8,
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  dropdownHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dropdownHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    justifyContent: 'flex-end',
  },
  dropdownLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  dropdownValue: {
    fontSize: 14,
    fontWeight: '600',
    maxWidth: 80,
  },
  dropdownOptions: {
    marginTop: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  dropdownScroll: {
    maxHeight: 250,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  dropdownOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  // Active filters
  activeFilters: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  activeFiltersLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
  },
  filterTag: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 6,
    alignSelf: 'flex-start',
  },
  filterTagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Content area
  content: {
    flex: 1,
    paddingTop: 40,
    paddingLeft: CONTENT_PADDING,
    paddingRight: CONTENT_PADDING,
  },
  contentFull: {
    paddingLeft: CONTENT_PADDING + 40, // Extra padding when no sidebar
  },
  contentTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 24,
  },
  listContent: {
    paddingBottom: 40,
  },
  rowContainer: {
    marginBottom: ROW_MARGIN_BOTTOM,
  },
  rowContent: {
    flexDirection: 'row',
  },
  posterItemWrapper: {
    marginRight: POSTER_SPACING,
  },
  posterContainer: {
    width: POSTER_WIDTH,
  },
  posterFocusable: {
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT,
    borderRadius: 8,
  },
  poster: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  posterPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  posterTitleContainer: {
    marginTop: 6,
    height: 32,
  },
  posterTitle: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    marginTop: 16,
  },
});

export default TVCatalogView;
