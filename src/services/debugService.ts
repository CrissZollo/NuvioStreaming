import { Platform, Dimensions } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { mmkvStorage } from './mmkvStorage';

// Types
export interface DebugLogEntry {
  timestamp: number;
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  category: string;
  message: string;
  metadata?: Record<string, any>;
}

export interface SystemInfo {
  appVersion: string;
  buildVersion: string;
  platform: 'ios' | 'android';
  osVersion: string;
  deviceModel: string;
  isTV: boolean;
  screenWidth: number;
  screenHeight: number;
  pixelRatio: number;
  jsEngine: string;
  timestamp: number;
}

export interface CrashReport {
  timestamp: number;
  error: string;
  stackTrace?: string;
  componentStack?: string;
  category: string;
  recentLogs: DebugLogEntry[];
}

export interface DebugReport {
  version: string;
  generatedAt: number;
  systemInfo: SystemInfo;
  logs: DebugLogEntry[];
  crashes: CrashReport[];
  relevantSettings: Record<string, any>;
}

export interface DebugStats {
  logCount: number;
  crashCount: number;
  oldestLog: number | null;
  newestLog: number | null;
  storageSizeBytes: number;
}

// Constants
const DEBUG_LOGS_KEY = '@debug:logs';
const DEBUG_CRASHES_KEY = '@debug:crashes';
const DEBUG_ENABLED_KEY = '@debug:enabled';
const MAX_LOGS = 500;
const MAX_CRASHES = 10;
const LOG_RETENTION_DAYS = 7;
const DEBUG_REPORT_VERSION = '1.0.0';

// Sensitive settings to exclude from reports
const SENSITIVE_SETTINGS_KEYS = [
  'apiKey',
  'token',
  'password',
  'secret',
  'credential',
  'auth',
];

class DebugService {
  private static instance: DebugService;
  private isEnabled: boolean = false;
  private logs: DebugLogEntry[] = [];
  private crashes: CrashReport[] = [];
  private initialized: boolean = false;
  private tvDetectionResult: boolean | null = null;

  private constructor() {}

  public static getInstance(): DebugService {
    if (!DebugService.instance) {
      DebugService.instance = new DebugService();
    }
    return DebugService.instance;
  }

  /**
   * Initialize the debug service
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Load enabled state
      const enabledStr = await mmkvStorage.getItem(DEBUG_ENABLED_KEY);
      this.isEnabled = enabledStr === 'true';

      // Load existing logs and crashes
      await this.loadLogs();
      await this.loadCrashes();

      // Clean up old logs
      await this.cleanupOldLogs();

      this.initialized = true;
      if (__DEV__) console.log('[DebugService] Initialized, enabled:', this.isEnabled);
    } catch (error) {
      console.error('[DebugService] Failed to initialize:', error);
      this.initialized = true; // Continue anyway
    }
  }

  /**
   * Enable or disable debug logging
   */
  public async setEnabled(enabled: boolean): Promise<void> {
    this.isEnabled = enabled;
    await mmkvStorage.setItem(DEBUG_ENABLED_KEY, enabled.toString());
    if (__DEV__) console.log('[DebugService] Debug logging', enabled ? 'enabled' : 'disabled');
  }

  /**
   * Check if debug logging is enabled
   */
  public getEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Set TV detection result (called from app initialization)
   */
  public setTVDetection(isTV: boolean): void {
    this.tvDetectionResult = isTV;
  }

  /**
   * Capture a log entry
   */
  public captureLog(
    level: DebugLogEntry['level'],
    category: string,
    message: string,
    metadata?: Record<string, any>
  ): void {
    if (!this.isEnabled) return;

    const entry: DebugLogEntry = {
      timestamp: Date.now(),
      level,
      category,
      message: this.truncateMessage(message),
      metadata: metadata ? this.sanitizeMetadata(metadata) : undefined,
    };

    this.logs.push(entry);

    // Keep only last MAX_LOGS entries
    if (this.logs.length > MAX_LOGS) {
      this.logs = this.logs.slice(-MAX_LOGS);
    }

    // Debounce save to avoid too many writes
    this.debouncedSaveLogs();
  }

