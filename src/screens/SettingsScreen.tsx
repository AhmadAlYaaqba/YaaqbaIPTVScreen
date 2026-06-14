import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
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
  const { useVLC, useProxy } = useSelector((state: RootState) => state.user);

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
