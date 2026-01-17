import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform, Linking, NativeModules } from 'react-native';
import * as Application from 'expo-application';

export interface DownloadProgress {
  totalBytesWritten: number;
  totalBytesExpectedToWrite: number;
  progress: number; // 0-100
}

export interface ApkDownloadResult {
  success: boolean;
  localUri?: string;
  error?: string;
}

/**
 * Get the device's CPU architecture based on the currently installed app's native libraries.
 * This is the most reliable method as it tells us what architecture Android chose for the current app.
 * Returns: 'arm64-v8a', 'armeabi-v7a', 'x86_64', 'x86', or 'universal'
 */
function getDeviceArchitecture(): string {
  if (Platform.OS !== 'android') {
    return 'universal';
  }

  try {
    // Get platform constants which include device info
    const constants = Platform.constants as any;

    if (__DEV__) {
      console.log('Platform.constants:', JSON.stringify(constants, null, 2));
    }

    // Method 1: Check reactNativeVersion structure for architecture hints
    // React Native 0.71+ includes architecture info
    const reactNativeArch = constants?.reactNativeVersion?.prerelease;
    if (reactNativeArch && typeof reactNativeArch === 'string') {
      if (reactNativeArch.includes('arm64')) return 'arm64-v8a';
      if (reactNativeArch.includes('arm')) return 'armeabi-v7a';
      if (reactNativeArch.includes('x86_64')) return 'x86_64';
      if (reactNativeArch.includes('x86')) return 'x86';
    }

    // Method 2: Check fingerprint, hardware, and other system properties
    const fingerprint = constants?.Fingerprint || '';
    const model = constants?.Model || '';
    const brand = constants?.Brand || '';
    const manufacturer = constants?.Manufacturer || '';
    const hardware = constants?.Hardware || '';
    const device = constants?.Device || '';
    const product = constants?.Product || '';

    // Check for emulator indicators
    const isEmulator =
      fingerprint.includes('generic') ||
      fingerprint.includes('sdk') ||
      model.toLowerCase().includes('sdk') ||
      model.toLowerCase().includes('emulator') ||
      model.toLowerCase().includes('android sdk') ||
      (brand === 'google' && model.includes('sdk')) ||
      manufacturer.toLowerCase() === 'genymotion' ||
      hardware.includes('ranchu') || // Android emulator
      hardware.includes('goldfish') || // Older Android emulator
      product.includes('sdk');

    if (isEmulator) {
      // For emulators, check the fingerprint/product for architecture
      const allStrings = `${fingerprint} ${model} ${product} ${device} ${hardware}`.toLowerCase();

      if (allStrings.includes('x86_64')) {
        if (__DEV__) console.log('Detected x86_64 emulator');
        return 'x86_64';
      } else if (allStrings.includes('x86') && !allStrings.includes('x86_64')) {
        if (__DEV__) console.log('Detected x86 emulator');
        return 'x86';
      } else if (allStrings.includes('arm64') || allStrings.includes('aarch64')) {
        if (__DEV__) console.log('Detected arm64 emulator');
        return 'arm64-v8a';
      } else if (allStrings.includes('arm')) {
        if (__DEV__) console.log('Detected arm emulator');
        return 'armeabi-v7a';
      }

      // Default emulator architecture based on common patterns
      // Modern Android Studio emulators are typically x86_64, older ones are x86
      const androidVersion = constants?.Version || 0;
      if (androidVersion >= 30) {
        if (__DEV__) console.log('Modern emulator (API 30+), assuming x86_64');
        return 'x86_64';
      } else {
        if (__DEV__) console.log('Older emulator, assuming x86');
        return 'x86';
      }
    }

    // For real devices, determine architecture based on device properties
    // Most modern Android TV devices are arm64-v8a
    // Check if it's a 32-bit device
    const androidVersion = constants?.Version || 0;

    // Android 5.0 (API 21) was the first to support 64-bit
    // Devices below API 21 or with specific 32-bit indicators use armeabi-v7a
    if (androidVersion < 21) {
      if (__DEV__) console.log('Pre-Lollipop device, using armeabi-v7a');
      return 'armeabi-v7a';
    }

    // Check for x86-based real devices (rare but they exist, e.g., some Intel-based tablets)
    const allStrings = `${fingerprint} ${hardware} ${device}`.toLowerCase();
    if (allStrings.includes('x86') || allStrings.includes('intel')) {
      if (allStrings.includes('x86_64') || allStrings.includes('64')) {
        if (__DEV__) console.log('Detected x86_64 device');
        return 'x86_64';
      }
      if (__DEV__) console.log('Detected x86 device');
      return 'x86';
    }

    // Default to arm64-v8a for modern ARM devices (99% of real Android devices)
    if (__DEV__) console.log('Using arm64-v8a for modern ARM device');
    return 'arm64-v8a';
  } catch (e) {
    if (__DEV__) console.log('Error detecting architecture:', e);
    // Default to arm64 for most real devices
    return 'arm64-v8a';
  }
}

