import React, { useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, requireNativeComponent, Platform, UIManager, findNodeHandle } from 'react-native';

// Only available on Android
const ExoPlayerNative = Platform.OS === 'android'
    ? requireNativeComponent<any>('ExoPlayer')
    : null;

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
    const nativeRef = useRef<any>(null);

    const dispatchCommand = useCallback((commandName: string, args: any[] = []) => {
        if (nativeRef.current && Platform.OS === 'android') {
            const handle = findNodeHandle(nativeRef.current);
            if (handle) {
                UIManager.dispatchViewManagerCommand(
                    handle,
                    commandName,
                    args
                );
            }
        }
    }, []);

    useImperativeHandle(ref, () => ({
        seek: (positionSeconds: number) => {
            dispatchCommand('seek', [positionSeconds]);
        },
        setAudioTrack: (trackId: number) => {
            dispatchCommand('setAudioTrack', [trackId]);
        },
        setSubtitleTrack: (trackId: number) => {
            dispatchCommand('setSubtitleTrack', [trackId]);
        },
    }), [dispatchCommand]);

    if (Platform.OS !== 'android' || !ExoPlayerNative) {
        // Fallback for iOS or if native component is not available
        return (
            <View style={[styles.container, props.style, { backgroundColor: 'black' }]} />
        );
    }

    const handleLoad = (event: any) => {
        console.log('[ExoPlayer] onLoad event:', event?.nativeEvent);
        props.onLoad?.(event?.nativeEvent);
    };

    const handleProgress = (event: any) => {
        props.onProgress?.(event?.nativeEvent);
    };

    const handleEnd = (event: any) => {
        console.log('[ExoPlayer] onEnd event');
        props.onEnd?.();
    };

    const handleError = (event: any) => {
        console.log('[ExoPlayer] onError event:', event?.nativeEvent);
        props.onError?.(event?.nativeEvent);
    };

    const handleTracksChanged = (event: any) => {
        console.log('[ExoPlayer] onTracksChanged event:', event?.nativeEvent);
        props.onTracksChanged?.(event?.nativeEvent);
    };

    return (
        <ExoPlayerNative
            ref={nativeRef}
            style={[styles.container, props.style]}
            source={props.source}
            headers={props.headers}
            paused={props.paused ?? true}
            volume={props.volume ?? 1.0}
            rate={props.rate ?? 1.0}
            resizeMode={props.resizeMode ?? 'contain'}
            enableAudioPassthrough={props.enableAudioPassthrough ?? false}
            onLoad={handleLoad}
            onProgress={handleProgress}
            onEnd={handleEnd}
            onError={handleError}
            onTracksChanged={handleTracksChanged}
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
