import React, { forwardRef, useRef, useImperativeHandle, useState, useCallback, useEffect } from 'react';
import {
  TouchableOpacity,
  Pressable,
  View,
  ViewStyle,
  StyleProp,
  findNodeHandle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
  withSpring,
  useSharedValue,
  interpolate,
  interpolateColor,
} from 'react-native-reanimated';
import { useIsTV } from '../../contexts/TVContext';
import { useTVScroll } from '../../contexts/TVScrollContext';

// Focus colors - clean white outline style
const TV_FOCUS_BORDER_COLOR = '#FFFFFF';
const TV_FOCUS_BG_COLOR = '#FFFFFF';
const TV_UNFOCUSED_BG_COLOR = 'rgba(255, 255, 255, 0.1)';

// Generate unique ID for each Focusable instance
let focusableIdCounter = 0;
const generateFocusableId = () => `focusable-${++focusableIdCounter}`;

interface FocusableProps {
  /** Content to render inside the focusable container */
  children: React.ReactNode | ((focused: boolean) => React.ReactNode);
  /** Handler for press/select action */
  onPress?: () => void;
  /** Handler for long press action */
  onLongPress?: () => void;
  /** Style for the container */
  style?: StyleProp<ViewStyle>;
  /** Additional style applied when focused */
  focusStyle?: StyleProp<ViewStyle>;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Whether to auto-focus this component on mount */
  autoFocus?: boolean;
  /** Callback when component receives focus */
  onFocus?: () => void;
  /** Callback when component loses focus */
  onBlur?: () => void;
  /** Reference to element that should receive focus when pressing up */
  nextFocusUp?: React.RefObject<View>;
  /** Reference to element that should receive focus when pressing down */
  nextFocusDown?: React.RefObject<View>;
  /** Reference to element that should receive focus when pressing left */
  nextFocusLeft?: React.RefObject<View>;
  /** Reference to element that should receive focus when pressing right */
  nextFocusRight?: React.RefObject<View>;
  /** Block up navigation (focus stays on this element) */
  blockUp?: boolean;
  /** Block down navigation (focus stays on this element) */
  blockDown?: boolean;
  /** Block left navigation (focus stays on this element) */
  blockLeft?: boolean;
  /** Block right navigation (focus stays on this element) */
  blockRight?: boolean;
  /** Callback when left is pressed while blocked (for custom handling like seeking) */
  onBlockedLeft?: () => void;
  /** Callback when right is pressed while blocked (for custom handling like seeking) */
  onBlockedRight?: () => void;
  /** Test ID for testing */
  testID?: string;
  /** Whether to show focus border (default true on TV) */
  showFocusBorder?: boolean;
  /** Border radius for focus indicator */
  borderRadius?: number;
  /** Scale factor when focused (default 1.05 for TV visibility) */
  focusScale?: number;
  /** Whether to animate background color change (default true) */
  animateBackground?: boolean;
  /** External ref to the underlying View for directional focus linking */
  viewRef?: React.RefObject<View>;
  /** Whether to scroll the element into view when focused (default true on TV) */
  scrollOnFocus?: boolean;
}