/**
 * Find the best APK asset for the current device architecture
 * Includes fallback logic for compatible architectures
 */
function findBestApkAsset(assets: any[]): any {
  const apkAssets = assets.filter((asset: any) =>
    asset.name?.toLowerCase().endsWith('.apk')
  );

  if (apkAssets.length === 0) return null;
  if (apkAssets.length === 1) return apkAssets[0];

  const arch = getDeviceArchitecture();
  if (__DEV__) console.log('Looking for APK matching architecture:', arch);
  if (__DEV__) console.log('Available APKs:', apkAssets.map((a: any) => a.name));

  // Priority order for architecture matching
  // Each architecture lists patterns to search for, in order of preference
  // Includes fallback to compatible architectures
  const archPatterns: Record<string, string[]> = {
    // arm64-v8a can also run armeabi-v7a (32-bit ARM) as fallback
    'arm64-v8a': ['arm64-v8a', 'arm64', 'aarch64', 'universal', 'armeabi-v7a', 'armeabi'],
    // armeabi-v7a: 32-bit ARM only
    'armeabi-v7a': ['armeabi-v7a', 'armeabi', 'armv7', 'universal'],
    // x86_64 can also run x86 (32-bit) as fallback
    'x86_64': ['x86_64', 'x64', 'amd64', 'universal', 'x86'],
    // x86: 32-bit Intel only
    'x86': ['x86', 'i686', 'i386', 'universal'],
  };

  const patterns = archPatterns[arch] || ['universal'];

  // Try to find an APK matching the architecture patterns in order
  for (const pattern of patterns) {
    const match = apkAssets.find((asset: any) => {
      const name = asset.name?.toLowerCase() || '';
      // For x86, make sure we don't accidentally match x86_64
      if (pattern === 'x86' && !pattern.includes('64')) {
        return name.includes('x86') && !name.includes('x86_64') && !name.includes('x64');
      }
      return name.includes(pattern);
    });
    if (match) {
      if (__DEV__) console.log('Found matching APK:', match.name, 'for pattern:', pattern);
      return match;
    }
  }

  // If no architecture-specific APK found, look for "universal"
  const universalApk = apkAssets.find((asset: any) =>
    asset.name?.toLowerCase().includes('universal')
  );
  if (universalApk) {
    if (__DEV__) console.log('Using universal APK:', universalApk.name);
    return universalApk;
  }

  // Last resort: return the first APK (might be universal without the name)
  if (__DEV__) console.log('No arch-specific APK found, using first available:', apkAssets[0].name);
  return apkAssets[0];
}

/**
 * Get the direct APK download URL from a GitHub release
 * GitHub releases page URL -> API call to get assets -> find .apk asset
 * Automatically selects the correct APK for the device architecture
 */
