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
import { isAndroidTV } from '../utils/tvDetection';

const { width } = Dimensions.get('window');

interface ExitConfirmationPopupProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ExitConfirmationPopup: React.FC<ExitConfirmationPopupProps> = ({
  visible,
  onConfirm,
  onCancel,
}) => {
  const { currentTheme } = useTheme();
  const isTV = isAndroidTV();
  const cancelButtonRef = useRef<View>(null);
  const exitButtonRef = useRef<View>(null);
  const [cancelFocused, setCancelFocused] = useState(false);
  const [exitFocused, setExitFocused] = useState(false);
  const [cancelNodeHandle, setCancelNodeHandle] = useState<number | null>(null);
  const [exitNodeHandle, setExitNodeHandle] = useState<number | null>(null);

  // Get node handles for directional focus
  useEffect(() => {
    if (visible && isTV) {
      const timer = setTimeout(() => {
        if (cancelButtonRef.current) {
          const handle = findNodeHandle(cancelButtonRef.current);
          if (handle) setCancelNodeHandle(handle);
        }
        if (exitButtonRef.current) {
          const handle = findNodeHandle(exitButtonRef.current);
          if (handle) setExitNodeHandle(handle);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [visible, isTV]);

  // Handle back button to close popup
  useEffect(() => {
    if (!visible) return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      onCancel();
      return true;
    });

    return () => backHandler.remove();
  }, [visible, onCancel]);

  const handleConfirm = () => {
    onConfirm();
    BackHandler.exitApp();
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
          onPress={onCancel}
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
              name="exit-to-app"
              size={32}
              color={currentTheme.colors.primary}
            />
          </View>
          <Text
            style={[styles.title, { color: currentTheme.colors.highEmphasis }]}
          >
            Exit App?
          </Text>
          <Text
            style={[
              styles.subtitle,
              { color: currentTheme.colors.mediumEmphasis },
            ]}
          >
            Are you sure you want to close the app?
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable
            ref={cancelButtonRef}
            onPress={onCancel}
            onFocus={() => setCancelFocused(true)}
            onBlur={() => setCancelFocused(false)}
            style={[
              styles.button,
              styles.primaryButton,
              { backgroundColor: currentTheme.colors.primary },
              cancelFocused && styles.focusedButton,
            ]}
            // @ts-ignore - TV props
            hasTVPreferredFocus={isTV}
            nextFocusRight={exitNodeHandle}
            nextFocusLeft={exitNodeHandle}
            nextFocusUp={cancelNodeHandle}
            nextFocusDown={cancelNodeHandle}
          >
            <View style={styles.buttonContent}>
              <MaterialIcons name="close" size={18} color="white" />
              <Text style={styles.buttonText}>Cancel</Text>
            </View>
          </Pressable>

          <Pressable
            ref={exitButtonRef}
            onPress={handleConfirm}
            onFocus={() => setExitFocused(true)}
            onBlur={() => setExitFocused(false)}
            style={[
              styles.button,
              styles.secondaryButton,
              {
                backgroundColor: currentTheme.colors.darkBackground || '#2a2a2a',
                borderColor: exitFocused ? '#FFFFFF' : (currentTheme.colors.elevation3 || '#444444'),
              },
              exitFocused && styles.focusedButton,
            ]}
            // @ts-ignore - TV props
            nextFocusLeft={cancelNodeHandle}
            nextFocusRight={cancelNodeHandle}
            nextFocusUp={exitNodeHandle}
            nextFocusDown={exitNodeHandle}
          >
            <Text
              style={[
                styles.secondaryButtonText,
                { color: currentTheme.colors.mediumEmphasis },
                exitFocused && { color: currentTheme.colors.highEmphasis },
              ]}
            >
              Exit
            </Text>
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
    width: Math.min(width - 40, 360),
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

export default ExitConfirmationPopup;
