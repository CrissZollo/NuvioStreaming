import React, { useState, useRef, useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '../../../contexts/ThemeContext';
import { StreamingContent } from '../../../services/catalogService';
import { Episode } from '../../../types/metadata';
import { TVMetadataHeroPanel } from './TVMetadataHeroPanel';
import { TVMetadataHeroImage } from './TVMetadataHeroImage';
import { TVMetadataTabBar, Tab } from './TVMetadataTabBar';
import { TVMetadataTabContent } from './TVMetadataTabContent';

// Layout constants
const TV_LAYOUT = {
  HERO_SECTION_HEIGHT: 0.48,    // 48% of screen height
  TAB_SECTION_HEIGHT: 0.52,     // 52% of screen height
  LEFT_PANEL_WIDTH: 0.42,       // 42% of screen width
  RIGHT_PANEL_WIDTH: 0.58,      // 58% of screen width
  HORIZONTAL_PADDING: 48,
  TAB_HEIGHT: 56,
};

// Tab configurations
const MOVIE_TABS: Tab[] = [
  { id: 'recommendations', label: 'More Like This' },
  { id: 'trailers', label: 'Trailers & More' },
  { id: 'details', label: 'Details' },
];

const SERIES_TABS: Tab[] = [
  { id: 'episodes', label: 'Episodes' },
  { id: 'recommendations', label: 'More Like This' },
  { id: 'trailers', label: 'Trailers & More' },
  { id: 'details', label: 'Details' },
];

export interface TVMetadataLayoutProps {
  metadata: StreamingContent;
  type: 'movie' | 'series';
  // Hero content
  bannerImage: string | null;
  logoUri: string | null;
  // Action handlers
  handleShowStreams: () => void;
  handleToggleLibrary: () => void;
  inLibrary: boolean;
  watchProgress: {
    currentTime: number;
    duration: number;
    lastUpdated: number;
    episodeId?: string;
  } | null;
  getPlayButtonText: () => string;
  // Series-specific
  episodes?: Episode[];
  groupedEpisodes?: { [season: number]: Episode[] };
  selectedSeason?: number;
  onSeasonChange?: (season: number) => void;
  onSelectEpisode?: (episode: Episode) => void;
  // Sections data
  recommendations: StreamingContent[];
  cast: any[];
  tmdbId: number | null;
  imdbId: string | null;
  contentId: string;
  // Navigation
  navigation: any;
  handleBack: () => void;
  // Trakt integration
  isAuthenticated?: boolean;
  isInWatchlist?: boolean;
  isInCollection?: boolean;
  onToggleWatchlist?: () => void;
  onToggleCollection?: () => void;
  // Styling
  dynamicBackgroundColor?: string;
}

const TVMetadataLayoutComponent: React.FC<TVMetadataLayoutProps> = (props) => {
  const {
    metadata,
    type,
    bannerImage,
    logoUri,
    handleShowStreams,
    handleToggleLibrary,
    inLibrary,
    watchProgress,
    getPlayButtonText,
    episodes = [],
    groupedEpisodes = {},
    selectedSeason = 1,
    onSeasonChange,
    onSelectEpisode,
    recommendations,
    cast,
    tmdbId,
    imdbId,
    contentId,
    navigation,
    handleBack,
    isAuthenticated,
    isInWatchlist,
    isInCollection,
    onToggleWatchlist,
    onToggleCollection,
    dynamicBackgroundColor,
  } = props;

  const { currentTheme } = useTheme();
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  // Determine if this is a series (has episodes)
  const isSeries = Object.keys(groupedEpisodes).length > 0;
  const tabs = isSeries ? SERIES_TABS : MOVIE_TABS;

  // Tab state - no tab selected by default
  const [activeTab, setActiveTab] = useState<string | null>(null);

  // Refs for focus navigation
  const playButtonRef = useRef<View>(null);
  const firstTabRef = useRef<View>(null);
  const activeTabRef = useRef<View>(null);
  const firstContentItemRef = useRef<View>(null);

  // Handle tab change
  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId);
  }, []);

  // Calculate dimensions
  const heroSectionHeight = screenHeight * TV_LAYOUT.HERO_SECTION_HEIGHT;
  const tabSectionHeight = screenHeight * TV_LAYOUT.TAB_SECTION_HEIGHT;
  const leftPanelWidth = screenWidth * TV_LAYOUT.LEFT_PANEL_WIDTH;
  const rightPanelWidth = screenWidth * TV_LAYOUT.RIGHT_PANEL_WIDTH;

  // Background color
  const backgroundColor = dynamicBackgroundColor || currentTheme.colors.darkBackground;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]} edges={[]}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      <View style={styles.mainContainer}>
        {/* Top Section - Hero (65% height) */}
        <Animated.View
          style={[styles.heroSection, { height: heroSectionHeight }]}
          entering={FadeIn.duration(300)}
        >
          {/* Left Panel - Metadata */}
          <View style={[styles.leftPanel, { width: leftPanelWidth }]}>
            <TVMetadataHeroPanel
              metadata={metadata}
              type={type}
              logoUri={logoUri}
              watchProgress={watchProgress}
              getPlayButtonText={getPlayButtonText}
              handleShowStreams={handleShowStreams}
              handleToggleLibrary={handleToggleLibrary}
              inLibrary={inLibrary}
              isAuthenticated={isAuthenticated}
              isInWatchlist={isInWatchlist}
              isInCollection={isInCollection}
              onToggleWatchlist={onToggleWatchlist}
              onToggleCollection={onToggleCollection}
              navigation={navigation}
              handleBack={handleBack}
              playButtonRef={playButtonRef}
              firstTabRef={firstTabRef}
              contentId={contentId}
              groupedEpisodes={groupedEpisodes}
            />
          </View>

          {/* Right Panel - Hero Image */}
          <View style={[styles.rightPanel, { width: rightPanelWidth }]}>
            <TVMetadataHeroImage
              bannerImage={bannerImage}
              posterImage={metadata.poster}
              backgroundColor={backgroundColor}
            />
          </View>
        </Animated.View>

        {/* Bottom Section - Tabs (35% height) */}
        <Animated.View
          style={[styles.tabSection, { height: tabSectionHeight }]}
          entering={FadeIn.duration(300).delay(100)}
        >
          {/* Tab Bar */}
          <TVMetadataTabBar
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={handleTabChange}
            firstTabRef={firstTabRef}
            activeTabRef={activeTabRef}
            playButtonRef={playButtonRef}
            firstContentItemRef={firstContentItemRef}
          />

          {/* Tab Content */}
          <View style={styles.tabContentContainer}>
            <TVMetadataTabContent
              activeTab={activeTab}
              metadata={metadata}
              type={type}
              episodes={episodes}
              groupedEpisodes={groupedEpisodes}
              selectedSeason={selectedSeason}
              onSeasonChange={onSeasonChange}
              onSelectEpisode={onSelectEpisode}
              recommendations={recommendations}
              cast={cast}
              tmdbId={tmdbId}
              imdbId={imdbId}
              contentId={contentId}
              firstContentItemRef={firstContentItemRef}
              activeTabRef={activeTabRef}
            />
          </View>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  heroSection: {
    flexDirection: 'row',
  },
  leftPanel: {
    paddingLeft: TV_LAYOUT.HORIZONTAL_PADDING,
    paddingRight: 24,
    paddingTop: 48,
    paddingBottom: 8,
    justifyContent: 'flex-start',
  },
  rightPanel: {
    overflow: 'hidden',
  },
  tabSection: {
    paddingHorizontal: TV_LAYOUT.HORIZONTAL_PADDING,
  },
  tabContentContainer: {
    flex: 1,
  },
});

export const TVMetadataLayout = memo(TVMetadataLayoutComponent);
