import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  StatusBar,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeIn,
  FadeInUp,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
  runOnJS,
  SharedValue,
} from 'react-native-reanimated';
import { useTheme } from '../contexts/ThemeContext';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { mmkvStorage } from '../services/mmkvStorage';
import { useIsTV } from '../contexts/TVContext';
import { Focusable } from '../components/tv/Focusable';
import QRCode from 'react-native-qrcode-svg';

const { width, height } = Dimensions.get('window');

const SPRING_CONFIG = {
  damping: 20,
  stiffness: 90,
  mass: 0.8,
};

interface OnboardingSlide {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  isDonationSlide?: boolean;
}

const onboardingData: OnboardingSlide[] = [
  {
    id: '1',
    title: 'Welcome to\nNuvio',
    subtitle: 'Your Ultimate Content Hub',
    description: 'Discover, organize, and manage your favorite movies and TV shows from multiple sources in one beautiful app.',
  },
  {
    id: '2',
    title: 'Powerful\nAddons',
    subtitle: 'Extend Your Experience',
    description: 'Install addons to access content from various platforms and services. Choose what works best for you.',
  },
  {
    id: '3',
    title: 'Smart\nDiscovery',
    subtitle: 'Find What You Love',
    description: 'Browse trending content, search across all your sources, and get personalized recommendations.',
  },
  {
    id: '4',
    title: 'Your\nLibrary',
    subtitle: 'Track & Organize',
    description: 'Save favorites, track your progress, and sync with Trakt to keep everything organized across devices.',
  },
];

// TV-specific slide with donation info
const tvDonationSlide: OnboardingSlide = {
  id: '5',
  title: 'Support\nDevelopment',
  subtitle: 'Help Keep This Project Alive',
  description: 'I ported Nuvio to Android TV and continue improving it in my free time. If you enjoy using it on your TV, please consider supporting the development.',
  isDonationSlide: true,
};

const KOFI_URL = 'https://ko-fi.com/crisszollo';

// Animated Slide Component with parallax
const AnimatedSlide = ({
  item,
  index,
  scrollX,
  isTV = false,
}: {
  item: OnboardingSlide;
  index: number;
  scrollX: SharedValue<number>;
  isTV?: boolean;
}) => {
  const inputRange = [(index - 1) * width, index * width, (index + 1) * width];

  const titleStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      scrollX.value,
      inputRange,
      [width * 0.3, 0, -width * 0.3],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0, 1, 0],
      Extrapolation.CLAMP
    );
    const scale = interpolate(
      scrollX.value,
      inputRange,
      [0.8, 1, 0.8],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ translateX }, { scale }],
      opacity,
    };
  });

  const subtitleStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      scrollX.value,
      inputRange,
      [width * 0.5, 0, -width * 0.5],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0, 1, 0],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ translateX }],
      opacity,
    };
  });

  const descriptionStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      scrollX.value,
      inputRange,
      [width * 0.7, 0, -width * 0.7],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0, 1, 0],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ translateX }],
      opacity,
    };
  });

  const qrStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0, 1, 0],
      Extrapolation.CLAMP
    );
    const scale = interpolate(
      scrollX.value,
      inputRange,
      [0.8, 1, 0.8],
      Extrapolation.CLAMP
    );
    return {
      opacity,
      transform: [{ scale }],
    };
  });

  // Donation slide layout for TV
  if (item.isDonationSlide && isTV) {
    return (
      <View style={styles.slide}>
        <View style={styles.donationContainer}>
          {/* Left side - Text content */}
          <View style={styles.donationTextContainer}>
            <Animated.Text style={[styles.title, styles.donationTitle, titleStyle]}>
              {item.title}
            </Animated.Text>

            <Animated.Text style={[styles.subtitle, styles.donationSubtitle, subtitleStyle]}>
              {item.subtitle}
            </Animated.Text>

            <Animated.Text style={[styles.description, styles.donationDescription, descriptionStyle]}>
              {item.description}
            </Animated.Text>

            <Animated.Text style={[styles.donationNote, descriptionStyle]}>
              Scan the QR code with your phone to donate
            </Animated.Text>
          </View>

          {/* Right side - QR Code */}
          <Animated.View style={[styles.qrContainer, qrStyle]}>
            <View style={styles.qrWrapper}>
              <QRCode
                value={KOFI_URL}
                size={180}
                color="#0A0A0A"
                backgroundColor="#FFFFFF"
              />
            </View>
            <Text style={styles.qrLabel}>ko-fi.com/crisszollo</Text>
          </Animated.View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.slide}>
      <View style={styles.textContainer}>
        <Animated.Text style={[styles.title, titleStyle]}>
          {item.title}
        </Animated.Text>

        <Animated.Text style={[styles.subtitle, subtitleStyle]}>
          {item.subtitle}
        </Animated.Text>

        <Animated.Text style={[styles.description, descriptionStyle]}>
          {item.description}
        </Animated.Text>
      </View>
    </View>
  );
};

