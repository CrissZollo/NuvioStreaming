import React, { memo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../../contexts/ThemeContext';
import { StreamingContent } from '../../../services/catalogService';

interface TVMetadataHeroImageProps {
  bannerImage: string | null;
  posterImage?: string;
  backgroundColor: string;
  metadata?: StreamingContent;
  type?: 'movie' | 'series';
}

const TVMetadataHeroImageComponent: React.FC<TVMetadataHeroImageProps> = ({
  bannerImage,
  posterImage,
  backgroundColor,
  metadata,
  type,
}) => {
  const { currentTheme } = useTheme();
  const imageUri = bannerImage || posterImage;

  // Format date helper
  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }, []);

  // Build compact details array
  const getCompactDetails = useCallback(() => {
    if (!metadata) return [];

    const details: { label: string; value: string }[] = [];

    if (type === 'movie' && metadata.movieDetails) {
      const md = metadata.movieDetails;
      if (md.status) details.push({ label: 'Status', value: md.status });
      if (md.releaseDate) details.push({ label: 'Released', value: formatDate(md.releaseDate) });
      if (md.budget && md.budget > 0) details.push({ label: 'Budget', value: `$${(md.budget / 1000000).toFixed(0)}M` });
      if (md.revenue && md.revenue > 0) details.push({ label: 'Revenue', value: `$${(md.revenue / 1000000).toFixed(0)}M` });
    } else if (type === 'series' && metadata.tvDetails) {
      const td = metadata.tvDetails;
      if (td.status) details.push({ label: 'Status', value: td.status });
      if (td.numberOfSeasons) details.push({ label: 'Seasons', value: td.numberOfSeasons.toString() });
      if (td.numberOfEpisodes) details.push({ label: 'Episodes', value: td.numberOfEpisodes.toString() });
      if (td.firstAirDate) details.push({ label: 'First Aired', value: formatDate(td.firstAirDate) });
    }

    // Add directors/creators
    if (metadata.directors && metadata.directors.length > 0) {
      details.push({ label: 'Director', value: metadata.directors.slice(0, 2).join(', ') });
    } else if (metadata.creators && metadata.creators.length > 0) {
      details.push({ label: 'Creator', value: metadata.creators.slice(0, 2).join(', ') });
    }

    return details.slice(0, 5); // Limit to 5 items
  }, [metadata, type, formatDate]);

  const compactDetails = getCompactDetails();

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

      {/* Compact Details Overlay - Top Right */}
      {compactDetails.length > 0 && (
        <View style={styles.detailsOverlay}>
          {compactDetails.map((detail, index) => (
            <View key={index} style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: currentTheme.colors.textMuted }]}>
                {detail.label}
              </Text>
              <Text style={[styles.detailValue, { color: currentTheme.colors.highEmphasis }]}>
                {detail.value}
              </Text>
            </View>
          ))}
        </View>
      )}
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
  detailsOverlay: {
    position: 'absolute',
    top: 24,
    right: 24,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 140,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
    gap: 16,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'right',
  },
});

export const TVMetadataHeroImage = memo(TVMetadataHeroImageComponent);
