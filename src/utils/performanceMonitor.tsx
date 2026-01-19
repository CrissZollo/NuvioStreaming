/**
 * Performance Monitor for TV Player
 * Tracks memory usage, JS heap, and component render times
 * to diagnose sluggishness over time
 */

import { InteractionManager } from 'react-native';

// Enable/disable performance monitoring
// Set to true to diagnose TV player sluggishness, false for production
export const PERF_MONITOR_ENABLED = false;
const LOG_INTERVAL_MS = 5000; // Log stats every 5 seconds
const WARN_MEMORY_MB = 150; // Warn when JS heap exceeds this

interface PerfStats {
  jsHeapUsed: number;
  jsHeapTotal: number;
  renderCount: number;
  avgRenderTime: number;
  maxRenderTime: number;
  lastRenderTime: number;
  totalRenderTime: number;
  componentCounts: Record<string, number>;
  slowRenders: number; // Renders > 16ms (1 frame at 60fps)
  timestamp: number;
}

interface ComponentRenderEntry {
  component: string;
  time: number;
  timestamp: number;
}

class PerformanceMonitor {
  private stats: PerfStats = {
    jsHeapUsed: 0,
    jsHeapTotal: 0,
    renderCount: 0,
    avgRenderTime: 0,
    maxRenderTime: 0,
    lastRenderTime: 0,
    totalRenderTime: 0,
    componentCounts: {},
    slowRenders: 0,
    timestamp: Date.now(),
  };

  private renderTimes: number[] = [];
  private recentRenders: ComponentRenderEntry[] = [];
  private intervalId: NodeJS.Timeout | null = null;
  private startTime: number = Date.now();
  private listeners: Set<(stats: PerfStats) => void> = new Set();

