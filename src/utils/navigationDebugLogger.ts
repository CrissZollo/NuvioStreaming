/**
 * Navigation Debug Logger
 *
 * Comprehensive logging for TV navigation debugging.
 * Enable by setting NAV_DEBUG_ENABLED = true
 *
 * Categories:
 * - FOCUS: Focus changes and focus-related events
 * - SCROLL: Automatic scrolling and scroll position changes
 * - KEY: Key events from TV remote
 * - RENDER: Component renders that may cause lag
 * - PERF: Performance timing for slow operations
 */

// Toggle this to enable/disable all navigation debug logs
// IMPORTANT: Keep this false for production builds - causes severe performance issues on TV
export const NAV_DEBUG_ENABLED = __DEV__ && false;

// Individual category toggles (only apply when NAV_DEBUG_ENABLED is true)
const CATEGORIES = {
  FOCUS: true,    // Focus changes
  SCROLL: true,   // Scroll events
  KEY: true,      // Key events
  RENDER: true,   // Render tracking
  PERF: true,     // Performance timing
  DATA: true,     // Data loading
};

type Category = keyof typeof CATEGORIES;

interface TimingEntry {
  start: number;
  label: string;
}

const activeTimings: Map<string, TimingEntry> = new Map();
let lastLogTime = 0;
let focusChangeCount = 0;
let scrollEventCount = 0;
let keyEventCount = 0;

const getTimestamp = () => {
  const now = performance.now();
  const delta = lastLogTime ? now - lastLogTime : 0;
  lastLogTime = now;
  return { now, delta };
};

const formatDelta = (delta: number) => {
  if (delta < 1) return '';
  if (delta < 100) return `+${delta.toFixed(0)}ms`;
  return `+${(delta / 1000).toFixed(2)}s`;
};

const log = (category: Category, ...args: unknown[]) => {
  if (!NAV_DEBUG_ENABLED || !CATEGORIES[category]) return;

  const { delta } = getTimestamp();
  const deltaStr = formatDelta(delta);
  const prefix = `[NAV:${category}]`;

  console.log(prefix, deltaStr, ...args);
};

