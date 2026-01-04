import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import Animated, {
  FadeIn,
} from 'react-native-reanimated';
import { useTheme } from '../../contexts/ThemeContext';
import { useIsTV } from '../../contexts/TVContext';
import { Focusable } from '../tv/Focusable';
import { TVFocusSection } from '../tv/TVFocusSection';

// Enhanced responsive breakpoints for Cast Section
const BREAKPOINTS = {
  phone: 0,
  tablet: 768,
  largeTablet: 1024,
  tv: 1440,
};

interface CastSectionProps {
  cast: any[];
  loadingCast: boolean;
  onSelectCastMember: (castMember: any) => void;
  isTmdbEnrichmentEnabled?: boolean;
}

export const CastSection: React.FC<CastSectionProps> = ({
  cast,
  loadingCast,
  onSelectCastMember,
  isTmdbEnrichmentEnabled = true,
}) => {
  const { currentTheme } = useTheme();
  const isTVDevice = useIsTV();

  // Enhanced responsive sizing for tablets and TV screens
  const deviceWidth = Dimensions.get('window').width;
  const deviceHeight = Dimensions.get('window').height;
  
  // Determine device type based on width
  const getDeviceType = useCallback(() => {
    if (deviceWidth >= BREAKPOINTS.tv) return 'tv';
    if (deviceWidth >= BREAKPOINTS.largeTablet) return 'largeTablet';
    if (deviceWidth >= BREAKPOINTS.tablet) return 'tablet';
    return 'phone';
  }, [deviceWidth]);
  
  const deviceType = getDeviceType();
  const isTablet = deviceType === 'tablet';
  const isLargeTablet = deviceType === 'largeTablet';
  const isTV = deviceType === 'tv';
  const isLargeScreen = isTablet || isLargeTablet || isTV;
  
  // Enhanced spacing and padding
  const horizontalPadding = useMemo(() => {
    switch (deviceType) {
      case 'tv':
        return 32;
      case 'largeTablet':
        return 28;
      case 'tablet':
        return 24;
      default:
        return 16; // phone
    }
  }, [deviceType]);
  
  // Enhanced cast card sizing
  const castCardWidth = useMemo(() => {
    switch (deviceType) {
      case 'tv':
        return 120;
      case 'largeTablet':
        return 110;
      case 'tablet':
        return 100;
      default:
        return 90; // phone
    }
  }, [deviceType]);
  
  const castImageSize = useMemo(() => {
    switch (deviceType) {
      case 'tv':
        return 100;
      case 'largeTablet':
        return 90;
      case 'tablet':
        return 85;
      default:
        return 80; // phone
    }
  }, [deviceType]);
  
  const castCardSpacing = useMemo(() => {
    switch (deviceType) {
      case 'tv':
        return 20;
      case 'largeTablet':
        return 18;
      case 'tablet':
        return 16;
      default:
        return 16; // phone
    }
  }, [deviceType]);

  if (loadingCast) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={currentTheme.colors.primary} />
      </View>
    );
  }

  if (!cast || cast.length === 0) {
    return null;
  }

  return (
    <TVFocusSection>
    <Animated.View
      style={styles.castSection}
      entering={FadeIn.duration(300).delay(150)}
    >
      <View style={[
        styles.sectionHeader,
        { paddingHorizontal: horizontalPadding }
      ]}>
        <Text style={[
          styles.sectionTitle, 
          { 
            color: currentTheme.colors.highEmphasis,
            fontSize: isTV ? 24 : isLargeTablet ? 22 : isTablet ? 20 : 18,
            marginBottom: isTV ? 16 : isLargeTablet ? 14 : isTablet ? 12 : 12
          }
        ]}>Cast</Text>
      </View>
      <FlatList
        horizontal
        data={cast}
        showsHorizontalScrollIndicator={false}
        scrollEnabled={!isTVDevice}
        contentContainerStyle={[
          styles.castList,
          { paddingHorizontal: horizontalPadding }
        ]}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item, index }) => {
          const cardStyle = [
            styles.castCard,
            {
              width: castCardWidth,
              marginRight: castCardSpacing
            }
          ];

          const cardContent = (
            <>
              <View style={[
                styles.castImageContainer,
                {
                  width: castImageSize,
                  height: castImageSize,
                  borderRadius: castImageSize / 2,
                  marginBottom: isTV ? 12 : isLargeTablet ? 10 : isTablet ? 8 : 8
                }
              ]}>
                {item.profile_path ? (
                  <FastImage
                    source={{
                      uri: `https://image.tmdb.org/t/p/w185${item.profile_path}`,
                    }}
                    style={styles.castImage}
                    resizeMode={FastImage.resizeMode.cover}
                  />
                ) : (
                  <View style={[
                    styles.castImagePlaceholder,
                    {
                      backgroundColor: currentTheme.colors.darkBackground,
                      borderRadius: castImageSize / 2
                    }
                  ]}>
                    <Text style={[
                      styles.placeholderText,
                      {
                        color: currentTheme.colors.textMuted,
                        fontSize: isTV ? 32 : isLargeTablet ? 28 : isTablet ? 26 : 24
                      }
                    ]}>
                      {item.name.split(' ').reduce((prev: string, current: string) => prev + current[0], '').substring(0, 2)}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[
                styles.castName,
                {
                  color: currentTheme.colors.text,
                  fontSize: isTV ? 16 : isLargeTablet ? 15 : isTablet ? 14 : 14,
                  width: castCardWidth
                }
              ]} numberOfLines={1}>{item.name}</Text>
              {isTmdbEnrichmentEnabled && item.character && (
                <Text style={[
                  styles.characterName,
                  {
                    color: currentTheme.colors.textMuted,
                    fontSize: isTV ? 14 : isLargeTablet ? 13 : isTablet ? 12 : 12,
                    width: castCardWidth,
                    marginTop: isTV ? 4 : isLargeTablet ? 3 : isTablet ? 2 : 2
                  }
                ]} numberOfLines={1}>{item.character}</Text>
              )}
            </>
          );

          // Text content shown below the image (used for both TV and mobile)
          const textContent = (
            <>
              <Text style={[
                styles.castName,
                {
                  color: currentTheme.colors.text,
                  fontSize: isTV ? 16 : isLargeTablet ? 15 : isTablet ? 14 : 14,
                  width: castCardWidth
                }
              ]} numberOfLines={1}>{item.name}</Text>
              {isTmdbEnrichmentEnabled && item.character && (
                <Text style={[
                  styles.characterName,
                  {
                    color: currentTheme.colors.textMuted,
                    fontSize: isTV ? 14 : isLargeTablet ? 13 : isTablet ? 12 : 12,
                    width: castCardWidth,
                    marginTop: isTV ? 4 : isLargeTablet ? 3 : isTablet ? 2 : 2
                  }
                ]} numberOfLines={1}>{item.character}</Text>
              )}
            </>
          );

          return (
            <Animated.View
              entering={FadeIn.duration(300).delay(50 + index * 30)}
            >
              {isTVDevice ? (
                <View style={[cardStyle, { overflow: 'visible', paddingTop: 6 }]}>
                  <Focusable
                    onPress={() => onSelectCastMember(item)}
                    style={{
                      width: castImageSize,
                      height: castImageSize,
                      borderRadius: castImageSize / 2,
                      marginBottom: isTV ? 12 : isLargeTablet ? 10 : isTablet ? 8 : 8,
                    }}
                    borderRadius={castImageSize / 2}
                    focusScale={1.05}
                    animateBackground={false}
                    showFocusBorder={true}
                    blockLeft={index === 0}
                    blockRight={index === cast.length - 1}
                  >
                    {item.profile_path ? (
                      <FastImage
                        source={{
                          uri: `https://image.tmdb.org/t/p/w185${item.profile_path}`,
                        }}
                        style={[styles.castImage, { borderRadius: castImageSize / 2 }]}
                        resizeMode={FastImage.resizeMode.cover}
                      />
                    ) : (
                      <View style={[
                        styles.castImagePlaceholder,
                        {
                          backgroundColor: currentTheme.colors.darkBackground,
                          borderRadius: castImageSize / 2
                        }
                      ]}>
                        <Text style={[
                          styles.placeholderText,
                          {
                            color: currentTheme.colors.textMuted,
                            fontSize: isTV ? 32 : isLargeTablet ? 28 : isTablet ? 26 : 24
                          }
                        ]}>
                          {item.name.split(' ').reduce((prev: string, current: string) => prev + current[0], '').substring(0, 2)}
                        </Text>
                      </View>
                    )}
                  </Focusable>
                  {textContent}
                </View>
              ) : (
                <TouchableOpacity
                  style={cardStyle}
                  onPress={() => onSelectCastMember(item)}
                  activeOpacity={0.7}
                >
                  {cardContent}
                </TouchableOpacity>
              )}
            </Animated.View>
          );
        }}
      />
    </Animated.View>
    </TVFocusSection>
  );
};

const styles = StyleSheet.create({
  castSection: {
    marginBottom: 24,
    paddingHorizontal: 0,
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  castList: {
    paddingBottom: 4,
  },
  castCard: {
    marginRight: 16,
    width: 90,
    alignItems: 'center',
  },
  castImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    marginBottom: 8,
  },
  castImage: {
    width: '100%',
    height: '100%',
  },
  castImagePlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 24,
    fontWeight: '600',
  },
  castName: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    width: 90,
  },
  characterName: {
    fontSize: 12,
    textAlign: 'center',
    width: 90,
    marginTop: 2,
  },
}); 