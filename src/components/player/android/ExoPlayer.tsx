import React, { useRef, forwardRef, useImperativeHandle, useState, useMemo, useCallback } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Video, { VideoRef, SelectedTrack, SelectedTrackType } from 'react-native-video';

export interface ExoPlayerRef {
    seek: (positionSeconds: number) => void;
    setAudioTrack: (trackId: number) => void;
    /**
     * Set the subtitle track. Pass trackId=-1 to disable subtitles.
     * Uses LANGUAGE-based selection first (most reliable), then TITLE, then INDEX as fallback.
     */
    setSubtitleTrack: (trackId: number, title?: string, language?: string) => void;
}

export interface ExoPlayerProps {
    source: string;
    headers?: { [key: string]: string };
    paused?: boolean;
    volume?: number;
    rate?: number;
    resizeMode?: 'contain' | 'cover' | 'stretch';
    style?: any;
    enableAudioPassthrough?: boolean;
    // Subtitle styling props
    subtitleSize?: number;
    subtitleColor?: string;
    subtitleBackground?: boolean;
    subtitleBackgroundOpacity?: number;
    subtitleOutline?: boolean;
    subtitleOutlineColor?: string;
    subtitleBottomOffset?: number;
    onLoad?: (data: { duration: number; width: number; height: number }) => void;
    onProgress?: (data: { currentTime: number; duration: number }) => void;
    onEnd?: () => void;
    onError?: (error: { error: string }) => void;
    onTracksChanged?: (data: { audioTracks: any[]; subtitleTracks: any[] }) => void;
    onBuffer?: (data: { isBuffering: boolean }) => void;
    onPlaybackStateChanged?: (data: { isPlaying: boolean; isSeeking: boolean }) => void;
}

// Enable detailed logging for debugging performance issues
const DEBUG_EXOPLAYER = true;

// Buffer configuration optimized for Android TV streaming
// Balance between quick seek response and smooth playback
// Lower values = faster seek response but more rebuffering risk
// Higher values = slower seek but smoother sustained playback
const TV_BUFFER_CONFIG = {
    minBufferMs: 5000,         // 5s minimum - reduced from 15s for faster initial playback
    maxBufferMs: 30000,        // 30s maximum buffer - reduced from 50s, still plenty
    bufferForPlaybackMs: 500,  // 500ms to start - fast response after seek
    bufferForPlaybackAfterRebufferMs: 1500, // 1.5s after rebuffer - reduced from 5s for faster seek
    backBufferDurationMs: 10000, // 10s back-buffer - reduced from 30s, saves memory
    cacheSizeMB: 0,            // Disabled - use default caching
};

// Track timing for performance analysis
let lastProgressTime = 0;
let lastBufferEvent = 0;
let seekStartTime = 0;

