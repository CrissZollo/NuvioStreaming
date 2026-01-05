import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform, useWindowDimensions, StyleSheet, BackHandler } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { WyzieSubtitle, SubtitleCue } from '../utils/playerTypes';
import { getTrackDisplayName, formatLanguage } from '../utils/playerUtils';
import { useIsTV } from '../../../contexts/TVContext';
import { Focusable } from '../../tv/Focusable';

interface SubtitleModalsProps {
  showSubtitleModal: boolean;
  setShowSubtitleModal: (show: boolean) => void;
  showSubtitleLanguageModal: boolean;
  setShowSubtitleLanguageModal: (show: boolean) => void;
  isLoadingSubtitleList: boolean;
  isLoadingSubtitles: boolean;
  customSubtitles: SubtitleCue[];
  availableSubtitles: WyzieSubtitle[];
  ksTextTracks: Array<{id: number, name: string, language?: string}>;
  selectedTextTrack: number;
  useCustomSubtitles: boolean;
  isKsPlayerActive?: boolean;
  subtitleSize: number;
  subtitleBackground: boolean;
  fetchAvailableSubtitles: () => void;
  loadWyzieSubtitle: (subtitle: WyzieSubtitle) => void;
  selectTextTrack: (trackId: number) => void;
  disableCustomSubtitles: () => void;
  increaseSubtitleSize: () => void;
  decreaseSubtitleSize: () => void;
  toggleSubtitleBackground: () => void;
  subtitleTextColor: string;
  setSubtitleTextColor: (c: string) => void;
  subtitleBgOpacity: number;
  setSubtitleBgOpacity: (o: number) => void;
  subtitleTextShadow: boolean;
  setSubtitleTextShadow: (b: boolean) => void;
  subtitleOutline: boolean;
  setSubtitleOutline: (b: boolean) => void;
  subtitleOutlineColor: string;
  setSubtitleOutlineColor: (c: string) => void;
  subtitleOutlineWidth: number;
  setSubtitleOutlineWidth: (n: number) => void;
  subtitleAlign: 'center' | 'left' | 'right';
  setSubtitleAlign: (a: 'center' | 'left' | 'right') => void;
  subtitleBottomOffset: number;
  setSubtitleBottomOffset: (n: number) => void;
  subtitleLetterSpacing: number;
  setSubtitleLetterSpacing: (n: number) => void;
  subtitleLineHeightMultiplier: number;
  setSubtitleLineHeightMultiplier: (n: number) => void;
  subtitleOffsetSec: number;
  setSubtitleOffsetSec: (n: number) => void;
  /** Called when modal is closed (for TV focus restoration) */
  onModalClosed?: () => void;
}

