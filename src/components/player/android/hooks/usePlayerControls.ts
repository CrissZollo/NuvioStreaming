import { useRef, useCallback } from 'react';

const DEBUG_MODE = __DEV__ && false; // Set to true only when debugging seek issues
const END_EPSILON = 0.3;

export const usePlayerControls = (
    playerRef: any,
    paused: boolean,
    setPaused: (paused: boolean) => void,
    currentTime: number,
    duration: number,
    isSeeking: React.MutableRefObject<boolean>,
    isMounted: React.MutableRefObject<boolean>
) => {
    // iOS seeking helpers
    const iosWasPausedDuringSeekRef = useRef<boolean | null>(null);

    const togglePlayback = useCallback(() => {
        setPaused(!paused);
    }, [paused, setPaused]);

    const seekToTime = useCallback((rawSeconds: number) => {
        const timeInSeconds = Math.max(0, Math.min(rawSeconds, duration > 0 ? duration - END_EPSILON : rawSeconds));

        console.log('[usePlayerControls] seekToTime called:', {
            rawSeconds,
            timeInSeconds,
            hasPlayerRef: !!playerRef?.current,
            duration,
            isSeeking: isSeeking.current
        });

        // ExoPlayer
        if (playerRef.current && duration > 0) {
            console.log(`[usePlayerControls][ExoPlayer] Seeking to ${timeInSeconds}`);

            isSeeking.current = true;
            playerRef.current.seek(timeInSeconds);

            // Reset seeking flag after a delay
            setTimeout(() => {
                if (isMounted.current) {
                    isSeeking.current = false;
                }
            }, 500);
        } else {
            console.log('[usePlayerControls][ExoPlayer] Cannot seek - ref or duration invalid:', {
                hasRef: !!playerRef?.current,
                duration
            });
        }
    }, [duration, paused, setPaused, playerRef, isSeeking, isMounted]);

    const skip = useCallback((seconds: number) => {
        console.log('[usePlayerControls] skip called:', { seconds, currentTime, newTime: currentTime + seconds });
        seekToTime(currentTime + seconds);
    }, [currentTime, seekToTime]);

    return {
        togglePlayback,
        seekToTime,
        skip,
        iosWasPausedDuringSeekRef
    };
};
