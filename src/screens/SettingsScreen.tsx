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
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
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
  setUserPreferences,
} from '../store/slices/userSlice';
import { resetIptv } from '../store/slices/iptvSlice';
import {
  PlayerEngine,
  PLAYER_ENGINES,
  PLAYER_ENGINE_LABELS,
} from '../types/player';
import { colors, gradients, radii } from '../theme/colors';
import AmbientGlow from '../components/mirror/AmbientGlow';
import TmdbLogo from '../components/TmdbLogo';
import {
  clearStoredTmdbApiKey,
  getStoredTmdbApiKey,
  saveStoredTmdbApiKey,
} from '../services/tmdb/tmdbSettings';
import {
  Playlist,
  clearActivePlaylist,
  getPlaylistStore,
  removePlaylist,
  setGlobalPlayerEngine,
  updateActivePlaylist,
} from '../services/playlists/playlistStore';
import { usePlaylists } from '../services/playlists/usePlaylists';
import { storage } from '../utils/storage';
import { removeXtreamPlaylistCache } from '../services/xtream/xtreamPersistence';
import { clearCatalogViewState } from '../hooks/useCatalogViewState';
import type { TabScreenProps } from '../navigation/types';
import type { RootStackParamList } from '../navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const FONT = Platform.select({ ios: 'System', android: 'sans-serif' });
const SWITCH_TRACK = {
  false: 'rgba(255,255,255,0.14)',
  true: colors.indigo,
};
const GRADIENT_START = { x: 0, y: 0 };
const GRADIENT_END = { x: 1, y: 1 };

