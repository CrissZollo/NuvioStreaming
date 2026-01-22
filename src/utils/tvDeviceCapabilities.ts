import { Platform, NativeModules } from 'react-native';
import { Easing } from 'react-native-reanimated';

/**
 * TV Device Capabilities Detection
 * Based on Amazon's react-native-multi-tv-app-sample patterns
 *
 * Detects low-end TV devices and provides capability flags for graceful degradation.
 * Low-end devices get simpler animations and reduced concurrent operations.
 */

// Cache the capabilities result to avoid repeated native calls
let cachedCapabilities: TVDeviceCapabilities | null = null;

export interface TVDeviceCapabilities {
  /** Whether this is a TV device */
  isTV: boolean;
  /** Whether this is a Fire TV device specifically */
  isFireTV: boolean;
  /** Whether this is a low-end device (Fire TV Gen 1/2, older Android TVs) */
  isLowEnd: boolean;
  /** Whether to enable Reanimated animations (disable on very low-end) */
  supportsAnimations: boolean;
  /** Whether to use complex shadow effects */
  supportsComplexShadows: boolean;
  /** Target frame rate for animations (30 or 60) */
  animationFrameRate: 30 | 60;
  /** Maximum concurrent image loads to prevent memory pressure */
  maxConcurrentImageLoads: number;
  /** Whether to use InteractionManager for focus events */
  useDeferredFocusEvents: boolean;
}

/**
 * Detect Fire TV device from manufacturer/model
 */
const detectFireTV = (): boolean => {
  if (Platform.OS !== 'android') return false;

  // Check native module first
  const { TVDetection } = NativeModules;
  if (TVDetection?.isFireTV === true) return true;

  // Fallback to platform constants
  const constants = Platform.constants as any;
  const manufacturer = (constants?.Manufacturer || constants?.manufacturer || '').toLowerCase();
  const model = (constants?.Model || constants?.model || '').toLowerCase();
  const brand = (constants?.Brand || constants?.brand || '').toLowerCase();

  return (
    manufacturer === 'amazon' ||
    brand === 'amazon' ||
    model.includes('aftt') || // Fire TV Stick
    model.includes('aftm') || // Fire TV Stick 4K
    model.includes('aftn') || // Fire TV Cube
    model.includes('aftb') || // Fire TV (box)
    model.includes('aftrs')   // Fire TV Stick Lite
  );
};

/**
 * Detect low-end TV device based on model and available memory
 * These devices need graceful degradation of animations and concurrent operations
 */
const detectLowEndDevice = (): boolean => {
  if (Platform.OS !== 'android') return false;

  const constants = Platform.constants as any;
  const model = (constants?.Model || constants?.model || '').toLowerCase();

  // Known low-end Fire TV models (Gen 1/2)
  const lowEndFireTVModels = [
    'aftt',   // Fire TV Stick 1st Gen
    'aftm',   // Fire TV Stick 2nd Gen (some variants)
    'aftb',   // Fire TV Box 1st Gen
  ];

  // Check for low-end Fire TV
  if (lowEndFireTVModels.some(m => model.startsWith(m))) {
    return true;
  }

  // Check API level - older Android TV devices (API < 28) are likely low-end
  const apiLevel = constants?.Version?.SDK_INT || constants?.Version || 0;
  if (apiLevel > 0 && apiLevel < 28) {
    return true;
  }

  // Check total memory if available (via native module)
  const { TVDetection } = NativeModules;
  if (TVDetection?.totalMemoryMB) {
    const totalMemoryMB = TVDetection.totalMemoryMB;
    // Devices with less than 1.5GB RAM are considered low-end
    if (totalMemoryMB < 1536) {
      return true;
    }
  }

  return false;
};

/**
 * Get TV device capabilities
 * Results are cached after first call for performance
 */
export const getTVDeviceCapabilities = (): TVDeviceCapabilities => {
  if (cachedCapabilities) {
    return cachedCapabilities;
  }

  const isTV = Platform.isTV || false;
  const isFireTV = detectFireTV();
  const isLowEnd = detectLowEndDevice();

  cachedCapabilities = {
    isTV,
    isFireTV,
    isLowEnd,
    // Disable complex animations on low-end devices
    supportsAnimations: !isLowEnd,
    // Disable shadow effects on low-end (expensive GPU operation)
    supportsComplexShadows: !isLowEnd,
    // Low-end TVs render at 30fps, others at 60fps
    animationFrameRate: isLowEnd ? 30 : 60,
    // Limit concurrent image loads on low-end to prevent memory pressure
    maxConcurrentImageLoads: isLowEnd ? 2 : 5,
    // Use InteractionManager to defer focus events on TV (prevents frame drops during D-pad spam)
    useDeferredFocusEvents: isTV,
  };

  if (__DEV__) {
    console.log('[TVDeviceCapabilities] Detected:', cachedCapabilities);
  }

  return cachedCapabilities;
};

/**
 * Animation Easing Curves Optimized for TV
 *
 * Standard easing curves (cubic-bezier) can cause frame skipping on low-end
 * 30fps TV devices. These curves are optimized for smooth playback.
 */
