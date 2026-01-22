import React, { useEffect } from 'react';
import { View, TouchableOpacity, Animated, ActivityIndicator, StyleSheet, Text } from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsTV } from '../../../contexts/TVContext';
import { Focusable } from '../../tv/Focusable';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  withDelay
} from 'react-native-reanimated';
import { styles } from '../utils/playerStyles';

interface LoadingOverlayProps {
  visible: boolean;
  backdrop: string | null | undefined;
  hasLogo: boolean;
  logo: string | null | undefined;
  backgroundFadeAnim: Animated.Value;
  backdropImageOpacityAnim: Animated.Value;
  onClose: () => void;
  width: number | string;
  height: number | string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  visible,
  backdrop,
  hasLogo,
  logo,
  backgroundFadeAnim,
  backdropImageOpacityAnim,
  onClose,
  width,
  height,
}) => {
  const isTVDevice = useIsTV();
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(1);

  useEffect(() => {
    if (visible && hasLogo && logo) {
      // Reset
      logoOpacity.value = 0;
      logoScale.value = 1;
      
      // Start animations after 1 second delay
      logoOpacity.value = withDelay(
        1000,
        withTiming(1, {
          duration: 800,
          easing: Easing.out(Easing.cubic),
        })
      );
      
      logoScale.value = withDelay(
        1000,
        withRepeat(
          withSequence(
            withTiming(1.04, {
              duration: 2000,
              easing: Easing.inOut(Easing.ease),
            }),
            withTiming(1, {
              duration: 2000,
              easing: Easing.inOut(Easing.ease),
            })
          ),
          -1,
          false
        )
      );
    }
  }, [visible, hasLogo, logo]);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.openingOverlay,
        {
          opacity: backgroundFadeAnim,
          zIndex: 3000,
          backgroundColor: '#000000',
        },
        // Cast to any to support both number and string dimensions
        { width, height } as any,
      ]}
    >
      {backdrop && (
        <Animated.View style={[
            StyleSheet.absoluteFill,
            {
              opacity: backdropImageOpacityAnim
            }
          ]}>
          <FastImage
            source={{ uri: backdrop, priority: FastImage.priority.high }}
            style={StyleSheet.absoluteFillObject}
            resizeMode={FastImage.resizeMode.cover}
          />
        </Animated.View>
      )}
      <LinearGradient
        colors={[
          'rgba(0,0,0,0.5)',
          'rgba(0,0,0,0.7)',
          'rgba(0,0,0,0.85)',
          'rgba(0,0,0,0.95)'
        ]}
        locations={[0, 0.3, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />
      
      {isTVDevice ? (
        <Focusable
          style={styles.loadingCloseButton}
          onPress={onClose}
          borderRadius={20}
          autoFocus={true}
        >
          <MaterialIcons name="close" size={24} color="#ffffff" />
        </Focusable>
      ) : (
        <TouchableOpacity
          style={styles.loadingCloseButton}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <MaterialIcons name="close" size={24} color="#ffffff" />
        </TouchableOpacity>
      )}

      <View style={styles.openingContent}>
        {hasLogo && logo ? (
          <Reanimated.View style={[
            {
              alignItems: 'center',
            },
            logoAnimatedStyle
          ]}>
            <FastImage
              source={{ uri: logo, priority: FastImage.priority.high }}
              style={{
                width: 300,
                height: 180,
              }}
              resizeMode={FastImage.resizeMode.contain}
            />
          </Reanimated.View>
        ) : (
          <View style={{ alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#E50914" />
            <Text style={{
              color: '#ffffff',
              fontSize: isTVDevice ? 20 : 16,
              marginTop: 16,
              fontWeight: '500',
              opacity: 0.8
            }}>
              Loading...
            </Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
};

export default LoadingOverlay;
