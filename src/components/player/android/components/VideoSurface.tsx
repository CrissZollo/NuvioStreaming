import React, { useCallback, memo, useMemo } from 'react';
import { View, TouchableWithoutFeedback, StyleSheet } from 'react-native';
import { PinchGestureHandler } from 'react-native-gesture-handler';
import MpvPlayer, { MpvPlayerRef } from '../MpvPlayer';
import ExoPlayer, { ExoPlayerRef } from '../ExoPlayer';
import { styles } from '../../utils/playerStyles';
import { ResizeModeType } from '../../utils/playerTypes';
import { useIsTV } from '../../../../contexts/TVContext';

// Log once per session to avoid spam
let hasLoggedPlayerType = false;

// Union type for player refs - both have similar interfaces
export type PlayerRef = MpvPlayerRef | ExoPlayerRef;

interface VideoSurfaceProps {
    processedStreamUrl: string;
    headers?: { [key: string]: string };
    volume: number;
    playbackSpeed: number;
    resizeMode: ResizeModeType;
    paused: boolean;
    currentStreamUrl: string;

    // Callbacks
    toggleControls: () => void;
    onLoad: (data: any) => void;
    onProgress: (data: any) => void;
    onSeek: (data: any) => void;
    onEnd: () => void;
    onError: (err: any) => void;
    onBuffer: (buf: any) => void;

    // Refs - supports both MPV and ExoPlayer
    mpvPlayerRef?: React.RefObject<MpvPlayerRef>;
    exoPlayerRef?: React.RefObject<ExoPlayerRef>;
    pinchRef: any;

    // Handlers
    onPinchGestureEvent: any;
    onPinchHandlerStateChange: any;
    screenDimensions: { width: number, height: number };
    onTracksChanged?: (data: { audioTracks: any[]; subtitleTracks: any[] }) => void;
    useHardwareDecoding?: boolean;
}

export const VideoSurface: React.FC<VideoSurfaceProps> = memo(({
    processedStreamUrl,
    headers,
    volume,
    playbackSpeed,
    resizeMode,
    paused,
    currentStreamUrl,
    toggleControls,
    onLoad,
    onProgress,
    onSeek,
    onEnd,
    onError,
    onBuffer,
    mpvPlayerRef,
    exoPlayerRef,
    pinchRef,
    onPinchGestureEvent,
    onPinchHandlerStateChange,
    screenDimensions,
    onTracksChanged,
    useHardwareDecoding,
}) => {
    // Use the actual stream URL
    const streamUrl = currentStreamUrl || processedStreamUrl;

    // Detect if running on TV - use ExoPlayer for better hardware decoding
    const isTV = useIsTV();

    const handleLoad = useCallback((data: { duration: number; width: number; height: number }) => {
        console.log('[VideoSurface] onLoad received:', data);
        onLoad({
            duration: data.duration,
            naturalSize: {
                width: data.width,
                height: data.height,
            },
        });
    }, [onLoad]);

    const handleProgress = useCallback((data: { currentTime: number; duration: number }) => {
        onProgress({
            currentTime: data.currentTime,
            playableDuration: data.currentTime,
        });
    }, [onProgress]);

    const handleError = useCallback((error: { error: string }) => {
        console.log('[VideoSurface] onError received:', error);
        onError({
            error: {
                errorString: error.error,
            },
        });
    }, [onError]);

    const handleEnd = useCallback(() => {
        console.log('[VideoSurface] onEnd received');
        onEnd();
    }, [onEnd]);

    // Choose player based on device type
    // TV uses ExoPlayer for better hardware decoding, HDR, and Dolby Vision support
    // Mobile uses MPV for its advanced features and codec support
    const renderPlayer = () => {
        if (isTV) {
            if (!hasLoggedPlayerType) {
                console.log('[VideoSurface] Using ExoPlayer for Android TV');
                hasLoggedPlayerType = true;
            }
            return (
                <ExoPlayer
                    ref={exoPlayerRef || mpvPlayerRef as any}
                    source={streamUrl}
                    headers={headers}
                    paused={paused}
                    volume={volume}
                    rate={playbackSpeed}
                    resizeMode={resizeMode === 'none' ? 'contain' : resizeMode}
                    style={localStyles.player}
                    onLoad={handleLoad}
                    onProgress={handleProgress}
                    onEnd={handleEnd}
                    onError={handleError}
                    onTracksChanged={onTracksChanged}
                />
            );
        }

        // Mobile uses MPV
        return (
            <MpvPlayer
                ref={mpvPlayerRef}
                source={streamUrl}
                headers={headers}
                paused={paused}
                volume={volume}
                rate={playbackSpeed}
                resizeMode={resizeMode === 'none' ? 'contain' : resizeMode}
                style={localStyles.player}
                onLoad={handleLoad}
                onProgress={handleProgress}
                onEnd={handleEnd}
                onError={handleError}
                onTracksChanged={onTracksChanged}
                useHardwareDecoding={useHardwareDecoding}
            />
        );
    };

    return (
        <View style={[styles.videoContainer, {
            width: screenDimensions.width,
            height: screenDimensions.height,
        }]}>
            {/* Player - ExoPlayer on TV, MPV on mobile */}
            {renderPlayer()}

            {/* Gesture overlay - transparent, on top of the player */}
            <PinchGestureHandler
                ref={pinchRef}
                onGestureEvent={onPinchGestureEvent}
                onHandlerStateChange={onPinchHandlerStateChange}
            >
                <View style={localStyles.gestureOverlay} pointerEvents="box-only">
                    <TouchableWithoutFeedback onPress={toggleControls}>
                        <View style={localStyles.touchArea} />
                    </TouchableWithoutFeedback>
                </View>
            </PinchGestureHandler>
        </View>
    );
});

const localStyles = StyleSheet.create({
    player: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    gestureOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    touchArea: {
        flex: 1,
        backgroundColor: 'transparent',
    },
});
