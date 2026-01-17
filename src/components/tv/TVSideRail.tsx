import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  BackHandler,
  Image,
  findNodeHandle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Focusable } from './Focusable';
import { useTheme } from '../../contexts/ThemeContext';
import { useTVFocus } from '../../contexts/TVFocusContext';

// Nuvio logo
const NuvioLogo = require('../../assets/IMG_0762.png');

export interface NavItem {
  key: string;
  icon: string;
  iconLibrary: 'feather' | 'ionicons';
  label: string;
  screen: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'home', icon: 'home', iconLibrary: 'feather', label: 'Home', screen: 'Home' },
  { key: 'search', icon: 'search', iconLibrary: 'feather', label: 'Search', screen: 'Search' },
  { key: 'library', icon: 'library', iconLibrary: 'ionicons', label: 'Library', screen: 'Library' },
  { key: 'settings', icon: 'settings', iconLibrary: 'feather', label: 'Settings', screen: 'Settings' },
  { key: 'support', icon: 'heart', iconLibrary: 'feather', label: 'Support Project', screen: 'SupportProject' },
];

const COLLAPSED_WIDTH = 60;
const EXPANDED_WIDTH = 280;

interface TVSideRailProps {
  /** Currently active screen key */
  activeScreen: string;
  /** Callback when navigation item is selected */
  onNavigate: (screen: string) => void;
  /** Content to render in the main area */
  children: React.ReactNode;
  /** Called when focus enters the rail */
  onRailFocus?: () => void;
  /** Called when focus leaves the rail */
  onRailBlur?: () => void;
  /** Ref to the first focusable content item (for nextFocusRight from menu) */
  firstContentRef?: React.RefObject<View> | React.MutableRefObject<View | null>;
}

/**
 * Netflix/YouTube style side rail navigation for TV
 * Collapses to icons when not focused, expands to show labels when focused
 */
