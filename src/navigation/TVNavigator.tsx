import React, { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, BackHandler } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TVSideRail } from '../components/tv/TVSideRail';
import { useTheme } from '../contexts/ThemeContext';
import { RootStackParamList } from './AppNavigator';
import { TVFocusProvider, useTVFocus } from '../contexts/TVFocusContext';

// Import screens
import HomeScreen from '../screens/HomeScreen';
import LibraryScreen from '../screens/LibraryScreen';
import SearchScreen from '../screens/SearchScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SupportProjectScreen from '../screens/SupportProjectScreen';

type ScreenKey = 'Home' | 'Library' | 'Search' | 'Settings' | 'SupportProject';

interface ScreenConfig {
  component: React.ComponentType<any>;
  name: ScreenKey;
}

const SCREENS: Record<ScreenKey, ScreenConfig> = {
  Home: { component: HomeScreen, name: 'Home' },
  Library: { component: LibraryScreen, name: 'Library' },
  Search: { component: SearchScreen, name: 'Search' },
  Settings: { component: SettingsScreen, name: 'Settings' },
  SupportProject: { component: SupportProjectScreen, name: 'SupportProject' },
};

/**
 * Inner TV navigator component that uses the focus context
 */
const TVNavigatorInner: React.FC = () => {
  const { currentTheme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [activeScreen, setActiveScreen] = useState<ScreenKey>('Home');
  const [screenHistory, setScreenHistory] = useState<ScreenKey[]>(['Home']);
  const { lastFocusedRowRef } = useTVFocus();

  // Handle navigation between main sections
  const handleNavigate = useCallback((screen: string) => {
    const screenKey = screen as ScreenKey;
    if (screenKey !== activeScreen && SCREENS[screenKey]) {
      setActiveScreen(screenKey);
      setScreenHistory((prev) => [...prev, screenKey]);
    }
  }, [activeScreen]);

  // Handle hardware back button
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (screenHistory.length > 1) {
          // Go to previous screen in history
          const newHistory = [...screenHistory];
          newHistory.pop();
          const previousScreen = newHistory[newHistory.length - 1];
          setActiveScreen(previousScreen);
          setScreenHistory(newHistory);
          return true;
        }
        // Let default behavior handle (exit app or go back in stack)
        return false;
      };

      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        onBackPress
      );

      return () => subscription.remove();
    }, [screenHistory])
  );

  // Get the active screen component
  const ActiveScreenComponent = useMemo(() => {
    return SCREENS[activeScreen]?.component || HomeScreen;
  }, [activeScreen]);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: currentTheme.colors.darkBackground },
      ]}
    >
      <TVSideRail
        activeScreen={activeScreen}
        onNavigate={handleNavigate}
        firstContentRef={lastFocusedRowRef}
      >
        <View style={styles.screenContainer}>
          <ActiveScreenComponent />
        </View>
      </TVSideRail>
    </View>
  );
};

/**
 * TV-specific navigator with side rail navigation
 * Replaces bottom tab navigation on Android TV devices
 */
export const TVNavigator: React.FC = () => {
  return (
    <TVFocusProvider>
      <TVNavigatorInner />
    </TVFocusProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screenContainer: {
    flex: 1,
  },
});

export default TVNavigator;
