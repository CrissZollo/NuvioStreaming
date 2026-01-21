import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Platform,
  Dimensions,
  Linking,
  Switch
} from 'react-native';
import { useToast } from '../contexts/ToastContext';
import { useNavigation } from '@react-navigation/native';
import { NavigationProp } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useTheme } from '../contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import UpdateService from '../services/updateService';
import CustomAlert from '../components/CustomAlert';
import { mmkvStorage } from '../services/mmkvStorage';
import { useGithubMajorUpdate } from '../hooks/useGithubMajorUpdate';
import { getDisplayedAppVersion, getNuvioTVVersion } from '../utils/version';
import { isNewerVersion, GITHUB_RELEASE_SOURCES, GithubReleaseSourceKey, getStoredGithubReleaseSource, setGithubReleaseSource } from '../services/githubReleaseService';
import { useIsTV } from '../contexts/TVContext';
import { Focusable, FocusableRef } from '../components/tv/Focusable';
import { downloadAndInstallUpdate, DownloadProgress } from '../services/apkInstallService';

const { width, height } = Dimensions.get('window');
const isTablet = width >= 768;

// Card component with minimalistic style
interface SettingsCardProps {
  children: React.ReactNode;
  title?: string;
  isTablet?: boolean;
}

const SettingsCard: React.FC<SettingsCardProps> = ({ children, title, isTablet = false }) => {
  const { currentTheme } = useTheme();

  return (
    <View
      style={[
        styles.cardContainer,
        isTablet && styles.tabletCardContainer
      ]}
    >
      {title && (
        <Text style={[
          styles.cardTitle,
          { color: currentTheme.colors.mediumEmphasis },
          isTablet && styles.tabletCardTitle
        ]}>
          {title}
        </Text>
      )}
      <View style={[
        styles.card,
        { backgroundColor: currentTheme.colors.elevation1 },
        isTablet && styles.tabletCard
      ]}>
        {children}
      </View>
    </View>
  );
};

const UpdateScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { currentTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const github = useGithubMajorUpdate();
  const { showInfo } = useToast();
  const isTV = useIsTV();

  // TV focus refs
  const backButtonRef = useRef<FocusableRef>(null);
  const checkUpdatesRef = useRef<FocusableRef>(null);
  const installUpdateRef = useRef<FocusableRef>(null);
  const viewReleaseRef = useRef<FocusableRef>(null);
  const otaToggleRef = useRef<FocusableRef>(null);
  const majorToggleRef = useRef<FocusableRef>(null);
  const releaseSourceTapframeRef = useRef<FocusableRef>(null);
  const releaseSourceCrisszolloRef = useRef<FocusableRef>(null);

  // CustomAlert state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertActions, setAlertActions] = useState<Array<{ label: string; onPress: () => void; style?: object }>>([
    { label: 'OK', onPress: () => setAlertVisible(false) },
  ]);

  const openAlert = (
    title: string,
    message: string,
    actions?: Array<{ label: string; onPress?: () => void; style?: object }>
  ) => {
    setAlertTitle(title);
    setAlertMessage(message);
    if (actions && actions.length > 0) {
      setAlertActions(
        actions.map(a => ({
          label: a.label,
          style: a.style,
          onPress: () => { a.onPress?.(); },
        }))
      );
    } else {
      setAlertActions([{ label: 'OK', onPress: () => setAlertVisible(false) }]);
    }
    setAlertVisible(true);
  };

  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [currentInfo, setCurrentInfo] = useState<any>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  // Logs removed
  const [lastOperation, setLastOperation] = useState<string>('');
  const [updateProgress, setUpdateProgress] = useState<number>(0);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'installing' | 'success' | 'error'>('idle');

  // Update notification settings
  const [otaAlertsEnabled, setOtaAlertsEnabled] = useState(true);
  const [majorAlertsEnabled, setMajorAlertsEnabled] = useState(true);

  // GitHub release source setting
  const [releaseSource, setReleaseSource] = useState<GithubReleaseSourceKey>(isTV ? 'crisszollo' : 'tapframe');

  // APK Download state
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState<string>('');

  // Load notification settings on mount
  useEffect(() => {
    (async () => {
      try {
        const otaSetting = await mmkvStorage.getItem('@ota_updates_alerts_enabled');
        const majorSetting = await mmkvStorage.getItem('@major_updates_alerts_enabled');
        // OTA alerts default to false, Major alerts default to true
        setOtaAlertsEnabled(otaSetting === 'true');
        setMajorAlertsEnabled(majorSetting !== 'false');

        // Load GitHub release source - default differs by platform
        const storedSource = await getStoredGithubReleaseSource();
        if (storedSource) {
          setReleaseSource(storedSource);
        } else {
          // No stored preference - use platform default
          const defaultSource: GithubReleaseSourceKey = isTV ? 'crisszollo' : 'tapframe';
          setReleaseSource(defaultSource);
          // Store the default so it's used everywhere
          await setGithubReleaseSource(defaultSource);
        }
      } catch { }
    })();
  }, [isTV]);

  // Handle toggling OTA alerts with warning
  const handleOtaAlertsToggle = async (value: boolean) => {
    if (!value) {
      openAlert(
        'Disable OTA Update Alerts?',
        'You will no longer receive automatic notifications for OTA updates.\n\n⚠️ Warning: Staying on the latest version is important for:\n• Bug fixes and stability improvements\n• New features and enhancements\n• Providing accurate feedback and crash reports\n\nYou can still manually check for updates in this screen.',
        [
          { label: 'Cancel', onPress: () => setAlertVisible(false) },
          {
            label: 'Disable',
            onPress: async () => {
              await mmkvStorage.setItem('@ota_updates_alerts_enabled', 'false');
              setOtaAlertsEnabled(false);
              setAlertVisible(false);
            }
          }
        ]
      );
    } else {
      await mmkvStorage.setItem('@ota_updates_alerts_enabled', 'true');
      setOtaAlertsEnabled(true);
    }
  };

  // Handle changing GitHub release source
  const handleReleaseSourceChange = async (source: GithubReleaseSourceKey) => {
    setReleaseSource(source);
    await setGithubReleaseSource(source);
    // Refresh GitHub release check with new source
    github.refresh();
  };

  // Handle toggling Major update alerts with warning
  const handleMajorAlertsToggle = async (value: boolean) => {
    if (!value) {
      openAlert(
        'Disable Major Update Alerts?',
        'You will no longer receive notifications for major app updates that require reinstallation.\n\n⚠️ Warning: Major updates often include:\n• Critical security patches\n• Breaking changes that require app reinstall\n• Important compatibility fixes\n\nYou can still check for updates manually.',
        [
          { label: 'Cancel', onPress: () => setAlertVisible(false) },
          {
            label: 'Disable',
            onPress: async () => {
              await mmkvStorage.setItem('@major_updates_alerts_enabled', 'false');
              setMajorAlertsEnabled(false);
              setAlertVisible(false);
            }
          }
        ]
      );
    } else {
      await mmkvStorage.setItem('@major_updates_alerts_enabled', 'true');
      setMajorAlertsEnabled(true);
    }
  };

  // Handle downloading and installing APK update
  const handleDownloadUpdate = async () => {
    if (!github.releaseUrl || isDownloading) return;

    setIsDownloading(true);
    setDownloadProgress(0);
    setDownloadStatus('Starting download...');

    const success = await downloadAndInstallUpdate(
      github.releaseUrl,
      (progress: DownloadProgress) => {
        setDownloadProgress(progress.progress);
        const mb = (progress.totalBytesWritten / (1024 * 1024)).toFixed(1);
        const totalMb = progress.totalBytesExpectedToWrite > 0
          ? (progress.totalBytesExpectedToWrite / (1024 * 1024)).toFixed(1)
          : '?';
        setDownloadStatus(`Downloading: ${mb}MB / ${totalMb}MB`);
      },
      (status, message) => {
        switch (status) {
          case 'fetching':
            setDownloadStatus(message || 'Finding download...');
            break;
          case 'downloading':
            setDownloadStatus(message || 'Downloading...');
            break;
          case 'installing':
            setDownloadStatus(message || 'Opening installer...');
            setDownloadProgress(100);
            break;
          case 'done':
            setDownloadStatus('');
            setDownloadProgress(0);
            setIsDownloading(false);
            showInfo('Update', 'APK installer should now be open');
            break;
          case 'error':
            setDownloadStatus(`Error: ${message}`);
            setIsDownloading(false);
            openAlert('Download Failed', message || 'Failed to download update. Please try again.');
            break;
        }
      }
    );

    if (!success) {
      setIsDownloading(false);
    }
  };

  const checkForUpdates = async () => {
    try {
      setIsChecking(true);
      setUpdateStatus('checking');
      setUpdateProgress(0);
      setLastOperation('Checking for updates...');

      const info = await UpdateService.checkForUpdates();
      setUpdateInfo(info);
      setLastChecked(new Date());

      // Logs disabled

      if (info.isAvailable) {
        setUpdateStatus('available');
        setLastOperation(`Update available: ${info.manifest?.id || 'unknown'}`);
      } else {
        setUpdateStatus('idle');
        setLastOperation('No updates available');
      }
    } catch (error) {
      if (__DEV__) console.error('Error checking for updates:', error);
      setUpdateStatus('error');
      setLastOperation(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      openAlert('Error', 'Failed to check for updates');
    } finally {
      setIsChecking(false);
    }
  };

  // Auto-check on mount and keep section visible
  useEffect(() => {
    if (Platform.OS === 'android') {
      // ensure badge clears when entering this screen
      (async () => {
        try { await mmkvStorage.removeItem('@update_badge_pending'); } catch { }
      })();
    }
    // Only check OTA updates for non-TV devices
    if (!isTV) {
      checkForUpdates();
    }
    // Always refresh GitHub section on mount (works in dev and prod)
    try { github.refresh(); } catch { }
    if (Platform.OS === 'android' && !isTV) {
      showInfo('Checking for Updates', 'Checking for updates…');
    }
  }, [isTV]);

  const installUpdate = async () => {
    try {
      setIsInstalling(true);
      setUpdateStatus('downloading');
      setUpdateProgress(0);
      setLastOperation('Downloading update...');

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setUpdateProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 10;
        });
      }, 500);

      const success = await UpdateService.downloadAndInstallUpdate();

      clearInterval(progressInterval);
      setUpdateProgress(100);
      setUpdateStatus('installing');
      setLastOperation('Installing update...');

      // Logs disabled

      if (success) {
        setUpdateStatus('success');
        setLastOperation('Update installed successfully');
        openAlert('Success', 'Update will be applied on next app restart');
      } else {
        setUpdateStatus('error');
        setLastOperation('No update available to install');
        openAlert('No Update', 'No update available to install');
      }
    } catch (error) {
      if (__DEV__) console.error('Error installing update:', error);
      setUpdateStatus('error');
      setLastOperation(`Installation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      openAlert('Error', 'Failed to install update');
    } finally {
      setIsInstalling(false);
    }
  };

  const getCurrentUpdateInfo = async () => {
    const info = await UpdateService.getCurrentUpdateInfo();
    setCurrentInfo(info);
    // Logs disabled
  };

  // Extract release notes from various possible manifest fields
  const getReleaseNotes = () => {
    const manifest: any = updateInfo?.manifest || {};
    return (
      manifest.description ||
      manifest.releaseNotes ||
      manifest.extra?.releaseNotes ||
      manifest.metadata?.releaseNotes ||
      ''
    );
  };

  // Extract release notes for the currently running version
  const getCurrentReleaseNotes = () => {
    const manifest: any = currentInfo?.manifest || {};
    return (
      manifest.description ||
      manifest.releaseNotes ||
      manifest.extra?.releaseNotes ||
      manifest.metadata?.releaseNotes ||
      ''
    );
  };

  // Logs disabled: remove actions

  const testConnectivity = async () => {
    try {
      setLastOperation('Testing connectivity...');
      const isReachable = await UpdateService.testUpdateConnectivity();

      if (isReachable) {
        setLastOperation('Update server is reachable');
      } else {
        setLastOperation('Update server is not reachable');
      }
    } catch (error) {
      if (__DEV__) console.error('Error testing connectivity:', error);
      setLastOperation(`Connectivity test error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Logs disabled
    }
  };

  const testAssetUrls = async () => {
    try {
      setLastOperation('Testing asset URLs...');
      await UpdateService.testAllAssetUrls();
      setLastOperation('Asset URL testing completed');
    } catch (error) {
      if (__DEV__) console.error('Error testing asset URLs:', error);
      setLastOperation(`Asset URL test error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Logs disabled
    }
  };

  // Load current update info on mount
  useEffect(() => {
    const loadInitialData = async () => {
      await getCurrentUpdateInfo();
    };
    loadInitialData();
  }, []);

  const formatDate = (date: Date) => {
    return date.toLocaleString();
  };

  const getStatusIcon = () => {
    switch (updateStatus) {
      case 'checking':
        return <MaterialIcons name="refresh" size={20} color={currentTheme.colors.primary} />;
      case 'available':
        return <MaterialIcons name="new-releases" size={20} color={currentTheme.colors.success || '#4CAF50'} />;
      case 'downloading':
        return <MaterialIcons name="cloud-download" size={20} color={currentTheme.colors.primary} />;
      case 'installing':
        return <MaterialIcons name="install-mobile" size={20} color={currentTheme.colors.primary} />;
      case 'success':
        return <MaterialIcons name="check-circle" size={20} color={currentTheme.colors.success || '#4CAF50'} />;
      case 'error':
        return <MaterialIcons name="error" size={20} color={currentTheme.colors.error || '#ff4444'} />;
      default:
        return <MaterialIcons name="system-update" size={20} color={currentTheme.colors.mediumEmphasis} />;
    }
  };

  const getStatusText = () => {
    switch (updateStatus) {
      case 'checking':
        return 'Checking for updates...';
      case 'available':
        return 'Update available!';
      case 'downloading':
        return 'Downloading update...';
      case 'installing':
        return 'Installing update...';
      case 'success':
        return 'Update installed successfully!';
      case 'error':
        return 'Update failed';
      default:
        return 'Ready to check for updates';
    }
  };

  const getStatusColor = () => {
    switch (updateStatus) {
      case 'available':
      case 'success':
        return currentTheme.colors.success || '#4CAF50';
      case 'error':
        return currentTheme.colors.error || '#ff4444';
      case 'checking':
      case 'downloading':
      case 'installing':
        return currentTheme.colors.primary;
      default:
        return currentTheme.colors.mediumEmphasis;
    }
  };


  return (
    <SafeAreaView style={[
      styles.container,
      { backgroundColor: currentTheme.colors.darkBackground }
    ]}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        {!isTV && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <MaterialIcons name="arrow-back" size={24} color={currentTheme.colors.highEmphasis} />
            <Text style={[styles.backText, { color: currentTheme.colors.highEmphasis }]}>
              Settings
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.headerActions}>
          {/* Empty for now, but ready for future actions */}
        </View>
      </View>

      <Text style={[styles.headerTitle, { color: currentTheme.colors.text }]}>
        App Updates
      </Text>

      <View style={styles.contentContainer}>
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* OTA Updates - Hide for TV, focus on GitHub releases */}
          {!isTV && (
          <SettingsCard title="APP UPDATES" isTablet={isTablet}>
            {/* Main Update Card */}
            <View style={styles.updateMainCard}>
              {/* Status Section */}
              <View style={styles.updateStatusSection}>
                <View style={[styles.statusIndicator, { backgroundColor: `${getStatusColor()}20` }]}>
                  {getStatusIcon()}
                </View>
                <View style={styles.statusContent}>
                  <Text style={[styles.statusMainText, { color: currentTheme.colors.highEmphasis }]}>
                    {getStatusText()}
                  </Text>
                  <Text style={[styles.statusDetailText, { color: currentTheme.colors.mediumEmphasis }]}>
                    {lastOperation || 'Ready to check for updates'}
                  </Text>
                </View>
              </View>

              {/* Progress Section */}
              {(updateStatus === 'downloading' || updateStatus === 'installing') && (
                <View style={styles.progressSection}>
                  <View style={styles.progressHeader}>
                    <Text style={[styles.progressLabel, { color: currentTheme.colors.mediumEmphasis }]}>
                      {updateStatus === 'downloading' ? 'Downloading' : 'Installing'}
                    </Text>
                    <Text style={[styles.progressPercentage, { color: currentTheme.colors.primary }]}>
                      {Math.round(updateProgress)}%
                    </Text>
                  </View>
                  <View style={[styles.modernProgressBar, { backgroundColor: `${currentTheme.colors.primary}15` }]}>
                    <View
                      style={[
                        styles.modernProgressFill,
                        {
                          backgroundColor: currentTheme.colors.primary,
                          width: `${updateProgress}%`
                        }
                      ]}
                    />
                  </View>
                </View>
              )}

              {/* Action Section */}
              <View style={styles.actionSection}>
                {isTV ? (
                  <Focusable
                    ref={checkUpdatesRef}
                    onPress={checkForUpdates}
                    disabled={isChecking || isInstalling}
                    style={[
                      styles.modernButton,
                      styles.primaryAction,
                      { backgroundColor: currentTheme.colors.primary },
                      (isChecking || isInstalling) && styles.disabledAction
                    ]}
                    borderRadius={12}
                    focusScale={1.05}
                    animateBackground={false}
                    nextFocusUp={backButtonRef.current?.getViewRef()}
                    nextFocusDown={updateInfo?.isAvailable && updateStatus !== 'success'
                      ? installUpdateRef.current?.getViewRef()
                      : otaToggleRef.current?.getViewRef()}
                  >
                    {(focused) => (
                      <>
                        {isChecking ? (
                          <MaterialIcons name="refresh" size={18} color="white" />
                        ) : (
                          <MaterialIcons name="system-update" size={18} color="white" />
                        )}
                        <Text style={styles.modernButtonText}>
                          {isChecking ? 'Checking...' : 'Check for Updates'}
                        </Text>
                      </>
                    )}
                  </Focusable>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.modernButton,
                      styles.primaryAction,
                      { backgroundColor: currentTheme.colors.primary },
                      (isChecking || isInstalling) && styles.disabledAction
                    ]}
                    onPress={checkForUpdates}
                    disabled={isChecking || isInstalling}
                    activeOpacity={0.8}
                  >
                    {isChecking ? (
                      <MaterialIcons name="refresh" size={18} color="white" />
                    ) : (
                      <MaterialIcons name="system-update" size={18} color="white" />
                    )}
                    <Text style={styles.modernButtonText}>
                      {isChecking ? 'Checking...' : 'Check for Updates'}
                    </Text>
                  </TouchableOpacity>
                )}

                {updateInfo?.isAvailable && updateStatus !== 'success' && (
                  isTV ? (
                    <Focusable
                      ref={installUpdateRef}
                      onPress={installUpdate}
                      disabled={isInstalling}
                      style={[
                        styles.modernButton,
                        styles.installAction,
                        { backgroundColor: currentTheme.colors.success || '#34C759' },
                        (isInstalling) && styles.disabledAction
                      ]}
                      borderRadius={12}
                      focusScale={1.05}
                      animateBackground={false}
                      nextFocusUp={checkUpdatesRef.current?.getViewRef()}
                      nextFocusDown={otaToggleRef.current?.getViewRef()}
                    >
                      {(focused) => (
                        <>
                          {isInstalling ? (
                            <MaterialIcons name="install-mobile" size={18} color="white" />
                          ) : (
                            <MaterialIcons name="download" size={18} color="white" />
                          )}
                          <Text style={styles.modernButtonText}>
                            {isInstalling ? 'Installing...' : 'Install Update'}
                          </Text>
                        </>
                      )}
                    </Focusable>
                  ) : (
                    <TouchableOpacity
                      style={[
                        styles.modernButton,
                        styles.installAction,
                        { backgroundColor: currentTheme.colors.success || '#34C759' },
                        (isInstalling) && styles.disabledAction
                      ]}
                      onPress={installUpdate}
                      disabled={isInstalling}
                      activeOpacity={0.8}
                    >
                      {isInstalling ? (
                        <MaterialIcons name="install-mobile" size={18} color="white" />
                      ) : (
                        <MaterialIcons name="download" size={18} color="white" />
                      )}
                      <Text style={styles.modernButtonText}>
                        {isInstalling ? 'Installing...' : 'Install Update'}
                      </Text>
                    </TouchableOpacity>
                  )
                )}

              </View>
            </View>

            {/* Release Notes */}
            {updateInfo?.isAvailable && !!getReleaseNotes() && (
              <View style={styles.infoSection}>
                <View style={styles.infoItem}>
                  <View style={[styles.infoIcon, { backgroundColor: `${currentTheme.colors.primary}15` }]}>
                    <MaterialIcons name="notes" size={14} color={currentTheme.colors.primary} />
                  </View>
                  <Text style={[styles.infoLabel, { color: currentTheme.colors.mediumEmphasis }]}>Release notes:</Text>
                </View>
                <Text style={[styles.infoValue, { color: currentTheme.colors.highEmphasis }]}>{getReleaseNotes()}</Text>
              </View>
            )}

            {/* Info Section */}
            <View style={styles.infoSection}>
              <View style={styles.infoItem}>
                <View style={[styles.infoIcon, { backgroundColor: `${currentTheme.colors.primary}15` }]}>
                  <MaterialIcons name="info-outline" size={14} color={currentTheme.colors.primary} />
                </View>
                <Text style={[styles.infoLabel, { color: currentTheme.colors.mediumEmphasis }]}>Version:</Text>
                <Text style={[styles.infoValue, { color: currentTheme.colors.highEmphasis }]}>
                  {updateInfo?.manifest?.id ? `${updateInfo.manifest.id.substring(0, 8)}...` : 'Unknown'}
                </Text>
              </View>

              {lastChecked && (
                <View style={styles.infoItem}>
                  <View style={[styles.infoIcon, { backgroundColor: `${currentTheme.colors.primary}15` }]}>
                    <MaterialIcons name="schedule" size={14} color={currentTheme.colors.primary} />
                  </View>
                  <Text style={[styles.infoLabel, { color: currentTheme.colors.mediumEmphasis }]}>Last checked:</Text>
                  <Text style={[styles.infoValue, { color: currentTheme.colors.highEmphasis }]}>
                    {formatDate(lastChecked)}
                  </Text>
                </View>
              )}
            </View>

            {/* Current Version Section */}
            <View style={styles.infoSection}>
              <View style={styles.infoItem}>
                <View style={[styles.infoIcon, { backgroundColor: `${currentTheme.colors.primary}15` }]}>
                  <MaterialIcons name="verified" size={14} color={currentTheme.colors.primary} />
                </View>
                <Text style={[styles.infoLabel, { color: currentTheme.colors.mediumEmphasis }]}>Current version:</Text>
                <Text style={[styles.infoValue, { color: currentTheme.colors.highEmphasis }]}
                  selectable>
                  {currentInfo?.manifest?.id || (currentInfo?.isEmbeddedLaunch === false ? 'Unknown' : 'Embedded')}
                </Text>
              </View>

              {!!getCurrentReleaseNotes() && (
                <View style={{ marginTop: 8 }}>
                  <View style={[styles.infoItem, { alignItems: 'flex-start' }]}>
                    <View style={[styles.infoIcon, { backgroundColor: `${currentTheme.colors.primary}15` }]}>
                      <MaterialIcons name="notes" size={14} color={currentTheme.colors.primary} />
                    </View>
                    <Text style={[styles.infoLabel, { color: currentTheme.colors.mediumEmphasis }]}>Current release notes:</Text>
                  </View>
                  <Text style={[styles.infoValue, { color: currentTheme.colors.highEmphasis }]}>
                    {getCurrentReleaseNotes()}
                  </Text>
                </View>
              )}
            </View>

            {/* Developer Logs removed */}
          </SettingsCard>
          )}

          {/* GitHub Release - Always show for TV, only when update available for mobile */}
          {(() => {
            const currentVersion = isTV ? getNuvioTVVersion() : getDisplayedAppVersion();
            const hasUpdate = github.latestTag && isNewerVersion(currentVersion, github.latestTag);
            const shouldShow = isTV || hasUpdate;

            if (!shouldShow) return null;

            return (
              <SettingsCard title={isTV ? "SOFTWARE UPDATE" : "GITHUB RELEASE"} isTablet={isTablet}>
                <View style={styles.infoSection}>
                  {/* TV: Large prominent version display */}
                  {isTV && (
                    <View style={styles.tvVersionDisplay}>
                      <View style={[styles.tvVersionBox, { backgroundColor: currentTheme.colors.elevation2 }]}>
                        <Text style={[styles.tvVersionLabel, { color: currentTheme.colors.mediumEmphasis }]}>
                          Installed Version
                        </Text>
                        <Text style={[styles.tvVersionNumber, { color: currentTheme.colors.highEmphasis }]}>
                          {currentVersion}
                        </Text>
                      </View>
                      <MaterialIcons
                        name={github.isChecking ? "sync" : (hasUpdate ? "arrow-forward" : "check-circle")}
                        size={32}
                        color={github.isChecking ? currentTheme.colors.mediumEmphasis : (hasUpdate ? currentTheme.colors.primary : (currentTheme.colors.success || '#4CAF50'))}
                        style={styles.tvVersionArrow}
                      />
                      <View style={[styles.tvVersionBox, { backgroundColor: hasUpdate ? `${currentTheme.colors.primary}15` : currentTheme.colors.elevation2 }]}>
                        <Text style={[styles.tvVersionLabel, { color: currentTheme.colors.mediumEmphasis }]}>
                          {github.isChecking ? 'Checking' : (hasUpdate ? 'Available' : 'Latest')}
                        </Text>
                        <Text style={[styles.tvVersionNumber, { color: hasUpdate ? currentTheme.colors.primary : currentTheme.colors.highEmphasis }]}>
                          {github.isChecking ? '...' : (github.latestTag || (github.hasError ? 'Error' : 'Unknown'))}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Mobile: Compact version info */}
                  {!isTV && (
                    <>
                      <View style={styles.infoItem}>
                        <View style={[styles.infoIcon, { backgroundColor: `${currentTheme.colors.primary}15` }]}>
                          <MaterialIcons name="new-releases" size={14} color={currentTheme.colors.primary} />
                        </View>
                        <Text style={[styles.infoLabel, { color: currentTheme.colors.mediumEmphasis }]}>Current:</Text>
                        <Text style={[styles.infoValue, { color: currentTheme.colors.highEmphasis }]}>
                          {currentVersion}
                        </Text>
                      </View>

                      <View style={styles.infoItem}>
                        <View style={[styles.infoIcon, { backgroundColor: `${currentTheme.colors.primary}15` }]}>
                          <MaterialIcons name="tag" size={14} color={currentTheme.colors.primary} />
                        </View>
                        <Text style={[styles.infoLabel, { color: currentTheme.colors.mediumEmphasis }]}>Latest:</Text>
                        <Text style={[styles.infoValue, { color: currentTheme.colors.highEmphasis }]}>
                          {github.latestTag}
                        </Text>
                      </View>
                    </>
                  )}

                  {/* Status message for TV */}
                  {isTV && !github.isChecking && (
                    <View style={[styles.tvStatusBanner, {
                      backgroundColor: github.hasError
                        ? `${currentTheme.colors.error || '#ff4444'}15`
                        : (hasUpdate ? `${currentTheme.colors.primary}15` : `${currentTheme.colors.success || '#4CAF50'}15`)
                    }]}>
                      <MaterialIcons
                        name={github.hasError ? "error-outline" : (hasUpdate ? "system-update" : "check-circle")}
                        size={24}
                        color={github.hasError
                          ? (currentTheme.colors.error || '#ff4444')
                          : (hasUpdate ? currentTheme.colors.primary : (currentTheme.colors.success || '#4CAF50'))}
                      />
                      <Text style={[styles.tvStatusText, {
                        color: github.hasError
                          ? (currentTheme.colors.error || '#ff4444')
                          : (hasUpdate ? currentTheme.colors.primary : (currentTheme.colors.success || '#4CAF50'))
                      }]}>
                        {github.hasError
                          ? 'Could not check for updates'
                          : (hasUpdate ? 'A new version is available!' : 'Your app is up to date')}
                      </Text>
                    </View>
                  )}

                  {github.releaseNotes && !github.isChecking ? (
                    <View style={{ marginTop: isTV ? 16 : 4 }}>
                      <Text style={[styles.infoLabel, { color: currentTheme.colors.mediumEmphasis, fontSize: isTV ? 16 : 14 }]}>
                        Release Notes:
                      </Text>
                      <Text
                        numberOfLines={isTV ? 4 : 3}
                        style={[styles.infoValue, { color: currentTheme.colors.highEmphasis, fontSize: isTV ? 15 : 14, lineHeight: isTV ? 22 : 20, marginTop: 4 }]}
                      >
                        {github.releaseNotes}
                      </Text>
                    </View>
                  ) : null}

                  {/* Action buttons for TV */}
                  {isTV && (
                    <View style={[styles.actionSection, { marginTop: 20 }]}>
                      <View style={{ flexDirection: 'row', gap: 16 }}>
                        {/* Check for Updates button */}
                        <Focusable
                          ref={checkUpdatesRef}
                          onPress={() => github.refresh()}
                          disabled={github.isChecking}
                          style={{ flex: 1 }}
                          autoFocus
                          borderRadius={12}
                          focusScale={1.02}
                          showFocusBorder={false}
                          animateBackground={false}
                          nextFocusUp={backButtonRef.current?.getViewRef()}
                          nextFocusDown={majorToggleRef.current?.getViewRef()}
                          nextFocusRight={viewReleaseRef.current?.getViewRef()}
                        >
                          {(focused) => (
                            <View style={[
                              styles.tvButtonInner,
                              {
                                backgroundColor: focused ? currentTheme.colors.primary : currentTheme.colors.elevation2,
                                borderWidth: 3,
                                borderColor: focused ? '#fff' : 'transparent',
                              }
                            ]}>
                              <MaterialIcons
                                name={github.isChecking ? "sync" : "refresh"}
                                size={22}
                                color={focused ? '#fff' : currentTheme.colors.highEmphasis}
                              />
                              <Text style={[
                                styles.modernButtonText,
                                styles.tvButtonText,
                                { color: focused ? '#fff' : currentTheme.colors.highEmphasis }
                              ]}>
                                {github.isChecking ? 'Checking...' : 'Check for Updates'}
                              </Text>
                            </View>
                          )}
                        </Focusable>

                        {/* Download/Reinstall button - show when update available OR when up to date (reinstall option) */}
                        {(hasUpdate || (!hasUpdate && github.latestTag && !github.isChecking)) && (
                          <Focusable
                            ref={viewReleaseRef}
                            onPress={handleDownloadUpdate}
                            disabled={isDownloading}
                            style={{ flex: 1 }}
                            borderRadius={12}
                            focusScale={1.02}
                            showFocusBorder={false}
                            animateBackground={false}
                            nextFocusUp={checkUpdatesRef.current?.getViewRef()}
                            nextFocusDown={majorToggleRef.current?.getViewRef()}
                            nextFocusLeft={checkUpdatesRef.current?.getViewRef()}
                          >
                            {(focused) => (
                              <View style={[
                                styles.tvButtonInner,
                                {
                                  backgroundColor: focused ? '#fff' : (hasUpdate ? currentTheme.colors.primary : currentTheme.colors.elevation2),
                                  borderWidth: 3,
                                  borderColor: focused ? (hasUpdate ? currentTheme.colors.primary : '#fff') : 'transparent',
                                  opacity: isDownloading ? 0.7 : 1,
                                }
                              ]}>
                                <MaterialIcons
                                  name={isDownloading ? "downloading" : "download"}
                                  size={22}
                                  color={focused ? (hasUpdate ? currentTheme.colors.primary : '#000') : (hasUpdate ? '#fff' : currentTheme.colors.highEmphasis)}
                                />
                                <Text style={[
                                  styles.modernButtonText,
                                  styles.tvButtonText,
                                  { color: focused ? (hasUpdate ? currentTheme.colors.primary : '#000') : (hasUpdate ? '#fff' : currentTheme.colors.highEmphasis) }
                                ]}>
                                  {isDownloading
                                    ? `${downloadProgress}%`
                                    : (hasUpdate ? 'Download & Install' : 'Reinstall')}
                                </Text>
                              </View>
                            )}
                          </Focusable>
                        )}
                      </View>

                      {/* Download progress indicator */}
                      {isDownloading && (
                        <View style={{ marginTop: 16 }}>
                          <View style={[styles.downloadProgressBar, { backgroundColor: currentTheme.colors.elevation2 }]}>
                            <View
                              style={[
                                styles.downloadProgressFill,
                                {
                                  backgroundColor: currentTheme.colors.primary,
                                  width: `${downloadProgress}%`,
                                }
                              ]}
                            />
                          </View>
                          <Text style={[styles.downloadStatusText, { color: currentTheme.colors.mediumEmphasis }]}>
                            {downloadStatus}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Action buttons for Mobile */}
                  {!isTV && (hasUpdate || (!hasUpdate && github.latestTag && !github.isChecking)) && (
                    <View style={[styles.actionSection, { marginTop: 8 }]}>
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity
                          style={[styles.modernButton, { backgroundColor: hasUpdate ? currentTheme.colors.primary : currentTheme.colors.elevation2, flex: 1 }]}
                          onPress={() => github.releaseUrl ? Linking.openURL(github.releaseUrl as string) : null}
                          activeOpacity={0.8}
                        >
                          <MaterialIcons name={hasUpdate ? "open-in-new" : "refresh"} size={18} color={hasUpdate ? "white" : currentTheme.colors.highEmphasis} />
                          <Text style={[styles.modernButtonText, !hasUpdate && { color: currentTheme.colors.highEmphasis }]}>
                            {hasUpdate ? 'View Release' : 'Reinstall Anyway'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              </SettingsCard>
            );
          })()}

          {/* Update Notification Settings */}
          <SettingsCard title={isTV ? "UPDATE NOTIFICATIONS" : "NOTIFICATION SETTINGS"} isTablet={isTablet}>
            {/* OTA Updates Toggle - Only for non-TV */}
            {!isTV && (
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingLabel, { color: currentTheme.colors.highEmphasis }]}>
                    OTA Update Alerts
                  </Text>
                  <Text style={[styles.settingDescription, { color: currentTheme.colors.mediumEmphasis }]}>
                    Show notifications for over-the-air updates
                  </Text>
                </View>
                <Switch
                  value={otaAlertsEnabled}
                  onValueChange={handleOtaAlertsToggle}
                  trackColor={{ false: '#505050', true: currentTheme.colors.primary }}
                  thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
                  ios_backgroundColor="#505050"
                />
              </View>
            )}

            {/* Update Alerts Toggle */}
            {isTV ? (
              <Focusable
                ref={majorToggleRef}
                onPress={() => handleMajorAlertsToggle(!majorAlertsEnabled)}
                style={[styles.settingRow, { marginHorizontal: 4, borderBottomWidth: 0 }]}
                borderRadius={8}
                focusScale={1}
                animateBackground={false}
                showFocusBorder={true}
                nextFocusUp={checkUpdatesRef.current?.getViewRef()}
                nextFocusDown={releaseSourceTapframeRef.current?.getViewRef()}
              >
                {(focused) => (
                  <>
                    <View style={styles.settingInfo}>
                      <Text style={[
                        styles.settingLabel,
                        styles.tvSettingLabel,
                        { color: currentTheme.colors.highEmphasis }
                      ]}>
                        Update Notifications
                      </Text>
                      <Text style={[
                        styles.settingDescription,
                        styles.tvSettingDescription,
                        { color: currentTheme.colors.mediumEmphasis }
                      ]}>
                        Show popup when a new version is available
                      </Text>
                    </View>
                    <View style={styles.tvSwitchContainer}>
                      <View style={[
                        styles.tvSwitchTrack,
                        { backgroundColor: majorAlertsEnabled ? currentTheme.colors.primary : '#505050' }
                      ]}>
                        <View style={[
                          styles.tvSwitchThumb,
                          majorAlertsEnabled ? styles.tvSwitchThumbOn : styles.tvSwitchThumbOff,
                          { backgroundColor: '#fff' }
                        ]} />
                      </View>
                    </View>
                  </>
                )}
              </Focusable>
            ) : (
              <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingLabel, { color: currentTheme.colors.highEmphasis }]}>
                    Major Update Alerts
                  </Text>
                  <Text style={[styles.settingDescription, { color: currentTheme.colors.mediumEmphasis }]}>
                    Show notifications for new app versions on GitHub
                  </Text>
                </View>
                <Switch
                  value={majorAlertsEnabled}
                  onValueChange={handleMajorAlertsToggle}
                  trackColor={{ false: '#505050', true: currentTheme.colors.primary }}
                  thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
                  ios_backgroundColor="#505050"
                />
              </View>
            )}

            {/* Warning note */}
            <View style={[styles.infoItem, { paddingHorizontal: 16, paddingBottom: 12 }]}>
              <View style={[styles.infoIcon, { backgroundColor: `${currentTheme.colors.warning || '#FFA500'}20` }]}>
                <MaterialIcons name="info-outline" size={14} color={currentTheme.colors.warning || '#FFA500'} />
              </View>
              <Text style={[styles.settingDescription, { color: currentTheme.colors.mediumEmphasis, flex: 1 }]}>
                Keeping alerts enabled ensures you receive bug fixes and can provide accurate crash reports.
              </Text>
            </View>
          </SettingsCard>

          {/* GitHub Release Source Setting */}
          <SettingsCard title="RELEASE SOURCE" isTablet={isTablet}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, { color: currentTheme.colors.highEmphasis }]}>
                  GitHub Repository
                </Text>
                <Text style={[styles.settingDescription, { color: currentTheme.colors.mediumEmphasis }]}>
                  Choose which GitHub repository to check for major updates
                </Text>
              </View>
            </View>

            {/* Tapframe Option */}
            {isTV ? (
              <Focusable
                ref={releaseSourceTapframeRef}
                onPress={() => handleReleaseSourceChange('tapframe')}
                style={[styles.settingRow, { marginHorizontal: 4 }]}
                borderRadius={8}
                focusScale={1}
                animateBackground={false}
                showFocusBorder={true}
                nextFocusUp={majorToggleRef.current?.getViewRef()}
                nextFocusDown={releaseSourceCrisszolloRef.current?.getViewRef()}
              >
                {(focused) => (
                  <>
                    <View style={styles.settingInfo}>
                      <Text style={[
                        styles.settingLabel,
                        { color: currentTheme.colors.highEmphasis }
                      ]}>
                        {GITHUB_RELEASE_SOURCES.tapframe.label}
                      </Text>
                      <Text style={[
                        styles.settingDescription,
                        { color: currentTheme.colors.mediumEmphasis }
                      ]}>
                        Main repository for mobile devices
                      </Text>
                    </View>
                    <View style={styles.radioContainer}>
                      <View style={[
                        styles.radioOuter,
                        { borderColor: releaseSource === 'tapframe' ? currentTheme.colors.primary : currentTheme.colors.mediumEmphasis }
                      ]}>
                        {releaseSource === 'tapframe' && (
                          <View style={[
                            styles.radioInner,
                            { backgroundColor: currentTheme.colors.primary }
                          ]} />
                        )}
                      </View>
                    </View>
                  </>
                )}
              </Focusable>
            ) : (
              <TouchableOpacity
                style={styles.settingRow}
                onPress={() => handleReleaseSourceChange('tapframe')}
                activeOpacity={0.7}
              >
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingLabel, { color: currentTheme.colors.highEmphasis }]}>
                    {GITHUB_RELEASE_SOURCES.tapframe.label}
                  </Text>
                  <Text style={[styles.settingDescription, { color: currentTheme.colors.mediumEmphasis }]}>
                    Main repository for mobile devices
                  </Text>
                </View>
                <View style={styles.radioContainer}>
                  <View style={[
                    styles.radioOuter,
                    { borderColor: releaseSource === 'tapframe' ? currentTheme.colors.primary : currentTheme.colors.mediumEmphasis }
                  ]}>
                    {releaseSource === 'tapframe' && (
                      <View style={[styles.radioInner, { backgroundColor: currentTheme.colors.primary }]} />
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            )}

            {/* CrissZollo Option */}
            {isTV ? (
              <Focusable
                ref={releaseSourceCrisszolloRef}
                onPress={() => handleReleaseSourceChange('crisszollo')}
                style={[styles.settingRow, { marginHorizontal: 4, borderBottomWidth: 0 }]}
                borderRadius={8}
                focusScale={1}
                animateBackground={false}
                showFocusBorder={true}
                nextFocusUp={releaseSourceTapframeRef.current?.getViewRef()}
              >
                {(focused) => (
                  <>
                    <View style={styles.settingInfo}>
                      <Text style={[
                        styles.settingLabel,
                        { color: currentTheme.colors.highEmphasis }
                      ]}>
                        {GITHUB_RELEASE_SOURCES.crisszollo.label}
                      </Text>
                      <Text style={[
                        styles.settingDescription,
                        { color: currentTheme.colors.mediumEmphasis }
                      ]}>
                        Optimized for Android TV devices
                      </Text>
                    </View>
                    <View style={styles.radioContainer}>
                      <View style={[
                        styles.radioOuter,
                        { borderColor: releaseSource === 'crisszollo' ? currentTheme.colors.primary : currentTheme.colors.mediumEmphasis }
                      ]}>
                        {releaseSource === 'crisszollo' && (
                          <View style={[
                            styles.radioInner,
                            { backgroundColor: currentTheme.colors.primary }
                          ]} />
                        )}
                      </View>
                    </View>
                  </>
                )}
              </Focusable>
            ) : (
              <TouchableOpacity
                style={[styles.settingRow, { borderBottomWidth: 0 }]}
                onPress={() => handleReleaseSourceChange('crisszollo')}
                activeOpacity={0.7}
              >
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingLabel, { color: currentTheme.colors.highEmphasis }]}>
                    {GITHUB_RELEASE_SOURCES.crisszollo.label}
                  </Text>
                  <Text style={[styles.settingDescription, { color: currentTheme.colors.mediumEmphasis }]}>
                    Optimized for Android TV devices
                  </Text>
                </View>
                <View style={styles.radioContainer}>
                  <View style={[
                    styles.radioOuter,
                    { borderColor: releaseSource === 'crisszollo' ? currentTheme.colors.primary : currentTheme.colors.mediumEmphasis }
                  ]}>
                    {releaseSource === 'crisszollo' && (
                      <View style={[styles.radioInner, { backgroundColor: currentTheme.colors.primary }]} />
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            )}
          </SettingsCard>

          {false && (
            <SettingsCard title="UPDATE LOGS" isTablet={isTablet}>
              <View style={styles.logsContainer}>
                <View style={styles.logsHeader}>
                  <Text style={[styles.logsHeaderText, { color: currentTheme.colors.highEmphasis }]}>
                    Update Service Logs
                  </Text>
                  <View style={styles.logsActions}>
                    <TouchableOpacity
                      style={[styles.logActionButton, { backgroundColor: currentTheme.colors.elevation2 }]}
                      onPress={testConnectivity}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons name="wifi" size={16} color={currentTheme.colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.logActionButton, { backgroundColor: currentTheme.colors.elevation2 }]}
                      onPress={testAssetUrls}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons name="link" size={16} color={currentTheme.colors.primary} />
                    </TouchableOpacity>
                    {/* Test log removed */}
                    {/* Copy all logs removed */}
                    {/* Refresh logs removed */}
                    {/* Clear logs removed */}
                  </View>
                </View>

                <ScrollView
                  style={[styles.logsScrollView, { backgroundColor: currentTheme.colors.elevation2 }]}
                  showsVerticalScrollIndicator={true}
                  nestedScrollEnabled={true}
                >
                  {false ? (
                    <Text style={[styles.noLogsText, { color: currentTheme.colors.mediumEmphasis }]}>No logs available</Text>
                  ) : (
                    ([] as string[]).map((log, index) => {
                      const isError = log.indexOf('[ERROR]') !== -1;
                      const isWarning = log.indexOf('[WARN]') !== -1;

                      return (
                        <TouchableOpacity
                          key={index}
                          style={[
                            styles.logEntry,
                            { backgroundColor: 'rgba(255,255,255,0.05)' }
                          ]}
                          onPress={() => { }}
                          activeOpacity={0.7}
                        >
                          <View style={styles.logEntryContent}>
                            <Text style={[
                              styles.logText,
                              {
                                color: isError
                                  ? (currentTheme.colors.error || '#ff4444')
                                  : isWarning
                                    ? (currentTheme.colors.warning || '#ffaa00')
                                    : currentTheme.colors.mediumEmphasis
                              }
                            ]}>
                              {log}
                            </Text>
                            <MaterialIcons
                              name="content-copy"
                              size={14}
                              color={currentTheme.colors.mediumEmphasis}
                              style={styles.logCopyIcon}
                            />
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </ScrollView>
              </View>
            </SettingsCard>
          )}
        </ScrollView>
      </View>
      <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        onClose={() => setAlertVisible(false)}
        actions={alertActions}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 8 : 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  backText: {
    fontSize: 17,
    marginLeft: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: 'bold',
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  contentContainer: {
    flex: 1,
    zIndex: 1,
    width: '100%',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    width: '100%',
    paddingBottom: 90,
  },

  // Common card styles
  cardContainer: {
    width: '100%',
    marginBottom: 20,
  },
  tabletCardContainer: {
    marginBottom: 32,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginLeft: Math.max(12, width * 0.04),
    marginBottom: 8,
  },
  tabletCardTitle: {
    fontSize: 14,
    marginLeft: 0,
    marginBottom: 12,
  },
  card: {
    marginHorizontal: Math.max(12, width * 0.04),
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    width: undefined,
  },
  tabletCard: {
    marginHorizontal: 0,
    borderRadius: 20,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },

  // Update UI Styles
  updateMainCard: {
    padding: 20,
    marginBottom: 16,
  },
  updateStatusSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  statusIndicator: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  statusContent: {
    flex: 1,
  },
  statusMainText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  statusDetailText: {
    fontSize: 14,
    opacity: 0.8,
    lineHeight: 20,
  },
  progressSection: {
    marginBottom: 20,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: '600',
  },
  modernProgressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  modernProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  actionSection: {
    gap: 12,
  },
  modernButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryAction: {
    marginBottom: 8,
  },
  installAction: {
    // Additional styles for install button
  },
  disabledAction: {
    opacity: 0.6,
  },
  modernButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  infoSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
    minWidth: 80,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '400',
    flex: 1,
  },
  modernAdvancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginTop: 8,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  advancedToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  advancedToggleLabel: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  logsBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  logsBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },

  // Logs styles
  logsContainer: {
    padding: 20,
  },
  logsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  logsHeaderText: {
    fontSize: 16,
    fontWeight: '600',
  },
  logsActions: {
    flexDirection: 'row',
    gap: 8,
  },
  logActionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logsScrollView: {
    maxHeight: 200,
    borderRadius: 8,
    padding: 12,
  },
  logEntry: {
    marginBottom: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  logEntryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 16,
    flex: 1,
    marginRight: 8,
  },
  logCopyIcon: {
    opacity: 0.6,
  },
  noLogsText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },

  // Settings toggle styles
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    lineHeight: 18,
  },

  // TV Toggle styles - thin track with floating thumb
  tvSwitchContainer: {
    width: 51,
    height: 26,
    justifyContent: 'center',
  },
  tvSwitchTrack: {
    width: 51,
    height: 14,
    borderRadius: 7,
    position: 'relative' as const,
  },
  tvSwitchThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    position: 'absolute' as const,
    top: -6,
  },
  tvSwitchThumbOn: {
    right: 0,
  },
  tvSwitchThumbOff: {
    left: 0,
  },

  // Radio button styles
  radioContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },

  // TV-specific version display styles
  tvVersionDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 16,
  },
  tvVersionBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  tvVersionLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  tvVersionNumber: {
    fontSize: 20,
    fontWeight: '700',
  },
  tvVersionArrow: {
    marginHorizontal: 8,
  },
  tvStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 12,
    marginTop: 8,
  },
  tvStatusText: {
    fontSize: 18,
    fontWeight: '600',
  },
  tvDownloadButton: {
    paddingVertical: 0,
  },
  tvButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
  },
  tvButtonText: {
    fontSize: 18,
  },
  tvSettingLabel: {
    fontSize: 18,
  },
  tvSettingDescription: {
    fontSize: 15,
  },

  // Download progress styles
  downloadProgressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  downloadProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  downloadStatusText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});

export default UpdateScreen;