export const navLog = {
  // ============ FOCUS LOGGING ============

  /**
   * Log when a component receives focus
   */
  focus: (componentName: string, details?: Record<string, unknown>) => {
    focusChangeCount++;
    log('FOCUS', `#${focusChangeCount} GAINED:`, componentName, details || '');
  },

  /**
   * Log when a component loses focus
   */
  blur: (componentName: string, details?: Record<string, unknown>) => {
    log('FOCUS', `LOST:`, componentName, details || '');
  },

  /**
   * Log focus direction change (what direction user pressed)
   */
  focusDirection: (direction: string, from?: string, to?: string) => {
    log('FOCUS', `DIRECTION: ${direction}`, from ? `from=${from}` : '', to ? `to=${to}` : '');
  },

  /**
   * Log when focus is blocked
   */
  focusBlocked: (direction: string, componentName: string, reason?: string) => {
    log('FOCUS', `BLOCKED: ${direction} at ${componentName}`, reason || '');
  },

  // ============ SCROLL LOGGING ============

  /**
   * Log automatic scroll triggered by focus
   */
  scrollToFocus: (componentName: string, targetOffset: number, currentOffset: number) => {
    scrollEventCount++;
    const delta = targetOffset - currentOffset;
    log('SCROLL', `#${scrollEventCount} TO_FOCUS:`, componentName,
      `target=${targetOffset.toFixed(0)}`,
      `current=${currentOffset.toFixed(0)}`,
      `delta=${delta.toFixed(0)}`
    );
  },

  /**
   * Log when scroll is skipped (already in view)
   */
  scrollSkipped: (componentName: string, reason: string) => {
    log('SCROLL', `SKIPPED:`, componentName, reason);
  },

  /**
   * Log FlatList/ScrollView scroll events
   */
  scrollEvent: (componentName: string, offset: number, velocity?: number) => {
    log('SCROLL', `EVENT:`, componentName,
      `offset=${offset.toFixed(0)}`,
      velocity !== undefined ? `velocity=${velocity.toFixed(2)}` : ''
    );
  },

  /**
   * Log scroll animation start
   */
  scrollAnimStart: (componentName: string, from: number, to: number, duration?: number) => {
    log('SCROLL', `ANIM_START:`, componentName,
      `from=${from.toFixed(0)}`,
      `to=${to.toFixed(0)}`,
      duration ? `duration=${duration}ms` : ''
    );
  },

  /**
   * Log scroll animation end
   */
  scrollAnimEnd: (componentName: string) => {
    log('SCROLL', `ANIM_END:`, componentName);
  },

  // ============ KEY EVENT LOGGING ============

  /**
   * Log key press from TV remote
   */
  keyEvent: (keyName: string, action: 'down' | 'up', repeatCount?: number) => {
    keyEventCount++;
    log('KEY', `#${keyEventCount} ${action.toUpperCase()}:`, keyName,
      repeatCount && repeatCount > 0 ? `repeat=${repeatCount}` : ''
    );
  },

  /**
   * Log key event being debounced/ignored
   */
  keyDebounced: (keyName: string, reason: string) => {
    log('KEY', `DEBOUNCED:`, keyName, reason);
  },

  /**
   * Log key event handler execution
   */
  keyHandler: (keyName: string, handlerName: string) => {
    log('KEY', `HANDLER:`, keyName, `->`, handlerName);
  },

  // ============ RENDER LOGGING ============

  /**
   * Log component render
   */
  render: (componentName: string, renderCount: number, reason?: string) => {
    log('RENDER', componentName, `#${renderCount}`, reason || '');
  },

  /**
   * Log list item render
   */
  listItemRender: (listName: string, index: number, itemId?: string) => {
    log('RENDER', `LIST_ITEM:`, listName, `[${index}]`, itemId || '');
  },

  /**
   * Log when many items render at once (potential perf issue)
   */
  batchRender: (componentName: string, count: number) => {
    if (count > 5) {
      log('RENDER', `BATCH_WARNING:`, componentName, `${count} items rendered at once`);
    }
  },

  // ============ PERFORMANCE LOGGING ============

  /**
   * Start timing an operation
   */
  perfStart: (operationName: string) => {
    if (!NAV_DEBUG_ENABLED || !CATEGORIES.PERF) return;
    activeTimings.set(operationName, {
      start: performance.now(),
      label: operationName,
    });
    log('PERF', `START:`, operationName);
  },

  /**
   * End timing an operation
   */
  perfEnd: (operationName: string) => {
    if (!NAV_DEBUG_ENABLED || !CATEGORIES.PERF) return;
    const entry = activeTimings.get(operationName);
    if (entry) {
      const duration = performance.now() - entry.start;
      activeTimings.delete(operationName);

      // Warn if operation took too long
      if (duration > 16) { // More than one frame at 60fps
        console.warn(`[NAV:PERF] SLOW:`, operationName, `${duration.toFixed(1)}ms`);
      } else {
        log('PERF', `END:`, operationName, `${duration.toFixed(1)}ms`);
      }
    }
  },

  /**
   * Log a performance warning
   */
  perfWarn: (message: string, duration?: number) => {
    console.warn(`[NAV:PERF] WARNING:`, message, duration ? `${duration.toFixed(1)}ms` : '');
  },

  // ============ DATA LOADING LOGGING ============

  /**
   * Log data fetch start
   */
  dataFetchStart: (dataName: string) => {
    log('DATA', `FETCH_START:`, dataName);
    navLog.perfStart(`fetch:${dataName}`);
  },

  /**
   * Log data fetch complete
   */
  dataFetchEnd: (dataName: string, itemCount?: number) => {
    log('DATA', `FETCH_END:`, dataName, itemCount !== undefined ? `${itemCount} items` : '');
    navLog.perfEnd(`fetch:${dataName}`);
  },

  /**
   * Log data processing
   */
  dataProcess: (dataName: string, message: string) => {
    log('DATA', `PROCESS:`, dataName, message);
  },

  // ============ UTILITY ============

  /**
   * Get current stats
   */
  getStats: () => ({
    focusChanges: focusChangeCount,
    scrollEvents: scrollEventCount,
    keyEvents: keyEventCount,
  }),

  /**
   * Reset all counters
   */
  reset: () => {
    focusChangeCount = 0;
    scrollEventCount = 0;
    keyEventCount = 0;
    lastLogTime = 0;
    activeTimings.clear();
    console.log('[NAV] Debug counters reset');
  },

  /**
   * Print summary of current stats
   */
  summary: () => {
    console.log('[NAV] === SUMMARY ===');
    console.log(`  Focus changes: ${focusChangeCount}`);
    console.log(`  Scroll events: ${scrollEventCount}`);
    console.log(`  Key events: ${keyEventCount}`);
    console.log(`  Active timings: ${activeTimings.size}`);
  },

  /**
   * Generic log for custom messages
   */
  log: (category: Category, ...args: unknown[]) => {
    log(category, ...args);
  },
};

export default navLog;
