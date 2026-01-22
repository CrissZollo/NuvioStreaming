import React, { useRef, useCallback, useEffect, memo } from 'react';
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
  onFirstTabReady?: () => void;
}

const TVMetadataTabBarComponent: React.FC<TVMetadataTabBarProps> = ({
  tabs,
  activeTab,
  onTabChange,
  firstTabRef,
  activeTabRef,
  playButtonRef,
  firstContentItemRef,
  onFirstTabReady,
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

  // Sync activeTabRef with the current active tab's ref
  // This allows content to navigate back to whichever tab is currently active
  useEffect(() => {
    if (activeTab) {
      const activeIndex = tabs.findIndex(t => t.id === activeTab);
      if (activeIndex === 0) {
        // First tab uses firstTabRef, so sync activeTabRef to point to same element
        (activeTabRef as React.MutableRefObject<View | null>).current = firstTabRef.current;
      } else {
        const ref = tabRefs.current.get(activeTab);
        if (ref?.current) {
          (activeTabRef as React.MutableRefObject<View | null>).current = ref.current;
        }
      }
    }
  }, [activeTab, tabs, firstTabRef, activeTabRef]);

  // Get adjacent tab refs for navigation
  // Returns the correct ref that the target tab uses as its viewRef
  const getAdjacentTabRef = useCallback((tabId: string, direction: 'left' | 'right') => {
    const currentIndex = tabs.findIndex(t => t.id === tabId);
    if (direction === 'left' && currentIndex > 0) {
      const targetIndex = currentIndex - 1;
      // First tab uses firstTabRef, others use their internal refs
      return targetIndex === 0 ? firstTabRef : getTabRef(tabs[targetIndex].id);
    }
    if (direction === 'right' && currentIndex < tabs.length - 1) {
      const targetIndex = currentIndex + 1;
      // First tab uses firstTabRef, others use their internal refs
      return targetIndex === 0 ? firstTabRef : getTabRef(tabs[targetIndex].id);
    }
    return undefined;
  }, [tabs, getTabRef, firstTabRef]);

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

        // IMPORTANT: Each tab must keep a STABLE ref - don't change refs based on active state
        // Changing refs during focus causes React Native's native focus system to lose track
        // First tab always uses firstTabRef (for navigation from action buttons)
        // Other tabs use their internal refs
        // We update activeTabRef manually when tabs change (see useEffect below)
        const refToUse = isFirst ? firstTabRef : tabRef;

        return (
          <Focusable
            key={tab.id}
            viewRef={refToUse}
            onPress={() => onTabChange(tab.id)}
            onFocus={() => onTabChange(tab.id)}
            style={styles.tab}
            focusScale={1.0}
            borderRadius={8}
            animateBackground={false}
            showFocusBorder={true}
            blockLeft={isFirst}
            blockRight={isLast}
            blockDown={false}
            nextFocusLeft={!isFirst ? getAdjacentTabRef(tab.id, 'left') : undefined}
            nextFocusRight={!isLast ? getAdjacentTabRef(tab.id, 'right') : undefined}
            nextFocusUp={playButtonRef}
            nextFocusDown={firstContentItemRef}
            onLayout={isFirst ? onFirstTabReady : undefined}
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
    paddingTop: 24,
    paddingBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  tab: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginRight: 24,
  },
  tabInner: {
    alignItems: 'center',
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  tabInnerFocused: {
    // Additional styling when focused handled by Focusable animateBackground
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  tabIndicator: {
    height: 2,
    width: '100%',
    marginTop: 4,
    borderRadius: 1,
  },
});

export const TVMetadataTabBar = memo(TVMetadataTabBarComponent);
