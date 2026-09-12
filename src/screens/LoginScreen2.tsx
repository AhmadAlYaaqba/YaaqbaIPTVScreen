// src/screens/LoginScreen.tsx

import React, {useEffect, useState} from 'react';
import {View, TextInput, Button, StyleSheet, Text, Alert} from 'react-native';
import {useDispatch, useSelector} from 'react-redux';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import axios from 'axios';
import * as Keychain from 'react-native-keychain';

import {AppDispatch, RootState} from '../store'; // or wherever your store types live
import {setUserCredentials} from '../store/slices/userSlice'; // optional Redux action
import {LegacyStackParamList} from '../navigation/legacyTypes';
import DeviceInfo from 'react-native-device-info';

const SECRET_KEY = '5w.=:uehB3#jwUJ';

function xorEncrypt(jsonObj: unknown) {
  const inputStr =
    typeof jsonObj === 'string' ? jsonObj : JSON.stringify(jsonObj);

  let encryptedStr = '';

  // XOR each character of the input with the corresponding key character
  for (let i = 0; i < inputStr.length; i++) {
    const inputCharCode = inputStr.charCodeAt(i);
    const keyCharCode = SECRET_KEY.charCodeAt(i % SECRET_KEY.length); // repeat key cyclically
    // eslint-disable-next-line no-bitwise
    const xorCharCode = inputCharCode ^ keyCharCode; // XOR operation

    // Append the XORed character to the result string
    encryptedStr += String.fromCharCode(xorCharCode);
  }

  return encryptedStr;
}

function xorDecrypt(encryptedStr: string) {
  let decryptedStr = '';

  // Iterate over each character in the encrypted string
  for (let i = 0; i < encryptedStr.length; i++) {
    const encryptedCharCode = encryptedStr.charCodeAt(i);
    const keyCharCode = SECRET_KEY.charCodeAt(i % SECRET_KEY.length); // cycle through key characters
    // eslint-disable-next-line no-bitwise
    const decryptedCharCode = encryptedCharCode ^ keyCharCode; // XOR to decrypt
    decryptedStr += String.fromCharCode(decryptedCharCode);
  }

  return decryptedStr;
}

type LoginScreenNavigationProp = NativeStackNavigationProp<
  LegacyStackParamList,
  'Login'
>;

interface Props {
  navigation: LoginScreenNavigationProp;
}

const LoginScreen: React.FC<Props> = ({navigation}) => {
  const dispatch = useDispatch<AppDispatch>();

  const [activationCode, setActivationCode] = useState('');
  const {username, password, serverDomain, serverPort} = useSelector(
    (state: RootState) => state.user,
  );

  const getMacAddress = async () => {
    return await getMacAddress();
  };

  useEffect(() => {
    if (username && password && serverDomain && serverPort) {
      // If credentials are already stored, navigate to Home
      navigation.navigate('Home');
    }
  }, [navigation, password, serverDomain, serverPort, username]);

  // Build the encrypted payload based on the activation code and device MAC address.
  const buildEncryptedPayload = async (code: string) => {
    const macAddress = await getMacAddress();
    // Create the JSON payload; note the key "sn" holds the activation code.
    const payload = {
      mac: macAddress,
      sn: macAddress,
      code,
      mode: 'active',
      model: 'testing',
      group: 0,
    };
    const jsonData = JSON.stringify(payload);
    // Encrypt the JSON string using XOR with the secret key.
    const encrypted = xorEncrypt(jsonData);
    return encrypted;
  };
  // {"mode":"active","code":"29989197997","mac":"cc:c5:c0:f5:0a:80","sn":"cc:c5:c0:f5:0a:80","model":"e3q","group":0}
  // Handle the activation process.
  const handleActivation = async () => {
    if (!activationCode.trim()) {
      Alert.alert('Validation', 'Please enter an activation code.');
      return;
    }
    console.log('DeviceInfo ==>', DeviceInfo.getAndroidId());
    console.log('DeviceInfo ==>', DeviceInfo.getMacAddress());
    console.log('DeviceInfo ==>', DeviceInfo.getMacAddressSync());

    // setLoading(true);
    try {
      // Build the encrypted payload.
      const encryptedPayload = await buildEncryptedPayload(activationCode);

      // Construct the body as form-urlencoded (key is "json").
      console.log('encryptedPayload', encryptedPayload);
      const formBody = new URLSearchParams();
      formBody.append('json', encryptedPayload);

      try {
        const response = await axios.post(
          'https://v0-next-js-proxy-api.vercel.app/api/proxy?url=http://calcioa.vip/iptv/V7.php/',
          formBody.toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': 'okhttp/4.3.1',
              // Note: The 'Host' and 'Connection' headers are typically managed by the HTTP client or environment.
            },
            // Set the expected response type, which is "text" (default is text in axios).
            responseType: 'text',
          },
        );

        // Get the full response data (which is the encrypted response)
        const encryptedData = response.data;
        console.log('Encrypted response received:', encryptedData);

        // Decrypt the response using the XOR decryption method
        const decryptedResponse = xorDecrypt(encryptedData);
        console.log('Decrypted response (as string):', decryptedResponse);

        // If the decrypted response is a JSON string, parse it
        try {
          const parsedResponse = JSON.parse(decryptedResponse);
          console.log('Parsed JSON response:', parsedResponse);

          const storedData = JSON.stringify({
            username: parsedResponse.username,
            password: parsedResponse.password,
            serverDomain: parsedResponse.server_info.url,
            serverPort: parsedResponse.server_info.port.replace(':', ''),
          });

          await Keychain.setGenericPassword('xtream-creds', storedData, {
            service: 'my-iptv-credentials', // A custom service name
          });

          // 2. Optionally, also store domain/port or other data in Redux.
          dispatch(
            setUserCredentials({
              username: parsedResponse.username,
              password: parsedResponse.password,
              serverDomain: parsedResponse.server_info.url,
              serverPort: parsedResponse.server_info.port.replace(':', ''),
            }),
          );

          // 3. Navigate to Home (or another screen).
          navigation.navigate('Home');
        } catch (parseError) {
          console.error(
            'Error parsing JSON from decrypted response:',
            parseError,
          );
        }
      } catch (error) {
        console.error('Error during API call:', error);
      }

      // TODO: Parse and handle the response properly, e.g., extract username/password.
    } catch (error) {
      console.log('errpr ===?', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'An unexpected error occurred.',
      );
    } finally {
      // setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Xtream Login</Text>

      <TextInput
        style={styles.input}
        placeholder="Activation code"
        autoCapitalize="none"
        value={activationCode}
        onChangeText={setActivationCode}
      />

      <Button title="Login" onPress={handleActivation} />
    </View>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    marginBottom: 24,
    textAlign: 'center',
  },
  input: {
    height: 44,
    borderColor: '#ccc',
    borderWidth: 1,
    marginBottom: 12,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
});
