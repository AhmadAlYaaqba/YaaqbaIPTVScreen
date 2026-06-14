import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useQueryClient } from '@tanstack/react-query';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import * as Keychain from 'react-native-keychain';
import LinearGradient from 'react-native-linear-gradient';
import Svg, {
  Defs,
  Mask,
  Path,
  Pattern,
  RadialGradient as SvgRadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { RootState, AppDispatch } from '../store';
import {
  clearUserCredentials,
  setUseVlcPlayer,
} from '../store/slices/userSlice';
import { colors, gradients, radii } from '../theme/colors';
import AmbientGlow from '../components/mirror/AmbientGlow';
import TmdbLogo from '../components/TmdbLogo';
import {
  clearStoredTmdbApiKey,
  getStoredTmdbApiKey,
  saveStoredTmdbApiKey,
} from '../services/tmdb/tmdbSettings';

const FONT = Platform.select({ ios: 'System', android: 'sans-serif' });
const SWITCH_TRACK = {
  false: 'rgba(255,255,255,0.14)',
  true: colors.indigo,
};
const GRADIENT_START = { x: 0, y: 0 };
const GRADIENT_END = { x: 1, y: 1 };

type StoredPreference = {
  useVLC?: boolean;
  useProxy?: boolean;
};

function GridBg() {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Pattern
          id="settings-grid"
          width={32}
          height={32}
          patternUnits="userSpaceOnUse"
        >
          <Path
            d="M 32 0 L 0 0 0 32"
            fill="none"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth={1}
          />
        </Pattern>
        <SvgRadialGradient id="settings-grid-fade" cx="50%" cy="18%" r="62%">
          <Stop offset="28%" stopColor="#fff" stopOpacity={1} />
          <Stop offset="78%" stopColor="#fff" stopOpacity={0} />
        </SvgRadialGradient>
        <Mask id="settings-grid-mask">
          <Rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="url(#settings-grid-fade)"
          />
        </Mask>
      </Defs>
      <Rect
        x="0"
        y="0"
        width="100%"
        height="100%"
        fill="url(#settings-grid)"
        mask="url(#settings-grid-mask)"
      />
    </Svg>
  );
}