const ExoPlayer = forwardRef<ExoPlayerRef, ExoPlayerProps>((props, ref) => {
    const videoRef = useRef<VideoRef>(null);
    const [selectedAudioTrack, setSelectedAudioTrack] = useState<SelectedTrack | undefined>(undefined);
    const [selectedTextTrack, setSelectedTextTrack] = useState<SelectedTrack | undefined>(undefined);

    useImperativeHandle(ref, () => ({
        seek: (positionSeconds: number) => {
            seekStartTime = performance.now();
            console.log(`[ExoPlayer] SEEK START to ${positionSeconds.toFixed(2)}s at ${new Date().toISOString()}`);
            videoRef.current?.seek(positionSeconds);
        },
        setAudioTrack: (trackId: number) => {
            console.log(`[ExoPlayer] setAudioTrack called: ${trackId}`);
            setSelectedAudioTrack({ type: SelectedTrackType.INDEX, value: trackId });
        },
        setSubtitleTrack: (trackId: number, title?: string, language?: string) => {
            console.log(`[ExoPlayer] setSubtitleTrack called with trackId: ${trackId}, title: ${title}, language: ${language}`);
            if (trackId === -1) {
                console.log(`[ExoPlayer] Disabling subtitles`);
                setSelectedTextTrack({ type: SelectedTrackType.DISABLED, value: '' });
            } else {
                // Workaround for react-native-video Android bug:
                // First disable, then after a brief delay, set the new track
                // This forces ExoPlayer to properly switch tracks
                console.log(`[ExoPlayer] Applying track switch workaround - disabling first`);
                setSelectedTextTrack({ type: SelectedTrackType.DISABLED, value: '' });

                setTimeout(() => {
                    if (language && language !== 'und') {
                        console.log(`[ExoPlayer] Setting subtitle track to LANGUAGE: ${language}`);
                        setSelectedTextTrack({ type: SelectedTrackType.LANGUAGE, value: language });
                    } else if (title) {
                        console.log(`[ExoPlayer] Setting subtitle track to TITLE: ${title}`);
                        setSelectedTextTrack({ type: SelectedTrackType.TITLE, value: title });
                    } else {
                        console.log(`[ExoPlayer] Setting subtitle track to INDEX: ${trackId}`);
                        setSelectedTextTrack({ type: SelectedTrackType.INDEX, value: trackId });
                    }
                }, 50);
            }
        },
    }));

    if (Platform.OS !== 'android') {
        return (
            <View style={[styles.container, props.style, { backgroundColor: 'black' }]} />
        );
    }

    const handleLoad = (data: any) => {
        console.log('[ExoPlayer] onLoad event:', data);

        // Extract tracks information - use track.index if available (react-native-video internal index)
        const audioTracks = data.audioTracks?.map((track: any, index: number) => {
            // Build descriptive name with additional info
            let name = track.title || track.language || `Audio ${index + 1}`;
            const flags: string[] = [];
            if (track.type) flags.push(track.type);
            if (flags.length > 0) name += ` (${flags.join(', ')})`;

            return {
                id: track.index !== undefined ? track.index : index,
                name,
                language: track.language || 'und',
                supported: true,
            };
        }) || [];

        const subtitleTracks = data.textTracks?.map((track: any, index: number) => {
            // Language code to name mapping for display
            const languageNames: { [key: string]: string } = {
                'en': 'English', 'eng': 'English',
                'es': 'Spanish', 'spa': 'Spanish',
                'fr': 'French', 'fra': 'French', 'fre': 'French',
                'de': 'German', 'deu': 'German', 'ger': 'German',
                'it': 'Italian', 'ita': 'Italian',
                'pt': 'Portuguese', 'por': 'Portuguese',
                'ru': 'Russian', 'rus': 'Russian',
                'ja': 'Japanese', 'jpn': 'Japanese',
                'ko': 'Korean', 'kor': 'Korean',
                'zh': 'Chinese', 'zho': 'Chinese', 'chi': 'Chinese',
                'ar': 'Arabic', 'ara': 'Arabic',
                'hi': 'Hindi', 'hin': 'Hindi',
                'nl': 'Dutch', 'nld': 'Dutch', 'dut': 'Dutch',
                'pl': 'Polish', 'pol': 'Polish',
                'tr': 'Turkish', 'tur': 'Turkish',
                'sv': 'Swedish', 'swe': 'Swedish',
                'da': 'Danish', 'dan': 'Danish',
                'no': 'Norwegian', 'nor': 'Norwegian',
                'fi': 'Finnish', 'fin': 'Finnish',
                'cs': 'Czech', 'ces': 'Czech', 'cze': 'Czech',
                'hu': 'Hungarian', 'hun': 'Hungarian',
                'el': 'Greek', 'ell': 'Greek', 'gre': 'Greek',
                'he': 'Hebrew', 'heb': 'Hebrew',
                'th': 'Thai', 'tha': 'Thai',
                'vi': 'Vietnamese', 'vie': 'Vietnamese',
                'id': 'Indonesian', 'ind': 'Indonesian',
                'ms': 'Malay', 'msa': 'Malay',
                'ro': 'Romanian', 'ron': 'Romanian', 'rum': 'Romanian',
                'uk': 'Ukrainian', 'ukr': 'Ukrainian',
                'bg': 'Bulgarian', 'bul': 'Bulgarian',
                'hr': 'Croatian', 'hrv': 'Croatian',
                'sk': 'Slovak', 'slk': 'Slovak', 'slo': 'Slovak',
                'sl': 'Slovenian', 'slv': 'Slovenian',
                'und': 'Unknown',
            };

            // Get language display name
            const langCode = (track.language || '').toLowerCase();
            const languageName = languageNames[langCode] || (langCode ? langCode.toUpperCase() : null);

            // Build display name: prefer language name, then title (if meaningful), then fallback
            let name: string;
            const titleLower = (track.title || '').toLowerCase();

            // Check if title is just generic like "Regular", "Forced", or a MIME type
            const isGenericTitle = !track.title ||
                titleLower === 'regular' ||
                titleLower === 'forced' ||
                titleLower.includes('application/') ||
                titleLower.includes('x-media');

            if (languageName && languageName !== 'Unknown') {
                name = languageName;
            } else if (!isGenericTitle && track.title) {
                name = track.title;
            } else {
                name = `Subtitle ${index + 1}`;
            }

            // Build flags for additional info
            const flags: string[] = [];

            // Check for SDH/CC indicators
            if (track.type === 'captions' || /\b(cc|sdh|hearing)\b/i.test(track.title || '')) {
                flags.push('SDH');
            }
            // Check for forced subtitles
            if (track.forced || titleLower === 'forced' || /\bforced\b/i.test(track.title || '')) {
                flags.push('Forced');
            }

            if (flags.length > 0) name += ` [${flags.join(', ')}]`;

            // IMPORTANT: Use the array index (position) as the ID, NOT track.index
            // react-native-video's setSelectedTrack with type "index" expects the
            // groupIndex which corresponds to the position in the track list, not
            // the track's internal index property
            return {
                id: index,
                name,
                // Preserve original title for TITLE-based selection (more reliable on Android)
                title: track.title || undefined,
                language: track.language || 'und',
                type: track.type,
                forced: track.forced,
            };
        }) || [];

        if (DEBUG_EXOPLAYER) {
            console.log('[ExoPlayer] Raw textTracks from player:', JSON.stringify(data.textTracks));
            console.log('[ExoPlayer] Formatted subtitleTracks:', JSON.stringify(subtitleTracks));
            console.log('[ExoPlayer] Raw audioTracks from player:', JSON.stringify(data.audioTracks));
        }

        // Notify about tracks
        if (props.onTracksChanged && (audioTracks.length > 0 || subtitleTracks.length > 0)) {
            props.onTracksChanged({ audioTracks, subtitleTracks });
        }

        props.onLoad?.({
            duration: data.duration,
            width: data.naturalSize?.width || 1920,
            height: data.naturalSize?.height || 1080,
        });
    };

    const handleProgress = (data: any) => {
        const now = performance.now();
        const timeSinceLastProgress = now - lastProgressTime;

        if (DEBUG_EXOPLAYER && timeSinceLastProgress > 1500) {
            // Log if there's a gap in progress events (indicates buffering/seeking)
            console.log(`[ExoPlayer] PROGRESS gap: ${timeSinceLastProgress.toFixed(0)}ms, time=${data.currentTime?.toFixed(2)}s, playable=${data.playableDuration?.toFixed(2)}s`);
        }
        lastProgressTime = now;

        props.onProgress?.({
            currentTime: data.currentTime,
            duration: data.playableDuration || data.seekableDuration || 0,
        });
    };

    const handleEnd = () => {
        console.log('[ExoPlayer] onEnd event');
        props.onEnd?.();
    };

    const handleError = (error: any) => {
        console.log('[ExoPlayer] onError event:', error);
        const errorMessage = error?.error?.errorString || error?.error?.message || error?.error || 'Unknown error';
        props.onError?.({ error: errorMessage });
    };

    const handleBuffer = (data: any) => {
        const now = performance.now();
        const timeSinceLastBuffer = now - lastBufferEvent;
        lastBufferEvent = now;

        if (DEBUG_EXOPLAYER) {
            const seekElapsed = seekStartTime > 0 ? (now - seekStartTime).toFixed(0) : 'N/A';
            console.log(`[ExoPlayer] BUFFER isBuffering=${data.isBuffering} timeSinceLastBuffer=${timeSinceLastBuffer.toFixed(0)}ms seekElapsed=${seekElapsed}ms`);
        }

        props.onBuffer?.({ isBuffering: data.isBuffering });
    };

    const handlePlaybackStateChanged = (data: any) => {
        if (DEBUG_EXOPLAYER) {
            const seekElapsed = seekStartTime > 0 ? (performance.now() - seekStartTime).toFixed(0) : 'N/A';
            console.log(`[ExoPlayer] PLAYBACK_STATE isPlaying=${data.isPlaying} isSeeking=${data.isSeeking} seekElapsed=${seekElapsed}ms`);

            // Reset seek timer when playback resumes after seek
            if (data.isPlaying && seekStartTime > 0) {
                console.log(`[ExoPlayer] SEEK COMPLETE - total time: ${(performance.now() - seekStartTime).toFixed(0)}ms`);
                seekStartTime = 0;
            }
        }

        props.onPlaybackStateChanged?.({
            isPlaying: data.isPlaying,
            isSeeking: data.isSeeking || false,
        });
    };

    // Memoize source config to prevent video reinitialization on every render
    // This is CRITICAL for performance - react-native-video reinitializes when source object reference changes
    const sourceConfig = useMemo(() => {
        const config: any = {
            uri: props.source,
            // Include buffer config in source object for better Android support
            bufferConfig: TV_BUFFER_CONFIG,
        };

        if (props.headers) {
            config.headers = props.headers;
        }

        // Detect stream type from URL
        const lowerUrl = (props.source || '').toLowerCase();
        if (/\.m3u8(\b|$|\?)/.test(lowerUrl)) {
            config.type = 'm3u8';
        } else if (/\.mpd(\b|$|\?)/.test(lowerUrl)) {
            config.type = 'mpd';
        }

        if (DEBUG_EXOPLAYER) {
            console.log(`[ExoPlayer] Source config CREATED: type=${config.type || 'auto'}, uri=${props.source?.substring(0, 50)}...`);
        }

        return config;
    }, [props.source, props.headers])

    // Memoize subtitle style to prevent unnecessary re-renders
    // Only recreate when actual subtitle styling props change
    const subtitleStyle = useMemo(() => ({
        fontSize: props.subtitleSize || 24,
        paddingBottom: props.subtitleBottomOffset ?? 50,
        subtitlesFollowVideo: true,
        // Extended props handled by native patch
        foregroundColor: props.subtitleColor || '#FFFFFF',
        backgroundColor: props.subtitleBackground
            ? `rgba(0,0,0,${props.subtitleBackgroundOpacity ?? 0.75})`
            : 'transparent',
        // Edge type: 0=NONE, 1=OUTLINE, 2=DROP_SHADOW
        edgeType: props.subtitleOutline ? 2 : 0,
        edgeColor: props.subtitleOutlineColor || '#000000',
        useOutline: props.subtitleOutline ?? true,
    }), [
        props.subtitleSize,
        props.subtitleBottomOffset,
        props.subtitleColor,
        props.subtitleBackground,
        props.subtitleBackgroundOpacity,
        props.subtitleOutline,
        props.subtitleOutlineColor,
    ]);

    return (
        <Video
            ref={videoRef}
            source={sourceConfig}
            style={[styles.container, props.style]}
            paused={props.paused ?? true}
            volume={props.volume ?? 1.0}
            rate={props.rate ?? 1.0}
            resizeMode={props.resizeMode ?? 'contain'}
            repeat={false}
            controls={false}
            playInBackground={false}
            playWhenInactive={false}
            ignoreSilentSwitch="ignore"
            useTextureView={false}
            selectedAudioTrack={selectedAudioTrack}
            selectedTextTrack={selectedTextTrack}
            // Extended subtitleStyle - native patch in ExoPlayerView.kt handles these
            subtitleStyle={subtitleStyle}
            progressUpdateInterval={1000}
            bufferConfig={TV_BUFFER_CONFIG}
            onLoad={handleLoad}
            onProgress={handleProgress}
            onEnd={handleEnd}
            onError={handleError}
            onBuffer={handleBuffer}
            onPlaybackStateChanged={handlePlaybackStateChanged}
        />
    );
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
});

ExoPlayer.displayName = 'ExoPlayer';

export default ExoPlayer;
