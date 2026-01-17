import { BridgeServer } from 'react-native-http-bridge-refurbished';
import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';
import { logger } from '../utils/logger';
import axios from 'axios';

const SERVER_PORT = 8767;

// For Android emulator: the emulator sees itself as 10.0.2.15
// To access from host, use: adb reverse tcp:8767 tcp:8767
// Then access via localhost:8767 on host machine

export interface AddonManifestPreview {
  id: string;
  name: string;
  version: string;
  description?: string;
  logo?: string;
  types?: string[];
  catalogs?: Array<{ type: string; id: string; name: string }>;
}

export interface AddonSelection {
  type: 'installed' | 'community' | 'custom';
  transportUrl: string;
  manifest: AddonManifestPreview;
  order: number;
}

export interface InstalledAddonInfo {
  id: string;
  name: string;
  version: string;
  description?: string;
  logo?: string;
  transportUrl: string;
}

export interface AddonInstallPayload {
  version: string;
  timestamp: number;
  addons: AddonSelection[];
  // Final order of all addon IDs (installed + new)
  finalOrder: string[];
}

type AddonsReceivedCallback = (payload: AddonInstallPayload) => void;
type ErrorCallback = (error: string) => void;

class TVAddonServerService {
  private static instance: TVAddonServerService;
  private server: BridgeServer | null = null;
  private isRunning: boolean = false;
  private onAddonsReceived: AddonsReceivedCallback | null = null;
  private onError: ErrorCallback | null = null;
  private installedAddons: InstalledAddonInfo[] = [];

  private constructor() {}

  public static getInstance(): TVAddonServerService {
    if (!TVAddonServerService.instance) {
      TVAddonServerService.instance = new TVAddonServerService();
    }
    return TVAddonServerService.instance;
  }

  public async getDeviceIpAddress(): Promise<string | null> {
    try {
      const netInfo = await NetInfo.fetch();
      if (netInfo.details && 'ipAddress' in netInfo.details) {
        return (netInfo.details as any).ipAddress || null;
      }
      return null;
    } catch (error) {
      logger.error('[TVAddonServer] Failed to get IP address:', error);
      return null;
    }
  }

