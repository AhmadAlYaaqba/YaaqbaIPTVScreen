// src/screens/LoginScreen.tsx

import React, {useState} from 'react';
import {View, TextInput, Button, StyleSheet, Text, Alert} from 'react-native';
import {useDispatch} from 'react-redux';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import axios from 'axios';
import * as Keychain from 'react-native-keychain';

import {AppDispatch} from '../store'; // or wherever your store types live
import {setUserCredentials} from '../store/slices/userSlice'; // optional Redux action
import { LegacyStackParamList } from '../navigation/legacyTypes';

type LoginScreenNavigationProp = NativeStackNavigationProp<
  LegacyStackParamList,
  'Login'
>;

interface Props {
  navigation: LoginScreenNavigationProp;
}

const LoginScreen: React.FC<Props> = ({navigation}) => {
  const dispatch = useDispatch<AppDispatch>();

  const [username, setUsername] = useState('ahmad544112239');
  const [password, setPassword] = useState('rEBrzstcHybR');
  const [serverDomain, setServerDomain] = useState('calcioa.vip');
  const [serverPort, setServerPort] = useState('80');

  const handleLogin = async () => {
    if (!username || !password || !serverDomain || !serverPort) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    try {
      // Construct the Xtream Codes login URL.
      const originalUrl = `http://${serverDomain}:${serverPort}/player_api.php?username=${username}&password=${password}`;
      const xtreamUrl = `https://v0-next-js-proxy-api.vercel.app/api/proxy?url=${encodeURIComponent(originalUrl)}`;
      console.log('xtreamUrl', xtreamUrl);

      const response = await axios.get(xtreamUrl);
      console.log('network response', response);

      // Check if the response indicates a successful login.
      const userInfo = response?.data?.user_info;
      console.log('[Login Response]', userInfo);

      if (userInfo && userInfo.auth === 1) {
        // 1. Store all required info in Keychain as one JSON string.
        // 'key' can be something descriptive, e.g. 'xtream-creds'
        // The 'password' parameter is actually the second argument: we can store a JSON string there.
        const storedData = JSON.stringify({
          username,
          password,
          serverDomain,
          serverPort,
        });

        await Keychain.setGenericPassword('xtream-creds', storedData, {
          service: 'my-iptv-credentials', // A custom service name
        });

        // 2. Optionally, also store domain/port or other data in Redux.
        dispatch(
          setUserCredentials({
            username,
            password,
            serverDomain,
            serverPort,
          }),
        );

        // 3. Navigate to Home (or another screen).
        navigation.navigate('Home');
      } else {
        Alert.alert('Login Failed', 'Invalid username or password.');
      }
    } catch (error) {
      console.log('[Login Error]', error);
      Alert.alert('Error', 'Could not login. Please check your connection.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Xtream Login</Text>

      <TextInput
        style={styles.input}
        placeholder="Username"
        autoCapitalize="none"
        value={username}
        onChangeText={setUsername}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        autoCapitalize="none"
        value={password}
        onChangeText={setPassword}
      />
      <TextInput
        style={styles.input}
        placeholder="Server Domain (e.g. example.com)"
        autoCapitalize="none"
        value={serverDomain}
        onChangeText={setServerDomain}
      />
      <TextInput
        style={styles.input}
        placeholder="Server Port (e.g. 8080)"
        keyboardType="numeric"
        value={serverPort}
        onChangeText={setServerPort}
      />

      <Button title="Login" onPress={handleLogin} />
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
