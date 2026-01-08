import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  ListRenderItemInfo,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import { useNavigation, StackActions } from '@react-navigation/native';
import { NavigationProp } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { StreamingContent } from '../../services/catalogService';
import { useTheme } from '../../contexts/ThemeContext';
import { TMDBService } from '../../services/tmdbService';
import { catalogService } from '../../services/catalogService';
import CustomAlert from '../../components/CustomAlert';
import { useIsTV } from '../../contexts/TVContext';
import { Focusable } from '../tv/Focusable';
import { TVFocusSection } from '../tv/TVFocusSection';

const { width } = Dimensions.get('window');

// Breakpoints for responsive sizing
const BREAKPOINTS = {
  phone: 0,
  tablet: 768,
  largeTablet: 1024,
  tv: 1440,
} as const;

interface MoreLikeThisSectionProps {
  recommendations: StreamingContent[];
  loadingRecommendations: boolean;
}

export const MoreLikeThisSection: React.FC<MoreLikeThisSectionProps> = ({
  recommendations,
  loadingRecommendations
}) => {
  const { currentTheme } = useTheme();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const isTVDevice = useIsTV();

  // Determine device type
  const deviceWidth = Dimensions.get('window').width;
  const getDeviceType = React.useCallback(() => {
    if (deviceWidth >= BREAKPOINTS.tv) return 'tv';
    if (deviceWidth >= BREAKPOINTS.largeTablet) return 'largeTablet';
    if (deviceWidth >= BREAKPOINTS.tablet) return 'tablet';
    return 'phone';
  }, [deviceWidth]);
  const deviceType = getDeviceType();
  const isTablet = deviceType === 'tablet';
  const isLargeTablet = deviceType === 'largeTablet';
  const isTV = deviceType === 'tv';

  // Responsive spacing & sizes
  const horizontalPadding = React.useMemo(() => {
    switch (deviceType) {
      case 'tv': return 32;
      case 'largeTablet': return 28;
      case 'tablet': return 24;
      default: return 16;
    }
  }, [deviceType]);

  const itemSpacing = React.useMemo(() => {
    switch (deviceType) {
      case 'tv': return 14;
      case 'largeTablet': return 12;
      case 'tablet': return 12;
      default: return 12;
    }
  }, [deviceType]);

  const posterWidth = React.useMemo(() => {
    switch (deviceType) {
      case 'tv': return 180;
      case 'largeTablet': return 160;
      case 'tablet': return 140;
      default: return 120;
    }
  }, [deviceType]);
  const posterHeight = React.useMemo(() => posterWidth * 1.5, [posterWidth]);

  const [alertVisible, setAlertVisible] = React.useState(false);
  const [alertTitle, setAlertTitle] = React.useState('');
  const [alertMessage, setAlertMessage] = React.useState('');
  const [alertActions, setAlertActions] = React.useState<any[]>([]);

  const handleItemPress = useCallback(async (item: StreamingContent) => {
    try {
      // Extract TMDB ID from the tmdb:123456 format
      const tmdbId = item.id.replace('tmdb:', '');

      // Get Stremio ID directly using catalogService
      // The catalogService.getStremioId method already handles the conversion internally
      const stremioId = await catalogService.getStremioId(item.type, tmdbId);

      if (stremioId) {
        navigation.dispatch(
          StackActions.push('Metadata', {
            id: stremioId,
            type: item.type
          })
        );
      } else {
        throw new Error('Could not find Stremio ID');
      }
    } catch (error) {
      if (__DEV__) console.error('Error navigating to recommendation:', error);
      setAlertTitle('Error');
      setAlertMessage('Unable to load this content. Please try again later.');
      setAlertActions([{ label: 'OK', onPress: () => {} }]);
      setAlertVisible(true);
    }
  }, [navigation]);

  // Memoized border radius calculation
  const borderRadius = useMemo(() => {
    return isTV ? 12 : isLargeTablet ? 10 : isTablet ? 10 : 8;
  }, [isTV, isLargeTablet, isTablet]);

  // Memoized item style
  const itemStyle = useMemo(() => {
    return [styles.itemContainer, { width: posterWidth, marginRight: itemSpacing }];
  }, [posterWidth, itemSpacing]);

  // Memoized poster style
  const posterStyle = useMemo(() => {
    return [styles.poster, { backgroundColor: currentTheme.colors.elevation1, width: posterWidth, height: posterHeight, borderRadius }];
  }, [currentTheme.colors.elevation1, posterWidth, posterHeight, borderRadius]);

  // Memoized title style
  const titleStyle = useMemo(() => {
    return [styles.title, { color: currentTheme.colors.mediumEmphasis, fontSize: isTV ? 14 : isLargeTablet ? 13 : isTablet ? 13 : 13, lineHeight: isTV ? 20 : 18 }];
  }, [currentTheme.colors.mediumEmphasis, isTV, isLargeTablet, isTablet]);

  // Memoized focusable style
  const focusableStyle = useMemo(() => {
    return { width: posterWidth, height: posterHeight, marginBottom: 8 };
  }, [posterWidth, posterHeight]);

  // Memoized TV item container style
  const tvItemContainerStyle = useMemo(() => {
    return [itemStyle, { overflow: 'visible' as const, paddingTop: 6 }];
  }, [itemStyle]);

  const renderItem = useCallback(({ item, index }: ListRenderItemInfo<StreamingContent>) => {
    const isFirst = index === 0;
    const isLast = index === recommendations.length - 1;

    const posterImage = (
      <FastImage
        source={{ uri: item.poster }}
        style={posterStyle}
        resizeMode={FastImage.resizeMode.cover}
      />
    );

    const titleText = (
      <Text style={titleStyle} numberOfLines={2}>
        {item.name}
      </Text>
    );

    if (isTVDevice) {
      return (
        <View style={tvItemContainerStyle}>
          <Focusable
            onPress={() => handleItemPress(item)}
            style={focusableStyle}
            borderRadius={borderRadius}
            focusScale={1.05}
            animateBackground={false}
            showFocusBorder={true}
            blockLeft={isFirst}
            blockRight={isLast}
          >
            {posterImage}
          </Focusable>
          {titleText}
        </View>
      );
    }

    return (
      <TouchableOpacity
        style={itemStyle}
        onPress={() => handleItemPress(item)}
      >
        {posterImage}
        {titleText}
      </TouchableOpacity>
    );
  }, [recommendations.length, posterStyle, titleStyle, isTVDevice, tvItemContainerStyle, focusableStyle, borderRadius, handleItemPress, itemStyle]);

  // getItemLayout for optimized scrolling
  const getItemLayout = useCallback((_: any, index: number) => ({
    length: posterWidth + itemSpacing,
    offset: (posterWidth + itemSpacing) * index,
    index,
  }), [posterWidth, itemSpacing]);

  // Memoized keyExtractor
  const keyExtractor = useCallback((item: StreamingContent) => item.id, []);

  if (loadingRecommendations) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={currentTheme.colors.primary} />
      </View>
    );
  }

  if (!recommendations || recommendations.length === 0) {
    return null; // Don't render anything if there are no recommendations
  }

  return (
    <TVFocusSection>
    <View style={[styles.container, { paddingLeft: 0 }] }>
      <Text style={[styles.sectionTitle, { color: currentTheme.colors.highEmphasis, fontSize: isTV ? 24 : isLargeTablet ? 22 : isTablet ? 20 : 20, paddingHorizontal: horizontalPadding }]}>More Like This</Text>
      <FlatList
        data={recommendations}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEnabled={!isTVDevice}
        contentContainerStyle={[styles.listContentContainer, { paddingHorizontal: horizontalPadding, paddingRight: horizontalPadding + itemSpacing }]}
        getItemLayout={getItemLayout}
        removeClippedSubviews={true}
        windowSize={5}
        initialNumToRender={6}
        maxToRenderPerBatch={4}
      />
      <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        actions={alertActions}
        onClose={() => setAlertVisible(false)}
      />
    </View>
    </TVFocusSection>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 12,
    marginTop: 8,
  },
  listContentContainer: {
    paddingRight: 32, // Will be overridden responsively
  },
  itemContainer: {
    marginRight: 12, // will be overridden responsively
  },
  poster: {
    borderRadius: 8, // overridden responsively
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  title: {
    fontSize: 13, // overridden responsively
    fontWeight: '500',
    lineHeight: 18, // overridden responsively
  },
  loadingContainer: {
    // Approximate height to prevent layout shifts; not used in responsive version
    justifyContent: 'center',
    alignItems: 'center',
  },
});