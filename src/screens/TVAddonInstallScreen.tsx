import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import QRCode from 'react-native-qrcode-svg';
import { useTheme } from '../contexts/ThemeContext';
import { Focusable } from '../components/tv/Focusable';
import { tvAddonServerService, AddonInstallPayload, InstalledAddonInfo } from '../services/tvAddonServerService';
import { stremioService, Manifest } from '../services/stremioService';
import { logger } from '../utils/logger';

type InstallState = 'idle' | 'starting' | 'waiting' | 'received' | 'installing' | 'complete' | 'error';

interface InstallProgress {
  current: number;
  total: number;
  currentAddon: string;
  completedAddons: string[];
  failedAddons: Array<{ name: string; error: string }>;
}

const TVAddonInstallScreen: React.FC = () => {
  const { currentTheme } = useTheme();
  const navigation = useNavigation();

  const [state, setState] = useState<InstallState>('idle');
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [receivedPayload, setReceivedPayload] = useState<AddonInstallPayload | null>(null);
  const [installProgress, setInstallProgress] = useState<InstallProgress | null>(null);

  const startServer = useCallback(async () => {
    setState('starting');
    setErrorMessage('');

    // Fetch currently installed addons to pass to the server
    let installedAddons: InstalledAddonInfo[] = [];
    try {
      const addons = await stremioService.getInstalledAddonsAsync();
      installedAddons = addons.map((addon: Manifest) => ({
        id: addon.id,
        name: addon.name,
        version: addon.version,
        description: addon.description,
        logo: addon.logo,
        transportUrl: (addon as any).url || (addon as any).transport || '',
      }));
    } catch (error) {
      logger.error('[TVAddonInstall] Failed to fetch installed addons:', error);
    }

    const url = await tvAddonServerService.startServer(
      (payload: AddonInstallPayload) => {
        logger.info('[TVAddonInstall] Payload received:', {
          newAddons: payload.addons.length,
          finalOrder: payload.finalOrder
        });
        setReceivedPayload(payload);
        setState('received');
      },
      (error: string) => {
        logger.error('[TVAddonInstall] Server error:', error);
        setErrorMessage(error);
        setState('error');
      },
      installedAddons
    );

    if (url) {
      setServerUrl(url);
      setState('waiting');
    } else {
      setState('error');
      if (!errorMessage) {
        setErrorMessage('Failed to start addon server');
      }
    }
  }, [errorMessage]);

  const stopServer = useCallback(() => {
    tvAddonServerService.stopServer();
    setServerUrl(null);
    setReceivedPayload(null);
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

  const handleInstall = useCallback(async () => {
    if (!receivedPayload) return;

    // Check if there are new addons to install or just an order change
    const newAddons = receivedPayload.addons.filter(a => a.type !== 'installed');
    const hasNewAddons = newAddons.length > 0;
    const hasOrderChange = receivedPayload.finalOrder && receivedPayload.finalOrder.length > 0;

    if (!hasNewAddons && !hasOrderChange) return;

    setState('installing');
    const sortedAddons = [...newAddons].sort((a, b) => a.order - b.order);
    const completedAddons: string[] = [];
    const failedAddons: Array<{ name: string; error: string }> = [];
    const totalSteps = sortedAddons.length + (hasOrderChange ? 1 : 0);

    // Install new addons first
    for (let i = 0; i < sortedAddons.length; i++) {
      const addon = sortedAddons[i];

      setInstallProgress({
        current: i + 1,
        total: totalSteps,
        currentAddon: addon.manifest.name,
        completedAddons: [...completedAddons],
        failedAddons: [...failedAddons],
      });

      try {
        await stremioService.installAddon(addon.transportUrl);
        completedAddons.push(addon.manifest.name);
        logger.info(`[TVAddonInstall] Installed: ${addon.manifest.name}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        failedAddons.push({ name: addon.manifest.name, error: errorMsg });
        logger.error(`[TVAddonInstall] Failed to install ${addon.manifest.name}:`, error);
      }

      // Small delay for UI feedback
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Apply the final order if provided
    if (hasOrderChange) {
      setInstallProgress({
        current: totalSteps,
        total: totalSteps,
        currentAddon: 'Applying addon order...',
        completedAddons: [...completedAddons],
        failedAddons: [...failedAddons],
      });

      try {
        stremioService.setAddonOrder(receivedPayload.finalOrder);
        logger.info('[TVAddonInstall] Applied new addon order:', receivedPayload.finalOrder);
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        logger.error('[TVAddonInstall] Failed to apply addon order:', error);
      }
    }

    setInstallProgress({
      current: totalSteps,
      total: totalSteps,
      currentAddon: '',
      completedAddons,
      failedAddons,
    });

    tvAddonServerService.stopServer();

    if (hasNewAddons && failedAddons.length === sortedAddons.length) {
      setState('error');
      setErrorMessage('All addons failed to install');
    } else {
      setState('complete');
    }
  }, [receivedPayload]);

  const handleDone = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  useEffect(() => {
    startServer();
    return () => {
      tvAddonServerService.stopServer();
    };
  }, []);

  const renderContent = () => {
    switch (state) {
      case 'starting':
        return (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={currentTheme.colors.primary} />
            <Text style={[styles.statusText, { color: currentTheme.colors.highEmphasis }]}>
              Starting addon server...
            </Text>
          </View>
        );

      case 'waiting':
        return (
          <View style={styles.mainContent}>
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

            <View style={[styles.divider, { backgroundColor: currentTheme.colors.border }]} />

            <View style={styles.rightSection}>
              <MaterialIcons name="extension" size={60} color={currentTheme.colors.primary} />
              <Text style={[styles.title, { color: currentTheme.colors.highEmphasis }]}>
                Install Addons
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
                    Select addons from the list or add custom URLs
                  </Text>
                </View>
                <View style={styles.instructionItem}>
                  <Text style={[styles.instructionNumber, { backgroundColor: currentTheme.colors.primary }]}>3</Text>
                  <Text style={[styles.instructionItemText, { color: currentTheme.colors.mediumEmphasis }]}>
                    Reorder if needed, then tap Install
                  </Text>
                </View>
              </View>

              <View style={styles.waitingIndicator}>
                <ActivityIndicator size="small" color={currentTheme.colors.primary} />
                <Text style={[styles.waitingText, { color: currentTheme.colors.mediumEmphasis }]}>
                  Waiting for addon selection...
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
        const newAddonsCount = receivedPayload?.addons.filter(a => a.type !== 'installed').length || 0;
        const hasNewAddons = newAddonsCount > 0;
        const totalAddonsInOrder = receivedPayload?.finalOrder.length || 0;

        return (
          <View style={styles.mainContent}>
            <View style={styles.leftSection}>
              <MaterialIcons name="check-circle" size={80} color="#22c55e" />
              <Text style={[styles.receivedTitle, { color: currentTheme.colors.highEmphasis }]}>
                {hasNewAddons ? 'Changes Received!' : 'New Order Received!'}
              </Text>

              {receivedPayload && (
                <View style={[styles.infoCard, { backgroundColor: currentTheme.colors.elevation2 }]}>
                  {hasNewAddons && (
                    <>
                      <Text style={[styles.infoLabel, { color: currentTheme.colors.mediumEmphasis }]}>
                        New addons to install
                      </Text>
                      <Text style={[styles.infoValue, { color: currentTheme.colors.highEmphasis }]}>
                        {newAddonsCount}
                      </Text>
                    </>
                  )}
                  <Text style={[styles.infoLabel, { color: currentTheme.colors.mediumEmphasis, marginTop: hasNewAddons ? 12 : 0 }]}>
                    Total addons after applying
                  </Text>
                  <Text style={[styles.infoValue, { color: currentTheme.colors.highEmphasis }]}>
                    {totalAddonsInOrder}
                  </Text>
                </View>
              )}
            </View>

            <View style={[styles.divider, { backgroundColor: currentTheme.colors.border }]} />

            <View style={styles.rightSection}>
              <Text style={[styles.title, { color: currentTheme.colors.highEmphasis }]}>
                Final Addon Order
              </Text>

              <ScrollView style={styles.addonListContainer} contentContainerStyle={styles.addonListContent}>
                {receivedPayload?.finalOrder.map((addonId, index) => {
                  // Find addon info from addons array or use the ID
                  const addonInfo = receivedPayload.addons.find(a => a.manifest.id === addonId);
                  const isNew = addonInfo && addonInfo.type !== 'installed';

                  return (
                    <View key={addonId} style={[styles.addonItem, { backgroundColor: currentTheme.colors.elevation2 }]}>
                      <View style={[styles.orderBadge, { backgroundColor: isNew ? '#22c55e' : currentTheme.colors.primary }]}>
                        <Text style={styles.orderText}>{index + 1}</Text>
                      </View>
                      <View style={styles.addonItemInfo}>
                        <Text style={[styles.addonItemName, { color: currentTheme.colors.highEmphasis }]}>
                          {addonInfo?.manifest.name || addonId}
                        </Text>
                        <Text style={[styles.addonItemVersion, { color: currentTheme.colors.mediumEmphasis }]}>
                          {addonInfo ? `v${addonInfo.manifest.version}` : ''} {isNew ? '• NEW' : ''}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>

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
                  onPress={handleInstall}
                  style={[styles.actionButton, styles.primaryButton, { backgroundColor: currentTheme.colors.primary }]}
                  borderRadius={8}
                  focusScale={1}
                  animateBackground={true}
                  showFocusBorder={true}
                  autoFocus
                >
                  {(focused) => (
                    <View style={styles.buttonContent}>
                      <MaterialIcons name={hasNewAddons ? "download" : "check"} size={20} color={focused ? '#000' : '#fff'} />
                      <Text style={[styles.actionButtonText, styles.primaryButtonText, { color: focused ? '#000' : '#fff' }]}>
                        {hasNewAddons ? 'Install & Apply' : 'Apply Order'}
                      </Text>
                    </View>
                  )}
                </Focusable>
              </View>
            </View>
          </View>
        );

      case 'installing':
        return (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={currentTheme.colors.primary} />
            <Text style={[styles.statusText, { color: currentTheme.colors.highEmphasis }]}>
              {installProgress?.currentAddon === 'Applying addon order...' ? 'Applying changes...' : 'Installing addons...'}
            </Text>
            {installProgress && (
              <>
                <Text style={[styles.progressText, { color: currentTheme.colors.mediumEmphasis }]}>
                  {installProgress.current} of {installProgress.total}
                </Text>
                {installProgress.currentAddon && (
                  <Text style={[styles.currentAddonText, { color: currentTheme.colors.primary }]}>
                    {installProgress.currentAddon}
                  </Text>
                )}

                <View style={[styles.progressList, { backgroundColor: currentTheme.colors.elevation2 }]}>
                  {installProgress.completedAddons.map((name, i) => (
                    <View key={i} style={styles.progressItem}>
                      <MaterialIcons name="check-circle" size={18} color="#22c55e" />
                      <Text style={[styles.progressItemText, { color: currentTheme.colors.highEmphasis }]}>
                        {name}
                      </Text>
                    </View>
                  ))}
                  {installProgress.failedAddons.map((item, i) => (
                    <View key={`failed-${i}`} style={styles.progressItem}>
                      <MaterialIcons name="error" size={18} color="#ef4444" />
                      <Text style={[styles.progressItemText, { color: '#ef4444' }]}>
                        {item.name}
                      </Text>
                    </View>
                  ))}
                  {installProgress.currentAddon && (
                    <View style={styles.progressItem}>
                      <ActivityIndicator size={18} color={currentTheme.colors.primary} />
                      <Text style={[styles.progressItemText, { color: currentTheme.colors.mediumEmphasis }]}>
                        {installProgress.currentAddon}
                      </Text>
                    </View>
                  )}
                </View>
              </>
            )}
          </View>
        );

      case 'complete':
        const installedCount = installProgress?.completedAddons.length || 0;
        const hadNewInstalls = installedCount > 0;

        return (
          <View style={styles.centerContent}>
            <MaterialIcons name="check-circle" size={80} color="#22c55e" />
            <Text style={[styles.completeTitle, { color: currentTheme.colors.highEmphasis }]}>
              {hadNewInstalls ? 'Installation Complete!' : 'Order Applied!'}
            </Text>

            {installProgress && (
              <View style={styles.summaryContainer}>
                {hadNewInstalls && (
                  <Text style={[styles.summaryText, { color: currentTheme.colors.highEmphasis }]}>
                    {installedCount} addon{installedCount !== 1 ? 's' : ''} installed successfully
                  </Text>
                )}

                <Text style={[styles.summaryText, { color: currentTheme.colors.mediumEmphasis }]}>
                  Addon order has been updated
                </Text>

                {installProgress.failedAddons.length > 0 && (
                  <View style={[styles.failedContainer, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                    <Text style={[styles.failedTitle, { color: '#ef4444' }]}>
                      {installProgress.failedAddons.length} failed:
                    </Text>
                    {installProgress.failedAddons.map((item, i) => (
                      <Text key={i} style={[styles.failedItem, { color: '#ef4444' }]}>
                        • {item.name}: {item.error}
                      </Text>
                    ))}
                  </View>
                )}

                {hadNewInstalls && (
                  <View style={[styles.installedList, { backgroundColor: currentTheme.colors.elevation2 }]}>
                    {installProgress.completedAddons.map((name, i) => (
                      <View key={i} style={styles.installedItem}>
                        <MaterialIcons name="extension" size={18} color={currentTheme.colors.primary} />
                        <Text style={[styles.installedItemText, { color: currentTheme.colors.highEmphasis }]}>
                          {name}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            <Focusable
              onPress={handleDone}
              style={[styles.doneButton, { backgroundColor: currentTheme.colors.primary }]}
              borderRadius={8}
              focusScale={1}
              animateBackground={true}
              showFocusBorder={true}
              autoFocus
            >
              {(focused) => (
                <Text style={[styles.doneButtonText, { color: focused ? '#000' : '#fff' }]}>
                  Done
                </Text>
              )}
            </Focusable>
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
  progressText: {
    fontSize: 16,
    marginTop: 8,
  },
  currentAddonText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
  },
  progressList: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    width: '100%',
    maxWidth: 350,
  },
  progressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  progressItemText: {
    fontSize: 14,
    marginLeft: 12,
  },
  receivedTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 24,
  },
  infoCard: {
    padding: 24,
    borderRadius: 12,
    width: '100%',
    maxWidth: 300,
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  addonListContainer: {
    width: '100%',
    maxWidth: 400,
    maxHeight: 250,
  },
  addonListContent: {
    paddingBottom: 16,
  },
  addonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  orderBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  orderText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  addonItemInfo: {
    flex: 1,
  },
  addonItemName: {
    fontSize: 15,
    fontWeight: '600',
  },
  addonItemVersion: {
    fontSize: 12,
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 24,
  },
  actionButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    minWidth: 140,
    alignItems: 'center',
  },
  primaryButton: {},
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButtonText: {},
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  completeTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 16,
  },
  summaryContainer: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  summaryText: {
    fontSize: 16,
    marginBottom: 16,
  },
  failedContainer: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  failedTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  failedItem: {
    fontSize: 13,
    marginTop: 4,
  },
  installedList: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  installedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  installedItemText: {
    fontSize: 14,
    marginLeft: 12,
  },
  doneButton: {
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 8,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
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

export default TVAddonInstallScreen;
