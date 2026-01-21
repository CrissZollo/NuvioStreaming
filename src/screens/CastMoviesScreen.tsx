import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Platform,
  FlatList,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import FastImage from '@d11/react-native-fast-image';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTheme } from '../contexts/ThemeContext';
import { Cast } from '../types/cast';
import { tmdbService } from '../services/tmdbService';
import { catalogService } from '../services/catalogService';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NavigationProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackActions } from '@react-navigation/native';
import CustomAlert from '../components/CustomAlert';
import { useIsTV } from '../contexts/TVContext';
import Focusable from '../components/tv/Focusable';

const { width, height } = Dimensions.get('window');

interface CastMovie {
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

type CastMoviesScreenRouteProp = RouteProp<RootStackParamList, 'CastMovies'>;

const CastMoviesScreen: React.FC = () => {
  const { currentTheme } = useTheme();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<CastMoviesScreenRouteProp>();
  const { castMember } = route.params;
  const { top: safeAreaTop } = useSafeAreaInsets();
  const isTV = useIsTV();
  const flatListRef = useRef<FlatList>(null);
  const backButtonRef = useRef<View>(null);

  // TV: 6 columns, Tablet: 4 columns, Phone: 3 columns
  const isTablet = width >= 768;
  const numColumns = isTV ? 6 : (isTablet ? 4 : 3);
  const horizontalPadding = isTV ? 40 : 20;
  const itemSpacing = isTV ? 10 : 12;
  const posterWidth = (width - (horizontalPadding * 2) - (numColumns - 1) * itemSpacing) / numColumns;
  const posterHeight = posterWidth * 1.5;

  const [movies, setMovies] = useState<CastMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'movies' | 'tv'>('all');
  const [sortBy, setSortBy] = useState<'popularity' | 'latest' | 'upcoming'>('popularity');
  const scrollY = useSharedValue(0);
  const [displayLimit, setDisplayLimit] = useState(30); // Start with fewer items for performance
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertActions, setAlertActions] = useState<any[]>([]);

  useEffect(() => {
    if (castMember) {
      fetchCastCredits();
    }
  }, [castMember]);

  // Reset display limit when filters change
  useEffect(() => {
    setDisplayLimit(30);
  }, [selectedFilter, sortBy]);

