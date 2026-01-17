import { debugService } from '../services/debugService';

class Logger {
  private isEnabled: boolean;

  constructor() {
    // __DEV__ is a global variable in React Native
    this.isEnabled = __DEV__;
  }

  private formatArgs(args: any[]): string {
    return args
      .map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      })
      .join(' ');
  }

  private extractCategory(args: any[]): string {
    // Try to extract category from first arg if it looks like a tag (e.g., "[ServiceName]")
    if (args.length > 0 && typeof args[0] === 'string') {
      const match = args[0].match(/^\[(\w+)\]/);
      if (match) {
        return match[1].toUpperCase();
      }
    }
    return 'GENERAL';
  }

  log(...args: any[]) {
    if (this.isEnabled) {
      console.log(...args);
    }
    // Forward to debug service
    const category = this.extractCategory(args);
    debugService.captureLog('log', category, this.formatArgs(args));
  }

  error(...args: any[]) {
    if (this.isEnabled) {
      console.error(...args);
    }
    // Always capture errors to debug service
    const category = this.extractCategory(args);
    debugService.captureLog('error', category, this.formatArgs(args));
  }

  warn(...args: any[]) {
    if (this.isEnabled) {
      console.warn(...args);
    }
    // Forward to debug service
    const category = this.extractCategory(args);
    debugService.captureLog('warn', category, this.formatArgs(args));
  }

  info(...args: any[]) {
    if (this.isEnabled) {
      console.info(...args);
    }
    // Forward to debug service
    const category = this.extractCategory(args);
    debugService.captureLog('info', category, this.formatArgs(args));
  }

  debug(...args: any[]) {
    if (this.isEnabled) {
      console.debug(...args);
    }
    // Forward to debug service
    const category = this.extractCategory(args);
    debugService.captureLog('debug', category, this.formatArgs(args));
  }
}

export const logger = new Logger();
