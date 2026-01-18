import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Platform,
  Linking,
  Switch,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { makeRedirectUri, useAuthRequest, ResponseType, Prompt, CodeChallengeMethod } from 'expo-auth-session';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import FastImage from '@d11/react-native-fast-image';
import QRCode from 'react-native-qrcode-svg';
import { traktService, TraktUser } from '../services/traktService';
import { useSettings } from '../hooks/useSettings';
import { logger } from '../utils/logger';
import TraktIcon from '../../assets/rating-icons/trakt.svg';
import { useTheme } from '../contexts/ThemeContext';
import { useIsTV } from '../contexts/TVContext';
import { Focusable } from '../components/tv/Focusable';
import { useTraktIntegration } from '../hooks/useTraktIntegration';
import { useTraktAutosyncSettings } from '../hooks/useTraktAutosyncSettings';
import { colors } from '../styles';
import CustomAlert from '../components/CustomAlert';

const ANDROID_STATUSBAR_HEIGHT = StatusBar.currentHeight || 0;

// Trakt configuration
const TRAKT_CLIENT_ID = process.env.EXPO_PUBLIC_TRAKT_CLIENT_ID as string;

if (!TRAKT_CLIENT_ID) {
  throw new Error('Missing EXPO_PUBLIC_TRAKT_CLIENT_ID environment variable');
}
const discovery = {
  authorizationEndpoint: 'https://trakt.tv/oauth/authorize',
  tokenEndpoint: 'https://api.trakt.tv/oauth/token',
};

// For use with deep linking
const redirectUri = makeRedirectUri({
  scheme: 'nuvio',
  path: 'auth/trakt',
});

