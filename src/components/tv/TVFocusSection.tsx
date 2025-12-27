import React, { useRef, useCallback } from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import { useTVScroll } from '../../contexts/TVScrollContext';
import { useIsTV } from '../../contexts/TVContext';

interface TVFocusSectionProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Wrapper component for horizontal scrolling sections on TV.
 * When any focusable item inside this section receives focus,
 * the section will scroll into view (centered on screen).
 *
 * This is used for sections like Cast, Trailers, More Like This, etc.
 * that have horizontal scrolling lists where individual items
 * shouldn't trigger vertical scrolling, but entering the section should.
 */
export const TVFocusSection: React.FC<TVFocusSectionProps> = ({
  children,
  style,
}) => {
  const isTV = useIsTV();
  const tvScroll = useTVScroll();
  const sectionRef = useRef<View>(null);
  const lastFocusTime = useRef<number>(0);

  const handleFocusCapture = useCallback(() => {
    if (!isTV || !tvScroll?.scrollToElement) return;

    // Debounce: only scroll if more than 300ms since last focus
    // This prevents scrolling when navigating horizontally within the section
    const now = Date.now();
    if (now - lastFocusTime.current > 300) {
      tvScroll.scrollToElement(sectionRef);
    }
    lastFocusTime.current = now;
  }, [isTV, tvScroll]);

  // On non-TV, just render children without the wrapper logic
  if (!isTV) {
    return <View style={style}>{children}</View>;
  }

  return (
    <View
      ref={sectionRef}
      style={style}
      onFocusCapture={handleFocusCapture}
    >
      {children}
    </View>
  );
};

export default TVFocusSection;
