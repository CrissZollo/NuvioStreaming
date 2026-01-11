import React, { memo } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import { LinearGradient } from 'expo-linear-gradient';

interface TVMetadataHeroImageProps {
  bannerImage: string | null;
  posterImage?: string;
  backgroundColor: string;
}

const TVMetadataHeroImageComponent: React.FC<TVMetadataHeroImageProps> = ({
  bannerImage,
  posterImage,
  backgroundColor,
}) => {
  const imageUri = bannerImage || posterImage;

  if (!imageUri) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <View style={styles.placeholder} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Main Hero Image */}
      <FastImage
        source={{ uri: imageUri }}
        style={styles.heroImage}
        resizeMode={FastImage.resizeMode.cover}
      />

      {/* Left gradient - blends into metadata panel */}
      <LinearGradient
        colors={[
          backgroundColor,
          `${backgroundColor}E6`, // 90% opacity
          `${backgroundColor}99`, // 60% opacity
          `${backgroundColor}4D`, // 30% opacity
          'transparent',
        ]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 0.5, y: 0.5 }}
        style={styles.leftGradient}
      />

      {/* Bottom gradient - blends into tab section */}
      <LinearGradient
        colors={[
          'transparent',
          `${backgroundColor}4D`, // 30% opacity
          `${backgroundColor}99`, // 60% opacity
          `${backgroundColor}CC`, // 80% opacity
          backgroundColor,
        ]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.bottomGradient}
      />

      {/* Top gradient - subtle fade for polish */}
      <LinearGradient
        colors={[
          `${backgroundColor}66`, // 40% opacity
          'transparent',
        ]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.3 }}
        style={styles.topGradient}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  leftGradient: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '50%',
  },
  bottomGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '40%',
  },
  topGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '30%',
  },
});

export const TVMetadataHeroImage = memo(TVMetadataHeroImageComponent);
