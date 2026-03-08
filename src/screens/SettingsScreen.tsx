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
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import * as Keychain from 'react-native-keychain';
import { RootState, AppDispatch } from '../store';
import { setUseVlcPlayer, clearUserCredentials } from '../store/slices/userSlice';

const SettingsScreen: React.FC<any> = ({ navigation }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { useVLC, useNewVLC, vlcUseProxy, username } = useSelector((state: RootState) => state.user);

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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <FontAwesome5 name="arrow-left" size={18} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 18 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <FontAwesome5 name="user" size={16} color="#4A90E2" />
              <Text style={styles.rowLabel}>Username</Text>
              <Text style={styles.rowValue}>{username || 'Not logged in'}</Text>
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
                trackColor={{ false: '#ddd', true: '#4A90E2' }}
                thumbColor={useVLC ? '#fff' : '#f4f3f4'}
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
                  trackColor={{ false: '#ddd', true: '#FF9800' }}
                  thumbColor={useNewVLC ? '#fff' : '#f4f3f4'}
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
                  trackColor={{ false: '#ddd', true: '#4CAF50' }}
                  thumbColor={vlcUseProxy ? '#fff' : '#f4f3f4'}
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
  );
};

export default SettingsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2D3B55',
    paddingHorizontal: 16,
    paddingVertical: 16,
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
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
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
    color: '#2D3B55',
    marginLeft: 12,
  },
  rowValue: {
    fontSize: 14,
    color: '#666',
  },
  rowHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  disclaimer: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    fontStyle: 'italic',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E53935',
    borderRadius: 12,
    padding: 16,
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  footer: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 24,
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
});
