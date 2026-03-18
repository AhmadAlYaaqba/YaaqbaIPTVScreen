import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  ImageBackground,
} from 'react-native';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import { useDispatch, useSelector } from 'react-redux';
import * as Keychain from 'react-native-keychain';
import { clearUserCredentials } from '../store/slices/userSlice';
import { storage } from '../utils/storage';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../RootNavigator';
import { RootState } from '../store';
import { useIsFocused } from '@react-navigation/native';
import { proxyStreamUrl } from '../utils/proxy';
import { buildLiveStreamUrl, buildMovieStreamUrl } from '../utils/xtream';

type HomeScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Home'
>;

interface HomeScreenProps {
  navigation: HomeScreenNavigationProp;
}

// Import images
const liveTvImage = require('../assets/live_tv_landscape.png');
const moviesImage = require('../assets/movies_portrait.png');
const seriesImage = require('../assets/series_portrait.png');
const backgroundImage = require('../assets/background-image-mobile.png');

export default function HomeScreenBrand({ navigation }: HomeScreenProps) {
  const dispatch = useDispatch();
  const isFocused = useIsFocused();

  const { username, password, serverDomain, serverPort, useProxy } = useSelector(
    (s: RootState) => s.user,
  );

  const [recentWatches, setRecentWatches] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Load recent watches
  useEffect(() => {
    const loadRecentWatches = async () => {
      const watches = await storage.getLatestWatched();
      setRecentWatches(watches);
    };
    if (isFocused) loadRecentWatches();
  }, [isFocused]);

  const handleLogout = async () => {
    await Keychain.resetGenericPassword({
      service: 'my-iptv-credentials',
    });
    dispatch(clearUserCredentials());
    navigation.navigate('Login');
  };

  return (
    <ImageBackground
      source={backgroundImage}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.searchContainer}>
            <FontAwesome5 name="search" color="#A0ABC0" size={16} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search movies, shows, channels..."
              placeholderTextColor="#A0ABC0"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <TouchableOpacity style={styles.profileButton} onPress={handleLogout}>
            <FontAwesome5 name="user" color="#4A90E2" size={20} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Categories Grid */}
          <View style={styles.categoriesContainer}>
            {/* Live TV (Full Width) */}
            <TouchableOpacity
              style={[styles.categoryCardTop]}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('LiveTV')}
            >
              <Image source={liveTvImage} style={styles.categoryImageBase} resizeMode="cover" />
              <View style={styles.categoryOverlay}>
                <Text style={styles.categoryTitle}>Live TV</Text>
              </View>
            </TouchableOpacity>

            {/* Movies & Series (Half Width) */}
            <View style={styles.rowCards}>
              <TouchableOpacity
                style={styles.categoryCardHalf}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('Movies')}
              >
                <Image source={moviesImage} style={styles.categoryImageBase} resizeMode="cover" />
                <View style={styles.categoryOverlay}>
                  <Text style={styles.categoryTitle}>Movies</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.categoryCardHalf}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('Series')}
              >
                <Image source={seriesImage} style={styles.categoryImageBase} resizeMode="cover" />
                <View style={styles.categoryOverlay}>
                  <Text style={styles.categoryTitle}>Series</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Continue Watching */}
          <Text style={styles.sectionTitle}>Continue Watching</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.continueCarousel}
          >
            {recentWatches.map((item, idx) => {
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
                      const originalUrl = buildMovieStreamUrl({
                        domain: serverDomain,
                        port: serverPort,
                        username,
                        password,
                        streamId: item.id,
                      });
                      const url = proxyStreamUrl(originalUrl, useProxy);
                      navigation.navigate('VideoPlayer', {
                        streamUrl: url,
                        isLive: false,
                        title: item.name,
                        movieId: item.id,
                        thumbnail: item.thumbnail,
                        continueTime: { progress: item.progress },
                      });
                    } else if (item.type === 'live') {
                      const originalUrl = buildLiveStreamUrl({
                        domain: serverDomain,
                        port: serverPort,
                        username,
                        password,
                        streamId: item.id,
                        extension: 'ts',
                      });
                      const url = proxyStreamUrl(originalUrl, useProxy);
                      navigation.navigate('VideoPlayer', {
                        streamUrl: url,
                        isLive: true,
                        title: item.channelName || item.name,
                      });
                    }
                  }}
                >
                  <Image
                    source={
                      item.thumbnail ? { uri: item.thumbnail } : placeholderImage
                    }
                    style={styles.continueImage}
                    resizeMode="cover"
                  />
                  {(item.type === 'movie' || item.type === 'series') && (
                    <View style={styles.progressBarWrapper}>
                      <View
                        style={[
                          styles.progressBar,
                          { width: `${progress}%` },
                        ]}
                      />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 10,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 25,
    height: 48,
    paddingHorizontal: 16,
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  profileButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#4A90E2',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 110,
  },
  categoriesContainer: {
    marginBottom: 24,
  },
  categoryCardTop: {
    width: '100%',
    height: 140,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(74, 144, 226, 0.5)',
  },
  rowCards: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  categoryCardHalf: {
    width: '48%',
    height: 140,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(74, 144, 226, 0.5)',
  },
  categoryImageBase: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  categoryOverlay: {
    padding: 16,
    flex: 1,
    justifyContent: 'flex-start',
  },
  categoryTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 5,
  },
  continueCarousel: {
    paddingRight: 16,
    paddingBottom: 16, // Extra padding for shadow/bottom layout
  },
  continueCard: {
    width: 120,
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  continueImage: {
    width: '100%',
    height: '100%',
  },
  progressBarWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4A90E2',
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
});