export const TV_EASING = {
  /**
   * Focus animation easing - fast entrance, slow exit
   * Material Design standard curve, works well on most TVs
   */
  focusIn: Easing.bezier(0.4, 0, 0.2, 1),

  /**
   * Focus out animation - slightly faster for responsive feel
   */
  focusOut: Easing.bezier(0.4, 0, 0.6, 1),

  /**
   * Simplified easing for low-end devices
   * Linear interpolation prevents judder on 30fps devices
   */
  simpleFocus: Easing.linear,

  /**
   * Fade animations - linear to prevent flicker on low-end devices
   */
  fadeLinear: Easing.linear,

  /**
   * Overlay animations (controls, modals) - gentle ease-out
   */
  overlayFade: Easing.out(Easing.quad),
} as const;

/**
 * Get the appropriate easing for the current device
 * Returns simpler easing on low-end devices
 */
export const getDeviceEasing = (type: 'focus' | 'fade' | 'overlay' = 'focus') => {
  const capabilities = getTVDeviceCapabilities();

  if (capabilities.isLowEnd) {
    // Low-end devices: use linear easing to prevent judder
    return TV_EASING.simpleFocus;
  }

  switch (type) {
    case 'focus':
      return TV_EASING.focusIn;
    case 'fade':
      return TV_EASING.fadeLinear;
    case 'overlay':
      return TV_EASING.overlayFade;
    default:
      return TV_EASING.focusIn;
  }
};

/**
 * Get animation duration optimized for the device
 * Low-end devices get slightly longer durations for smoother animations
 */
export const getAnimationDuration = (baseDuration: number): number => {
  const capabilities = getTVDeviceCapabilities();

  if (capabilities.isLowEnd) {
    // On 30fps devices, ensure duration is a multiple of frame time (33ms)
    // and add a bit more time for smoother interpolation
    const frameTime = 1000 / 30; // ~33ms
    const frames = Math.ceil(baseDuration / frameTime);
    return Math.max(frames * frameTime, baseDuration * 1.2);
  }

  return baseDuration;
};

/**
 * TV Animation Configuration
 * Pre-computed values for common animation scenarios
 */
export const TV_ANIMATION_CONFIG = {
  /** Focus scale animation duration */
  focusDuration: 165, // ~5 frames at 30fps

  /** Fade animation duration */
  fadeDuration: 200, // ~6 frames at 30fps

  /** Overlay animation duration */
  overlayDuration: 300, // ~9 frames at 30fps

  /** Scroll animation duration */
  scrollDuration: 100, // ~3 frames at 30fps - fast for responsiveness
} as const;

/**
 * Low-End Device Animation Configuration
 * Prioritizes smoothness over visual fidelity for Fire TV Stick Gen 1/2 and similar devices
 */
export const getLowEndAnimationConfig = () => {
  const capabilities = getTVDeviceCapabilities();

  if (capabilities.isLowEnd) {
    return {
      // Disable or minimize animations for smoothness
      focusScale: 1.0,           // No scale on focus (was 1.05-1.1) - use border instead
      focusDuration: 0,          // Instant focus change (was 165ms)
      transitionDuration: 100,   // Faster screen transitions (was 300ms)
      enableParallax: false,     // Disable parallax effects
      enableFadeAnimations: false, // Disable fade animations
      carouselSnapDuration: 50,  // Faster carousel snapping
      enableShadows: false,      // Disable shadow effects
      imageQualityWidth: 300,    // Lower resolution images (was 500)
      imageQuality: 60,          // Lower quality (was 80)
      // Use border-based focus indication instead of scale
      focusBorderWidth: 3,
      focusBorderColor: '#ffffff',
    };
  }

  return {
    focusScale: 1.05,
    focusDuration: 165,
    transitionDuration: 300,
    enableParallax: true,
    enableFadeAnimations: true,
    carouselSnapDuration: 150,
    enableShadows: true,
    imageQualityWidth: 500,
    imageQuality: 80,
    focusBorderWidth: 0,
    focusBorderColor: 'transparent',
  };
};

/**
 * Get image optimization config based on device capabilities
 * Lower resolution and quality for low-end devices to reduce memory pressure
 */
export const getImageOptimizationConfig = () => {
  const capabilities = getTVDeviceCapabilities();

  if (capabilities.isLowEnd) {
    return {
      maxWidth: 300,
      quality: 60,
      priority: 'low' as const,
      // Limit concurrent loads to prevent memory pressure
      maxConcurrent: capabilities.maxConcurrentImageLoads,
    };
  }

  return {
    maxWidth: 500,
    quality: 80,
    priority: 'normal' as const,
    maxConcurrent: capabilities.maxConcurrentImageLoads,
  };
};

/**
 * Get list rendering config based on device capabilities
 * Lower batch sizes and window sizes for low-end devices
 */
export const getListRenderingConfig = () => {
  const capabilities = getTVDeviceCapabilities();

  if (capabilities.isLowEnd) {
    return {
      maxToRenderPerBatch: 2,
      windowSize: 2,
      initialNumToRender: 3,
      updateCellsBatchingPeriod: 100,
      // FlashList specific
      drawDistance: 200,
    };
  }

  return {
    maxToRenderPerBatch: 4,
    windowSize: 3,
    initialNumToRender: 5,
    updateCellsBatchingPeriod: 50,
    // FlashList specific
    drawDistance: 400,
  };
};

// Re-export for convenience
export { cachedCapabilities as _cachedCapabilities };
