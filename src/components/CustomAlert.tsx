import React, { useEffect, useCallback, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  useColorScheme,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../contexts/ThemeContext';
import { Portal } from 'react-native-paper';
import { useIsTV } from '../contexts/TVContext';
import { Focusable, FocusableRef } from './tv/Focusable';

interface CustomAlertProps {
  visible: boolean;
  title: string;
  message: string;
  onClose: () => void;
  actions?: Array<{
    label: string;
    onPress: () => void;
    style?: object;
  }>;
}

export const CustomAlert = ({
  visible,
  title,
  message,
  onClose,
  actions = [
    { label: 'OK', onPress: onClose }
  ],
}: CustomAlertProps) => {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.95);
  const { currentTheme } = useTheme();
  const isTV = useIsTV();
  // Using hardcoded dark theme values to match SeriesContent modal
  const themeColors = currentTheme.colors;

  // Refs for TV focus navigation between action buttons
  const actionRefs = useRef<(FocusableRef | null)[]>([]);

  useEffect(() => {
    const duration = Platform.OS === 'android' ? 200 : 150;
    if (visible) {
      opacity.value = withTiming(1, { duration });
      scale.value = withTiming(1, { duration });
    } else {
      opacity.value = withTiming(0, { duration });
      scale.value = withTiming(0.95, { duration });
    }
  }, [visible]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const alertStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  // Safe action handler to prevent crashes
  const handleActionPress = useCallback((action: { label: string; onPress: () => void; style?: object }) => {
    try {
      action.onPress();
      // Don't auto-close here if the action handles it, or check if we should
      // Standard behavior is to close
      onClose();
    } catch (error) {
      console.warn('[CustomAlert] Error in action handler:', error);
      onClose();
    }
  }, [onClose]);

  // Use Portal with Modal for proper rendering and animations
  return (
    <Portal>
      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={onClose}
        statusBarTranslucent={true}
        hardwareAccelerated={true}
        supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
      >
        <Animated.View
          style={[
            styles.overlay,
            { backgroundColor: 'rgba(0, 0, 0, 0.85)' },
            overlayStyle
          ]}
        >
          <Pressable style={styles.overlayPressable} onPress={onClose} />
          <View style={styles.centered}>
            <Animated.View style={[
              styles.alertContainer,
              alertStyle,
            ]}>
              {/* Title */}
              <Text style={styles.title}>
                {title}
              </Text>

              {/* Message */}
              {message ? (
                <Text style={styles.message}>
                  {message}
                </Text>
              ) : null}

              {/* Actions */}
              <View style={styles.actionsRow}>
                {actions.map((action, idx) => {
                  const isFirst = idx === 0;

                  if (isTV) {
                    return (
                      <Focusable
                        key={action.label}
                        ref={(ref) => {
                          actionRefs.current[idx] = ref;
                        }}
                        onPress={() => handleActionPress(action)}
                        style={styles.actionButton}
                        autoFocus={isFirst}
                        borderRadius={6}
                        focusScale={1}
                        animateBackground={false}
                        showFocusBorder={true}
                        nextFocusLeft={idx > 0 ? actionRefs.current[idx - 1]?.getViewRef() : undefined}
                        nextFocusRight={idx < actions.length - 1 ? actionRefs.current[idx + 1]?.getViewRef() : undefined}
                      >
                        <Text style={styles.actionText}>
                          {action.label}
                        </Text>
                      </Focusable>
                    );
                  }

                  return (
                    <TouchableOpacity
                      key={action.label}
                      style={styles.actionButton}
                      onPress={() => handleActionPress(action)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.actionText}>
                        {action.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Animated.View>
          </View>
        </Animated.View>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  overlayPressable: {
    ...StyleSheet.absoluteFillObject,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    width: '100%',
  },
  alertContainer: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#1E1E1E', // Solid opaque dark background
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.51,
        shadowRadius: 13.16,
      },
      android: {
        elevation: 20,
      },
    }),
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  message: {
    color: '#AAAAAA',
    fontSize: 15,
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 22,
    letterSpacing: 0.1,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default CustomAlert;
