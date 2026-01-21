import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Platform,
  TouchableOpacity,
  StatusBar,
  Switch,
  Modal,
  FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSettings, AppSettings } from '../hooks/useSettings';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';
import CustomAlert from '../components/CustomAlert';
import { useIsTV } from '../contexts/TVContext';
import { Focusable, FocusableRef } from '../components/tv/Focusable';

const ANDROID_STATUSBAR_HEIGHT = StatusBar.currentHeight || 0;

interface SettingItemProps {
  title: string;
  description?: string;
  icon: string;
  isSelected: boolean;
  onPress: () => void;
  isLast?: boolean;
  isTV?: boolean;
  autoFocus?: boolean;
}

const SettingItem: React.FC<SettingItemProps> = ({
  title,
  description,
  icon,
  isSelected,
  onPress,
  isLast,
  isTV = false,
  autoFocus = false,
}) => {
  const { currentTheme } = useTheme();

  const content = (focused: boolean = false) => (
    <View style={styles.settingContent}>
      <View style={[
        styles.settingIconContainer,
        { backgroundColor: focused ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.1)' }
      ]}>
        <MaterialIcons
          name={icon}
          size={20}
          color={currentTheme.colors.primary}
        />
      </View>
      <View style={styles.settingText}>
        <Text
          style={[
            styles.settingTitle,
            { color: currentTheme.colors.text },
          ]}
        >
          {title}
        </Text>
        {description && (
          <Text
            style={[
              styles.settingDescription,
              { color: currentTheme.colors.textMuted },
            ]}
          >
            {description}
          </Text>
        )}
      </View>
      {isSelected && (
        <MaterialIcons
          name="check"
          size={24}
          color={currentTheme.colors.primary}
          style={styles.checkIcon}
        />
      )}
    </View>
  );

  if (isTV) {
    return (
      <View style={{ marginBottom: 8 }}>
        <Focusable
          onPress={onPress}
          autoFocus={autoFocus}
          style={[
            styles.settingItem,
            {
              borderBottomWidth: 0,
              backgroundColor: 'rgba(255,255,255,0.08)',
              borderRadius: 14,
            },
          ]}
          borderRadius={14}
          focusScale={1.0}
          animateBackground={false}
          showFocusBorder={true}
        >
          {(focused) => content(focused)}
        </Focusable>
      </View>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.settingItem,
        !isLast && styles.settingItemBorder,
        { borderBottomColor: 'rgba(255,255,255,0.08)' },
      ]}
    >
      {content(false)}
    </TouchableOpacity>
  );
};

