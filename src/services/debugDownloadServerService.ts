import { BridgeServer } from 'react-native-http-bridge-refurbished';
import NetInfo from '@react-native-community/netinfo';
import { logger } from '../utils/logger';
import { debugService, DebugReport } from './debugService';

const SERVER_PORT = 8766;

class DebugDownloadServerService {
  private static instance: DebugDownloadServerService;
  private server: BridgeServer | null = null;
  private isRunning: boolean = false;
  private cachedReport: DebugReport | null = null;

  private constructor() {}

  public static getInstance(): DebugDownloadServerService {
    if (!DebugDownloadServerService.instance) {
      DebugDownloadServerService.instance = new DebugDownloadServerService();
    }
    return DebugDownloadServerService.instance;
  }

  public async getDeviceIpAddress(): Promise<string | null> {
    try {
      const netInfo = await NetInfo.fetch();
      if (netInfo.details && 'ipAddress' in netInfo.details) {
        return (netInfo.details as any).ipAddress || null;
      }
      return null;
    } catch (error) {
      logger.error('[DebugDownloadServer] Failed to get IP address:', error);
      return null;
    }
  }

  public async startServer(): Promise<string | null> {
    if (this.isRunning) {
      logger.warn('[DebugDownloadServer] Server already running');
      const ipAddress = await this.getDeviceIpAddress();
      return ipAddress ? `http://${ipAddress}:${SERVER_PORT}` : null;
    }

    try {
      const ipAddress = await this.getDeviceIpAddress();
      if (!ipAddress) {
        logger.error('[DebugDownloadServer] Could not determine device IP address');
        return null;
      }

      // Generate the report before starting server
      this.cachedReport = await debugService.generateReport();

      this.server = new BridgeServer('nuvio_debug_server', true);

      // Serve the download HTML page
      this.server.get('/', async (_req, res) => {
        res.send(200, 'text/html', this.getDownloadHtml());
      });

      // Serve the debug report as JSON download
      this.server.get('/download', async (_req, res) => {
        try {
          // Regenerate fresh report for each download
          const report = await debugService.generateReport();
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

          res.send(200, 'application/json', JSON.stringify(report, null, 2), {
            'Content-Disposition': `attachment; filename="nuvio_debug_report_${timestamp}.json"`,
            'Access-Control-Allow-Origin': '*',
          });
        } catch (error) {
          logger.error('[DebugDownloadServer] Failed to generate report:', error);
          res.send(500, 'application/json', JSON.stringify({ error: 'Failed to generate report' }));
        }
      });

      // API endpoint to get report as JSON (for preview)
      this.server.get('/api/report', async (_req, res) => {
        try {
          const report = await debugService.generateReport();
          res.send(200, 'application/json', JSON.stringify(report, null, 2), {
            'Access-Control-Allow-Origin': '*',
          });
        } catch (error) {
          res.send(500, 'application/json', JSON.stringify({ error: 'Failed to generate report' }));
        }
      });

      await this.server.listen(SERVER_PORT);
      this.isRunning = true;

      const serverUrl = `http://${ipAddress}:${SERVER_PORT}`;
      logger.info(`[DebugDownloadServer] Server started at ${serverUrl}`);
      return serverUrl;
    } catch (error) {
      logger.error('[DebugDownloadServer] Failed to start server:', error);
      this.isRunning = false;
      return null;
    }
  }

  public stopServer(): void {
    if (this.server && this.isRunning) {
      try {
        this.server.stop();
        this.isRunning = false;
        this.cachedReport = null;
        logger.info('[DebugDownloadServer] Server stopped');
      } catch (error) {
        logger.error('[DebugDownloadServer] Failed to stop server:', error);
      }
    }
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  private getDownloadHtml(): string {
    const timestamp = this.cachedReport?.generatedAt
      ? new Date(this.cachedReport.generatedAt).toLocaleString()
      : new Date().toLocaleString();

    const logCount = this.cachedReport?.logs?.length ?? 0;
    const crashCount = this.cachedReport?.crashes?.length ?? 0;
    const appVersion = this.cachedReport?.systemInfo?.appVersion ?? 'Unknown';
    const deviceModel = this.cachedReport?.systemInfo?.deviceModel ?? 'Unknown';
    const platform = this.cachedReport?.systemInfo?.platform ?? 'Unknown';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nuvio Debug Report</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
            color: #fff;
        }
        .container {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 40px;
            max-width: 500px;
            width: 100%;
            text-align: center;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .logo {
            font-size: 48px;
            margin-bottom: 10px;
        }
        h1 {
            font-size: 24px;
            margin-bottom: 8px;
            font-weight: 600;
        }
        .subtitle {
            color: rgba(255, 255, 255, 0.7);
            margin-bottom: 30px;
            font-size: 14px;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            margin-bottom: 30px;
        }
        .stat {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 12px;
            padding: 15px;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .stat-value {
            font-size: 24px;
            font-weight: 700;
            color: #4facfe;
        }
        .stat-label {
            font-size: 12px;
            color: rgba(255, 255, 255, 0.6);
            margin-top: 4px;
        }
        .info {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 12px;
            padding: 15px;
            margin-bottom: 25px;
            text-align: left;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        .info-row:last-child {
            border-bottom: none;
        }
        .info-label {
            color: rgba(255, 255, 255, 0.6);
            font-size: 13px;
        }
        .info-value {
            color: #fff;
            font-size: 13px;
            font-weight: 500;
        }
        .download-btn {
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            color: #000;
            border: none;
            padding: 16px 40px;
            font-size: 16px;
            font-weight: 600;
            border-radius: 12px;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
            width: 100%;
            text-decoration: none;
            display: inline-block;
        }
        .download-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 30px rgba(79, 172, 254, 0.3);
        }
        .download-btn:active {
            transform: translateY(0);
        }
        .footer {
            margin-top: 25px;
            font-size: 12px;
            color: rgba(255, 255, 255, 0.4);
        }
        @media (max-width: 400px) {
            .container {
                padding: 25px;
            }
            .stats {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">🐛</div>
        <h1>Nuvio Debug Report</h1>
        <p class="subtitle">Generated ${timestamp}</p>

        <div class="stats">
            <div class="stat">
                <div class="stat-value">${logCount}</div>
                <div class="stat-label">Log Entries</div>
            </div>
            <div class="stat">
                <div class="stat-value">${crashCount}</div>
                <div class="stat-label">Crash Reports</div>
            </div>
        </div>

        <div class="info">
            <div class="info-row">
                <span class="info-label">App Version</span>
                <span class="info-value">${appVersion}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Device</span>
                <span class="info-value">${deviceModel}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Platform</span>
                <span class="info-value">${platform.toUpperCase()}</span>
            </div>
        </div>

        <a href="/download" class="download-btn" download>
            📥 Download Debug Report
        </a>

        <p class="footer">
            Share this file with the developer to help troubleshoot issues.
        </p>
    </div>
</body>
</html>
    `.trim();
  }
}

export const debugDownloadServerService = DebugDownloadServerService.getInstance();
