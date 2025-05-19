import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import {useDispatch, useSelector} from 'react-redux';
import * as Keychain from 'react-native-keychain';
import {clearUserCredentials} from '../store/slices/userSlice';
import LiveTvImage from '../assets/livetv.jpg';
import MoviesImage from '../assets/movies-tv.jpg';
import seriresImage from '../assets/series-tv.jpg';
import axios from 'axios';

type CategoryItem = {
  id: string;
  name: string;
  navigateName: string;
  imageUrl: any; // React Native resolves imported images to a number
  description: string;
};

export default function HomeScreenBrand({navigation}) {
  const dispatch = useDispatch();

  const {username, password, serverDomain, serverPort} = useSelector(
    (s: RootState) => s.user,
  );

  const [accountInfo, setAccountInfo] = useState<null | {
    status: string;
    expiration_date: string;
    created_at: string;
  }>(null);
  const [loadingAccount, setLoadingAccount] = useState(true);

  useEffect(() => {
    const fetchAccountInfo = async () => {
      try {
        const url = `http://${serverDomain}:${serverPort}/player_api.php?username=${username}&password=${password}&action=get_account_info`;

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

        console.warn('Account info fetch failed', e);
      } finally {
        setLoadingAccount(false);
      }
    };
    fetchAccountInfo();
  }, [username, password, serverDomain, serverPort]);

  const categories: CategoryItem[] = [
    {
      id: 'live-tv',
      name: 'Live TV',
      navigateName: 'LiveTV',
      imageUrl: LiveTvImage,
      description: 'Watch live channels from around the world',
    },
    {
      id: 'movies',
      name: 'Movies',
      navigateName: 'Movies',
      imageUrl: MoviesImage,
      description: 'Explore thousands of movies on demand',
    },
    {
      id: 'series',
      name: 'Series',
      navigateName: 'Series',
      imageUrl: seriresImage,
      description: 'Binge watch your favorite TV shows',
    },
  ];

  const continueWatching = [
    {
      title: 'Breaking News',
      channel: 'World News 24',
      type: 'Live TV',
      progress: 45,
      image:
        'https://images.unsplash.com/photo-1525182008055-f88b95ff7980?auto=format&fit=crop&w=600&q=80',
    },
    {
      title: 'The Last Kingdom',
      episode: 'S04E08',
      type: 'Series',
      progress: 75,
      image:
        'https://images.unsplash.com/photo-1606112219348-204d7d8b94ee?auto=format&fit=crop&w=600&q=80',
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
        {categories.map(cat => (
          <TouchableOpacity
            key={cat.id}
            style={styles.card}
            activeOpacity={0.8}
            onPress={() => navigation.navigate(cat.navigateName)}>
            <Image source={cat.imageUrl} style={styles.cardImage} />
            <View style={styles.cardTextBox}>
              <Text style={styles.cardTitle}>{cat.name}</Text>
              <Text style={styles.cardDesc}>{cat.description}</Text>
            </View>
            <FontAwesome5 name="chevron-right" size={18} color="#4A90E2" />
          </TouchableOpacity>
        ))}

        {/* Continue Watching */}
        {/* <Text style={styles.sectionTitle}>Continue Watching</Text>
        <View style={styles.continueGrid}>
          {continueWatching.map((item, idx) => (
            <TouchableOpacity key={idx} style={styles.continueCard}>
              <Image source={{uri: item.image}} style={styles.continueImage} />
              <View style={styles.progressBarWrapper}>
                <View
                  style={[styles.progressBar, {width: `${item.progress}%`}]}
                />
              </View>
              <View style={styles.continueTextBox}>
                <Text style={styles.continueTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.continueSubtitle}>
                  {item.channel || item.episode} • {item.type}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View> */}

        {/* ------------ NEW: Account Information block ------------- */}
        {loadingAccount ? (
          <ActivityIndicator style={{marginTop: 16}} size="large" />
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
  container: {flex: 1, backgroundColor: '#F3F4F6'},
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
  headerTitle: {color: '#fff', fontSize: 20, fontWeight: '700'},
  headerIcons: {flexDirection: 'row'},
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
  welcomeBox: {marginBottom: 16},
  welcomeTitle: {fontSize: 24, fontWeight: '600', color: '#2D3B55'},
  welcomeSubtitle: {fontSize: 16, color: '#555', marginTop: 4},

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
  cardImage: {width: 80, height: 80, borderRadius: 40, marginRight: 12},
  cardTextBox: {flex: 1},
  cardTitle: {fontSize: 18, fontWeight: '600', color: '#2D3B55'},
  cardDesc: {fontSize: 14, color: '#555', marginTop: 4},

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
  progressBar: {height: '100%', backgroundColor: '#4A90E2'},
  continueTextBox: {padding: 8},
  continueTitle: {fontSize: 14, fontWeight: '500', color: '#2D3B55'},
  continueSubtitle: {fontSize: 12, color: '#888', marginTop: 2},

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
  accountLabel: {color: '#666', fontSize: 14},
  accountValue: {fontSize: 14, fontWeight: '600', color: '#2D3B55'},
  expireWrapper: {flexDirection: 'row', alignItems: 'center'},

  extendBtn: {
    marginTop: 20,
    backgroundColor: '#4A90E2',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  extendBtnText: {color: '#fff', fontSize: 15, fontWeight: '600'},
});
