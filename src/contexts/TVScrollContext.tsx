import React, { createContext, useContext, useCallback } from 'react';
import { View, Dimensions } from 'react-native';
import Animated, { SharedValue } from 'react-native-reanimated';

interface TVScrollContextType {
  /** Scroll to center a focused element */
  scrollToElement: (elementRef: React.RefObject<View>) => void;
}

const TVScrollContext = createContext<TVScrollContextType | null>(null);

interface TVScrollProviderProps {
  children: React.ReactNode;
  scrollViewRef: React.RefObject<Animated.ScrollView>;
  scrollY?: SharedValue<number>;
}

export const TVScrollProvider: React.FC<TVScrollProviderProps> = ({
  children,
  scrollViewRef,
  scrollY
}) => {
  const screenHeight = Dimensions.get('window').height;

  const scrollToElement = useCallback((elementRef: React.RefObject<View>) => {
    if (!scrollViewRef?.current || !elementRef?.current) return;

    // Measure the element's position relative to the window
    elementRef.current.measureInWindow((x, y, width, height) => {
      if (y === undefined || height === undefined) return;

      // Calculate where we need to scroll to center the element
      const elementCenter = y + height / 2;
      const screenCenter = screenHeight / 2;
      const offsetFromCenter = elementCenter - screenCenter;

      // Only scroll if element is significantly off-center (more than 80px)
      if (Math.abs(offsetFromCenter) > 80) {
        // Get current scroll position from scrollY if available
        const currentScrollY = scrollY?.value ?? 0;
        const targetScrollY = Math.max(0, currentScrollY + offsetFromCenter);

        // Scroll to center the element
        (scrollViewRef.current as any)?.scrollTo?.({
          y: targetScrollY,
          animated: true,
        });
      }
    });
  }, [screenHeight, scrollY, scrollViewRef]);

  return (
    <TVScrollContext.Provider value={{ scrollToElement }}>
      {children}
    </TVScrollContext.Provider>
  );
};

export const useTVScroll = () => {
  const context = useContext(TVScrollContext);
  return context;
};

export default TVScrollContext;
