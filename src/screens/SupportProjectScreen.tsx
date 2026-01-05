import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Focusable } from '../components/tv/Focusable';
import QRCode from 'react-native-qrcode-svg';
import { Feather } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');
const KOFI_URL = 'https://ko-fi.com/crisszollo';

const SupportProjectScreen = () => {
  const { currentTheme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.colors.darkBackground }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <View style={styles.content}>
        {/* Left side - Text content */}
        <View style={styles.textContainer}>
          <View style={styles.headerRow}>
            <Feather name="heart" size={28} color={currentTheme.colors.primary} />
            <Text style={[styles.title, { color: currentTheme.colors.text }]}>
              Support{'\n'}Development
            </Text>
          </View>

          <Text style={[styles.subtitle, { color: currentTheme.colors.primary }]}>
            Help Keep This Project Alive
          </Text>

          <Text style={[styles.description, { color: currentTheme.colors.textMuted }]}>
            Hi! I'm the developer who ported Nuvio to Android TV. I continue to improve
            and maintain the TV version in my free time, adding new features and fixing
            bugs to make your viewing experience better.
          </Text>

          <Text style={[styles.description, { color: currentTheme.colors.textMuted, marginTop: 12 }]}>
            If you enjoy using Nuvio on your TV and would like to support continued
            development, please consider making a donation. Every contribution helps
            me dedicate more time to making this app even better!
          </Text>

          <View style={styles.bulletPoints}>
            <View style={styles.bulletRow}>
              <Feather name="check-circle" size={14} color={currentTheme.colors.primary} />
              <Text style={[styles.bulletText, { color: currentTheme.colors.text }]}>
                New features & improvements
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Feather name="check-circle" size={14} color={currentTheme.colors.primary} />
              <Text style={[styles.bulletText, { color: currentTheme.colors.text }]}>
                Bug fixes & performance updates
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Feather name="check-circle" size={14} color={currentTheme.colors.primary} />
              <Text style={[styles.bulletText, { color: currentTheme.colors.text }]}>
                Continued Android TV support
              </Text>
            </View>
          </View>

          <Text style={[styles.thankYou, { color: currentTheme.colors.textMuted }]}>
            Thank you for your support!
          </Text>
        </View>

        {/* Right side - QR Code */}
        <View style={styles.qrSection}>
          <View style={styles.qrCard}>
            <Text style={styles.qrTitle}>Scan to Donate</Text>
            <View style={styles.qrWrapper}>
              <QRCode
                value={KOFI_URL}
                size={160}
                color="#0A0A0A"
                backgroundColor="#FFFFFF"
              />
            </View>
            <Text style={styles.qrUrl}>ko-fi.com/crisszollo</Text>
            <Text style={styles.qrHint}>
              Use your phone's camera{'\n'}to scan this QR code
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 48,
    paddingVertical: 32,
  },
  textContainer: {
    flex: 1,
    maxWidth: 480,
    paddingRight: 32,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 6,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
  },
  bulletPoints: {
    marginTop: 20,
    marginBottom: 20,
    gap: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bulletText: {
    fontSize: 14,
    fontWeight: '500',
  },
  thankYou: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  qrSection: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  qrTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  qrWrapper: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  qrUrl: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
    letterSpacing: 0.5,
  },
  qrHint: {
    marginTop: 10,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default SupportProjectScreen;
