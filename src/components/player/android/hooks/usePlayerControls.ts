import { useRef, useCallback } from 'react';

const DEBUG_SEEK = true; // ENABLED for debugging seek performance issues
const END_EPSILON = 0.3;
const SEEK_DEBOUNCE_MS = 150; // Debounce rapid seeks to prevent overwhelming ExoPlayer
let seekCounter = 0;

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

    // CRITICAL: Use refs to store current values so callbacks don't need to depend on them
    // This prevents callback recreation on every state change, which was causing
    // massive re-render cascades in TVPlayerControls
    const pausedRef = useRef(paused);
    const currentTimeRef = useRef(currentTime);
    const durationRef = useRef(duration);

    // Debouncing refs for rapid seeks (D-pad held down)
    const seekDebounceTimer = useRef<NodeJS.Timeout | null>(null);
    const pendingSeekTarget = useRef<number | null>(null);

    // Keep refs up to date
    pausedRef.current = paused;
    currentTimeRef.current = currentTime;
    durationRef.current = duration;

    // togglePlayback uses ref so it doesn't recreate on paused changes
    const togglePlayback = useCallback(() => {
        setPaused(!pausedRef.current);
    }, [setPaused]);

    // Internal function that actually performs the seek
    const executeSeek = useCallback((timeInSeconds: number, seekId: number, seekStartTime: number) => {
        const dur = durationRef.current;

        if (playerRef.current && dur > 0) {
            if (DEBUG_SEEK) {
                console.log(`[usePlayerControls] SEEK #${seekId} EXECUTE at ${timeInSeconds.toFixed(2)}s`);
            }

            isSeeking.current = true;
            playerRef.current.seek(timeInSeconds);

            // Reset seeking flag after a delay
            setTimeout(() => {
                if (isMounted.current) {
                    if (DEBUG_SEEK) {
                        console.log(`[usePlayerControls] SEEK #${seekId} flag reset after 300ms, total elapsed=${(performance.now() - seekStartTime).toFixed(0)}ms`);
                    }
                    isSeeking.current = false;
                }
            }, 300); // Reduced from 500ms for faster response
        } else {
            console.log(`[usePlayerControls] SEEK #${seekId} FAILED - hasRef=${!!playerRef?.current} duration=${dur}`);
        }
    }, [playerRef, isSeeking, isMounted]);

    // seekToTime uses ref so it doesn't recreate on duration changes
    // DEBOUNCED: Rapid seeks (D-pad held down) are coalesced to prevent overwhelming ExoPlayer
    const seekToTime = useCallback((rawSeconds: number) => {
        const seekStartTime = performance.now();
        const seekId = ++seekCounter;
        const dur = durationRef.current;
        const timeInSeconds = Math.max(0, Math.min(rawSeconds, dur > 0 ? dur - END_EPSILON : rawSeconds));

        if (DEBUG_SEEK) {
            console.log(`[usePlayerControls] SEEK #${seekId} REQUEST raw=${rawSeconds.toFixed(2)} clamped=${timeInSeconds.toFixed(2)} duration=${dur.toFixed(2)}`);
        }

        // Store the pending seek target
        pendingSeekTarget.current = timeInSeconds;

        // If there's already a debounce timer, let it handle the pending seek
        if (seekDebounceTimer.current) {
            if (DEBUG_SEEK) {
                console.log(`[usePlayerControls] SEEK #${seekId} DEBOUNCED - will be coalesced`);
            }
            return;
        }

        // Execute immediately for the first seek
        executeSeek(timeInSeconds, seekId, seekStartTime);

        // Set up debounce timer to coalesce rapid seeks
        seekDebounceTimer.current = setTimeout(() => {
            seekDebounceTimer.current = null;

            // If there's a pending seek different from what we just executed, execute it
            if (pendingSeekTarget.current !== null && pendingSeekTarget.current !== timeInSeconds) {
                const finalSeekId = ++seekCounter;
                if (DEBUG_SEEK) {
                    console.log(`[usePlayerControls] SEEK #${finalSeekId} COALESCED executing final position ${pendingSeekTarget.current.toFixed(2)}s`);
                }
                executeSeek(pendingSeekTarget.current, finalSeekId, performance.now());
            }
            pendingSeekTarget.current = null;
        }, SEEK_DEBOUNCE_MS);
    }, [executeSeek]);

    // skip uses ref so it doesn't recreate on currentTime changes
    const skip = useCallback((seconds: number) => {
        const time = currentTimeRef.current;
        if (DEBUG_SEEK) {
            console.log(`[usePlayerControls] SKIP ${seconds > 0 ? '+' : ''}${seconds}s from ${time.toFixed(2)}s to ${(time + seconds).toFixed(2)}s`);
        }
        seekToTime(time + seconds);
    }, [seekToTime]);

    return {
        togglePlayback,
        seekToTime,
        skip,
        iosWasPausedDuringSeekRef
    };
};
