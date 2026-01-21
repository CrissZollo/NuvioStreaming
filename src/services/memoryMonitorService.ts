import { AppState, AppStateStatus, Platform } from 'react-native';
import { logger } from '../utils/logger';
import { memoryManager } from '../utils/memoryManager';

// TV detection helper - check if running on Android TV
const isTV = (): boolean => {
  try {
    // Platform.isTV is available in React Native
    return Platform.isTV === true;
  } catch {
    return false;
  }
};

/**
 * Global memory monitoring service to prevent OutOfMemoryError
 * Monitors app state changes and automatically manages memory
 */
class MemoryMonitorService {
  private static instance: MemoryMonitorService;
  private appStateSubscription: any = null;
  private memoryCheckInterval: NodeJS.Timeout | null = null;
  private backgroundCleanupInterval: NodeJS.Timeout | null = null;
  private lastMemoryWarning: number = 0;
  // TV devices have limited RAM (often 2GB or less), so check more frequently
  private readonly MEMORY_CHECK_INTERVAL = isTV() ? 60 * 1000 : 2 * 60 * 1000; // 1 minute for TV, 2 minutes for mobile
  private readonly BACKGROUND_CLEANUP_INTERVAL = isTV() ? 5 * 60 * 1000 : 10 * 60 * 1000; // 5 minutes for TV, 10 minutes for mobile
  private readonly MEMORY_WARNING_COOLDOWN = 5 * 60 * 1000; // 5 minutes (was 1 minute)

  private constructor() {
    this.startMonitoring();
  }

  static getInstance(): MemoryMonitorService {
    if (!MemoryMonitorService.instance) {
      MemoryMonitorService.instance = new MemoryMonitorService();
    }
    return MemoryMonitorService.instance;
  }

  private startMonitoring(): void {
    // Monitor app state changes
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);

    // Periodic memory checks
    this.memoryCheckInterval = setInterval(() => {
      this.performMemoryCheck();
    }, this.MEMORY_CHECK_INTERVAL);

    // Background cleanup
    this.backgroundCleanupInterval = setInterval(() => {
      this.performBackgroundCleanup();
    }, this.BACKGROUND_CLEANUP_INTERVAL);

    if (__DEV__) logger.log('[MemoryMonitor] Started memory monitoring service');
  }

  private handleAppStateChange = (nextAppState: AppStateStatus) => {
    try {
      switch (nextAppState) {
        case 'background':
          // App going to background - aggressive cleanup
          this.performAggressiveCleanup();
          break;

        case 'active':
          // App coming to foreground - light cleanup (no logging, this is normal)
          memoryManager.checkMemoryPressure();
          break;
          
        case 'inactive':
          // App becoming inactive - medium cleanup
          memoryManager.forceGarbageCollection();
          break;
      }
    } catch (error) {
      logger.error('[MemoryMonitor] Error handling app state change:', error);
    }
  };

  private performMemoryCheck(): void {
    try {
      // Check if we should perform cleanup - silent operation, no logging needed
      memoryManager.checkMemoryPressure();
      // Note: Removed detectMemoryIssues() call - the random 10% cleanup was causing unnecessary churn
    } catch (error) {
      if (__DEV__) logger.error('[MemoryMonitor] Error during memory check:', error);
    }
  }

  private detectMemoryIssues(): void {
    // This function is now disabled - the random 10% cleanup was causing
    // unnecessary churn and logging on idle screens. Real memory pressure
    // should be detected through actual system callbacks, not random chance.
  }

  private issueMemoryWarning(): void {
    const now = Date.now();
    this.lastMemoryWarning = now;

    // Perform cleanup silently - only log in dev
    if (__DEV__) logger.warn('[MemoryMonitor] Memory usage warning - performing preventive cleanup');

    // Perform immediate cleanup
    this.performAggressiveCleanup();
  }

  private performBackgroundCleanup(): void {
    try {
      // Silent background cleanup - no logging needed for routine maintenance
      memoryManager.forceGarbageCollection();
      this.clearGlobalCaches();
    } catch (error) {
      if (__DEV__) logger.error('[MemoryMonitor] Error during background cleanup:', error);
    }
  }

  private performAggressiveCleanup(): void {
    try {
      // Silent aggressive cleanup - only run once, not 3x in a loop
      memoryManager.forceGarbageCollection();
      this.clearGlobalCaches();
      this.clearImageCaches();
    } catch (error) {
      if (__DEV__) logger.error('[MemoryMonitor] Error during aggressive cleanup:', error);
    }
  }

  private clearGlobalCaches(): void {
    try {
      // Clear any global caches your app might have
      if (global && (global as any).__APP_CACHE__) {
        (global as any).__APP_CACHE__ = {};
      }

      if (global && (global as any).__METADATA_CACHE__) {
        (global as any).__METADATA_CACHE__ = {};
      }

      if (global && (global as any).__EPISODE_CACHE__) {
        (global as any).__EPISODE_CACHE__ = {};
      }
    } catch (error) {
      // Silent failure - cache clearing is best-effort
    }
  }

  private clearImageCaches(): void {
    try {
      // Clear React Native image caches if available
      if (global && (global as any).__IMAGE_CACHE__) {
        (global as any).__IMAGE_CACHE__ = {};
      }
    } catch (error) {
      // Silent failure - cache clearing is best-effort
    }
  }

  /**
   * Manually trigger memory cleanup (for external use)
   */
  public forceCleanup(): void {
    this.performAggressiveCleanup();
  }

  /**
   * Get memory monitoring statistics
   */
  public getStats(): {
    lastMemoryWarning: number;
    monitoringActive: boolean;
    cleanupIntervals: {
      memoryCheck: number;
      backgroundCleanup: number;
    };
  } {
    return {
      lastMemoryWarning: this.lastMemoryWarning,
      monitoringActive: this.memoryCheckInterval !== null,
      cleanupIntervals: {
        memoryCheck: this.MEMORY_CHECK_INTERVAL,
        backgroundCleanup: this.BACKGROUND_CLEANUP_INTERVAL,
      },
    };
  }

  /**
   * Stop monitoring (for cleanup when app is destroyed)
   */
  public stopMonitoring(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }
    
    if (this.backgroundCleanupInterval) {
      clearInterval(this.backgroundCleanupInterval);
      this.backgroundCleanupInterval = null;
    }
    
    if (__DEV__) logger.log('[MemoryMonitor] Stopped memory monitoring service');
  }

  /**
   * Handle low memory warnings from the system
   */
  public handleLowMemoryWarning(): void {
    // This is a legitimate system warning, so we do perform cleanup
    this.performAggressiveCleanup();
  }
}

// Export singleton instance
export const memoryMonitorService = MemoryMonitorService.getInstance();
