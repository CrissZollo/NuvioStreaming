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
  useSharedValue,
  interpolate,
  interpolateColor,
  SharedValue,
} from 'react-native-reanimated';
import { useIsTV } from '../../contexts/TVContext';
import { focusLog } from '../../utils/focusPerformanceLogger';
import { navLog } from '../../utils/navigationDebugLogger';

// Focus colors - clean white outline style
const TV_FOCUS_BORDER_COLOR = '#FFFFFF';

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
  /** Direct node handle for up focus (alternative to nextFocusUp ref) */
  nextFocusUpId?: number | null;
  /** Direct node handle for down focus (alternative to nextFocusDown ref) */
  nextFocusDownId?: number | null;
  /** Direct node handle for left focus (alternative to nextFocusLeft ref) */
  nextFocusLeftId?: number | null;
  /** Direct node handle for right focus (alternative to nextFocusRight ref) */
  nextFocusRightId?: number | null;
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
  /** Callback when up is pressed while blocked (for custom handling) */
  onBlockedUp?: () => void;
  /** Callback when down is pressed while blocked (for custom handling) */
  onBlockedDown?: () => void;
  /** Test ID for testing */
  testID?: string;
  /** Whether to show focus border (default true on TV) */
  showFocusBorder?: boolean;
  /** Border radius for focus indicator */
  borderRadius?: number;
  /** Scale factor when focused (default 1.05 for TV visibility) */
  focusScale?: number;
  /** Scale factor when unfocused (default 1.0, use < 1 to make items smaller when not focused) */
  unfocusedScale?: number;
  /** Whether to animate background color change (default false for performance) */
  animateBackground?: boolean;
  /** External ref to the underlying View for directional focus linking */
  viewRef?: React.RefObject<View>;
  /** Callback when layout is measured (useful for registering node handles) */
  onLayout?: () => void;
}