  /**
   * Capture an error/crash
   */
  public captureError(
    error: Error | string,
    category: string = 'ERROR',
    componentStack?: string
  ): void {
    if (!this.isEnabled) return;

    const errorMessage = error instanceof Error ? error.message : error;
    const stackTrace = error instanceof Error ? error.stack : undefined;

    const crashReport: CrashReport = {
      timestamp: Date.now(),
      error: errorMessage,
      stackTrace,
      componentStack,
      category,
      recentLogs: this.logs.slice(-20), // Last 20 logs for context
    };

    this.crashes.push(crashReport);

    // Keep only last MAX_CRASHES
    if (this.crashes.length > MAX_CRASHES) {
      this.crashes = this.crashes.slice(-MAX_CRASHES);
    }

    this.saveCrashes();
  }

  /**
   * Get debug statistics
   */
  public getStats(): DebugStats {
    const logTimestamps = this.logs.map(l => l.timestamp);
    const logsJson = JSON.stringify(this.logs);
    const crashesJson = JSON.stringify(this.crashes);

    return {
      logCount: this.logs.length,
      crashCount: this.crashes.length,
      oldestLog: logTimestamps.length > 0 ? Math.min(...logTimestamps) : null,
      newestLog: logTimestamps.length > 0 ? Math.max(...logTimestamps) : null,
      storageSizeBytes: new Blob([logsJson, crashesJson]).size,
    };
  }

  /**
   * Collect system information
   */
  public async collectSystemInfo(): Promise<SystemInfo> {
    const { width, height } = Dimensions.get('window');
    const { PixelRatio } = require('react-native');

    // Try to get app version
    let appVersion = '1.0.0';
    let buildVersion = '1';
    try {
      const { APP_VERSION, BUILD_VERSION } = require('../utils/version');
      appVersion = APP_VERSION || '1.0.0';
      buildVersion = BUILD_VERSION || '1';
    } catch {
      // Use defaults
    }

    // Detect JS engine
    const jsEngine = (global as any).HermesInternal ? 'Hermes' : 'JSC';

    return {
      appVersion,
      buildVersion,
      platform: Platform.OS as 'ios' | 'android',
      osVersion: String(Platform.Version),
      deviceModel: await this.getDeviceModel(),
      isTV: this.tvDetectionResult ?? false,
      screenWidth: width,
      screenHeight: height,
      pixelRatio: PixelRatio.get(),
      jsEngine,
      timestamp: Date.now(),
    };
  }

  /**
   * Generate a complete debug report
   */
  public async generateReport(): Promise<DebugReport> {
    const systemInfo = await this.collectSystemInfo();
    const relevantSettings = await this.getRelevantSettings();

    return {
      version: DEBUG_REPORT_VERSION,
      generatedAt: Date.now(),
      systemInfo,
      logs: [...this.logs],
      crashes: [...this.crashes],
      relevantSettings,
    };
  }

