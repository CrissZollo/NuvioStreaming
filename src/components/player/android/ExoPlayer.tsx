import React, { useRef, forwardRef, useImperativeHandle, useState } from 'react';
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
}

const ExoPlayer = forwardRef<ExoPlayerRef, ExoPlayerProps>((props, ref) => {
    const videoRef = useRef<VideoRef>(null);
    const [selectedAudioTrack, setSelectedAudioTrack] = useState<SelectedTrack | undefined>(undefined);
    const [selectedTextTrack, setSelectedTextTrack] = useState<SelectedTrack | undefined>(undefined);

    useImperativeHandle(ref, () => ({
        seek: (positionSeconds: number) => {
            console.log('[ExoPlayer] seek called:', positionSeconds);
            videoRef.current?.seek(positionSeconds);
        },
        setAudioTrack: (trackId: number) => {
            console.log('[ExoPlayer] setAudioTrack called:', trackId);
            setSelectedAudioTrack({ type: SelectedTrackType.INDEX, value: trackId });
        },
        setSubtitleTrack: (trackId: number) => {
            console.log('[ExoPlayer] setSubtitleTrack called:', trackId);
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

    // Build source object
    const sourceConfig: any = {
        uri: props.source,
    };

    if (props.headers) {
        sourceConfig.headers = props.headers;
    }

    // Detect stream type from URL
    const lowerUrl = (props.source || '').toLowerCase();
    if (/\.m3u8(\b|$|\?)/.test(lowerUrl)) {
        sourceConfig.type = 'm3u8';
    } else if (/\.mpd(\b|$|\?)/.test(lowerUrl)) {
        sourceConfig.type = 'mpd';
    }

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
            progressUpdateInterval={500}
            onLoad={handleLoad}
            onProgress={handleProgress}
            onEnd={handleEnd}
            onError={handleError}
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
