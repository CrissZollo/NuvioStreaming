/**
 * Performance logging utility for TV focus navigation debugging.
 *
 * Usage:
 *   import { focusLog } from '../utils/focusPerformanceLogger';
 *
 *   focusLog.start('Focusable.handleFocus');
 *   focusLog.mark('setState done');
 *   focusLog.end('Focusable.handleFocus', startTime);
 *
 * Output:
 *   [FOCUS] Focusable.handleFocus | +15.2ms
 *   [FOCUS] MARK: setState done @ 12345.6
 *   [FOCUS] Focusable.handleFocus completed in 3.1ms
 */

const LOG_ENABLED = __DEV__;

interface LogEntry {
  timestamp: number;
  event: string;
  duration?: number;
}

const logs: LogEntry[] = [];
let lastEventTime = 0;
let sessionStartTime = 0;

export const focusLog = {
  /**
   * Start tracking an event. Logs time since last event.
   */
  start: (event: string): number => {
    if (!LOG_ENABLED) return 0;
    const now = performance.now();
    const sinceLast = lastEventTime ? now - lastEventTime : 0;
    lastEventTime = now;

    if (!sessionStartTime) sessionStartTime = now;

    console.log(`[FOCUS] ${event} | +${sinceLast.toFixed(1)}ms`);
    logs.push({ timestamp: now, event });

    return now; // Return start time for use with end()
  },

  /**
   * End tracking an event. Logs duration since startTime.
   */
  end: (event: string, startTime: number): void => {
    if (!LOG_ENABLED) return;
    const duration = performance.now() - startTime;
    console.log(`[FOCUS] ${event} completed in ${duration.toFixed(1)}ms`);

    // Update the log entry with duration
    const entry = logs.find(l => l.event === event && l.timestamp === startTime);
    if (entry) entry.duration = duration;
  },

  /**
   * Log a checkpoint within an event.
   */
  mark: (label: string): void => {
    if (!LOG_ENABLED) return;
    const now = performance.now();
    const sinceSession = sessionStartTime ? now - sessionStartTime : 0;
    console.log(`[FOCUS] MARK: ${label} @ ${sinceSession.toFixed(1)}ms`);
  },

  /**
   * Log a warning (always visible, even in prod for debugging)
   */
  warn: (message: string): void => {
    console.warn(`[FOCUS] WARNING: ${message}`);
  },

  /**
   * Dump all collected logs.
   */
  dump: (): void => {
    console.log('[FOCUS] === Event Log ===');
    logs.forEach(l => {
      const duration = l.duration ? ` (${l.duration.toFixed(1)}ms)` : '';
      console.log(`  ${l.event}${duration} @ ${l.timestamp.toFixed(1)}`);
    });
  },

  /**
   * Clear all logs and reset timing.
   */
  clear: (): void => {
    logs.length = 0;
    lastEventTime = 0;
    sessionStartTime = 0;
    console.log('[FOCUS] Logs cleared');
  },

  /**
   * Get the number of logged events (useful for counting re-renders)
   */
  getEventCount: (): number => logs.length,

  /**
   * Log a render with component name and render count
   */
  render: (componentName: string, renderCount: number): void => {
    if (!LOG_ENABLED) return;
    console.log(`[FOCUS] RENDER: ${componentName} #${renderCount}`);
  },
};

export default focusLog;
