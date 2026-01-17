import React, { useRef } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useIsTV } from '../contexts/TVContext';
import { Focusable, FocusableRef } from './tv/Focusable';
import { getDisplayedAppVersion, getNuvioTVVersion } from '../utils/version';
import { isAndroidTV } from '../utils/tvDetection';

interface Props {
  visible: boolean;
  latestTag?: string;
  releaseNotes?: string;
  releaseUrl?: string;
  onDismiss: () => void;
  onLater: () => void;
}

const MajorUpdateOverlay: React.FC<Props> = ({ visible, latestTag, releaseNotes, releaseUrl, onDismiss, onLater }) => {
  const { currentTheme } = useTheme();
  const isTV = useIsTV();

  // TV focus refs
  const viewReleaseRef = useRef<FocusableRef>(null);
  const laterRef = useRef<FocusableRef>(null);
  const dismissRef = useRef<FocusableRef>(null);

  // Get current version for display
  const currentVersion = isAndroidTV() ? getNuvioTVVersion() : getDisplayedAppVersion();

  if (!visible) return null;

  // TV-optimized content
  const renderTVContent = () => (
    <View style={[styles.card, styles.tvCard, { backgroundColor: currentTheme.colors.darkBackground, borderColor: currentTheme.colors.elevation3 }]}>
      <View style={[styles.header, styles.tvHeader]}>
        <View style={[styles.iconCircle, styles.tvIconCircle, { backgroundColor: `${currentTheme.colors.primary}22` }]}>
          <MaterialIcons name="system-update" size={40} color={currentTheme.colors.primary} />
        </View>
        <Text style={[styles.title, styles.tvTitle, { color: currentTheme.colors.highEmphasis }]}>New Update Available</Text>
        <View style={styles.tvVersionRow}>
          <Text style={[styles.tvVersionLabel, { color: currentTheme.colors.mediumEmphasis }]}>
            Current: <Text style={{ color: currentTheme.colors.highEmphasis }}>{currentVersion}</Text>
          </Text>
          {!!latestTag && (
            <Text style={[styles.tvVersionLabel, { color: currentTheme.colors.mediumEmphasis }]}>
              Latest: <Text style={{ color: currentTheme.colors.primary }}>{latestTag}</Text>
            </Text>
          )}
        </View>
      </View>

      {!!releaseNotes && (
        <View style={[styles.notesBox, styles.tvNotesBox]}>
          <Text style={[styles.notes, styles.tvNotes, { color: currentTheme.colors.mediumEmphasis }]} numberOfLines={6}>
            {releaseNotes}
          </Text>
        </View>
      )}

      <View style={[styles.actions, styles.tvActions]}>
        {releaseUrl ? (
          <Focusable
            ref={viewReleaseRef}
            onPress={() => Linking.openURL(releaseUrl)}
            style={[styles.primaryBtn, styles.tvPrimaryBtn, { backgroundColor: currentTheme.colors.primary }]}
            autoFocus
            borderRadius={16}
            focusScale={1.05}
            nextFocusDown={laterRef.current?.getViewRef()}
          >
            {(focused) => (
              <>
                <MaterialIcons name="download" size={24} color={focused ? '#000' : '#fff'} />
                <Text style={[styles.primaryText, styles.tvPrimaryText, focused && { color: '#000' }]}>
                  Download Update
                </Text>
              </>
            )}
          </Focusable>
        ) : null}

        <View style={[styles.secondaryRow, styles.tvSecondaryRow]}>
          <Focusable
            ref={laterRef}
            onPress={onLater}
            style={[styles.secondaryBtn, styles.tvSecondaryBtn, { borderColor: currentTheme.colors.elevation3 }]}
            borderRadius={12}
            focusScale={1.05}
            nextFocusUp={viewReleaseRef.current?.getViewRef()}
            nextFocusRight={dismissRef.current?.getViewRef()}
          >
            {(focused) => (
              <Text style={[styles.secondaryText, styles.tvSecondaryText, { color: focused ? '#000' : currentTheme.colors.mediumEmphasis }]}>
                Later
              </Text>
            )}
          </Focusable>
          <Focusable
            ref={dismissRef}
            onPress={onDismiss}
            style={[styles.secondaryBtn, styles.tvSecondaryBtn, { borderColor: currentTheme.colors.elevation3 }]}
            borderRadius={12}
            focusScale={1.05}
            nextFocusUp={viewReleaseRef.current?.getViewRef()}
            nextFocusLeft={laterRef.current?.getViewRef()}
          >
            {(focused) => (
              <Text style={[styles.secondaryText, styles.tvSecondaryText, { color: focused ? '#000' : currentTheme.colors.mediumEmphasis }]}>
                Don't show again
              </Text>
            )}
          </Focusable>
        </View>
      </View>
    </View>
  );

  // Mobile content (original)
  const renderMobileContent = () => (
    <View style={[styles.card, { backgroundColor: currentTheme.colors.darkBackground, borderColor: currentTheme.colors.elevation3 }]}>
      <View style={styles.header}>
        <View style={[styles.iconCircle, { backgroundColor: `${currentTheme.colors.primary}22` }]}>
          <MaterialIcons name="new-releases" size={28} color={currentTheme.colors.primary} />
        </View>
        <Text style={[styles.title, { color: currentTheme.colors.highEmphasis }]}>Update available</Text>
        {!!latestTag && (
          <Text style={[styles.version, { color: currentTheme.colors.mediumEmphasis }]}>Latest: {latestTag}</Text>
        )}
      </View>

      {!!releaseNotes && (
        <View style={styles.notesBox}>
          <Text style={[styles.notes, { color: currentTheme.colors.mediumEmphasis }]} numberOfLines={10}>
            {releaseNotes}
          </Text>
        </View>
      )}

      <View style={styles.actions}>
        {releaseUrl ? (
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: currentTheme.colors.primary }]} onPress={() => Linking.openURL(releaseUrl)}>
            <MaterialIcons name="open-in-new" size={18} color="#fff" />
            <Text style={styles.primaryText}>View release</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.secondaryRow}>
          <TouchableOpacity style={[styles.secondaryBtn, { borderColor: currentTheme.colors.elevation3 }]} onPress={onLater}>
            <Text style={[styles.secondaryText, { color: currentTheme.colors.mediumEmphasis }]}>Later</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.secondaryBtn, { borderColor: currentTheme.colors.elevation3 }]} onPress={onDismiss}>
            <Text style={[styles.secondaryText, { color: currentTheme.colors.mediumEmphasis }]}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent presentationStyle="overFullScreen" supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}>
      <View style={[styles.backdrop, isTV && styles.tvBackdrop]}>
        {isTV ? renderTVContent() : renderMobileContent()}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  tvBackdrop: { backgroundColor: 'rgba(0,0,0,0.9)' },
  card: { width: 380, maxWidth: '100%', borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  tvCard: { width: 550, maxWidth: '90%', borderRadius: 24, borderWidth: 2 },
  header: { alignItems: 'center', paddingTop: 28, paddingBottom: 16, paddingHorizontal: 20 },
  tvHeader: { paddingTop: 36, paddingBottom: 24, paddingHorizontal: 32 },
  iconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  tvIconCircle: { width: 80, height: 80, borderRadius: 40, marginBottom: 20 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 6 },
  tvTitle: { fontSize: 28, fontWeight: '700', marginBottom: 16 },
  version: { fontSize: 14 },
  tvVersionRow: { flexDirection: 'row', gap: 24, marginTop: 8 },
  tvVersionLabel: { fontSize: 18 },
  notesBox: { marginHorizontal: 20, marginBottom: 16, padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)' },
  tvNotesBox: { marginHorizontal: 32, marginBottom: 24, padding: 16, borderRadius: 16 },
  notes: { fontSize: 14, lineHeight: 20 },
  tvNotes: { fontSize: 16, lineHeight: 24 },
  actions: { paddingHorizontal: 20, paddingBottom: 20 },
  tvActions: { paddingHorizontal: 32, paddingBottom: 32 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', paddingVertical: 12, borderRadius: 12, marginBottom: 12 },
  tvPrimaryBtn: { paddingVertical: 18, borderRadius: 16, marginBottom: 20, gap: 12 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  tvPrimaryText: { fontSize: 20, fontWeight: '600' },
  secondaryRow: { flexDirection: 'row', gap: 10 },
  tvSecondaryRow: { gap: 16 },
  secondaryBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  tvSecondaryBtn: { paddingVertical: 16, borderRadius: 12, borderWidth: 2 },
  secondaryText: { fontSize: 15, fontWeight: '500' },
  tvSecondaryText: { fontSize: 18, fontWeight: '500' },
});

export default MajorUpdateOverlay;