export interface FocusableRef {
  focus: () => void;
  blur: () => void;
  isFocused: () => boolean;
  /** The underlying View ref for directional focus navigation */
  getViewRef: () => React.RefObject<View>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Focusable component for TV D-Pad navigation
 * Wraps content to make it navigable with remote control
 *
 * Focus style:
 * - Unfocused: Gray/transparent background
 * - Focused: White background with white outline, black text (via render prop)
 */
export const Focusable = forwardRef<FocusableRef, FocusableProps>(
  (
    {
      children,
      onPress,
      onLongPress,
      style,
      focusStyle,
      disabled = false,
      autoFocus = false,
      onFocus,
      onBlur,
      nextFocusUp,
      nextFocusDown,
      nextFocusLeft,
      nextFocusRight,
      blockUp = false,
      blockDown = false,
      blockLeft = false,
      blockRight = false,
      onBlockedLeft,
      onBlockedRight,
      testID,
      showFocusBorder = true,
      borderRadius = 8,
      focusScale = 1.05,
      animateBackground = true,
      viewRef,
      scrollOnFocus = true,
    },
    ref
  ) => {
    const isTV = useIsTV();
    const tvScroll = useTVScroll();
    const innerRef = useRef<View>(null);
    // Use external viewRef if provided, otherwise use internal ref
    const actualRef = viewRef || innerRef;
    const [isFocused, setIsFocused] = useState(false);
    const focusProgress = useSharedValue(0);
    // Track if autoFocus has been consumed (only apply once on mount)
    const autoFocusConsumed = useRef(false);
    const [shouldAutoFocus, setShouldAutoFocus] = useState(autoFocus);
    // Unique ID for this focusable instance
    const focusableId = useRef(generateFocusableId()).current;
    // Store own node handle for block* props - use state to trigger re-render
    const [selfNodeHandle, setSelfNodeHandle] = useState<number | null>(null);

    // Ref callback to capture node handle synchronously when view mounts
    const refCallback = useCallback((node: View | null) => {
      // Update the internal ref
      (innerRef as React.MutableRefObject<View | null>).current = node;

      // Also update external viewRef if provided
      if (viewRef) {
        (viewRef as React.MutableRefObject<View | null>).current = node;
      }

      // Capture node handle for block* props
      if (node && (blockUp || blockDown || blockLeft || blockRight)) {
        const handle = findNodeHandle(node);
        if (handle) {
          setSelfNodeHandle(handle);
        }
      }
    }, [blockUp, blockDown, blockLeft, blockRight, viewRef]);

    // Only apply autoFocus once on mount
    useEffect(() => {
      if (autoFocus && !autoFocusConsumed.current) {
        autoFocusConsumed.current = true;
        // Clear the autoFocus after a short delay to prevent it from re-grabbing focus
        const timer = setTimeout(() => {
          setShouldAutoFocus(false);
        }, 500);
        return () => clearTimeout(timer);
      }
    }, [autoFocus]);

    // Get node handle for directional focus
    const getNodeHandle = (targetRef?: React.RefObject<View>): number | undefined => {
      if (!targetRef?.current) return undefined;
      const handle = findNodeHandle(targetRef.current);
      return handle ?? undefined;
    };

    const handleFocus = useCallback(() => {
      setIsFocused(true);
      focusProgress.value = withSpring(1, {
        damping: 15,
        stiffness: 150,
        mass: 0.8,
      });

      // Scroll to center the focused element on TV
      if (scrollOnFocus && tvScroll?.scrollToElement) {
        // Small delay to allow layout to settle
        setTimeout(() => {
          tvScroll.scrollToElement(actualRef as React.RefObject<View>);
        }, 50);
      }

      onFocus?.();
    }, [onFocus, focusProgress, scrollOnFocus, tvScroll, actualRef]);

    const handleBlur = useCallback(() => {
      setIsFocused(false);
      focusProgress.value = withTiming(0, { duration: 150 });
      onBlur?.();
    }, [onBlur, focusProgress]);

    // Expose focus methods via ref
    useImperativeHandle(ref, () => ({
      focus: () => {
        setIsFocused(true);
        focusProgress.value = withSpring(1, { damping: 15, stiffness: 150 });
        if (actualRef.current) {
          (actualRef.current as any).setNativeProps?.({
            hasTVPreferredFocus: true,
          });
        }
      },
      blur: () => {
        setIsFocused(false);
        focusProgress.value = withTiming(0, { duration: 150 });
      },
      isFocused: () => isFocused,
      getViewRef: () => actualRef,
    }));

    // Animated styles for focus effect - scale
    const animatedContainerStyle = useAnimatedStyle(() => {
      const scale = interpolate(focusProgress.value, [0, 1], [1, focusScale]);
      return {
        transform: [{ scale }],
        zIndex: focusProgress.value > 0 ? 1000 : 0, // High zIndex to appear above other sections
        elevation: focusProgress.value > 0 ? 50 : 0, // Android elevation for proper layering
      };
    });

    // Background color animation - gray to white
    const animatedBackgroundStyle = useAnimatedStyle(() => {
      if (!animateBackground) return {};

      const backgroundColor = interpolateColor(
        focusProgress.value,
        [0, 1],
        [TV_UNFOCUSED_BG_COLOR, TV_FOCUS_BG_COLOR]
      );
      return { backgroundColor };
    });

    // Render children - support render prop for focus-aware content
    const renderChildren = () => {
      if (typeof children === 'function') {
        return children(isFocused);
      }
      return children;
    };

    // On non-TV devices, render a simple TouchableOpacity
    if (!isTV) {
      return (
        <TouchableOpacity
          ref={actualRef as any}
          onPress={onPress}
          onLongPress={onLongPress}
          disabled={disabled}
          activeOpacity={0.7}
          style={style}
          testID={testID}
        >
          {typeof children === 'function' ? children(false) : children}
        </TouchableOpacity>
      );
    }

    // Build TV-specific props
    const tvProps: any = {
      focusable: true,
      accessible: true,
      hasTVPreferredFocus: shouldAutoFocus, // Use state that clears after mount
      onFocus: handleFocus,
      onBlur: handleBlur,
    };

    // Add directional focus if refs are provided
    const upHandle = blockUp ? selfNodeHandle : getNodeHandle(nextFocusUp);
    const downHandle = blockDown ? selfNodeHandle : getNodeHandle(nextFocusDown);
    const leftHandle = blockLeft ? selfNodeHandle : getNodeHandle(nextFocusLeft);
    const rightHandle = blockRight ? selfNodeHandle : getNodeHandle(nextFocusRight);

    if (upHandle) tvProps.nextFocusUp = upHandle;
    if (downHandle) tvProps.nextFocusDown = downHandle;
    if (leftHandle) tvProps.nextFocusLeft = leftHandle;
    if (rightHandle) tvProps.nextFocusRight = rightHandle;

    // Use border directly on the component instead of an overlay
    const animatedBorderDirectStyle = useAnimatedStyle(() => ({
      borderWidth: showFocusBorder ? 3 : 0,
      borderColor: interpolateColor(
        focusProgress.value,
        [0, 1],
        ['transparent', TV_FOCUS_BORDER_COLOR]
      ),
    }));

    return (
      <AnimatedPressable
        ref={refCallback}
        onPress={onPress}
        onLongPress={onLongPress}
        disabled={disabled}
        style={[
          style,
          animatedContainerStyle,
          animateBackground && animatedBackgroundStyle,
          { borderRadius },
          animatedBorderDirectStyle,
          isFocused && focusStyle,
        ]}
        testID={testID}
        {...tvProps}
      >
        {renderChildren()}
      </AnimatedPressable>
    );
  }
);

Focusable.displayName = 'Focusable';

export default Focusable;
