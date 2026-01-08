import React, { createContext, useContext, useRef, useCallback, useState } from 'react';
import { View, findNodeHandle } from 'react-native';

interface TVFocusContextValue {
  /** Ref to the last focused content row's first item - used for returning from menu */
  lastFocusedRowRef: React.MutableRefObject<View | null>;
  /** Set the first item ref of the currently focused row (pass the View directly) */
  setLastFocusedRowView: (view: View | null) => void;
  /** The menu's first nav item node handle - used for navigating left from content to menu */
  menuFirstItemNodeHandle: number | null;
  /** Set the menu's first nav item (pass the View, we'll get the node handle) */
  setMenuFirstItemView: (view: View | null) => void;
}

const TVFocusContext = createContext<TVFocusContextValue | null>(null);

export const TVFocusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // This ref points to the first item of the last focused row
  // When user presses right from menu, focus goes here
  const lastFocusedRowRef = useRef<View | null>(null);

  // Store the node handle for the menu's first nav item
  // Using state so that when it's set, consumers will get the update
  const [menuFirstItemNodeHandle, setMenuFirstItemNodeHandle] = useState<number | null>(null);

  // No state updates needed - just store the ref directly
  const setLastFocusedRowView = useCallback((view: View | null) => {
    if (view) {
      lastFocusedRowRef.current = view;
    }
  }, []);

  const setMenuFirstItemView = useCallback((view: View | null) => {
    if (view) {
      const handle = findNodeHandle(view);
      setMenuFirstItemNodeHandle(handle);
    }
  }, []);

  return (
    <TVFocusContext.Provider value={{ lastFocusedRowRef, setLastFocusedRowView, menuFirstItemNodeHandle, setMenuFirstItemView }}>
      {children}
    </TVFocusContext.Provider>
  );
};

export const useTVFocus = () => {
  const context = useContext(TVFocusContext);
  if (!context) {
    // Return a dummy context for non-TV usage
    return {
      lastFocusedRowRef: { current: null } as React.MutableRefObject<View | null>,
      setLastFocusedRowView: () => {},
      menuFirstItemNodeHandle: null as number | null,
      setMenuFirstItemView: () => {},
    };
  }
  return context;
};

export default TVFocusContext;