export const TVSideRail: React.FC<TVSideRailProps> = ({
  activeScreen,
  onNavigate,
  children,
  onRailFocus,
  onRailBlur,
  firstContentRef,
}) => {
  const { currentTheme } = useTheme();
  const { setMenuFirstItemView } = useTVFocus();
  const insets = useSafeAreaInsets();
  const [isExpanded, setIsExpanded] = useState(false);
  const [railHasFocus, setRailHasFocus] = useState(false);

  // Use Reanimated shared values for UI-thread animations (much smoother on TV)
  const widthAnim = useSharedValue(COLLAPSED_WIDTH);
  const gradientWidthAnim = useSharedValue(0);
  const gradientOpacityAnim = useSharedValue(0);

  // Create stable refs for each nav item's underlying View
  const navItemViewRefs = useMemo(() =>
    NAV_ITEMS.map(() => React.createRef<View>()),
    []
  );

  // Store resolved node handles for directional focus
  const [navItemHandles, setNavItemHandles] = useState<(number | null)[]>([]);

  // Resolve all nav item handles after mount and expose first item to context
  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      // Resolve all nav item handles
      const handles = navItemViewRefs.map(ref => {
        if (ref.current) {
          return findNodeHandle(ref.current);
        }
        return null;
      });
      setNavItemHandles(handles);

      // Expose the first nav item view (Home) to the context
      if (navItemViewRefs[0]?.current) {
        setMenuFirstItemView(navItemViewRefs[0].current);
      }
    });
    return () => cancelAnimationFrame(frameId);
  }, [navItemViewRefs, setMenuFirstItemView]);


  // Fast animation config for responsive TV feel
  const animConfig = { duration: 100, easing: Easing.out(Easing.ease) };

  // Animate rail width and gradient on expand/collapse using Reanimated (UI thread)
  useEffect(() => {
    widthAnim.value = withTiming(isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH, animConfig);
    gradientWidthAnim.value = withTiming(isExpanded ? 350 : 0, animConfig);
    gradientOpacityAnim.value = withTiming(isExpanded ? 1 : 0, animConfig);
  }, [isExpanded]);

  // Animated styles for UI-thread rendering
  const animatedRailStyle = useAnimatedStyle(() => ({
    width: widthAnim.value,
  }));

  const animatedGradientStyle = useAnimatedStyle(() => ({
    width: gradientWidthAnim.value,
    opacity: gradientOpacityAnim.value,
  }));

  // Handle back button to collapse rail or go back
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isExpanded && railHasFocus) {
        // If rail is expanded and focused, collapse it
        setIsExpanded(false);
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [isExpanded, railHasFocus]);

  // Track if we're currently focused on any rail item
  const focusedItemRef = useRef<number | null>(null);
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleItemFocus = useCallback(
    (index: number) => {
      // Clear any pending blur timeout since we're still in the rail
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }

      const wasAlreadyFocused = focusedItemRef.current !== null;
      focusedItemRef.current = index;

      // Only update state if not already in focused/expanded state
      // This prevents re-renders when moving between items within the rail
      if (!wasAlreadyFocused) {
        setRailHasFocus(true);
        setIsExpanded(true);
        onRailFocus?.();
      }
    },
    [onRailFocus]
  );

  const handleItemBlur = useCallback(() => {
    // Use short timeout to check if focus moved to another rail item
    // If another rail item gets focus, the timeout will be cleared
    // Reduced from 300ms to 50ms for faster response
    blurTimeoutRef.current = setTimeout(() => {
      focusedItemRef.current = null;
      setRailHasFocus(false);
      setIsExpanded(false);
      onRailBlur?.();
    }, 50);
  }, [onRailBlur]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  const handleItemPress = useCallback(
    (screen: string) => {
      onNavigate(screen);
      // Move focus to content area after navigation
      setIsExpanded(false);
    },
    [onNavigate]
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Side Rail with gradient background */}
      <Animated.View
        style={[
          styles.sideRail,
          animatedRailStyle,
        ]}
      >
        {/* Gradient background - only visible when expanded */}
        <Animated.View
          style={[
            styles.railGradient,
            animatedGradientStyle,
          ]}
        >
          <LinearGradient
            colors={[
              'rgba(0, 0, 0, 0.95)',
              'rgba(0, 0, 0, 0.85)',
              'rgba(0, 0, 0, 0.6)',
              'rgba(0, 0, 0, 0.3)',
              'transparent',
            ]}
            locations={[0, 0.3, 0.6, 0.85, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* App Logo/Brand at top */}
        <View style={styles.brandContainer}>
          <Image
            source={NuvioLogo}
            style={styles.brandLogo}
            resizeMode="contain"
          />
        </View>

        {/* Navigation Items */}
        <View
          style={styles.navItems}
          // This helps Android TV focus stay within this container
          collapsable={false}
        >
          {NAV_ITEMS.map((item, index) => {
            const isActive = activeScreen === item.screen;
            const isFirst = index === 0;
            const isLast = index === NAV_ITEMS.length - 1;
            return (
              <Focusable
                key={item.key}
                viewRef={navItemViewRefs[index]}
                onPress={() => handleItemPress(item.screen)}
                onFocus={() => handleItemFocus(index)}
                onBlur={handleItemBlur}
                style={styles.navItem}
                borderRadius={8}
                focusScale={1.0}
                animateBackground={false}
                showFocusBorder={true}
                blockUp={isFirst}
                blockDown={isLast}
                blockLeft={true}
                nextFocusUpId={!isFirst && navItemHandles[index - 1] ? navItemHandles[index - 1] : undefined}
                nextFocusDownId={!isLast && navItemHandles[index + 1] ? navItemHandles[index + 1] : undefined}
              >
                {(focused) => {
                  const iconColor = focused
                    ? '#FFFFFF'
                    : isActive
                    ? currentTheme.colors.primary
                    : currentTheme.colors.text;

                  const IconComponent = item.iconLibrary === 'ionicons' ? Ionicons : Feather;

                  return (
                  <>
                    <View style={styles.navItemContent}>
                      <View style={styles.iconContainer}>
                        <IconComponent
                          name={item.icon as any}
                          size={22}
                          color={iconColor}
                        />
                      </View>
                      {isExpanded && (
                        <Animated.Text
                          style={[
                            styles.navLabel,
                            {
                              color: focused
                                ? '#FFFFFF'
                                : isActive
                                ? currentTheme.colors.primary
                                : currentTheme.colors.text,
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {item.label}
                        </Animated.Text>
                      )}
                    </View>
                    {/* Active indicator - hide when focused */}
                    {isActive && !focused && (
                      <View
                        style={[
                          styles.activeIndicator,
                          { backgroundColor: currentTheme.colors.primary },
                        ]}
                      />
                    )}
                  </>
                  );
                }}
              </Focusable>
            );
          })}
        </View>
      </Animated.View>

      {/* Main Content Area - offset by collapsed menu width so content is not behind menu */}
      <View style={[styles.content, { paddingBottom: insets.bottom, paddingLeft: COLLAPSED_WIDTH }]}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sideRail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    height: '100%',
    paddingVertical: 20,
    zIndex: 100,
  },
  railGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  brandContainer: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  brandLogo: {
    width: 44,
    height: 44,
  },
  navItems: {
    flex: 1,
    paddingHorizontal: 4,
  },
  navItem: {
    height: 44,
    borderRadius: 8,
    marginBottom: 4,
    justifyContent: 'center',
    overflow: 'visible',
  },
  navItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: COLLAPSED_WIDTH - 8,  // 52px (accounting for navItems paddingHorizontal: 4)
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabel: {
    fontSize: 18,
    fontWeight: '500',
    marginLeft: 16,
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    top: '20%',
    bottom: '20%',
    width: 4,
    borderRadius: 2,
  },
  content: {
    flex: 1,
  },
});

export default TVSideRail;
