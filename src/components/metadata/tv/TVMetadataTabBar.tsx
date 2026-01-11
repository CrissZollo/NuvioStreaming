import React, { useRef, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '../../../contexts/ThemeContext';
import { Focusable } from '../../tv/Focusable';

export interface Tab {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
}

interface TVMetadataTabBarProps {
  tabs: Tab[];
  activeTab: string | null;
  onTabChange: (tabId: string) => void;
  firstTabRef: React.RefObject<View>;
  activeTabRef: React.RefObject<View>;
  playButtonRef: React.RefObject<View>;
  firstContentItemRef: React.RefObject<View>;
}

const TVMetadataTabBarComponent: React.FC<TVMetadataTabBarProps> = ({
  tabs,
  activeTab,
  onTabChange,
  firstTabRef,
  activeTabRef,
  playButtonRef,
  firstContentItemRef,
}) => {
  const { currentTheme } = useTheme();

  // Create refs for all tabs
  const tabRefs = useRef<Map<string, React.RefObject<View>>>(new Map());

  const getTabRef = useCallback((tabId: string) => {
    if (!tabRefs.current.has(tabId)) {
      tabRefs.current.set(tabId, React.createRef<View>());
    }
    return tabRefs.current.get(tabId)!;
  }, []);

  // Get adjacent tab refs for navigation
  const getAdjacentTabRef = useCallback((tabId: string, direction: 'left' | 'right') => {
    const currentIndex = tabs.findIndex(t => t.id === tabId);
    if (direction === 'left' && currentIndex > 0) {
      return getTabRef(tabs[currentIndex - 1].id);
    }
    if (direction === 'right' && currentIndex < tabs.length - 1) {
      return getTabRef(tabs[currentIndex + 1].id);
    }
    return undefined;
  }, [tabs, getTabRef]);

  return (
    <Animated.View
      style={styles.container}
      entering={FadeIn.duration(300)}
    >
      {tabs.map((tab, index) => {
        const isFirst = index === 0;
        const isLast = index === tabs.length - 1;
        const isActive = tab.id === activeTab;
        const tabRef = getTabRef(tab.id);

        // Use activeTabRef for the active tab so content can navigate back to it
        // Use firstTabRef for the first tab (for initial focus scenarios)
        const refToUse = isActive ? activeTabRef : (isFirst ? firstTabRef : tabRef);

        return (
          <Focusable
            key={tab.id}
            viewRef={refToUse}
            onPress={() => onTabChange(tab.id)}
            onFocus={() => onTabChange(tab.id)}
            style={styles.tab}
            focusScale={1.0}
            borderRadius={0}
            animateBackground={false}
            showFocusBorder={false}
            blockLeft={isFirst}
            blockRight={isLast}
            blockDown={false}
            nextFocusLeft={!isFirst ? getAdjacentTabRef(tab.id, 'left') : undefined}
            nextFocusRight={!isLast ? getAdjacentTabRef(tab.id, 'right') : undefined}
            nextFocusUp={playButtonRef}
            nextFocusDown={firstContentItemRef}
          >
            {(focused) => (
              <View style={[
                styles.tabInner,
                focused && styles.tabInnerFocused,
              ]}>
                <Text
                  style={[
                    styles.tabText,
                    { color: isActive || focused ? currentTheme.colors.highEmphasis : currentTheme.colors.textMuted },
                    (isActive || focused) && styles.activeTabText,
                  ]}
                >
                  {tab.label}
                </Text>
                {/* Active/Focus indicator */}
                <View
                  style={[
                    styles.tabIndicator,
                    {
                      backgroundColor: currentTheme.colors.primary,
                      opacity: isActive || focused ? 1 : 0,
                    },
                  ]}
                />
              </View>
            )}
          </Focusable>
        );
      })}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingTop: 40,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  tab: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginRight: 32,
  },
  tabInner: {
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  tabInnerFocused: {
    // Additional styling when focused handled by Focusable animateBackground
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  activeTabText: {
    fontWeight: '700',
  },
  tabIndicator: {
    height: 3,
    width: '100%',
    marginTop: 8,
    borderRadius: 1.5,
  },
});

export const TVMetadataTabBar = memo(TVMetadataTabBarComponent);
