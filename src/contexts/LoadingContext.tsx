import React, { createContext, useContext, useState, ReactNode, useMemo, useCallback } from 'react';

interface LoadingContextValue {
  isHomeLoading: boolean;
  setHomeLoading: (loading: boolean) => void;
}

const LoadingContext = createContext<LoadingContextValue | undefined>(undefined);

export const LoadingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isHomeLoading, setIsHomeLoading] = useState(true);

  // Memoize the callback to maintain referential stability
  const setHomeLoading = useCallback((loading: boolean) => {
    setIsHomeLoading(loading);
  }, []);

  // Memoize the context value to prevent unnecessary re-renders of consumers
  const value = useMemo<LoadingContextValue>(() => ({
    isHomeLoading,
    setHomeLoading,
  }), [isHomeLoading, setHomeLoading]);

  return (
    <LoadingContext.Provider value={value}>
      {children}
    </LoadingContext.Provider>
  );
};

export const useLoading = (): LoadingContextValue => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
};
