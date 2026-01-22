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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// TV Layout Constants
const SIDEBAR_WIDTH = 260;
const CONTENT_PADDING = 48;
const POSTER_WIDTH = 120;
const POSTER_HEIGHT = 180; // 2:3 aspect ratio
const POSTER_SPACING = 12;
const ROW_MARGIN_BOTTOM = 24;

// Number of items per row (fills the screen width minus sidebar)
const ITEMS_PER_ROW = Math.floor((SCREEN_WIDTH - SIDEBAR_WIDTH - CONTENT_PADDING * 2 + POSTER_SPACING) / (POSTER_WIDTH + POSTER_SPACING));

// Number of rows to display per page
const ROWS_PER_PAGE = 3;
const ITEMS_PER_PAGE = ITEMS_PER_ROW * ROWS_PER_PAGE;

export interface FilmographyItem {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string;
  character?: string;
  job?: string;
  media_type: 'movie' | 'tv';
  popularity?: number;
  vote_average?: number;
  isUpcoming?: boolean;
}

interface TVFilmographyViewProps {
  items: FilmographyItem[];
  title: string;
  castMember: {
    name: string;
    profile_path?: string | null;
  };
  onItemPress: (item: FilmographyItem) => void;
  loading?: boolean;
}

// Filter option component
interface FilterOptionProps {
  label: string;
  count?: number;
  isSelected: boolean;
  onPress: () => void;
  colors: any;
  icon?: keyof typeof MaterialIcons.glyphMap;
}

const FilterOption = memo<FilterOptionProps>(({ label, count, isSelected, onPress, colors, icon }) => {
  return (
    <Focusable
      onPress={onPress}
      style={[
        styles.filterOption,
        isSelected && { backgroundColor: colors.primary + '30' }
      ]}
      focusScale={1.0}
      showFocusBorder={true}
      borderRadius={8}
    >
      <View style={styles.filterOptionContent}>
        {icon && (
          <MaterialIcons
            name={icon}
            size={18}
            color={isSelected ? colors.primary : colors.textMuted}
            style={styles.filterOptionIcon}
          />
        )}
        <Text style={[
          styles.filterOptionText,
          { color: isSelected ? colors.primary : colors.text }
        ]}>
          {label}
        </Text>
        {count !== undefined && (
          <Text style={[
            styles.filterOptionCount,
            { color: isSelected ? colors.primary : colors.textMuted }
          ]}>
            ({count})
          </Text>
        )}
      </View>
      {isSelected && (
        <MaterialIcons name="check" size={18} color={colors.primary} />
      )}
    </Focusable>
  );
});

// Memoized poster item component
interface PosterItemProps {
  item: FilmographyItem;
  index: number;
  rowIndex: number;
  onPress: () => void;
  colors: any;
  onFocus?: () => void;
}

const PosterItem = memo<PosterItemProps>(({
  item,
  index,
  rowIndex,
  onPress,
  colors,
  onFocus,
}) => {
  const optimizedPosterUrl = useMemo(() => {
    if (!item.poster_path) return null;
    return `https://image.tmdb.org/t/p/w342${item.poster_path}`;
  }, [item.poster_path]);

  return (
    <View style={styles.posterContainer}>
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

        {/* Upcoming indicator */}
        {item.isUpcoming && (
          <View style={styles.upcomingBadge}>
            <MaterialIcons name="schedule" size={10} color="#000" />
            <Text style={styles.upcomingText}>SOON</Text>
          </View>
        )}

        {/* Rating badge */}
        {item.vote_average && item.vote_average > 0 && (
          <View style={styles.ratingBadge}>
            <MaterialIcons name="star" size={10} color="#FFC107" />
            <Text style={styles.ratingText}>{item.vote_average.toFixed(1)}</Text>
          </View>
        )}
      </Focusable>
      <View style={styles.posterTitleContainer}>
        <Text style={[styles.posterTitle, { color: colors.text }]} numberOfLines={2}>
          {item.title}
        </Text>
      </View>
    </View>
  );
}, (prev, next) => {
  return prev.item.id === next.item.id && prev.item.poster_path === next.item.poster_path;
});

// Row of items component
interface ContentRowProps {
  items: FilmographyItem[];
  rowIndex: number;
  onItemPress: (item: FilmographyItem) => void;
  colors: any;
  onRowFocus?: () => void;
}

