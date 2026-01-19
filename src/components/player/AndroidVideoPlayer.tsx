import React, { useRef, useEffect, useMemo, useCallback, useState } from 'react';
import { View, StyleSheet, Platform, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { toast } from '@backpackapp-io/react-native-toast';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/AppNavigator';

// Shared Hooks (cross-platform)
import {
  usePlayerState,
  usePlayerModals,
  useSpeedControl,
  useOpeningAnimation,
  useWatchProgress
} from './hooks';

// Android-specific hooks
import { usePlayerSetup } from './android/hooks/usePlayerSetup';
import { usePlayerTracks } from './android/hooks/usePlayerTracks';

import { usePlayerControls } from './android/hooks/usePlayerControls';
import { useNextEpisode } from './android/hooks/useNextEpisode';

// App-level Hooks
import { useTraktAutosync } from '../../hooks/useTraktAutosync';
import { useMetadata } from '../../hooks/useMetadata';
import { usePlayerGestureControls } from '../../hooks/usePlayerGestureControls';
import { useSettings } from '../../hooks/useSettings';

// Shared Components
import { GestureControls, PauseOverlay, SpeedActivatedOverlay } from './components';
import LoadingOverlay from './modals/LoadingOverlay';
import PlayerControls from './controls/PlayerControls';
import TVPlayerControls from './tv/TVPlayerControls';
import { AudioTrackModal } from './modals/AudioTrackModal';
import { useIsTV } from '../../contexts/TVContext';
import { SubtitleModals } from './modals/SubtitleModals';
import SpeedModal from './modals/SpeedModal';
import { SourcesModal } from './modals/SourcesModal';
import { EpisodesModal } from './modals/EpisodesModal';
import { EpisodeStreamsModal } from './modals/EpisodeStreamsModal';
import { ErrorModal } from './modals/ErrorModal';
import { CustomSubtitles } from './subtitles/CustomSubtitles';
import ParentalGuideOverlay from './overlays/ParentalGuideOverlay';

// Android-specific components
import { VideoSurface } from './android/components/VideoSurface';
import { ExoPlayerRef } from './android/ExoPlayer';

// Utils
import { logger } from '../../utils/logger';
import { styles } from './utils/playerStyles';
import { formatTime, isHlsStream, getHlsHeaders, defaultAndroidHeaders, parseSRT } from './utils/playerUtils';
import { storageService } from '../../services/storageService';
import stremioService from '../../services/stremioService';
import { VideoPlayerService } from '../../services/videoPlayerService';
import { WyzieSubtitle, SubtitleCue } from './utils/playerTypes';
import { perfMonitor, PERF_MONITOR_ENABLED } from '../../utils/performanceMonitor';
import axios from 'axios';

const DEBUG_MODE = false;
const DEBUG_PLAYER_STATE = true; // ENABLED for debugging performance issues
let lastStateLogTime = 0;

const AndroidVideoPlayer: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'PlayerAndroid'>>();
  const insets = useSafeAreaInsets();

  const {
    uri, title = 'Episode Name', season, episode, episodeTitle, quality, year,
    streamProvider, streamName, headers, id, type, episodeId, imdbId,
    availableStreams: passedAvailableStreams, backdrop, groupedEpisodes
  } = route.params;

  // --- State & Custom Hooks ---

  const playerState = usePlayerState();
  const modals = usePlayerModals();
  const speedControl = useSpeedControl();
  const { settings } = useSettings();
  const isTVDevice = useIsTV();

  // State for TV focus restoration after modal closes
  const [shouldRestoreFocus, setShouldRestoreFocus] = useState(false);

  const videoRef = useRef<any>(null);
  const exoPlayerRef = useRef<ExoPlayerRef>(null);
  const pinchRef = useRef(null);
  const tracksHook = usePlayerTracks();

  // Player ref - always ExoPlayer
  const activePlayerRef = exoPlayerRef;

  // Track if we've already applied default track preferences for this session
  const hasAppliedDefaultTracksRef = useRef(false);

  // Helper function to find the best matching track by language
  const findTrackByLanguage = useCallback((tracks: any[], preferredLanguage: string): number | null => {
    if (!preferredLanguage || !tracks || tracks.length === 0) return null;

    const langLower = preferredLanguage.toLowerCase();

    // Try exact match first (e.g., 'en' matches 'en' or 'eng')
    for (const track of tracks) {
      const trackLang = (track.language || '').toLowerCase();
      if (trackLang === langLower ||
          trackLang.startsWith(langLower) ||
          langLower.startsWith(trackLang)) {
        return track.id;
      }
    }

    // Try matching by common language codes
    const langMappings: { [key: string]: string[] } = {
      'en': ['en', 'eng', 'english'],
      'es': ['es', 'spa', 'spanish'],
      'fr': ['fr', 'fra', 'fre', 'french'],
      'de': ['de', 'deu', 'ger', 'german'],
      'it': ['it', 'ita', 'italian'],
      'pt': ['pt', 'por', 'portuguese'],
      'ru': ['ru', 'rus', 'russian'],
      'ja': ['ja', 'jpn', 'japanese'],
      'ko': ['ko', 'kor', 'korean'],
      'zh': ['zh', 'zho', 'chi', 'chinese'],
      'ar': ['ar', 'ara', 'arabic'],
      'hi': ['hi', 'hin', 'hindi'],
      'nl': ['nl', 'nld', 'dut', 'dutch'],
      'pl': ['pl', 'pol', 'polish'],
      'tr': ['tr', 'tur', 'turkish'],
      'sv': ['sv', 'swe', 'swedish'],
      'da': ['da', 'dan', 'danish'],
      'no': ['no', 'nor', 'norwegian'],
      'fi': ['fi', 'fin', 'finnish'],
      'cs': ['cs', 'ces', 'cze', 'czech'],
      'hu': ['hu', 'hun', 'hungarian'],
      'ro': ['ro', 'ron', 'rum', 'romanian'],
      'el': ['el', 'ell', 'gre', 'greek'],
      'he': ['he', 'heb', 'hebrew'],
      'th': ['th', 'tha', 'thai'],
      'vi': ['vi', 'vie', 'vietnamese'],
      'id': ['id', 'ind', 'indonesian'],
      'ms': ['ms', 'msa', 'may', 'malay'],
      'uk': ['uk', 'ukr', 'ukrainian'],
    };

    const matchingCodes = langMappings[langLower] || [langLower];

    for (const track of tracks) {
      const trackLang = (track.language || '').toLowerCase();
      if (matchingCodes.some(code => trackLang.includes(code) || code.includes(trackLang))) {
        return track.id;
      }
    }

    return null;
  }, []);

  // Helper function to find the best matching SUPPORTED track by language
  const findSupportedTrackByLanguage = useCallback((tracks: any[], preferredLanguage: string): number | null => {
    if (!preferredLanguage || !tracks || tracks.length === 0) return null;

    const langLower = preferredLanguage.toLowerCase();

    // Language mapping for matching different codes
    const langMappings: { [key: string]: string[] } = {
      'en': ['en', 'eng', 'english'],
      'es': ['es', 'spa', 'spanish'],
      'fr': ['fr', 'fra', 'fre', 'french'],
      'de': ['de', 'deu', 'ger', 'german'],
      'it': ['it', 'ita', 'italian'],
      'pt': ['pt', 'por', 'portuguese'],
      'ru': ['ru', 'rus', 'russian'],
      'ja': ['ja', 'jpn', 'japanese'],
      'ko': ['ko', 'kor', 'korean'],
      'zh': ['zh', 'zho', 'chi', 'chinese'],
      'ar': ['ar', 'ara', 'arabic'],
      'hi': ['hi', 'hin', 'hindi'],
      'nl': ['nl', 'nld', 'dut', 'dutch'],
      'pl': ['pl', 'pol', 'polish'],
      'tr': ['tr', 'tur', 'turkish'],
      'sv': ['sv', 'swe', 'swedish'],
      'da': ['da', 'dan', 'danish'],
      'no': ['no', 'nor', 'norwegian'],
      'fi': ['fi', 'fin', 'finnish'],
      'cs': ['cs', 'ces', 'cze', 'czech'],
      'hu': ['hu', 'hun', 'hungarian'],
      'ro': ['ro', 'ron', 'rum', 'romanian'],
      'el': ['el', 'ell', 'gre', 'greek'],
      'he': ['he', 'heb', 'hebrew'],
      'th': ['th', 'tha', 'thai'],
      'vi': ['vi', 'vie', 'vietnamese'],
      'id': ['id', 'ind', 'indonesian'],
      'ms': ['ms', 'msa', 'may', 'malay'],
      'uk': ['uk', 'ukr', 'ukrainian'],
    };

    const matchingCodes = langMappings[langLower] || [langLower];

    // Helper to check if track language matches
    const isLanguageMatch = (trackLang: string): boolean => {
      const trackLangLower = trackLang.toLowerCase();
      return trackLangLower === langLower ||
             trackLangLower.startsWith(langLower) ||
             langLower.startsWith(trackLangLower) ||
             matchingCodes.some(code => trackLangLower.includes(code) || code.includes(trackLangLower));
    };

    // First, try to find a SUPPORTED track matching the language
    for (const track of tracks) {
      const trackLang = (track.language || '').toLowerCase();
      const isSupported = track.supported !== false; // Default to supported if not specified

      if (isSupported && isLanguageMatch(trackLang)) {
        console.log('[AndroidVideoPlayer] Found supported track matching language:', track.id, trackLang);
        return track.id;
      }
    }

    // If no supported track matches the preferred language, don't select anything
    // (let the native player handle default selection or show error)
    console.log('[AndroidVideoPlayer] No supported track found for language:', preferredLanguage);
    return null;
  }, []);

  // Apply default track preferences when tracks are loaded
  const applyDefaultTrackPreferences = useCallback((audioTracks: any[], subtitleTracks: any[]) => {
    if (hasAppliedDefaultTracksRef.current) return;
    hasAppliedDefaultTracksRef.current = true;

    // Check if there are any supported audio tracks at all
    const supportedAudioTracks = audioTracks?.filter(t => t.supported !== false) || [];

    console.log('[AndroidVideoPlayer] Applying default track preferences:', {
      defaultAudioLanguage: settings.defaultAudioLanguage,
      defaultSubtitleLanguage: settings.defaultSubtitleLanguage,
      defaultSubtitleEnabled: settings.defaultSubtitleEnabled,
      audioTracksCount: audioTracks?.length || 0,
      supportedAudioTracksCount: supportedAudioTracks.length,
      subtitleTracksCount: subtitleTracks?.length || 0,
    });

    // Apply default audio language with fallback chain: preferred → English → first available
    if (supportedAudioTracks.length > 0) {
      let selectedTrackId: number | null = null;

      // 1. Try preferred language first
      if (settings.defaultAudioLanguage) {
        selectedTrackId = findSupportedTrackByLanguage(audioTracks, settings.defaultAudioLanguage);
        if (selectedTrackId !== null) {
          console.log('[AndroidVideoPlayer] Auto-selecting preferred audio track:', selectedTrackId);
        }
      }

      // 2. Fallback to English if preferred not found
      if (selectedTrackId === null) {
        selectedTrackId = findSupportedTrackByLanguage(audioTracks, 'en');
        if (selectedTrackId !== null) {
          console.log('[AndroidVideoPlayer] Fallback to English audio track:', selectedTrackId);
        }
      }

      // 3. Fallback to first available supported track
      if (selectedTrackId === null && supportedAudioTracks.length > 0) {
        selectedTrackId = supportedAudioTracks[0].id;
        console.log('[AndroidVideoPlayer] Fallback to first supported audio track:', selectedTrackId);
      }

      // Apply the selected track
      if (selectedTrackId !== null) {
        tracksHook.setSelectedAudioTrack({ type: 'index', value: selectedTrackId });
        if (activePlayerRef.current) {
          activePlayerRef.current.setAudioTrack(selectedTrackId);
        }
      }
    } else if (audioTracks && audioTracks.length > 0) {
      // All audio tracks are unsupported - don't try to auto-select, let native handle the error
      console.log('[AndroidVideoPlayer] No supported audio tracks available - skipping auto-selection');
    }

    // Apply default subtitle language - if no match found, disable subtitles (don't default to first)
    if (settings.defaultSubtitleLanguage === 'off' || !settings.defaultSubtitleEnabled) {
      // Explicitly disabled - disable subtitles
      console.log('[AndroidVideoPlayer] Disabling subtitles (user preference)');
      tracksHook.setSelectedTextTrack(-1);
      if (activePlayerRef.current) {
        activePlayerRef.current.setSubtitleTrack(-1);
      }
    } else if (settings.defaultSubtitleLanguage && subtitleTracks && subtitleTracks.length > 0) {
      const matchingSubtitleTrackId = findTrackByLanguage(subtitleTracks, settings.defaultSubtitleLanguage);
      if (matchingSubtitleTrackId !== null) {
        console.log('[AndroidVideoPlayer] Auto-selecting subtitle track:', matchingSubtitleTrackId);
        tracksHook.setSelectedTextTrack(matchingSubtitleTrackId);
        if (activePlayerRef.current) {
          activePlayerRef.current.setSubtitleTrack(matchingSubtitleTrackId);
        }
      } else {
        // No matching language found - disable subtitles (don't default to first available)
        console.log('[AndroidVideoPlayer] No matching subtitle language found, disabling subtitles');
        tracksHook.setSelectedTextTrack(-1);
        if (activePlayerRef.current) {
          activePlayerRef.current.setSubtitleTrack(-1);
        }
      }
    } else {
      // No preference set - disable subtitles by default
      console.log('[AndroidVideoPlayer] No subtitle preference set, disabling subtitles');
      tracksHook.setSelectedTextTrack(-1);
      if (activePlayerRef.current) {
        activePlayerRef.current.setSubtitleTrack(-1);
      }
    }
  }, [settings.defaultAudioLanguage, settings.defaultSubtitleLanguage, settings.defaultSubtitleEnabled, findTrackByLanguage, findSupportedTrackByLanguage, tracksHook, activePlayerRef]);

  const [currentStreamUrl, setCurrentStreamUrl] = useState<string>(uri);
  const [currentVideoType, setCurrentVideoType] = useState<string | undefined>((route.params as any).videoType);

  const [availableStreams, setAvailableStreams] = useState<any>(passedAvailableStreams || {});
  const [currentQuality, setCurrentQuality] = useState(quality);
  const [currentStreamProvider, setCurrentStreamProvider] = useState(streamProvider);
  const [currentStreamName, setCurrentStreamName] = useState(streamName);

  // State to force unmount VideoSurface during stream transitions
  const [isTransitioningStream, setIsTransitioningStream] = useState(false);

  // State for audio track switching with buffering
  const [isChangingAudioTrack, setIsChangingAudioTrack] = useState(false);

  // Subtitle addon state
  const [availableSubtitles, setAvailableSubtitles] = useState<WyzieSubtitle[]>([]);
  const [isLoadingSubtitleList, setIsLoadingSubtitleList] = useState(false);
  const [isLoadingSubtitles, setIsLoadingSubtitles] = useState(false);
  const [useCustomSubtitles, setUseCustomSubtitles] = useState(false);
  const [customSubtitles, setCustomSubtitles] = useState<SubtitleCue[]>([]);
  const [currentSubtitle, setCurrentSubtitle] = useState<string>('');

  // Subtitle customization state
  const [subtitleSize, setSubtitleSize] = useState(28);
  const [subtitleBackground, setSubtitleBackground] = useState(false);
  const [subtitleTextColor, setSubtitleTextColor] = useState('#FFFFFF');
  const [subtitleBgOpacity, setSubtitleBgOpacity] = useState(0.7);
  const [subtitleTextShadow, setSubtitleTextShadow] = useState(true);
  const [subtitleOutline, setSubtitleOutline] = useState(true);
  const [subtitleOutlineColor, setSubtitleOutlineColor] = useState('#000000');
  const [subtitleOutlineWidth, setSubtitleOutlineWidth] = useState(3);
  const [subtitleAlign, setSubtitleAlign] = useState<'center' | 'left' | 'right'>('center');
  const [subtitleBottomOffset, setSubtitleBottomOffset] = useState(20);
  const [subtitleLetterSpacing, setSubtitleLetterSpacing] = useState(0);
  const [subtitleLineHeightMultiplier, setSubtitleLineHeightMultiplier] = useState(1.2);
  const [subtitleOffsetSec, setSubtitleOffsetSec] = useState(0);

  const metadataResult = useMetadata({ id: id || 'placeholder', type: (type as any) });
  const { metadata, cast } = Boolean(id && type) ? (metadataResult as any) : { metadata: null, cast: [] };
  const hasLogo = metadata && metadata.logo;
  const openingAnimation = useOpeningAnimation(backdrop, metadata);

  const [volume, setVolume] = useState(1.0);
  const [brightness, setBrightness] = useState(1.0);
  const setupHook = usePlayerSetup(playerState.setScreenDimensions, setVolume, setBrightness, playerState.paused);

  const controlsHook = usePlayerControls(
    activePlayerRef,
    playerState.paused,
    playerState.setPaused,
    playerState.currentTime,
    playerState.duration,
    playerState.isSeeking,
    playerState.isMounted
  );

  const traktAutosync = useTraktAutosync({
    id: id || '',
    type: type === 'series' ? 'series' : 'movie',
    title: episodeTitle || title,
    year: year || 0,
    imdbId: imdbId || '',
    season: season,
    episode: episode,
    showTitle: title,
    showYear: year,
    showImdbId: imdbId,
    episodeId: episodeId
  });

  const watchProgress = useWatchProgress(
    id, type, episodeId,
    playerState.currentTime,
    playerState.duration,
    playerState.paused,
    traktAutosync,
    controlsHook.seekToTime
  );

  const gestureControls = usePlayerGestureControls({
    volume,
    setVolume,
    brightness,
    setBrightness,
    volumeRange: { min: 0, max: 1 },
    volumeSensitivity: 0.006,
    brightnessSensitivity: 0.004,
    debugMode: DEBUG_MODE,
  });

  const nextEpisodeHook = useNextEpisode(type, season, episode, groupedEpisodes, (metadataResult as any)?.groupedEpisodes, episodeId);

  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: playerState.showControls ? 1 : 0,
      duration: 300,
      useNativeDriver: true
    }).start();
  }, [playerState.showControls]);

  useEffect(() => {
    openingAnimation.startOpeningAnimation();
  }, []);

  // Start performance monitoring on mount (TV only to diagnose sluggishness)
  useEffect(() => {
    if (isTVDevice && PERF_MONITOR_ENABLED) {
      perfMonitor.reset();
      perfMonitor.start();
      console.log('[AndroidVideoPlayer] Performance monitoring started');

      return () => {
        perfMonitor.stop();
        console.log('[AndroidVideoPlayer] Performance monitoring stopped');
      };
    }
  }, [isTVDevice]);

  // Auto-show controls on TV after video loads
  useEffect(() => {
    if (isTVDevice && playerState.isVideoLoaded && openingAnimation.shouldHideOpeningOverlay) {
      // Show controls initially on TV so user knows they can interact
      playerState.setShowControls(true);
    }
  }, [isTVDevice, playerState.isVideoLoaded, openingAnimation.shouldHideOpeningOverlay]);

  // Load subtitle settings on mount
  useEffect(() => {
    const loadSubtitleSettings = async () => {
      const settings = await storageService.getSubtitleSettings();
      if (settings) {
        if (settings.subtitleSize !== undefined) setSubtitleSize(settings.subtitleSize);
        if (settings.subtitleBackground !== undefined) setSubtitleBackground(settings.subtitleBackground);
        if (settings.subtitleTextColor !== undefined) setSubtitleTextColor(settings.subtitleTextColor);
        if (settings.subtitleBgOpacity !== undefined) setSubtitleBgOpacity(settings.subtitleBgOpacity);
        if (settings.subtitleTextShadow !== undefined) setSubtitleTextShadow(settings.subtitleTextShadow);
        if (settings.subtitleOutline !== undefined) setSubtitleOutline(settings.subtitleOutline);
        if (settings.subtitleOutlineColor !== undefined) setSubtitleOutlineColor(settings.subtitleOutlineColor);
        if (settings.subtitleOutlineWidth !== undefined) setSubtitleOutlineWidth(settings.subtitleOutlineWidth);
        if (settings.subtitleAlign !== undefined) setSubtitleAlign(settings.subtitleAlign);
        if (settings.subtitleBottomOffset !== undefined) setSubtitleBottomOffset(settings.subtitleBottomOffset);
        if (settings.subtitleLetterSpacing !== undefined) setSubtitleLetterSpacing(settings.subtitleLetterSpacing);
        if (settings.subtitleLineHeightMultiplier !== undefined) setSubtitleLineHeightMultiplier(settings.subtitleLineHeightMultiplier);
      }
    };
    loadSubtitleSettings();
  }, []);

  // Save subtitle settings when they change
  useEffect(() => {
    const saveSettings = async () => {
      await storageService.saveSubtitleSettings({
        subtitleSize,
        subtitleBackground,
        subtitleTextColor,
        subtitleBgOpacity,
        subtitleTextShadow,
        subtitleOutline,
        subtitleOutlineColor,
        subtitleOutlineWidth,
        subtitleAlign,
        subtitleBottomOffset,
        subtitleLetterSpacing,
        subtitleLineHeightMultiplier,
      });
    };
    saveSettings();
  }, [
    subtitleSize, subtitleBackground, subtitleTextColor, subtitleBgOpacity,
    subtitleTextShadow, subtitleOutline, subtitleOutlineColor, subtitleOutlineWidth,
    subtitleAlign, subtitleBottomOffset, subtitleLetterSpacing, subtitleLineHeightMultiplier
  ]);

  // Note: ExoPlayer doesn't support subtitle styling - it uses system defaults
  // Custom subtitles are rendered via CustomSubtitles component instead

  const handleLoad = useCallback((data: any) => {
    if (!playerState.isMounted.current) return;

    const videoDuration = data.duration;
    console.log('[AndroidVideoPlayer] handleLoad called:', {
      duration: videoDuration,
      initialPosition: watchProgress.initialPosition,
      showResumeOverlay: watchProgress.showResumeOverlay,
      initialSeekTarget: watchProgress.initialSeekTargetRef?.current
    });

    if (videoDuration > 0) {
      playerState.setDuration(videoDuration);
      if (id && type) {
        storageService.setContentDuration(id, type, videoDuration, episodeId);
        storageService.updateProgressDuration(id, type, videoDuration, episodeId);
      }
    }

    if (data.naturalSize) {
      playerState.setVideoAspectRatio(data.naturalSize.width / data.naturalSize.height);
    } else {
      playerState.setVideoAspectRatio(16 / 9);
    }

    if (data.audioTracks) {
      const formatted = data.audioTracks.map((t: any, i: number) => ({
        id: t.index !== undefined ? t.index : i,
        name: t.title || t.name || `Track ${i + 1}`,
        language: t.language
      }));
      tracksHook.setRnVideoAudioTracks(formatted);
    }
    if (data.textTracks) {
      const formatted = data.textTracks.map((t: any, i: number) => ({
        id: t.index !== undefined ? t.index : i,
        name: t.title || t.name || `Track ${i + 1}`,
        language: t.language
      }));
      tracksHook.setRnVideoTextTracks(formatted);
    }

    playerState.setIsVideoLoaded(true);
    openingAnimation.completeOpeningAnimation();

    // Handle Resume - check resumeFromPosition first (source switch), then watchProgress
    // Priority: resumeFromPosition > initialPosition > initialSeekTargetRef
    const resumeFromPosition = (route.params as any).resumeFromPosition;
    const resumeTarget = resumeFromPosition || watchProgress.initialPosition || watchProgress.initialSeekTargetRef?.current;

    if (resumeFromPosition && resumeFromPosition > 0 && videoDuration > 0) {
      // Source switch - resume from captured position immediately
      console.log('[AndroidVideoPlayer] Resuming from source switch position:', resumeFromPosition, 'duration:', videoDuration);
      setTimeout(() => {
        if (activePlayerRef.current) {
          activePlayerRef.current.seek(Math.min(resumeFromPosition, videoDuration - 0.5));
        }
      }, 200);
    } else if (resumeTarget && resumeTarget > 0 && !watchProgress.showResumeOverlay && videoDuration > 0) {
      // Normal resume from watch progress
      console.log('[AndroidVideoPlayer] Seeking to resume position:', resumeTarget, 'duration:', videoDuration);
      // Use a small delay to ensure the player is ready, then seek directly
      setTimeout(() => {
        if (activePlayerRef.current) {
          console.log('[AndroidVideoPlayer] Calling activePlayerRef.current.seek directly');
          activePlayerRef.current.seek(Math.min(resumeTarget, videoDuration - 0.5));
        }
      }, 200);
    }
  }, [id, type, episodeId, playerState.isMounted, watchProgress.initialPosition, activePlayerRef, route.params]);

  // Track last progress update time to throttle updates on TV
  const lastProgressUpdateRef = useRef<number>(0);
  const PROGRESS_UPDATE_INTERVAL_MS = isTVDevice ? 2000 : 500; // 2 seconds on TV, 0.5 on mobile

  // Throttle buffer state updates on TV to prevent excessive re-renders
  // Buffer events fire rapidly during seeking and can cause UI sluggishness
  const lastBufferUpdateRef = useRef<number>(0);
  const lastBufferStateRef = useRef<boolean>(false);
  const BUFFER_UPDATE_INTERVAL_MS = isTVDevice ? 500 : 100; // 500ms on TV, 100ms on mobile

  const handleBuffer = useCallback((buf: { isBuffering: boolean }) => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastBufferUpdateRef.current;
    const stateChanged = buf.isBuffering !== lastBufferStateRef.current;

    if (DEBUG_PLAYER_STATE) {
      console.log(`[AndroidVideoPlayer] BUFFER_EVENT isBuffering=${buf.isBuffering} stateChanged=${stateChanged} timeSinceLastUpdate=${timeSinceLastUpdate}ms`);
    }

    // Only update if state changed AND enough time has passed
    // This prevents rapid toggling between buffering states from causing re-renders
    if (stateChanged && timeSinceLastUpdate >= BUFFER_UPDATE_INTERVAL_MS) {
      if (DEBUG_PLAYER_STATE) {
        console.log(`[AndroidVideoPlayer] BUFFER_STATE_UPDATE applying state=${buf.isBuffering}`);
      }
      lastBufferUpdateRef.current = now;
      lastBufferStateRef.current = buf.isBuffering;
      playerState.setIsBuffering(buf.isBuffering);
    } else if (stateChanged && buf.isBuffering) {
      // Always show buffering immediately (user needs feedback)
      // But throttle the "not buffering" state to prevent flicker
      if (DEBUG_PLAYER_STATE) {
        console.log(`[AndroidVideoPlayer] BUFFER_STATE_UPDATE immediate buffering=true`);
      }
      lastBufferUpdateRef.current = now;
      lastBufferStateRef.current = buf.isBuffering;
      playerState.setIsBuffering(buf.isBuffering);
    } else if (DEBUG_PLAYER_STATE && stateChanged) {
      console.log(`[AndroidVideoPlayer] BUFFER_STATE_UPDATE throttled (would set ${buf.isBuffering})`);
    }
  }, [isTVDevice, playerState]);

  // Store currentTime in ref for handleProgress to avoid recreating callback on every time change
  const playerCurrentTimeRef = useRef(playerState.currentTime);
  playerCurrentTimeRef.current = playerState.currentTime;

  const handleProgress = useCallback((data: any) => {
    const now = Date.now();

    if (playerState.isDragging.current || playerState.isSeeking.current || !playerState.isMounted.current || setupHook.isAppBackgrounded.current) {
      if (DEBUG_PLAYER_STATE && now - lastStateLogTime > 1000) {
        lastStateLogTime = now;
        console.log(`[AndroidVideoPlayer] PROGRESS_SKIP dragging=${playerState.isDragging.current} seeking=${playerState.isSeeking.current} mounted=${playerState.isMounted.current} bg=${setupHook.isAppBackgrounded.current}`);
      }
      return;
    }

    const timeSinceLastUpdate = now - lastProgressUpdateRef.current;

    // Throttle updates based on device type
    if (timeSinceLastUpdate < PROGRESS_UPDATE_INTERVAL_MS) return;

    const currentTimeInSeconds = data.currentTime;
    // Only update if time has changed significantly (1 second threshold)
    // Use ref to access current time without needing it in dependency array
    if (Math.abs(currentTimeInSeconds - playerCurrentTimeRef.current) > 1.0) {
      if (DEBUG_PLAYER_STATE) {
        console.log(`[AndroidVideoPlayer] PROGRESS_UPDATE time=${currentTimeInSeconds.toFixed(2)}s playable=${data.playableDuration?.toFixed(2)}s`);
      }
      lastProgressUpdateRef.current = now;
      playerState.setCurrentTime(currentTimeInSeconds);
      playerState.setBuffered(data.playableDuration || currentTimeInSeconds);
    }
  }, [playerState.isDragging, playerState.isSeeking, setupHook.isAppBackgrounded, isTVDevice]);

  // Sync custom subtitle text with current playback time
  useEffect(() => {
    if (!useCustomSubtitles || customSubtitles.length === 0) return;

    const cueNow = customSubtitles.find(
      cue => playerState.currentTime >= cue.start && playerState.currentTime <= cue.end
    );
    setCurrentSubtitle(cueNow ? cueNow.text : '');
  }, [playerState.currentTime, useCustomSubtitles, customSubtitles]);

  const toggleControls = useCallback(() => {
    playerState.setShowControls(prev => !prev);
  }, []);

  const hideControls = useCallback(() => {
    if (playerState.isDragging.current) return;
    playerState.setShowControls(false);
  }, []);

  // Memoized callbacks for TVPlayerControls to prevent unnecessary re-renders
  const showControls = useCallback(() => {
    playerState.setShowControls(true);
  }, []);

  // CRITICAL: Extract setter functions to avoid depending on the entire modals object
  // The modals object reference changes on every render, causing callback recreation
  const {
    setShowSubtitleModal,
    setShowAudioModal,
    setShowSourcesModal,
    setShowEpisodesModal,
    setShowEpisodeStreamsModal,
    setSelectedEpisodeForStreams,
  } = modals;

  const handleShowSubtitles = useCallback(() => {
    setShowSubtitleModal(true);
  }, [setShowSubtitleModal]);

  const handleShowAudioTracks = useCallback(() => {
    setShowAudioModal(true);
  }, [setShowAudioModal]);

  const handleShowSources = useCallback(() => {
    setShowSourcesModal(true);
  }, [setShowSourcesModal]);

  const handleShowEpisodes = useCallback(() => {
    setShowEpisodesModal(true);
  }, [setShowEpisodesModal]);

  // CRITICAL: Extract specific functions from controlsHook to avoid depending on the whole object
  // The controlsHook object is recreated on every render (even though its functions are stable)
  // Depending on controlsHook causes handleSeek/handleSeekTo to recreate, triggering TVPlayerControls re-renders
  const { skip: controlsSkip, seekToTime: controlsSeekToTime } = controlsHook;

  const handleSeek = useCallback((seconds: number) => {
    if (DEBUG_PLAYER_STATE) {
      console.log(`[AndroidVideoPlayer] HANDLE_SEEK relative=${seconds}s`);
    }
    controlsSkip(seconds);
  }, [controlsSkip]);

  const handleSeekTo = useCallback((seconds: number) => {
    if (DEBUG_PLAYER_STATE) {
      console.log(`[AndroidVideoPlayer] HANDLE_SEEK_TO absolute=${seconds.toFixed(2)}s`);
    }
    controlsSeekToTime(seconds);
  }, [controlsSeekToTime]);

  const handleFocusRestored = useCallback(() => {
    setShouldRestoreFocus(false);
  }, []);

  // Memoized callback for modal closed events
  const handleModalClosed = useCallback(() => {
    setShouldRestoreFocus(true);
  }, []);

  // Memoized callback for subtitle track selection
  const handleSelectTextTrack = useCallback((trackId: number) => {
    tracksHook.setSelectedTextTrack(trackId);
    if (activePlayerRef.current) {
      activePlayerRef.current.setSubtitleTrack(trackId);
    }
    setUseCustomSubtitles(false);
    setShowSubtitleModal(false);
    if (isTVDevice) {
      setShouldRestoreFocus(true);
    }
  }, [tracksHook, activePlayerRef, setShowSubtitleModal, isTVDevice]);

  // Memoized callback for episode selection
  const handleSelectEpisode = useCallback((ep: any) => {
    setSelectedEpisodeForStreams(ep);
    setShowEpisodesModal(false);
    setShowEpisodeStreamsModal(true);
  }, [setSelectedEpisodeForStreams, setShowEpisodesModal, setShowEpisodeStreamsModal]);

  // Memoized callback for closing episode streams modal
  const handleCloseEpisodeStreams = useCallback(() => {
    setShowEpisodeStreamsModal(false);
    setShowEpisodesModal(false);
  }, [setShowEpisodeStreamsModal, setShowEpisodesModal]);

  // Memoize conditional callbacks to avoid creating new references on every render
  const showSourcesCallback = useMemo(() => {
    return Object.keys(availableStreams).length > 0 ? handleShowSources : undefined;
  }, [availableStreams, handleShowSources]);

  const showEpisodesCallback = useMemo(() => {
    return type === 'series' ? handleShowEpisodes : undefined;
  }, [type, handleShowEpisodes]);

  // Memoize the modalOpen boolean to prevent reference changes
  const isModalOpen = useMemo(() => {
    return modals.showSubtitleModal || modals.showAudioModal || modals.showEpisodesModal ||
           modals.showSourcesModal || modals.showSpeedModal || modals.showEpisodeStreamsModal;
  }, [modals.showSubtitleModal, modals.showAudioModal, modals.showEpisodesModal,
      modals.showSourcesModal, modals.showSpeedModal, modals.showEpisodeStreamsModal]);

  const loadStartAtRef = useRef<number | null>(null);
  const firstFrameAtRef = useRef<number | null>(null);
  const controlsTimeout = useRef<NodeJS.Timeout | null>(null);

  const handleClose = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.reset({ index: 0, routes: [{ name: 'Home' }] } as any);
  }, [navigation]);

  // Open current stream in external player via Android intent chooser
  const handleOpenExternal = useCallback(async () => {
    const success = await VideoPlayerService.playVideo(currentStreamUrl, {
      useExternalPlayer: true,
      title: title,
      episodeTitle: episodeTitle,
      episodeNumber: season && episode ? `S${season}E${episode}` : undefined,
    });

    if (success) {
      // Exit internal player when external opens
      handleClose();
    } else {
      toast.error('Failed to open external player');
    }
  }, [currentStreamUrl, title, episodeTitle, season, episode, handleClose]);

  // Handle audio track change with buffering - pauses video, switches track, then resumes
  const handleAudioTrackChange = useCallback(async (trackId: number | null) => {
    if (trackId === null) return;

    const wasPaused = playerState.paused;

    // 1. Pause video
    if (!wasPaused) {
      playerState.setPaused(true);
    }
    setIsChangingAudioTrack(true);

    // 2. Switch track
    tracksHook.setSelectedAudioTrack({ type: 'index', value: trackId });
    if (activePlayerRef.current) {
      activePlayerRef.current.setAudioTrack(trackId);
    }

    // 3. Wait for buffer (300ms)
    await new Promise(resolve => setTimeout(resolve, 300));

    // 4. Resume playback if it wasn't paused before
    setIsChangingAudioTrack(false);
    if (!wasPaused) {
      playerState.setPaused(false);
    }
  }, [playerState, tracksHook, activePlayerRef]);

  const handleSelectStream = async (newStream: any) => {
    if (newStream.url === currentStreamUrl) {
      modals.setShowSourcesModal(false);
      return;
    }

    // Capture current position to resume from on new source
    const currentPosition = playerState.currentTime;

    modals.setShowSourcesModal(false);
    playerState.setPaused(true);

    // Unmount VideoSurface first to ensure player is fully destroyed
    setIsTransitioningStream(true);

    const newQuality = newStream.quality || newStream.title?.match(/(\d+)p/)?.[0];
    const newProvider = newStream.addonName || newStream.name || newStream.addon || 'Unknown';
    const newStreamName = newStream.name || newStream.title || 'Unknown';

    // Wait for unmount to complete, then navigate
    setTimeout(() => {
      (navigation as any).replace('PlayerAndroid', {
        ...route.params,
        uri: newStream.url,
        quality: newQuality,
        streamProvider: newProvider,
        streamName: newStreamName,
        headers: newStream.headers,
        availableStreams: availableStreams,
        resumeFromPosition: currentPosition, // Preserve timeline position when switching sources
      });
    }, 300);
  };

  const handleEpisodeStreamSelect = async (stream: any) => {
    if (!modals.selectedEpisodeForStreams) return;
    modals.setShowEpisodeStreamsModal(false);
    playerState.setPaused(true);

    // Unmount VideoSurface first to ensure player is fully destroyed
    setIsTransitioningStream(true);

    const ep = modals.selectedEpisodeForStreams;

    const newQuality = stream.quality || (stream.title?.match(/(\d+)p/)?.[0]);
    const newProvider = stream.addonName || stream.name || stream.addon || 'Unknown';
    const newStreamName = stream.name || stream.title || 'Unknown Stream';

    // Wait for unmount to complete, then navigate
    setTimeout(() => {
      (navigation as any).replace('PlayerAndroid', {
        uri: stream.url,
        title: title,
        episodeTitle: ep.name,
        season: ep.season_number,
        episode: ep.episode_number,
        quality: newQuality,
        year: year,
        streamProvider: newProvider,
        streamName: newStreamName,
        headers: stream.headers || undefined,
        id,
        type: 'series',
        episodeId: ep.stremioId || `${id}:${ep.season_number}:${ep.episode_number}`,
        imdbId: imdbId ?? undefined,
        backdrop: backdrop || undefined,
        availableStreams: {},
        groupedEpisodes: groupedEpisodes,
      });
    }, 300);
  };

  // Subtitle addon fetching
  const fetchAvailableSubtitles = useCallback(async () => {
    const targetImdbId = imdbId;
    if (!targetImdbId) {
      logger.warn('[AndroidVideoPlayer] No IMDB ID for subtitle fetch');
      return;
    }

    setIsLoadingSubtitleList(true);
    try {
      const stremioType = type === 'series' ? 'series' : 'movie';
      const stremioVideoId = stremioType === 'series' && season && episode
        ? `series:${targetImdbId}:${season}:${episode}`
        : undefined;
      const results = await stremioService.getSubtitles(stremioType, targetImdbId, stremioVideoId);

      const subs: WyzieSubtitle[] = (results || []).map((sub: any) => ({
        id: sub.id || `${sub.lang}-${sub.url}`,
        url: sub.url,
        flagUrl: '',
        format: 'srt',
        encoding: 'utf-8',
        media: sub.addonName || sub.addon || '',
        display: sub.lang || 'Unknown',
        language: (sub.lang || '').toLowerCase(),
        isHearingImpaired: false,
        source: sub.addonName || sub.addon || 'Addon',
      }));

      setAvailableSubtitles(subs);
      logger.info(`[AndroidVideoPlayer] Fetched ${subs.length} addon subtitles`);
    } catch (e) {
      logger.error('[AndroidVideoPlayer] Error fetching addon subtitles', e);
    } finally {
      setIsLoadingSubtitleList(false);
    }
  }, [imdbId, type, season, episode]);

  // Store currentTime in ref so loadWyzieSubtitle doesn't need it in dependencies
  const currentTimeRef = useRef(playerState.currentTime);
  currentTimeRef.current = playerState.currentTime;

  const loadWyzieSubtitle = useCallback(async (subtitle: WyzieSubtitle) => {
    if (!subtitle.url) return;

    setShowSubtitleModal(false);
    // Trigger focus restoration immediately on TV
    if (isTVDevice) {
      setShouldRestoreFocus(true);
    }
    setIsLoadingSubtitles(true);
    try {
      // Download subtitle file
      let srtContent = '';
      try {
        const resp = await axios.get(subtitle.url, { timeout: 10000 });
        srtContent = typeof resp.data === 'string' ? resp.data : String(resp.data);
      } catch {
        const resp = await fetch(subtitle.url);
        srtContent = await resp.text();
      }

      // Parse subtitle file
      const parsedCues = parseSRT(srtContent);
      setCustomSubtitles(parsedCues);
      setUseCustomSubtitles(true);

      // Disable built-in subtitle track when using custom subtitles
      tracksHook.setSelectedTextTrack(-1);
      if (activePlayerRef.current) {
        activePlayerRef.current.setSubtitleTrack(-1);
      }

      // Set initial subtitle based on current time (use ref to avoid dependency)
      const adjustedTime = currentTimeRef.current;
      const cueNow = parsedCues.find(cue => adjustedTime >= cue.start && adjustedTime <= cue.end);
      setCurrentSubtitle(cueNow ? cueNow.text : '');

      logger.info(`[AndroidVideoPlayer] Loaded addon subtitle: ${subtitle.display} (${parsedCues.length} cues)`);
      toast.success(`Subtitle loaded: ${subtitle.display}`);
    } catch (e) {
      logger.error('[AndroidVideoPlayer] Error loading subtitle', e);
      toast.error('Failed to load subtitle');
    } finally {
      setIsLoadingSubtitles(false);
    }
  }, [setShowSubtitleModal, isTVDevice, tracksHook, activePlayerRef]);

  const disableCustomSubtitles = useCallback(() => {
    setUseCustomSubtitles(false);
    setCustomSubtitles([]);
    setCurrentSubtitle('');
  }, []);

  const cycleResizeMode = useCallback(() => {
    if (playerState.resizeMode === 'contain') playerState.setResizeMode('cover');
    else playerState.setResizeMode('contain');
  }, [playerState.resizeMode]);

  return (
    <View style={[styles.container, {
      width: playerState.screenDimensions.width,
      height: playerState.screenDimensions.height,
      position: 'absolute', top: 0, left: 0
    }]}>
      <LoadingOverlay
        visible={!openingAnimation.shouldHideOpeningOverlay}
        backdrop={backdrop || null}
        hasLogo={hasLogo}
        logo={metadata?.logo}
        backgroundFadeAnim={openingAnimation.backgroundFadeAnim}
        backdropImageOpacityAnim={openingAnimation.backdropImageOpacityAnim}
        onClose={handleClose}
        width={playerState.screenDimensions.width}
        height={playerState.screenDimensions.height}
      />

      <View style={{ flex: 1, backgroundColor: 'black' }}>
        {!isTransitioningStream && (
          <VideoSurface
            processedStreamUrl={currentStreamUrl}
            headers={headers}
            volume={volume}
            playbackSpeed={speedControl.playbackSpeed}
            resizeMode={playerState.resizeMode}
            paused={playerState.paused}
            currentStreamUrl={currentStreamUrl}
            toggleControls={toggleControls}
            onLoad={handleLoad}
            onProgress={handleProgress}
            onSeek={(data) => {
              playerState.isSeeking.current = false;
              if (data.currentTime) traktAutosync.handleProgressUpdate(data.currentTime, playerState.duration, true);
            }}
            onEnd={() => {
              if (modals.showEpisodeStreamsModal) return;
              playerState.setPaused(true);
            }}
            onError={(err: any) => {
              logger.error('Video Error', err);

              // Determine the actual error message
              let displayError = 'An unknown error occurred';

              if (typeof err?.error === 'string') {
                displayError = err.error;
              } else if (err?.error?.errorString) {
                displayError = err.error.errorString;
              } else if (err?.errorString) {
                displayError = err.errorString;
              } else if (typeof err === 'string') {
                displayError = err;
              } else {
                displayError = JSON.stringify(err);
              }

              // Check if this is an audio codec error - if so, just show a toast and continue
              // The video will play without audio (or with whatever audio track ExoPlayer can handle)
              const isAudioError = displayError.toLowerCase().includes('audio') &&
                                   (displayError.toLowerCase().includes('not supported') ||
                                    displayError.toLowerCase().includes('no supported'));

              if (isAudioError) {
                // Just log and show a brief toast - don't block playback
                console.log('[AndroidVideoPlayer] Audio codec not supported - continuing playback without audio');
                toast.error('Audio format not supported - playing without audio', { duration: 3000 });
                // Don't show error modal, let playback continue
                return;
              }

              modals.setErrorDetails(displayError);
              modals.setShowErrorModal(true);
            }}
            onBuffer={handleBuffer}
            onTracksChanged={(data) => {
              console.log('[AndroidVideoPlayer] onTracksChanged:', data);
              let formattedAudioTracks: any[] = [];
              let formattedSubtitleTracks: any[] = [];

              if (data?.audioTracks) {
                formattedAudioTracks = data.audioTracks.map((t: any) => ({
                  id: t.id,
                  name: t.name || `Track ${t.id}`,
                  language: t.language,
                  supported: t.supported,
                }));
                tracksHook.setRnVideoAudioTracks(formattedAudioTracks);
              }
              if (data?.subtitleTracks) {
                formattedSubtitleTracks = data.subtitleTracks.map((t: any) => ({
                  id: t.id,
                  name: t.name || `Track ${t.id}`,
                  language: t.language
                }));
                tracksHook.setRnVideoTextTracks(formattedSubtitleTracks);
              }

              // Apply default track preferences after tracks are loaded
              // Use a small delay to ensure player is ready
              setTimeout(() => {
                applyDefaultTrackPreferences(formattedAudioTracks, formattedSubtitleTracks);
              }, 500);
            }}
            exoPlayerRef={exoPlayerRef}
            pinchRef={pinchRef}
            onPinchGestureEvent={() => { }}
            onPinchHandlerStateChange={() => { }}
            screenDimensions={playerState.screenDimensions}
            useHardwareDecoding={settings.useHardwareDecoding}
            enableAudioPassthrough={settings.enableAudioPassthrough}
          />
        )}

        {/* Pause indicator - shows when video is paused (TV only) */}
        {isTVDevice && playerState.paused && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              justifyContent: 'center',
              alignItems: 'center',
              pointerEvents: 'none',
            }}
          >
            <View style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <MaterialIcons name="pause" size={48} color="white" />
            </View>
          </View>
        )}

        {/* Custom Subtitles for addon subtitles */}
        <CustomSubtitles
          useCustomSubtitles={useCustomSubtitles}
          currentSubtitle={currentSubtitle}
          subtitleSize={subtitleSize}
          subtitleBackground={subtitleBackground}
          zoomScale={1.0}
          textColor={subtitleTextColor}
          backgroundOpacity={subtitleBgOpacity}
          textShadow={subtitleTextShadow}
          outline={subtitleOutline}
          outlineColor={subtitleOutlineColor}
          outlineWidth={subtitleOutlineWidth}
          align={subtitleAlign}
          bottomOffset={subtitleBottomOffset}
          letterSpacing={subtitleLetterSpacing}
          lineHeightMultiplier={subtitleLineHeightMultiplier}
          controlsVisible={playerState.showControls}
          controlsExtraOffset={100}
        />
        {/* Gesture Controls - Only on mobile, TV uses remote */}
        {!isTVDevice && (
          <GestureControls
            screenDimensions={playerState.screenDimensions}
            gestureControls={gestureControls}
            onLongPressActivated={speedControl.activateSpeedBoost}
            onLongPressEnd={speedControl.deactivateSpeedBoost}
            onLongPressStateChange={(e) => {
              if (e.nativeEvent.state !== 4 && e.nativeEvent.state !== 2) speedControl.deactivateSpeedBoost();
            }}
            toggleControls={toggleControls}
            showControls={playerState.showControls}
            hideControls={hideControls}
            volume={volume}
            brightness={brightness}
            controlsTimeout={controlsTimeout}
          />
        )}

        {/* Player Controls - TV or Mobile */}
        {isTVDevice ? (
          <TVPlayerControls
            visible={playerState.showControls}
            paused={playerState.paused}
            setPaused={playerState.setPaused}
            currentTime={playerState.currentTime}
            duration={playerState.duration}
            title={title}
            episodeTitle={episodeTitle}
            season={season}
            episode={episode}
            onTogglePlayback={controlsHook.togglePlayback}
            onSeek={handleSeek}
            onSeekTo={handleSeekTo}
            onClose={handleClose}
            onShowControls={showControls}
            onHideControls={hideControls}
            onShowSubtitles={handleShowSubtitles}
            onShowAudioTracks={handleShowAudioTracks}
            onShowSources={showSourcesCallback}
            onOpenExternal={handleOpenExternal}
            onShowEpisodes={showEpisodesCallback}
            playbackSpeed={speedControl.playbackSpeed}
            buffered={playerState.duration > 0 ? playerState.buffered / playerState.duration : 0}
            restoreFocus={shouldRestoreFocus}
            onFocusRestored={handleFocusRestored}
            modalOpen={isModalOpen}
          />
        ) : (
          <PlayerControls
            showControls={playerState.showControls}
            fadeAnim={fadeAnim}
            paused={playerState.paused}
            title={title}
            episodeTitle={episodeTitle}
            season={season}
            episode={episode}
            quality={currentQuality || quality}
            year={year}
            streamProvider={currentStreamProvider || streamProvider}
            streamName={currentStreamName}
            currentTime={playerState.currentTime}
            duration={playerState.duration}
            zoomScale={1}
            currentResizeMode={playerState.resizeMode}
            ksAudioTracks={tracksHook.ksAudioTracks}
            selectedAudioTrack={tracksHook.computedSelectedAudioTrack}
            availableStreams={availableStreams}
            togglePlayback={controlsHook.togglePlayback}
            skip={controlsHook.skip}
            handleClose={handleClose}
            cycleAspectRatio={cycleResizeMode}
            cyclePlaybackSpeed={() => {
              const speeds = [0.5, 1, 1.25, 1.5, 2];
              const idx = speeds.indexOf(speedControl.playbackSpeed);
              const next = speeds[(idx + 1) % speeds.length];
              speedControl.setPlaybackSpeed(next);
            }}
            currentPlaybackSpeed={speedControl.playbackSpeed}
            setShowAudioModal={modals.setShowAudioModal}
            setShowSubtitleModal={modals.setShowSubtitleModal}
            setShowSpeedModal={modals.setShowSpeedModal}
            isSubtitleModalOpen={modals.showSubtitleModal}
            setShowSourcesModal={modals.setShowSourcesModal}
            setShowEpisodesModal={type === 'series' ? modals.setShowEpisodesModal : undefined}
            onSliderValueChange={(val) => { playerState.isDragging.current = true; }}
            onSlidingStart={() => { playerState.isDragging.current = true; }}
            onSlidingComplete={(val) => {
              playerState.isDragging.current = false;
              controlsHook.seekToTime(val);
            }}
            buffered={playerState.buffered}
            formatTime={formatTime}
            playerBackend={'ExoPlayer'}
          />
        )}

        <SpeedActivatedOverlay
          visible={speedControl.showSpeedActivatedOverlay}
          opacity={speedControl.speedActivatedOverlayOpacity}
          speed={speedControl.holdToSpeedValue}
        />

        {/* Pause Overlay - Only on mobile (TV uses controls overlay instead) */}
        {!isTVDevice && (
          <PauseOverlay
            visible={playerState.paused && !playerState.showControls}
            onClose={() => playerState.setShowControls(true)}
            title={title}
            episodeTitle={episodeTitle}
            season={season}
            episode={episode}
            year={year}
            type={type || 'movie'}
            description={nextEpisodeHook.currentEpisodeDescription || ''}
            cast={cast}
            screenDimensions={playerState.screenDimensions}
          />
        )}

        {/* Parental Guide Overlay - Shows after controls first hide */}
        <ParentalGuideOverlay
          imdbId={imdbId || (id?.startsWith('tt') ? id : undefined)}
          type={type as 'movie' | 'series'}
          season={season}
          episode={episode}
          shouldShow={playerState.isVideoLoaded && !playerState.showControls && !playerState.paused}
        />
      </View>

      {/* Only mount AudioTrackModal when visible to avoid render overhead */}
      {modals.showAudioModal && (
        <AudioTrackModal
          showAudioModal={modals.showAudioModal}
          setShowAudioModal={modals.setShowAudioModal}
          ksAudioTracks={tracksHook.ksAudioTracks}
          selectedAudioTrack={tracksHook.computedSelectedAudioTrack}
          selectAudioTrack={handleAudioTrackChange}
          isLoading={isChangingAudioTrack}
          onModalClosed={handleModalClosed}
        />
      )}

      {/* Only mount SubtitleModals when visible to avoid render overhead */}
      {modals.showSubtitleModal && (
        <SubtitleModals
          showSubtitleModal={modals.showSubtitleModal}
          setShowSubtitleModal={modals.setShowSubtitleModal}
          showSubtitleLanguageModal={false}
          setShowSubtitleLanguageModal={() => { }}
          isLoadingSubtitleList={isLoadingSubtitleList}
          isLoadingSubtitles={isLoadingSubtitles}
          customSubtitles={[]}
          availableSubtitles={availableSubtitles}
          ksTextTracks={tracksHook.ksTextTracks}
          selectedTextTrack={tracksHook.computedSelectedTextTrack}
          useCustomSubtitles={useCustomSubtitles}
          isKsPlayerActive={true}
          subtitleSize={subtitleSize}
          subtitleBackground={subtitleBackground}
          fetchAvailableSubtitles={fetchAvailableSubtitles}
          loadWyzieSubtitle={loadWyzieSubtitle}
          selectTextTrack={handleSelectTextTrack}
          disableCustomSubtitles={disableCustomSubtitles}
          increaseSubtitleSize={() => setSubtitleSize(prev => Math.min(prev + 2, 60))}
          decreaseSubtitleSize={() => setSubtitleSize(prev => Math.max(prev - 2, 12))}
          toggleSubtitleBackground={() => setSubtitleBackground(prev => !prev)}
          subtitleTextColor={subtitleTextColor}
          setSubtitleTextColor={setSubtitleTextColor}
          subtitleBgOpacity={subtitleBgOpacity}
          setSubtitleBgOpacity={setSubtitleBgOpacity}
          subtitleTextShadow={subtitleTextShadow}
          setSubtitleTextShadow={setSubtitleTextShadow}
          subtitleOutline={subtitleOutline}
          setSubtitleOutline={setSubtitleOutline}
          subtitleOutlineColor={subtitleOutlineColor}
          setSubtitleOutlineColor={setSubtitleOutlineColor}
          subtitleOutlineWidth={subtitleOutlineWidth}
          setSubtitleOutlineWidth={setSubtitleOutlineWidth}
          subtitleAlign={subtitleAlign}
          setSubtitleAlign={setSubtitleAlign}
          subtitleBottomOffset={subtitleBottomOffset}
          setSubtitleBottomOffset={setSubtitleBottomOffset}
          subtitleLetterSpacing={subtitleLetterSpacing}
          setSubtitleLetterSpacing={setSubtitleLetterSpacing}
          subtitleLineHeightMultiplier={subtitleLineHeightMultiplier}
          setSubtitleLineHeightMultiplier={setSubtitleLineHeightMultiplier}
          subtitleOffsetSec={subtitleOffsetSec}
          setSubtitleOffsetSec={setSubtitleOffsetSec}
          onModalClosed={handleModalClosed}
        />
      )}

      {/* Only mount modals when visible to avoid render overhead */}
      {modals.showSourcesModal && (
        <SourcesModal
          showSourcesModal={modals.showSourcesModal}
          setShowSourcesModal={modals.setShowSourcesModal}
          availableStreams={availableStreams}
          currentStreamUrl={currentStreamUrl}
          onSelectStream={handleSelectStream}
        />
      )}

      {modals.showSpeedModal && (
        <SpeedModal
          showSpeedModal={modals.showSpeedModal}
          setShowSpeedModal={modals.setShowSpeedModal}
          currentSpeed={speedControl.playbackSpeed}
          setPlaybackSpeed={speedControl.setPlaybackSpeed}
          holdToSpeedEnabled={speedControl.holdToSpeedEnabled}
          setHoldToSpeedEnabled={speedControl.setHoldToSpeedEnabled}
          holdToSpeedValue={speedControl.holdToSpeedValue}
          setHoldToSpeedValue={speedControl.setHoldToSpeedValue}
        />
      )}

      {modals.showEpisodesModal && (
        <EpisodesModal
          showEpisodesModal={modals.showEpisodesModal}
          setShowEpisodesModal={modals.setShowEpisodesModal}
          groupedEpisodes={groupedEpisodes || (metadataResult as any)?.groupedEpisodes}
          currentEpisode={season && episode ? { season, episode } : undefined}
          metadata={metadata}
          onSelectEpisode={handleSelectEpisode}
          onModalClosed={handleModalClosed}
        />
      )}

      {modals.showErrorModal && (
        <ErrorModal
          showErrorModal={modals.showErrorModal}
          setShowErrorModal={modals.setShowErrorModal}
          errorDetails={modals.errorDetails}
          onDismiss={handleClose}
        />
      )}

      {modals.showEpisodeStreamsModal && (
        <EpisodeStreamsModal
          visible={modals.showEpisodeStreamsModal}
          onClose={handleCloseEpisodeStreams}
          episode={modals.selectedEpisodeForStreams}
          onSelectStream={handleEpisodeStreamSelect}
          metadata={{ id: id, name: title }}
          onModalClosed={handleModalClosed}
        />
      )}
    </View>
  );
};

export default AndroidVideoPlayer;
