import React, { useRef, useCallback } from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import { useTVScroll } from '../../contexts/TVScrollContext';
import { useIsTV } from '../../contexts/TVContext';
import { navLog } from '../../utils/navigationDebugLogger';

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
    if (!isTV || !tvScroll?.scrollToElement) {
      navLog.log('FOCUS', 'TVFocusSection.focusCapture: skipped (not TV or no scroll context)');
      return;
    }

    // Only scroll when focus ENTERS the section from outside
    // Don't scroll when navigating between items within the section
    if (!hasFocusWithin.current) {
      navLog.focus('TVFocusSection', { action: 'ENTER_SECTION', triggersScroll: true });
      navLog.perfStart('TVFocusSection.scrollToElement');
      hasFocusWithin.current = true;
      tvScroll.scrollToElement(sectionRef);
      navLog.perfEnd('TVFocusSection.scrollToElement');
    } else {
      navLog.log('FOCUS', 'TVFocusSection: focus within section, skip scroll');
    }
  }, [isTV, tvScroll]);

  const handleBlurCapture = useCallback(() => {
    // Reset focus flag immediately - if focus moves to another item in this section,
    // handleFocusCapture will be called and set hasFocusWithin back to true
    // before any scroll decision is made. This avoids the setTimeout overhead
    // that was causing input lag during fast D-pad navigation.
    hasFocusWithin.current = false;
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
