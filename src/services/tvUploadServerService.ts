import { BridgeServer } from 'react-native-http-bridge-refurbished';
import NetInfo from '@react-native-community/netinfo';
import { logger } from '../utils/logger';
import { backupService, BackupData } from './backupService';

const SERVER_PORT = 8765;

type FileReceivedCallback = (backupData: BackupData) => void;
type ErrorCallback = (error: string) => void;

class TVUploadServerService {
  private static instance: TVUploadServerService;
  private server: BridgeServer | null = null;
  private isRunning: boolean = false;
  private onFileReceived: FileReceivedCallback | null = null;
  private onError: ErrorCallback | null = null;

  private constructor() {}

  public static getInstance(): TVUploadServerService {
    if (!TVUploadServerService.instance) {
      TVUploadServerService.instance = new TVUploadServerService();
    }
    return TVUploadServerService.instance;
  }

  public async getDeviceIpAddress(): Promise<string | null> {
    try {
      const netInfo = await NetInfo.fetch();
      if (netInfo.details && 'ipAddress' in netInfo.details) {
        return (netInfo.details as any).ipAddress || null;
      }
      return null;
    } catch (error) {
      logger.error('[TVUploadServer] Failed to get IP address:', error);
      return null;
    }
  }

  public async startServer(
    onFileReceived: FileReceivedCallback,
    onError: ErrorCallback
  ): Promise<string | null> {
    if (this.isRunning) {
      logger.warn('[TVUploadServer] Server already running');
      return null;
    }

    this.onFileReceived = onFileReceived;
    this.onError = onError;

    try {
      const ipAddress = await this.getDeviceIpAddress();
      if (!ipAddress) {
        onError('Could not determine device IP address. Make sure you are connected to WiFi.');
        return null;
      }

      this.server = new BridgeServer('nuvio_backup_server', true);

      // Serve the upload HTML page
      this.server.get('/', async (_req, res) => {
        res.send(200, 'text/html', this.getUploadHtml());
      });

      this.server.get('/upload', async (_req, res) => {
        res.send(200, 'text/html', this.getUploadHtml());
      });

      // Handle file upload
      this.server.post('/upload', async (req, res) => {
        try {
          logger.info('[TVUploadServer] Received upload request');

          // The data comes through postData or the data getter
          const body = req.data || req.postData;
          if (!body) {
            res.send(400, 'application/json', JSON.stringify({
              success: false,
              error: 'No data received'
            }));
            return;
          }

          // Try to parse the backup data
          let backupData: BackupData;
          try {
            // The body might be the raw JSON string or already parsed
            if (typeof body === 'string') {
              backupData = JSON.parse(body);
            } else if (typeof body === 'object' && (body as any).fileContent) {
              // Handle form data with file content
              backupData = JSON.parse((body as any).fileContent);
            } else {
              backupData = body as BackupData;
            }
          } catch (parseError) {
            logger.error('[TVUploadServer] Failed to parse backup data:', parseError);
            res.send(400, 'application/json', JSON.stringify({
              success: false,
              error: 'Invalid JSON format'
            }));
            return;
          }

          // Validate backup structure
          if (!backupData.version || !backupData.timestamp || !backupData.data) {
            res.send(400, 'application/json', JSON.stringify({
              success: false,
              error: 'Invalid backup file format. Missing required fields.'
            }));
            return;
          }

          logger.info('[TVUploadServer] Valid backup received:', {
            version: backupData.version,
            timestamp: backupData.timestamp,
            metadata: backupData.metadata
          });

          // Send success response
          res.send(200, 'application/json', JSON.stringify({
            success: true,
            message: 'Backup received successfully!',
            metadata: backupData.metadata
          }));

          // Notify the callback
          if (this.onFileReceived) {
            this.onFileReceived(backupData);
          }

        } catch (error) {
          logger.error('[TVUploadServer] Error processing upload:', error);
          res.send(500, 'application/json', JSON.stringify({
            success: false,
            error: 'Server error processing upload'
          }));
          if (this.onError) {
            this.onError('Error processing upload');
          }
        }
      });

      // Start listening
      this.server.listen(SERVER_PORT);
      this.isRunning = true;

      const serverUrl = `http://${ipAddress}:${SERVER_PORT}`;
      logger.info(`[TVUploadServer] Server started at ${serverUrl}`);

      return serverUrl;

    } catch (error) {
      logger.error('[TVUploadServer] Failed to start server:', error);
      onError(`Failed to start server: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.cleanup();
      return null;
    }
  }

  public stopServer(): void {
    logger.info('[TVUploadServer] Stopping server');
    this.cleanup();
  }

  private cleanup(): void {
    if (this.server) {
      try {
        this.server.stop();
      } catch (error) {
        logger.error('[TVUploadServer] Error stopping server:', error);
      }
      this.server = null;
    }
    this.isRunning = false;
    this.onFileReceived = null;
    this.onError = null;
  }

  public isServerRunning(): boolean {
    return this.isRunning;
  }

  private getUploadHtml(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nuvio - Restore Backup</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      color: #fff;
    }
    .container {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      padding: 40px;
      max-width: 450px;
      width: 100%;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .logo {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo h1 {
      font-size: 32px;
      font-weight: 700;
      background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .logo p {
      color: rgba(255, 255, 255, 0.7);
      margin-top: 8px;
    }
    .upload-area {
      border: 2px dashed rgba(255, 255, 255, 0.3);
      border-radius: 16px;
      padding: 40px 20px;
      text-align: center;
      cursor: pointer;
      transition: all 0.3s ease;
      margin-bottom: 20px;
    }
    .upload-area:hover {
      border-color: #667eea;
      background: rgba(102, 126, 234, 0.1);
    }
    .upload-area.dragover {
      border-color: #667eea;
      background: rgba(102, 126, 234, 0.2);
      transform: scale(1.02);
    }
    .upload-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }
    .upload-text {
      color: rgba(255, 255, 255, 0.9);
      font-size: 16px;
      margin-bottom: 8px;
    }
    .upload-hint {
      color: rgba(255, 255, 255, 0.5);
      font-size: 14px;
    }
    input[type="file"] {
      display: none;
    }
    .file-info {
      background: rgba(102, 126, 234, 0.2);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 20px;
      display: none;
    }
    .file-info.show {
      display: block;
    }
    .file-name {
      font-weight: 600;
      margin-bottom: 8px;
      word-break: break-all;
    }
    .file-size {
      color: rgba(255, 255, 255, 0.6);
      font-size: 14px;
    }
    .btn {
      width: 100%;
      padding: 16px;
      border: none;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
    }
    .btn-primary {
      background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
      color: #fff;
    }
    .btn-primary:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
    }
    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .status {
      margin-top: 20px;
      padding: 16px;
      border-radius: 12px;
      text-align: center;
      display: none;
    }
    .status.show {
      display: block;
    }
    .status.success {
      background: rgba(34, 197, 94, 0.2);
      color: #22c55e;
    }
    .status.error {
      background: rgba(239, 68, 68, 0.2);
      color: #ef4444;
    }
    .status.loading {
      background: rgba(102, 126, 234, 0.2);
      color: #667eea;
    }
    .spinner {
      display: inline-block;
      width: 20px;
      height: 20px;
      border: 2px solid currentColor;
      border-right-color: transparent;
      border-radius: 50%;
      animation: spin 0.75s linear infinite;
      margin-right: 8px;
      vertical-align: middle;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <h1>Nuvio</h1>
      <p>Restore Backup to TV</p>
    </div>

    <div class="upload-area" id="dropZone">
      <div class="upload-icon">📁</div>
      <div class="upload-text">Tap to select backup file</div>
      <div class="upload-hint">or drag and drop here</div>
    </div>

    <input type="file" id="fileInput" accept=".json,application/json">

    <div class="file-info" id="fileInfo">
      <div class="file-name" id="fileName"></div>
      <div class="file-size" id="fileSize"></div>
    </div>

    <button class="btn btn-primary" id="uploadBtn" disabled>
      Upload Backup
    </button>

    <div class="status" id="status"></div>
  </div>

  <script>
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');
    const uploadBtn = document.getElementById('uploadBtn');
    const status = document.getElementById('status');

    let selectedFile = null;

    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      const files = e.dataTransfer.files;
      if (files.length) handleFile(files[0]);
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length) handleFile(e.target.files[0]);
    });

    function handleFile(file) {
      if (!file.name.endsWith('.json')) {
        showStatus('Please select a JSON file', 'error');
        return;
      }
      selectedFile = file;
      fileName.textContent = file.name;
      fileSize.textContent = formatBytes(file.size);
      fileInfo.classList.add('show');
      uploadBtn.disabled = false;
      status.classList.remove('show');
    }

    function formatBytes(bytes) {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    uploadBtn.addEventListener('click', async () => {
      if (!selectedFile) return;

      uploadBtn.disabled = true;
      showStatus('<span class="spinner"></span>Uploading...', 'loading');

      try {
        const content = await selectedFile.text();

        // Validate JSON
        try {
          JSON.parse(content);
        } catch {
          showStatus('Invalid JSON file', 'error');
          uploadBtn.disabled = false;
          return;
        }

        const response = await fetch('/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: content
        });

        const result = await response.json();

        if (result.success) {
          showStatus('Backup uploaded successfully! Check your TV to complete the restore.', 'success');
        } else {
          showStatus(result.error || 'Upload failed', 'error');
          uploadBtn.disabled = false;
        }
      } catch (error) {
        showStatus('Failed to upload: ' + error.message, 'error');
        uploadBtn.disabled = false;
      }
    });

    function showStatus(message, type) {
      status.innerHTML = message;
      status.className = 'status show ' + type;
    }
  </script>
</body>
</html>
    `.trim();
  }
}

export const tvUploadServerService = TVUploadServerService.getInstance();
