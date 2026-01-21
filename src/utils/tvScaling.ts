import { Dimensions, PixelRatio } from 'react-native';
import { isAndroidTV } from './tvDetection';

/**
 * TV Scaling Utility
 * Based on Amazon's react-native-multi-tv-app-sample patterns
 *
 * Provides consistent UI scaling across different TV resolutions
 * using a 1920x1080 (Full HD) baseline design resolution.
 */

// Design baseline resolution (Full HD - most common TV resolution)
const DESIGN_WIDTH = 1920;
const DESIGN_HEIGHT = 1080;

// Get current screen dimensions
const getScreenDimensions = () => {
  const { width, height } = Dimensions.get('window');
  return { width, height };
};

// Calculate scale factors based on current screen vs design baseline
const getScaleFactors = () => {
  const { width, height } = getScreenDimensions();
  return {
    scaleX: width / DESIGN_WIDTH,
    scaleY: height / DESIGN_HEIGHT,
    // Use the smaller scale to maintain aspect ratio
    scale: Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT),
  };
};

/**
 * Scale a pixel value from design baseline (1920x1080) to current screen
 * Use this for consistent sizing across TV resolutions (720p, 1080p, 4K)
 *
 * @param size - Size in pixels at 1920x1080 baseline
 * @returns Scaled size for current screen
 *
 * @example
 * // For a 48px font at 1080p, on a 4K TV this returns 96px
 * const fontSize = scaledPixels(48);
 *
 * // For spacing and margins
 * const padding = scaledPixels(24);
 */
export const scaledPixels = (size: number): number => {
  if (!isAndroidTV()) {
    // On mobile, return unscaled value
    return size;
  }

  const { scale } = getScaleFactors();
  return Math.round(PixelRatio.roundToNearestPixel(size * scale));
};

/**
 * Scale horizontally only (for width-dependent values)
 * Useful for horizontal spacing that should stretch on wider screens
 */
export const scaledWidth = (size: number): number => {
  if (!isAndroidTV()) {
    return size;
  }

  const { scaleX } = getScaleFactors();
  return Math.round(PixelRatio.roundToNearestPixel(size * scaleX));
};

/**
 * Scale vertically only (for height-dependent values)
 * Useful for vertical spacing that should stretch on taller screens
 */
export const scaledHeight = (size: number): number => {
  if (!isAndroidTV()) {
    return size;
  }

  const { scaleY } = getScaleFactors();
  return Math.round(PixelRatio.roundToNearestPixel(size * scaleY));
};

/**
 * TV Safe Zone Constants
 * Based on broadcast television standards to prevent content cutoff
 *
 * Title Safe Area (5%): Text and essential UI must stay within this zone
 * Action Safe Area (3.5%): Critical content and actions should stay within this zone
 *
 * These values are calculated for 1920x1080 baseline and scaled appropriately
 */
export const TV_SAFE_ZONES = {
  // Title Safe Area (5% from each edge)
  // Essential text and UI elements must be within this area
  titleSafe: {
    horizontal: 96, // 1920 * 0.05 = 96px from left and right
    vertical: 54,   // 1080 * 0.05 = 54px from top and bottom
  },

  // Action Safe Area (3.5% from each edge)
  // Important content and interactive elements should be within this area
  actionSafe: {
    horizontal: 67, // 1920 * 0.035 = 67.2px ≈ 67px
    vertical: 38,   // 1080 * 0.035 = 37.8px ≈ 38px
  },
} as const;

/**
 * Get scaled safe zone values for current screen
 * Returns the appropriate padding to keep content in safe zones
 */
export const getScaledSafeZones = () => {
  if (!isAndroidTV()) {
    // Return zero margins for mobile
    return {
      titleSafe: { horizontal: 0, vertical: 0 },
      actionSafe: { horizontal: 0, vertical: 0 },
    };
  }

  return {
    titleSafe: {
      horizontal: scaledPixels(TV_SAFE_ZONES.titleSafe.horizontal),
      vertical: scaledPixels(TV_SAFE_ZONES.titleSafe.vertical),
    },
    actionSafe: {
      horizontal: scaledPixels(TV_SAFE_ZONES.actionSafe.horizontal),
      vertical: scaledPixels(TV_SAFE_ZONES.actionSafe.vertical),
    },
  };
};

/**
 * Get safe zone padding style object
 * Convenient for applying directly to container styles
 *
 * @param type - 'title' for stricter margins, 'action' for standard margins
 * @returns Style object with paddingHorizontal and paddingVertical
 *
 * @example
 * const styles = StyleSheet.create({
 *   container: {
 *     ...getSafeZonePadding('title'),
 *   },
 * });
 */
export const getSafeZonePadding = (type: 'title' | 'action' = 'action') => {
  const zones = getScaledSafeZones();
  const zone = type === 'title' ? zones.titleSafe : zones.actionSafe;

  return {
    paddingHorizontal: zone.horizontal,
    paddingVertical: zone.vertical,
  };
};

/**
 * Common TV-specific dimensions (pre-calculated at 1920x1080 baseline)
 * Use scaledPixels() to scale these for current screen
 */
export const TV_DIMENSIONS = {
  // Focus indicator
  focusRingWidth: 4,
  focusPadding: 8,

  // Card dimensions
  cardWidth: 200,
  cardHeight: 300,
  cardBorderRadius: 8,

  // Typography (approximate conversions from mobile)
  fontSizeSmall: 24,
  fontSizeMedium: 32,
  fontSizeLarge: 48,
  fontSizeXLarge: 64,
  fontSizeTitle: 72,

  // Spacing
  spacingSmall: 16,
  spacingMedium: 24,
  spacingLarge: 48,
  spacingXLarge: 64,

  // Row heights
  contentRowHeight: 320,
  headerHeight: 80,

  // Animation durations (ms)
  focusAnimationDuration: 165, // ~5 frames at 30fps
  fadeAnimationDuration: 300,
} as const;

/**
 * Get current screen info for debugging
 */
export const getScreenInfo = () => {
  const { width, height } = getScreenDimensions();
  const { scale, scaleX, scaleY } = getScaleFactors();

  return {
    screenWidth: width,
    screenHeight: height,
    designWidth: DESIGN_WIDTH,
    designHeight: DESIGN_HEIGHT,
    scaleX,
    scaleY,
    uniformScale: scale,
    isTV: isAndroidTV(),
    pixelRatio: PixelRatio.get(),
  };
};

// Re-export for convenience
export { DESIGN_WIDTH, DESIGN_HEIGHT };
