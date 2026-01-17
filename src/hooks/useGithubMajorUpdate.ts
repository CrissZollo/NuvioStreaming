import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { mmkvStorage } from '../services/mmkvStorage';
import * as Updates from 'expo-updates';
import { getDisplayedAppVersion, getNuvioTVVersion } from '../utils/version';
import { fetchLatestGithubRelease, isNewerVersion } from '../services/githubReleaseService';
import { isAndroidTV } from '../utils/tvDetection';

const DISMISSED_KEY = '@github_major_update_dismissed_version';

export interface MajorUpdateData {
  visible: boolean;
  latestTag?: string;
  releaseNotes?: string;
  releaseUrl?: string;
  isChecking: boolean;
  hasError: boolean;
  onDismiss: () => void;
  onLater: () => void;
  refresh: () => void;
}

export function useGithubMajorUpdate(): MajorUpdateData {
  const [visible, setVisible] = useState(false);
  const [latestTag, setLatestTag] = useState<string | undefined>();
  const [releaseNotes, setReleaseNotes] = useState<string | undefined>();
  const [releaseUrl, setReleaseUrl] = useState<string | undefined>();
  const [isChecking, setIsChecking] = useState(false);
  const [hasError, setHasError] = useState(false);

  const check = useCallback(async () => {
    // Only skip iOS - Android (including Android TV) should check
    if (Platform.OS === 'ios') return;

    setIsChecking(true);
    setHasError(false);

    try {
      // Use TV version for Android TV, regular app version otherwise
      const current = isAndroidTV()
        ? getNuvioTVVersion()
        : (getDisplayedAppVersion() || Updates.runtimeVersion || '0.0.0');

      const info = await fetchLatestGithubRelease();
      if (!info?.tag_name) {
        setHasError(true);
        setIsChecking(false);
        return;
      }

      // Always set the latest tag for display purposes
      setLatestTag(info.tag_name);
      setReleaseNotes(info.body);
      setReleaseUrl(info.html_url);

      // Check if major update alerts are disabled (for popup only)
      const majorAlertsEnabled = await mmkvStorage.getItem('@major_updates_alerts_enabled');
      if (majorAlertsEnabled === 'false') {
        setIsChecking(false);
        return; // Don't show popup, but we still set latestTag for the settings screen
      }

      const dismissed = await mmkvStorage.getItem(DISMISSED_KEY);
      if (dismissed === info.tag_name) {
        setIsChecking(false);
        return;
      }

      // "Later" is session-only now, no persisted snooze

      // Use new version comparison that handles pre-releases
      const shouldShow = isNewerVersion(current, info.tag_name);
      if (shouldShow) {
        setVisible(true);
      }
    } catch {
      setHasError(true);
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  const onDismiss = useCallback(async () => {
    if (latestTag) await mmkvStorage.setItem(DISMISSED_KEY, latestTag);
    setVisible(false);
  }, [latestTag]);

  const onLater = useCallback(async () => {
    setVisible(false);
  }, []);

  return { visible, latestTag, releaseNotes, releaseUrl, isChecking, hasError, onDismiss, onLater, refresh: check };
}


