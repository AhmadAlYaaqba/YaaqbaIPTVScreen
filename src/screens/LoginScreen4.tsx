/* eslint-disable no-bitwise */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
  Switch,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import axios from 'axios';
import DeviceInfo from 'react-native-device-info';
import { useSelector } from 'react-redux';
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

import { RootState } from '../store';
import { proxyApiUrl } from '../utils/proxy';
import {
  buildPlayerApiUrl,
  parseServerUrl,
  XTREAM_REQUEST_HEADERS,
} from '../utils/xtream';
import { colors, gradients, radii } from '../theme/colors';
import AmbientGlow from '../components/mirror/AmbientGlow';
import {
  Playlist,
  addOrUpdatePlaylist,
  getPlaylists,
} from '../services/playlists/playlistStore';
import { usePlaylists } from '../services/playlists/usePlaylists';

const SECRET_KEY = '5w.=:uehB3#jwUJ';
const FONT = Platform.select({ ios: 'System', android: 'sans-serif' });
const MONO = Platform.select({ ios: 'Menlo', android: 'monospace' });
const GRADIENT_START = { x: 0, y: 0 };
const GRADIENT_END = { x: 1, y: 1 };
const SWITCH_TRACK = {
  false: 'rgba(255,255,255,0.14)',
  true: colors.cyan,
};

type TabKey = 'activation' | 'xtream';

function GridBg() {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Pattern
          id="login-grid"
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
        <SvgRadialGradient id="login-grid-fade" cx="50%" cy="22%" r="66%">
          <Stop offset="28%" stopColor="#fff" stopOpacity={1} />
          <Stop offset="78%" stopColor="#fff" stopOpacity={0} />
        </SvgRadialGradient>
        <Mask id="login-grid-mask">
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#login-grid-fade)" />
        </Mask>
      </Defs>
      <Rect
        x="0"
        y="0"
        width="100%"
        height="100%"
        fill="url(#login-grid)"
        mask="url(#login-grid-mask)"
      />
    </Svg>
  );
}

const xorEncrypt = (input: string) => {
  let result = '';
  for (let i = 0; i < input.length; i++) {
    const charCode =
      input.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length);
    result += String.fromCharCode(charCode);
  }
  return result;
};

const xorDecrypt = (input: string) => xorEncrypt(input); // XOR is symmetric

interface Props {
  navigation: any;
  route: any;
}

