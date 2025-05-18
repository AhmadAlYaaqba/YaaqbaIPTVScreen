import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import axios from 'axios';
import * as Keychain from 'react-native-keychain';
import DeviceInfo from 'react-native-device-info';
import {useDispatch, useSelector} from 'react-redux';
import {AppDispatch, RootState} from '../store';
import {setUserCredentials} from '../store/slices/userSlice';
import NetworkLogger from 'react-native-network-logger';

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

const ActivationScreen: React.FC<Props> = ({navigation}) => {
  const dispatch = useDispatch<AppDispatch>();
  const {username, password, serverDomain, serverPort} = useSelector(
    (state: RootState) => state.user,
  );

  const [activationCode, setActivationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (username && password && serverDomain && serverPort) {
      navigation.replace('Main');
    }
  }, [username, password, serverDomain, serverPort, navigation]);

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

      const {data: encryptedResponse} = await axios.post(
        'https://calcioa.vip/iptv/V7.php/',
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
      console.log('Parsed response:', parsed);
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
          serverDomain: parsed.server_info.url,
          serverPort: parsed.server_info.port.replace(':', ''),
        }),
        {service: 'my-iptv-credentials'},
      );

      dispatch(
        setUserCredentials({
          username: parsed.username,
          password: parsed.password,
          serverDomain: parsed.server_info.url,
          serverPort: parsed.server_info.port.replace(':', ''),
        }),
      );

      navigation.replace('Main');
    } catch (e: any) {
      console.error(e);
      setError('Activation failed. Please check your code or try again later.');
      Alert.alert('Activation failed', e.message ?? 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>ScreenIPTV</Text>
      <View style={styles.underline} />
      <Text style={styles.subtitle}>Enter Your Activation Code</Text>

      <TextInput
        style={styles.input}
        value={activationCode}
        onChangeText={handleChange}
        placeholder="XXXX‑XXXX‑XXXX"
        maxLength={14}
        autoCapitalize="none"
        inputMode="numeric"
      />

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
        <>
          <View style={styles.errorBox}>
            <FontAwesome5 name="exclamation-circle" color="#D8000C" size={14} />
            <Text style={styles.errorText}> {error}</Text>
          </View>
          {/* <NetworkLogger /> */}
        </>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Need help? Contact support@screeniptv.com
        </Text>
        <Text style={styles.footerText}>
          © 2025 ScreenIPTV. All rights reserved.
        </Text>
        <Text style={styles.footerText}>
          © 2025 ScreenIPTV. All rights reserved.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F9F9F9',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#2D3B55',
    textAlign: 'center',
  },
  underline: {
    width: 90,
    height: 3,
    backgroundColor: '#4A90E2',
    alignSelf: 'center',
    marginVertical: 8,
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    color: '#555',
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    height: 52,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#4A90E2',
    paddingVertical: 14,
    borderRadius: 10,
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
    fontWeight: '600',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDECEC',
    borderColor: '#F5C6CB',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 16,
  },
  errorText: {
    color: '#D8000C',
  },
  footer: {
    marginTop: 32,
    alignItems: 'center',
  },
  footerText: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
  },
});

export default ActivationScreen;
