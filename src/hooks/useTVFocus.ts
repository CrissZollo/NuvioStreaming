import { useCallback, useState, useRef, useEffect } from 'react';
import { findNodeHandle, View, Platform } from 'react-native';
import { useIsTV } from '../contexts/TVContext';

interface UseTVFocusOptions {
  /** Auto-focus this element when mounted */
  autoFocus?: boolean;
  /** Callback when element receives focus */
  onFocus?: () => void;
  /** Callback when element loses focus */
  onBlur?: () => void;
  /** Reference to element that should receive focus when pressing up */
  nextFocusUp?: React.RefObject<View>;
  /** Reference to element that should receive focus when pressing down */
  nextFocusDown?: React.RefObject<View>;
  /** Reference to element that should receive focus when pressing left */
  nextFocusLeft?: React.RefObject<View>;
  /** Reference to element that should receive focus when pressing right */
  nextFocusRight?: React.RefObject<View>;
}

interface TVFocusResult {
  /** Whether this element is currently focused */
  isFocused: boolean;
  /** Props to spread on the focusable element */
  focusableProps: {
    accessible: boolean;
    hasTVPreferredFocus?: boolean;
    onFocus: () => void;
    onBlur: () => void;
    nextFocusUp?: number | null;
    nextFocusDown?: number | null;
    nextFocusLeft?: number | null;
    nextFocusRight?: number | null;
    isTVSelectable?: boolean;
  };
  /** Manually set focus state (for non-TV testing) */
  setFocused: (focused: boolean) => void;
}

/**
 * Hook for managing TV focus on a component
 * Provides focus state and props to make an element focusable with D-Pad
 */
export const useTVFocus = (
  ref: React.RefObject<View>,
  options: UseTVFocusOptions = {}
): TVFocusResult => {
  const isTV = useIsTV();
  const [isFocused, setIsFocused] = useState(false);
  const {
    autoFocus = false,
    onFocus,
    onBlur,
    nextFocusUp,
    nextFocusDown,
    nextFocusLeft,
    nextFocusRight,
  } = options;

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    onFocus?.();
  }, [onFocus]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    onBlur?.();
  }, [onBlur]);

  // Get node handles for directional focus
  const getNodeHandle = (targetRef?: React.RefObject<View>): number | null => {
    if (!targetRef?.current) return null;
    return findNodeHandle(targetRef.current);
  };

  const focusableProps = {
    accessible: true,
    // Only set hasTVPreferredFocus if autoFocus is true and we're on TV
    ...(isTV && autoFocus && { hasTVPreferredFocus: true }),
    onFocus: handleFocus,
    onBlur: handleBlur,
    // Directional focus navigation
    nextFocusUp: getNodeHandle(nextFocusUp),
    nextFocusDown: getNodeHandle(nextFocusDown),
    nextFocusLeft: getNodeHandle(nextFocusLeft),
    nextFocusRight: getNodeHandle(nextFocusRight),
    // Make selectable on TV
    ...(isTV && { isTVSelectable: true }),
  };

  return {
    isFocused,
    focusableProps,
    setFocused: setIsFocused,
  };
};

/**
 * Hook to manage focus memory for a list/grid
 * Remembers the last focused index and can restore it
 */
export const useFocusMemory = () => {
  const memoryRef = useRef<{
    rowIndex: number;
    columnIndex: number;
  }>({
    rowIndex: 0,
    columnIndex: 0,
  });

  const itemRefs = useRef<Map<string, View>>(new Map());

  const saveFocus = useCallback((rowIndex: number, columnIndex: number) => {
    memoryRef.current = { rowIndex, columnIndex };
  }, []);

  const getKey = useCallback((rowIndex: number, columnIndex: number) => {
    return `${rowIndex}-${columnIndex}`;
  }, []);

  const setItemRef = useCallback(
    (rowIndex: number, columnIndex: number, ref: View | null) => {
      const key = getKey(rowIndex, columnIndex);
      if (ref) {
        itemRefs.current.set(key, ref);
      } else {
        itemRefs.current.delete(key);
      }
    },
    [getKey]
  );

  const getLastFocused = useCallback(() => {
    return memoryRef.current;
  }, []);

  const restoreFocus = useCallback(() => {
    const { rowIndex, columnIndex } = memoryRef.current;
    const key = getKey(rowIndex, columnIndex);
    const targetRef = itemRefs.current.get(key);

    if (targetRef) {
      const handle = findNodeHandle(targetRef);
      if (handle) {
        // Request focus programmatically
        // This works with React Native's TV focus system
        (targetRef as any).setNativeProps?.({ hasTVPreferredFocus: true });
      }
    }
  }, [getKey]);

  return {
    saveFocus,
    setItemRef,
    getLastFocused,
    restoreFocus,
    getKey,
  };
};

export default useTVFocus;