export interface FocusableRef {
  focus: () => void;
  blur: () => void;
  isFocused: () => boolean;
  /** The underlying View ref for directional focus navigation */
  getViewRef: () => React.RefObject<View>;
  /** SharedValue for children to use in useAnimatedStyle (0 = unfocused, 1 = focused) */
  focusProgress: SharedValue<number>;
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
      nextFocusUpId,
      nextFocusDownId,
      nextFocusLeftId,
      nextFocusRightId,
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
      unfocusedScale = 1.0,
      animateBackground = false, // Default to false for performance
      viewRef,
      onLayout,
    },
    ref
  ) => {
    const isTV = useIsTV();
    const innerRef = useRef<View>(null);
    // Use external viewRef if provided, otherwise use internal ref
    const actualRef = viewRef || innerRef;
    // Only use state for isFocused when children is a render prop function
    // This avoids re-renders when children is static
    const needsFocusState = typeof children === 'function';
    const [isFocusedState, setIsFocusedState] = useState(false);
    // Use ref for focus tracking when state is not needed
    const isFocusedRef = useRef(false);
    const focusProgress = useSharedValue(0);
    // Track if autoFocus has been consumed (only apply once on mount)
    const autoFocusConsumed = useRef(false);
    // Compute shouldAutoFocus directly to avoid state re-render
    const shouldAutoFocus = autoFocus && !autoFocusConsumed.current;
    // Store own node handle for block* props - use ref to avoid re-renders
    const selfNodeHandleRef = useRef<number | null>(null);

    // Ref callback to capture node handle synchronously when view mounts
    const refCallback = useCallback((node: View | null) => {
      // Update the internal ref
      (innerRef as React.MutableRefObject<View | null>).current = node;

      // Also update external viewRef if provided
      if (viewRef) {
        (viewRef as React.MutableRefObject<View | null>).current = node;
      }

      // Always capture node handle - it may be needed later if block* props change
      if (node) {
        const handle = findNodeHandle(node);
        if (handle) {
          selfNodeHandleRef.current = handle;
        }
      }
    }, [viewRef]);

    // Mark autoFocus as consumed after first render to prevent re-application
    useEffect(() => {
      if (autoFocus && !autoFocusConsumed.current) {
        autoFocusConsumed.current = true;
      }
    }, [autoFocus]);

    // Get node handle for directional focus
    const getNodeHandle = (targetRef?: React.RefObject<View>): number | undefined => {
      if (!targetRef?.current) return undefined;
      const handle = findNodeHandle(targetRef.current);
      return handle ?? undefined;
    };

    const handleFocus = useCallback(() => {
      const startTime = focusLog.start('Focusable.handleFocus');
      navLog.perfStart('Focusable.handleFocus');
      navLog.focus(testID || 'Focusable', { autoFocus, hasRenderProp: needsFocusState });

      isFocusedRef.current = true;
      focusLog.mark('ref updated');

      // Only update state if we have a render prop that needs it
      if (needsFocusState) {
        focusLog.mark('setState(true) START');
        navLog.perfStart('Focusable.setState.focus');
        setIsFocusedState(true);
        navLog.perfEnd('Focusable.setState.focus');
        focusLog.mark('setState(true) END');
      }

      // Use fast timing instead of spring for better performance
      focusLog.mark('animation START');
      navLog.perfStart('Focusable.animation.focus');
      focusProgress.value = withTiming(1, { duration: 100 });
      navLog.perfEnd('Focusable.animation.focus');
      focusLog.mark('animation END');

      focusLog.mark('onFocus callback START');
      navLog.perfStart('Focusable.onFocusCallback');
      onFocus?.();
      navLog.perfEnd('Focusable.onFocusCallback');
      focusLog.mark('onFocus callback END');

      focusLog.end('Focusable.handleFocus', startTime);
      navLog.perfEnd('Focusable.handleFocus');
    }, [onFocus, focusProgress, needsFocusState, testID, autoFocus]);

    const handleBlur = useCallback(() => {
      const startTime = focusLog.start('Focusable.handleBlur');
      navLog.perfStart('Focusable.handleBlur');
      navLog.blur(testID || 'Focusable');

      isFocusedRef.current = false;
      focusLog.mark('ref updated');

      // Only update state if we have a render prop that needs it
      if (needsFocusState) {
        focusLog.mark('setState(false) START');
        navLog.perfStart('Focusable.setState.blur');
        setIsFocusedState(false);
        navLog.perfEnd('Focusable.setState.blur');
        focusLog.mark('setState(false) END');
      }

      focusLog.mark('animation START');
      navLog.perfStart('Focusable.animation.blur');
      focusProgress.value = withTiming(0, { duration: 150 });
      navLog.perfEnd('Focusable.animation.blur');
      focusLog.mark('animation END');

      focusLog.mark('onBlur callback START');
      navLog.perfStart('Focusable.onBlurCallback');
      onBlur?.();
      navLog.perfEnd('Focusable.onBlurCallback');
      focusLog.mark('onBlur callback END');

      focusLog.end('Focusable.handleBlur', startTime);
      navLog.perfEnd('Focusable.handleBlur');
    }, [onBlur, focusProgress, needsFocusState, testID]);

    // Expose focus methods via ref
    useImperativeHandle(ref, () => ({
      focus: () => {
        isFocusedRef.current = true;
        if (needsFocusState) {
          setIsFocusedState(true);
        }
        focusProgress.value = withTiming(1, { duration: 100 });
        if (actualRef.current) {
          (actualRef.current as any).setNativeProps?.({
            hasTVPreferredFocus: true,
          });
        }
      },
      blur: () => {
        isFocusedRef.current = false;
        if (needsFocusState) {
          setIsFocusedState(false);
        }
        focusProgress.value = withTiming(0, { duration: 100 });
      },
      isFocused: () => isFocusedRef.current,
      getViewRef: () => actualRef,
      focusProgress,
    }));

    // Animated styles for focus effect - simplified for performance
    // When unfocusedScale < 1, items start smaller and grow to focusScale when focused
    // Border color is now animated to avoid state-driven re-renders
    const animatedContainerStyle = useAnimatedStyle(() => {
      'worklet';
      const scale = interpolate(focusProgress.value, [0, 1], [unfocusedScale, focusScale]);
      return {
        transform: [{ scale }],
      };
    });

    // Animated border style - avoids re-render on focus change
    const animatedBorderStyle = useAnimatedStyle(() => {
      'worklet';
      if (!showFocusBorder) {
        return {};
      }
      const borderColor = interpolateColor(
        focusProgress.value,
        [0, 1],
        ['transparent', TV_FOCUS_BORDER_COLOR]
      );
      return {
        borderWidth: 3,
        borderColor,
      };
    });

    // Animated background style when animateBackground is true
    const animatedBackgroundStyle = useAnimatedStyle(() => {
      'worklet';
      if (!animateBackground) {
        return {};
      }
      const backgroundColor = interpolateColor(
        focusProgress.value,
        [0, 1],
        ['transparent', '#FFFFFF']
      );
      return { backgroundColor };
    });

    // Render children - support render prop for focus-aware content
    const renderChildren = () => {
      if (typeof children === 'function') {
        return children(isFocusedState);
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

    // Add directional focus if refs or IDs are provided
    // Priority: block > direct ID > ref
    const upHandle = blockUp ? selfNodeHandleRef.current : (nextFocusUpId ?? getNodeHandle(nextFocusUp));
    const downHandle = blockDown ? selfNodeHandleRef.current : (nextFocusDownId ?? getNodeHandle(nextFocusDown));
    const leftHandle = blockLeft ? selfNodeHandleRef.current : (nextFocusLeftId ?? getNodeHandle(nextFocusLeft));
    const rightHandle = blockRight ? selfNodeHandleRef.current : (nextFocusRightId ?? getNodeHandle(nextFocusRight));

    if (upHandle) tvProps.nextFocusUp = upHandle;
    if (downHandle) tvProps.nextFocusDown = downHandle;
    if (leftHandle) tvProps.nextFocusLeft = leftHandle;
    if (rightHandle) tvProps.nextFocusRight = rightHandle;

    return (
      <AnimatedPressable
        ref={refCallback}
        onPress={onPress}
        onLongPress={onLongPress}
        disabled={disabled}
        android_disableSound={true}
        onLayout={onLayout}
        style={[
          style,
          animatedContainerStyle,
          { borderRadius },
          animatedBorderStyle,
          animatedBackgroundStyle,
          // focusStyle is conditionally applied based on render prop state
          // since it may contain non-animatable properties
          needsFocusState && isFocusedState && focusStyle,
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
