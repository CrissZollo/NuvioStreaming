import React, { useCallback, useRef, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import { useNavigation, StackActions } from '@react-navigation/native';
import { NavigationProp } from '@react-navigation/native';
import { RootStackParamList } from '../../../navigation/AppNavigator';
import { useTheme } from '../../../contexts/ThemeContext';
import { StreamingContent, catalogService } from '../../../services/catalogService';
import { Focusable } from '../../tv/Focusable';

// Card dimensions for TV - sized to fit in tab section
const POSTER_WIDTH = 85;
const POSTER_HEIGHT = 127;
const CARD_SPACING = 8;

interface TVRecommendationsTabContentProps {
  recommendations: StreamingContent[];
  firstContentItemRef: React.RefObject<View>;
  activeTabRef: React.RefObject<View>;
}

const TVRecommendationsTabContentComponent: React.FC<TVRecommendationsTabContentProps> = ({
  recommendations,
  firstContentItemRef,
  activeTabRef,
}) => {
  const { currentTheme } = useTheme();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const flatListRef = useRef<FlatList<StreamingContent>>(null);

  // Item refs for focus navigation
  const itemRefs = useRef<Map<number, React.RefObject<View>>>(new Map());

  const getItemRef = useCallback((index: number) => {
    if (!itemRefs.current.has(index)) {
      itemRefs.current.set(index, React.createRef<View>());
    }
    return itemRefs.current.get(index)!;
  }, []);

  // Handle item focus - scroll to keep in view
  const handleItemFocus = useCallback((index: number) => {
    if (flatListRef.current) {
      const offset = index * (POSTER_WIDTH + CARD_SPACING);
      flatListRef.current.scrollToOffset({
        offset: Math.max(0, offset - 48),
        animated: true,
      });
    }
  }, []);

  // Handle item press - navigate to metadata
  const handleItemPress = useCallback(async (item: StreamingContent) => {
    try {
      const tmdbId = item.id.replace('tmdb:', '');
      const stremioId = await catalogService.getStremioId(item.type, tmdbId);

      if (stremioId) {
        navigation.dispatch(
          StackActions.push('Metadata', {
            id: stremioId,
            type: item.type,
          })
        );
      }
    } catch (error) {
      if (__DEV__) console.error('Error navigating to recommendation:', error);
    }
  }, [navigation]);

  // Render recommendation card
  const renderItem = useCallback(({ item, index }: { item: StreamingContent; index: number }) => {
    const isFirst = index === 0;
    const isLast = index === recommendations.length - 1;

    return (
      <View style={[styles.cardWrapper, { marginRight: CARD_SPACING }]}>
        <Focusable
          viewRef={isFirst ? firstContentItemRef : getItemRef(index)}
          onPress={() => handleItemPress(item)}
          onFocus={() => handleItemFocus(index)}
          style={styles.card}
          borderRadius={12}
          unfocusedScale={0.95}
          focusScale={1.0}
          animateBackground={false}
          showFocusBorder={true}
          blockUp={false}
          blockLeft={isFirst}
          blockRight={isLast}
          nextFocusUp={activeTabRef}
          nextFocusLeft={!isFirst ? getItemRef(index - 1) : undefined}
          nextFocusRight={!isLast ? getItemRef(index + 1) : undefined}
        >
          <FastImage
            source={{ uri: item.poster }}
            style={styles.poster}
            resizeMode={FastImage.resizeMode.cover}
          />
        </Focusable>

        {/* Title below poster */}
        <Text
          style={[styles.title, { color: currentTheme.colors.mediumEmphasis }]}
          numberOfLines={2}
        >
          {item.name}
        </Text>
      </View>
    );
  }, [recommendations.length, currentTheme.colors.mediumEmphasis, firstContentItemRef, activeTabRef, getItemRef, handleItemFocus, handleItemPress]);

  // Key extractor
  const keyExtractor = useCallback((item: StreamingContent) => item.id, []);

  // Get item layout for fast scrolling
  const getItemLayout = useCallback((_: any, index: number) => ({
    length: POSTER_WIDTH + CARD_SPACING,
    offset: (POSTER_WIDTH + CARD_SPACING) * index,
    index,
  }), []);

  if (recommendations.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, { color: currentTheme.colors.textMuted }]}>
          No recommendations available
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={recommendations}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false} // D-pad controls focus
        contentContainerStyle={styles.listContent}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={11}
        getItemLayout={getItemLayout}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingRight: 48,
  },
  cardWrapper: {
    width: POSTER_WIDTH,
  },
  card: {
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 12,
    marginTop: 6,
    lineHeight: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
  },
});

export const TVRecommendationsTabContent = memo(TVRecommendationsTabContentComponent);