  const fetchCastCredits = async () => {
    if (!castMember) return;
    
    setLoading(true);
    try {
      const credits = await tmdbService.getPersonCombinedCredits(castMember.id);
      
      if (credits && credits.cast) {
        const currentDate = new Date();
        
        // Combine cast roles with enhanced data, excluding talk shows and variety shows
        const allCredits = credits.cast
          .filter((item: any) => {
            // Filter out talk shows, variety shows, and ensure we have required data
            const hasPoster = item.poster_path;
            const hasReleaseDate = item.release_date || item.first_air_date;
            
            if (!hasPoster || !hasReleaseDate) return false;
            
            // Enhanced talk show filtering
            const title = (item.title || item.name || '').toLowerCase();
            const overview = (item.overview || '').toLowerCase();
            
            // List of common talk show and variety show keywords
            const talkShowKeywords = [
              'talk', 'show', 'late night', 'tonight show', 'jimmy fallon', 'snl', 'saturday night live',
              'variety', 'sketch comedy', 'stand-up', 'standup', 'comedy central', 'daily show',
              'colbert', 'kimmel', 'conan', 'ellen', 'oprah', 'view', 'today show', 'good morning',
              'interview', 'panel', 'roundtable', 'discussion', 'news', 'current events', 'politics',
              'reality', 'competition', 'game show', 'quiz', 'trivia', 'awards', 'ceremony',
              'red carpet', 'premiere', 'after party', 'behind the scenes', 'making of', 'documentary',
              'special', 'concert', 'live performance', 'mtv', 'vh1', 'bet', 'comedy', 'roast'
            ];
            
            // Check if any keyword matches
            const isTalkShow = talkShowKeywords.some(keyword => 
              title.includes(keyword) || overview.includes(keyword)
            );
            
            return !isTalkShow;
          })
          .map((item: any) => {
            const releaseDate = new Date(item.release_date || item.first_air_date);
            const isUpcoming = releaseDate > currentDate;
            
            return {
              id: item.id,
              title: item.title || item.name,
              poster_path: item.poster_path,
              release_date: item.release_date || item.first_air_date,
              character: item.character,
              media_type: item.media_type,
              popularity: item.popularity || 0,
              vote_average: item.vote_average || 0,
              isUpcoming,
            };
          });
        
        setMovies(allCredits);
      }
    } catch (error) {
      if (__DEV__) console.error('Error fetching cast credits:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSortedMovies = useMemo(() => {
    let filtered = movies.filter(movie => {
      if (selectedFilter === 'all') return true;
      if (selectedFilter === 'movies') return movie.media_type === 'movie';
      if (selectedFilter === 'tv') return movie.media_type === 'tv';
      return true;
    });

    // If sorting by upcoming, only show upcoming content
    if (sortBy === 'upcoming') {
      filtered = filtered.filter(movie => movie.isUpcoming);
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
          // Only show upcoming content, sorted by nearest release date
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
  }, [movies, selectedFilter, sortBy]);

  // Performance: Limit displayed items initially for better performance
  const displayedMovies = useMemo(() => {
    return filteredAndSortedMovies.slice(0, displayLimit);
  }, [filteredAndSortedMovies, displayLimit]);

  // Load more items when needed
  const handleLoadMore = useCallback(() => {
    if (displayLimit < filteredAndSortedMovies.length && !isLoadingMore) {
      setIsLoadingMore(true);
      // Simulate loading delay for smooth UX
      setTimeout(() => {
        setDisplayLimit(prev => Math.min(prev + 20, filteredAndSortedMovies.length));
        setIsLoadingMore(false);
      }, 200);
    }
  }, [displayLimit, filteredAndSortedMovies.length, isLoadingMore]);

  const handleMoviePress = async (movie: CastMovie) => {
    if (__DEV__) {
      console.log('=== CastMoviesScreen: Movie Press ===');
      console.log('Movie data:', {
        id: movie.id,
        title: movie.title,
        media_type: movie.media_type,
        release_date: movie.release_date,
        character: movie.character,
        popularity: movie.popularity,
        vote_average: movie.vote_average,
        isUpcoming: movie.isUpcoming
      });
    }
    
    try {
      if (__DEV__) console.log('Attempting to get Stremio ID for:', movie.media_type, movie.id.toString());
      
      // Get Stremio ID using catalogService
      const stremioId = await catalogService.getStremioId(movie.media_type, movie.id.toString());
      
      if (__DEV__) console.log('Stremio ID result:', stremioId);
      
      if (stremioId) {
        if (__DEV__) console.log('Successfully found Stremio ID, navigating to Metadata with:', {
          id: stremioId,
          type: movie.media_type
        });
        
        // Convert TMDB media type to Stremio media type
        const stremioType = movie.media_type === 'tv' ? 'series' : movie.media_type;
        
        if (__DEV__) console.log('Navigating with Stremio type conversion:', {
          originalType: movie.media_type,
          stremioType: stremioType,
          id: stremioId
        });
        
        navigation.dispatch(
          StackActions.push('Metadata', { 
            id: stremioId, 
            type: stremioType 
          })
        );
      } else {
        if (__DEV__) console.warn('Stremio ID is null/undefined for movie:', movie.title);
        throw new Error('Could not find Stremio ID');
      }
  } catch (error: any) {
      if (__DEV__) {
        console.error('=== Error in handleMoviePress ===');
        console.error('Movie:', movie.title);
        console.error('Error details:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      setAlertTitle('Error');
      setAlertMessage(`Unable to load "${movie.title}". Please try again later.`);
      setAlertActions([{ label: 'OK', onPress: () => {} }]);
      setAlertVisible(true);
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const renderFilterButton = (filter: 'all' | 'movies' | 'tv', label: string, count: number) => {
    const isSelected = selectedFilter === filter;

    const buttonContent = (
      <View
        style={{
          paddingHorizontal: isTV ? 16 : 18,
          paddingVertical: isTV ? 8 : 10,
          borderRadius: 20,
          backgroundColor: isSelected
            ? currentTheme.colors.primary
            : 'rgba(255, 255, 255, 0.08)',
          marginRight: isTV ? 0 : 12,
          borderWidth: isSelected ? 0 : 1,
          borderColor: 'rgba(255, 255, 255, 0.12)',
        }}
      >
        <Text style={{
          color: isSelected ? '#fff' : 'rgba(255, 255, 255, 0.85)',
          fontSize: isTV ? 13 : 13,
          fontWeight: isSelected ? '700' : '600',
          letterSpacing: 0.3,
        }}>
          {count > 0 ? `${label} (${count})` : label}
        </Text>
      </View>
    );

    if (isTV) {
      return (
        <Animated.View entering={FadeIn.delay(100)} style={{ marginRight: 10 }}>
          <Focusable
            onPress={() => setSelectedFilter(filter)}
            borderRadius={20}
            focusScale={1.0}
            showFocusBorder={true}
          >
            {buttonContent}
          </Focusable>
        </Animated.View>
      );
    }

    return (
      <Animated.View entering={FadeIn.delay(100)}>
        <TouchableOpacity
          onPress={() => setSelectedFilter(filter)}
          activeOpacity={0.8}
        >
          {buttonContent}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderSortButton = (sort: 'popularity' | 'latest' | 'upcoming', label: string, icon: string) => {
    const isSelected = sortBy === sort;

    const buttonContent = (
      <View
        style={{
          paddingHorizontal: isTV ? 14 : 16,
          paddingVertical: isTV ? 6 : 8,
          borderRadius: 16,
          backgroundColor: isSelected
            ? 'rgba(255, 255, 255, 0.15)'
            : 'transparent',
          marginRight: isTV ? 0 : 12,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <MaterialIcons
          name={icon as any}
          size={isTV ? 16 : 16}
          color={isSelected ? currentTheme.colors.primary : 'rgba(255, 255, 255, 0.6)'}
          style={{ marginRight: 5 }}
        />
        <Text style={{
          color: isSelected ? currentTheme.colors.primary : 'rgba(255, 255, 255, 0.8)',
          fontSize: isTV ? 12 : 12,
          fontWeight: isSelected ? '700' : '500',
          letterSpacing: 0.2,
        }}>
          {label}
        </Text>
      </View>
    );

    if (isTV) {
      return (
        <Animated.View entering={FadeIn.delay(200)} style={{ marginRight: 10 }}>
          <Focusable
            onPress={() => setSortBy(sort)}
            borderRadius={16}
            focusScale={1.0}
            showFocusBorder={true}
          >
            {buttonContent}
          </Focusable>
        </Animated.View>
      );
    }

    return (
      <Animated.View entering={FadeIn.delay(200)}>
        <TouchableOpacity
          onPress={() => setSortBy(sort)}
          activeOpacity={0.7}
        >
          {buttonContent}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Handle focus to auto-scroll item into view
  const handleItemFocus = useCallback((index: number) => {
    if (isTV && flatListRef.current) {
      flatListRef.current.scrollToIndex({
        index: Math.floor(index / numColumns),
        animated: false,
        viewPosition: 0.3,
      });
    }
  }, [isTV, numColumns]);

  const renderMovieItem = useCallback(({ item, index }: { item: CastMovie; index: number }) => {
    const isFirstItem = index === 0;
    const posterBorderRadius = isTV ? 8 : 16;
    const titleFontSize = isTV ? 11 : 13;
    const characterFontSize = isTV ? 9 : 11;
    const yearFontSize = isTV ? 8 : 10;

    const posterContent = (
      <>
        <View style={{
          width: posterWidth,
          height: posterHeight,
          borderRadius: posterBorderRadius,
          overflow: 'hidden',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
        }}>
          {item.poster_path ? (
            <FastImage
              source={{
                uri: `https://image.tmdb.org/t/p/w342${item.poster_path}`,
              }}
              style={{ width: '100%', height: '100%' }}
              resizeMode={FastImage.resizeMode.cover}
            />
          ) : (
            <View style={{
              width: '100%',
              height: '100%',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
            }}>
              <MaterialIcons name="movie" size={isTV ? 24 : 32} color="rgba(255, 255, 255, 0.2)" />
            </View>
          )}

          {/* Upcoming indicator */}
          {item.isUpcoming ? (
            <View style={{
              position: 'absolute',
              top: isTV ? 4 : 8,
              left: isTV ? 4 : 8,
              backgroundColor: 'rgba(255, 193, 7, 0.95)',
              borderRadius: isTV ? 8 : 12,
              paddingHorizontal: isTV ? 4 : 8,
              paddingVertical: isTV ? 2 : 4,
              flexDirection: 'row',
              alignItems: 'center',
            }}>
              <MaterialIcons name="schedule" size={isTV ? 8 : 12} color="#000" />
              <Text style={{
                color: '#000',
                fontSize: isTV ? 6 : 9,
                fontWeight: '700',
                marginLeft: isTV ? 2 : 4,
                letterSpacing: 0.2,
              }}>
                UPCOMING
              </Text>
            </View>
          ) : null}

          {/* Rating badge */}
          {item.vote_average && item.vote_average > 0 ? (
            <View style={{
              position: 'absolute',
              bottom: isTV ? 4 : 8,
              right: isTV ? 4 : 8,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              borderRadius: isTV ? 4 : 8,
              paddingHorizontal: isTV ? 4 : 6,
              paddingVertical: isTV ? 1 : 2,
              flexDirection: 'row',
              alignItems: 'center',
            }}>
              <MaterialIcons name="star" size={isTV ? 8 : 10} color="#FFC107" />
              <Text style={{
                color: '#fff',
                fontSize: isTV ? 7 : 9,
                fontWeight: '600',
                marginLeft: isTV ? 1 : 2,
              }}>
                {item.vote_average.toFixed(1)}
              </Text>
            </View>
          ) : null}

          {/* Gradient overlay for better text readability */}
          <LinearGradient
            colors={['transparent', 'rgba(0, 0, 0, 0.6)']}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: isTV ? 20 : 40,
            }}
          />
        </View>

        {!isTV && (
          <View style={{ paddingHorizontal: 4, marginTop: 8 }}>
            <Text style={{
              color: '#fff',
              fontSize: titleFontSize,
              fontWeight: '700',
              lineHeight: 16,
              letterSpacing: 0.1,
            }} numberOfLines={2}>
              {item.title || 'Unknown Title'}
            </Text>

            {item.character ? (
              <Text style={{
                color: 'rgba(255, 255, 255, 0.65)',
                fontSize: characterFontSize,
                marginTop: 3,
                fontWeight: '500',
              }} numberOfLines={1}>
                as {item.character}
              </Text>
            ) : null}

            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: 4,
              justifyContent: 'space-between',
            }}>
              {item.release_date ? (
                <Text style={{
                  color: 'rgba(255, 255, 255, 0.5)',
                  fontSize: yearFontSize,
                  fontWeight: '600',
                  letterSpacing: 0.3,
                }}>
                  {new Date(item.release_date).getFullYear()}
                </Text>
              ) : null}

              {item.isUpcoming ? (
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                }}>
                  <MaterialIcons name="schedule" size={10} color="rgba(255, 193, 7, 0.8)" />
                  <Text style={{
                    color: 'rgba(255, 193, 7, 0.8)',
                    fontSize: 9,
                    fontWeight: '600',
                    marginLeft: 2,
                    letterSpacing: 0.2,
                  }}>
                    Coming Soon
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        )}
      </>
    );

    if (isTV) {
      return (
        <View
          style={{
            width: posterWidth,
            marginBottom: isTV ? 8 : 12,
            marginRight: (index + 1) % numColumns === 0 ? 0 : itemSpacing,
          }}
        >
          <Focusable
            onPress={() => handleMoviePress(item)}
            onFocus={() => handleItemFocus(index)}
            autoFocus={isFirstItem}
            borderRadius={posterBorderRadius}
            focusScale={1.05}
            showFocusBorder={true}
            style={{
              width: posterWidth,
              height: posterHeight,
              borderRadius: posterBorderRadius,
              overflow: 'hidden',
            }}
          >
            {item.poster_path ? (
              <FastImage
                source={{
                  uri: `https://image.tmdb.org/t/p/w342${item.poster_path}`,
                }}
                style={{ width: '100%', height: '100%' }}
                resizeMode={FastImage.resizeMode.cover}
              />
            ) : (
              <View style={{
                width: '100%',
                height: '100%',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
              }}>
                <MaterialIcons name="movie" size={24} color="rgba(255, 255, 255, 0.2)" />
              </View>
            )}

            {/* Upcoming indicator */}
            {item.isUpcoming ? (
              <View style={{
                position: 'absolute',
                top: 4,
                left: 4,
                backgroundColor: 'rgba(255, 193, 7, 0.95)',
                borderRadius: 8,
                paddingHorizontal: 4,
                paddingVertical: 2,
                flexDirection: 'row',
                alignItems: 'center',
              }}>
                <MaterialIcons name="schedule" size={8} color="#000" />
                <Text style={{
                  color: '#000',
                  fontSize: 6,
                  fontWeight: '700',
                  marginLeft: 2,
                  letterSpacing: 0.2,
                }}>
                  UPCOMING
                </Text>
              </View>
            ) : null}

            {/* Rating badge */}
            {item.vote_average && item.vote_average > 0 ? (
              <View style={{
                position: 'absolute',
                bottom: 6,
                right: 6,
                backgroundColor: 'rgba(0, 0, 0, 0.85)',
                borderRadius: 6,
                paddingHorizontal: 6,
                paddingVertical: 3,
                flexDirection: 'row',
                alignItems: 'center',
              }}>
                <MaterialIcons name="star" size={12} color="#FFC107" />
                <Text style={{
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: '600',
                  marginLeft: 2,
                }}>
                  {item.vote_average.toFixed(1)}
                </Text>
              </View>
            ) : null}
          </Focusable>
        </View>
      );
    }

    return (
      <Animated.View
        entering={FadeIn.delay(Math.min(index * 30, 500)).springify()}
        style={{
          width: posterWidth,
          marginBottom: 20,
          marginRight: (index + 1) % numColumns === 0 ? 0 : itemSpacing,
        }}
      >
        <TouchableOpacity
          onPress={() => handleMoviePress(item)}
          activeOpacity={0.85}
          style={{
            shadowColor: '#000',
            shadowOffset: {
              width: 0,
              height: 4,
            },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          {posterContent}
        </TouchableOpacity>
      </Animated.View>
    );
  }, [posterWidth, posterHeight, numColumns, itemSpacing, isTV, handleMoviePress, handleItemFocus]);

  const movieCount = movies.filter(m => m.media_type === 'movie').length;
  const tvCount = movies.filter(m => m.media_type === 'tv').length;
  const upcomingCount = movies.filter(m => m.isUpcoming).length;

  // Animated header style
  const headerAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, 100],
      [1, 0.9],
      Extrapolate.CLAMP
    );
    
    return {
      opacity,
    };
  });

  return (
    <View style={{ flex: 1, backgroundColor: currentTheme.colors.darkBackground }}>
      {/* Minimal Header */}
      <Animated.View
        style={[
          {
            paddingTop: isTV ? 12 : safeAreaTop + 16,
            paddingHorizontal: horizontalPadding,
            paddingBottom: isTV ? 8 : 20,
            backgroundColor: currentTheme.colors.darkBackground,
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(255, 255, 255, 0.05)',
          },
          headerAnimatedStyle
        ]}
      >
        <Animated.View
          entering={SlideInDown.delay(100)}
          style={{ flexDirection: 'row', alignItems: 'center' }}
        >
          {!isTV && (
            <TouchableOpacity
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: 16,
              }}
              onPress={handleBack}
              activeOpacity={0.8}
            >
              <MaterialIcons name="arrow-back" size={20} color="rgba(255, 255, 255, 0.9)" />
            </TouchableOpacity>
          )}
          
          <View style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            overflow: 'hidden',
            marginRight: 16,
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
          }}>
            {castMember?.profile_path ? (
              <FastImage
                source={{
                  uri: `https://image.tmdb.org/t/p/w185${castMember.profile_path}`,
                }}
                style={{ width: '100%', height: '100%' }}
                resizeMode={FastImage.resizeMode.cover}
              />
            ) : (
              <View style={{
                width: '100%',
                height: '100%',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Text style={{
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontSize: 14,
                  fontWeight: '700',
                }}>
                  {castMember?.name ? castMember.name.split(' ').reduce((prev: string, current: string) => prev + current[0], '').substring(0, 2) : 'NA'}
                </Text>
              </View>
            )}
          </View>
          
          <View style={{ flex: 1 }}>
            <Text style={{
              color: '#fff',
              fontSize: 18,
              fontWeight: '800',
              letterSpacing: 0.3,
              marginBottom: 2,
            }} numberOfLines={1}>
              {castMember?.name || 'Unknown'}
            </Text>
            <Text style={{
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: 13,
              fontWeight: '500',
              letterSpacing: 0.2,
            }}>
              {`Filmography • ${movies.length} titles`}
            </Text>
          </View>
        </Animated.View>
      </Animated.View>

      {/* Filters and Sort */}
      <View style={{
        paddingHorizontal: horizontalPadding,
        paddingVertical: isTV ? 8 : 12,
        backgroundColor: currentTheme.colors.darkBackground,
      }}>
        {/* Filter Section */}
        <View style={{ marginBottom: isTV ? 12 : 12 }}>
          <Text style={{
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: isTV ? 12 : 12,
            fontWeight: '600',
            marginBottom: isTV ? 6 : 8,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
          }}>
            Filter
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: horizontalPadding, paddingVertical: isTV ? 3 : 0 }}
          >
            {renderFilterButton('all', 'All', movies.length)}
            {renderFilterButton('movies', 'Movies', movieCount)}
            {renderFilterButton('tv', 'TV Shows', tvCount)}
          </ScrollView>
        </View>

        {/* Sort Section */}
        <View>
          <Text style={{
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: isTV ? 12 : 12,
            fontWeight: '600',
            marginBottom: isTV ? 6 : 8,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
          }}>
            Sort By
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: horizontalPadding, paddingVertical: isTV ? 3 : 0 }}
          >
            {renderSortButton('popularity', 'Popular', 'trending-up')}
            {renderSortButton('latest', 'Latest', 'schedule')}
            {renderSortButton('upcoming', 'Upcoming', 'event')}
          </ScrollView>
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <ActivityIndicator size="large" color={currentTheme.colors.primary} />
          <Text style={{
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: 14,
            marginTop: 12,
            fontWeight: '500',
          }}>
            Loading filmography...
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={displayedMovies}
          renderItem={renderMovieItem}
          keyExtractor={(item) => `${item.media_type}-${item.id}`}
          numColumns={numColumns}
          key={numColumns}
          contentContainerStyle={{
            paddingHorizontal: horizontalPadding,
            paddingTop: isTV ? 8 : 8,
            paddingBottom: isTV ? 24 : (Platform.OS === 'ios' ? 120 : 100),
          }}
          onScroll={(event) => {
            scrollY.value = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={32}
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.8}
          removeClippedSubviews={true}
          initialNumToRender={isTV ? 16 : 24}
          maxToRenderPerBatch={isTV ? 8 : 12}
          windowSize={isTV ? 3 : 5}
          onScrollToIndexFailed={(info) => {
            // Handle scroll to index failure gracefully
            setTimeout(() => {
              if (flatListRef.current && displayedMovies.length > 0) {
                flatListRef.current.scrollToIndex({
                  index: Math.min(info.index, displayedMovies.length - 1),
                  animated: false,
                });
              }
            }, 100);
          }}
          ListFooterComponent={
            displayLimit < filteredAndSortedMovies.length ? (
              <View style={{
                paddingVertical: 20,
                alignItems: 'center',
              }}>
                {isLoadingMore ? (
                  <ActivityIndicator size="small" color={currentTheme.colors.primary} />
                ) : isTV ? (
                  <Focusable
                    onPress={handleLoadMore}
                    borderRadius={20}
                    focusScale={1.1}
                    showFocusBorder={true}
                  >
                    <View
                      style={{
                        paddingHorizontal: 24,
                        paddingVertical: 12,
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: 20,
                        borderWidth: 1,
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                      }}
                    >
                      <Text style={{
                        color: 'rgba(255, 255, 255, 0.8)',
                        fontSize: 16,
                        fontWeight: '600',
                      }}>
                        {`Load More (${filteredAndSortedMovies.length - displayLimit} remaining)`}
                      </Text>
                    </View>
                  </Focusable>
                ) : (
                  <TouchableOpacity
                    style={{
                      paddingHorizontal: 20,
                      paddingVertical: 10,
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                    }}
                    onPress={handleLoadMore}
                    activeOpacity={0.7}
                  >
                    <Text style={{
                      color: 'rgba(255, 255, 255, 0.8)',
                      fontSize: 14,
                      fontWeight: '600',
                    }}>
                      {`Load More (${filteredAndSortedMovies.length - displayLimit} remaining)`}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null
          }
          ListEmptyComponent={
            <Animated.View 
              entering={FadeIn.delay(400)}
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 80,
                paddingHorizontal: 40,
              }}
            >
              <View style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
              }}>
                <MaterialIcons name="movie" size={40} color="rgba(255, 255, 255, 0.3)" />
              </View>
              <Text style={{
                color: 'rgba(255, 255, 255, 0.8)',
                fontSize: 18,
                fontWeight: '700',
                marginBottom: 8,
                textAlign: 'center',
              }}>
                No Content Found
              </Text>
              <Text style={{
                color: 'rgba(255, 255, 255, 0.5)',
                fontSize: 14,
                textAlign: 'center',
                lineHeight: 20,
                fontWeight: '500',
              }}>
                {sortBy === 'upcoming' 
                  ? 'No upcoming releases available for this actor'
                  : selectedFilter === 'all' 
                    ? 'No content available for this actor'
                    : selectedFilter === 'movies'
                      ? 'No movies available for this actor'
                      : 'No TV shows available for this actor'
                }
              </Text>
            </Animated.View>
          }
        />
      )}

      {/* Inject CustomAlert component to display errors */}
      <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        actions={alertActions}
        onClose={() => setAlertVisible(false)}
      />
    </View>
  );
};

export default CastMoviesScreen;

