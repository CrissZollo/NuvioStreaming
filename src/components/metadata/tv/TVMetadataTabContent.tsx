import React, { memo } from 'react';
import {
  View,
  StyleSheet,
} from 'react-native';
import { StreamingContent } from '../../../services/catalogService';
import { Episode } from '../../../types/metadata';
import { TVEpisodesTabContent } from './TVEpisodesTabContent';
import { TVRecommendationsTabContent } from './TVRecommendationsTabContent';
import { TVCastTabContent } from './TVCastTabContent';
import { TVTrailersTabContent } from './TVTrailersTabContent';

interface TVMetadataTabContentProps {
  activeTab: string | null;
  metadata: StreamingContent;
  type: 'movie' | 'series';
  // Episodes
  episodes: Episode[];
  groupedEpisodes: { [season: number]: Episode[] };
  selectedSeason: number;
  onSeasonChange?: (season: number) => void;
  onSelectEpisode?: (episode: Episode) => void;
  // Other sections
  recommendations: StreamingContent[];
  loadingRecommendations?: boolean;
  cast: any[];
  tmdbId: number | null;
  contentId: string;
  // Focus navigation
  firstContentItemRef: React.RefObject<View>;
  activeTabRef: React.RefObject<View>;
}

const TVMetadataTabContentComponent: React.FC<TVMetadataTabContentProps> = ({
  activeTab,
  metadata,
  type,
  episodes,
  groupedEpisodes,
  selectedSeason,
  onSeasonChange,
  onSelectEpisode,
  recommendations,
  loadingRecommendations = false,
  cast,
  tmdbId,
  contentId,
  firstContentItemRef,
  activeTabRef,
}) => {
  const renderContent = () => {
    switch (activeTab) {
      case 'episodes':
        return (
          <TVEpisodesTabContent
            episodes={episodes}
            groupedEpisodes={groupedEpisodes}
            selectedSeason={selectedSeason}
            onSeasonChange={onSeasonChange}
            onSelectEpisode={onSelectEpisode}
            metadata={metadata}
            firstContentItemRef={firstContentItemRef}
            activeTabRef={activeTabRef}
          />
        );

      case 'recommendations':
        return (
          <TVRecommendationsTabContent
            recommendations={recommendations}
            loading={loadingRecommendations}
            firstContentItemRef={firstContentItemRef}
            activeTabRef={activeTabRef}
          />
        );

      case 'cast':
        return (
          <TVCastTabContent
            cast={cast}
            firstContentItemRef={firstContentItemRef}
            activeTabRef={activeTabRef}
          />
        );

      case 'trailers':
        return (
          <TVTrailersTabContent
            tmdbId={tmdbId}
            type={type === 'series' ? 'tv' : 'movie'}
            contentId={contentId}
            contentTitle={metadata.name}
            firstContentItemRef={firstContentItemRef}
            activeTabRef={activeTabRef}
          />
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {renderContent()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 12,
  },
});

export const TVMetadataTabContent = memo(TVMetadataTabContentComponent);
