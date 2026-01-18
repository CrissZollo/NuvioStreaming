import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Dimensions, PixelRatio } from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import { logger } from '../../utils/logger';

interface OptimizedImageProps {
  source: { uri: string } | string;
  style?: any;
  placeholder?: string;
  priority?: 'low' | 'normal' | 'high';
  lazy?: boolean;
  onLoad?: () => void;
  onError?: (error: any) => void;
  contentFit?: 'cover' | 'contain' | 'fill' | 'scale-down';
  transition?: number;
  cachePolicy?: 'memory' | 'disk' | 'memory-disk' | 'none';
}

const { width: screenWidth } = Dimensions.get('window');
const pixelRatio = PixelRatio.get();

// Image size optimization based on container size AND pixel ratio
// This ensures we request the right size image for the actual physical pixels needed
const getOptimizedImageUrl = (originalUrl: string, containerWidth?: number, containerHeight?: number): string => {
  if (!originalUrl || originalUrl.includes('placeholder')) {
    return originalUrl;
  }

  // For TMDB images, we can request specific sizes
  if (originalUrl.includes('image.tmdb.org')) {
    const logicalWidth = containerWidth || 300;
    // Calculate physical pixels needed, but cap the ratio to avoid requesting
    // unnecessarily large images on very high DPI devices
    const effectiveRatio = Math.min(pixelRatio, 2);
    const physicalWidth = logicalWidth * effectiveRatio;

    let size = 'w300';

    // Select the smallest TMDB size that covers the physical pixels needed
    if (physicalWidth <= 92) size = 'w92';
    else if (physicalWidth <= 154) size = 'w154';
    else if (physicalWidth <= 185) size = 'w185';
    else if (physicalWidth <= 342) size = 'w342';
    else if (physicalWidth <= 500) size = 'w500';
    else if (physicalWidth <= 780) size = 'w780';
    else size = 'w1280';

    // Replace the size in the URL (handles both /wXXX/ and /original/)
    return originalUrl.replace(/\/(w\d+|original)\//, `/${size}/`);
  }

  // For other image services, add query parameters if supported
  const effectiveRatio = Math.min(pixelRatio, 2);
  const physicalWidth = Math.round((containerWidth || 300) * effectiveRatio);
  const physicalHeight = Math.round((containerHeight || 450) * effectiveRatio);

  if (originalUrl.includes('?')) {
    return `${originalUrl}&w=${physicalWidth}&h=${physicalHeight}&q=80`;
  } else {
    return `${originalUrl}?w=${physicalWidth}&h=${physicalHeight}&q=80`;
  }
};

const OptimizedImage: React.FC<OptimizedImageProps> = ({
  source,
  style,
  placeholder = 'https://via.placeholder.com/300x450/1a1a1a/666666?text=Loading',
  priority = 'normal',
  lazy = true,
  onLoad,
  onError,
  contentFit = 'cover',
  transition = 0,
  cachePolicy = 'memory-disk'
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isVisible, setIsVisible] = useState(!lazy);
  const [optimizedUrl, setOptimizedUrl] = useState<string>('');
  const mountedRef = useRef(true);

  // Extract URL from source
  const sourceUrl = typeof source === 'string' ? source : source?.uri || '';

  // Calculate container dimensions from style
  const containerWidth = style?.width || (style?.aspectRatio ? screenWidth * 0.3 : 300);
  const containerHeight = style?.height || (containerWidth / (style?.aspectRatio || 0.67));

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Optimize image URL based on container size
  useEffect(() => {
    if (sourceUrl) {
      const optimized = getOptimizedImageUrl(sourceUrl, containerWidth, containerHeight);
      setOptimizedUrl(optimized);
    }
  }, [sourceUrl, containerWidth, containerHeight]);

  // Lazy loading - simplified for TV performance
  // On TV, we reduce delays significantly to prevent visible loading jank
  useEffect(() => {
    if (lazy && !isVisible) {
      // Much shorter delays - images should appear quickly
      const delay = priority === 'high' ? 50 : priority === 'normal' ? 100 : 200;
      const timer = setTimeout(() => {
        if (mountedRef.current) {
          setIsVisible(true);
        }
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [lazy, isVisible, priority]);

  // Preload image via FastImage
  const preloadImage = useCallback(async () => {
    if (!optimizedUrl || !isVisible) return;

    try {
      FastImage.preload([{ uri: optimizedUrl }]);
      if (!mountedRef.current) return;
      setIsLoaded(true);
      onLoad?.();
    } catch (error) {
      if (!mountedRef.current) return;
      logger.error(`[OptimizedImage] Failed to preload: ${optimizedUrl.substring(0, 50)}...`, error);
      setHasError(true);
      onError?.(error);
    }
  }, [optimizedUrl, isVisible, onLoad, onError]);

  useEffect(() => {
    if (isVisible && optimizedUrl && !isLoaded && !hasError) {
      preloadImage();
    }
  }, [isVisible, optimizedUrl, isLoaded, hasError, preloadImage]);

  // Don't render anything if not visible (lazy loading)
  if (!isVisible) {
    return <View style={[style, styles.placeholder]} />;
  }

  // Show placeholder while loading or on error
  if (!isLoaded || hasError) {
    return (
      <FastImage
        source={{ uri: placeholder }}
        style={style}
        resizeMode={FastImage.resizeMode.cover}
      />
    );
  }

  return (
    <FastImage
      source={{ 
        uri: optimizedUrl,
        priority: priority === 'high' ? FastImage.priority.high : priority === 'low' ? FastImage.priority.low : FastImage.priority.normal,
        cache: FastImage.cacheControl.immutable
      }}
      style={style}
      resizeMode={contentFit === 'contain' ? FastImage.resizeMode.contain : contentFit === 'cover' ? FastImage.resizeMode.cover : FastImage.resizeMode.cover}
      onLoad={() => {
        setIsLoaded(true);
        onLoad?.();
      }}
      onError={(error) => {
        setHasError(true);
        onError?.(error);
      }}
    />
  );
};

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#1a1a1a',
  },
});

export default OptimizedImage;