const SettingsScreen: React.FC<any> = ({ navigation }) => {
  const dispatch = useDispatch<AppDispatch>();
  const queryClient = useQueryClient();
  const { useVLC, useProxy } = useSelector((state: RootState) => state.user);
  const [tmdbApiKey, setTmdbApiKey] = useState('');
  const [savedTmdbApiKey, setSavedTmdbApiKey] = useState<string | null>(null);
  const [showTmdbApiKey, setShowTmdbApiKey] = useState(false);
  const [isLoadingTmdbKey, setIsLoadingTmdbKey] = useState(true);
  const [isSavingTmdbKey, setIsSavingTmdbKey] = useState(false);

  useEffect(() => {
    let mounted = true;

    getStoredTmdbApiKey()
      .then(apiKey => {
        if (!mounted) {
          return;
        }
        setSavedTmdbApiKey(apiKey);
        setTmdbApiKey(apiKey ?? '');
      })
      .finally(() => {
        if (mounted) {
          setIsLoadingTmdbKey(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const hasTmdbApiKeyChanges = tmdbApiKey.trim() !== (savedTmdbApiKey ?? '');
  const canSaveTmdbApiKey =
    hasTmdbApiKeyChanges && !isLoadingTmdbKey && !isSavingTmdbKey;

  const persistPreference = useCallback(async (next: StoredPreference) => {
    try {
      const creds = await Keychain.getGenericPassword({
        service: 'my-iptv-credentials',
      });
      if (creds) {
        const parsed = JSON.parse(creds.password);
        await Keychain.setGenericPassword(
          'xtream-creds',
          JSON.stringify({ ...parsed, ...next }),
          { service: 'my-iptv-credentials' },
        );
      }
    } catch (error) {
      if (__DEV__) console.error('Error saving settings preference:', error);
    }
  }, []);

  const handleTogglePlayer = useCallback(
    async (value: boolean) => {
      dispatch(setUseVlcPlayer({ useVLC: value }));
      await persistPreference({ useVLC: value });
    },
    [dispatch, persistPreference],
  );

  const handleToggleProxy = useCallback(
    async (value: boolean) => {
      dispatch(setUseVlcPlayer({ useProxy: value }));
      await persistPreference({ useProxy: value });
    },
    [dispatch, persistPreference],
  );

  const handleSaveTmdbApiKey = useCallback(async () => {
    if (!tmdbApiKey.trim()) {
      Alert.alert(
        'TMDB API key',
        'Enter your TMDB API key, or use Clear to remove the saved key.',
      );
      return;
    }

    try {
      setIsSavingTmdbKey(true);
      const savedKey = await saveStoredTmdbApiKey(tmdbApiKey);
      setSavedTmdbApiKey(savedKey);
      setTmdbApiKey(savedKey ?? '');
      await queryClient.invalidateQueries({ queryKey: ['tmdb'] });
      Alert.alert('TMDB API key saved', 'TMDB metadata is enabled on this device.');
    } catch (error) {
      if (__DEV__) console.error('Error saving TMDB API key:', error);
      Alert.alert('Could not save key', 'Please try again.');
    } finally {
      setIsSavingTmdbKey(false);
    }
  }, [queryClient, tmdbApiKey]);

  const handleClearTmdbApiKey = useCallback(() => {
    if (!savedTmdbApiKey && !tmdbApiKey.trim()) {
      return;
    }

    Alert.alert(
      'Clear TMDB API key',
      'TMDB artwork and metadata will stop loading until a new key is saved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsSavingTmdbKey(true);
              await clearStoredTmdbApiKey();
              setSavedTmdbApiKey(null);
              setTmdbApiKey('');
              await queryClient.invalidateQueries({ queryKey: ['tmdb'] });
            } catch (error) {
              if (__DEV__) console.error('Error clearing TMDB API key:', error);
              Alert.alert('Could not clear key', 'Please try again.');
            } finally {
              setIsSavingTmdbKey(false);
            }
          },
        },
      ],
    );
  }, [queryClient, savedTmdbApiKey, tmdbApiKey]);

  const handleLogout = useCallback(async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await Keychain.resetGenericPassword({ service: 'my-iptv-credentials' });
              dispatch(clearUserCredentials());
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            } catch (error) {
              if (__DEV__) console.error('Error during logout:', error);
            }
          },
        },
      ],
    );
  }, [dispatch, navigation]);

  return (
    <View style={styles.root}>
      <AmbientGlow />
      <GridBg />
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            activeOpacity={0.75}
            onPress={() =>
              navigation.canGoBack()
                ? navigation.goBack()
                : navigation.navigate('Home')
            }
          >
            <FontAwesome5 name="chevron-left" size={17} color={colors.fg} />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>SETTINGS</Text>
            <Text style={styles.headerTitle}>Playback setup</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroCard}>
            <LinearGradient
              colors={['rgba(139,123,255,0.12)', 'rgba(14,20,40,0.34)']}
              start={GRADIENT_START}
              end={GRADIENT_END}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View style={styles.heroIcon}>
              <LinearGradient
                colors={gradients.triad as unknown as string[]}
                start={GRADIENT_START}
                end={GRADIENT_END}
                style={StyleSheet.absoluteFill}
              />
              <FontAwesome5 name="sliders-h" size={18} color={colors.fg} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>Stream controls</Text>
              <Text style={styles.heroText}>
                Tune playback compatibility and connection routing for this
                device.
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>VIDEO PLAYER</Text>
            <View style={styles.settingCard}>
              <View style={styles.row}>
                <View style={styles.playerIconTile}>
                  <FontAwesome5
                    name="play-circle"
                    size={17}
                    color={colors.indigo}
                  />
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>Use VLC Player</Text>
                  <Text style={styles.rowHint}>
                    Better compatibility for streams that fail in the default
                    player.
                  </Text>
                </View>
                <Switch
                  value={useVLC}
                  onValueChange={handleTogglePlayer}
                  trackColor={SWITCH_TRACK}
                  thumbColor={useVLC ? colors.fg : colors.fgSubtle}
                  ios_backgroundColor="rgba(255,255,255,0.14)"
                />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PROXY</Text>
            <View style={styles.settingCard}>
              <View style={styles.row}>
                <View style={styles.proxyIconTile}>
                  <FontAwesome5 name="shield-alt" size={16} color={colors.cyan} />
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>Use HTTP Proxy</Text>
                  <Text style={styles.rowHint}>
                    Route API and stream traffic through the configured proxy.
                  </Text>
                </View>
                <Switch
                  value={useProxy}
                  onValueChange={handleToggleProxy}
                  trackColor={SWITCH_TRACK}
                  thumbColor={useProxy ? colors.fg : colors.fgSubtle}
                  ios_backgroundColor="rgba(255,255,255,0.14)"
                />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>TMDB METADATA</Text>
            <View style={styles.settingCard}>
              <View style={styles.tmdbHeader}>
                <View style={styles.tmdbIconTile}>
                  <FontAwesome5 name="film" size={16} color={colors.cyan} />
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>TMDB API key</Text>
                  <Text style={styles.rowHint}>
                    Save your own key securely on this device for posters, cast,
                    ratings, and episode artwork.
                  </Text>
                </View>
              </View>

              <View style={styles.tmdbInputRow}>
                <TextInput
                  value={tmdbApiKey}
                  onChangeText={setTmdbApiKey}
                  editable={!isLoadingTmdbKey && !isSavingTmdbKey}
                  placeholder="Paste your TMDB API key"
                  placeholderTextColor={colors.fgSubtle}
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  secureTextEntry={!showTmdbApiKey}
                  style={styles.tmdbInput}
                />
                <TouchableOpacity
                  style={styles.tmdbVisibilityButton}
                  activeOpacity={0.75}
                  onPress={() => setShowTmdbApiKey(value => !value)}
                >
                  <FontAwesome5
                    name={showTmdbApiKey ? 'eye-slash' : 'eye'}
                    size={14}
                    color={colors.fgMuted}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.tmdbActions}>
                <TouchableOpacity
                  style={[
                    styles.tmdbSaveButton,
                    !canSaveTmdbApiKey && styles.tmdbSaveButtonDisabled,
                  ]}
                  activeOpacity={0.82}
                  disabled={!canSaveTmdbApiKey}
                  onPress={handleSaveTmdbApiKey}
                >
                  {isSavingTmdbKey ? (
                    <ActivityIndicator size="small" color={colors.fg} />
                  ) : (
                    <FontAwesome5 name="lock" size={13} color={colors.fg} />
                  )}
                  <Text style={styles.tmdbSaveText}>Save key</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.tmdbClearButton}
                  activeOpacity={0.75}
                  disabled={isLoadingTmdbKey || isSavingTmdbKey}
                  onPress={handleClearTmdbApiKey}
                >
                  <Text style={styles.tmdbClearText}>Clear</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.tmdbAttribution}>
                <View style={styles.tmdbLogoWrap}>
                  <TmdbLogo />
                </View>
                <Text style={styles.tmdbAttributionText}>
                  This product uses the TMDB API but is not endorsed or
                  certified by TMDB.
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.actionSection}>
            <TouchableOpacity
              style={styles.logoutButton}
              activeOpacity={0.82}
              onPress={handleLogout}
            >
              <FontAwesome5
                name="sign-out-alt"
                size={16}
                color={colors.danger}
              />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

