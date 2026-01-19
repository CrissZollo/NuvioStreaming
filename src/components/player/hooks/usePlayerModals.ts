/**
 * Shared Player Modals Hook
 * Used by both Android (VLC) and iOS (KSPlayer) players
 */
import { useState, useCallback } from 'react';
import { Episode } from '../../../types/metadata';

// Debug logging for modal state changes
const DEBUG_MODALS = false; // Disabled after debugging

export const usePlayerModals = () => {
    const [showAudioModal, _setShowAudioModal] = useState(false);
    const [showSubtitleModal, _setShowSubtitleModal] = useState(false);

    // Wrapped setters with logging
    const setShowAudioModal = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
        if (DEBUG_MODALS) {
            const newValue = typeof value === 'function' ? 'function' : value;
            console.log(`[usePlayerModals] setShowAudioModal called with: ${newValue}`);
            console.log(`[usePlayerModals] Stack trace:`, new Error().stack);
        }
        _setShowAudioModal(value);
    }, []);

    const setShowSubtitleModal = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
        if (DEBUG_MODALS) {
            const newValue = typeof value === 'function' ? 'function' : value;
            console.log(`[usePlayerModals] setShowSubtitleModal called with: ${newValue}`);
            console.log(`[usePlayerModals] Stack trace:`, new Error().stack);
        }
        _setShowSubtitleModal(value);
    }, []);
    const [showSpeedModal, setShowSpeedModal] = useState(false);
    const [showSourcesModal, setShowSourcesModal] = useState(false);
    const [showEpisodesModal, setShowEpisodesModal] = useState(false);
    const [showEpisodeStreamsModal, setShowEpisodeStreamsModal] = useState(false);
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [showSubtitleLanguageModal, setShowSubtitleLanguageModal] = useState(false);
    const [showCastDetails, setShowCastDetails] = useState(false);

    // Some modals have associated data
    const [selectedEpisodeForStreams, setSelectedEpisodeForStreams] = useState<Episode | null>(null);
    const [errorDetails, setErrorDetails] = useState<string>('');
    const [selectedCastMember, setSelectedCastMember] = useState<any>(null);

    return {
        showAudioModal, setShowAudioModal,
        showSubtitleModal, setShowSubtitleModal,
        showSpeedModal, setShowSpeedModal,
        showSourcesModal, setShowSourcesModal,
        showEpisodesModal, setShowEpisodesModal,
        showEpisodeStreamsModal, setShowEpisodeStreamsModal,
        showErrorModal, setShowErrorModal,
        showSubtitleLanguageModal, setShowSubtitleLanguageModal,
        showCastDetails, setShowCastDetails,
        selectedEpisodeForStreams, setSelectedEpisodeForStreams,
        errorDetails, setErrorDetails,
        selectedCastMember, setSelectedCastMember
    };
};
