import React, { createContext, useContext, useRef, useCallback } from 'react';
import { View } from 'react-native';

interface TVFocusContextValue {
  /** Ref to the last focused content row's first item - used for returning from menu */
  lastFocusedRowRef: React.MutableRefObject<View | null>;
  /** Set the first item ref of the currently focused row (pass the View directly) */
  setLastFocusedRowView: (view: View | null) => void;
}

const TVFocusContext = createContext<TVFocusContextValue | null>(null);

export const TVFocusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // This ref points to the first item of the last focused row
  // When user presses right from menu, focus goes here
  const lastFocusedRowRef = useRef<View | null>(null);

  // No state updates needed - just store the ref directly
  const setLastFocusedRowView = useCallback((view: View | null) => {
    if (view) {
      lastFocusedRowRef.current = view;
    }
  }, []);

  return (
    <TVFocusContext.Provider value={{ lastFocusedRowRef, setLastFocusedRowView }}>
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
    };
  }
  return context;
};

export default TVFocusContext;
