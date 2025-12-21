import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import { useDispatch, useSelector } from 'react-redux';
import * as Keychain from 'react-native-keychain';
import { clearUserCredentials } from '../store/slices/userSlice';
import axios from 'axios';
import { storage, LatestWatched } from '../utils/storage';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { RootState } from '../store/types';
import {  useIsFocused } from '@react-navigation/native';

type HomeScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Home'
>;

interface HomeScreenProps {
  navigation: HomeScreenNavigationProp;
}

type CategoryItem = {
  id: string;
  title: string;
  image: any; // React Native resolves imported images to a number
  onPress: () => void;
  description: string;
};

// Import images
const liveTvImage = require('../assets/livetv.jpg');
const moviesImage = require('../assets/movies-tv.jpg');
const seriesImage = require('../assets/series-tv.jpg');

export default function HomeScreenBrand({ navigation }: HomeScreenProps) {
  const dispatch = useDispatch();
  const isFocused = useIsFocused();

  const { username, password, serverDomain, serverPort } = useSelector(
    (s: RootState) => s.user,
  );

  const [accountInfo, setAccountInfo] = useState<null | {
    status: string;
    expiration_date: string;
    created_at: string;
  }>(null);
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [recentWatches, setRecentWatches] = useState<RecentlyWatched[]>([]);

  useEffect(() => {
    const fetchAccountInfo = async () => {
      try {
        const originalUrl = `http://${serverDomain}:${serverPort}/player_api.php?username=${username}&password=${password}&action=get_account_info`;
        const url = `https://v0-next-js-proxy-api.vercel.app/api/proxy?url=${encodeURIComponent(originalUrl)}`;

        const res = await axios.get(url);
        setAccountInfo({
          status: res.data.user_info.status ?? 'Unknown',
          expiration_date: res.data.user_info.exp_date
            ? new Date(res.data.user_info.exp_date * 1000).toLocaleDateString()
            : '-',
          created_at: res.data.user_info.created_at
            ? new Date(
                res.data.user_info.created_at * 1000,
              ).toLocaleDateString()
            : '-',
        });
      } catch (e) {
        await Keychain.resetGenericPassword({
          service: 'my-iptv-credentials',
        });
        dispatch(clearUserCredentials());
        navigation.navigate('Login');

        if (__DEV__) console.warn('Account info fetch failed', e);
      } finally {
        setLoadingAccount(false);
      }
    };
    fetchAccountInfo();
  }, [username, password, serverDomain, serverPort]);

  // Load recent watches
  useEffect(() => {
    const loadRecentWatches = async () => {
      const watches = await storage.getLatestWatched();
      setRecentWatches(watches);
    };
    if (isFocused) loadRecentWatches();
  }, [isFocused]);

  const categories: CategoryItem[] = [
    {
      id: '1',
      title: 'Live TV',
      image: liveTvImage,
      description: 'Watch live channels from around the world',
      onPress: () => navigation.navigate('LiveTV'),
    },
    {
      id: '2',
      title: 'Movies',
      image: moviesImage,
      description: 'Explore thousands of movies on demand',
      onPress: () => navigation.navigate('Movies'),
    },
    {
      id: '3',
      title: 'Series',
      image: seriesImage,
      description: 'Binge watch your favorite TV shows',
      onPress: () => navigation.navigate('Series'),
    },
  ];
  /* ------------------------------------------------------------------ */

  return (
    <SafeAreaView style={styles.container}>
      {/* ------------ Header ------------- */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>ScreenIPTV</Text>

        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.iconButton}>
            <FontAwesome5 name="search" color="#fff" size={16} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={async () => {
              await Keychain.resetGenericPassword({
                service: 'my-iptv-credentials',
              });
              dispatch(clearUserCredentials());
              navigation.navigate('Login');
            }}>
            <FontAwesome5 name="user" color="#fff" size={16} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ------------ Main scrollable content ------------- */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Welcome */}
        <View style={styles.welcomeBox}>
          <Text style={styles.welcomeTitle}>Welcome Back!</Text>
          <Text style={styles.welcomeSubtitle}>
            Choose a category to start watching
          </Text>
        </View>

        {/* Categories */}
        <View style={styles.categoriesContainer}>
          {categories.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={styles.card}
              activeOpacity={0.8}
              onPress={cat.onPress}>
              <Image source={cat.image} style={styles.cardImage} />
              <View style={styles.cardTextBox}>
                <Text style={styles.cardTitle}>{cat.title}</Text>
                <Text style={styles.cardDesc}>{cat.description}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>


        {/* Recent Watches */}
        <Text style={styles.sectionTitle}>Recent Watches</Text>
        <View style={styles.continueGrid}>
          {recentWatches.map((item, idx) => {
            if (__DEV__) console.log('item ===>', item);
            const progress =
              item.progress && item.totalDuration
                ? (item.progress / item.totalDuration) * 100
                : 0;
            const placeholderImage =
              item.type === 'series'
                ? seriesImage
                : item.type === 'movie'
                ? moviesImage
                : liveTvImage;
            return (
              <TouchableOpacity
                key={idx}
                style={styles.continueCard}
                onPress={() => {
                  if (item.type === 'series') {
                    navigation.navigate('SeriesDetail', {
                      seriesId: item.seriesId || '',
                      seriesName: item.name,
                    });
                  } else if (item.type === 'movie') {
                    const originalUrl = `http://${serverDomain}:${serverPort}/movie/${username}/${password}/${item.id}.mp4`;
                    const url = `https://v0-next-js-proxy-api.vercel.app/api/stream?url=${encodeURIComponent(originalUrl)}`;
                    navigation.navigate('VideoPlayer', {
                      streamUrl: url,
                      isLive: false,
                      title: item.name,
                      movieId: item.id,
                      thumbnail: item.thumbnail,
                      continueTime: {progress: item.progress},
                    });
                  } else if (item.type === 'live') {
                    const originalUrl = `http://${serverDomain}:${serverPort}/live/${username}/${password}/${item.id}.ts`;
                    const url = `https://v0-next-js-proxy-api.vercel.app/api/stream?url=${encodeURIComponent(originalUrl)}`;
                    navigation.navigate('VideoPlayer', {
                      streamUrl: url,
                      isLive: true,
                      title: item.channelName || item.name,
                    });
                  }
                }}>
                <Image
                  source={
                    item.thumbnail ? { uri: item.thumbnail } : placeholderImage
                  }
                  style={styles.continueImage}
                />
                {(item.type === 'movie' || item.type === 'series') && (
                  <View style={styles.progressBarWrapper}>
                    <View
                      style={[styles.progressBar, { width: `${progress}%` }]}
                    />
                  </View>
                )}
                <View style={styles.continueTextBox}>
                  <Text style={styles.continueTitle} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.continueSubtitle}>
                    {item.type === 'series' && item.episodeNumber
                      ? `S${item.seasonNumber}E${item.episodeNumber}`
                      : item.type === 'live'
                      ? item.channelName
                      : item.type}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ------------ NEW: Account Information block ------------- */}
        {loadingAccount ? (
          <ActivityIndicator style={{ marginTop: 16 }} size="large" />
        ) : (
          accountInfo && (
            <View style={styles.accountBox}>
              <Text style={styles.accountTitle}>Account Information</Text>

              {/* Username */}
              {/* <View style={styles.accountRow}>
                <Text style={styles.accountLabel}>Username:</Text>
                <Text style={styles.accountValue}>{username}</Text>
              </View> */}

              {/* Subscription status */}
              <View style={styles.accountRow}>
                <Text style={styles.accountLabel}>Subscription Status:</Text>
                <Text
                  style={[
                    styles.accountValue,
                    {
                      color:
                        accountInfo.status === 'Active' ? '#4A90E2' : '#E53935',
                    },
                  ]}>
                  {accountInfo.status}
                </Text>
              </View>

              {/* Activation date */}
              <View style={styles.accountRow}>
                <Text style={styles.accountLabel}>Activated On:</Text>
                <Text style={styles.accountValue}>
                  {accountInfo.created_at}
                </Text>
              </View>

              {/* Expiration */}
              <View style={styles.accountRow}>
                <Text style={styles.accountLabel}>Expiration Date:</Text>
                <Text style={styles.accountValue}>
                  {accountInfo.expiration_date}
                </Text>
              </View>

              {/* CTA */}
              <TouchableOpacity style={styles.extendBtn} activeOpacity={0.8}>
                <Text style={styles.extendBtnText}>Extend Subscription</Text>
              </TouchableOpacity>
            </View>
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------- */
/* Styles */
/* ------------------------------------------------------------------- */
const styles = StyleSheet.create({
  /* layout */
  // container: {flex: 1, backgroundColor: '#2D3B55'},
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  scrollContent: {
    padding: 16,
    paddingBottom: 20, // enough space above tab bar
    backgroundColor: '#F3F4F6',
  },

  /* header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2D3B55',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 32,
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  headerIcons: { flexDirection: 'row' },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4A90E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  /* welcome */
  welcomeBox: { marginBottom: 16 },
  welcomeTitle: { fontSize: 24, fontWeight: '600', color: '#2D3B55' },
  welcomeSubtitle: { fontSize: 16, color: '#555', marginTop: 4 },

  /* category cards */
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 2,
    marginBottom: 12,
    padding: 10,
  },
  cardImage: { width: 80, height: 80, borderRadius: 40, marginRight: 12 },
  cardTextBox: { flex: 1 },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#2D3B55' },
  cardDesc: { fontSize: 14, color: '#555', marginTop: 4 },

  /* section title */
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3B55',
    marginVertical: 12,
  },

  /* continue watching */
  continueGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  continueCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 2,
    marginBottom: 12,
    overflow: 'hidden',
  },
  continueImage: {
    width: '100%',
    height: 100,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  progressBarWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#e0e0e0',
  },
  progressBar: { height: '100%', backgroundColor: '#E53935' },
  continueTextBox: { padding: 8 },
  continueTitle: { fontSize: 14, fontWeight: '500', color: '#2D3B55' },
  continueSubtitle: { fontSize: 12, color: '#888', marginTop: 2 },

  /* ------------ Account Information ------------ */
  accountBox: {
    marginTop: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    elevation: 2,
  },
  accountTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3B55',
    marginBottom: 12,
  },
  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  accountLabel: { color: '#666', fontSize: 14 },
  accountValue: { fontSize: 14, fontWeight: '600', color: '#2D3B55' },
  expireWrapper: { flexDirection: 'row', alignItems: 'center' },

  extendBtn: {
    marginTop: 20,
    backgroundColor: '#4A90E2',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  extendBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