export default SettingsScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    alignItems: 'center',
  },
  eyebrow: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1.8,
    color: colors.indigo,
  },
  headerTitle: {
    fontFamily: FONT,
    color: colors.fg,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  headerSpacer: {
    width: 44,
    height: 44,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 20,
    paddingBottom: 120,
  },
  heroCard: {
    marginHorizontal: 20,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    padding: 18,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  heroTitle: {
    fontFamily: FONT,
    fontSize: 18,
    fontWeight: '700',
    color: colors.fg,
  },
  heroText: {
    fontFamily: FONT,
    fontSize: 13,
    lineHeight: 19,
    color: colors.fgMuted,
    marginTop: 4,
  },
  section: {
    marginTop: 22,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '700',
    color: colors.fgSubtle,
    marginBottom: 10,
    letterSpacing: 1.3,
  },
  settingCard: {
    backgroundColor: colors.panel,
    borderRadius: radii.card,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playerIconTile: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(139,123,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(139,123,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  proxyIconTile: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(34,211,238,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tmdbHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tmdbIconTile: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(34,211,238,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: {
    flex: 1,
    minWidth: 0,
  },
  rowLabel: {
    fontFamily: FONT,
    fontSize: 16,
    color: colors.fg,
    fontWeight: '700',
  },
  rowHint: {
    fontFamily: FONT,
    fontSize: 12,
    lineHeight: 17,
    color: colors.fgMuted,
    marginTop: 4,
  },
  tmdbInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
  },
  tmdbInput: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 14,
    fontFamily: FONT,
    fontSize: 14,
    color: colors.fg,
  },
  tmdbVisibilityButton: {
    width: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tmdbActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  tmdbSaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: radii.lg,
    backgroundColor: colors.indigo,
    gap: 8,
  },
  tmdbSaveButtonDisabled: {
    opacity: 0.45,
  },
  tmdbSaveText: {
    fontFamily: FONT,
    color: colors.fg,
    fontSize: 14,
    fontWeight: '700',
  },
  tmdbClearButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tmdbClearText: {
    fontFamily: FONT,
    color: colors.fgMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  tmdbAttribution: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  tmdbLogoWrap: {
    alignSelf: 'flex-start',
  },
  tmdbAttributionText: {
    fontFamily: FONT,
    fontSize: 11,
    lineHeight: 16,
    color: colors.fgSubtle,
  },
  actionSection: {
    marginTop: 30,
    paddingHorizontal: 20,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239,68,68,0.09)',
    borderRadius: radii.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.34)',
    gap: 8,
  },
  logoutText: {
    fontFamily: FONT,
    color: colors.danger,
    fontSize: 16,
    fontWeight: '700',
  },
});