// Language options for audio and subtitle selection (ISO 639-1 codes)
const LANGUAGE_OPTIONS = [
  { code: '', name: 'Auto (First Available)' },
  { code: 'aa', name: 'Afar' },
  { code: 'ab', name: 'Abkhazian' },
  { code: 'ae', name: 'Avestan' },
  { code: 'af', name: 'Afrikaans' },
  { code: 'ak', name: 'Akan' },
  { code: 'am', name: 'Amharic' },
  { code: 'an', name: 'Aragonese' },
  { code: 'ar', name: 'Arabic' },
  { code: 'as', name: 'Assamese' },
  { code: 'av', name: 'Avaric' },
  { code: 'ay', name: 'Aymara' },
  { code: 'az', name: 'Azerbaijani' },
  { code: 'ba', name: 'Bashkir' },
  { code: 'be', name: 'Belarusian' },
  { code: 'bg', name: 'Bulgarian' },
  { code: 'bi', name: 'Bislama' },
  { code: 'bm', name: 'Bambara' },
  { code: 'bn', name: 'Bengali' },
  { code: 'bo', name: 'Tibetan' },
  { code: 'br', name: 'Breton' },
  { code: 'bs', name: 'Bosnian' },
  { code: 'ca', name: 'Catalan' },
  { code: 'ce', name: 'Chechen' },
  { code: 'ch', name: 'Chamorro' },
  { code: 'co', name: 'Corsican' },
  { code: 'cr', name: 'Cree' },
  { code: 'cs', name: 'Czech' },
  { code: 'cu', name: 'Church Slavic' },
  { code: 'cv', name: 'Chuvash' },
  { code: 'cy', name: 'Welsh' },
  { code: 'da', name: 'Danish' },
  { code: 'de', name: 'German' },
  { code: 'dv', name: 'Divehi' },
  { code: 'dz', name: 'Dzongkha' },
  { code: 'ee', name: 'Ewe' },
  { code: 'el', name: 'Greek' },
  { code: 'en', name: 'English' },
  { code: 'eo', name: 'Esperanto' },
  { code: 'es', name: 'Spanish' },
  { code: 'et', name: 'Estonian' },
  { code: 'eu', name: 'Basque' },
  { code: 'fa', name: 'Persian' },
  { code: 'ff', name: 'Fulah' },
  { code: 'fi', name: 'Finnish' },
  { code: 'fj', name: 'Fijian' },
  { code: 'fo', name: 'Faroese' },
  { code: 'fr', name: 'French' },
  { code: 'fy', name: 'Western Frisian' },
  { code: 'ga', name: 'Irish' },
  { code: 'gd', name: 'Scottish Gaelic' },
  { code: 'gl', name: 'Galician' },
  { code: 'gn', name: 'Guarani' },
  { code: 'gu', name: 'Gujarati' },
  { code: 'gv', name: 'Manx' },
  { code: 'ha', name: 'Hausa' },
  { code: 'he', name: 'Hebrew' },
  { code: 'hi', name: 'Hindi' },
  { code: 'ho', name: 'Hiri Motu' },
  { code: 'hr', name: 'Croatian' },
  { code: 'ht', name: 'Haitian Creole' },
  { code: 'hu', name: 'Hungarian' },
  { code: 'hy', name: 'Armenian' },
  { code: 'hz', name: 'Herero' },
  { code: 'ia', name: 'Interlingua' },
  { code: 'id', name: 'Indonesian' },
  { code: 'ie', name: 'Interlingue' },
  { code: 'ig', name: 'Igbo' },
  { code: 'ii', name: 'Sichuan Yi' },
  { code: 'ik', name: 'Inupiaq' },
  { code: 'io', name: 'Ido' },
  { code: 'is', name: 'Icelandic' },
  { code: 'it', name: 'Italian' },
  { code: 'iu', name: 'Inuktitut' },
  { code: 'ja', name: 'Japanese' },
  { code: 'jv', name: 'Javanese' },
  { code: 'ka', name: 'Georgian' },
  { code: 'kg', name: 'Kongo' },
  { code: 'ki', name: 'Kikuyu' },
  { code: 'kj', name: 'Kuanyama' },
  { code: 'kk', name: 'Kazakh' },
  { code: 'kl', name: 'Kalaallisut' },
  { code: 'km', name: 'Khmer' },
  { code: 'kn', name: 'Kannada' },
  { code: 'ko', name: 'Korean' },
  { code: 'kr', name: 'Kanuri' },
  { code: 'ks', name: 'Kashmiri' },
  { code: 'ku', name: 'Kurdish' },
  { code: 'kv', name: 'Komi' },
  { code: 'kw', name: 'Cornish' },
  { code: 'ky', name: 'Kyrgyz' },
  { code: 'la', name: 'Latin' },
  { code: 'lb', name: 'Luxembourgish' },
  { code: 'lg', name: 'Ganda' },
  { code: 'li', name: 'Limburgish' },
  { code: 'ln', name: 'Lingala' },
  { code: 'lo', name: 'Lao' },
  { code: 'lt', name: 'Lithuanian' },
  { code: 'lu', name: 'Luba-Katanga' },
  { code: 'lv', name: 'Latvian' },
  { code: 'mg', name: 'Malagasy' },
  { code: 'mh', name: 'Marshallese' },
  { code: 'mi', name: 'Maori' },
  { code: 'mk', name: 'Macedonian' },
  { code: 'ml', name: 'Malayalam' },
  { code: 'mn', name: 'Mongolian' },
  { code: 'mr', name: 'Marathi' },
  { code: 'ms', name: 'Malay' },
  { code: 'mt', name: 'Maltese' },
  { code: 'my', name: 'Burmese' },
  { code: 'na', name: 'Nauru' },
  { code: 'nb', name: 'Norwegian Bokmål' },
  { code: 'nd', name: 'North Ndebele' },
  { code: 'ne', name: 'Nepali' },
  { code: 'ng', name: 'Ndonga' },
  { code: 'nl', name: 'Dutch' },
  { code: 'nn', name: 'Norwegian Nynorsk' },
  { code: 'no', name: 'Norwegian' },
  { code: 'nr', name: 'South Ndebele' },
  { code: 'nv', name: 'Navajo' },
  { code: 'ny', name: 'Chichewa' },
  { code: 'oc', name: 'Occitan' },
  { code: 'oj', name: 'Ojibwe' },
  { code: 'om', name: 'Oromo' },
  { code: 'or', name: 'Odia' },
  { code: 'os', name: 'Ossetian' },
  { code: 'pa', name: 'Punjabi' },
  { code: 'pi', name: 'Pali' },
  { code: 'pl', name: 'Polish' },
  { code: 'ps', name: 'Pashto' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'qu', name: 'Quechua' },
  { code: 'rm', name: 'Romansh' },
  { code: 'rn', name: 'Rundi' },
  { code: 'ro', name: 'Romanian' },
  { code: 'ru', name: 'Russian' },
  { code: 'rw', name: 'Kinyarwanda' },
  { code: 'sa', name: 'Sanskrit' },
  { code: 'sc', name: 'Sardinian' },
  { code: 'sd', name: 'Sindhi' },
  { code: 'se', name: 'Northern Sami' },
  { code: 'sg', name: 'Sango' },
  { code: 'si', name: 'Sinhala' },
  { code: 'sk', name: 'Slovak' },
  { code: 'sl', name: 'Slovenian' },
  { code: 'sm', name: 'Samoan' },
  { code: 'sn', name: 'Shona' },
  { code: 'so', name: 'Somali' },
  { code: 'sq', name: 'Albanian' },
  { code: 'sr', name: 'Serbian' },
  { code: 'ss', name: 'Swati' },
  { code: 'st', name: 'Southern Sotho' },
  { code: 'su', name: 'Sundanese' },
  { code: 'sv', name: 'Swedish' },
  { code: 'sw', name: 'Swahili' },
  { code: 'ta', name: 'Tamil' },
  { code: 'te', name: 'Telugu' },
  { code: 'tg', name: 'Tajik' },
  { code: 'th', name: 'Thai' },
  { code: 'ti', name: 'Tigrinya' },
  { code: 'tk', name: 'Turkmen' },
  { code: 'tl', name: 'Tagalog' },
  { code: 'tn', name: 'Tswana' },
  { code: 'to', name: 'Tongan' },
  { code: 'tr', name: 'Turkish' },
  { code: 'ts', name: 'Tsonga' },
  { code: 'tt', name: 'Tatar' },
  { code: 'tw', name: 'Twi' },
  { code: 'ty', name: 'Tahitian' },
  { code: 'ug', name: 'Uyghur' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'ur', name: 'Urdu' },
  { code: 'uz', name: 'Uzbek' },
  { code: 've', name: 'Venda' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'vo', name: 'Volapük' },
  { code: 'wa', name: 'Walloon' },
  { code: 'wo', name: 'Wolof' },
  { code: 'xh', name: 'Xhosa' },
  { code: 'yi', name: 'Yiddish' },
  { code: 'yo', name: 'Yoruba' },
  { code: 'za', name: 'Zhuang' },
  { code: 'zh', name: 'Chinese' },
  { code: 'zu', name: 'Zulu' },
];

