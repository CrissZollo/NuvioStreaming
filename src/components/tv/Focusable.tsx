import React, { forwardRef, useRef, useImperativeHandle, useState, useCallback, useEffect } from 'react';
import {
  TouchableOpacity,
  Pressable,
  View,
  StyleSheet,
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

// Focus colors - clean white outline style
const TV_FOCUS_BORDER_COLOR = '#FFFFFF';
const TV_FOCUS_BG_COLOR = '#FFFFFF';
const TV_UNFOCUSED_BG_COLOR = 'rgba(255, 255, 255, 0.1)';

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
      testID,
      showFocusBorder = true,
      borderRadius = 8,
      focusScale = 1.05,
      animateBackground = true,
    },
    ref
  ) => {
    const isTV = useIsTV();
    const innerRef = useRef<View>(null);
    const [isFocused, setIsFocused] = useState(false);
    const focusProgress = useSharedValue(0);
    // Track if autoFocus has been consumed (only apply once on mount)
    const autoFocusConsumed = useRef(false);
    const [shouldAutoFocus, setShouldAutoFocus] = useState(autoFocus);

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
      onFocus?.();
    }, [onFocus, focusProgress]);

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
        if (innerRef.current) {
          (innerRef.current as any).setNativeProps?.({
            hasTVPreferredFocus: true,
          });
        }
      },
      blur: () => {
        setIsFocused(false);
        focusProgress.value = withTiming(0, { duration: 150 });
      },
      isFocused: () => isFocused,
      getViewRef: () => innerRef,
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

    // Border animation - white outline when focused
    const animatedBorderStyle = useAnimatedStyle(() => ({
      opacity: showFocusBorder ? focusProgress.value : 0,
    }));

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
          ref={innerRef as any}
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
    const upHandle = getNodeHandle(nextFocusUp);
    const downHandle = getNodeHandle(nextFocusDown);
    const leftHandle = getNodeHandle(nextFocusLeft);
    const rightHandle = getNodeHandle(nextFocusRight);

    if (upHandle) tvProps.nextFocusUp = upHandle;
    if (downHandle) tvProps.nextFocusDown = downHandle;
    if (leftHandle) tvProps.nextFocusLeft = leftHandle;
    if (rightHandle) tvProps.nextFocusRight = rightHandle;

    return (
      <AnimatedPressable
        ref={innerRef as any}
        onPress={onPress}
        onLongPress={onLongPress}
        disabled={disabled}
        style={[
          style,
          animatedContainerStyle,
          animateBackground && animatedBackgroundStyle,
          { borderRadius },
          isFocused && focusStyle,
        ]}
        testID={testID}
        {...tvProps}
      >
        {/* White border overlay when focused */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.focusBorder,
            {
              borderColor: TV_FOCUS_BORDER_COLOR,
              borderRadius,
            },
            animatedBorderStyle,
          ]}
          pointerEvents="none"
        />
        {renderChildren()}
      </AnimatedPressable>
    );
  }
);

Focusable.displayName = 'Focusable';

const styles = StyleSheet.create({
  focusBorder: {
    borderWidth: 3,
    zIndex: 2,
  },
});

export default Focusable;
