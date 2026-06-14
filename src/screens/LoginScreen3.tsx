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
  SafeAreaView,
  Platform,
} from 'react-native';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import axios from 'axios';
import * as Keychain from 'react-native-keychain';
import DeviceInfo from 'react-native-device-info';
import { useDispatch, useSelector } from 'react-redux';
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

import { AppDispatch, RootState } from '../store';
import { setUserCredentials } from '../store/slices/userSlice';
import { proxyApiUrl } from '../utils/proxy';
import { colors, gradients, radii } from '../theme/colors';
import AmbientGlow from '../components/mirror/AmbientGlow';

const SECRET_KEY = '5w.=:uehB3#jwUJ';
const FONT = Platform.select({ ios: 'System', android: 'sans-serif' });
const MONO = Platform.select({ ios: 'Menlo', android: 'monospace' });
const GRADIENT_START = { x: 0, y: 0 };
const GRADIENT_END = { x: 1, y: 1 };
const SWITCH_TRACK = {
  false: 'rgba(255,255,255,0.14)',
  true: colors.cyan,
};

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
          <Rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="url(#login-grid-fade)"
          />
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
}

const ActivationScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { username, password, serverDomain, serverPort } = useSelector(
    (state: RootState) => state.user,
  );

  const [activationCode, setActivationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const proxyFromRedux = useSelector((state: RootState) => state.user.useProxy);
  const [useProxy, setUseProxy] = useState(proxyFromRedux);

  useEffect(() => {
    const loadProxyPref = async () => {
      try {
        const creds = await Keychain.getGenericPassword({ service: 'my-iptv-credentials' });
        if (creds) {
          const parsed = JSON.parse(creds.password);
          const stored = parsed.useProxy ?? parsed.vlcUseProxy ?? true;
          setUseProxy(stored);
          dispatch(setUserCredentials({ useProxy: stored }));
        }
      } catch {}
    };
    loadProxyPref();
  }, [dispatch]);

  useEffect(() => {
    if (username && password && serverDomain && serverPort) {
      navigation.replace('Main');
    }
  }, [username, password, serverDomain, serverPort, navigation]);

  const handleToggleProxy = async (value: boolean) => {
    setUseProxy(value);
    dispatch(setUserCredentials({ useProxy: value }));
    try {
      const creds = await Keychain.getGenericPassword({ service: 'my-iptv-credentials' });
      const parsed = creds ? JSON.parse(creds.password) : {};
      await Keychain.setGenericPassword(
        'xtream-creds',
        JSON.stringify({ ...parsed, useProxy: value }),
        { service: 'my-iptv-credentials' },
      );
    } catch {}
  };

  const handleChange = (txt: string) => {
    const cleaned = txt.replace(/-/g, '').replace(/[^a-zA-Z0-9]/g, '');
    setActivationCode(cleaned);
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
    setError(null);

    setIsLoading(true);
    try {
      const encryptedPayload = await buildEncryptedPayload(activationCode);

      const body = new URLSearchParams();
      body.append('json', encryptedPayload);

      const activationUrl = proxyApiUrl('http://screen-net.live/iptv/V7.php/', useProxy);
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

      const decrypted = xorDecrypt(encryptedResponse);
      const parsed = JSON.parse(decrypted);
      if (__DEV__) console.log('Parsed response:', parsed);
      if (parsed.status === 103) {
        setError(
          'Activation failed. Please check your code or try again later.',
        );
        return;
      }

      await Keychain.setGenericPassword(
        'xtream-creds',
        JSON.stringify({
          username: parsed.username,
          password: parsed.password,
          // serverDomain: parsed.server_info.url,
          serverDomain: 'screen-net.live',
          serverPort: parsed.server_info.port.replace(':', ''),
          useProxy,
        }),
        { service: 'my-iptv-credentials' },
      );

      dispatch(
        setUserCredentials({
          username: parsed.username,
          password: parsed.password,
          serverDomain: 'screen-net.live',
          serverPort: parsed.server_info.port.replace(':', ''),
        }),
      );

      navigation.replace('Main');
    } catch (e: any) {
      if (__DEV__) console.error(e);
      setError('Activation failed. Please check your code or try again later.');
      Alert.alert('Activation failed', e.message ?? 'Unknown error');
    } finally {
      setIsLoading(false);
    }
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
              Activate this device to unlock your IPTV library.
            </Text>
          </View>

          <View style={styles.card}>
            <LinearGradient
              colors={['rgba(139,123,255,0.12)', 'rgba(14,20,40,0.36)']}
              start={GRADIENT_START}
              end={GRADIENT_END}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />

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
              onChangeText={handleChange}
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
                  <FontAwesome5
                    name="bolt"
                    size={14}
                    color={colors.scene}
                    solid
                  />
                  <Text style={styles.buttonText}>Activate</Text>
                </>
              )}
            </TouchableOpacity>

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
                Route activation traffic through the configured proxy.
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

          <View style={styles.footer}>
            <Text style={styles.footerText}>Need help? Contact support</Text>
            <Text style={styles.footerSubText}>ScreenIPTV activation portal</Text>
          </View>
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
    marginBottom: 30,
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
    maxWidth: 280,
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
  button: {
    height: 52,
    borderRadius: radii.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    overflow: 'hidden',
    marginTop: 16,
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

export default ActivationScreen;
