// src/screens/SettingsScreen.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  ImageBackground,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import * as Keychain from 'react-native-keychain';
import { RootState, AppDispatch } from '../store';
import { setUseVlcPlayer, setUserCredentials, clearUserCredentials } from '../store/slices/userSlice';

const backgroundImage = require('../assets/background-image-mobile.png');

const SettingsScreen: React.FC<any> = ({ navigation }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { useVLC, useNewVLC, vlcUseProxy, username, showMoviesSlider, showSeriesSlider } = useSelector((state: RootState) => state.user);

  const handleTogglePlayer = async (value: boolean) => {
    dispatch(setUseVlcPlayer({ useVLC: value }));

    // Persist to Keychain
    try {
      const creds = await Keychain.getGenericPassword({
        service: 'my-iptv-credentials',
      });
      if (creds) {
        const parsed = JSON.parse(creds.password);
        await Keychain.setGenericPassword(
          'xtream-creds',
          JSON.stringify({ ...parsed, useVLC: value }),
          { service: 'my-iptv-credentials' },
        );
      }
    } catch (error) {
      if (__DEV__) console.error('Error saving player preference:', error);
    }
  };

  const handleToggleNewVLC = async (value: boolean) => {
    dispatch(setUseVlcPlayer({ useNewVLC: value }));

    try {
      const creds = await Keychain.getGenericPassword({
        service: 'my-iptv-credentials',
      });
      if (creds) {
        const parsed = JSON.parse(creds.password);
        await Keychain.setGenericPassword(
          'xtream-creds',
          JSON.stringify({ ...parsed, useNewVLC: value }),
          { service: 'my-iptv-credentials' },
        );
      }
    } catch (error) {
      if (__DEV__) console.error('Error saving new VLC preference:', error);
    }
  };

  const handleToggleProxy = async (value: boolean) => {
    dispatch(setUseVlcPlayer({ vlcUseProxy: value }));

    try {
      const creds = await Keychain.getGenericPassword({
        service: 'my-iptv-credentials',
      });
      if (creds) {
        const parsed = JSON.parse(creds.password);
        await Keychain.setGenericPassword(
          'xtream-creds',
          JSON.stringify({ ...parsed, vlcUseProxy: value }),
          { service: 'my-iptv-credentials' },
        );
      }
    } catch (error) {
      if (__DEV__) console.error('Error saving proxy preference:', error);
    }
  };

  const handleToggleMoviesSlider = async (value: boolean) => {
    dispatch(setUserCredentials({ showMoviesSlider: value }));

    try {
      const creds = await Keychain.getGenericPassword({
        service: 'my-iptv-credentials',
      });
      if (creds) {
        const parsed = JSON.parse(creds.password);
        await Keychain.setGenericPassword(
          'xtream-creds',
          JSON.stringify({ ...parsed, showMoviesSlider: value }),
          { service: 'my-iptv-credentials' },
        );
      }
    } catch (error) {
      if (__DEV__) console.error('Error saving movies slider preference:', error);
    }
  };

  const handleToggleSeriesSlider = async (value: boolean) => {
    dispatch(setUserCredentials({ showSeriesSlider: value }));

    try {
      const creds = await Keychain.getGenericPassword({
        service: 'my-iptv-credentials',
      });
      if (creds) {
        const parsed = JSON.parse(creds.password);
        await Keychain.setGenericPassword(
          'xtream-creds',
          JSON.stringify({ ...parsed, showSeriesSlider: value }),
          { service: 'my-iptv-credentials' },
        );
      }
    } catch (error) {
      if (__DEV__) console.error('Error saving series slider preference:', error);
    }
  };

  const handleLogout = async () => {
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
  };

  return (
    <ImageBackground
      source={backgroundImage}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <FontAwesome5 name="arrow-left" size={18} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={{ width: 18 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Account Section */}
          {/* <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <FontAwesome5 name="user" size={16} color="#4A90E2" />
                <Text style={styles.rowLabel}>Username</Text>
                <Text style={styles.rowValue}>{username || 'Not logged in'}</Text>
              </View>
            </View>
          </View> */}

          {/* App Preferences Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>App Preferences</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <FontAwesome5 name="film" size={16} color="#4A90E2" />
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>Show Featured Movies</Text>
                  <Text style={styles.rowHint}>
                    Display the auto-playing slider on the Movies screen
                  </Text>
                </View>
                <Switch
                  value={showMoviesSlider}
                  onValueChange={handleToggleMoviesSlider}
                  trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#4A90E2' }}
                  thumbColor={showMoviesSlider ? '#fff' : '#A0ABC0'}
                />
              </View>
              <View style={[styles.row, { marginTop: 16 }]}>
                <FontAwesome5 name="tv" size={16} color="#4A90E2" />
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>Show Featured Series</Text>
                  <Text style={styles.rowHint}>
                    Display the auto-playing slider on the Series screen
                  </Text>
                </View>
                <Switch
                  value={showSeriesSlider}
                  onValueChange={handleToggleSeriesSlider}
                  trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#4A90E2' }}
                  thumbColor={showSeriesSlider ? '#fff' : '#A0ABC0'}
                />
              </View>
            </View>
          </View>

          {/* Player Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Video Player</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <FontAwesome5 name="play-circle" size={16} color="#4A90E2" />
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>Use VLC Player</Text>
                  <Text style={styles.rowHint}>
                    VLC may provide better compatibility for some streams
                  </Text>
                </View>
                <Switch
                  value={useVLC}
                  onValueChange={handleTogglePlayer}
                  trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#4A90E2' }}
                  thumbColor={useVLC ? '#fff' : '#A0ABC0'}
                />
              </View>
            </View>
            <Text style={styles.disclaimer}>
              Note: If you experience playback issues, try switching players.
            </Text>

            {useVLC && (
              <View style={[styles.card, { marginTop: 12 }]}>
                <View style={styles.row}>
                  <FontAwesome5 name="flask" size={16} color="#FF9800" />
                  <View style={styles.rowContent}>
                    <Text style={styles.rowLabel}>Use New VLC Engine</Text>
                    <Text style={styles.rowHint}>
                      Experimental: rn-vlc-plyr with custom controls
                    </Text>
                  </View>
                  <Switch
                    value={useNewVLC}
                    onValueChange={handleToggleNewVLC}
                    trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#FF9800' }}
                    thumbColor={useNewVLC ? '#fff' : '#A0ABC0'}
                  />
                </View>
              </View>
            )}

            {useVLC && useNewVLC && (
              <View style={[styles.card, { marginTop: 12 }]}>
                <View style={styles.row}>
                  <FontAwesome5 name="shield-alt" size={16} color="#4CAF50" />
                  <View style={styles.rowContent}>
                    <Text style={styles.rowLabel}>Use HTTPS Proxy</Text>
                    <Text style={styles.rowHint}>
                      Routes streams through HTTPS proxy. Disable if live streams don't play.
                    </Text>
                  </View>
                  <Switch
                    value={vlcUseProxy}
                    onValueChange={handleToggleProxy}
                    trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#4CAF50' }}
                    thumbColor={vlcUseProxy ? '#fff' : '#A0ABC0'}
                  />
                </View>
              </View>
            )}
          </View>

          {/* Actions Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Actions</Text>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <FontAwesome5 name="sign-out-alt" size={16} color="#fff" />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>

          {/* App Info */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>ScreenIPTV v1.0.0</Text>
            <Text style={styles.footerText}>© 2025 ScreenIPTV</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
};

export default SettingsScreen;

const HEADER_HEIGHT = 32;

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingTop: HEADER_HEIGHT + 8,
  },
  header: {
    top: 0,
    left: 0,
    right: 0,
    height: HEADER_HEIGHT,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#A0ABC0',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowContent: {
    flex: 1,
    marginLeft: 12,
  },
  rowLabel: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    marginLeft: 12,
    fontWeight: '500',
  },
  rowValue: {
    fontSize: 14,
    color: '#A0ABC0',
  },
  rowHint: {
    fontSize: 12,
    color: '#A0ABC0',
    marginTop: 4,
  },
  disclaimer: {
    fontSize: 12,
    color: '#A0ABC0',
    marginTop: 8,
    fontStyle: 'italic',
    paddingHorizontal: 4,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(229, 57, 53, 0.2)', // translucent red
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(229, 57, 53, 0.5)',
  },
  logoutText: {
    color: '#F87171', // lighter red text for dark mode
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  footer: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 40,
  },
  footerText: {
    fontSize: 12,
    color: '#A0ABC0',
    marginTop: 4,
  },
});