const TraktSettingsScreen: React.FC = () => {
  const { settings, updateSetting } = useSettings();
  const isDarkMode = settings.enableDarkMode;
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userProfile, setUserProfile] = useState<TraktUser | null>(null);
  const { currentTheme } = useTheme();
  const isTV = useIsTV();
  
  const {
    settings: autosyncSettings,
    isSyncing,
    setAutosyncEnabled,
    performManualSync
  } = useTraktAutosyncSettings();

  const {
    isLoading: traktLoading,
    refreshAuthStatus
  } = useTraktIntegration();

  const [showSyncFrequencyModal, setShowSyncFrequencyModal] = useState(false);
  const [showThresholdModal, setShowThresholdModal] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertActions, setAlertActions] = useState<Array<{ label: string; onPress: () => void; style?: object }>>([
    { label: 'OK', onPress: () => setAlertVisible(false) },
  ]);

  // TV Device Code Auth State
  const [showQRModal, setShowQRModal] = useState(false);
  const [deviceCode, setDeviceCode] = useState<string | null>(null);
  const [userCode, setUserCode] = useState<string | null>(null);
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [deviceCodeExpiry, setDeviceCodeExpiry] = useState<number>(0);
  const [pollInterval, setPollInterval] = useState<number>(5);
  const [isPolling, setIsPolling] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const expiryRef = useRef<NodeJS.Timeout | null>(null);

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

  const checkAuthStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const authenticated = await traktService.isAuthenticated();
      setIsAuthenticated(authenticated);
      
      if (authenticated) {
        const profile = await traktService.getUserProfile();
        setUserProfile(profile);
      } else {
        setUserProfile(null);
      }
    } catch (error) {
      logger.error('[TraktSettingsScreen] Error checking auth status:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  // Setup expo-auth-session hook with PKCE
  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: TRAKT_CLIENT_ID,
      scopes: [],
      redirectUri: redirectUri,
      responseType: ResponseType.Code,
      usePKCE: true,
      codeChallengeMethod: CodeChallengeMethod.S256,
    },
    discovery
  );

  const [isExchangingCode, setIsExchangingCode] = useState(false);

  // Handle the response from the auth request
  useEffect(() => {
    if (response) {
      setIsExchangingCode(true);
      if (response.type === 'success' && request?.codeVerifier) {
        const { code } = response.params;
        logger.log('[TraktSettingsScreen] Auth code received:', code);
        traktService.exchangeCodeForToken(code, request.codeVerifier)
          .then(success => {
            if (success) {
              logger.log('[TraktSettingsScreen] Token exchange successful');
              checkAuthStatus().then(() => {
                // Show success message
                openAlert(
                  'Successfully Connected',
                  'Your Trakt account has been connected successfully.',
                  [
                    { 
                      label: 'OK', 
                      onPress: () => navigation.goBack(),
                    }
                  ]
                );
              });
            } else {
              logger.error('[TraktSettingsScreen] Token exchange failed');
              openAlert('Authentication Error', 'Failed to complete authentication with Trakt.');
            }
          })
          .catch(error => {
            logger.error('[TraktSettingsScreen] Token exchange error:', error);
            openAlert('Authentication Error', 'An error occurred during authentication.');
          })
          .finally(() => {
            setIsExchangingCode(false);
          });
      } else if (response.type === 'error') {
        logger.error('[TraktSettingsScreen] Authentication error:', response.error);
        openAlert('Authentication Error', response.error?.message || 'An error occurred during authentication.');
        setIsExchangingCode(false);
      } else {
        logger.log('[TraktSettingsScreen] Auth response type:', response.type);
        setIsExchangingCode(false);
      }
    }
  }, [response, checkAuthStatus, request?.codeVerifier, navigation]);

  const handleSignIn = () => {
    promptAsync(); // Trigger the authentication flow
  };

  // TV Device Code Flow
  const startDeviceCodeFlow = async () => {
    try {
      const codeData = await traktService.getDeviceCode();
      if (!codeData) {
        openAlert('Error', 'Failed to start authentication. Please try again.');
        return;
      }

      setDeviceCode(codeData.device_code);
      setUserCode(codeData.user_code);
      setVerificationUrl(codeData.verification_url);
      // Create URL with user code for QR scanning
      setQrCodeUrl(`${codeData.verification_url}/${codeData.user_code}`);
      setDeviceCodeExpiry(codeData.expires_in);
      setPollInterval(codeData.interval);
      setShowQRModal(true);
      setIsPolling(true);

      // Start polling for authorization
      startPolling(codeData.device_code, codeData.interval);

      // Set expiry timeout
      expiryRef.current = setTimeout(() => {
        stopPolling();
        setShowQRModal(false);
        openAlert('Code Expired', 'The authentication code has expired. Please try again.');
      }, codeData.expires_in * 1000);

    } catch (error) {
      logger.error('[TraktSettingsScreen] Device code flow error:', error);
      openAlert('Error', 'Failed to start authentication. Please try again.');
    }
  };

  const startPolling = (code: string, interval: number) => {
    pollingRef.current = setInterval(async () => {
      const result = await traktService.pollDeviceCode(code);

      if (result === 'success') {
        stopPolling();
        setShowQRModal(false);
        await checkAuthStatus();
        openAlert(
          'Successfully Connected',
          'Your Trakt account has been connected successfully.',
          [{ label: 'OK', onPress: () => {} }]
        );
      } else if (result === 'expired') {
        stopPolling();
        setShowQRModal(false);
        openAlert('Code Expired', 'The authentication code has expired. Please try again.');
      } else if (result === 'error') {
        stopPolling();
        setShowQRModal(false);
        openAlert('Authentication Failed', 'Failed to authenticate with Trakt. Please try again.');
      }
      // 'pending' continues polling
    }, interval * 1000);
  };

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (expiryRef.current) {
      clearTimeout(expiryRef.current);
      expiryRef.current = null;
    }
    setIsPolling(false);
  };

  const handleCancelQRAuth = () => {
    stopPolling();
    setShowQRModal(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  const handleSignOut = async () => {
    openAlert(
      'Sign Out',
      'Are you sure you want to sign out of your Trakt account?',
      [
        { label: 'Cancel', onPress: () => {} },
        { 
          label: 'Sign Out', 
          onPress: async () => {
            setIsLoading(true);
            try {
              await traktService.logout();
              setIsAuthenticated(false);
              setUserProfile(null);
              // Refresh auth status in the integration hook to ensure UI consistency
              await refreshAuthStatus();
            } catch (error) {
              logger.error('[TraktSettingsScreen] Error signing out:', error);
              openAlert('Error', 'Failed to sign out of Trakt.');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={[
      styles.container,
      { backgroundColor: isDarkMode ? currentTheme.colors.darkBackground : '#F2F2F7' }
    ]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        {isTV ? (
          <Focusable
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            borderRadius={8}
            focusScale={1}
            animateBackground={false}
            showFocusBorder={true}
          >
            {(focused) => (
              <>
                <MaterialIcons
                  name="arrow-back"
                  size={24}
                  color={isDarkMode ? currentTheme.colors.highEmphasis : currentTheme.colors.textDark}
                />
                <Text style={[styles.backText, { color: isDarkMode ? currentTheme.colors.highEmphasis : currentTheme.colors.textDark }]}>
                  Settings
                </Text>
              </>
            )}
          </Focusable>
        ) : (
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <MaterialIcons
              name="arrow-back"
              size={24}
              color={isDarkMode ? currentTheme.colors.highEmphasis : currentTheme.colors.textDark}
            />
            <Text style={[styles.backText, { color: isDarkMode ? currentTheme.colors.highEmphasis : currentTheme.colors.textDark }]}>
              Settings
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.headerActions}>
          {/* Empty for now, but ready for future actions */}
        </View>
      </View>
      
      <Text style={[styles.headerTitle, { color: isDarkMode ? currentTheme.colors.highEmphasis : currentTheme.colors.textDark }]}>
        Trakt Settings
      </Text>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={[
          styles.card,
          { backgroundColor: currentTheme.colors.elevation2 }
        ]}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={currentTheme.colors.primary} />
            </View>
          ) : isAuthenticated && userProfile ? (
            <View style={styles.profileContainer}>
              <View style={styles.profileHeader}>
                {userProfile.avatar ? (
                  <FastImage 
                    source={{ uri: userProfile.avatar }} 
                    style={styles.avatar}
                    resizeMode={FastImage.resizeMode.cover}
                  />
                ) : (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: currentTheme.colors.primary }]}>
                    <Text style={styles.avatarText}>
                      {userProfile.name?.charAt(0) || userProfile.username.charAt(0)}
                    </Text>
                  </View>
                )}
                <View style={styles.profileInfo}>
                  <Text style={[
                    styles.profileName,
                    { color: isDarkMode ? currentTheme.colors.highEmphasis : currentTheme.colors.textDark }
                  ]}>
                    {userProfile.name || userProfile.username}
                  </Text>
                  <Text style={[
                    styles.profileUsername,
                    { color: isDarkMode ? currentTheme.colors.mediumEmphasis : currentTheme.colors.textMutedDark }
                  ]}>
                    @{userProfile.username}
                  </Text>
                  {userProfile.vip && (
                    <View style={styles.vipBadge}>
                      <MaterialIcons name="star" size={14} color="#FFF" />
                      <Text style={styles.vipText}>VIP</Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.statsContainer}>
                <Text style={[
                  styles.joinedDate,
                  { color: isDarkMode ? currentTheme.colors.mediumEmphasis : currentTheme.colors.textMutedDark }
                ]}>
                  Joined {new Date(userProfile.joined_at).toLocaleDateString()}
                </Text>
              </View>

              {isTV ? (
                <Focusable
                  onPress={handleSignOut}
                  style={[
                    styles.button,
                    styles.signOutButton,
                    { backgroundColor: currentTheme.colors.error }
                  ]}
                  borderRadius={8}
                  focusScale={1}
                  animateBackground={false}
                  showFocusBorder={true}
                >
                  {(focused) => (
                    <Text style={styles.buttonText}>Sign Out</Text>
                  )}
                </Focusable>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.signOutButton,
                    { backgroundColor: currentTheme.colors.error }
                  ]}
                  onPress={handleSignOut}
                >
                  <Text style={styles.buttonText}>Sign Out</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.signInContainer}>
              <TraktIcon 
                width={120}
                height={120}
                style={styles.traktLogo}
              />
              <Text style={[
                styles.signInTitle,
                { color: isDarkMode ? currentTheme.colors.highEmphasis : currentTheme.colors.textDark }
              ]}>
                Connect with Trakt
              </Text>
              <Text style={[
                styles.signInDescription,
                { color: isDarkMode ? currentTheme.colors.mediumEmphasis : currentTheme.colors.textMutedDark }
              ]}>
                Sync your watch history, watchlist, and collection with Trakt.tv
              </Text>
              {isTV ? (
                <Focusable
                  onPress={startDeviceCodeFlow}
                  style={[
                    styles.button,
                    { backgroundColor: currentTheme.colors.primary, opacity: isPolling ? 0.6 : 1 }
                  ]}
                  borderRadius={8}
                  focusScale={1}
                  animateBackground={false}
                  showFocusBorder={true}
                >
                  {(focused) => (
                    isPolling ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text style={styles.buttonText}>
                        Sign In with Trakt
                      </Text>
                    )
                  )}
                </Focusable>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.button,
                    { backgroundColor: currentTheme.colors.primary }
                  ]}
                  onPress={handleSignIn}
                  disabled={!request || isExchangingCode}
                >
                  {isExchangingCode ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text style={styles.buttonText}>
                      Sign In with Trakt
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {isAuthenticated && (
          <View style={[
            styles.card,
            { backgroundColor: isDarkMode ? currentTheme.colors.elevation2 : currentTheme.colors.white }
          ]}>
            <View style={styles.settingsSection}>
              <Text style={[
                styles.sectionTitle,
                { color: currentTheme.colors.highEmphasis }
              ]}>
                Sync Settings
              </Text>
              <View style={[
                styles.infoBox,
                { backgroundColor: currentTheme.colors.elevation1, borderColor: currentTheme.colors.border }
              ]}>
                <Text style={[
                  styles.infoText,
                  { color: currentTheme.colors.mediumEmphasis }
                ]}>
                  When connected to Trakt, Continue Watching is sourced from Trakt. Account sync for watch progress is disabled to avoid conflicts.
                </Text>
              </View>
              {isTV ? (
                <View style={{ marginBottom: 8 }}>
                <Focusable
                  onPress={() => setAutosyncEnabled(!autosyncSettings.enabled)}
                  style={[styles.settingItem, { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14 }]}
                  borderRadius={14}
                  focusScale={1.0}
                  animateBackground={false}
                  showFocusBorder={true}
                >
                  {(focused) => (
                    <View style={styles.settingContent}>
                      <View style={styles.settingTextContainer}>
                        <Text style={[
                          styles.settingLabel,
                          { color: currentTheme.colors.highEmphasis }
                        ]}>
                          Auto-sync playback progress
                        </Text>
                        <Text style={[
                          styles.settingDescription,
                          { color: currentTheme.colors.mediumEmphasis }
                        ]}>
                          Automatically sync watch progress to Trakt
                        </Text>
                      </View>
                      <View style={styles.settingToggleContainer}>
                        <View style={{ width: 51, height: 14, borderRadius: 7, backgroundColor: autosyncSettings.enabled ? currentTheme.colors.primary : currentTheme.colors.border, position: 'relative' as const }}>
                          <View style={{ width: 26, height: 26, borderRadius: 13, position: 'absolute' as const, top: -6, backgroundColor: autosyncSettings.enabled ? currentTheme.colors.white : currentTheme.colors.mediumEmphasis, ...(autosyncSettings.enabled ? { right: 0 } : { left: 0 }) }} />
                        </View>
                      </View>
                    </View>
                  )}
                </Focusable>
                </View>
              ) : (
                <View style={styles.settingItem}>
                  <View style={styles.settingContent}>
                    <View style={styles.settingTextContainer}>
                      <Text style={[
                        styles.settingLabel,
                        { color: currentTheme.colors.highEmphasis }
                      ]}>
                        Auto-sync playback progress
                      </Text>
                      <Text style={[
                        styles.settingDescription,
                        { color: currentTheme.colors.mediumEmphasis }
                      ]}>
                        Automatically sync watch progress to Trakt
                      </Text>
                    </View>
                    <View style={styles.settingToggleContainer}>
                      <Switch
                        value={autosyncSettings.enabled}
                        onValueChange={setAutosyncEnabled}
                        trackColor={{
                          false: currentTheme.colors.border,
                          true: currentTheme.colors.primary + '80'
                        }}
                        thumbColor={autosyncSettings.enabled ? currentTheme.colors.white : currentTheme.colors.mediumEmphasis}
                      />
                    </View>
                  </View>
                </View>
              )}
              <View style={styles.settingItem}>
                <View style={styles.settingContent}>
                  <View style={styles.settingTextContainer}>
                    <Text style={[
                      styles.settingLabel,
                      { color: currentTheme.colors.highEmphasis }
                    ]}>
                      Import watched history
                    </Text>
                    <Text style={[
                      styles.settingDescription,
                      { color: currentTheme.colors.mediumEmphasis }
                    ]}>
                      Use "Sync Now" to import your watch history and progress from Trakt
                    </Text>
                  </View>
                </View>
              </View>
              {isTV ? (
                <Focusable
                  onPress={async () => {
                    const success = await performManualSync();
                    openAlert(
                      'Sync Complete',
                      success ? 'Successfully synced your watch progress with Trakt.' : 'Sync failed. Please try again.'
                    );
                  }}
                  style={[
                    styles.button,
                    {
                      backgroundColor: currentTheme.colors.card,
                      opacity: isSyncing ? 0.6 : 1
                    }
                  ]}
                  borderRadius={8}
                  focusScale={1}
                  animateBackground={false}
                  showFocusBorder={true}
                >
                  {(focused) => (
                    isSyncing ? (
                      <ActivityIndicator
                        size="small"
                        color={currentTheme.colors.primary}
                      />
                    ) : (
                      <Text style={[
                        styles.buttonText,
                        { color: currentTheme.colors.primary }
                      ]}>
                        Sync Now
                      </Text>
                    )
                  )}
                </Focusable>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.button,
                    {
                      backgroundColor: currentTheme.colors.card,
                      opacity: isSyncing ? 0.6 : 1
                    }
                  ]}
                  disabled={isSyncing}
                  onPress={async () => {
                    const success = await performManualSync();
                    openAlert(
                      'Sync Complete',
                      success ? 'Successfully synced your watch progress with Trakt.' : 'Sync failed. Please try again.'
                    );
                  }}
                >
                  {isSyncing ? (
                    <ActivityIndicator
                      size="small"
                      color={currentTheme.colors.primary}
                    />
                  ) : (
                    <Text style={[
                      styles.buttonText,
                      { color: currentTheme.colors.primary }
                    ]}>
                      Sync Now
                    </Text>
                  )}
                </TouchableOpacity>
              )}

              {/* Display Settings Section */}
              <Text style={[
                styles.sectionTitle,
                { color: currentTheme.colors.highEmphasis, marginTop: 24 }
              ]}>
                Display Settings
              </Text>

              {isTV ? (
                <View style={{ marginBottom: 8 }}>
                <Focusable
                  onPress={() => updateSetting('showTraktComments', !settings.showTraktComments)}
                  style={[styles.settingItem, { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14 }]}
                  borderRadius={14}
                  focusScale={1.0}
                  animateBackground={false}
                  showFocusBorder={true}
                >
                  {(focused) => (
                    <View style={styles.settingContent}>
                      <View style={styles.settingTextContainer}>
                        <Text style={[
                          styles.settingLabel,
                          { color: currentTheme.colors.highEmphasis }
                        ]}>
                          Show Trakt Comments
                        </Text>
                        <Text style={[
                          styles.settingDescription,
                          { color: currentTheme.colors.mediumEmphasis }
                        ]}>
                          Display Trakt comments in metadata screens when available
                        </Text>
                      </View>
                      <View style={styles.settingToggleContainer}>
                        <View style={{ width: 51, height: 14, borderRadius: 7, backgroundColor: settings.showTraktComments ? currentTheme.colors.primary : currentTheme.colors.border, position: 'relative' as const }}>
                          <View style={{ width: 26, height: 26, borderRadius: 13, position: 'absolute' as const, top: -6, backgroundColor: settings.showTraktComments ? currentTheme.colors.white : currentTheme.colors.mediumEmphasis, ...(settings.showTraktComments ? { right: 0 } : { left: 0 }) }} />
                        </View>
                      </View>
                    </View>
                  )}
                </Focusable>
                </View>
              ) : (
                <View style={styles.settingItem}>
                  <View style={styles.settingContent}>
                    <View style={styles.settingTextContainer}>
                      <Text style={[
                        styles.settingLabel,
                        { color: currentTheme.colors.highEmphasis }
                      ]}>
                        Show Trakt Comments
                      </Text>
                      <Text style={[
                        styles.settingDescription,
                        { color: currentTheme.colors.mediumEmphasis }
                      ]}>
                        Display Trakt comments in metadata screens when available
                      </Text>
                    </View>
                    <View style={styles.settingToggleContainer}>
                      <Switch
                        value={settings.showTraktComments}
                        onValueChange={(value) => updateSetting('showTraktComments', value)}
                        trackColor={{
                          false: currentTheme.colors.border,
                          true: currentTheme.colors.primary + '80'
                        }}
                        thumbColor={settings.showTraktComments ? currentTheme.colors.white : currentTheme.colors.mediumEmphasis}
                      />
                    </View>
                  </View>
                </View>
              )}


            </View>
          </View>
        )}
      </ScrollView>
      
      <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        onClose={() => setAlertVisible(false)}
        actions={alertActions}
      />

      {/* QR Code Modal for TV Authentication */}
      <Modal
        visible={showQRModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCancelQRAuth}
      >
        <View style={styles.qrModalOverlay}>
          <View style={[styles.qrModalContent, { backgroundColor: currentTheme.colors.elevation2 }]}>
            {/* Left Side - QR Code */}
            <View style={styles.qrModalLeft}>
              <Text style={[styles.qrModalDescription, { color: currentTheme.colors.mediumEmphasis }]}>
                Scan with your phone
              </Text>

              {qrCodeUrl && (
                <View style={styles.qrCodeContainer}>
                  <QRCode
                    value={qrCodeUrl}
                    size={180}
                    backgroundColor="white"
                    color="black"
                  />
                </View>
              )}

              <Text style={[styles.qrModalOr, { color: currentTheme.colors.mediumEmphasis }]}>
                Or visit
              </Text>
              <Text style={[styles.qrModalUrl, { color: currentTheme.colors.primary }]}>
                {verificationUrl}
              </Text>
            </View>

            {/* Divider */}
            <View style={[styles.qrModalDivider, { backgroundColor: currentTheme.colors.border }]} />

            {/* Right Side - Code and Actions */}
            <View style={styles.qrModalRight}>
              <TraktIcon width={50} height={50} style={{ marginBottom: 12 }} />
              <Text style={[styles.qrModalTitle, { color: currentTheme.colors.highEmphasis }]}>
                Sign In with Trakt
              </Text>

              <Text style={[styles.qrModalCodeLabel, { color: currentTheme.colors.mediumEmphasis }]}>
                Enter this code:
              </Text>
              <Text style={[styles.qrModalCode, { color: currentTheme.colors.highEmphasis }]}>
                {userCode}
              </Text>

              <View style={styles.qrModalPolling}>
                <ActivityIndicator size="small" color={currentTheme.colors.primary} />
                <Text style={[styles.qrModalPollingText, { color: currentTheme.colors.mediumEmphasis }]}>
                  Waiting for authorization...
                </Text>
              </View>

              <Focusable
                onPress={handleCancelQRAuth}
                style={[styles.qrModalCancelButton, { backgroundColor: currentTheme.colors.elevation3 }]}
                borderRadius={8}
                focusScale={1}
                animateBackground={false}
                showFocusBorder={true}
                autoFocus
              >
                {(focused) => (
                  <Text style={[styles.qrModalCancelText, { color: currentTheme.colors.highEmphasis }]}>
                    Cancel
                  </Text>
                )}
              </Focusable>
            </View>
          </View>
        </View>
      </Modal>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  card: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInContainer: {
    padding: 24,
    alignItems: 'center',
  },
  traktLogo: {
    width: 120,
    height: 120,
    marginBottom: 20,
  },
  signInTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  signInDescription: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  button: {
    width: '100%',
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  signOutButton: {
    marginTop: 20,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'white',
  },
  profileContainer: {
    padding: 20,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 26,
    fontWeight: 'bold',
    color: 'white',
  },
  profileInfo: {
    marginLeft: 16,
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  profileUsername: {
    fontSize: 14,
  },
  vipBadge: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#FFD700',
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  vipText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000',
  },
  statsContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(150,150,150,0.2)',
  },
  joinedDate: {
    fontSize: 14,
  },
  settingsSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    marginTop: 8,
  },
  settingItem: {
    marginBottom: 16,
  },
  settingContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 60,
  },
  settingTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  settingToggleContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
  },
  infoBox: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 18,
  },
  // QR Modal Styles
  qrModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrModalContent: {
    borderRadius: 16,
    padding: 32,
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 700,
    width: '85%',
  },
  qrModalLeft: {
    flex: 1,
    alignItems: 'center',
    paddingRight: 24,
  },
  qrModalDivider: {
    width: 1,
    height: '80%',
    opacity: 0.3,
  },
  qrModalRight: {
    flex: 1,
    alignItems: 'center',
    paddingLeft: 24,
  },
  qrModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  qrModalDescription: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  qrCodeContainer: {
    padding: 12,
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 16,
  },
  qrModalOr: {
    fontSize: 14,
    marginBottom: 4,
  },
  qrModalUrl: {
    fontSize: 14,
    fontWeight: '600',
  },
  qrModalCodeLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  qrModalCode: {
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 4,
    marginBottom: 24,
  },
  qrModalPolling: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  qrModalPollingText: {
    marginLeft: 8,
    fontSize: 14,
  },
  qrModalCancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  qrModalCancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default TraktSettingsScreen; 