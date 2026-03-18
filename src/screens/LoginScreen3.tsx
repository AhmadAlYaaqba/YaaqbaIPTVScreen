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
  ImageBackground,
  Switch,
} from 'react-native';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import axios from 'axios';
import * as Keychain from 'react-native-keychain';
import DeviceInfo from 'react-native-device-info';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import { setUserCredentials } from '../store/slices/userSlice';
import { proxyApiUrl } from '../utils/proxy';

const SECRET_KEY = '5w.=:uehB3#jwUJ';

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
      } catch (_) {}
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
    } catch (_) {}
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
    <ImageBackground
      source={require('../assets/background-image-mobile.png')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.logoContainer}>
          <FontAwesome5 name="tv" color="#4A90E2" size={42} />
          <Text style={styles.title}>ScreenIPTV</Text>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.subtitle}>Enter Your Activation Code</Text>
          <TextInput
            style={styles.input}
            value={activationCode}
            onChangeText={handleChange}
            placeholder="XXXX-XXXX-XXXX"
            placeholderTextColor="rgba(255, 255, 255, 0.5)"
            maxLength={14}
            autoCapitalize="none"
            inputMode="numeric"
          />
        </View>

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleActivation}
          disabled={isLoading}>
          {isLoading ? (
            <>
              <ActivityIndicator color="#fff" />
              <Text style={styles.buttonText}> Activating…</Text>
            </>
          ) : (
            <Text style={styles.buttonText}>Activate</Text>
          )}
        </TouchableOpacity>

        {error && (
          <View style={styles.errorBox}>
            <FontAwesome5 name="exclamation-circle" color="#ff4d4f" size={14} />
            <Text style={styles.errorText}> {error}</Text>
          </View>
        )}

        <View style={styles.proxyRow}>
          <FontAwesome5 name="shield-alt" size={14} color="#4CAF50" />
          <Text style={styles.proxyLabel}>Use HTTP Proxy</Text>
          <Switch
            value={useProxy}
            onValueChange={handleToggleProxy}
            trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#4CAF50' }}
            thumbColor={useProxy ? '#fff' : '#A0ABC0'}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Need help? Contact support@screeniptv.com
          </Text>
          <Text style={styles.footerText}>
            ©2025 ScreenIPTV. All rights reserved.
          </Text>
        </View>
      </ScrollView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'transparent',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 12,
  },
  inputContainer: {
    marginBottom: 24,
  },
  subtitle: {
    fontSize: 16,
    color: '#A0ABC0',
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 12,
    height: 56,
    fontSize: 20,
    color: '#FFFFFF',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  button: {
    backgroundColor: '#3A7BD5',
    paddingVertical: 16,
    borderRadius: 25,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 77, 79, 0.1)',
    borderColor: 'rgba(255, 77, 79, 0.4)',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 16,
  },
  errorText: {
    color: '#ff4d4f',
  },
  proxyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  proxyLabel: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
    marginLeft: 10,
  },
  footer: {
    marginTop: 60,
    alignItems: 'center',
  },
  footerText: {
    color: '#E2E8F0',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default ActivationScreen;
