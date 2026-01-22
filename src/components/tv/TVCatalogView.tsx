import React, { useCallback, useMemo, useRef, memo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import { MaterialIcons } from '@expo/vector-icons';
import { Focusable } from './Focusable';
import { useTheme } from '../../contexts/ThemeContext';
import { Meta } from '../../services/stremioService';

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

// Number of rows to display per page (to limit DOM elements for smooth navigation)
// Using 3 rows to ensure poster titles are visible above pagination controls
const ROWS_PER_PAGE = 3;
const ITEMS_PER_PAGE = ITEMS_PER_ROW * ROWS_PER_PAGE;

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
  onFocus?: () => void;
}

const PosterItem = memo<PosterItemProps>(({
  item,
  index,
  rowIndex,
  onPress,
  colors,
  isFirstInRow,
  isLastInRow,
  onFocus,
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
        onFocus={onFocus}
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
  onRowFocus?: () => void;
}

const ContentRow = memo<ContentRowProps>(({ items, rowIndex, onItemPress, colors, onRowFocus }) => {
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
              onFocus={onRowFocus}
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

    </View>
  );
});

// Pagination controls component
interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPrevious: () => void;
  onNext: () => void;
  onLoadMore?: () => void;
  hasMoreFromServer: boolean;
  loadingMore: boolean;
  colors: any;
}

const PaginationControls = memo<PaginationControlsProps>(({
  currentPage,
  totalPages,
  onPrevious,
  onNext,
  onLoadMore,
  hasMoreFromServer,
  loadingMore,
  colors,
}) => {
  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;
  const isOnLastPage = currentPage === totalPages;
  const showLoadMore = isOnLastPage && hasMoreFromServer && onLoadMore;

  return (
    <View style={styles.paginationContainer}>
      {/* Previous Page button */}
      <Focusable
        onPress={onPrevious}
        style={[
          styles.paginationButton,
          { backgroundColor: canGoPrevious ? colors.elevation2 : colors.elevation1 }
        ]}
        focusScale={1.0}
        showFocusBorder={true}
        borderRadius={6}
        disabled={!canGoPrevious}
      >
        <MaterialIcons
          name="keyboard-arrow-up"
          size={20}
          color={canGoPrevious ? colors.text : colors.textMuted}
        />
      </Focusable>

      {/* Page indicator */}
      <Text style={[styles.pageIndicatorText, { color: colors.textMuted }]}>
        {currentPage}/{totalPages}{hasMoreFromServer ? '+' : ''}
      </Text>

      {/* Next Page button or Load More */}
      {showLoadMore ? (
        <Focusable
          onPress={onLoadMore}
          style={[styles.paginationButton, styles.loadMoreButton, { backgroundColor: colors.primary }]}
          focusScale={1.0}
          showFocusBorder={true}
          borderRadius={6}
          disabled={loadingMore}
        >
          <Text style={styles.loadMoreText}>
            {loadingMore ? '...' : 'More'}
          </Text>
        </Focusable>
      ) : (
        <Focusable
          onPress={onNext}
          style={[
            styles.paginationButton,
            { backgroundColor: canGoNext ? colors.elevation2 : colors.elevation1 }
          ]}
          focusScale={1.0}
          showFocusBorder={true}
          borderRadius={6}
          disabled={!canGoNext}
        >
          <MaterialIcons
            name="keyboard-arrow-down"
            size={20}
            color={canGoNext ? colors.text : colors.textMuted}
          />
        </Focusable>
      )}
    </View>
  );
});

