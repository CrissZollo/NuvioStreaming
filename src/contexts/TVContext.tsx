import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { Dimensions } from 'react-native';
import { isAndroidTV, isFireTV, getDeviceType, DeviceType } from '../utils/tvDetection';

interface TVContextValue {
  /** Whether the device is an Android TV */
  isTV: boolean;
  /** Whether the device is specifically a Fire TV */
  isFireTV: boolean;
  /** Current device type (phone, tablet, largeTablet, tv) */
  deviceType: DeviceType;
  /** Whether D-Pad/remote navigation should be used */
  useDPadNavigation: boolean;
}

const TVContext = createContext<TVContextValue>({
  isTV: false,
  isFireTV: false,
  deviceType: 'phone',
  useDPadNavigation: false,
});

interface TVProviderProps {
  children: ReactNode;
}

export const TVProvider: React.FC<TVProviderProps> = ({ children }) => {
  const [isTV, setIsTV] = useState(() => isAndroidTV());
  const [deviceType, setDeviceType] = useState<DeviceType>(() => getDeviceType());

  useEffect(() => {
    // Listen for dimension changes (orientation, window resize)
    const subscription = Dimensions.addEventListener('change', () => {
      setDeviceType(getDeviceType());
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  // Memoize isFireTV result to avoid calling it on every render
  const isFireTVDevice = useMemo(() => isFireTV(), []);

  // Memoize the context value to prevent unnecessary re-renders of consumers
  // This is critical for TV performance since TVContext is used throughout the app
  const value = useMemo<TVContextValue>(() => ({
    isTV,
    isFireTV: isFireTVDevice,
    deviceType,
    useDPadNavigation: isTV,
  }), [isTV, isFireTVDevice, deviceType]);

  return <TVContext.Provider value={value}>{children}</TVContext.Provider>;
};

/**
 * Hook to access TV context
 * @returns TVContextValue with isTV, deviceType, and navigation preferences
 */
export const useTV = (): TVContextValue => {
  const context = useContext(TVContext);
  if (!context) {
    // Return default values if used outside provider
    return {
      isTV: false,
      isFireTV: false,
      deviceType: 'phone',
      useDPadNavigation: false,
    };
  }
  return context;
};

/**
 * Hook to check if component should render TV version
 * Shorthand for useTV().isTV
 */
export const useIsTV = (): boolean => {
  return useTV().isTV;
};

export default TVContext;
