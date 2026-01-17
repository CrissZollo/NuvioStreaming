import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Platform,
  TouchableOpacity,
  StatusBar,
  Switch,
  Alert,
  ActivityIndicator,
  Modal,
  Dimensions,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSettings } from '../hooks/useSettings';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import QRCode from 'react-native-qrcode-svg';
import { useTheme } from '../contexts/ThemeContext';
import { useIsTV } from '../contexts/TVContext';
import { Focusable, FocusableRef } from '../components/tv/Focusable';
import { debugService, DebugStats, SystemInfo } from '../services/debugService';
import { debugDownloadServerService } from '../services/debugDownloadServerService';

const ANDROID_STATUSBAR_HEIGHT = StatusBar.currentHeight || 0;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DebugSettingsScreen: React.FC = () => {
  const { settings, updateSetting } = useSettings();
  const { currentTheme } = useTheme();
  const navigation = useNavigation();
  const isTV = useIsTV();

  // State
  const [stats, setStats] = useState<DebugStats | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // QR Code modal state
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrServerUrl, setQrServerUrl] = useState<string | null>(null);
  const [isStartingServer, setIsStartingServer] = useState(false);

  // TV focus refs
  const backButtonRef = useRef<FocusableRef>(null);

  // Load stats and system info
  const loadData = useCallback(async () => {
    const debugStats = debugService.getStats();
    setStats(debugStats);

    const sysInfo = await debugService.collectSystemInfo();
    setSystemInfo(sysInfo);
  }, []);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Cleanup server when screen unmounts or modal closes
  useEffect(() => {
    return () => {
      if (debugDownloadServerService.getIsRunning()) {
        debugDownloadServerService.stopServer();
      }
    };
  }, []);

  // Handle toggle change
  const handleToggleDebug = async (enabled: boolean) => {
    await updateSetting('enableDebugLogging', enabled);
    await debugService.setEnabled(enabled);
    loadData();
  };

  // Handle export via share
  const handleExport = async () => {
    if (isExporting) return;

    setIsExporting(true);
    try {
      await debugService.exportAndShare();
    } catch (error) {
      Alert.alert(
        'Export Failed',
        error instanceof Error ? error.message : 'Failed to export debug report'
      );
    } finally {
      setIsExporting(false);
    }
  };

  // Handle QR code export
  const handleShowQRCode = async () => {
    if (isStartingServer) return;

    setIsStartingServer(true);
    try {
      const serverUrl = await debugDownloadServerService.startServer();
      if (serverUrl) {
        setQrServerUrl(serverUrl);
        setShowQRModal(true);
      } else {
        Alert.alert(
          'Connection Error',
          'Could not start download server. Make sure you are connected to WiFi.'
        );
      }
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to start download server'
      );
    } finally {
      setIsStartingServer(false);
    }
  };

  // Close QR modal and stop server
  const handleCloseQRModal = () => {
    setShowQRModal(false);
    setQrServerUrl(null);
    debugDownloadServerService.stopServer();
  };

  // Handle clear logs
  const handleClearLogs = () => {
    Alert.alert(
      'Clear Debug Logs',
      'Are you sure you want to delete all debug logs and crash reports? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            setIsClearing(true);
            try {
              await debugService.clearAll();
              loadData();
            } catch (error) {
              Alert.alert('Error', 'Failed to clear logs');
            } finally {
              setIsClearing(false);
            }
          },
        },
      ]
    );
  };

  const handleBack = () => {
    navigation.goBack();
  };

  // Format date
  const formatDate = (timestamp: number | null): string => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  };

  // Format file size
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const renderSwitch = (value: boolean, onValueChange: (val: boolean) => void, focused: boolean = false) => {
    if (isTV) {
      return (
        <View style={styles.tvSwitchContainer}>
          <View style={[
            styles.tvSwitchTrack,
            { backgroundColor: focused ? (value ? '#333' : '#666') : (value ? currentTheme.colors.primary : 'rgba(255,255,255,0.2)') }
          ]}>
            <View style={[
              styles.tvSwitchThumb,
              value ? styles.tvSwitchThumbOn : styles.tvSwitchThumbOff,
              { backgroundColor: focused ? '#000' : (value ? '#fff' : '#888') }
            ]} />
          </View>
        </View>
      );
    }
    return (
      <Switch
        value={value}
        onValueChange={onValueChange}
        thumbColor={value ? currentTheme.colors.primary : undefined}
      />
    );
  };

  // Render QR Code Modal
  const renderQRModal = () => (
    <Modal
      visible={showQRModal}
      transparent
      animationType="fade"
      onRequestClose={handleCloseQRModal}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={handleCloseQRModal}
      >
        <View
          style={[styles.qrModalContent, { backgroundColor: currentTheme.colors.elevation2 }]}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.qrModalHeader}>
            <Text style={[styles.qrModalTitle, { color: currentTheme.colors.text }]}>
              Scan to Download
            </Text>
            <TouchableOpacity onPress={handleCloseQRModal} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color={currentTheme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.qrModalSubtitle, { color: currentTheme.colors.textMuted }]}>
            Scan this QR code with your phone to download the debug report
          </Text>

          {qrServerUrl && (
            <View style={styles.qrCodeWrapper}>
              <View style={styles.qrCodeContainer}>
                <QRCode
                  value={qrServerUrl}
                  size={Math.min(SCREEN_WIDTH * 0.5, 200)}
                  backgroundColor="white"
                  color="black"
                />
              </View>
            </View>
          )}

          <Text style={[styles.qrUrlText, { color: currentTheme.colors.textMuted }]}>
            Or visit this URL:
          </Text>
          <Text style={[styles.qrUrl, { color: currentTheme.colors.primary }]}>
            {qrServerUrl}
          </Text>

          <View style={styles.qrInfoContainer}>
            <MaterialIcons name="info-outline" size={16} color={currentTheme.colors.textMuted} />
            <Text style={[styles.qrInfoText, { color: currentTheme.colors.textMuted }]}>
              Make sure your phone is on the same WiFi network as this device.
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: currentTheme.colors.darkBackground },
      ]}
    >
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />

      <View style={styles.header}>
        {isTV ? (
          <Focusable
            ref={backButtonRef}
            onPress={handleBack}
            style={styles.backButton}
            autoFocus
            borderRadius={8}
            focusScale={1.05}
            animateBackground={true}
            showFocusBorder={true}
          >
            {(focused) => (
              <>
                <MaterialIcons
                  name="arrow-back"
                  size={24}
                  color={focused ? '#000' : currentTheme.colors.text}
                />
                <Text style={[styles.backText, { color: focused ? '#000' : currentTheme.colors.text }]}>
                  Settings
                </Text>
              </>
            )}
          </Focusable>
        ) : (
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name="arrow-back"
              size={24}
              color={currentTheme.colors.text}
            />
            <Text style={[styles.backText, { color: currentTheme.colors.text }]}>
              Settings
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={[styles.headerTitle, { color: currentTheme.colors.text }]}>
        Debug
      </Text>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Debug Logging Toggle Section */}
        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              { color: currentTheme.colors.textMuted },
            ]}
          >
            DEBUG LOGGING
          </Text>
          <View
            style={[
              styles.card,
              { backgroundColor: currentTheme.colors.elevation2 },
            ]}
          >
            {isTV ? (
              <Focusable
                onPress={() => handleToggleDebug(!settings.enableDebugLogging)}
                style={styles.settingItem}
                borderRadius={0}
                focusScale={1}
                animateBackground={true}
                showFocusBorder={true}
              >
                {(focused) => (
                  <View style={styles.settingContent}>
                    <View style={[
                      styles.settingIconContainer,
                      { backgroundColor: focused ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.1)' }
                    ]}>
                      <MaterialIcons
                        name="bug-report"
                        size={20}
                        color={focused ? '#000' : currentTheme.colors.primary}
                      />
                    </View>
                    <View style={styles.settingText}>
                      <Text
                        style={[
                          styles.settingTitle,
                          { color: focused ? '#000' : currentTheme.colors.text },
                        ]}
                      >
                        Enable Debug Logging
                      </Text>
                      <Text
                        style={[
                          styles.settingDescription,
                          { color: focused ? '#333' : currentTheme.colors.textMuted },
                        ]}
                      >
                        Collect logs and crash reports for troubleshooting
                      </Text>
                    </View>
                    {renderSwitch(settings.enableDebugLogging, handleToggleDebug, focused)}
                  </View>
                )}
              </Focusable>
            ) : (
              <View style={styles.settingItem}>
                <View style={styles.settingContent}>
                  <View style={[
                    styles.settingIconContainer,
                    { backgroundColor: 'rgba(255,255,255,0.1)' }
                  ]}>
                    <MaterialIcons
                      name="bug-report"
                      size={20}
                      color={currentTheme.colors.primary}
                    />
                  </View>
                  <View style={styles.settingText}>
                    <Text
                      style={[
                        styles.settingTitle,
                        { color: currentTheme.colors.text },
                      ]}
                    >
                      Enable Debug Logging
                    </Text>
                    <Text
                      style={[
                        styles.settingDescription,
                        { color: currentTheme.colors.textMuted },
                      ]}
                    >
                      Collect logs and crash reports for troubleshooting
                    </Text>
                  </View>
                  {renderSwitch(settings.enableDebugLogging, handleToggleDebug)}
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Log Statistics Section */}
        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              { color: currentTheme.colors.textMuted },
            ]}
          >
            LOG STATISTICS
          </Text>
          <View
            style={[
              styles.card,
              { backgroundColor: currentTheme.colors.elevation2 },
            ]}
          >
            <View style={[styles.statsRow, styles.statsRowBorder, { borderBottomColor: 'rgba(255,255,255,0.08)' }]}>
              <Text style={[styles.statsLabel, { color: currentTheme.colors.textMuted }]}>
                Log Entries
              </Text>
              <Text style={[styles.statsValue, { color: currentTheme.colors.text }]}>
                {stats?.logCount ?? 0}
              </Text>
            </View>
            <View style={[styles.statsRow, styles.statsRowBorder, { borderBottomColor: 'rgba(255,255,255,0.08)' }]}>
              <Text style={[styles.statsLabel, { color: currentTheme.colors.textMuted }]}>
                Crash Reports
              </Text>
              <Text style={[styles.statsValue, { color: currentTheme.colors.text }]}>
                {stats?.crashCount ?? 0}
              </Text>
            </View>
            <View style={[styles.statsRow, styles.statsRowBorder, { borderBottomColor: 'rgba(255,255,255,0.08)' }]}>
              <Text style={[styles.statsLabel, { color: currentTheme.colors.textMuted }]}>
                Storage Used
              </Text>
              <Text style={[styles.statsValue, { color: currentTheme.colors.text }]}>
                {stats ? formatSize(stats.storageSizeBytes) : '0 B'}
              </Text>
            </View>
            <View style={[styles.statsRow, styles.statsRowBorder, { borderBottomColor: 'rgba(255,255,255,0.08)' }]}>
              <Text style={[styles.statsLabel, { color: currentTheme.colors.textMuted }]}>
                Oldest Entry
              </Text>
              <Text style={[styles.statsValue, { color: currentTheme.colors.text }]}>
                {formatDate(stats?.oldestLog ?? null)}
              </Text>
            </View>
            <View style={styles.statsRow}>
              <Text style={[styles.statsLabel, { color: currentTheme.colors.textMuted }]}>
                Newest Entry
              </Text>
              <Text style={[styles.statsValue, { color: currentTheme.colors.text }]}>
                {formatDate(stats?.newestLog ?? null)}
              </Text>
            </View>
          </View>
        </View>

        {/* Actions Section */}
        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              { color: currentTheme.colors.textMuted },
            ]}
          >
            EXPORT OPTIONS
          </Text>
          <View
            style={[
              styles.card,
              { backgroundColor: currentTheme.colors.elevation2 },
            ]}
          >
            {isTV ? (
              <>
                {/* QR Code option - especially useful for TV */}
                <Focusable
                  onPress={handleShowQRCode}
                  style={[styles.settingItem, styles.settingItemBorder, { borderBottomColor: 'rgba(255,255,255,0.08)' }]}
                  borderRadius={0}
                  focusScale={1.02}
                  animateBackground={true}
                  showFocusBorder={true}
                >
                  {(focused) => (
                    <View style={styles.settingContent}>
                      <View style={[
                        styles.settingIconContainer,
                        { backgroundColor: focused ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.1)' }
                      ]}>
                        {isStartingServer ? (
                          <ActivityIndicator size="small" color={focused ? '#000' : currentTheme.colors.primary} />
                        ) : (
                          <MaterialIcons
                            name="qr-code"
                            size={20}
                            color={focused ? '#000' : currentTheme.colors.primary}
                          />
                        )}
                      </View>
                      <View style={styles.settingText}>
                        <Text
                          style={[
                            styles.settingTitle,
                            { color: focused ? '#000' : currentTheme.colors.text },
                          ]}
                        >
                          Download via QR Code
                        </Text>
                        <Text
                          style={[
                            styles.settingDescription,
                            { color: focused ? '#333' : currentTheme.colors.textMuted },
                          ]}
                        >
                          Scan with your phone to download the report
                        </Text>
                      </View>
                      <MaterialIcons
                        name="chevron-right"
                        size={24}
                        color={focused ? '#000' : currentTheme.colors.textMuted}
                      />
                    </View>
                  )}
                </Focusable>
                <Focusable
                  onPress={handleExport}
                  style={styles.settingItem}
                  borderRadius={0}
                  focusScale={1.02}
                  animateBackground={true}
                  showFocusBorder={true}
                >
                  {(focused) => (
                    <View style={styles.settingContent}>
                      <View style={[
                        styles.settingIconContainer,
                        { backgroundColor: focused ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.1)' }
                      ]}>
                        {isExporting ? (
                          <ActivityIndicator size="small" color={focused ? '#000' : currentTheme.colors.primary} />
                        ) : (
                          <MaterialIcons
                            name="share"
                            size={20}
                            color={focused ? '#000' : currentTheme.colors.primary}
                          />
                        )}
                      </View>
                      <View style={styles.settingText}>
                        <Text
                          style={[
                            styles.settingTitle,
                            { color: focused ? '#000' : currentTheme.colors.text },
                          ]}
                        >
                          Share Debug Report
                        </Text>
                        <Text
                          style={[
                            styles.settingDescription,
                            { color: focused ? '#333' : currentTheme.colors.textMuted },
                          ]}
                        >
                          Export and share via system share sheet
                        </Text>
                      </View>
                      <MaterialIcons
                        name="chevron-right"
                        size={24}
                        color={focused ? '#000' : currentTheme.colors.textMuted}
                      />
                    </View>
                  )}
                </Focusable>
              </>
            ) : (
              <>
                {/* QR Code option */}
                <TouchableOpacity
                  onPress={handleShowQRCode}
                  activeOpacity={0.7}
                  style={[styles.settingItem, styles.settingItemBorder, { borderBottomColor: 'rgba(255,255,255,0.08)' }]}
                  disabled={isStartingServer}
                >
                  <View style={styles.settingContent}>
                    <View style={[
                      styles.settingIconContainer,
                      { backgroundColor: 'rgba(255,255,255,0.1)' }
                    ]}>
                      {isStartingServer ? (
                        <ActivityIndicator size="small" color={currentTheme.colors.primary} />
                      ) : (
                        <MaterialIcons
                          name="qr-code"
                          size={20}
                          color={currentTheme.colors.primary}
                        />
                      )}
                    </View>
                    <View style={styles.settingText}>
                      <Text
                        style={[
                          styles.settingTitle,
                          { color: currentTheme.colors.text },
                        ]}
                      >
                        Download via QR Code
                      </Text>
                      <Text
                        style={[
                          styles.settingDescription,
                          { color: currentTheme.colors.textMuted },
                        ]}
                      >
                        Scan with another device to download
                      </Text>
                    </View>
                    <MaterialIcons
                      name="chevron-right"
                      size={24}
                      color={currentTheme.colors.textMuted}
                    />
                  </View>
                </TouchableOpacity>
                {/* Share option */}
                <TouchableOpacity
                  onPress={handleExport}
                  activeOpacity={0.7}
                  style={styles.settingItem}
                  disabled={isExporting}
                >
                  <View style={styles.settingContent}>
                    <View style={[
                      styles.settingIconContainer,
                      { backgroundColor: 'rgba(255,255,255,0.1)' }
                    ]}>
                      {isExporting ? (
                        <ActivityIndicator size="small" color={currentTheme.colors.primary} />
                      ) : (
                        <MaterialIcons
                          name="share"
                          size={20}
                          color={currentTheme.colors.primary}
                        />
                      )}
                    </View>
                    <View style={styles.settingText}>
                      <Text
                        style={[
                          styles.settingTitle,
                          { color: currentTheme.colors.text },
                        ]}
                      >
                        Share Debug Report
                      </Text>
                      <Text
                        style={[
                          styles.settingDescription,
                          { color: currentTheme.colors.textMuted },
                        ]}
                      >
                        Export and share via system share sheet
                      </Text>
                    </View>
                    <MaterialIcons
                      name="chevron-right"
                      size={24}
                      color={currentTheme.colors.textMuted}
                    />
                  </View>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Manage Section */}
        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              { color: currentTheme.colors.textMuted },
            ]}
          >
            MANAGE
          </Text>
          <View
            style={[
              styles.card,
              { backgroundColor: currentTheme.colors.elevation2 },
            ]}
          >
            {isTV ? (
              <Focusable
                onPress={handleClearLogs}
                style={styles.settingItem}
                borderRadius={0}
                focusScale={1.02}
                animateBackground={true}
                showFocusBorder={true}
              >
                {(focused) => (
                  <View style={styles.settingContent}>
                    <View style={[
                      styles.settingIconContainer,
                      { backgroundColor: focused ? 'rgba(0,0,0,0.2)' : 'rgba(255,100,100,0.1)' }
                    ]}>
                      {isClearing ? (
                        <ActivityIndicator size="small" color={focused ? '#000' : '#ff6b6b'} />
                      ) : (
                        <MaterialIcons
                          name="delete-outline"
                          size={20}
                          color={focused ? '#000' : '#ff6b6b'}
                        />
                      )}
                    </View>
                    <View style={styles.settingText}>
                      <Text
                        style={[
                          styles.settingTitle,
                          { color: focused ? '#000' : currentTheme.colors.text },
                        ]}
                      >
                        Clear All Logs
                      </Text>
                      <Text
                        style={[
                          styles.settingDescription,
                          { color: focused ? '#333' : currentTheme.colors.textMuted },
                        ]}
                      >
                        Delete all debug logs and crash reports
                      </Text>
                    </View>
                    <MaterialIcons
                      name="chevron-right"
                      size={24}
                      color={focused ? '#000' : currentTheme.colors.textMuted}
                    />
                  </View>
                )}
              </Focusable>
            ) : (
              <TouchableOpacity
                onPress={handleClearLogs}
                activeOpacity={0.7}
                style={styles.settingItem}
                disabled={isClearing}
              >
                <View style={styles.settingContent}>
                  <View style={[
                    styles.settingIconContainer,
                    { backgroundColor: 'rgba(255,100,100,0.1)' }
                  ]}>
                    {isClearing ? (
                      <ActivityIndicator size="small" color="#ff6b6b" />
                    ) : (
                      <MaterialIcons
                        name="delete-outline"
                        size={20}
                        color="#ff6b6b"
                      />
                    )}
                  </View>
                  <View style={styles.settingText}>
                    <Text
                      style={[
                        styles.settingTitle,
                        { color: currentTheme.colors.text },
                      ]}
                    >
                      Clear All Logs
                    </Text>
                    <Text
                      style={[
                        styles.settingDescription,
                        { color: currentTheme.colors.textMuted },
                      ]}
                    >
                      Delete all debug logs and crash reports
                    </Text>
                  </View>
                  <MaterialIcons
                    name="chevron-right"
                    size={24}
                    color={currentTheme.colors.textMuted}
                  />
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* System Information Section */}
        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              { color: currentTheme.colors.textMuted },
            ]}
          >
            SYSTEM INFORMATION
          </Text>
          <View
            style={[
              styles.card,
              { backgroundColor: currentTheme.colors.elevation2 },
            ]}
          >
            <View style={[styles.statsRow, styles.statsRowBorder, { borderBottomColor: 'rgba(255,255,255,0.08)' }]}>
              <Text style={[styles.statsLabel, { color: currentTheme.colors.textMuted }]}>
                App Version
              </Text>
              <Text style={[styles.statsValue, { color: currentTheme.colors.text }]}>
                {systemInfo?.appVersion ?? 'N/A'}
              </Text>
            </View>
            <View style={[styles.statsRow, styles.statsRowBorder, { borderBottomColor: 'rgba(255,255,255,0.08)' }]}>
              <Text style={[styles.statsLabel, { color: currentTheme.colors.textMuted }]}>
                Build
              </Text>
              <Text style={[styles.statsValue, { color: currentTheme.colors.text }]}>
                {systemInfo?.buildVersion ?? 'N/A'}
              </Text>
            </View>
            <View style={[styles.statsRow, styles.statsRowBorder, { borderBottomColor: 'rgba(255,255,255,0.08)' }]}>
              <Text style={[styles.statsLabel, { color: currentTheme.colors.textMuted }]}>
                Platform
              </Text>
              <Text style={[styles.statsValue, { color: currentTheme.colors.text }]}>
                {systemInfo ? `${systemInfo.platform.toUpperCase()} ${systemInfo.osVersion}` : 'N/A'}
              </Text>
            </View>
            <View style={[styles.statsRow, styles.statsRowBorder, { borderBottomColor: 'rgba(255,255,255,0.08)' }]}>
              <Text style={[styles.statsLabel, { color: currentTheme.colors.textMuted }]}>
                Device
              </Text>
              <Text style={[styles.statsValue, { color: currentTheme.colors.text }]}>
                {systemInfo?.deviceModel ?? 'N/A'}
              </Text>
            </View>
            <View style={[styles.statsRow, styles.statsRowBorder, { borderBottomColor: 'rgba(255,255,255,0.08)' }]}>
              <Text style={[styles.statsLabel, { color: currentTheme.colors.textMuted }]}>
                Screen
              </Text>
              <Text style={[styles.statsValue, { color: currentTheme.colors.text }]}>
                {systemInfo ? `${Math.round(systemInfo.screenWidth)}x${Math.round(systemInfo.screenHeight)} @${systemInfo.pixelRatio}x` : 'N/A'}
              </Text>
            </View>
            <View style={[styles.statsRow, styles.statsRowBorder, { borderBottomColor: 'rgba(255,255,255,0.08)' }]}>
              <Text style={[styles.statsLabel, { color: currentTheme.colors.textMuted }]}>
                JS Engine
              </Text>
              <Text style={[styles.statsValue, { color: currentTheme.colors.text }]}>
                {systemInfo?.jsEngine ?? 'N/A'}
              </Text>
            </View>
            <View style={styles.statsRow}>
              <Text style={[styles.statsLabel, { color: currentTheme.colors.textMuted }]}>
                TV Mode
              </Text>
              <Text style={[styles.statsValue, { color: currentTheme.colors.text }]}>
                {systemInfo?.isTV ? 'Yes' : 'No'}
              </Text>
            </View>
          </View>
        </View>

        {/* Info text */}
        <View style={styles.infoContainer}>
          <MaterialIcons
            name="info-outline"
            size={16}
            color={currentTheme.colors.textMuted}
          />
          <Text style={[styles.infoText, { color: currentTheme.colors.textMuted }]}>
            Debug logs are stored locally and automatically deleted after 7 days.
            Share the debug report with the developer to help troubleshoot issues.
          </Text>
        </View>
      </ScrollView>

      {/* QR Code Modal */}
      {renderQRModal()}
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
    paddingTop: Platform.OS === 'android' ? ANDROID_STATUSBAR_HEIGHT + 8 : 8,
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
  headerTitle: {
    fontSize: 34,
    fontWeight: 'bold',
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    paddingHorizontal: 4,
    letterSpacing: 0.5,
  },
  card: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
    shadowColor: 'rgba(0,0,0,0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 3,
  },
  settingItem: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  settingItemBorder: {
    borderBottomWidth: 1,
  },
  settingContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 14,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  statsRowBorder: {
    borderBottomWidth: 1,
  },
  statsLabel: {
    fontSize: 15,
  },
  statsValue: {
    fontSize: 15,
    fontWeight: '500',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  // TV Toggle styles
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
  // QR Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  qrModalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  qrModalHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  qrModalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  qrModalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  qrCodeWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  qrCodeContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
  },
  qrUrlText: {
    fontSize: 13,
    marginBottom: 4,
  },
  qrUrl: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 20,
  },
  qrInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  qrInfoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
});

export default DebugSettingsScreen;