// Calculate content row height for scroll calculations
const CONTENT_ROW_HEIGHT = POSTER_HEIGHT + 32 + ROW_MARGIN_BOTTOM; // poster + title container + margin

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
  const scrollViewRef = useRef<ScrollView>(null);

  // Internal year state if not provided externally
  const [internalYear, setInternalYear] = useState<string | undefined>(undefined);
  const effectiveYear = selectedYear !== undefined ? selectedYear : internalYear;
  const handleYearSelect = onYearSelect || setInternalYear;

  // Client-side pagination state (for smooth navigation through loaded items)
  const [currentPage, setCurrentPage] = useState(1);

  // Reset to page 1 when filters change or items are refreshed
  const prevItemsLengthRef = useRef(items.length);
  useEffect(() => {
    // Reset page when items decrease (new filter/search) or when filters change
    if (items.length < prevItemsLengthRef.current) {
      setCurrentPage(1);
    }
    prevItemsLengthRef.current = items.length;
  }, [items.length, selectedGenre, effectiveYear]);

  // Filter items by year if year is selected
  const filteredItems = useMemo(() => {
    if (!effectiveYear) return items;
    return items.filter(item => {
      // Check releaseInfo or year property
      const itemYear = item.year?.toString() || item.releaseInfo?.substring(0, 4);
      return itemYear === effectiveYear;
    });
  }, [items, effectiveYear]);

  // Calculate total pages based on filtered items
  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
  }, [filteredItems.length]);

  // Ensure current page is valid
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Get items for current page only (limits rendered elements for smooth D-pad navigation)
  const pageItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredItems.slice(startIndex, endIndex);
  }, [filteredItems, currentPage]);

  // Group page items into rows
  const rows = useMemo(() => {
    const result: Meta[][] = [];
    for (let i = 0; i < pageItems.length; i += ITEMS_PER_ROW) {
      result.push(pageItems.slice(i, i + ITEMS_PER_ROW));
    }
    return result;
  }, [pageItems]);

  // Page navigation handlers
  const handlePreviousPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  }, [currentPage]);

  const handleNextPage = useCallback(() => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  }, [currentPage, totalPages]);

  // Handle load more from server
  const handleLoadMore = useCallback(() => {
    if (hasMore && onLoadMore && !loading) {
      onLoadMore();
    }
  }, [hasMore, onLoadMore, loading]);

  // Handle row focus to auto-scroll and ensure title is visible
  const handleRowFocus = useCallback((rowIndex: number) => {
    if (scrollViewRef.current) {
      // For the last row, scroll down extra to show the title below the poster
      const isLastRow = rowIndex === rows.length - 1;
      const scrollOffset = rowIndex * CONTENT_ROW_HEIGHT;
      // Add extra offset for last row to ensure title is visible above pagination
      const extraOffset = isLastRow ? 60 : 0;
      scrollViewRef.current.scrollTo({ y: scrollOffset + extraOffset, animated: true });
    }
  }, [rows.length]);

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
          <ScrollView
            ref={scrollViewRef}
            style={styles.catalogContent}
            contentContainerStyle={styles.catalogScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Content grid - render rows directly for better scroll control */}
            {rows.map((rowItems, index) => (
              <ContentRow
                key={`page-${currentPage}-row-${index}`}
                items={rowItems}
                rowIndex={index}
                onItemPress={onItemPress}
                colors={colors}
                onRowFocus={() => handleRowFocus(index)}
              />
            ))}

            {/* Pagination controls - only show if more than one page or can load more */}
            {(totalPages > 1 || hasMore) && (
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                onPrevious={handlePreviousPage}
                onNext={handleNextPage}
                onLoadMore={onLoadMore ? handleLoadMore : undefined}
                hasMoreFromServer={hasMore || false}
                loadingMore={loading || false}
                colors={colors}
              />
            )}
          </ScrollView>
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
  // Catalog content wrapper
  catalogContent: {
    flex: 1,
  },
  catalogScrollContent: {
    paddingBottom: 20,
  },
  // Compact pagination controls
  paginationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  paginationButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: 6,
  },
  loadMoreButton: {
    width: 'auto' as any,
    paddingHorizontal: 12,
  },
  loadMoreText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  pageIndicatorText: {
    fontSize: 13,
    fontWeight: '500',
  },
});

export default TVCatalogView;