export async function getApkDownloadUrl(releaseUrl: string): Promise<string | null> {
  try {
    // Convert release page URL to API URL
    // https://github.com/CrissZollo/NuvioStreamingTV/releases/tag/v1.0.0-beta-4
    // -> https://api.github.com/repos/CrissZollo/NuvioStreamingTV/releases/tags/v1.0.0-beta-4
    const match = releaseUrl.match(/github\.com\/([^/]+)\/([^/]+)\/releases\/tag\/([^/]+)/);
    if (!match) {
      // Try the releases page format (not a specific tag)
      // https://github.com/CrissZollo/NuvioStreamingTV/releases
      const repoMatch = releaseUrl.match(/github\.com\/([^/]+)\/([^/]+)\/releases/);
      if (repoMatch) {
        // Get latest release
        const apiUrl = `https://api.github.com/repos/${repoMatch[1]}/${repoMatch[2]}/releases`;
        const response = await fetch(apiUrl, {
          headers: {
            'Accept': 'application/vnd.github+json',
            'User-Agent': 'NuvioTV',
          },
        });
        if (!response.ok) return null;
        const releases = await response.json();
        const release = Array.isArray(releases) ? releases[0] : releases;
        if (!release?.assets) return null;

        // Find the best APK asset for this device
        const apkAsset = findBestApkAsset(release.assets);
        return apkAsset?.browser_download_url || null;
      }
      return null;
    }

    const [, owner, repo, tag] = match;
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`;

    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'NuvioTV',
      },
    });

    if (!response.ok) return null;

    const release = await response.json();
    if (!release.assets) return null;

    // Find the best APK asset for this device
    const apkAsset = findBestApkAsset(release.assets);

    return apkAsset?.browser_download_url || null;
  } catch (error) {
    if (__DEV__) console.error('Error getting APK download URL:', error);
    return null;
  }
}

/**
 * Download APK file from URL with progress callback
 */
export async function downloadApk(
  downloadUrl: string,
  onProgress?: (progress: DownloadProgress) => void
): Promise<ApkDownloadResult> {
  if (Platform.OS !== 'android') {
    return { success: false, error: 'APK installation only supported on Android' };
  }

  try {
    // Use cache directory for the download
    const fileName = 'nuvio-update.apk';
    const localUri = `${FileSystem.cacheDirectory}${fileName}`;

    // Delete existing file if present
    const fileInfo = await FileSystem.getInfoAsync(localUri);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(localUri, { idempotent: true });
    }

    // Create download resumable with progress callback
    const downloadResumable = FileSystem.createDownloadResumable(
      downloadUrl,
      localUri,
      {
        headers: {
          'User-Agent': 'NuvioTV',
        },
      },
      (downloadProgress) => {
        const progress = downloadProgress.totalBytesExpectedToWrite > 0
          ? Math.round((downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite) * 100)
          : 0;
        onProgress?.({
          totalBytesWritten: downloadProgress.totalBytesWritten,
          totalBytesExpectedToWrite: downloadProgress.totalBytesExpectedToWrite,
          progress,
        });
      }
    );

    const result = await downloadResumable.downloadAsync();

    if (!result?.uri) {
      return { success: false, error: 'Download failed - no file returned' };
    }

    // Verify file was downloaded
    const downloadedFileInfo = await FileSystem.getInfoAsync(result.uri);
    if (__DEV__) console.log('Downloaded file info:', downloadedFileInfo);

    if (!downloadedFileInfo.exists) {
      return { success: false, error: 'Download completed but file not found' };
    }

    return { success: true, localUri: result.uri };
  } catch (error) {
    if (__DEV__) console.error('Error downloading APK:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Download failed'
    };
  }
}

/**
 * Open the settings page to allow installing from unknown sources for this app
 */
export async function openUnknownSourcesSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    const packageName = Application.applicationId;
    // Open the "Install unknown apps" settings for this specific app
    await IntentLauncher.startActivityAsync(
      'android.settings.MANAGE_UNKNOWN_APP_SOURCES',
      {
        data: `package:${packageName}`,
        flags: 0x10000000, // FLAG_ACTIVITY_NEW_TASK
      }
    );
  } catch (error) {
    if (__DEV__) console.log('Could not open unknown sources settings:', error);
    // Fallback to general security settings
    try {
      await IntentLauncher.startActivityAsync('android.settings.SECURITY_SETTINGS', {
        flags: 0x10000000,
      });
    } catch {
      if (__DEV__) console.log('Could not open security settings');
    }
  }
}

/**
 * Install APK using Android's package installer
 *
 * Android Intent Flags:
 * FLAG_GRANT_READ_URI_PERMISSION = 1
 * FLAG_ACTIVITY_NEW_TASK = 0x10000000 (268435456)
 * FLAG_ACTIVITY_CLEAR_TOP = 0x04000000 (67108864)
 * Combined = 335544321
 */
export async function installApk(localUri: string): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }

  // Combined flags: FLAG_GRANT_READ_URI_PERMISSION | FLAG_ACTIVITY_NEW_TASK | FLAG_ACTIVITY_CLEAR_TOP
  const flags = 1 | 0x10000000 | 0x04000000;

  try {
    // Convert file:// URI to content:// URI using FileSystem
    const contentUri = await FileSystem.getContentUriAsync(localUri);

    if (__DEV__) {
      console.log('=== APK Install Debug ===');
      console.log('Local URI:', localUri);
      console.log('Content URI:', contentUri);
      console.log('Flags:', flags);
    }

    // Try multiple approaches to launch the package installer
    const errors: string[] = [];

    // Approach 1: ACTION_INSTALL_PACKAGE (most explicit, deprecated but still works)
    try {
      if (__DEV__) console.log('Trying ACTION_INSTALL_PACKAGE...');
      await IntentLauncher.startActivityAsync('android.intent.action.INSTALL_PACKAGE', {
        data: contentUri,
        flags,
      });
      if (__DEV__) console.log('INSTALL_PACKAGE intent launched successfully');
      return true;
    } catch (e1: any) {
      errors.push(`INSTALL_PACKAGE: ${e1?.message || e1}`);
      if (__DEV__) console.log('INSTALL_PACKAGE failed:', e1?.message || e1);
    }

    // Approach 2: ACTION_VIEW with MIME type (standard approach)
    try {
      if (__DEV__) console.log('Trying ACTION_VIEW with MIME type...');
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags,
        type: 'application/vnd.android.package-archive',
      });
      if (__DEV__) console.log('VIEW intent launched successfully');
      return true;
    } catch (e2: any) {
      errors.push(`VIEW: ${e2?.message || e2}`);
      if (__DEV__) console.log('VIEW failed:', e2?.message || e2);
    }

    // Approach 3: Try without MIME type
    try {
      if (__DEV__) console.log('Trying ACTION_VIEW without MIME type...');
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags,
      });
      if (__DEV__) console.log('VIEW (no MIME) intent launched successfully');
      return true;
    } catch (e3: any) {
      errors.push(`VIEW_NO_MIME: ${e3?.message || e3}`);
      if (__DEV__) console.log('VIEW (no MIME) failed:', e3?.message || e3);
    }

    // Log all errors for debugging
    if (__DEV__) {
      console.log('=== All install approaches failed ===');
      errors.forEach((err, i) => console.log(`Error ${i + 1}:`, err));
    }

    // All approaches failed, try to open settings
    if (__DEV__) console.log('Opening unknown sources settings...');
    await openUnknownSourcesSettings();
    return false;
  } catch (error: any) {
    if (__DEV__) console.error('Error installing APK:', error?.message || error);
    return false;
  }
}

/**
 * Download and install APK from GitHub release URL
 */
export async function downloadAndInstallUpdate(
  releaseUrl: string,
  onProgress?: (progress: DownloadProgress) => void,
  onStatusChange?: (status: 'fetching' | 'downloading' | 'installing' | 'done' | 'error', message?: string) => void
): Promise<boolean> {
  try {
    // Step 1: Get the APK download URL
    onStatusChange?.('fetching', 'Finding APK download...');
    const apkUrl = await getApkDownloadUrl(releaseUrl);

    if (!apkUrl) {
      onStatusChange?.('error', 'No APK found in release');
      return false;
    }

    // Step 2: Download the APK
    onStatusChange?.('downloading', 'Downloading update...');
    const downloadResult = await downloadApk(apkUrl, onProgress);

    if (!downloadResult.success || !downloadResult.localUri) {
      onStatusChange?.('error', downloadResult.error || 'Download failed');
      return false;
    }

    // Step 3: Install the APK
    onStatusChange?.('installing', 'Opening installer...');
    const installed = await installApk(downloadResult.localUri);

    if (!installed) {
      onStatusChange?.('error', 'Please enable "Install unknown apps" for this app in Settings, then try again');
      return false;
    }

    onStatusChange?.('done', 'Installer opened');
    return true;
  } catch (error) {
    if (__DEV__) console.error('Error in downloadAndInstallUpdate:', error);
    onStatusChange?.('error', error instanceof Error ? error.message : 'Update failed');
    return false;
  }
}