const MorphingTab = ({ label, isSelected, onPress, isTVDevice, autoFocus }: any) => {
  const animatedStyle = useAnimatedStyle(() => ({
    borderRadius: withTiming(isSelected ? 10 : 40, { duration: 250 }),
    backgroundColor: withTiming(isSelected ? 'white' : 'rgba(255,255,255,0.06)', { duration: 250 }),
  }));

  if (isTVDevice) {
    return (
      <Focusable
        onPress={onPress}
        autoFocus={autoFocus}
        style={{ flex: 1 }}
        borderRadius={10}
        focusScale={1.05}
        animateBackground={true}
        showFocusBorder={true}
      >
        {(focused) => (
          <View style={[{
            paddingVertical: 10,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: isSelected ? 10 : 40,
            backgroundColor: (isSelected || focused) ? 'white' : 'rgba(255,255,255,0.06)',
          }]}>
            <Text style={{ color: (isSelected || focused) ? 'black' : 'white', fontWeight: (isSelected || focused) ? '700' : '400', fontSize: 15 }}>
              {label}
            </Text>
          </View>
        )}
      </Focusable>
    );
  }

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={{ flex: 1 }}>
      <Animated.View style={[{ paddingVertical: 8, alignItems: 'center', justifyContent: 'center' }, animatedStyle]}>
        <Text style={{ color: isSelected ? 'black' : 'white', fontWeight: isSelected ? '700' : '400', fontSize: 13 }}>
          {label}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

export const SubtitleModals: React.FC<SubtitleModalsProps> = ({
  showSubtitleModal, setShowSubtitleModal, isLoadingSubtitleList, isLoadingSubtitles,
  availableSubtitles, ksTextTracks, selectedTextTrack, useCustomSubtitles,
  subtitleSize, subtitleBackground, fetchAvailableSubtitles,
  loadWyzieSubtitle, selectTextTrack, increaseSubtitleSize,
  decreaseSubtitleSize, toggleSubtitleBackground, subtitleTextColor, setSubtitleTextColor,
  subtitleBgOpacity, setSubtitleBgOpacity, subtitleTextShadow, setSubtitleTextShadow,
  subtitleOutline, setSubtitleOutline, subtitleOutlineColor, setSubtitleOutlineColor,
  subtitleOutlineWidth, setSubtitleOutlineWidth, subtitleAlign, setSubtitleAlign,
  subtitleBottomOffset, setSubtitleBottomOffset, subtitleLetterSpacing, setSubtitleLetterSpacing,
  subtitleLineHeightMultiplier, setSubtitleLineHeightMultiplier, subtitleOffsetSec, setSubtitleOffsetSec,
  onModalClosed,
}) => {
  const { width, height } = useWindowDimensions();
  const isTVDevice = useIsTV();
  const isIos = Platform.OS === 'ios';
  const isLandscape = width > height;
  const [selectedOnlineSubtitleId, setSelectedOnlineSubtitleId] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<'built-in' | 'addon' | 'appearance'>('built-in');

  const isCompact = width < 360 || height < 640;
  const sectionPad = isCompact ? 12 : 16;
  const chipPadH = isCompact ? 8 : 12;
  const chipPadV = isCompact ? 6 : 8;
  const controlBtn = { size: isCompact ? 28 : 32, radius: isCompact ? 14 : 16 };
  const previewHeight = isCompact ? 90 : (isIos && isLandscape ? 100 : 120);

  const menuWidth = isTVDevice ? Math.min(width * 0.5, 550) : Math.min(width * 0.9, 420);
  const menuMaxHeight = height * 0.95;

  React.useEffect(() => {
    if (showSubtitleModal && !isLoadingSubtitleList && availableSubtitles.length === 0) fetchAvailableSubtitles();
  }, [showSubtitleModal]);

  const handleClose = () => {
    setShowSubtitleModal(false);
    // Call onModalClosed after a short delay to allow the modal to close
    // This helps restore focus to the player controls on TV
    if (isTVDevice && onModalClosed) {
      setTimeout(() => onModalClosed(), 300);
    }
  };

  // Handle Android TV back button to close modal
  useEffect(() => {
    if (!showSubtitleModal) return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleClose();
      return true; // Prevent default back behavior
    });

    return () => backHandler.remove();
  }, [showSubtitleModal]);

  if (!showSubtitleModal) return null;

  return (
    <View style={StyleSheet.absoluteFill} zIndex={9999}>
      {/* Backdrop */}
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleClose}>
        <Animated.View entering={FadeIn} exiting={FadeOut} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} />
      </TouchableOpacity>

      {/* Centered Modal Container */}
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }} pointerEvents="box-none">
        <Animated.View
          entering={SlideInDown.duration(300)}
          exiting={SlideOutDown.duration(250)}
          style={{
            width: menuWidth,
            maxHeight: menuMaxHeight,
            backgroundColor: '#0f0f0f',
            borderRadius: 24,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.1)',
            overflow: 'hidden'
          }}
        >
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, position: 'relative' }}>
            <Text style={{ color: 'white', fontSize: 18, fontWeight: '700' }}>Subtitles</Text>
          </View>

          {/* Tab Bar */}
          <View style={{ flexDirection: 'row', gap: 15, paddingHorizontal: isTVDevice ? 40 : 70, marginBottom: 20 }}>
            <MorphingTab label="Built-in" isSelected={activeTab === 'built-in'} onPress={() => setActiveTab('built-in')} isTVDevice={isTVDevice} autoFocus={activeTab === 'built-in'} />
            <MorphingTab label="Addons" isSelected={activeTab === 'addon'} onPress={() => setActiveTab('addon')} isTVDevice={isTVDevice} />
            <MorphingTab label="Style" isSelected={activeTab === 'appearance'} onPress={() => setActiveTab('appearance')} isTVDevice={isTVDevice} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
              {activeTab === 'built-in' && (
                <View style={{ gap: 8 }}>
                  {isTVDevice ? (
                    <Focusable
                      onPress={() => { selectTextTrack(-1); setSelectedOnlineSubtitleId(null); }}
                      autoFocus={true}
                      style={{ padding: 14, borderRadius: 12, backgroundColor: selectedTextTrack === -1 ? 'white' : 'rgba(242, 184, 181, 1)' }}
                      borderRadius={12}
                      focusScale={1.02}
                      animateBackground={true}
                      showFocusBorder={true}
                    >
                      {(focused) => (
                        <Text style={{ color: (selectedTextTrack === -1 || focused) ? 'black' : 'rgba(96, 20, 16)', fontWeight: '600', fontSize: 16 }}>None</Text>
                      )}
                    </Focusable>
                  ) : (
                    <TouchableOpacity
                      onPress={() => { selectTextTrack(-1); setSelectedOnlineSubtitleId(null); }}
                      style={{ padding: 10, borderRadius: 12, backgroundColor: selectedTextTrack === -1 ? 'white' : 'rgba(242, 184, 181, 1)' }}
                    >
                      <Text style={{ color: selectedTextTrack === -1 ? 'black' : 'rgba(96, 20, 16)', fontWeight: '600' }}>None</Text>
                    </TouchableOpacity>
                  )}
                  {ksTextTracks.map((track, index) => {
                    const isSelected = selectedTextTrack === track.id;
                    const handleSelect = () => { selectTextTrack(track.id); setSelectedOnlineSubtitleId(null); };

                    if (isTVDevice) {
                      return (
                        <Focusable
                          key={track.id}
                          onPress={handleSelect}
                          style={{ padding: 14, borderRadius: 12, backgroundColor: isSelected ? 'white' : 'rgba(255,255,255,0.05)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                          borderRadius={12}
                          focusScale={1.02}
                          animateBackground={true}
                          showFocusBorder={true}
                        >
                          {(focused) => (
                            <>
                              <Text style={{ color: (isSelected || focused) ? 'black' : 'white', fontWeight: (isSelected || focused) ? '700' : '400', fontSize: 16 }}>{getTrackDisplayName(track)}</Text>
                              {isSelected && <MaterialIcons name="check" size={18} color="black" />}
                            </>
                          )}
                        </Focusable>
                      );
                    }

                    return (
                      <TouchableOpacity
                        key={track.id}
                        onPress={handleSelect}
                        style={{ padding: 10, borderRadius: 12, backgroundColor: isSelected ? 'white' : 'rgba(255,255,255,0.05)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <Text style={{ color: isSelected ? 'black' : 'white' }}>{getTrackDisplayName(track)}</Text>
                        {isSelected && <MaterialIcons name="check" size={18} color="black" />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {activeTab === 'addon' && (
                <View style={{ gap: 8 }}>
                  {availableSubtitles.length === 0 ? (
                    isTVDevice ? (
                      <Focusable
                        onPress={fetchAvailableSubtitles}
                        autoFocus={true}
                        style={{ padding: 40, alignItems: 'center', opacity: 0.5 }}
                        borderRadius={12}
                        focusScale={1.02}
                        animateBackground={false}
                        showFocusBorder={true}
                      >
                        {() => (
                          <>
                            <MaterialIcons name="cloud-download" size={32} color="white" />
                            <Text style={{ color: 'white', marginTop: 10 }}>Search Online Subtitles</Text>
                          </>
                        )}
                      </Focusable>
                    ) : (
                      <TouchableOpacity onPress={fetchAvailableSubtitles} style={{ padding: 40, alignItems: 'center', opacity: 0.5 }}>
                        <MaterialIcons name="cloud-download" size={32} color="white" />
                        <Text style={{ color: 'white', marginTop: 10 }}>Search Online Subtitles</Text>
                      </TouchableOpacity>
                    )
                  ) : (
                    availableSubtitles.map((sub, index) => {
                      const isSelected = selectedOnlineSubtitleId === sub.id;
                      const handleSelect = () => { setSelectedOnlineSubtitleId(sub.id); loadWyzieSubtitle(sub); };

                      if (isTVDevice) {
                        return (
                          <Focusable
                            key={sub.id}
                            onPress={handleSelect}
                            autoFocus={index === 0}
                            style={{ padding: 8, paddingLeft: 12, paddingRight: 14, borderRadius: 12, backgroundColor: isSelected ? 'white' : 'rgba(255,255,255,0.05)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                            borderRadius={12}
                            focusScale={1.02}
                            animateBackground={true}
                            showFocusBorder={true}
                          >
                            {(focused) => (
                              <>
                                <View>
                                  <Text style={{ marginLeft: 5, color: (isSelected || focused) ? 'black' : 'white', fontWeight: '600', fontSize: 16 }}>{sub.display}</Text>
                                  <Text style={{ marginLeft: 5, color: (isSelected || focused) ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)', fontSize: 12, paddingBottom: 3 }}>{formatLanguage(sub.language)}</Text>
                                </View>
                                {isSelected && <MaterialIcons name="check" size={18} color="black" />}
                              </>
                            )}
                          </Focusable>
                        );
                      }

                      return (
                        <TouchableOpacity
                          key={sub.id}
                          onPress={handleSelect}
                          style={{ padding: 5, paddingLeft: 8, paddingRight: 10, borderRadius: 12, backgroundColor: isSelected ? 'white' : 'rgba(255,255,255,0.05)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                        >
                          <View>
                            <Text style={{ marginLeft: 5, color: isSelected ? 'black' : 'white', fontWeight: '600' }}>{sub.display}</Text>
                            <Text style={{ marginLeft: 5, color: isSelected ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)', fontSize: 11, paddingBottom: 3 }}>{formatLanguage(sub.language)}</Text>
                          </View>
                          {isSelected && <MaterialIcons name="check" size={18} color="black" />}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              )}

              {activeTab === 'appearance' && (
                <View style={{ gap: isCompact ? 12 : 16, paddingBottom: 8 }}>
                  {/* Live Preview */}
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: sectionPad }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                      <MaterialIcons name="visibility" size={16} color="rgba(255,255,255,0.7)" />
                      <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginLeft: 6, fontWeight: '600' }}>Preview</Text>
                    </View>
                    <View style={{ height: previewHeight, justifyContent: 'flex-end' }}>
                      <View style={{ alignItems: subtitleAlign === 'center' ? 'center' : subtitleAlign === 'left' ? 'flex-start' : 'flex-end', marginBottom: Math.min(80, subtitleBottomOffset) }}>
                        <View style={{
                          backgroundColor: subtitleBackground ? `rgba(0,0,0,${subtitleBgOpacity})` : 'transparent',
                          borderRadius: 8,
                          paddingHorizontal: isCompact ? 10 : 12,
                          paddingVertical: isCompact ? 6 : 8,
                        }}>
                          <Text style={{
                            color: subtitleTextColor,
                            fontSize: subtitleSize,
                            letterSpacing: subtitleLetterSpacing,
                            lineHeight: subtitleSize * subtitleLineHeightMultiplier,
                            textAlign: subtitleAlign,
                            textShadowColor: subtitleOutline ? subtitleOutlineColor : (subtitleTextShadow ? 'rgba(0,0,0,0.9)' : undefined),
                            textShadowOffset: (subtitleOutline || subtitleTextShadow) ? { width: 2, height: 2 } : undefined,
                            textShadowRadius: subtitleOutline ? Math.max(1, subtitleOutlineWidth) : (subtitleTextShadow ? 4 : undefined),
                          }}>
                            The quick brown fox jumps over the lazy dog.
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Quick Presets */}
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: sectionPad }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                      <MaterialIcons name="star" size={16} color="rgba(255,255,255,0.7)" />
                      <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginLeft: 6, fontWeight: '600' }}>Quick Presets</Text>
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {isTVDevice ? (
                        <>
                          <Focusable
                            onPress={() => {
                              setSubtitleTextColor('#FFFFFF'); setSubtitleBgOpacity(0.7); setSubtitleTextShadow(true);
                              setSubtitleOutline(true); setSubtitleOutlineColor('#000000'); setSubtitleOutlineWidth(4);
                              setSubtitleAlign('center'); setSubtitleBottomOffset(10); setSubtitleLetterSpacing(0);
                              setSubtitleLineHeightMultiplier(1.2);
                            }}
                            autoFocus={true}
                            style={{ paddingHorizontal: chipPadH + 4, paddingVertical: chipPadV + 2, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}
                            borderRadius={20}
                            focusScale={1.05}
                            animateBackground={true}
                            showFocusBorder={true}
                          >
                            {(focused) => <Text style={{ color: focused ? '#000' : '#fff', fontWeight: '600', fontSize: 14 }}>Default</Text>}
                          </Focusable>
                          <Focusable
                            onPress={() => {
                              setSubtitleTextColor('#FFD700'); setSubtitleOutline(true); setSubtitleOutlineColor('#000000'); setSubtitleOutlineWidth(4); setSubtitleBgOpacity(0.3); setSubtitleTextShadow(false);
                            }}
                            style={{ paddingHorizontal: chipPadH + 4, paddingVertical: chipPadV + 2, borderRadius: 20, backgroundColor: 'rgba(255,215,0,0.12)', borderWidth: 1, borderColor: 'rgba(255,215,0,0.35)' }}
                            borderRadius={20}
                            focusScale={1.05}
                            animateBackground={true}
                            showFocusBorder={true}
                          >
                            {(focused) => <Text style={{ color: focused ? '#000' : '#FFD700', fontWeight: '700', fontSize: 14 }}>Yellow</Text>}
                          </Focusable>
                          <Focusable
                            onPress={() => {
                              setSubtitleTextColor('#FFFFFF'); setSubtitleOutline(true); setSubtitleOutlineColor('#000000'); setSubtitleOutlineWidth(3); setSubtitleBgOpacity(0.0); setSubtitleTextShadow(false); setSubtitleLetterSpacing(0.5);
                            }}
                            style={{ paddingHorizontal: chipPadH + 4, paddingVertical: chipPadV + 2, borderRadius: 20, backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.35)' }}
                            borderRadius={20}
                            focusScale={1.05}
                            animateBackground={true}
                            showFocusBorder={true}
                          >
                            {(focused) => <Text style={{ color: focused ? '#000' : '#22C55E', fontWeight: '700', fontSize: 14 }}>High Contrast</Text>}
                          </Focusable>
                          <Focusable
                            onPress={() => {
                              setSubtitleTextColor('#FFFFFF'); setSubtitleBgOpacity(0.6); setSubtitleTextShadow(true); setSubtitleOutline(true); setSubtitleAlign('center'); setSubtitleLineHeightMultiplier(1.3);
                            }}
                            style={{ paddingHorizontal: chipPadH + 4, paddingVertical: chipPadV + 2, borderRadius: 20, backgroundColor: 'rgba(59,130,246,0.12)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.35)' }}
                            borderRadius={20}
                            focusScale={1.05}
                            animateBackground={true}
                            showFocusBorder={true}
                          >
                            {(focused) => <Text style={{ color: focused ? '#000' : '#3B82F6', fontWeight: '700', fontSize: 14 }}>Large</Text>}
                          </Focusable>
                        </>
                      ) : (
                        <>
                          <TouchableOpacity
                            onPress={() => {
                              setSubtitleTextColor('#FFFFFF'); setSubtitleBgOpacity(0.7); setSubtitleTextShadow(true);
                              setSubtitleOutline(true); setSubtitleOutlineColor('#000000'); setSubtitleOutlineWidth(4);
                              setSubtitleAlign('center'); setSubtitleBottomOffset(10); setSubtitleLetterSpacing(0);
                              setSubtitleLineHeightMultiplier(1.2);
                            }}
                            style={{ paddingHorizontal: chipPadH, paddingVertical: chipPadV, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}
                          >
                            <Text style={{ color: '#fff', fontWeight: '600', fontSize: isCompact ? 11 : 12 }}>Default</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => {
                              setSubtitleTextColor('#FFD700'); setSubtitleOutline(true); setSubtitleOutlineColor('#000000'); setSubtitleOutlineWidth(4); setSubtitleBgOpacity(0.3); setSubtitleTextShadow(false);
                            }}
                            style={{ paddingHorizontal: chipPadH, paddingVertical: chipPadV, borderRadius: 20, backgroundColor: 'rgba(255,215,0,0.12)', borderWidth: 1, borderColor: 'rgba(255,215,0,0.35)' }}
                          >
                            <Text style={{ color: '#FFD700', fontWeight: '700', fontSize: isCompact ? 11 : 12 }}>Yellow</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => {
                              setSubtitleTextColor('#FFFFFF'); setSubtitleOutline(true); setSubtitleOutlineColor('#000000'); setSubtitleOutlineWidth(3); setSubtitleBgOpacity(0.0); setSubtitleTextShadow(false); setSubtitleLetterSpacing(0.5);
                            }}
                            style={{ paddingHorizontal: chipPadH, paddingVertical: chipPadV, borderRadius: 20, backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.35)' }}
                          >
                            <Text style={{ color: '#22C55E', fontWeight: '700', fontSize: isCompact ? 11 : 12 }}>High Contrast</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => {
                              setSubtitleTextColor('#FFFFFF'); setSubtitleBgOpacity(0.6); setSubtitleTextShadow(true); setSubtitleOutline(true); setSubtitleAlign('center'); setSubtitleLineHeightMultiplier(1.3);
                            }}
                            style={{ paddingHorizontal: chipPadH, paddingVertical: chipPadV, borderRadius: 20, backgroundColor: 'rgba(59,130,246,0.12)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.35)' }}
                          >
                            <Text style={{ color: '#3B82F6', fontWeight: '700', fontSize: isCompact ? 11 : 12 }}>Large</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>

                  {/* Core controls */}
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: sectionPad, gap: isCompact ? 10 : 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                      <MaterialIcons name="tune" size={16} color="rgba(255,255,255,0.7)" />
                      <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginLeft: 6, fontWeight: '600' }}>Core</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <MaterialIcons name="format-size" size={16} color="rgba(255,255,255,0.7)" />
                        <Text style={{ color: '#fff', fontWeight: '600', marginLeft: 8 }}>Font Size</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {isTVDevice ? (
                          <>
                            <Focusable
                              onPress={decreaseSubtitleSize}
                              style={{ width: controlBtn.size + 4, height: controlBtn.size + 4, borderRadius: controlBtn.radius, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center' }}
                              borderRadius={controlBtn.radius}
                              focusScale={1.1}
                              animateBackground={true}
                              showFocusBorder={true}
                            >
                              {(focused) => <MaterialIcons name="remove" size={20} color={focused ? '#000' : '#FFFFFF'} />}
                            </Focusable>
                            <View style={{ minWidth: 42, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.12)' }}>
                              <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700' }}>{subtitleSize}</Text>
                            </View>
                            <Focusable
                              onPress={increaseSubtitleSize}
                              style={{ width: controlBtn.size + 4, height: controlBtn.size + 4, borderRadius: controlBtn.radius, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center' }}
                              borderRadius={controlBtn.radius}
                              focusScale={1.1}
                              animateBackground={true}
                              showFocusBorder={true}
                            >
                              {(focused) => <MaterialIcons name="add" size={20} color={focused ? '#000' : '#FFFFFF'} />}
                            </Focusable>
                          </>
                        ) : (
                          <>
                            <TouchableOpacity onPress={decreaseSubtitleSize} style={{ width: controlBtn.size, height: controlBtn.size, borderRadius: controlBtn.radius, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center' }}>
                              <MaterialIcons name="remove" size={18} color="#FFFFFF" />
                            </TouchableOpacity>
                            <View style={{ minWidth: 42, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.12)' }}>
                              <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700' }}>{subtitleSize}</Text>
                            </View>
                            <TouchableOpacity onPress={increaseSubtitleSize} style={{ width: controlBtn.size, height: controlBtn.size, borderRadius: controlBtn.radius, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center' }}>
                              <MaterialIcons name="add" size={18} color="#FFFFFF" />
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <MaterialIcons name="layers" size={16} color="rgba(255,255,255,0.7)" />
                        <Text style={{ color: '#fff', fontWeight: '600', marginLeft: 8 }}>Show Background</Text>
                      </View>
                      {isTVDevice ? (
                        <Focusable
                          onPress={toggleSubtitleBackground}
                          style={{ width: 58, height: 34, backgroundColor: subtitleBackground ? 'white' : 'rgba(255,255,255,0.25)', borderRadius: 17, justifyContent: 'center', alignItems: subtitleBackground ? 'flex-end' : 'flex-start', paddingHorizontal: 3 }}
                          borderRadius={17}
                          focusScale={1.05}
                          animateBackground={false}
                          showFocusBorder={true}
                        >
                          {() => <View style={{ width: 28, height: 28, backgroundColor: subtitleBackground ? 'black' : 'white', borderRadius: 14 }} />}
                        </Focusable>
                      ) : (
                        <TouchableOpacity
                          style={{ width: isCompact ? 48 : 54, height: isCompact ? 28 : 30, backgroundColor: subtitleBackground ? 'white' : 'rgba(255,255,255,0.25)', borderRadius: 15, justifyContent: 'center', alignItems: subtitleBackground ? 'flex-end' : 'flex-start', paddingHorizontal: 3 }}
                          onPress={toggleSubtitleBackground}
                        >
                          <View style={{ width: 24, height: 24, backgroundColor: subtitleBackground ? 'black' : 'white', borderRadius: 12 }} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {/* Advanced controls - hidden on TV for simpler navigation, use presets instead */}
                  {!isTVDevice && (
                    <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: sectionPad, gap: isCompact ? 10 : 14 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <MaterialIcons name="build" size={16} color="rgba(255,255,255,0.7)" />
                        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginLeft: 6, fontWeight: '600' }}>Advanced</Text>
                      </View>
                      <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <MaterialIcons name="palette" size={16} color="rgba(255,255,255,0.7)" />
                          <Text style={{ color: 'white', marginLeft: 8, fontWeight: '600' }}>Text Color</Text>
                        </View>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
                          {['#FFFFFF', '#FFD700', '#00E5FF', '#FF5C5C', '#00FF88', '#9b59b6', '#f97316'].map(c => (
                            <TouchableOpacity key={c} onPress={() => setSubtitleTextColor(c)} style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: c, borderWidth: 2, borderColor: subtitleTextColor === c ? '#fff' : 'rgba(255,255,255,0.3)' }} />
                          ))}
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={{ color: 'white', fontWeight: '600' }}>Align</Text>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          {([ { key: 'left', icon: 'format-align-left' }, { key: 'center', icon: 'format-align-center' }, { key: 'right', icon: 'format-align-right' } ] as const).map(a => (
                            <TouchableOpacity key={a.key} onPress={() => setSubtitleAlign(a.key)} style={{ paddingHorizontal: isCompact ? 8 : 10, paddingVertical: isCompact ? 4 : 6, borderRadius: 8, backgroundColor: subtitleAlign === a.key ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}>
                              <MaterialIcons name={a.icon as any} size={18} color="#FFFFFF" />
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={{ color: 'white', fontWeight: '600' }}>Bottom Offset</Text>
                        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                          <TouchableOpacity onPress={() => setSubtitleBottomOffset(Math.max(0, subtitleBottomOffset - 5))} style={{ width: controlBtn.size, height: controlBtn.size, borderRadius: controlBtn.radius, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                            <MaterialIcons name="keyboard-arrow-down" color="#fff" size={20} />
                          </TouchableOpacity>
                          <View style={{ minWidth: 46, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.12)' }}>
                            <Text style={{ color: 'white', textAlign: 'center', fontWeight: '700' }}>{subtitleBottomOffset}</Text>
                          </View>
                          <TouchableOpacity onPress={() => setSubtitleBottomOffset(subtitleBottomOffset + 5)} style={{ width: controlBtn.size, height: controlBtn.size, borderRadius: controlBtn.radius, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                            <MaterialIcons name="keyboard-arrow-up" color="#fff" size={20} />
                          </TouchableOpacity>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={{ color: 'white', fontWeight: '600' }}>Background Opacity</Text>
                        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                          <TouchableOpacity onPress={() => setSubtitleBgOpacity(Math.max(0, +(subtitleBgOpacity - 0.1).toFixed(1)))} style={{ width: controlBtn.size, height: controlBtn.size, borderRadius: controlBtn.radius, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                            <MaterialIcons name="remove" color="#fff" size={18} />
                          </TouchableOpacity>
                          <View style={{ minWidth: 48, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.12)' }}>
                            <Text style={{ color: 'white', textAlign: 'center', fontWeight: '700' }}>{subtitleBgOpacity.toFixed(1)}</Text>
                          </View>
                          <TouchableOpacity onPress={() => setSubtitleBgOpacity(Math.min(1, +(subtitleBgOpacity + 0.1).toFixed(1)))} style={{ width: controlBtn.size, height: controlBtn.size, borderRadius: controlBtn.radius, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                            <MaterialIcons name="add" color="#fff" size={18} />
                          </TouchableOpacity>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={{ color: 'white', fontWeight: '600' }}>Text Shadow</Text>
                        <TouchableOpacity onPress={() => setSubtitleTextShadow(!subtitleTextShadow)} style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: subtitleTextShadow ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center' }}>
                          <Text style={{ color: '#fff', fontWeight: '700' }}>{subtitleTextShadow ? 'On' : 'Off'}</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={{ color: 'white' }}>Outline Color</Text>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          {['#000000', '#FFFFFF', '#00E5FF', '#FF5C5C'].map(c => (
                            <TouchableOpacity key={c} onPress={() => setSubtitleOutlineColor(c)} style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: c, borderWidth: 2, borderColor: subtitleOutlineColor === c ? '#fff' : 'rgba(255,255,255,0.3)' }} />
                          ))}
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={{ color: 'white' }}>Outline Width</Text>
                        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                          <TouchableOpacity onPress={() => setSubtitleOutlineWidth(Math.max(0, subtitleOutlineWidth - 1))} style={{ width: controlBtn.size, height: controlBtn.size, borderRadius: controlBtn.radius, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                            <MaterialIcons name="remove" color="#fff" size={18} />
                          </TouchableOpacity>
                          <View style={{ minWidth: 42, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.12)' }}>
                            <Text style={{ color: 'white', textAlign: 'center', fontWeight: '700' }}>{subtitleOutlineWidth}</Text>
                          </View>
                          <TouchableOpacity onPress={() => setSubtitleOutlineWidth(subtitleOutlineWidth + 1)} style={{ width: controlBtn.size, height: controlBtn.size, borderRadius: controlBtn.radius, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                            <MaterialIcons name="add" color="#fff" size={18} />
                          </TouchableOpacity>
                        </View>
                      </View>
                      <View style={{ flexDirection: isCompact ? 'column' : 'row', justifyContent: 'space-between', gap: 12 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: 'white', fontWeight: '600' }}>Letter Spacing</Text>
                          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                            <TouchableOpacity onPress={() => setSubtitleLetterSpacing(Math.max(0, +(subtitleLetterSpacing - 0.5).toFixed(1)))} style={{ width: controlBtn.size, height: controlBtn.size, borderRadius: controlBtn.radius, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                              <MaterialIcons name="remove" color="#fff" size={18} />
                            </TouchableOpacity>
                            <View style={{ minWidth: 48, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.12)' }}>
                              <Text style={{ color: 'white', textAlign: 'center', fontWeight: '700' }}>{subtitleLetterSpacing.toFixed(1)}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setSubtitleLetterSpacing(+(subtitleLetterSpacing + 0.5).toFixed(1))} style={{ width: controlBtn.size, height: controlBtn.size, borderRadius: controlBtn.radius, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                              <MaterialIcons name="add" color="#fff" size={18} />
                            </TouchableOpacity>
                          </View>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: 'white', fontWeight: '600' }}>Line Height</Text>
                          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                            <TouchableOpacity onPress={() => setSubtitleLineHeightMultiplier(Math.max(1, +(subtitleLineHeightMultiplier - 0.1).toFixed(1)))} style={{ width: controlBtn.size, height: controlBtn.size, borderRadius: controlBtn.radius, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                              <MaterialIcons name="remove" color="#fff" size={18} />
                            </TouchableOpacity>
                            <View style={{ minWidth: 48, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.12)' }}>
                              <Text style={{ color: 'white', textAlign: 'center', fontWeight: '700' }}>{subtitleLineHeightMultiplier.toFixed(1)}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setSubtitleLineHeightMultiplier(+(subtitleLineHeightMultiplier + 0.1).toFixed(1))} style={{ width: controlBtn.size, height: controlBtn.size, borderRadius: controlBtn.radius, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                              <MaterialIcons name="add" color="#fff" size={18} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                      <View style={{ marginTop: 4 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Text style={{ color: 'white', fontWeight: '600' }}>Timing Offset (s)</Text>
                          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                            <TouchableOpacity onPress={() => setSubtitleOffsetSec(+(subtitleOffsetSec - 0.1).toFixed(1))} style={{ width: controlBtn.size, height: controlBtn.size, borderRadius: controlBtn.radius, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                              <MaterialIcons name="remove" color="#fff" size={18} />
                            </TouchableOpacity>
                            <View style={{ minWidth: 60, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.12)' }}>
                              <Text style={{ color: 'white', textAlign: 'center', fontWeight: '700' }}>{subtitleOffsetSec.toFixed(1)}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setSubtitleOffsetSec(+(subtitleOffsetSec + 0.1).toFixed(1))} style={{ width: controlBtn.size, height: controlBtn.size, borderRadius: controlBtn.radius, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                              <MaterialIcons name="add" color="#fff" size={18} />
                            </TouchableOpacity>
                          </View>
                        </View>
                        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 6 }}>Nudge subtitles earlier (-) or later (+) to sync if needed.</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', marginTop: 8 }}>
                        <TouchableOpacity
                          onPress={() => {
                            setSubtitleTextColor('#FFFFFF'); setSubtitleBgOpacity(0.7); setSubtitleTextShadow(true);
                            setSubtitleOutline(true); setSubtitleOutlineColor('#000000'); setSubtitleOutlineWidth(4);
                            setSubtitleAlign('center'); setSubtitleBottomOffset(10); setSubtitleLetterSpacing(0);
                            setSubtitleLineHeightMultiplier(1.2); setSubtitleOffsetSec(0);
                          }}
                          style={{ paddingHorizontal: chipPadH, paddingVertical: chipPadV, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}
                        >
                          <Text style={{ color: '#fff', fontWeight: '600', fontSize: isCompact ? 12 : 14 }}>Reset to defaults</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              )}
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </View>
  );
};

export default SubtitleModals;