const OnboardingScreen = () => {
  const { currentTheme } = useTheme();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<Animated.FlatList<OnboardingSlide>>(null);
  const scrollX = useSharedValue(0);
  const isTV = useIsTV();

  // Use TV-specific slides with donation slide appended
  const slides = isTV ? [...onboardingData, tvDonationSlide] : onboardingData;

  const updateIndex = (index: number) => {
    setCurrentIndex(index);
  };

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
    onMomentumEnd: (event) => {
      const slideIndex = Math.round(event.contentOffset.x / width);
      runOnJS(updateIndex)(slideIndex);
    },
  });

  const progressStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      scrollX.value,
      [0, (slides.length - 1) * width],
      [0, 100],
      Extrapolation.CLAMP
    );
    return {
      width: `${progress}%`,
    };
  });

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      const nextIndex = currentIndex + 1;
      flatListRef.current?.scrollToOffset({
        offset: nextIndex * width,
        animated: true
      });
    } else {
      handleGetStarted();
    }
  };

  const handleSkip = () => {
    (async () => {
      try {
        await mmkvStorage.setItem('hasCompletedOnboarding', 'true');
        await mmkvStorage.setItem('showLoginHintToastOnce', 'true');
      } catch { }
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
    })();
  };

  const handleGetStarted = async () => {
    try {
      await mmkvStorage.setItem('hasCompletedOnboarding', 'true');
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
    } catch (error) {
      if (__DEV__) console.error('Error saving onboarding status:', error);
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
    }
  };

  const renderSlide = ({ item, index }: { item: OnboardingSlide; index: number }) => (
    <AnimatedSlide item={item} index={index} scrollX={scrollX} isTV={isTV} />
  );

  // Animated pagination dots
  const PaginationDot = ({ index }: { index: number }) => {
    const dotStyle = useAnimatedStyle(() => {
      const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
      const dotWidth = interpolate(
        scrollX.value,
        inputRange,
        [8, 32, 8],
        Extrapolation.CLAMP
      );
      const opacity = interpolate(
        scrollX.value,
        inputRange,
        [0.3, 1, 0.3],
        Extrapolation.CLAMP
      );
      return {
        width: dotWidth,
        opacity,
      };
    });

    return <Animated.View style={[styles.paginationDot, dotStyle]} />;
  };

  // Animated button
  const buttonScale = useSharedValue(1);

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const handlePressIn = () => {
    buttonScale.value = withSpring(0.95, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    buttonScale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" translucent />

      <View style={styles.fullScreenContainer}>
        {/* Header - hidden on TV since skip is in footer */}
        {!isTV && (
          <Animated.View
            entering={FadeIn.delay(300).duration(600)}
            style={styles.header}
          >
            <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>

            {/* Smooth Progress Bar */}
            <View style={styles.progressContainer}>
              <Animated.View style={[styles.progressBar, progressStyle]} />
            </View>
          </Animated.View>
        )}

        {/* TV Progress indicator */}
        {isTV && (
          <View style={styles.tvProgressHeader}>
            <Text style={styles.tvProgressText}>
              {currentIndex + 1} / {slides.length}
            </Text>
          </View>
        )}

        {/* Slides */}
        <Animated.FlatList
          ref={flatListRef}
          data={slides}
          renderItem={renderSlide}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          onScroll={onScroll}
          scrollEventThrottle={16}
          decelerationRate="fast"
          snapToInterval={width}
          snapToAlignment="start"
          bounces={false}
          style={{ flex: 1 }}
          // Disable scroll on TV - navigation is controlled by buttons
          scrollEnabled={!isTV}
          // Prevent FlatList from capturing focus on TV
          focusable={false}
        />

        {/* Footer */}
        <Animated.View
          entering={FadeInUp.delay(500).duration(600)}
          style={styles.footer}
        >
          {/* Smooth Pagination */}
          <View style={styles.pagination}>
            {slides.map((_, index) => (
              <PaginationDot key={index} index={index} />
            ))}
          </View>

          {/* Animated Button - TV compatible */}
          {isTV ? (
            <View style={styles.tvButtonContainer}>
              <Focusable
                onPress={handleSkip}
                style={styles.tvButton}
                borderRadius={16}
                focusScale={1.05}
                showFocusBorder={true}
                animateBackground={false}
              >
                {(focused) => (
                  <Text style={[styles.tvButtonText, focused && styles.tvButtonTextFocused]}>
                    Skip
                  </Text>
                )}
              </Focusable>
              <Focusable
                onPress={handleNext}
                autoFocus
                style={styles.tvButton}
                borderRadius={16}
                focusScale={1.05}
                showFocusBorder={true}
                animateBackground={false}
              >
                {(focused) => (
                  <Text style={[styles.tvButtonText, focused && styles.tvButtonTextFocused]}>
                    {currentIndex === slides.length - 1 ? 'Get Started' : 'Continue'}
                  </Text>
                )}
              </Focusable>
            </View>
          ) : (
            <TouchableOpacity
              onPress={handleNext}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              activeOpacity={1}
            >
              <Animated.View style={[styles.button, buttonStyle]}>
                <Text style={styles.buttonText}>
                  {currentIndex === slides.length - 1 ? 'Get Started' : 'Continue'}
                </Text>
              </Animated.View>
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  fullScreenContainer: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 24) + 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.4)',
  },
  progressContainer: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
    marginLeft: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 1.5,
    backgroundColor: '#FFFFFF',
  },
  slide: {
    width,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  textContainer: {
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 52,
    fontWeight: '800',
    letterSpacing: -2,
    lineHeight: 56,
    marginBottom: 16,
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 17,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 20,
    letterSpacing: 0.3,
  },
  description: {
    fontSize: 15,
    lineHeight: 24,
    color: 'rgba(255, 255, 255, 0.4)',
    maxWidth: 300,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 50 : 32,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    gap: 6,
  },
  paginationDot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  button: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A0A0A',
    letterSpacing: 0.3,
  },
  tvButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  tvButton: {
    paddingVertical: 18,
    paddingHorizontal: 40,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 160,
  },
  tvButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  tvButtonTextFocused: {
    color: '#FFFFFF',
  },
  tvProgressHeader: {
    paddingVertical: 20,
    paddingHorizontal: 48,
    alignItems: 'flex-end',
  },
  tvProgressText: {
    fontSize: 18,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  // Donation slide styles
  donationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 48,
    gap: 60,
  },
  donationTextContainer: {
    flex: 1,
    maxWidth: 500,
  },
  donationTitle: {
    fontSize: 48,
    lineHeight: 52,
  },
  donationSubtitle: {
    fontSize: 18,
    marginBottom: 16,
  },
  donationDescription: {
    fontSize: 16,
    lineHeight: 26,
    maxWidth: 450,
    marginBottom: 24,
  },
  donationNote: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    fontStyle: 'italic',
  },
  qrContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrWrapper: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  qrLabel: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
    letterSpacing: 0.5,
  },
});

export default OnboardingScreen;