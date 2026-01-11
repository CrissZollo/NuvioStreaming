import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import QRCode from 'react-native-qrcode-svg';
import * as Updates from 'expo-updates';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '../contexts/ThemeContext';
import { Focusable } from '../components/tv/Focusable';
import { tvUploadServerService } from '../services/tvUploadServerService';
import { backupService, BackupData } from '../services/backupService';
import { logger } from '../utils/logger';
import CustomAlert from '../components/CustomAlert';

const ANDROID_STATUSBAR_HEIGHT = StatusBar.currentHeight || 0;

type RestoreState = 'idle' | 'starting' | 'waiting' | 'received' | 'restoring' | 'error';

const TVRestoreScreen: React.FC = () => {
  const { currentTheme } = useTheme();
  const navigation = useNavigation();

  const [state, setState] = useState<RestoreState>('idle');
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [receivedBackup, setReceivedBackup] = useState<BackupData | null>(null);

  // Alert state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertActions, setAlertActions] = useState<Array<{ label: string; onPress: () => void; style?: object }>>([]);

  const openAlert = useCallback((
    title: string,
    message: string,
    actions?: Array<{ label: string; onPress: () => void; style?: object }>
  ) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertActions(actions && actions.length > 0 ? actions : [{ label: 'OK', onPress: () => {} }]);
    setAlertVisible(true);
  }, []);

  const startServer = useCallback(async () => {
    setState('starting');
    setErrorMessage('');

    const url = await tvUploadServerService.startServer(
      // On file received
      (backupData: BackupData) => {
        logger.info('[TVRestoreScreen] Backup received');
        setReceivedBackup(backupData);
        setState('received');
      },
      // On error
      (error: string) => {
        logger.error('[TVRestoreScreen] Server error:', error);
        setErrorMessage(error);
        setState('error');
      }
    );

    if (url) {
      setServerUrl(url);
      setState('waiting');
    } else {
      setState('error');
      if (!errorMessage) {
        setErrorMessage('Failed to start upload server');
      }
    }
  }, [errorMessage]);

  const stopServer = useCallback(() => {
    tvUploadServerService.stopServer();
    setServerUrl(null);
    setReceivedBackup(null);
    setState('idle');
  }, []);

  const handleCancel = useCallback(() => {
    stopServer();
    navigation.goBack();
  }, [stopServer, navigation]);

  const handleRetry = useCallback(() => {
    stopServer();
    startServer();
  }, [stopServer, startServer]);

  const restartApp = async () => {
    try {
      await Updates.reloadAsync();
    } catch (error) {
      logger.error('[TVRestoreScreen] Failed to restart app:', error);
      openAlert(
        'Restart Failed',
        'Failed to restart the app. Please manually close and reopen the app to see your restored data.',
        [{ label: 'OK', onPress: () => navigation.goBack() }]
      );
    }
  };

  const handleRestore = useCallback(async () => {
    if (!receivedBackup) return;

    setState('restoring');

    try {
      // Save backup to a temporary file and restore
      const tempFileUri = `${FileSystem.documentDirectory}temp_restore_backup.json`;
      await FileSystem.writeAsStringAsync(
        tempFileUri,
        JSON.stringify(receivedBackup)
      );

      await backupService.restoreBackup(tempFileUri, {
        includeLibrary: true,
        includeWatchProgress: true,
        includeAddons: true,
        includeSettings: true,
        includeTraktData: true,
        includeLocalScrapers: true,
        includeApiKeys: true,
        includeCatalogSettings: true,
        includeUserPreferences: true,
      });

      // Clean up temp file
      try {
        await FileSystem.deleteAsync(tempFileUri);
      } catch {
        // Ignore cleanup errors
      }

      stopServer();

      openAlert(
        'Restore Complete',
        'Your data has been successfully restored. The app will now restart.',
        [
          { label: 'Cancel', onPress: () => navigation.goBack() },
          {
            label: 'Restart App',
            onPress: restartApp,
            style: { fontWeight: 'bold' }
          }
        ]
      );
    } catch (error) {
      logger.error('[TVRestoreScreen] Restore failed:', error);
      setState('error');
      setErrorMessage(error instanceof Error ? error.message : 'Restore failed');
    }
  }, [receivedBackup, stopServer, openAlert, navigation]);

  // Start server when screen mounts
  useEffect(() => {
    startServer();
    return () => {
      tvUploadServerService.stopServer();
    };
  }, []);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderContent = () => {
    switch (state) {
      case 'starting':
        return (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={currentTheme.colors.primary} />
            <Text style={[styles.statusText, { color: currentTheme.colors.highEmphasis }]}>
              Starting upload server...
            </Text>
          </View>
        );

      case 'waiting':
        return (
          <View style={styles.mainContent}>
            {/* Left side - QR Code */}
            <View style={styles.leftSection}>
              <Text style={[styles.instructionText, { color: currentTheme.colors.mediumEmphasis }]}>
                Scan with your phone
              </Text>

              {serverUrl && (
                <View style={styles.qrCodeContainer}>
                  <QRCode
                    value={serverUrl}
                    size={200}
                    backgroundColor="white"
                    color="black"
                  />
                </View>
              )}

              <Text style={[styles.orText, { color: currentTheme.colors.mediumEmphasis }]}>
                Or visit this URL:
              </Text>
              <Text style={[styles.urlText, { color: currentTheme.colors.primary }]}>
                {serverUrl}
              </Text>
            </View>

            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: currentTheme.colors.border }]} />

            {/* Right side - Instructions */}
            <View style={styles.rightSection}>
              <MaterialIcons name="cloud-upload" size={60} color={currentTheme.colors.primary} />
              <Text style={[styles.title, { color: currentTheme.colors.highEmphasis }]}>
                Restore Backup
              </Text>

              <View style={styles.instructionsList}>
                <View style={styles.instructionItem}>
                  <Text style={[styles.instructionNumber, { backgroundColor: currentTheme.colors.primary }]}>1</Text>
                  <Text style={[styles.instructionItemText, { color: currentTheme.colors.mediumEmphasis }]}>
                    Scan the QR code or enter the URL on your phone
                  </Text>
                </View>
                <View style={styles.instructionItem}>
                  <Text style={[styles.instructionNumber, { backgroundColor: currentTheme.colors.primary }]}>2</Text>
                  <Text style={[styles.instructionItemText, { color: currentTheme.colors.mediumEmphasis }]}>
                    Select your Nuvio backup JSON file
                  </Text>
                </View>
                <View style={styles.instructionItem}>
                  <Text style={[styles.instructionNumber, { backgroundColor: currentTheme.colors.primary }]}>3</Text>
                  <Text style={[styles.instructionItemText, { color: currentTheme.colors.mediumEmphasis }]}>
                    Tap Upload and wait for confirmation
                  </Text>
                </View>
              </View>

              <View style={styles.waitingIndicator}>
                <ActivityIndicator size="small" color={currentTheme.colors.primary} />
                <Text style={[styles.waitingText, { color: currentTheme.colors.mediumEmphasis }]}>
                  Waiting for backup file...
                </Text>
              </View>

              <Focusable
                onPress={handleCancel}
                style={[styles.cancelButton, { backgroundColor: currentTheme.colors.elevation3 }]}
                borderRadius={8}
                focusScale={1}
                animateBackground={true}
                showFocusBorder={true}
                autoFocus
              >
                {(focused) => (
                  <Text style={[styles.cancelButtonText, { color: focused ? '#000' : currentTheme.colors.highEmphasis }]}>
                    Cancel
                  </Text>
                )}
              </Focusable>
            </View>
          </View>
        );

      case 'received':
        return (
          <View style={styles.mainContent}>
            {/* Left side - Backup Info */}
            <View style={styles.leftSection}>
              <MaterialIcons name="check-circle" size={80} color="#22c55e" />
              <Text style={[styles.receivedTitle, { color: currentTheme.colors.highEmphasis }]}>
                Backup Received!
              </Text>

              {receivedBackup && (
                <View style={[styles.backupInfoCard, { backgroundColor: currentTheme.colors.elevation2 }]}>
                  <Text style={[styles.backupInfoLabel, { color: currentTheme.colors.mediumEmphasis }]}>
                    Created on
                  </Text>
                  <Text style={[styles.backupInfoValue, { color: currentTheme.colors.highEmphasis }]}>
                    {formatDate(receivedBackup.timestamp)}
                  </Text>

                  <Text style={[styles.backupInfoLabel, { color: currentTheme.colors.mediumEmphasis, marginTop: 16 }]}>
                    Platform
                  </Text>
                  <Text style={[styles.backupInfoValue, { color: currentTheme.colors.highEmphasis }]}>
                    {receivedBackup.platform === 'ios' ? 'iOS' : 'Android'}
                  </Text>
                </View>
              )}
            </View>

            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: currentTheme.colors.border }]} />

            {/* Right side - Metadata & Actions */}
            <View style={styles.rightSection}>
              <Text style={[styles.title, { color: currentTheme.colors.highEmphasis }]}>
                Backup Contents
              </Text>

              {receivedBackup?.metadata && (
                <View style={styles.metadataList}>
                  <View style={styles.metadataItem}>
                    <MaterialIcons name="movie" size={24} color={currentTheme.colors.primary} />
                    <Text style={[styles.metadataText, { color: currentTheme.colors.highEmphasis }]}>
                      {receivedBackup.metadata.libraryCount} items in library
                    </Text>
                  </View>
                  <View style={styles.metadataItem}>
                    <MaterialIcons name="play-circle-outline" size={24} color={currentTheme.colors.primary} />
                    <Text style={[styles.metadataText, { color: currentTheme.colors.highEmphasis }]}>
                      {receivedBackup.metadata.watchProgressCount} watch progress entries
                    </Text>
                  </View>
                  <View style={styles.metadataItem}>
                    <MaterialIcons name="extension" size={24} color={currentTheme.colors.primary} />
                    <Text style={[styles.metadataText, { color: currentTheme.colors.highEmphasis }]}>
                      {receivedBackup.metadata.addonsCount} addons
                    </Text>
                  </View>
                  {receivedBackup.metadata.scrapersCount !== undefined && receivedBackup.metadata.scrapersCount > 0 && (
                    <View style={styles.metadataItem}>
                      <MaterialIcons name="code" size={24} color={currentTheme.colors.primary} />
                      <Text style={[styles.metadataText, { color: currentTheme.colors.highEmphasis }]}>
                        {receivedBackup.metadata.scrapersCount} scrapers
                      </Text>
                    </View>
                  )}
                </View>
              )}

              <Text style={[styles.warningText, { color: currentTheme.colors.warning || '#f59e0b' }]}>
                This will overwrite your current data
              </Text>

              <View style={styles.actionButtons}>
                <Focusable
                  onPress={handleCancel}
                  style={[styles.actionButton, { backgroundColor: currentTheme.colors.elevation3 }]}
                  borderRadius={8}
                  focusScale={1}
                  animateBackground={true}
                  showFocusBorder={true}
                >
                  {(focused) => (
                    <Text style={[styles.actionButtonText, { color: focused ? '#000' : currentTheme.colors.highEmphasis }]}>
                      Cancel
                    </Text>
                  )}
                </Focusable>

                <Focusable
                  onPress={handleRestore}
                  style={[styles.actionButton, styles.primaryButton, { backgroundColor: currentTheme.colors.primary }]}
                  borderRadius={8}
                  focusScale={1}
                  animateBackground={true}
                  showFocusBorder={true}
                  autoFocus
                >
                  {(focused) => (
                    <View style={styles.buttonContent}>
                      <MaterialIcons name="restore" size={20} color={focused ? '#000' : '#fff'} />
                      <Text style={[styles.actionButtonText, styles.primaryButtonText, { color: focused ? '#000' : '#fff' }]}>
                        Restore Now
                      </Text>
                    </View>
                  )}
                </Focusable>
              </View>
            </View>
          </View>
        );

      case 'restoring':
        return (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={currentTheme.colors.primary} />
            <Text style={[styles.statusText, { color: currentTheme.colors.highEmphasis }]}>
              Restoring your data...
            </Text>
            <Text style={[styles.statusSubtext, { color: currentTheme.colors.mediumEmphasis }]}>
              Please wait, this may take a moment
            </Text>
          </View>
        );

      case 'error':
        return (
          <View style={styles.centerContent}>
            <MaterialIcons name="error-outline" size={80} color="#ef4444" />
            <Text style={[styles.errorTitle, { color: currentTheme.colors.highEmphasis }]}>
              Something went wrong
            </Text>
            <Text style={[styles.errorMessage, { color: currentTheme.colors.mediumEmphasis }]}>
              {errorMessage || 'An unknown error occurred'}
            </Text>

            <View style={styles.errorActions}>
              <Focusable
                onPress={handleCancel}
                style={[styles.actionButton, { backgroundColor: currentTheme.colors.elevation3 }]}
                borderRadius={8}
                focusScale={1}
                animateBackground={true}
                showFocusBorder={true}
              >
                {(focused) => (
                  <Text style={[styles.actionButtonText, { color: focused ? '#000' : currentTheme.colors.highEmphasis }]}>
                    Go Back
                  </Text>
                )}
              </Focusable>

              <Focusable
                onPress={handleRetry}
                style={[styles.actionButton, { backgroundColor: currentTheme.colors.primary }]}
                borderRadius={8}
                focusScale={1}
                animateBackground={true}
                showFocusBorder={true}
                autoFocus
              >
                {(focused) => (
                  <Text style={[styles.actionButtonText, { color: focused ? '#000' : '#fff' }]}>
                    Try Again
                  </Text>
                )}
              </Focusable>
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.colors.darkBackground }]}>
      <StatusBar barStyle="light-content" />

      <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        actions={alertActions}
        onClose={() => setAlertVisible(false)}
      />

      {renderContent()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  mainContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  leftSection: {
    flex: 1,
    alignItems: 'center',
    paddingRight: 40,
  },
  rightSection: {
    flex: 1,
    alignItems: 'center',
    paddingLeft: 40,
  },
  divider: {
    width: 1,
    height: '70%',
    opacity: 0.3,
  },
  instructionText: {
    fontSize: 18,
    marginBottom: 20,
  },
  qrCodeContainer: {
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 20,
  },
  orText: {
    fontSize: 14,
    marginBottom: 8,
  },
  urlText: {
    fontSize: 18,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 24,
  },
  instructionsList: {
    width: '100%',
    maxWidth: 400,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  instructionNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    textAlign: 'center',
    lineHeight: 28,
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    marginRight: 12,
    overflow: 'hidden',
  },
  instructionItemText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
  },
  waitingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  waitingText: {
    marginLeft: 12,
    fontSize: 16,
  },
  cancelButton: {
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusText: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 24,
  },
  statusSubtext: {
    fontSize: 16,
    marginTop: 8,
  },
  receivedTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 24,
  },
  backupInfoCard: {
    padding: 24,
    borderRadius: 12,
    width: '100%',
    maxWidth: 300,
  },
  backupInfoLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  backupInfoValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  metadataList: {
    width: '100%',
    maxWidth: 350,
    marginBottom: 24,
  },
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  metadataText: {
    fontSize: 16,
    marginLeft: 12,
  },
  warningText: {
    fontSize: 14,
    marginBottom: 24,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    minWidth: 140,
    alignItems: 'center',
  },
  primaryButton: {
    // Additional styles for primary button
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButtonText: {
    // Additional styles for primary button text
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 12,
  },
  errorMessage: {
    fontSize: 16,
    textAlign: 'center',
    maxWidth: 400,
    marginBottom: 32,
  },
  errorActions: {
    flexDirection: 'row',
    gap: 16,
  },
});

export default TVRestoreScreen;
