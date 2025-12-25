import React, { useRef, useCallback, memo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Focusable } from './Focusable';
import { useTheme } from '../../contexts/ThemeContext';
import { useFocusMemory } from '../../hooks/useTVFocus';

interface ContentItem {
  id: string;
  type: string;
  name?: string;
  title?: string;
  poster?: string;
}

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

  const handleItemFocus = useCallback(
    (index: number) => {
      focusedIndexRef.current = index;
      saveFocus(rowIndex, index);
      onRowFocus?.(rowIndex);

      // Scroll to keep focused item visible
      listRef.current?.scrollToIndex({
        index,
        viewPosition: 0.3, // Keep item towards left
        animated: true,
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

  const renderContentItem = useCallback(
    ({ item, index }: { item: ContentItem; index: number }) => {
      const isFirst = index === 0;

      return (
        <Focusable
          onPress={() => onItemPress(item.id, item.type)}
          onFocus={() => handleItemFocus(index)}
          autoFocus={isFirst && rowIndex === 0}
          style={[styles.itemContainer, { width: itemWidth }]}
          borderRadius={8}
          // Don't animate background for poster cards - only show white outline
          animateBackground={false}
        >
          {(focused) =>
            renderItem ? (
              renderItem(item, focused)
            ) : (
              <View
                style={[
                  styles.posterPlaceholder,
                  {
                    width: itemWidth,
                    height: itemHeight,
                    backgroundColor: currentTheme.colors.elevation1 || '#1a1a1a',
                  },
                ]}
              >
                <Text style={styles.posterText} numberOfLines={2}>
                  {item.name || item.title || 'Untitled'}
                </Text>
              </View>
            )
          }
        </Focusable>
      );
    },
    [
      onItemPress,
      handleItemFocus,
      rowIndex,
      renderItem,
      itemWidth,
      itemHeight,
      currentTheme.colors.elevation1,
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
        contentContainerStyle={styles.listContent}
        getItemLayout={getItemLayout}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews
        onScrollToIndexFailed={(info) => {
          // Handle scroll failure gracefully
          const wait = new Promise((resolve) => setTimeout(resolve, 100));
          wait.then(() => {
            listRef.current?.scrollToIndex({
              index: info.index,
              animated: true,
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
