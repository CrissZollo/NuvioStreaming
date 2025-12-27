import React, { memo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { useIsTV } from '../contexts/TVContext';
import { Focusable } from './tv/Focusable';

interface ProviderFilterProps {
  selectedProvider: string;
  providers: Array<{ id: string; name: string; }>;
  onSelect: (id: string) => void;
  theme: any;
}

const ProviderFilter = memo(({
  selectedProvider,
  providers,
  onSelect,
  theme
}: ProviderFilterProps) => {
  const styles = React.useMemo(() => createStyles(theme.colors), [theme.colors]);
  const isTVDevice = useIsTV();

  const renderItem = useCallback(({ item, index }: { item: { id: string; name: string }; index: number }) => {
    const isSelected = selectedProvider === item.id;

    if (isTVDevice) {
      return (
        <View style={styles.filterChipWrapper}>
          <Focusable
            style={[
              styles.filterChip,
              styles.filterChipTV,
              isSelected && styles.filterChipSelected
            ]}
            onPress={() => onSelect(item.id)}
            borderRadius={16}
            focusScale={1.0}
            animateBackground={false}
            showFocusBorder={true}
          >
            <Text style={[
              styles.filterChipText,
              isSelected && styles.filterChipTextSelected
            ]}>
              {item.name}
            </Text>
          </Focusable>
        </View>
      );
    }

    return (
      <TouchableOpacity
        style={[
          styles.filterChip,
          isSelected && styles.filterChipSelected
        ]}
        onPress={() => onSelect(item.id)}
      >
        <Text style={[
          styles.filterChipText,
          isSelected && styles.filterChipTextSelected
        ]}>
          {item.name}
        </Text>
      </TouchableOpacity>
    );
  }, [selectedProvider, onSelect, styles, isTVDevice]);

  return (
    <View style={isTVDevice ? styles.containerTV : undefined}>
      <FlatList
        data={providers}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={isTVDevice ? styles.filterContentTV : undefined}
        bounces={true}
        overScrollMode="never"
        decelerationRate="fast"
        initialNumToRender={5}
        maxToRenderPerBatch={3}
        windowSize={3}
        removeClippedSubviews={!isTVDevice}
        getItemLayout={(data, index) => ({
          length: 100, // Approximate width of each item
          offset: 100 * index,
          index,
        })}
      />
    </View>
  );
});

const createStyles = (colors: any) => StyleSheet.create({
  containerTV: {
    paddingVertical: 8,
    marginHorizontal: -6,
  },
  filterScroll: {
    flexGrow: 0,
    overflow: 'visible',
  },
  filterContentTV: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  filterChipWrapper: {
    marginVertical: 6,
    marginHorizontal: 6,
  },
  filterChip: {
    backgroundColor: colors.elevation2,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 0,
  },
  filterChipTV: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginRight: 0,
  },
  filterChipSelected: {
    backgroundColor: colors.primary,
  },
  filterChipText: {
    color: colors.highEmphasis,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  filterChipTextSelected: {
    color: colors.white,
    fontWeight: '700',
  },
});

export default ProviderFilter;
