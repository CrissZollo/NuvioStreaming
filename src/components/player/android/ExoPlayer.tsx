import React, { useRef, forwardRef, useImperativeHandle, useState, useMemo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Video, { VideoRef, SelectedTrack, SelectedTrackType } from 'react-native-video';

export interface ExoPlayerRef {
    seek: (positionSeconds: number) => void;
    setAudioTrack: (trackId: number) => void;
    setSubtitleTrack: (trackId: number) => void;
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
        setSubtitleTrack: (trackId: number) => {
            console.log(`[ExoPlayer] setSubtitleTrack called: ${trackId}`);
            if (trackId === -1) {
                setSelectedTextTrack({ type: SelectedTrackType.DISABLED, value: '' });
            } else {
                setSelectedTextTrack({ type: SelectedTrackType.INDEX, value: trackId });
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

        // Extract tracks information
        const audioTracks = data.audioTracks?.map((track: any, index: number) => ({
            id: index,
            name: track.title || track.language || `Audio ${index + 1}`,
            language: track.language || 'und',
            supported: true,
        })) || [];

        const subtitleTracks = data.textTracks?.map((track: any, index: number) => ({
            id: index,
            name: track.title || track.language || `Subtitle ${index + 1}`,
            language: track.language || 'und',
        })) || [];

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