// Subtitle-specific options (includes "Off" option)
const SUBTITLE_LANGUAGE_OPTIONS = [
  { code: 'off', name: 'Off (Disabled)' },
  ...LANGUAGE_OPTIONS,
];

const PlayerSettingsScreen: React.FC = () => {
  const { settings, updateSetting } = useSettings();
  const { currentTheme } = useTheme();
  const navigation = useNavigation();
  const isTV = useIsTV();

  // TV focus refs
  const backButtonRef = useRef<FocusableRef>(null);

  // CustomAlert state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');

  // Language picker modal state
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [languageModalType, setLanguageModalType] = useState<'audio' | 'subtitle'>('audio');

  const openAlert = (title: string, message: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  };

  const openLanguagePicker = (type: 'audio' | 'subtitle') => {
    setLanguageModalType(type);
    setLanguageModalVisible(true);
  };

  const getLanguageDisplayName = (code: string, type: 'audio' | 'subtitle'): string => {
    if (type === 'subtitle' && code === 'off') return 'Off (Disabled)';
    if (!code) return 'Auto (First Available)';
    const options = type === 'subtitle' ? SUBTITLE_LANGUAGE_OPTIONS : LANGUAGE_OPTIONS;
    const found = options.find(opt => opt.code === code);
    return found ? found.name : code.toUpperCase();
  };

  const handleLanguageSelect = async (code: string) => {
    if (languageModalType === 'audio') {
      await updateSetting('defaultAudioLanguage', code);
    } else {
      await updateSetting('defaultSubtitleLanguage', code);
      // If setting to 'off', also disable subtitles by default
      await updateSetting('defaultSubtitleEnabled', code !== 'off');
    }
    // Small delay to ensure state update propagates before modal closes
    setTimeout(() => {
      setLanguageModalVisible(false);
    }, 50);
  };

  const playerOptions = [
    {
      id: 'internal',
      title: 'Built-in Player',
      description: 'Use the app\'s default video player',
      icon: 'play-circle-outline',
    },
    ...(Platform.OS === 'ios' ? [
      {
        id: 'vlc',
        title: 'VLC',
        description: 'Open streams in VLC media player',
        icon: 'video-library',
      },
      {
        id: 'infuse',
        title: 'Infuse',
        description: 'Open streams in Infuse player',
        icon: 'smart-display',
      },
      {
        id: 'outplayer',
        title: 'OutPlayer',
        description: 'Open streams in OutPlayer',
        icon: 'slideshow',
      },
      {
        id: 'vidhub',
        title: 'VidHub',
        description: 'Open streams in VidHub player',
        icon: 'ondemand-video',
      },
      {
        id: 'infuse_livecontainer',
        title: 'Infuse Livecontainer',
        description: 'Open streams in Infuse player LiveContainer',
        icon: 'smart-display',
      },
    ] : [
      {
        id: 'external',
        title: 'External Player',
        description: 'Open streams in your preferred video player',
        icon: 'open-in-new',
      },
    ]),
  ];

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: currentTheme.colors.darkBackground },
      ]}
    >
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />

      <View style={styles.header}>
        {!isTV && (
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name="arrow-back"
              size={24}
              color={currentTheme.colors.text}
            />
            <Text style={[styles.backText, { color: currentTheme.colors.text }]}>
              Settings
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.headerActions}>
          {/* Empty for now, but ready for future actions */}
        </View>
      </View>

      <Text style={[styles.headerTitle, { color: currentTheme.colors.text }]}>
        Video Player
      </Text>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              { color: currentTheme.colors.textMuted },
            ]}
          >
            PLAYER SELECTION
          </Text>
          <View
            style={[
              styles.card,
              {
                backgroundColor: currentTheme.colors.elevation2,
              },
              isTV && { overflow: 'visible', backgroundColor: 'transparent', borderWidth: 0 },
            ]}
          >
            {playerOptions.map((option, index) => (
              <SettingItem
                key={option.id}
                title={option.title}
                description={option.description}
                icon={option.icon}
                isSelected={
                  Platform.OS === 'ios'
                    ? settings.preferredPlayer === option.id
                    : settings.useExternalPlayer === (option.id === 'external')
                }
                onPress={() => {
                  if (Platform.OS === 'ios') {
                    updateSetting('preferredPlayer', option.id as AppSettings['preferredPlayer']);
                  } else {
                    updateSetting('useExternalPlayer', option.id === 'external');
                  }
                }}
                isLast={index === playerOptions.length - 1}
                isTV={isTV}
                autoFocus={isTV && index === 0}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              { color: currentTheme.colors.textMuted },
            ]}
          >
            PLAYBACK OPTIONS
          </Text>
          <View
            style={[
              styles.card,
              {
                backgroundColor: currentTheme.colors.elevation2,
              },
              isTV && { overflow: 'visible', backgroundColor: 'transparent', borderWidth: 0 },
            ]}
          >
            {isTV ? (
              <View style={{ marginBottom: 8 }}>
              <Focusable
                onPress={() => updateSetting('autoplayBestStream', !settings.autoplayBestStream)}
                style={[styles.settingItem, { borderBottomWidth: 0, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14 }]}
                borderRadius={14}
                focusScale={1.0}
                animateBackground={false}
                showFocusBorder={true}
              >
                {(focused) => (
                  <View style={styles.settingContent}>
                    <View style={[
                      styles.settingIconContainer,
                      { backgroundColor: focused ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.1)' }
                    ]}>
                      <MaterialIcons
                        name="play-arrow"
                        size={20}
                        color={currentTheme.colors.primary}
                      />
                    </View>
                    <View style={styles.settingText}>
                      <Text
                        style={[
                          styles.settingTitle,
                          { color: currentTheme.colors.text },
                        ]}
                      >
                        Auto-play Best Stream
                      </Text>
                      <Text
                        style={[
                          styles.settingDescription,
                          { color: currentTheme.colors.textMuted },
                        ]}
                      >
                        Automatically start the highest quality stream available.
                      </Text>
                    </View>
                    <View style={styles.tvSwitchContainer}>
                      <View style={[
                        styles.tvSwitchTrack,
                        { backgroundColor: focused ? (settings.autoplayBestStream ? '#333' : '#666') : (settings.autoplayBestStream ? currentTheme.colors.primary : 'rgba(255,255,255,0.2)') }
                      ]}>
                        <View style={[
                          styles.tvSwitchThumb,
                          settings.autoplayBestStream ? styles.tvSwitchThumbOn : styles.tvSwitchThumbOff,
                          { backgroundColor: settings.autoplayBestStream ? '#fff' : '#888' }
                        ]} />
                      </View>
                    </View>
                  </View>
                )}
              </Focusable>
              </View>
            ) : (
              <View style={styles.settingItem}>
                <View style={styles.settingContent}>
                  <View style={[
                    styles.settingIconContainer,
                    { backgroundColor: 'rgba(255,255,255,0.1)' }
                  ]}>
                    <MaterialIcons
                      name="play-arrow"
                      size={20}
                      color={currentTheme.colors.primary}
                    />
                  </View>
                  <View style={styles.settingText}>
                    <Text
                      style={[
                        styles.settingTitle,
                        { color: currentTheme.colors.text },
                      ]}
                    >
                      Auto-play Best Stream
                    </Text>
                    <Text
                      style={[
                        styles.settingDescription,
                        { color: currentTheme.colors.textMuted },
                      ]}
                    >
                      Automatically start the highest quality stream available.
                    </Text>
                  </View>
                  <Switch
                    value={settings.autoplayBestStream}
                    onValueChange={(value) => updateSetting('autoplayBestStream', value)}
                    thumbColor={settings.autoplayBestStream ? currentTheme.colors.primary : undefined}
                  />
                </View>
              </View>
            )}

            {isTV ? (
              <View style={{ marginBottom: 8 }}>
              <Focusable
                onPress={() => updateSetting('alwaysResume', !settings.alwaysResume)}
                style={[styles.settingItem, { borderBottomWidth: 0, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14 }]}
                borderRadius={14}
                focusScale={1.0}
                animateBackground={false}
                showFocusBorder={true}
              >
                {(focused) => (
                  <View style={styles.settingContent}>
                    <View style={[
                      styles.settingIconContainer,
                      { backgroundColor: focused ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.1)' }
                    ]}>
                      <MaterialIcons
                        name="restore"
                        size={20}
                        color={currentTheme.colors.primary}
                      />
                    </View>
                    <View style={styles.settingText}>
                      <Text
                        style={[
                          styles.settingTitle,
                          { color: currentTheme.colors.text },
                        ]}
                      >
                        Always Resume
                      </Text>
                      <Text
                        style={[
                          styles.settingDescription,
                          { color: currentTheme.colors.textMuted },
                        ]}
                      >
                        Skip the resume prompt and automatically continue where you left off (if less than 85% watched).
                      </Text>
                    </View>
                    <View style={styles.tvSwitchContainer}>
                      <View style={[
                        styles.tvSwitchTrack,
                        { backgroundColor: focused ? (settings.alwaysResume ? '#333' : '#666') : (settings.alwaysResume ? currentTheme.colors.primary : 'rgba(255,255,255,0.2)') }
                      ]}>
                        <View style={[
                          styles.tvSwitchThumb,
                          settings.alwaysResume ? styles.tvSwitchThumbOn : styles.tvSwitchThumbOff,
                          { backgroundColor: settings.alwaysResume ? '#fff' : '#888' }
                        ]} />
                      </View>
                    </View>
                  </View>
                )}
              </Focusable>
              </View>
            ) : (
              <View style={styles.settingItem}>
                <View style={styles.settingContent}>
                  <View style={[
                    styles.settingIconContainer,
                    { backgroundColor: 'rgba(255,255,255,0.1)' }
                  ]}>
                    <MaterialIcons
                      name="restore"
                      size={20}
                      color={currentTheme.colors.primary}
                    />
                  </View>
                  <View style={styles.settingText}>
                    <Text
                      style={[
                        styles.settingTitle,
                        { color: currentTheme.colors.text },
                      ]}
                    >
                      Always Resume
                    </Text>
                    <Text
                      style={[
                        styles.settingDescription,
                        { color: currentTheme.colors.textMuted },
                      ]}
                    >
                      Skip the resume prompt and automatically continue where you left off (if less than 85% watched).
                    </Text>
                  </View>
                  <Switch
                    value={settings.alwaysResume}
                    onValueChange={(value) => updateSetting('alwaysResume', value)}
                    thumbColor={settings.alwaysResume ? currentTheme.colors.primary : undefined}
                  />
                </View>
              </View>
            )}

            {/* Hardware Decoding for Android Internal Player - Mobile only */}
            {Platform.OS === 'android' && !settings.useExternalPlayer && !isTV && (
              <View style={[styles.settingItem, styles.settingItemBorder, { borderTopColor: 'rgba(255,255,255,0.08)' }]}>
                <View style={styles.settingContent}>
                  <View style={[
                    styles.settingIconContainer,
                    { backgroundColor: 'rgba(255,255,255,0.1)' }
                  ]}>
                    <MaterialIcons
                      name="memory"
                      size={20}
                      color={currentTheme.colors.primary}
                    />
                  </View>
                  <View style={styles.settingText}>
                    <Text
                      style={[
                        styles.settingTitle,
                        { color: currentTheme.colors.text },
                      ]}
                    >
                      Hardware Decoding
                    </Text>
                    <Text
                      style={[
                        styles.settingDescription,
                        { color: currentTheme.colors.textMuted },
                      ]}
                    >
                      Use GPU for video decoding. May improve performance but can cause issues on some devices.
                    </Text>
                  </View>
                  <Switch
                    value={settings.useHardwareDecoding}
                    onValueChange={(value) => {
                      updateSetting('useHardwareDecoding', value);
                      openAlert(
                        'Restart Required',
                        'Please restart the app for the decoding change to take effect.'
                      );
                    }}
                    thumbColor={settings.useHardwareDecoding ? currentTheme.colors.primary : undefined}
                  />
                </View>
              </View>
            )}

            {/* Audio Passthrough for Android TV - TV only */}
            {Platform.OS === 'android' && isTV && (
              <View style={{ marginBottom: 8 }}>
              <Focusable
                onPress={() => updateSetting('enableAudioPassthrough', !settings.enableAudioPassthrough)}
                style={[styles.settingItem, { borderBottomWidth: 0, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14 }]}
                borderRadius={14}
                focusScale={1.0}
                animateBackground={false}
                showFocusBorder={true}
              >
                {(focused) => (
                  <View style={styles.settingContent}>
                    <View style={[
                      styles.settingIconContainer,
                      { backgroundColor: focused ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.1)' }
                    ]}>
                      <MaterialIcons
                        name="surround-sound"
                        size={20}
                        color={currentTheme.colors.primary}
                      />
                    </View>
                    <View style={styles.settingText}>
                      <Text
                        style={[
                          styles.settingTitle,
                          { color: currentTheme.colors.text },
                        ]}
                      >
                        Audio Passthrough
                      </Text>
                      <Text
                        style={[
                          styles.settingDescription,
                          { color: currentTheme.colors.textMuted },
                        ]}
                      >
                        Send AC3/EAC3/DTS audio directly to your receiver via HDMI. Requires compatible AVR.
                      </Text>
                    </View>
                    <View style={styles.tvSwitchContainer}>
                      <View style={[
                        styles.tvSwitchTrack,
                        { backgroundColor: focused ? (settings.enableAudioPassthrough ? '#333' : '#666') : (settings.enableAudioPassthrough ? currentTheme.colors.primary : 'rgba(255,255,255,0.2)') }
                      ]}>
                        <View style={[
                          styles.tvSwitchThumb,
                          settings.enableAudioPassthrough ? styles.tvSwitchThumbOn : styles.tvSwitchThumbOff,
                          { backgroundColor: settings.enableAudioPassthrough ? '#fff' : '#888' }
                        ]} />
                      </View>
                    </View>
                  </View>
                )}
              </Focusable>
              </View>
            )}

            {/* External Player for Downloads - hide on TV */}
            {!isTV && ((Platform.OS === 'android' && settings.useExternalPlayer) ||
              (Platform.OS === 'ios' && settings.preferredPlayer !== 'internal')) && (
                <View style={[styles.settingItem, styles.settingItemBorder, { borderBottomWidth: 0, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' }]}>
                  <View style={styles.settingContent}>
                    <View style={[
                      styles.settingIconContainer,
                      { backgroundColor: 'rgba(255,255,255,0.1)' }
                    ]}>
                      <MaterialIcons
                        name="open-in-new"
                        size={20}
                        color={currentTheme.colors.primary}
                      />
                    </View>
                    <View style={styles.settingText}>
                      <Text
                        style={[
                          styles.settingTitle,
                          { color: currentTheme.colors.text },
                        ]}
                      >
                        External Player for Downloads
                      </Text>
                      <Text
                        style={[
                          styles.settingDescription,
                          { color: currentTheme.colors.textMuted },
                        ]}
                      >
                        Play downloaded content in your preferred external player.
                      </Text>
                    </View>
                    <Switch
                      value={settings.useExternalPlayerForDownloads}
                      onValueChange={(value) => updateSetting('useExternalPlayerForDownloads', value)}
                      thumbColor={settings.useExternalPlayerForDownloads ? currentTheme.colors.primary : undefined}
                    />
                  </View>
                </View>
              )}
          </View>
        </View>

        {/* Default Tracks Section */}
        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              { color: currentTheme.colors.textMuted },
            ]}
          >
            DEFAULT TRACKS
          </Text>
          <View
            style={[
              styles.card,
              {
                backgroundColor: currentTheme.colors.elevation2,
              },
              isTV && { overflow: 'visible', backgroundColor: 'transparent', borderWidth: 0 },
            ]}
          >
            {/* Default Audio Language */}
            {isTV ? (
              <View style={{ marginBottom: 8 }}>
              <Focusable
                onPress={() => openLanguagePicker('audio')}
                style={[styles.settingItem, { borderBottomWidth: 0, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14 }]}
                borderRadius={14}
                focusScale={1.0}
                animateBackground={false}
                showFocusBorder={true}
              >
                {(focused) => (
                  <View style={styles.settingContent}>
                    <View style={[
                      styles.settingIconContainer,
                      { backgroundColor: focused ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.1)' }
                    ]}>
                      <MaterialIcons
                        name="audiotrack"
                        size={20}
                        color={currentTheme.colors.primary}
                      />
                    </View>
                    <View style={styles.settingText}>
                      <Text
                        style={[
                          styles.settingTitle,
                          { color: currentTheme.colors.text },
                        ]}
                      >
                        Default Audio Language
                      </Text>
                      <Text
                        style={[
                          styles.settingDescription,
                          { color: currentTheme.colors.textMuted },
                        ]}
                      >
                        {getLanguageDisplayName(settings.defaultAudioLanguage, 'audio')}
                      </Text>
                    </View>
                    <MaterialIcons
                      name="chevron-right"
                      size={24}
                      color={currentTheme.colors.textMuted}
                    />
                  </View>
                )}
              </Focusable>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => openLanguagePicker('audio')}
                activeOpacity={0.7}
                style={[styles.settingItem, styles.settingItemBorder, { borderBottomColor: 'rgba(255,255,255,0.08)' }]}
              >
                <View style={styles.settingContent}>
                  <View style={[
                    styles.settingIconContainer,
                    { backgroundColor: 'rgba(255,255,255,0.1)' }
                  ]}>
                    <MaterialIcons
                      name="audiotrack"
                      size={20}
                      color={currentTheme.colors.primary}
                    />
                  </View>
                  <View style={styles.settingText}>
                    <Text
                      style={[
                        styles.settingTitle,
                        { color: currentTheme.colors.text },
                      ]}
                    >
                      Default Audio Language
                    </Text>
                    <Text
                      style={[
                        styles.settingDescription,
                        { color: currentTheme.colors.textMuted },
                      ]}
                    >
                      {getLanguageDisplayName(settings.defaultAudioLanguage, 'audio')}
                    </Text>
                  </View>
                  <MaterialIcons
                    name="chevron-right"
                    size={24}
                    color={currentTheme.colors.textMuted}
                  />
                </View>
              </TouchableOpacity>
            )}

            {/* Default Subtitle Language */}
            {isTV ? (
              <View style={{ marginBottom: 8 }}>
              <Focusable
                onPress={() => openLanguagePicker('subtitle')}
                style={[styles.settingItem, { borderBottomWidth: 0, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14 }]}
                borderRadius={14}
                focusScale={1.0}
                animateBackground={false}
                showFocusBorder={true}
              >
                {(focused) => (
                  <View style={styles.settingContent}>
                    <View style={[
                      styles.settingIconContainer,
                      { backgroundColor: focused ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.1)' }
                    ]}>
                      <MaterialIcons
                        name="subtitles"
                        size={20}
                        color={currentTheme.colors.primary}
                      />
                    </View>
                    <View style={styles.settingText}>
                      <Text
                        style={[
                          styles.settingTitle,
                          { color: currentTheme.colors.text },
                        ]}
                      >
                        Default Subtitle Language
                      </Text>
                      <Text
                        style={[
                          styles.settingDescription,
                          { color: currentTheme.colors.textMuted },
                        ]}
                      >
                        {getLanguageDisplayName(settings.defaultSubtitleLanguage, 'subtitle')}
                      </Text>
                    </View>
                    <MaterialIcons
                      name="chevron-right"
                      size={24}
                      color={currentTheme.colors.textMuted}
                    />
                  </View>
                )}
              </Focusable>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => openLanguagePicker('subtitle')}
                activeOpacity={0.7}
                style={styles.settingItem}
              >
                <View style={styles.settingContent}>
                  <View style={[
                    styles.settingIconContainer,
                    { backgroundColor: 'rgba(255,255,255,0.1)' }
                  ]}>
                    <MaterialIcons
                      name="subtitles"
                      size={20}
                      color={currentTheme.colors.primary}
                    />
                  </View>
                  <View style={styles.settingText}>
                    <Text
                      style={[
                        styles.settingTitle,
                        { color: currentTheme.colors.text },
                      ]}
                    >
                      Default Subtitle Language
                    </Text>
                    <Text
                      style={[
                        styles.settingDescription,
                        { color: currentTheme.colors.textMuted },
                      ]}
                    >
                      {getLanguageDisplayName(settings.defaultSubtitleLanguage, 'subtitle')}
                    </Text>
                  </View>
                  <MaterialIcons
                    name="chevron-right"
                    size={24}
                    color={currentTheme.colors.textMuted}
                  />
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Language Picker Modal */}
      <Modal
        visible={languageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLanguageModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setLanguageModalVisible(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: 'rgba(20, 20, 20, 0.98)' }]}>
            <Text style={[styles.modalTitle, { color: currentTheme.colors.text }]}>
              {languageModalType === 'audio' ? 'Select Audio Language' : 'Select Subtitle Language'}
            </Text>
            <FlatList
              data={languageModalType === 'subtitle' ? SUBTITLE_LANGUAGE_OPTIONS : LANGUAGE_OPTIONS}
              keyExtractor={(item) => item.code}
              style={styles.languageList}
              renderItem={({ item, index }) => {
                const isSelected = languageModalType === 'audio'
                  ? settings.defaultAudioLanguage === item.code
                  : settings.defaultSubtitleLanguage === item.code;

                if (isTV) {
                  return (
                    <Focusable
                      onPress={() => handleLanguageSelect(item.code)}
                      autoFocus={index === 0}
                      style={[
                        styles.languageItem,
                        isSelected && { backgroundColor: 'rgba(255,255,255,0.15)' }
                      ]}
                      borderRadius={8}
                      focusScale={1.02}
                      animateBackground={false}
                      showFocusBorder={true}
                    >
                      {(focused) => (
                        <>
                          <Text style={[
                            styles.languageText,
                            { color: currentTheme.colors.text }
                          ]}>
                            {item.name}
                          </Text>
                          {isSelected && (
                            <MaterialIcons
                              name="check"
                              size={20}
                              color={currentTheme.colors.primary}
                            />
                          )}
                        </>
                      )}
                    </Focusable>
                  );
                }

                return (
                  <TouchableOpacity
                    onPress={() => handleLanguageSelect(item.code)}
                    style={[
                      styles.languageItem,
                      isSelected && { backgroundColor: 'rgba(255,255,255,0.15)' }
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.languageText, { color: currentTheme.colors.text }]}>
                      {item.name}
                    </Text>
                    {isSelected && (
                      <MaterialIcons
                        name="check"
                        size={20}
                        color={currentTheme.colors.primary}
                      />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        onClose={() => setAlertVisible(false)}
      />
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
    paddingBottom: 24,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    paddingHorizontal: 4,
    letterSpacing: 0.5,
  },
  card: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: 'rgba(0,0,0,0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 3,
  },
  settingItem: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  settingItemBorder: {
    borderBottomWidth: 1,
  },
  settingContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 14,
    marginTop: 2,
  },
  checkIcon: {
    marginLeft: 16,
  },
  // TV Toggle styles - thin track with floating thumb
  tvSwitchContainer: {
    width: 51,
    height: 26,
    justifyContent: 'center',
  },
  tvSwitchTrack: {
    width: 51,
    height: 14,
    borderRadius: 7,
    position: 'relative' as const,
  },
  tvSwitchThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    position: 'absolute' as const,
    top: -6,
  },
  tvSwitchThumbOn: {
    right: 0,
  },
  tvSwitchThumbOff: {
    left: 0,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    maxWidth: 400,
    maxHeight: '70%',
    borderRadius: 16,
    overflow: 'hidden',
    paddingVertical: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  languageList: {
    maxHeight: 400,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 8,
    marginHorizontal: 8,
    marginVertical: 2,
  },
  languageText: {
    fontSize: 16,
  },
});

export default PlayerSettingsScreen; 
