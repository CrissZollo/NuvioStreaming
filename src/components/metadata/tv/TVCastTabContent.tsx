import React, { useCallback, useRef, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackActions } from '@react-navigation/native';
import { useTheme } from '../../../contexts/ThemeContext';
import { Focusable } from '../../tv/Focusable';

// Cast card dimensions - compact to fit in tab section
const CAST_CARD_WIDTH = 80;
const CAST_CARD_HEIGHT = 100;
const CAST_SPACING = 10;

interface TVCastTabContentProps {
  cast: any[];
  firstContentItemRef: React.RefObject<View>;
  activeTabRef: React.RefObject<View>;
}

const TVCastTabContentComponent: React.FC<TVCastTabContentProps> = ({
  cast,
  firstContentItemRef,
  activeTabRef,
}) => {
  const { currentTheme } = useTheme();
  const navigation = useNavigation();
  const flatListRef = useRef<FlatList<any>>(null);

  // Cast item refs
  const castRefs = useRef<Map<number, React.RefObject<View>>>(new Map());

  const getCastRef = useCallback((index: number) => {
    if (!castRefs.current.has(index)) {
      castRefs.current.set(index, React.createRef<View>());
    }
    return castRefs.current.get(index)!;
  }, []);

  // Handle cast focus
  const handleCastFocus = useCallback((index: number) => {
    if (flatListRef.current) {
      const offset = index * (CAST_CARD_WIDTH + CAST_SPACING);
      flatListRef.current.scrollToOffset({
        offset: Math.max(0, offset - 24),
        animated: false,
      });
    }
  }, []);

  // Handle cast member press - navigate to filmography
  const handleCastPress = useCallback((castMember: any) => {
    navigation.dispatch(
      StackActions.push('CastMovies', {
        castMember: {
          id: castMember.id,
          name: castMember.name,
          profile_path: castMember.profile_path,
          character: castMember.character,
        },
      })
    );
  }, [navigation]);

  // Render cast card
  const renderCastCard = useCallback(({ item, index }: { item: any; index: number }) => {
    const isFirst = index === 0;
    const isLast = index === cast.length - 1;
    const profileImage = item.profile_path
      ? `https://image.tmdb.org/t/p/w185${item.profile_path}`
      : null;

    return (
      <View style={[styles.castCardWrapper, { marginRight: CAST_SPACING }]}>
        <Focusable
          viewRef={isFirst ? firstContentItemRef : getCastRef(index)}
          onPress={() => handleCastPress(item)}
          onFocus={() => handleCastFocus(index)}
          style={styles.castCard}
          borderRadius={6}
          unfocusedScale={0.95}
          focusScale={1.0}
          animateBackground={false}
          showFocusBorder={true}
          blockUp={false}
          blockLeft={isFirst}
          blockRight={isLast}
          nextFocusUp={activeTabRef}
          nextFocusLeft={!isFirst ? getCastRef(index - 1) : undefined}
          nextFocusRight={!isLast ? getCastRef(index + 1) : undefined}
        >
          {profileImage ? (
            <FastImage
              source={{ uri: profileImage }}
              style={styles.castImage}
              resizeMode={FastImage.resizeMode.cover}
            />
          ) : (
            <View style={[styles.castPlaceholder, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
              <MaterialIcons name="person" size={32} color={currentTheme.colors.textMuted} />
            </View>
          )}
        </Focusable>
        <Text
          style={[styles.castName, { color: currentTheme.colors.highEmphasis }]}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        <Text
          style={[styles.castCharacter, { color: currentTheme.colors.textMuted }]}
          numberOfLines={1}
        >
          {item.character}
        </Text>
      </View>
    );
  }, [cast.length, currentTheme.colors, firstContentItemRef, activeTabRef, getCastRef, handleCastFocus, handleCastPress]);

  // Key extractor
  const keyExtractor = useCallback((item: any) => item.id.toString(), []);

  // Get item layout
  const getItemLayout = useCallback((_: any, index: number) => ({
    length: CAST_CARD_WIDTH + CAST_SPACING,
    offset: (CAST_CARD_WIDTH + CAST_SPACING) * index,
    index,
  }), []);

  if (cast.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialIcons name="people" size={48} color={currentTheme.colors.textMuted} />
        <Text style={[styles.emptyText, { color: currentTheme.colors.textMuted }]}>
          No cast information available
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={cast}
        renderItem={renderCastCard}
        keyExtractor={keyExtractor}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        contentContainerStyle={styles.listContent}
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
  castCardWrapper: {
    width: CAST_CARD_WIDTH,
  },
  castCard: {
    width: CAST_CARD_WIDTH,
    height: CAST_CARD_HEIGHT,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  castImage: {
    width: '100%',
    height: '100%',
  },
  castPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  castName: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
  },
  castCharacter: {
    fontSize: 10,
    marginTop: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
  },
});

export const TVCastTabContent = memo(TVCastTabContentComponent);
