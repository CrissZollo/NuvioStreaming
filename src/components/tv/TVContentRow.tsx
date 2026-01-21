import React, { useRef, useCallback, memo, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Dimensions,
  ListRenderItemInfo,
} from 'react-native';
import { Focusable } from './Focusable';
import { useTheme } from '../../contexts/ThemeContext';
import { useFocusMemory } from '../../hooks/useTVFocus';
import { navLog } from '../../utils/navigationDebugLogger';

interface ContentItem {
  id: string;
  type: string;
  name?: string;
  title?: string;
  poster?: string;
}

// Memoized item component to prevent re-renders from inline callback recreation
interface TVContentRowItemProps {
  item: ContentItem;
  index: number;
  itemWidth: number;
  itemHeight: number;
  rowIndex: number;
  onItemPress: (id: string, type: string) => void;
  onItemFocus: (index: number) => void;
  renderItem?: (item: ContentItem, isFocused: boolean) => React.ReactNode;
  backgroundColor: string;
}

const TVContentRowItem = memo<TVContentRowItemProps>(({
  item,
  index,
  itemWidth,
  itemHeight,
  rowIndex,
  onItemPress,
  onItemFocus,
  renderItem,
  backgroundColor,
}) => {
  const isFirst = index === 0;

  // Memoize callbacks to prevent unnecessary re-renders
  const handlePress = useCallback(() => {
    onItemPress(item.id, item.type);
  }, [onItemPress, item.id, item.type]);

  const handleFocus = useCallback(() => {
    onItemFocus(index);
  }, [onItemFocus, index]);

  // Memoize placeholder style
  const placeholderStyle = useMemo(() => [
    styles.posterPlaceholder,
    {
      width: itemWidth,
      height: itemHeight,
      backgroundColor,
    },
  ], [itemWidth, itemHeight, backgroundColor]);

  return (
    <Focusable
      onPress={handlePress}
      onFocus={handleFocus}
      autoFocus={isFirst && rowIndex === 0}
      style={[styles.itemContainer, { width: itemWidth }]}
      borderRadius={8}
      animateBackground={false}
    >
      {(focused) =>
        renderItem ? (
          renderItem(item, focused)
        ) : (
          <View style={placeholderStyle}>
            <Text style={styles.posterText} numberOfLines={2}>
              {item.name || item.title || 'Untitled'}
            </Text>
          </View>
        )
      }
    </Focusable>
  );
});

interface TVContentRowProps {
  /** Title of the row */
  title: string;
  /** Content items to display */
  items: ContentItem[];
  /** Handler when an item is pressed */
  onItemPress: (id: string, type: string) => void;
  /** Row index for focus management */
  rowIndex: number;
  /** Called when this row receives focus */
  onRowFocus?: (rowIndex: number) => void;
  /** Custom render function for items */
  renderItem?: (item: ContentItem, isFocused: boolean) => React.ReactNode;
  /** Item width (default 180) */
  itemWidth?: number;
  /** Item height (default 270) */
  itemHeight?: number;
}

/**
 * TV-optimized horizontal content row with D-Pad navigation
 * Supports focus memory and auto-scrolling to focused item
 */
// Debounce constant for TV focus events - 16ms (~1 frame) for responsive feel
const TV_FOCUS_DEBOUNCE_MS = 16;

export const TVContentRow: React.FC<TVContentRowProps> = memo(({
  title,
  items,
  onItemPress,
  rowIndex,
  onRowFocus,
  renderItem,
  itemWidth = 180,
  itemHeight = 270,
}) => {
  const { currentTheme } = useTheme();
  const listRef = useRef<FlatList>(null);
  const itemRefs = useRef<Map<number, View>>(new Map());
  const focusedIndexRef = useRef(0);
  const { saveFocus, getLastFocused } = useFocusMemory();

  // Debounce for TV focus events to prevent jumping on fast navigation
  const lastFocusTime = useRef<number>(0);

  const handleItemFocus = useCallback(
    (index: number) => {
      // Debounce rapid focus events to prevent scroll conflicts
      const now = Date.now();
      if (now - lastFocusTime.current < TV_FOCUS_DEBOUNCE_MS) {
        return; // Skip this focus event - too soon after last one
      }
      lastFocusTime.current = now;

      focusedIndexRef.current = index;
      saveFocus(rowIndex, index);
      onRowFocus?.(rowIndex);

      // Scroll to keep focused item visible
      listRef.current?.scrollToIndex({
        index,
        viewPosition: 0.3, // Keep item towards left
        animated: false,
      });
    },
    [rowIndex, onRowFocus, saveFocus]
  );

  const getItemRef = useCallback((index: number) => {
    if (!itemRefs.current.has(index)) {
      itemRefs.current.set(index, {} as View);
    }
    return itemRefs.current.get(index);
  }, []);

  // Memoize the background color to prevent re-renders
  const backgroundColor = currentTheme.colors.elevation1 || '#1a1a1a';

  const renderContentItem = useCallback(
    ({ item, index }: ListRenderItemInfo<ContentItem>) => {
      return (
        <TVContentRowItem
          item={item}
          index={index}
          itemWidth={itemWidth}
          itemHeight={itemHeight}
          rowIndex={rowIndex}
          onItemPress={onItemPress}
          onItemFocus={handleItemFocus}
          renderItem={renderItem}
          backgroundColor={backgroundColor}
        />
      );
    },
    [
      onItemPress,
      handleItemFocus,
      rowIndex,
      renderItem,
      itemWidth,
      itemHeight,
      backgroundColor,
    ]
  );

  const keyExtractor = useCallback(
    (item: ContentItem, index: number) => `${item.id}-${item.type}-${index}`,
    []
  );

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: itemWidth + 16, // width + gap
      offset: (itemWidth + 16) * index,
      index,
    }),
    [itemWidth]
  );

  if (items.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text
        style={[styles.title, { color: currentTheme.colors.text }]}
      >
        {title}
      </Text>
      <FlatList
        ref={listRef}
        data={items}
        renderItem={renderContentItem}
        keyExtractor={keyExtractor}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        contentContainerStyle={styles.listContent}
        getItemLayout={getItemLayout}
        initialNumToRender={5}
        maxToRenderPerBatch={4}
        windowSize={3}
        removeClippedSubviews
        onScrollToIndexFailed={(info) => {
          // Handle scroll failure gracefully
          navLog.perfWarn(`TVContentRow[${title}].scrollToIndexFailed`, info.index);
          navLog.log('SCROLL', 'SCROLL_TO_INDEX_FAILED:', {
            index: info.index,
            highestMeasuredFrameIndex: info.highestMeasuredFrameIndex,
            averageItemLength: info.averageItemLength,
          });
          const wait = new Promise((resolve) => setTimeout(resolve, 100));
          wait.then(() => {
            navLog.log('SCROLL', 'RETRY_SCROLL_TO_INDEX:', info.index);
            listRef.current?.scrollToIndex({
              index: info.index,
              animated: false,
            });
          });
        }}
      />
    </View>
  );
});

TVContentRow.displayName = 'TVContentRow';

const styles = StyleSheet.create({
  container: {
    marginBottom: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 16,
    marginLeft: 48,
  },
  listContent: {
    paddingHorizontal: 48,
    gap: 16,
  },
  itemContainer: {
    marginRight: 0,
  },
  posterPlaceholder: {
    borderRadius: 8,
    justifyContent: 'flex-end',
    padding: 12,
  },
  posterText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default TVContentRow;