  public async startServer(
    onAddonsReceived: AddonsReceivedCallback,
    onError: ErrorCallback,
    installedAddons: InstalledAddonInfo[] = []
  ): Promise<string | null> {
    if (this.isRunning) {
      logger.warn('[TVAddonServer] Server already running');
      return null;
    }

    this.onAddonsReceived = onAddonsReceived;
    this.onError = onError;
    this.installedAddons = installedAddons;

    try {
      const ipAddress = await this.getDeviceIpAddress();
      if (!ipAddress) {
        onError('Could not determine device IP address. Make sure you are connected to WiFi.');
        return null;
      }

      this.server = new BridgeServer('nuvio_addon_server', true);

      // Serve the addon install HTML page
      this.server.get('/', async (_req, res) => {
        res.send(200, 'text/html', this.getAddonInstallHtml());
      });

      this.server.get('/addons', async (_req, res) => {
        res.send(200, 'text/html', this.getAddonInstallHtml());
      });

      // Endpoint to get currently installed addons on the TV
      this.server.get('/installed-addons', async (_req, res) => {
        logger.info('[TVAddonServer] Serving installed addons list');
        res.send(200, 'application/json', JSON.stringify(this.installedAddons));
      });

      // Proxy endpoint for community addons catalog (to avoid CORS issues)
      this.server.get('/community-catalog', async (_req, res) => {
        try {
          logger.info('[TVAddonServer] Fetching community addons catalog');
          const response = await axios.get('https://stremio-addons.com/catalog.json', { timeout: 15000 });
          res.send(200, 'application/json', JSON.stringify(response.data));
        } catch (error) {
          logger.error('[TVAddonServer] Failed to fetch community catalog:', error);
          res.send(500, 'application/json', JSON.stringify({
            error: 'Failed to fetch community addons'
          }));
        }
      });

      // Validate a custom addon URL (using POST to avoid query param issues)
      this.server.post('/validate', async (req, res) => {
        try {
          const body = req.data || req.postData;
          let addonUrl = '';

          if (body) {
            try {
              const parsed = typeof body === 'string' ? JSON.parse(body) : body;
              addonUrl = parsed.url || '';
            } catch {
              addonUrl = '';
            }
          }

          logger.info('[TVAddonServer] Validate request - addonUrl:', addonUrl);

          if (!addonUrl) {
            res.send(400, 'application/json', JSON.stringify({
              valid: false,
              error: 'No URL provided'
            }));
            return;
          }

          logger.info('[TVAddonServer] Validating addon URL:', addonUrl);

          // Try to fetch the manifest
          const manifestUrl = addonUrl.endsWith('manifest.json')
            ? addonUrl
            : `${addonUrl.replace(/\/$/, '')}/manifest.json`;

          const response = await axios.get(manifestUrl, { timeout: 10000 });
          const manifest = response.data;

          if (!manifest.id || !manifest.name) {
            res.send(200, 'application/json', JSON.stringify({
              valid: false,
              error: 'Invalid manifest: missing id or name'
            }));
            return;
          }

          res.send(200, 'application/json', JSON.stringify({
            valid: true,
            manifest: {
              id: manifest.id,
              name: manifest.name,
              version: manifest.version || '0.0.0',
              description: manifest.description,
              logo: manifest.logo,
              types: manifest.types,
              catalogs: manifest.catalogs?.map((c: any) => ({
                type: c.type,
                id: c.id,
                name: c.name
              }))
            }
          }));

        } catch (error) {
          logger.error('[TVAddonServer] Validation error:', error);
          res.send(200, 'application/json', JSON.stringify({
            valid: false,
            error: error instanceof Error ? error.message : 'Failed to fetch manifest'
          }));
        }
      });

      // Handle addon install payload
      this.server.post('/install', async (req, res) => {
        try {
          logger.info('[TVAddonServer] Received install request');

          const body = req.data || req.postData;
          if (!body) {
            res.send(400, 'application/json', JSON.stringify({
              success: false,
              error: 'No data received'
            }));
            return;
          }

          let payload: AddonInstallPayload;
          try {
            if (typeof body === 'string') {
              payload = JSON.parse(body);
            } else {
              payload = body as AddonInstallPayload;
            }
          } catch (parseError) {
            logger.error('[TVAddonServer] Failed to parse payload:', parseError);
            res.send(400, 'application/json', JSON.stringify({
              success: false,
              error: 'Invalid JSON format'
            }));
            return;
          }

          // Validate payload structure
          if (!payload.version || !payload.timestamp || !Array.isArray(payload.addons) || !Array.isArray(payload.finalOrder)) {
            res.send(400, 'application/json', JSON.stringify({
              success: false,
              error: 'Invalid payload format. Missing required fields.'
            }));
            return;
          }

          // Allow empty addons array if there are installed addons being reordered
          const newAddons = payload.addons.filter(a => a.type !== 'installed');
          if (newAddons.length === 0 && payload.finalOrder.length === 0) {
            res.send(400, 'application/json', JSON.stringify({
              success: false,
              error: 'No addons selected or order changes made'
            }));
            return;
          }

          // Validate each addon
          for (const addon of payload.addons) {
            if (!addon.transportUrl || !addon.manifest?.id || !addon.manifest?.name) {
              res.send(400, 'application/json', JSON.stringify({
                success: false,
                error: `Invalid addon data for: ${addon.manifest?.name || 'unknown'}`
              }));
              return;
            }
          }

          logger.info('[TVAddonServer] Valid payload received:', {
            version: payload.version,
            newAddonCount: newAddons.length,
            newAddons: newAddons.map(a => a.manifest.name),
            finalOrder: payload.finalOrder
          });

          // Send success response
          res.send(200, 'application/json', JSON.stringify({
            success: true,
            message: 'Addons received successfully!',
            received: payload.addons.length,
            addonNames: payload.addons.map(a => a.manifest.name)
          }));

          // Notify the callback
          if (this.onAddonsReceived) {
            this.onAddonsReceived(payload);
          }

        } catch (error) {
          logger.error('[TVAddonServer] Error processing install:', error);
          res.send(500, 'application/json', JSON.stringify({
            success: false,
            error: 'Server error processing request'
          }));
          if (this.onError) {
            this.onError('Error processing install request');
          }
        }
      });

      // Start listening
      this.server.listen(SERVER_PORT);
      this.isRunning = true;

      const serverUrl = `http://${ipAddress}:${SERVER_PORT}`;
      logger.info(`[TVAddonServer] Server started at ${serverUrl}`);

      return serverUrl;

    } catch (error) {
      logger.error('[TVAddonServer] Failed to start server:', error);
      onError(`Failed to start server: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.cleanup();
      return null;
    }
  }

  public stopServer(): void {
    logger.info('[TVAddonServer] Stopping server');
    this.cleanup();
  }

  private cleanup(): void {
    if (this.server) {
      try {
        this.server.stop();
      } catch (error) {
        logger.error('[TVAddonServer] Error stopping server:', error);
      }
      this.server = null;
    }
    this.isRunning = false;
    this.onAddonsReceived = null;
    this.onError = null;
    this.installedAddons = [];
  }

  public isServerRunning(): boolean {
    return this.isRunning;
  }

  private getAddonInstallHtml(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Nuvio - Install Addons</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-tap-highlight-color: transparent;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      min-height: 100vh;
      padding: 16px;
      padding-bottom: 100px;
      color: #fff;
    }
    .container {
      max-width: 500px;
      margin: 0 auto;
    }
    .logo {
      text-align: center;
      margin-bottom: 24px;
      padding-top: 8px;
    }
    .logo h1 {
      font-size: 28px;
      font-weight: 700;
      background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .logo p {
      color: rgba(255, 255, 255, 0.7);
      margin-top: 4px;
      font-size: 14px;
    }
    .search-container {
      margin-bottom: 20px;
    }
    .search-input {
      width: 100%;
      padding: 14px 16px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
      font-size: 16px;
      outline: none;
      transition: border-color 0.2s;
    }
    .search-input:focus {
      border-color: #667eea;
    }
    .search-input::placeholder {
      color: rgba(255, 255, 255, 0.5);
    }
    .section {
      margin-bottom: 24px;
    }
    .section-title {
      font-size: 12px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.6);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
      padding-left: 4px;
    }
    .addon-list {
      background: rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      overflow: hidden;
      max-height: 300px;
      overflow-y: auto;
    }
    .addon-item {
      display: flex;
      align-items: center;
      padding: 14px 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      cursor: pointer;
      transition: background 0.2s;
    }
    .addon-item:last-child {
      border-bottom: none;
    }
    .addon-item:active {
      background: rgba(255, 255, 255, 0.1);
    }
    .addon-item.selected {
      background: rgba(102, 126, 234, 0.2);
    }
    .addon-checkbox {
      width: 22px;
      height: 22px;
      border: 2px solid rgba(255, 255, 255, 0.4);
      border-radius: 6px;
      margin-right: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: all 0.2s;
    }
    .addon-item.selected .addon-checkbox {
      background: #667eea;
      border-color: #667eea;
    }
    .addon-checkbox svg {
      opacity: 0;
      transition: opacity 0.2s;
    }
    .addon-item.selected .addon-checkbox svg {
      opacity: 1;
    }
    .addon-logo {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      margin-right: 14px;
      background: rgba(255, 255, 255, 0.1);
      object-fit: cover;
      flex-shrink: 0;
    }
    .addon-info {
      flex: 1;
      min-width: 0;
    }
    .addon-name {
      font-size: 15px;
      font-weight: 600;
      color: #fff;
      margin-bottom: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .addon-version {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.5);
    }
    .custom-url-container {
      background: rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 16px;
    }
    .custom-url-input-row {
      display: flex;
      gap: 10px;
      margin-bottom: 12px;
    }
    .custom-url-input {
      flex: 1;
      padding: 12px 14px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.05);
      color: #fff;
      font-size: 14px;
      outline: none;
    }
    .custom-url-input:focus {
      border-color: #667eea;
    }
    .add-btn {
      padding: 12px 18px;
      background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
      border: none;
      border-radius: 10px;
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    }
    .add-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .custom-addon-item {
      display: flex;
      align-items: center;
      padding: 12px;
      background: rgba(102, 126, 234, 0.15);
      border-radius: 10px;
      margin-bottom: 8px;
    }
    .custom-addon-item:last-child {
      margin-bottom: 0;
    }
    .custom-addon-status {
      width: 20px;
      height: 20px;
      margin-right: 12px;
      flex-shrink: 0;
    }
    .custom-addon-info {
      flex: 1;
      min-width: 0;
    }
    .custom-addon-name {
      font-size: 14px;
      font-weight: 500;
      color: #fff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .custom-addon-url {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.5);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .remove-btn {
      width: 28px;
      height: 28px;
      border: none;
      background: rgba(239, 68, 68, 0.3);
      border-radius: 8px;
      color: #ef4444;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-left: 8px;
    }
    .validation-error {
      color: #ef4444;
      font-size: 12px;
      margin-top: 8px;
      padding: 8px 12px;
      background: rgba(239, 68, 68, 0.15);
      border-radius: 8px;
    }
    .selected-section {
      background: rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 16px;
    }
    .selected-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .selected-count {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.7);
    }
    .reorder-hint {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.4);
    }
    .selected-list {
      min-height: 60px;
    }
    .selected-item {
      display: flex;
      align-items: center;
      padding: 12px;
      background: rgba(102, 126, 234, 0.2);
      border-radius: 10px;
      margin-bottom: 8px;
      cursor: grab;
      transition: transform 0.15s, box-shadow 0.15s;
      touch-action: none;
    }
    .selected-item:last-child {
      margin-bottom: 0;
    }
    .selected-item.dragging {
      transform: scale(1.02);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
      z-index: 100;
    }
    .selected-item.drag-over {
      border: 2px dashed #667eea;
    }
    .drag-handle {
      color: rgba(255, 255, 255, 0.4);
      margin-right: 12px;
      font-size: 18px;
    }
    .selected-order {
      width: 24px;
      height: 24px;
      background: #667eea;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;
      margin-right: 12px;
      flex-shrink: 0;
    }
    .selected-name {
      flex: 1;
      font-size: 14px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .selected-type {
      font-size: 10px;
      color: rgba(255, 255, 255, 0.5);
      background: rgba(255, 255, 255, 0.1);
      padding: 2px 6px;
      border-radius: 4px;
      margin-left: 8px;
      margin-right: 8px;
      text-transform: uppercase;
    }
    .selected-type.type-installed {
      background: rgba(34, 197, 94, 0.2);
      color: #22c55e;
    }
    .selected-type.type-community {
      background: rgba(102, 126, 234, 0.2);
      color: #667eea;
    }
    .selected-type.type-custom {
      background: rgba(251, 191, 36, 0.2);
      color: #fbbf24;
    }
    .selected-item.installed {
      background: rgba(34, 197, 94, 0.1);
    }
    .empty-selected {
      text-align: center;
      padding: 20px;
      color: rgba(255, 255, 255, 0.4);
      font-size: 14px;
    }
    .submit-container {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 16px;
      background: linear-gradient(to top, rgba(26, 26, 46, 1) 0%, rgba(26, 26, 46, 0.95) 80%, rgba(26, 26, 46, 0) 100%);
    }
    .submit-btn {
      width: 100%;
      max-width: 500px;
      margin: 0 auto;
      display: block;
      padding: 16px;
      border: none;
      border-radius: 14px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
      color: #fff;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .submit-btn:not(:disabled):active {
      transform: scale(0.98);
    }
    .submit-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .status-message {
      max-width: 500px;
      margin: 0 auto 12px;
      padding: 12px 16px;
      border-radius: 10px;
      text-align: center;
      font-size: 14px;
    }
    .status-message.success {
      background: rgba(34, 197, 94, 0.2);
      color: #22c55e;
    }
    .status-message.error {
      background: rgba(239, 68, 68, 0.2);
      color: #ef4444;
    }
    .status-message.loading {
      background: rgba(102, 126, 234, 0.2);
      color: #667eea;
    }
    .spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
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
    .loading-addons {
      text-align: center;
      padding: 40px 20px;
      color: rgba(255, 255, 255, 0.6);
    }
    .error-loading {
      text-align: center;
      padding: 20px;
      color: #ef4444;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <h1>Nuvio</h1>
      <p>Install Addons to TV</p>
    </div>

    <div class="search-container">
      <input type="text" class="search-input" id="searchInput" placeholder="Search addons...">
    </div>

    <div class="section">
      <div class="section-title">Community Addons</div>
      <div class="addon-list" id="communityList">
        <div class="loading-addons">
          <span class="spinner"></span> Loading addons...
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Custom Addon URLs</div>
      <div class="custom-url-container">
        <div class="custom-url-input-row">
          <input type="url" class="custom-url-input" id="customUrlInput" placeholder="Enter addon URL...">
          <button class="add-btn" id="addCustomBtn">Add</button>
        </div>
        <div id="customAddonsList"></div>
        <div id="validationError" class="validation-error" style="display: none;"></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Addon Order (Final)</div>
      <div class="selected-section">
        <div class="selected-header">
          <span class="selected-count" id="selectedCount">Loading...</span>
          <span class="reorder-hint">Drag to reorder</span>
        </div>
        <div class="selected-list" id="selectedList">
          <div class="empty-selected">Loading installed addons...</div>
        </div>
      </div>
    </div>
  </div>

  <div class="submit-container">
    <div id="statusMessage" class="status-message" style="display: none;"></div>
    <button class="submit-btn" id="submitBtn" disabled>Select addons to install</button>
  </div>

  <script>
    // State
    let communityAddons = [];
    let installedAddons = [];  // Addons already on TV
    let selectedAddons = [];   // All addons in the final order (installed + new)
    let customAddons = [];
    let searchTerm = '';
    let isSubmitting = false;
    let isLoading = true;

    // Elements
    const searchInput = document.getElementById('searchInput');
    const communityList = document.getElementById('communityList');
    const customUrlInput = document.getElementById('customUrlInput');
    const addCustomBtn = document.getElementById('addCustomBtn');
    const customAddonsList = document.getElementById('customAddonsList');
    const validationError = document.getElementById('validationError');
    const selectedList = document.getElementById('selectedList');
    const selectedCount = document.getElementById('selectedCount');
    const submitBtn = document.getElementById('submitBtn');
    const statusMessage = document.getElementById('statusMessage');

    // Fetch installed addons from TV
    async function fetchInstalledAddons() {
      try {
        const response = await fetch('/installed-addons');
        if (!response.ok) throw new Error('Failed to fetch');
        installedAddons = await response.json();

        // Add installed addons to selected list (preserving their order)
        installedAddons.forEach((addon, index) => {
          selectedAddons.push({
            type: 'installed',
            transportUrl: addon.transportUrl,
            manifest: {
              id: addon.id,
              name: addon.name,
              version: addon.version,
              description: addon.description,
              logo: addon.logo
            },
            order: index
          });
        });

        renderSelectedAddons();
        updateSubmitButton();
      } catch (error) {
        console.error('Failed to fetch installed addons:', error);
      }
    }

    // Fetch community addons via proxy to avoid CORS
    async function fetchCommunityAddons() {
      try {
        const response = await fetch('/community-catalog');
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        // Filter out addons that are already installed
        const installedIds = installedAddons.map(a => a.id);
        communityAddons = data.filter(a =>
          a.manifest &&
          a.manifest.id !== 'com.linvo.cinemeta' &&
          !installedIds.includes(a.manifest.id)
        );
        renderCommunityAddons();
      } catch (error) {
        communityList.innerHTML = '<div class="error-loading">Failed to load community addons. You can still add custom URLs.</div>';
      } finally {
        isLoading = false;
      }
    }

    // Render community addons
    function renderCommunityAddons() {
      const filtered = communityAddons.filter(addon => {
        const name = addon.manifest?.name?.toLowerCase() || '';
        const desc = addon.manifest?.description?.toLowerCase() || '';
        return name.includes(searchTerm) || desc.includes(searchTerm);
      });

      if (filtered.length === 0) {
        communityList.innerHTML = '<div class="empty-selected">No addons found</div>';
        return;
      }

      communityList.innerHTML = filtered.map(addon => {
        const isSelected = selectedAddons.some(s => s.manifest.id === addon.manifest.id);
        const logo = addon.manifest.logo || '';
        return \`
          <div class="addon-item \${isSelected ? 'selected' : ''}" data-id="\${addon.manifest.id}" data-url="\${addon.transportUrl}">
            <div class="addon-checkbox">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M11.6666 3.5L5.24992 9.91667L2.33325 7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            \${logo ? \`<img class="addon-logo" src="\${logo}" onerror="this.style.display='none'">\` : ''}
            <div class="addon-info">
              <div class="addon-name">\${addon.manifest.name}</div>
              <div class="addon-version">v\${addon.manifest.version || '0.0.0'}</div>
            </div>
          </div>
        \`;
      }).join('');

      // Add click handlers
      communityList.querySelectorAll('.addon-item').forEach(item => {
        item.addEventListener('click', () => toggleCommunityAddon(item.dataset.id, item.dataset.url));
      });
    }

    // Toggle community addon selection
    function toggleCommunityAddon(id, url) {
      const addon = communityAddons.find(a => a.manifest.id === id);
      if (!addon) return;

      const existingIndex = selectedAddons.findIndex(s => s.manifest.id === id);
      if (existingIndex >= 0) {
        selectedAddons.splice(existingIndex, 1);
      } else {
        selectedAddons.push({
          type: 'community',
          transportUrl: url,
          manifest: {
            id: addon.manifest.id,
            name: addon.manifest.name,
            version: addon.manifest.version || '0.0.0',
            description: addon.manifest.description,
            logo: addon.manifest.logo
          },
          order: selectedAddons.length
        });
      }

      renderCommunityAddons();
      renderSelectedAddons();
      updateSubmitButton();
    }

    // Add custom addon
    async function addCustomAddon() {
      const url = customUrlInput.value.trim();
      if (!url) return;

      // Convert stremio:// to https://
      const normalizedUrl = url.replace(/^stremio:\\/\\//, 'https://');

      // Check if already added
      if (selectedAddons.some(s => s.transportUrl === normalizedUrl) ||
          customAddons.some(c => c.url === normalizedUrl)) {
        showValidationError('This addon is already added');
        return;
      }

      addCustomBtn.disabled = true;
      addCustomBtn.textContent = '...';
      hideValidationError();

      try {
        const response = await fetch('/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: normalizedUrl })
        });
        const result = await response.json();

        if (!result.valid) {
          showValidationError(result.error || 'Invalid addon URL');
          return;
        }

        // Add to custom addons display
        customAddons.push({
          url: normalizedUrl,
          manifest: result.manifest
        });

        // Add to selected
        selectedAddons.push({
          type: 'custom',
          transportUrl: normalizedUrl,
          manifest: result.manifest,
          order: selectedAddons.length
        });

        customUrlInput.value = '';
        renderCustomAddons();
        renderSelectedAddons();
        updateSubmitButton();

      } catch (error) {
        showValidationError('Failed to validate addon');
      } finally {
        addCustomBtn.disabled = false;
        addCustomBtn.textContent = 'Add';
      }
    }

    // Render custom addons
    function renderCustomAddons() {
      if (customAddons.length === 0) {
        customAddonsList.innerHTML = '';
        return;
      }

      customAddonsList.innerHTML = customAddons.map((addon, i) => \`
        <div class="custom-addon-item" data-index="\${i}">
          <div class="custom-addon-status">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="8" stroke="#22c55e" stroke-width="2"/>
              <path d="M7 10L9 12L13 8" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="custom-addon-info">
            <div class="custom-addon-name">\${addon.manifest.name} v\${addon.manifest.version}</div>
            <div class="custom-addon-url">\${addon.url}</div>
          </div>
          <button class="remove-btn" onclick="removeCustomAddon(\${i})">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M10.5 3.5L3.5 10.5M3.5 3.5L10.5 10.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      \`).join('');
    }

    // Remove custom addon
    function removeCustomAddon(index) {
      const addon = customAddons[index];
      if (!addon) return;

      customAddons.splice(index, 1);
      selectedAddons = selectedAddons.filter(s => s.transportUrl !== addon.url);

      renderCustomAddons();
      renderSelectedAddons();
      updateSubmitButton();
    }

    // Render selected addons with drag support
    function renderSelectedAddons() {
      // Update order numbers
      selectedAddons.forEach((addon, i) => addon.order = i);

      if (selectedAddons.length === 0) {
        selectedList.innerHTML = '<div class="empty-selected">No addons to display</div>';
        selectedCount.textContent = '0 addons';
        return;
      }

      const installedCount = selectedAddons.filter(a => a.type === 'installed').length;
      const newCount = selectedAddons.length - installedCount;
      selectedCount.textContent = installedCount + ' installed' + (newCount > 0 ? ', ' + newCount + ' new' : '');

      selectedList.innerHTML = selectedAddons.map((addon, i) => {
        const isInstalled = addon.type === 'installed';
        const typeClass = isInstalled ? 'type-installed' : (addon.type === 'custom' ? 'type-custom' : 'type-community');
        const typeLabel = isInstalled ? 'installed' : (addon.type === 'custom' ? 'custom' : 'new');

        return \`
        <div class="selected-item \${isInstalled ? 'installed' : ''}" draggable="true" data-index="\${i}">
          <span class="drag-handle">≡</span>
          <span class="selected-order">\${i + 1}</span>
          <span class="selected-name">\${addon.manifest.name}</span>
          <span class="selected-type \${typeClass}">\${typeLabel}</span>
          \${!isInstalled ? \`
          <button class="remove-btn" onclick="removeSelectedAddon(\${i}); event.stopPropagation();">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M10.5 3.5L3.5 10.5M3.5 3.5L10.5 10.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
          \` : ''}
        </div>
      \`}).join('');

      // Setup drag and drop
      setupDragAndDrop();
    }

    // Remove from selected (only for non-installed addons)
    function removeSelectedAddon(index) {
      const addon = selectedAddons[index];
      if (!addon || addon.type === 'installed') return;

      selectedAddons.splice(index, 1);

      // Also remove from custom addons if it's a custom one
      if (addon.type === 'custom') {
        customAddons = customAddons.filter(c => c.url !== addon.transportUrl);
        renderCustomAddons();
      }

      renderCommunityAddons();
      renderSelectedAddons();
      updateSubmitButton();
    }

    // Drag and drop
    let draggedIndex = null;

    function setupDragAndDrop() {
      const items = selectedList.querySelectorAll('.selected-item');

      items.forEach(item => {
        item.addEventListener('dragstart', (e) => {
          draggedIndex = parseInt(item.dataset.index);
          item.classList.add('dragging');
          e.dataTransfer.effectAllowed = 'move';
        });

        item.addEventListener('dragend', () => {
          item.classList.remove('dragging');
          draggedIndex = null;
          document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        });

        item.addEventListener('dragover', (e) => {
          e.preventDefault();
          const targetIndex = parseInt(item.dataset.index);
          if (draggedIndex !== null && draggedIndex !== targetIndex) {
            item.classList.add('drag-over');
          }
        });

        item.addEventListener('dragleave', () => {
          item.classList.remove('drag-over');
        });

        item.addEventListener('drop', (e) => {
          e.preventDefault();
          item.classList.remove('drag-over');
          const targetIndex = parseInt(item.dataset.index);

          if (draggedIndex !== null && draggedIndex !== targetIndex) {
            const [movedItem] = selectedAddons.splice(draggedIndex, 1);
            selectedAddons.splice(targetIndex, 0, movedItem);
            renderSelectedAddons();
          }
        });

        // Touch support
        let touchStartY = 0;
        let touchCurrentY = 0;

        item.addEventListener('touchstart', (e) => {
          touchStartY = e.touches[0].clientY;
          draggedIndex = parseInt(item.dataset.index);
          setTimeout(() => item.classList.add('dragging'), 100);
        });

        item.addEventListener('touchmove', (e) => {
          if (draggedIndex === null) return;
          touchCurrentY = e.touches[0].clientY;

          const items = selectedList.querySelectorAll('.selected-item');
          items.forEach((other, i) => {
            if (i === draggedIndex) return;
            const rect = other.getBoundingClientRect();
            if (touchCurrentY > rect.top && touchCurrentY < rect.bottom) {
              other.classList.add('drag-over');
            } else {
              other.classList.remove('drag-over');
            }
          });
        });

        item.addEventListener('touchend', () => {
          item.classList.remove('dragging');

          const items = selectedList.querySelectorAll('.selected-item');
          let targetIndex = draggedIndex;

          items.forEach((other, i) => {
            if (other.classList.contains('drag-over')) {
              targetIndex = i;
              other.classList.remove('drag-over');
            }
          });

          if (draggedIndex !== null && draggedIndex !== targetIndex) {
            const [movedItem] = selectedAddons.splice(draggedIndex, 1);
            selectedAddons.splice(targetIndex, 0, movedItem);
            renderSelectedAddons();
          }

          draggedIndex = null;
        });
      });
    }

    // Update submit button
    function updateSubmitButton() {
      const newAddons = selectedAddons.filter(a => a.type !== 'installed');
      const hasChanges = newAddons.length > 0 || hasOrderChanged();

      if (!hasChanges) {
        submitBtn.textContent = 'No changes to apply';
        submitBtn.disabled = true;
      } else if (newAddons.length > 0) {
        submitBtn.textContent = 'Install ' + newAddons.length + ' New Addon' + (newAddons.length > 1 ? 's' : '') + ' & Save Order';
        submitBtn.disabled = isSubmitting;
      } else {
        submitBtn.textContent = 'Save New Order';
        submitBtn.disabled = isSubmitting;
      }
    }

    // Check if order has changed from original installed order
    function hasOrderChanged() {
      const currentInstalledOrder = selectedAddons
        .filter(a => a.type === 'installed')
        .map(a => a.manifest.id);
      const originalOrder = installedAddons.map(a => a.id);

      if (currentInstalledOrder.length !== originalOrder.length) return true;

      for (let i = 0; i < currentInstalledOrder.length; i++) {
        if (currentInstalledOrder[i] !== originalOrder[i]) return true;
      }
      return false;
    }

    // Show/hide validation error
    function showValidationError(message) {
      validationError.textContent = message;
      validationError.style.display = 'block';
    }

    function hideValidationError() {
      validationError.style.display = 'none';
    }

    // Show status message
    function showStatus(message, type) {
      statusMessage.innerHTML = message;
      statusMessage.className = 'status-message ' + type;
      statusMessage.style.display = 'block';
    }

    function hideStatus() {
      statusMessage.style.display = 'none';
    }

    // Submit addons
    async function submitAddons() {
      const newAddons = selectedAddons.filter(a => a.type !== 'installed');
      const hasChanges = newAddons.length > 0 || hasOrderChanged();

      if (!hasChanges || isSubmitting) return;

      isSubmitting = true;
      submitBtn.disabled = true;
      showStatus('<span class="spinner"></span>Sending to TV...', 'loading');

      try {
        // Build the final order of all addon IDs
        const finalOrder = selectedAddons.map(a => a.manifest.id);

        const payload = {
          version: '1.0',
          timestamp: Date.now(),
          // Only include new addons (not installed ones) for installation
          addons: newAddons.map((addon, i) => ({
            ...addon,
            order: i
          })),
          // Include the final order of ALL addons (installed + new)
          finalOrder: finalOrder
        };

        const response = await fetch('/install', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.success) {
          const message = newAddons.length > 0
            ? 'Addons sent to TV! Check your TV to complete installation.'
            : 'New order sent to TV! Check your TV to confirm.';
          showStatus(message, 'success');
          submitBtn.textContent = 'Sent to TV!';
        } else {
          showStatus(result.error || 'Failed to send addons', 'error');
          isSubmitting = false;
          updateSubmitButton();
        }
      } catch (error) {
        showStatus('Failed to connect to TV: ' + error.message, 'error');
        isSubmitting = false;
        updateSubmitButton();
      }
    }

    // Event listeners
    searchInput.addEventListener('input', (e) => {
      searchTerm = e.target.value.toLowerCase();
      renderCommunityAddons();
    });

    addCustomBtn.addEventListener('click', addCustomAddon);
    customUrlInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') addCustomAddon();
    });

    submitBtn.addEventListener('click', submitAddons);

    // Initialize - fetch installed addons first, then community addons
    async function initialize() {
      await fetchInstalledAddons();
      await fetchCommunityAddons();
    }
    initialize();
  </script>
</body>
</html>
    `.trim();
  }
}

export const tvAddonServerService = TVAddonServerService.getInstance();
