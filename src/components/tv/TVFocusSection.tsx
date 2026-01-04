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
  const hasFocusWithin = useRef<boolean>(false);

  const handleFocusCapture = useCallback(() => {
    if (!isTV || !tvScroll?.scrollToElement) return;

    // Only scroll when focus ENTERS the section from outside
    // Don't scroll when navigating between items within the section
    if (!hasFocusWithin.current) {
      hasFocusWithin.current = true;
      tvScroll.scrollToElement(sectionRef);
    }
  }, [isTV, tvScroll]);

  const handleBlurCapture = useCallback(() => {
    // Use a small delay to check if focus moved to another item within the section
    // or if it truly left the section
    setTimeout(() => {
      if (sectionRef.current) {
        // Check if the section still contains the focused element
        // If not, mark as no longer having focus within
        hasFocusWithin.current = false;
      }
    }, 50);
  }, []);

  // On non-TV, just render children without the wrapper logic
  if (!isTV) {
    return <View style={style}>{children}</View>;
  }

  return (
    <View
      ref={sectionRef}
      style={style}
      onFocusCapture={handleFocusCapture}
      onBlurCapture={handleBlurCapture}
    >
      {children}
    </View>
  );
};

export default TVFocusSection;