  /**
   * Export debug report to a file and share it
   */
  public async exportAndShare(): Promise<void> {
    try {
      const report = await this.generateReport();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `nuvio_debug_report_${timestamp}.json`;
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;

      await FileSystem.writeAsStringAsync(
        fileUri,
        JSON.stringify(report, null, 2),
        { encoding: FileSystem.EncodingType.UTF8 }
      );

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Share Nuvio Debug Report',
          UTI: 'public.json',
        });
      } else {
        throw new Error('Sharing is not available on this device');
      }
    } catch (error) {
      console.error('[DebugService] Failed to export report:', error);
      throw error;
    }
  }

  /**
   * Clear all logs and crashes
   */
  public async clearAll(): Promise<void> {
    this.logs = [];
    this.crashes = [];
    await Promise.all([
      mmkvStorage.removeItem(DEBUG_LOGS_KEY),
      mmkvStorage.removeItem(DEBUG_CRASHES_KEY),
    ]);
    if (__DEV__) console.log('[DebugService] All logs cleared');
  }

  /**
   * Get all logs (for debugging)
   */
  public getLogs(): DebugLogEntry[] {
    return [...this.logs];
  }

  /**
   * Get all crashes (for debugging)
   */
  public getCrashes(): CrashReport[] {
    return [...this.crashes];
  }

  // Private methods

  private async loadLogs(): Promise<void> {
    try {
      const logsJson = await mmkvStorage.getItem(DEBUG_LOGS_KEY);
      if (logsJson) {
        this.logs = JSON.parse(logsJson);
      }
    } catch (error) {
      console.error('[DebugService] Failed to load logs:', error);
      this.logs = [];
    }
  }

  private async loadCrashes(): Promise<void> {
    try {
      const crashesJson = await mmkvStorage.getItem(DEBUG_CRASHES_KEY);
      if (crashesJson) {
        this.crashes = JSON.parse(crashesJson);
      }
    } catch (error) {
      console.error('[DebugService] Failed to load crashes:', error);
      this.crashes = [];
    }
  }

  private saveLogsTimeout: NodeJS.Timeout | null = null;

  private debouncedSaveLogs(): void {
    if (this.saveLogsTimeout) {
      clearTimeout(this.saveLogsTimeout);
    }
    this.saveLogsTimeout = setTimeout(() => {
      this.saveLogs();
    }, 1000); // Save at most once per second
  }

  private async saveLogs(): Promise<void> {
    try {
      await mmkvStorage.setItem(DEBUG_LOGS_KEY, JSON.stringify(this.logs));
    } catch (error) {
      console.error('[DebugService] Failed to save logs:', error);
    }
  }

  private async saveCrashes(): Promise<void> {
    try {
      await mmkvStorage.setItem(DEBUG_CRASHES_KEY, JSON.stringify(this.crashes));
    } catch (error) {
      console.error('[DebugService] Failed to save crashes:', error);
    }
  }

  private async cleanupOldLogs(): Promise<void> {
    const cutoffTime = Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const beforeCount = this.logs.length;
    this.logs = this.logs.filter(log => log.timestamp > cutoffTime);

    if (this.logs.length !== beforeCount) {
      await this.saveLogs();
      if (__DEV__) {
        console.log(`[DebugService] Cleaned up ${beforeCount - this.logs.length} old logs`);
      }
    }
  }

  private truncateMessage(message: string, maxLength: number = 2000): string {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength) + '... (truncated)';
  }

  private sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(metadata)) {
      // Skip sensitive keys
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_SETTINGS_KEYS.some(sensitive => lowerKey.includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeMetadata(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  private async getDeviceModel(): Promise<string> {
    // Try to get device info from expo-device if available
    try {
      const Device = require('expo-device');
      return Device.modelName || Device.deviceName || 'Unknown';
    } catch {
      return Platform.OS === 'ios' ? 'iOS Device' : 'Android Device';
    }
  }

  private async getRelevantSettings(): Promise<Record<string, any>> {
    try {
      const scope = (await mmkvStorage.getItem('@user:current')) || 'local';
      const scopedKey = `@user:${scope}:app_settings`;
      const settingsJson = await mmkvStorage.getItem(scopedKey);

      if (!settingsJson) return {};

      const settings = JSON.parse(settingsJson);
      const sanitized: Record<string, any> = {};

      // Include only non-sensitive settings
      for (const [key, value] of Object.entries(settings)) {
        const lowerKey = key.toLowerCase();
        if (SENSITIVE_SETTINGS_KEYS.some(sensitive => lowerKey.includes(sensitive))) {
          continue; // Skip sensitive keys entirely
        }
        sanitized[key] = value;
      }

      return sanitized;
    } catch (error) {
      console.error('[DebugService] Failed to get settings:', error);
      return {};
    }
  }
}

export const debugService = DebugService.getInstance();
