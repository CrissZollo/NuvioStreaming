import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Platform,
  BackHandler,
  Pressable,
  findNodeHandle,
  TouchableOpacity,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useSettings } from '../hooks/useSettings';
import { mmkvStorage } from '../services/mmkvStorage';
import { isAndroidTV } from '../utils/tvDetection';

const { width } = Dimensions.get('window');

interface HeroSectionPopupProps {
  visible: boolean;
  onClose: () => void;
}

const HeroSectionPopup: React.FC<HeroSectionPopupProps> = ({
  visible,
  onClose,
}) => {
  const { currentTheme } = useTheme();
  const { updateSetting } = useSettings();
  const isTV = isAndroidTV();
  const keepOffButtonRef = useRef<View>(null);
  const turnOnButtonRef = useRef<View>(null);
  const [keepOffFocused, setKeepOffFocused] = useState(false);
  const [turnOnFocused, setTurnOnFocused] = useState(false);
  const [keepOffNodeHandle, setKeepOffNodeHandle] = useState<number | null>(null);
  const [turnOnNodeHandle, setTurnOnNodeHandle] = useState<number | null>(null);

  // Get node handles for directional focus
  useEffect(() => {
    if (visible && isTV) {
      const timer = setTimeout(() => {
        if (keepOffButtonRef.current) {
          const handle = findNodeHandle(keepOffButtonRef.current);
          if (handle) setKeepOffNodeHandle(handle);
        }
        if (turnOnButtonRef.current) {
          const handle = findNodeHandle(turnOnButtonRef.current);
          if (handle) setTurnOnNodeHandle(handle);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [visible, isTV]);

  // Handle back button to close popup with "Keep Off" behavior
  useEffect(() => {
    if (!visible) return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleKeepOff();
      return true;
    });

    return () => backHandler.remove();
  }, [visible]);

  const handleKeepOff = async () => {
    await updateSetting('showHeroSection', false);
    await mmkvStorage.setItem('hasSeenHeroSectionPopup', 'true');
    onClose();
  };

  const handleTurnOn = async () => {
    await updateSetting('showHeroSection', true);
    await mmkvStorage.setItem('hasSeenHeroSectionPopup', 'true');
    onClose();
  };

  if (!visible) {
    return null;
  }

  return (
    <View style={[StyleSheet.absoluteFill, styles.container]} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(200)}
        style={StyleSheet.absoluteFill}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleKeepOff}
        />
      </Animated.View>

      {/* Popup */}
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(200)}
        style={[
          styles.popup,
          {
            backgroundColor: currentTheme.colors.darkBackground || '#1a1a1a',
            borderColor: currentTheme.colors.elevation2 || '#333333',
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: `${currentTheme.colors.primary}20` },
            ]}
          >
            <MaterialIcons
              name="speed"
              size={32}
              color={currentTheme.colors.primary}
            />
          </View>
          <Text
            style={[styles.title, { color: currentTheme.colors.highEmphasis }]}
          >
            Hero Section
          </Text>
          <Text
            style={[
              styles.subtitle,
              { color: currentTheme.colors.mediumEmphasis },
            ]}
          >
            The hero section displays featured content with animated backgrounds and trailers. This can be more demanding on low-end devices. You can change this later in Settings.
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable
            ref={keepOffButtonRef}
            onPress={handleKeepOff}
            onFocus={() => setKeepOffFocused(true)}
            onBlur={() => setKeepOffFocused(false)}
            style={[
              styles.button,
              styles.primaryButton,
              { backgroundColor: currentTheme.colors.primary },
              keepOffFocused && styles.focusedButton,
            ]}
            // @ts-ignore - TV props
            hasTVPreferredFocus={isTV}
            nextFocusRight={turnOnNodeHandle}
            nextFocusLeft={turnOnNodeHandle}
            nextFocusUp={keepOffNodeHandle}
            nextFocusDown={keepOffNodeHandle}
          >
            <View style={styles.buttonContent}>
              <MaterialIcons name="block" size={18} color="white" />
              <Text style={styles.buttonText}>Keep Off</Text>
            </View>
          </Pressable>

          <Pressable
            ref={turnOnButtonRef}
            onPress={handleTurnOn}
            onFocus={() => setTurnOnFocused(true)}
            onBlur={() => setTurnOnFocused(false)}
            style={[
              styles.button,
              styles.secondaryButton,
              {
                backgroundColor: currentTheme.colors.darkBackground || '#2a2a2a',
                borderColor: turnOnFocused ? '#FFFFFF' : (currentTheme.colors.elevation3 || '#444444'),
              },
              turnOnFocused && styles.focusedButton,
            ]}
            // @ts-ignore - TV props
            nextFocusLeft={keepOffNodeHandle}
            nextFocusRight={keepOffNodeHandle}
            nextFocusUp={turnOnNodeHandle}
            nextFocusDown={turnOnNodeHandle}
          >
            <View style={styles.buttonContent}>
              <MaterialIcons
                name="check"
                size={18}
                color={turnOnFocused ? currentTheme.colors.highEmphasis : currentTheme.colors.mediumEmphasis}
              />
              <Text
                style={[
                  styles.secondaryButtonText,
                  { color: currentTheme.colors.mediumEmphasis },
                  turnOnFocused && { color: currentTheme.colors.highEmphasis },
                ]}
              >
                Turn On
              </Text>
            </View>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  popup: {
    width: Math.min(width - 40, 420),
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: '#1a1a1a',
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.5,
          shadowRadius: 20,
        }
      : {
          elevation: 15,
        }),
    overflow: 'hidden',
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryButton: {
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
        }
      : {
          elevation: 4,
        }),
  },
  secondaryButton: {
    borderWidth: 1,
  },
  focusedButton: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.05 }],
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
});

export default HeroSectionPopup;