const LoginScreen4: React.FC<Props> = ({ navigation, route }) => {
  const initialTab: TabKey = route?.params?.initialTab ?? 'activation';
  const isAddMode = route?.params?.mode === 'add';

  const { username, password, serverDomain, serverPort } = useSelector(
    (state: RootState) => state.user,
  );
  const { enterPlaylist } = usePlaylists();

  const [tab, setTab] = useState<TabKey>(initialTab);
  const [useProxy, setUseProxy] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedPlaylists, setSavedPlaylists] = useState<Playlist[]>([]);

  // Activation tab state
  const [activationCode, setActivationCode] = useState('');

  // Xtream tab state
  const [xtreamName, setXtreamName] = useState('');
  const [xtreamUsername, setXtreamUsername] = useState('');
  const [xtreamPassword, setXtreamPassword] = useState('');
  const [xtreamUrl, setXtreamUrl] = useState('');

  useEffect(() => {
    getPlaylists().then(setSavedPlaylists);
  }, []);

  // In normal (non-add) flow, if a session was restored on boot, jump to Main.
  useEffect(() => {
    if (!isAddMode && username && password && serverDomain && serverPort) {
      navigation.replace('Main');
    }
  }, [isAddMode, username, password, serverDomain, serverPort, navigation]);

  const handleCodeChange = (txt: string) => {
    setActivationCode(txt.replace(/-/g, '').replace(/[^a-zA-Z0-9]/g, ''));
  };

  const buildEncryptedPayload = async (code: string) => {
    const mac = (await DeviceInfo.getMacAddress()) || '00:00:00:00:00:00';
    const payload = {
      mac,
      sn: mac,
      code,
      mode: 'active',
      model: DeviceInfo.getModel(),
      group: 0,
    };
    return xorEncrypt(JSON.stringify(payload));
  };

  const handleActivation = async () => {
    if (!activationCode) {
      setError('Please enter your activation code.');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const encryptedPayload = await buildEncryptedPayload(activationCode);
      const body = new URLSearchParams();
      body.append('json', encryptedPayload);

      const activationUrl = proxyApiUrl(
        'http://screen-net.live/iptv/V7.php/',
        useProxy,
      );
      if (__DEV__) console.log('[Login] activation POST →', activationUrl);
      const { data: encryptedResponse } = await axios.post(
        activationUrl,
        body.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'okhttp/4.3.1',
          },
          responseType: 'text',
        },
      );

      const parsed = JSON.parse(xorDecrypt(encryptedResponse));
      if (__DEV__) console.log('Parsed response:', parsed);
      if (parsed.status === 103) {
        setError('Activation failed. Please check your code or try again later.');
        return;
      }

      const playlist = await addOrUpdatePlaylist({
        name: activationCode,
        kind: 'activation',
        username: parsed.username,
        password: parsed.password,
        serverDomain: 'screen-net.live',
        serverPort: parsed.server_info.port.replace(':', ''),
        useProxy,
      });

      await enterPlaylist(playlist, navigation);
    } catch (e: any) {
      if (__DEV__) console.error(e);
      setError('Activation failed. Please check your code or try again later.');
      Alert.alert('Activation failed', e.message ?? 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddXtream = async () => {
    if (!xtreamName || !xtreamUsername || !xtreamPassword || !xtreamUrl) {
      setError('Please fill in all fields.');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      // Parse the entered URL into domain + port. A non-empty port matters:
      // content screens only fetch when serverPort is truthy.
      const { domain, port } = parseServerUrl(xtreamUrl);

      // Validate credentials against the Xtream player API before saving.
      const originalUrl = buildPlayerApiUrl({
        domain,
        port,
        username: xtreamUsername.trim(),
        password: xtreamPassword.trim(),
        action: '',
      });
      const requestUrl = proxyApiUrl(originalUrl, useProxy);
      if (__DEV__) {
        console.log('[Login] xtream verify →', originalUrl);
        console.log('[Login] xtream verify (request) →', requestUrl);
      }
      const response = await axios.get(requestUrl, {
        headers: XTREAM_REQUEST_HEADERS,
        timeout: 15000,
      });

      const userInfo = response?.data?.user_info;
      if (!userInfo || userInfo.auth !== 1) {
        setError('Could not verify this server. Check the URL and credentials.');
        return;
      }

      const playlist = await addOrUpdatePlaylist({
        name: xtreamName.trim(),
        kind: 'xtream',
        username: xtreamUsername.trim(),
        password: xtreamPassword.trim(),
        serverDomain: domain,
        serverPort: port,
        useProxy,
      });

      await enterPlaylist(playlist, navigation);
    } catch (e: any) {
      if (__DEV__) console.error(e);
      setError('Could not connect. Please check the server URL and your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResume = async (playlist: Playlist) => {
    setError(null);
    await enterPlaylist(playlist, navigation);
  };

  const renderTabButton = (key: TabKey, label: string, icon: string) => {
    const active = tab === key;
    return (
      <TouchableOpacity
        style={[styles.tabButton, active && styles.tabButtonActive]}
        activeOpacity={0.85}
        onPress={() => {
          setError(null);
          setTab(key);
        }}
      >
        <FontAwesome5
          name={icon}
          size={13}
          color={active ? colors.scene : colors.fgMuted}
          solid={active}
        />
        <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.root}>
      <AmbientGlow />
      <GridBg />
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandBlock}>
            <LinearGradient
              colors={gradients.triad as unknown as string[]}
              start={GRADIENT_START}
              end={GRADIENT_END}
              style={styles.logoRing}
            >
              <View style={styles.logoInner}>
                <FontAwesome5 name="tv" color={colors.indigo} size={24} />
              </View>
            </LinearGradient>
            <Text style={styles.eyebrow}>WELCOME TO</Text>
            <Text style={styles.title}>ScreenIPTV</Text>
            <Text style={styles.subtitle}>
              {isAddMode
                ? 'Add another playlist to this device.'
                : 'Activate this device or add your Xtream server.'}
            </Text>
          </View>

          <View style={styles.tabBar}>
            {renderTabButton('activation', 'Activation Code', 'key')}
            {renderTabButton('xtream', 'Xtream Server', 'server')}
          </View>

          <View style={styles.card}>
            <LinearGradient
              colors={['rgba(139,123,255,0.12)', 'rgba(14,20,40,0.36)']}
              start={GRADIENT_START}
              end={GRADIENT_END}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />

            {tab === 'activation' ? (
              <>
                <View style={styles.inputHeader}>
                  <View>
                    <Text style={styles.inputEyebrow}>ACTIVATION CODE</Text>
                    <Text style={styles.inputTitle}>Enter your code</Text>
                  </View>
                  <View style={styles.codeIcon}>
                    <FontAwesome5 name="key" size={15} color={colors.cyan} />
                  </View>
                </View>

                <TextInput
                  style={styles.input}
                  value={activationCode}
                  onChangeText={handleCodeChange}
                  placeholder="XXXX-XXXX-XXXX"
                  placeholderTextColor={colors.fgSubtle}
                  maxLength={14}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  inputMode="text"
                  selectionColor={colors.indigo}
                />

                <TouchableOpacity
                  style={[styles.button, isLoading && styles.buttonDisabled]}
                  activeOpacity={0.86}
                  onPress={handleActivation}
                  disabled={isLoading}
                >
                  <LinearGradient
                    colors={gradients.progress as unknown as string[]}
                    start={GRADIENT_START}
                    end={GRADIENT_END}
                    style={StyleSheet.absoluteFill}
                  />
                  {isLoading ? (
                    <>
                      <ActivityIndicator color={colors.scene} />
                      <Text style={styles.buttonText}>Activating...</Text>
                    </>
                  ) : (
                    <>
                      <FontAwesome5 name="bolt" size={14} color={colors.scene} solid />
                      <Text style={styles.buttonText}>Activate</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.inputHeader}>
                  <View>
                    <Text style={styles.inputEyebrow}>XTREAM SERVER</Text>
                    <Text style={styles.inputTitle}>Add a playlist</Text>
                  </View>
                  <View style={styles.codeIcon}>
                    <FontAwesome5 name="server" size={15} color={colors.cyan} />
                  </View>
                </View>

                <TextInput
                  style={styles.fieldInput}
                  value={xtreamName}
                  onChangeText={setXtreamName}
                  placeholder="Playlist name"
                  placeholderTextColor={colors.fgSubtle}
                  autoCapitalize="words"
                  autoCorrect={false}
                  selectionColor={colors.indigo}
                />
                <TextInput
                  style={styles.fieldInput}
                  value={xtreamUsername}
                  onChangeText={setXtreamUsername}
                  placeholder="Username"
                  placeholderTextColor={colors.fgSubtle}
                  autoCapitalize="none"
                  autoCorrect={false}
                  selectionColor={colors.indigo}
                />
                <TextInput
                  style={styles.fieldInput}
                  value={xtreamPassword}
                  onChangeText={setXtreamPassword}
                  placeholder="Password"
                  placeholderTextColor={colors.fgSubtle}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                  selectionColor={colors.indigo}
                />
                <TextInput
                  style={styles.fieldInput}
                  value={xtreamUrl}
                  onChangeText={setXtreamUrl}
                  placeholder="Server URL (e.g. http://example.com:8080)"
                  placeholderTextColor={colors.fgSubtle}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  selectionColor={colors.indigo}
                />

                <TouchableOpacity
                  style={[styles.button, isLoading && styles.buttonDisabled]}
                  activeOpacity={0.86}
                  onPress={handleAddXtream}
                  disabled={isLoading}
                >
                  <LinearGradient
                    colors={gradients.progress as unknown as string[]}
                    start={GRADIENT_START}
                    end={GRADIENT_END}
                    style={StyleSheet.absoluteFill}
                  />
                  {isLoading ? (
                    <>
                      <ActivityIndicator color={colors.scene} />
                      <Text style={styles.buttonText}>Connecting...</Text>
                    </>
                  ) : (
                    <>
                      <FontAwesome5 name="plus" size={14} color={colors.scene} solid />
                      <Text style={styles.buttonText}>Add playlist</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}

            {error ? (
              <View style={styles.errorBox}>
                <FontAwesome5
                  name="exclamation-circle"
                  color={colors.danger}
                  size={14}
                />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.proxyCard}>
            <View style={styles.proxyIconTile}>
              <FontAwesome5 name="shield-alt" size={15} color={colors.cyan} />
            </View>
            <View style={styles.proxyCopy}>
              <Text style={styles.proxyLabel}>Use HTTP Proxy</Text>
              <Text style={styles.proxyHint}>
                Route this playlist's traffic through the configured proxy.
              </Text>
            </View>
            <Switch
              value={useProxy}
              onValueChange={setUseProxy}
              trackColor={SWITCH_TRACK}
              thumbColor={useProxy ? colors.fg : colors.fgSubtle}
              ios_backgroundColor="rgba(255,255,255,0.14)"
            />
          </View>

          {savedPlaylists.length > 0 ? (
            <View style={styles.savedBlock}>
              <Text style={styles.savedTitle}>YOUR PLAYLISTS</Text>
              {savedPlaylists.map(pl => (
                <TouchableOpacity
                  key={pl.id}
                  style={styles.savedRow}
                  activeOpacity={0.8}
                  onPress={() => handleResume(pl)}
                  disabled={isLoading}
                >
                  <View style={styles.savedIcon}>
                    <FontAwesome5
                      name={pl.kind === 'activation' ? 'key' : 'server'}
                      size={13}
                      color={colors.indigo}
                    />
                  </View>
                  <View style={styles.savedCopy}>
                    <Text style={styles.savedName} numberOfLines={1}>
                      {pl.name}
                    </Text>
                    <Text style={styles.savedKind}>
                      {pl.kind === 'activation' ? 'Activation code' : 'Xtream server'}
                    </Text>
                  </View>
                  <FontAwesome5
                    name="chevron-right"
                    size={13}
                    color={colors.fgSubtle}
                  />
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          {isAddMode ? (
            <TouchableOpacity
              style={styles.cancelBtn}
              activeOpacity={0.8}
              onPress={() =>
                navigation.canGoBack()
                  ? navigation.goBack()
                  : navigation.navigate('Main')
              }
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.footer}>
              <Text style={styles.footerText}>Need help? Contact support</Text>
              <Text style={styles.footerSubText}>ScreenIPTV activation portal</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  safe: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 56,
  },
  brandBlock: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoRing: {
    width: 62,
    height: 62,
    borderRadius: 20,
    padding: 1.5,
    marginBottom: 16,
  },
  logoInner: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1.8,
    color: colors.indigo,
    marginBottom: 6,
  },
  title: {
    fontFamily: FONT,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    color: colors.fg,
  },
  subtitle: {
    fontFamily: FONT,
    fontSize: 14,
    lineHeight: 21,
    color: colors.fgMuted,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 300,
  },
  tabBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    padding: 4,
    borderRadius: radii.lg,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 11,
    borderRadius: radii.md,
  },
  tabButtonActive: {
    backgroundColor: colors.indigo,
  },
  tabText: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '700',
    color: colors.fgMuted,
  },
  tabTextActive: {
    color: colors.scene,
  },
  card: {
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    overflow: 'hidden',
    padding: 18,
  },
  inputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  inputEyebrow: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.3,
    color: colors.fgSubtle,
  },
  inputTitle: {
    fontFamily: FONT,
    fontSize: 18,
    fontWeight: '700',
    color: colors.fg,
    marginTop: 3,
  },
  codeIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: 'rgba(34,211,238,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    height: 58,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.lg,
    fontFamily: MONO,
    fontSize: 18,
    letterSpacing: 1.2,
    color: colors.fg,
    paddingHorizontal: 16,
    backgroundColor: colors.glass,
  },
  fieldInput: {
    height: 50,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.lg,
    fontFamily: FONT,
    fontSize: 15,
    color: colors.fg,
    paddingHorizontal: 14,
    backgroundColor: colors.glass,
    marginBottom: 12,
  },
  button: {
    height: 52,
    borderRadius: radii.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    overflow: 'hidden',
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontFamily: FONT,
    color: colors.scene,
    fontSize: 16,
    fontWeight: '800',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239,68,68,0.09)',
    borderColor: 'rgba(239,68,68,0.34)',
    borderWidth: 1,
    borderRadius: radii.md,
    padding: 12,
    marginTop: 16,
  },
  errorText: {
    flex: 1,
    fontFamily: FONT,
    color: colors.danger,
    fontSize: 12.5,
    lineHeight: 18,
  },
  proxyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
    backgroundColor: colors.panel,
    borderRadius: radii.card,
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  proxyIconTile: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: 'rgba(34,211,238,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  proxyCopy: {
    flex: 1,
    minWidth: 0,
  },
  proxyLabel: {
    fontFamily: FONT,
    color: colors.fg,
    fontSize: 15,
    fontWeight: '700',
  },
  proxyHint: {
    fontFamily: FONT,
    color: colors.fgMuted,
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 3,
  },
  savedBlock: {
    marginTop: 22,
  },
  savedTitle: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.3,
    color: colors.fgSubtle,
    marginBottom: 10,
  },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.panel,
    borderRadius: radii.card,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  savedIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(139,123,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(139,123,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedCopy: {
    flex: 1,
    minWidth: 0,
  },
  savedName: {
    fontFamily: FONT,
    color: colors.fg,
    fontSize: 15,
    fontWeight: '700',
  },
  savedKind: {
    fontFamily: FONT,
    color: colors.fgMuted,
    fontSize: 11.5,
    marginTop: 2,
  },
  cancelBtn: {
    marginTop: 24,
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelText: {
    fontFamily: FONT,
    color: colors.fgMuted,
    fontSize: 15,
    fontWeight: '700',
  },
  footer: {
    marginTop: 30,
    alignItems: 'center',
  },
  footerText: {
    fontFamily: FONT,
    color: colors.fgMuted,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  footerSubText: {
    fontFamily: FONT,
    color: colors.fgSubtle,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 5,
  },
});

export default LoginScreen4;