const ENGINE_ICONS: Record<PlayerEngine, string> = {
  vlc: 'play-circle',
  native: 'mobile-alt',
  'expo-video': 'bolt',
};
const ENGINE_HINTS: Record<PlayerEngine, string> = {
  vlc: 'Best compatibility for live TV and unusual stream formats.',
  native: 'System player (ExoPlayer / AVPlayer). Best for HLS and MP4.',
  'expo-video': 'Alternative system player. Try it if others stutter.',
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

const SettingsScreen: React.FC<TabScreenProps<'Settings'>> = ({ navigation }) => {
  const dispatch = useDispatch<AppDispatch>();
  const queryClient = useQueryClient();
  const { enterPlaylist } = usePlaylists();
  const { playerEngine, useProxy } = useSelector((state: RootState) => state.user);
  const rootNavigation =
    navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
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

  const loadPlaylists = useCallback(async () => {
    const store = await getPlaylistStore();
    setPlaylists(store.playlists);
    setActiveId(store.activeId);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPlaylists();
    }, [loadPlaylists]),
  );

  const hasTmdbApiKeyChanges = tmdbApiKey.trim() !== (savedTmdbApiKey ?? '');
  const canSaveTmdbApiKey =
    hasTmdbApiKeyChanges && !isLoadingTmdbKey && !isSavingTmdbKey;

  // playerEngine is a device-wide preference; useProxy is per-playlist (applied
  // to the active playlist). Both mirror into the Redux user slice for runtime use.
  const handleSelectEngine = useCallback(
    async (engine: PlayerEngine) => {
      dispatch(setUserPreferences({ playerEngine: engine }));
      try {
        await setGlobalPlayerEngine(engine);
      } catch (error) {
        if (__DEV__) console.error('Error saving player preference:', error);
      }
    },
    [dispatch],
  );

  const handleToggleProxy = useCallback(
    async (value: boolean) => {
      dispatch(setUserPreferences({ useProxy: value }));
      try {
        await updateActivePlaylist({ useProxy: value });
      } catch (error) {
        if (__DEV__) console.error('Error saving proxy preference:', error);
      }
    },
    [dispatch],
  );

  const handleSwitchPlaylist = useCallback(
    async (playlist: Playlist) => {
      if (playlist.id === activeId) {
        return;
      }
      if (!rootNavigation) {
        return;
      }
      await enterPlaylist(playlist, rootNavigation);
    },
    [activeId, enterPlaylist, rootNavigation],
  );

  const handleAddPlaylist = useCallback(() => {
    navigation.navigate('Login', { initialTab: 'xtream', mode: 'add' });
  }, [navigation]);

  const handleDeletePlaylist = useCallback(
    (playlist: Playlist) => {
      Alert.alert(
        'Delete playlist',
        `Remove "${playlist.name}"? Its saved watch history will also be cleared.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              const wasActive = playlist.id === activeId;
              try {
                await removePlaylist(playlist.id);
                await storage.clearPlaylistData(playlist.id);
                await removeXtreamPlaylistCache(queryClient, playlist.id);
                clearCatalogViewState(playlist.id);

                if (wasActive) {
                  dispatch(resetIptv());
                  dispatch(clearUserCredentials());
                  rootNavigation?.reset({
                    index: 0,
                    routes: [{ name: 'Login' }],
                  });
                  return;
                }

                await loadPlaylists();
              } catch (error) {
                if (__DEV__) console.error('Error deleting playlist:', error);
                Alert.alert('Could not delete playlist', 'Please try again.');
              }
            },
          },
        ],
      );
    },
    [activeId, dispatch, loadPlaylists, queryClient, rootNavigation],
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
              // Sign out of the active session but keep saved playlists so the
              // user can resume them from the login screen.
              await clearActivePlaylist();
              storage.setActivePlaylistId(null);
              dispatch(resetIptv());
              dispatch(clearUserCredentials());
              rootNavigation?.reset({
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
  }, [dispatch, rootNavigation]);

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
            <View style={styles.playlistSectionHeader}>
              <Text style={styles.sectionTitle}>PLAYLISTS</Text>
              <TouchableOpacity
                style={styles.addPlaylistBtn}
                activeOpacity={0.8}
                onPress={handleAddPlaylist}
              >
                <FontAwesome5 name="plus" size={11} color={colors.indigo} />
                <Text style={styles.addPlaylistText}>Add Xtream</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.settingCard}>
              {playlists.length === 0 ? (
                <Text style={styles.rowHint}>No playlists yet.</Text>
              ) : (
                playlists.map((pl, index) => {
                  const isActive = pl.id === activeId;
                  return (
                    <View
                      key={pl.id}
                      style={[
                        styles.playlistRow,
                        index < playlists.length - 1 && styles.playlistRowDivider,
                      ]}
                    >
                      <TouchableOpacity
                        style={styles.playlistMain}
                        activeOpacity={0.8}
                        onPress={() => handleSwitchPlaylist(pl)}
                      >
                        <View
                          style={[
                            styles.playlistIconTile,
                            isActive && styles.playlistIconTileActive,
                          ]}
                        >
                          <FontAwesome5
                            name={pl.kind === 'activation' ? 'key' : 'server'}
                            size={14}
                            color={isActive ? colors.indigo : colors.fgMuted}
                          />
                        </View>
                        <View style={styles.rowContent}>
                          <Text style={styles.rowLabel} numberOfLines={1}>
                            {pl.name}
                          </Text>
                          <Text style={styles.rowHint}>
                            {isActive
                              ? 'Active'
                              : pl.kind === 'activation'
                                ? 'Activation code'
                                : 'Xtream server'}
                          </Text>
                        </View>
                        {isActive ? (
                          <FontAwesome5
                            name="check-circle"
                            size={18}
                            color={colors.indigo}
                            solid
                          />
                        ) : null}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.playlistDeleteBtn}
                        activeOpacity={0.7}
                        onPress={() => handleDeletePlaylist(pl)}
                      >
                        <FontAwesome5
                          name="trash-alt"
                          size={14}
                          color={colors.fgSubtle}
                        />
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>VIDEO PLAYER</Text>
            <View style={styles.settingCard}>
              {PLAYER_ENGINES.map((engine, index) => {
                const isSelected = engine === playerEngine;
                return (
                  <TouchableOpacity
                    key={engine}
                    style={[
                      styles.playlistRow,
                      index < PLAYER_ENGINES.length - 1 &&
                        styles.playlistRowDivider,
                    ]}
                    activeOpacity={0.8}
                    onPress={() => handleSelectEngine(engine)}
                  >
                    <View
                      style={[
                        styles.playlistIconTile,
                        isSelected && styles.playlistIconTileActive,
                      ]}
                    >
                      <FontAwesome5
                        name={ENGINE_ICONS[engine]}
                        size={15}
                        color={isSelected ? colors.indigo : colors.fgMuted}
                      />
                    </View>
                    <View style={styles.rowContent}>
                      <Text style={styles.rowLabel}>
                        {PLAYER_ENGINE_LABELS[engine]}
                      </Text>
                      <Text style={styles.rowHint}>{ENGINE_HINTS[engine]}</Text>
                    </View>
                    {isSelected ? (
                      <FontAwesome5
                        name="check-circle"
                        size={18}
                        color={colors.indigo}
                        solid
                      />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
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
  playlistSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  addPlaylistBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(139,123,255,0.28)',
    backgroundColor: 'rgba(139,123,255,0.1)',
  },
  addPlaylistText: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '700',
    color: colors.indigo,
  },
  playlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  playlistRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  playlistMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  playlistIconTile: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playlistIconTileActive: {
    backgroundColor: 'rgba(139,123,255,0.12)',
    borderColor: 'rgba(139,123,255,0.28)',
  },
  playlistDeleteBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
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
