import React, { createContext, useContext, useRef, useCallback } from 'react';
import { View } from 'react-native';

interface TVFocusContextValue {
  /** Ref to the first focusable content item */
  firstContentRef: React.RefObject<View>;
  /** Register a ref as the first content item */
  setFirstContentRef: (ref: React.RefObject<View>) => void;
}

const TVFocusContext = createContext<TVFocusContextValue | null>(null);

export const TVFocusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const firstContentRef = useRef<View>(null);
  const registeredRef = useRef<React.RefObject<View> | null>(null);

  const setFirstContentRef = useCallback((ref: React.RefObject<View>) => {
    registeredRef.current = ref;
    // Copy the current value to our ref
    if (ref.current) {
      (firstContentRef as any).current = ref.current;
    }
  }, []);

  return (
    <TVFocusContext.Provider value={{ firstContentRef, setFirstContentRef }}>
      {children}
    </TVFocusContext.Provider>
  );
};

export const useTVFocus = () => {
  const context = useContext(TVFocusContext);
  if (!context) {
    // Return a dummy context for non-TV usage
    return {
      firstContentRef: { current: null } as React.RefObject<View>,
      setFirstContentRef: () => {},
    };
  }
  return context;
};

export default TVFocusContext;
