import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { StreamingContent } from '../services/catalogService';
import { addonEmitter, ADDON_EVENTS } from '../services/stremioService';
import { logger } from '../utils/logger';

interface CatalogContextType {
  lastUpdate: number;
  refreshCatalogs: () => void;
  addToLibrary: (content: StreamingContent) => void;
  removeFromLibrary: (type: string, id: string) => void;
  libraryItems: StreamingContent[];
}

const CatalogContext = createContext<CatalogContextType>({
  lastUpdate: Date.now(),
  refreshCatalogs: () => {},
  addToLibrary: () => {},
  removeFromLibrary: () => {},
  libraryItems: []
});

export const useCatalogContext = () => useContext(CatalogContext);

export const CatalogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [libraryItems, setLibraryItems] = useState<StreamingContent[]>([]);

  const refreshCatalogs = useCallback(() => {
    setLastUpdate(Date.now());
  }, []);

  // Listen for addon changes to update catalog data
  useEffect(() => {
    const handleAddonChange = () => {
      logger.info('Addon changed, triggering catalog refresh');
      refreshCatalogs();
    };

    // Subscribe to all addon events to refresh catalogs
    addonEmitter.on(ADDON_EVENTS.ORDER_CHANGED, handleAddonChange);
    addonEmitter.on(ADDON_EVENTS.ADDON_ADDED, handleAddonChange);
    addonEmitter.on(ADDON_EVENTS.ADDON_REMOVED, handleAddonChange);

    return () => {
      // Clean up event listeners
      addonEmitter.off(ADDON_EVENTS.ORDER_CHANGED, handleAddonChange);
      addonEmitter.off(ADDON_EVENTS.ADDON_ADDED, handleAddonChange);
      addonEmitter.off(ADDON_EVENTS.ADDON_REMOVED, handleAddonChange);
    };
  }, [refreshCatalogs]);

  const addToLibrary = useCallback((content: StreamingContent) => {
    setLibraryItems(prev => [...prev, content]);
  }, []);

  const removeFromLibrary = useCallback((type: string, id: string) => {
    setLibraryItems(prev => prev.filter(item => !(item.id === id && item.type === type)));
  }, []);

  // Memoize the context value to prevent unnecessary re-renders of consumers
  // This is critical for TV performance since CatalogContext is used throughout the app
  const value = useMemo(() => ({
    lastUpdate,
    refreshCatalogs,
    addToLibrary,
    removeFromLibrary,
    libraryItems
  }), [lastUpdate, refreshCatalogs, addToLibrary, removeFromLibrary, libraryItems]);

  return (
    <CatalogContext.Provider value={value}>
      {children}
    </CatalogContext.Provider>
  );
}; 