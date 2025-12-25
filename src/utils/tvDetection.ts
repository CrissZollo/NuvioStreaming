import { Platform, NativeModules, Dimensions } from 'react-native';

// Get the native TV detection module (Android only)
const { TVDetection } = NativeModules;

/**
 * Check if the current device is an Android TV
 * Uses multiple detection methods for reliability:
 * 1. Native module (PackageManager.hasSystemFeature)
 * 2. Platform.isTV (React Native built-in)
 * 3. Screen dimension heuristics as fallback
 */
export const isAndroidTV = (): boolean => {
  // Only check on Android
  if (Platform.OS !== 'android') {
    return false;
  }

  // Primary: Check native module constants (synchronous)
  if (TVDetection?.isTV === true) {
    return true;
  }

  // Secondary: Check Platform.isTV (React Native built-in)
  if (Platform.isTV) {
    return true;
  }

  // Fallback: Large landscape screen (for cases where native module isn't loaded)
  const { width, height } = Dimensions.get('window');
  const isLargeScreen = Math.min(width, height) >= 600;
  const isLandscape = width > height;
  const isVeryLargeScreen = width >= 1280;

  // Only use heuristic if screen is very large and landscape
  // This helps detect TV when other methods fail
  return isLargeScreen && isLandscape && isVeryLargeScreen;
};

/**
 * Check if running on Fire TV specifically
 */
export const isFireTV = (): boolean => {
  if (Platform.OS !== 'android') {
    return false;
  }
  return TVDetection?.isFireTV === true;
};

/**
 * Async version of TV detection
 * Uses the native module's promise-based method
 */
export const checkIsTV = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return false;
  }

  try {
    if (TVDetection?.isTV) {
      return await TVDetection.isTV();
    }
    return Platform.isTV || false;
  } catch {
    return Platform.isTV || false;
  }
};

/**
 * Get device type considering TV
 * Extends the existing breakpoint system
 */
export type DeviceType = 'phone' | 'tablet' | 'largeTablet' | 'tv';

const BREAKPOINTS = {
  phone: 0,
  tablet: 768,
  largeTablet: 1024,
  tv: 1440,
};

export const getDeviceType = (): DeviceType => {
  // If detected as TV, always return 'tv'
  if (isAndroidTV()) {
    return 'tv';
  }

  const { width } = Dimensions.get('window');

  if (width >= BREAKPOINTS.tv) return 'tv';
  if (width >= BREAKPOINTS.largeTablet) return 'largeTablet';
  if (width >= BREAKPOINTS.tablet) return 'tablet';
  return 'phone';
};

/**
 * Check if D-Pad navigation should be enabled
 * True for TV and any device without touchscreen
 */
export const shouldUseDPadNavigation = (): boolean => {
  return isAndroidTV();
};