const ContentRow = memo<ContentRowProps>(({ items, rowIndex, onItemPress, colors, onRowFocus }) => {
  return (
    <View style={styles.rowContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        contentContainerStyle={styles.rowContent}
      >
        {items.map((item, index) => (
          <View key={`${item.media_type}-${item.id}`} style={styles.posterItemWrapper}>
            <PosterItem
              item={item}
              index={index}
              rowIndex={rowIndex}
              onPress={() => onItemPress(item)}
              colors={colors}
              onFocus={onRowFocus}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
});

// Pagination controls component
interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPrevious: () => void;
  onNext: () => void;
  colors: any;
}

const PaginationControls = memo<PaginationControlsProps>(({
  currentPage,
  totalPages,
  onPrevious,
  onNext,
  colors,
}) => {
  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  return (
    <View style={styles.paginationContainer}>
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

      <Text style={[styles.pageIndicatorText, { color: colors.textMuted }]}>
        {currentPage}/{totalPages}
      </Text>

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
    </View>
  );
});

// Sidebar component
interface FilterSidebarProps {
  selectedFilter: 'all' | 'movies' | 'tv';
  onFilterSelect: (filter: 'all' | 'movies' | 'tv') => void;
  sortBy: 'popularity' | 'latest' | 'upcoming';
  onSortSelect: (sort: 'popularity' | 'latest' | 'upcoming') => void;
  movieCount: number;
  tvCount: number;
  colors: any;
  castMember: {
    name: string;
    profile_path?: string | null;
  };
  totalCount: number;
}

const FilterSidebar = memo<FilterSidebarProps>(({
  selectedFilter,
  onFilterSelect,
  sortBy,
  onSortSelect,
  movieCount,
  tvCount,
  colors,
  castMember,
  totalCount,
}) => {
  return (
    <View style={[styles.sidebar, { backgroundColor: colors.elevation1 }]}>
      {/* Cast member header */}
      <View style={styles.castHeader}>
        <View style={[styles.castAvatar, { backgroundColor: colors.elevation2 }]}>
          {castMember.profile_path ? (
            <FastImage
              source={{ uri: `https://image.tmdb.org/t/p/w185${castMember.profile_path}` }}
              style={styles.castAvatarImage}
              resizeMode={FastImage.resizeMode.cover}
            />
          ) : (
            <Text style={[styles.castAvatarInitials, { color: colors.textMuted }]}>
              {castMember.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
            </Text>
          )}
        </View>
        <View style={styles.castInfo}>
          <Text style={[styles.castName, { color: colors.text }]} numberOfLines={1}>
            {castMember.name}
          </Text>
          <Text style={[styles.castSubtitle, { color: colors.textMuted }]}>
            Filmography • {totalCount} titles
          </Text>
        </View>
      </View>

      {/* Filter section */}
      <View style={styles.filterSection}>
        <Text style={[styles.filterSectionTitle, { color: colors.textMuted }]}>
          TYPE
        </Text>
        <FilterOption
          label="All"
          count={movieCount + tvCount}
          isSelected={selectedFilter === 'all'}
          onPress={() => onFilterSelect('all')}
          colors={colors}
        />
        <FilterOption
          label="Movies"
          count={movieCount}
          isSelected={selectedFilter === 'movies'}
          onPress={() => onFilterSelect('movies')}
          colors={colors}
          icon="movie"
        />
        <FilterOption
          label="TV Shows"
          count={tvCount}
          isSelected={selectedFilter === 'tv'}
          onPress={() => onFilterSelect('tv')}
          colors={colors}
          icon="tv"
        />
      </View>

      {/* Sort section */}
      <View style={styles.filterSection}>
        <Text style={[styles.filterSectionTitle, { color: colors.textMuted }]}>
          SORT BY
        </Text>
        <FilterOption
          label="Popular"
          isSelected={sortBy === 'popularity'}
          onPress={() => onSortSelect('popularity')}
          colors={colors}
          icon="trending-up"
        />
        <FilterOption
          label="Latest"
          isSelected={sortBy === 'latest'}
          onPress={() => onSortSelect('latest')}
          colors={colors}
          icon="schedule"
        />
        <FilterOption
          label="Upcoming"
          isSelected={sortBy === 'upcoming'}
          onPress={() => onSortSelect('upcoming')}
          colors={colors}
          icon="event"
        />
      </View>

    </View>
  );
});

// Calculate content row height for scroll calculations
const CONTENT_ROW_HEIGHT = POSTER_HEIGHT + 32 + ROW_MARGIN_BOTTOM;

export const TVFilmographyView: React.FC<TVFilmographyViewProps> = ({
  items,
  title,
  castMember,
  onItemPress,
  loading,
}) => {
  const { currentTheme } = useTheme();
  const colors = currentTheme.colors;
  const scrollViewRef = useRef<ScrollView>(null);

  // Filter and sort state
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'movies' | 'tv'>('all');
  const [sortBy, setSortBy] = useState<'popularity' | 'latest' | 'upcoming'>('popularity');
  const [currentPage, setCurrentPage] = useState(1);

  // Calculate counts
  const movieCount = useMemo(() => items.filter(m => m.media_type === 'movie').length, [items]);
  const tvCount = useMemo(() => items.filter(m => m.media_type === 'tv').length, [items]);

  // Filter and sort items
  const filteredAndSortedItems = useMemo(() => {
    let filtered = items.filter(item => {
      if (selectedFilter === 'all') return true;
      if (selectedFilter === 'movies') return item.media_type === 'movie';
      if (selectedFilter === 'tv') return item.media_type === 'tv';
      return true;
    });

    // If sorting by upcoming, only show upcoming content
    if (sortBy === 'upcoming') {
      filtered = filtered.filter(item => item.isUpcoming);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'popularity':
          return (b.popularity || 0) - (a.popularity || 0);
        case 'latest':
          const dateA = new Date(a.release_date || '1900-01-01');
          const dateB = new Date(b.release_date || '1900-01-01');
          return dateB.getTime() - dateA.getTime();
        case 'upcoming':
          if (!a.isUpcoming && !b.isUpcoming) return 0;
          if (a.isUpcoming && !b.isUpcoming) return -1;
          if (!a.isUpcoming && b.isUpcoming) return 1;
          const upcomingDateA = new Date(a.release_date || '9999-12-31');
          const upcomingDateB = new Date(b.release_date || '9999-12-31');
          return upcomingDateA.getTime() - upcomingDateB.getTime();
        default:
          return 0;
      }
    });

    return filtered;
  }, [items, selectedFilter, sortBy]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedFilter, sortBy]);

  // Calculate total pages
  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredAndSortedItems.length / ITEMS_PER_PAGE));
  }, [filteredAndSortedItems.length]);

  // Ensure current page is valid
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Get items for current page
  const pageItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredAndSortedItems.slice(startIndex, endIndex);
  }, [filteredAndSortedItems, currentPage]);

  // Group page items into rows
  const rows = useMemo(() => {
    const result: FilmographyItem[][] = [];
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

  // Handle row focus to auto-scroll
  const handleRowFocus = useCallback((rowIndex: number) => {
    if (scrollViewRef.current) {
      const isLastRow = rowIndex === rows.length - 1;
      const scrollOffset = rowIndex * CONTENT_ROW_HEIGHT;
      const extraOffset = isLastRow ? 60 : 0;
      scrollViewRef.current.scrollTo({ y: scrollOffset + extraOffset, animated: true });
    }
  }, [rows.length]);

  return (
    <View style={[styles.container, { backgroundColor: colors.darkBackground }]}>
      {/* Left sidebar with filters */}
      <FilterSidebar
        selectedFilter={selectedFilter}
        onFilterSelect={setSelectedFilter}
        sortBy={sortBy}
        onSortSelect={setSortBy}
        movieCount={movieCount}
        tvCount={tvCount}
        colors={colors}
        castMember={castMember}
        totalCount={items.length}
      />

      {/* Main content area */}
      <View style={styles.content}>
        {filteredAndSortedItems.length > 0 ? (
          <ScrollView
            ref={scrollViewRef}
            style={styles.catalogContent}
            contentContainerStyle={styles.catalogScrollContent}
            showsVerticalScrollIndicator={false}
          >
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

            {totalPages > 1 && (
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                onPrevious={handlePreviousPage}
                onNext={handleNextPage}
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
            <MaterialIcons name="movie" size={64} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              {sortBy === 'upcoming'
                ? 'No upcoming releases'
                : selectedFilter === 'all'
                  ? 'No content found'
                  : selectedFilter === 'movies'
                    ? 'No movies found'
                    : 'No TV shows found'}
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
    paddingTop: 24,
    paddingHorizontal: 16,
  },
  castHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  castAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  castAvatarImage: {
    width: '100%',
    height: '100%',
  },
  castAvatarInitials: {
    fontSize: 16,
    fontWeight: '700',
  },
  castInfo: {
    flex: 1,
  },
  castName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  castSubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  filterSection: {
    marginBottom: 20,
  },
  filterSectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  filterOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  filterOptionIcon: {
    marginRight: 10,
  },
  filterOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  filterOptionCount: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 6,
  },
  content: {
    flex: 1,
    paddingTop: 24,
    paddingLeft: CONTENT_PADDING,
    paddingRight: CONTENT_PADDING,
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
  upcomingBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(255, 193, 7, 0.95)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  upcomingText: {
    color: '#000',
    fontSize: 8,
    fontWeight: '700',
    marginLeft: 3,
  },
  ratingBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 3,
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
  catalogContent: {
    flex: 1,
  },
  catalogScrollContent: {
    paddingBottom: 20,
  },
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
  pageIndicatorText: {
    fontSize: 13,
    fontWeight: '500',
  },
});

export default TVFilmographyView;