  start() {
    if (!PERF_MONITOR_ENABLED) return;

    this.startTime = Date.now();
    console.log('[PerfMonitor] Started - monitoring memory and render performance');

    // Log stats periodically
    this.intervalId = setInterval(() => {
      this.collectAndLogStats();
    }, LOG_INTERVAL_MS);

    // Initial log
    setTimeout(() => this.collectAndLogStats(), 1000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('[PerfMonitor] Stopped');
  }

  /**
   * Record a component render
   */
  recordRender(componentName: string, renderTimeMs: number) {
    if (!PERF_MONITOR_ENABLED) return;

    this.stats.renderCount++;
    this.stats.lastRenderTime = renderTimeMs;
    this.stats.totalRenderTime += renderTimeMs;

    if (renderTimeMs > this.stats.maxRenderTime) {
      this.stats.maxRenderTime = renderTimeMs;
    }

    if (renderTimeMs > 16) {
      this.stats.slowRenders++;
    }

    // Track per-component counts
    this.stats.componentCounts[componentName] =
      (this.stats.componentCounts[componentName] || 0) + 1;

    // Keep last 100 render times for averaging
    this.renderTimes.push(renderTimeMs);
    if (this.renderTimes.length > 100) {
      this.renderTimes.shift();
    }

    // Keep recent renders for debugging
    this.recentRenders.push({
      component: componentName,
      time: renderTimeMs,
      timestamp: Date.now(),
    });
    if (this.recentRenders.length > 50) {
      this.recentRenders.shift();
    }

    // Log slow renders immediately
    if (renderTimeMs > 50) {
      console.warn(`[PerfMonitor] SLOW RENDER: ${componentName} took ${renderTimeMs.toFixed(1)}ms`);
    }
  }

  /**
   * Record a function/operation timing
   */
  recordTiming(operationName: string, timeMs: number) {
    if (!PERF_MONITOR_ENABLED) return;

    if (timeMs > 16) {
      console.warn(`[PerfMonitor] SLOW OP: ${operationName} took ${timeMs.toFixed(1)}ms`);
    }
  }

  /**
   * Get current memory info
   */
  private getMemoryInfo(): { heapUsed: number; heapTotal: number } {
    // React Native doesn't expose performance.memory directly
    // We can use a workaround with global.__memoryInfo if available (Hermes)
    try {
      // @ts-ignore - Hermes-specific API
      if (typeof global !== 'undefined' && global.HermesInternal) {
        // @ts-ignore
        const heapInfo = global.HermesInternal.getRuntimeProperties?.();
        if (heapInfo) {
          return {
            heapUsed: heapInfo['Heap Allocated'] || 0,
            heapTotal: heapInfo['Heap Size'] || 0,
          };
        }
      }

      // Fallback: try performance.memory (Chrome/V8)
      // @ts-ignore - performance.memory is non-standard Chrome API
      if (typeof performance !== 'undefined' && (performance as any).memory) {
        // @ts-ignore
        const mem = (performance as any).memory;
        return {
          heapUsed: mem.usedJSHeapSize,
          heapTotal: mem.totalJSHeapSize,
        };
      }
    } catch (e) {
      // Ignore errors
    }

    return { heapUsed: 0, heapTotal: 0 };
  }

  /**
   * Collect stats and log them
   */
  private collectAndLogStats() {
    const memInfo = this.getMemoryInfo();
    const heapUsedMB = memInfo.heapUsed / (1024 * 1024);
    const heapTotalMB = memInfo.heapTotal / (1024 * 1024);

    this.stats.jsHeapUsed = memInfo.heapUsed;
    this.stats.jsHeapTotal = memInfo.heapTotal;
    this.stats.timestamp = Date.now();

    // Calculate average render time
    if (this.renderTimes.length > 0) {
      this.stats.avgRenderTime =
        this.renderTimes.reduce((a, b) => a + b, 0) / this.renderTimes.length;
    }

    const runningTimeMin = ((Date.now() - this.startTime) / 60000).toFixed(1);

    // Build component render summary
    const topComponents = Object.entries(this.stats.componentCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => `${name}:${count}`)
      .join(', ');

    // Log summary
    console.log(
      `[PerfMonitor] ` +
      `Time: ${runningTimeMin}min | ` +
      `Heap: ${heapUsedMB.toFixed(1)}/${heapTotalMB.toFixed(1)}MB | ` +
      `Renders: ${this.stats.renderCount} (slow: ${this.stats.slowRenders}) | ` +
      `Avg: ${this.stats.avgRenderTime.toFixed(1)}ms Max: ${this.stats.maxRenderTime.toFixed(1)}ms`
    );

    if (topComponents) {
      console.log(`[PerfMonitor] Top renderers: ${topComponents}`);
    }

    // Warn if memory is high
    if (heapUsedMB > WARN_MEMORY_MB) {
      console.warn(`[PerfMonitor] ⚠️ HIGH MEMORY: ${heapUsedMB.toFixed(1)}MB used`);
    }

    // Warn if slow renders are increasing
    if (this.stats.slowRenders > 10 && this.stats.slowRenders % 10 === 0) {
      console.warn(`[PerfMonitor] ⚠️ ${this.stats.slowRenders} slow renders detected`);
    }

    // Notify listeners
    this.listeners.forEach(listener => listener(this.stats));
  }

  /**
   * Get current stats
   */
  getStats(): PerfStats {
    return { ...this.stats };
  }

  /**
   * Get recent slow renders
   */
  getSlowRenders(): ComponentRenderEntry[] {
    return this.recentRenders.filter(r => r.time > 16);
  }

  /**
   * Subscribe to stats updates
   */
  subscribe(listener: (stats: PerfStats) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Reset stats (useful when transitioning between screens)
   */
  reset() {
    this.stats = {
      jsHeapUsed: 0,
      jsHeapTotal: 0,
      renderCount: 0,
      avgRenderTime: 0,
      maxRenderTime: 0,
      lastRenderTime: 0,
      totalRenderTime: 0,
      componentCounts: {},
      slowRenders: 0,
      timestamp: Date.now(),
    };
    this.renderTimes = [];
    this.recentRenders = [];
    this.startTime = Date.now();
    console.log('[PerfMonitor] Stats reset');
  }

  /**
   * Force garbage collection if available (Hermes)
   */
  forceGC() {
    try {
      // @ts-ignore - Hermes-specific API
      if (typeof global !== 'undefined' && global.HermesInternal?.collectGarbage) {
        console.log('[PerfMonitor] Forcing GC...');
        // @ts-ignore
        global.HermesInternal.collectGarbage();
        setTimeout(() => this.collectAndLogStats(), 500);
      } else {
        console.log('[PerfMonitor] GC not available on this engine');
      }
    } catch (e) {
      console.log('[PerfMonitor] GC failed:', e);
    }
  }
}

// Singleton instance
export const perfMonitor = new PerformanceMonitor();

/**
 * HOC helper to wrap a component with render timing
 */
export function withPerfTracking<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
): React.ComponentType<P> {
  return function TrackedComponent(props: P) {
    const startTime = PERF_MONITOR_ENABLED ? performance.now() : 0;
    const result = <Component {...props} />;
    if (PERF_MONITOR_ENABLED) {
      // Use InteractionManager to measure after render commits
      InteractionManager.runAfterInteractions(() => {
        const endTime = performance.now();
        perfMonitor.recordRender(componentName, endTime - startTime);
      });
    }
    return result;
  } as React.ComponentType<P>;
}

/**
 * Hook to track component renders
 */
export function useRenderTracking(componentName: string) {
  if (!PERF_MONITOR_ENABLED) return;

  const startTime = performance.now();

  // This runs after each render
  InteractionManager.runAfterInteractions(() => {
    const renderTime = performance.now() - startTime;
    perfMonitor.recordRender(componentName, renderTime);
  });
}

export default perfMonitor;
