import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { View, Dimensions } from 'react-native';
import Animated, { SharedValue } from 'react-native-reanimated';
import { navLog } from '../utils/navigationDebugLogger';

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
    navLog.perfStart('TVScrollContext.scrollToElement');

    if (!scrollViewRef?.current || !elementRef?.current) {
      navLog.scrollSkipped('TVScrollContext', 'missing refs');
      navLog.perfEnd('TVScrollContext.scrollToElement');
      return;
    }

    // Measure the element's position relative to the window
    elementRef.current.measureInWindow((x, y, width, height) => {
      if (y === undefined || height === undefined) {
        navLog.scrollSkipped('TVScrollContext', 'measurement failed');
        navLog.perfEnd('TVScrollContext.scrollToElement');
        return;
      }

      // Calculate where we need to scroll to center the element
      const elementCenter = y + height / 2;
      const screenCenter = screenHeight / 2;
      const offsetFromCenter = elementCenter - screenCenter;

      navLog.log('SCROLL', 'MEASURE:', {
        elementY: y.toFixed(0),
        elementHeight: height.toFixed(0),
        elementCenter: elementCenter.toFixed(0),
        screenCenter: screenCenter.toFixed(0),
        offsetFromCenter: offsetFromCenter.toFixed(0),
      });

      // Only scroll if element is significantly off-center (more than 80px)
      if (Math.abs(offsetFromCenter) > 80) {
        // Get current scroll position from scrollY if available
        const currentScrollY = scrollY?.value ?? 0;
        const targetScrollY = Math.max(0, currentScrollY + offsetFromCenter);

        navLog.scrollToFocus('TVScrollContext', targetScrollY, currentScrollY);

        // Scroll to center the element
        (scrollViewRef.current as any)?.scrollTo?.({
          y: targetScrollY,
          animated: false,
        });
      } else {
        navLog.scrollSkipped('TVScrollContext', `offset ${offsetFromCenter.toFixed(0)}px within 80px threshold`);
      }

      navLog.perfEnd('TVScrollContext.scrollToElement');
    });
  }, [screenHeight, scrollY, scrollViewRef]);

  // Memoize the context value to prevent unnecessary re-renders of consumers
  // This is critical for TV scroll performance
  const value = useMemo(() => ({ scrollToElement }), [scrollToElement]);

  return (
    <TVScrollContext.Provider value={value}>
      {children}
    </TVScrollContext.Provider>
  );
};

export const useTVScroll = () => {
  const context = useContext(TVScrollContext);
  return context;
};

export default TVScrollContext;
