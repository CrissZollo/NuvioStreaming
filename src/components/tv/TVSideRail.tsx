import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  BackHandler,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Focusable } from './Focusable';
import { useTheme } from '../../contexts/ThemeContext';

export interface NavItem {
  key: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  screen: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'home', icon: 'home', label: 'Home', screen: 'Home' },
  { key: 'search', icon: 'search', label: 'Search', screen: 'Search' },
  { key: 'library', icon: 'favorite', label: 'Library', screen: 'Library' },
  { key: 'downloads', icon: 'download', label: 'Downloads', screen: 'Downloads' },
  { key: 'settings', icon: 'settings', label: 'Settings', screen: 'Settings' },
];

const COLLAPSED_WIDTH = 80;
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
}) => {
  const { currentTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [isExpanded, setIsExpanded] = useState(false);
  const [railHasFocus, setRailHasFocus] = useState(false);
  const widthAnim = useRef(new Animated.Value(COLLAPSED_WIDTH)).current;
  // Note: Focus navigation between items is handled automatically by React Native TV
  // so we don't need explicit refs for nextFocusUp/nextFocusDown

  // Animate rail width on expand/collapse
  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isExpanded, widthAnim]);

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
      focusedItemRef.current = index;
      setRailHasFocus(true);
      setIsExpanded(true);
      onRailFocus?.();
    },
    [onRailFocus]
  );

  const handleItemBlur = useCallback(() => {
    // Use timeout to check if focus moved to another rail item
    // If another rail item gets focus, the timeout will be cleared
    blurTimeoutRef.current = setTimeout(() => {
      focusedItemRef.current = null;
      setRailHasFocus(false);
      setIsExpanded(false);
      onRailBlur?.();
    }, 150);
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
      {/* Side Rail */}
      <Animated.View
        style={[
          styles.sideRail,
          {
            width: widthAnim,
            backgroundColor: currentTheme.colors.darkBackground,
            borderRightColor: currentTheme.colors.border || 'rgba(255,255,255,0.1)',
          },
        ]}
      >
        {/* App Logo/Brand at top */}
        <View style={styles.brandContainer}>
          <Text style={[styles.brandText, { color: currentTheme.colors.primary }]}>
            {isExpanded ? 'Nuvio' : 'N'}
          </Text>
        </View>

        {/* Navigation Items */}
        <View style={styles.navItems}>
          {NAV_ITEMS.map((item, index) => {
            const isActive = activeScreen === item.screen;
            return (
              <Focusable
                key={item.key}
                onPress={() => handleItemPress(item.screen)}
                onFocus={() => handleItemFocus(index)}
                onBlur={handleItemBlur}
                style={styles.navItem}
                borderRadius={12}
                focusScale={1.05}
              >
                {(focused) => (
                  <>
                    <View style={styles.navItemContent}>
                      <MaterialIcons
                        name={item.icon}
                        size={28}
                        color={
                          focused
                            ? '#0A0A0A'
                            : isActive
                            ? currentTheme.colors.primary
                            : currentTheme.colors.text
                        }
                      />
                      {isExpanded && (
                        <Animated.Text
                          style={[
                            styles.navLabel,
                            {
                              color: focused
                                ? '#0A0A0A'
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
                )}
              </Focusable>
            );
          })}
        </View>
      </Animated.View>

      {/* Main Content Area */}
      <View style={[styles.content, { paddingBottom: insets.bottom }]}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  sideRail: {
    height: '100%',
    borderRightWidth: 1,
    paddingVertical: 20,
    zIndex: 10,
  },
  brandContainer: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  brandText: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  navItems: {
    flex: 1,
    paddingHorizontal: 12,
  },
  navItem: {
    height: 56,
    borderRadius: 12,
    marginBottom: 8,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  navItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
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
