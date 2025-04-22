import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import {useDispatch} from 'react-redux';
import * as Keychain from 'react-native-keychain';
import {clearUserCredentials} from '../store/slices/userSlice';

export default function HomeScreenBrand({navigation}) {
  const dispatch = useDispatch();
  const categories = [
    {
      id: 'live-tv',
      name: 'Live TV',
      navigateName: 'LiveTV',
      icon: 'fa-tv', // Placeholder for icon (replace with vector icon if needed)
      imageUrl:
        'https://readdy.ai/api/search-image?query=3D%20icon%20of%20a%20modern%20television%20with%20live%20broadcast%20symbol%2C%20minimalist%20design%2C%20clean%20lines%2C%20vibrant%20blue%20glow%2C%20floating%20on%20white%20background%2C%20centered%20composition%2C%20soft%20shadows%2C%20professional%20product%20photography%20style%2C%20high%20quality%20render&width=200&height=200&seq=1&orientation=squarish',
      description: 'Watch live channels from around the world',
    },
    {
      id: 'movies',
      name: 'Movies',
      icon: 'fa-film',
      navigateName: 'Movies',
      imageUrl:
        'https://readdy.ai/api/search-image?query=3D%20icon%20of%20a%20film%20reel%20with%20movie%20strip%2C%20minimalist%20design%2C%20clean%20lines%2C%20vibrant%20blue%20glow%2C%20floating%20on%20white%20background%2C%20centered%20composition%2C%20soft%20shadows%2C%20professional%20product%20photography%20style%2C%20high%20quality%20render&width=200&height=200&seq=2&orientation=squarish',
      description: 'Explore thousands of movies on demand',
    },
    {
      id: 'series',
      name: 'Series',
      icon: 'fa-tv-alt',
      navigateName: 'Series',
      imageUrl:
        'https://readdy.ai/api/search-image?query=3D%20icon%20of%20a%20TV%20series%20symbol%20with%20multiple%20episodes%2C%20minimalist%20design%2C%20clean%20lines%2C%20vibrant%20blue%20glow%2C%20floating%20on%20white%20background%2C%20centered%20composition%2C%20soft%20shadows%2C%20professional%20product%20photography%20style%2C%20high%20quality%20render&width=200&height=200&seq=3&orientation=squarish',
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
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

      <ScrollView contentContainerStyle={styles.scrollContent}>
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
            onPress={() => {
              // Navigate to the respective screen
              navigation.navigate(cat.navigateName);
            }}
            activeOpacity={0.8}>
            <Image
              source={{uri: cat.imageUrl}}
              style={styles.cardImage}
              resizeMode="cover"
            />
            <View style={styles.cardTextBox}>
              <Text style={styles.cardTitle}>{cat.name}</Text>
              <Text style={styles.cardDesc}>{cat.description}</Text>
            </View>
            <FontAwesome5 name="chevron-right" size={18} color="#4A90E2" />
          </TouchableOpacity>
        ))}

        {/* Continue watching */}
        <Text style={styles.sectionTitle}>Continue Watching</Text>
        <View style={styles.continueGrid}>
          {continueWatching.map((item, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.continueCard}
              activeOpacity={0.9}>
              <Image
                source={{uri: item.image}}
                style={styles.continueImage}
                resizeMode="cover"
              />
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
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#2D3B55'}, // F3F4F6
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2D3B55',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {color: '#fff', fontSize: 20, fontWeight: '700'},
  headerIcons: {flexDirection: 'row'},
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  scrollContent: {padding: 16, paddingBottom: 120, backgroundColor: '#F3F4F6'},
  welcomeBox: {marginBottom: 16},
  welcomeTitle: {fontSize: 24, fontWeight: '600', color: '#2D3B55'},
  welcomeSubtitle: {fontSize: 16, color: '#555', marginTop: 4},
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3B55',
    marginVertical: 12,
  },
  continueGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
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
  progressBar: {
    height: '100%',
    backgroundColor: '#4A90E2',
  },
  continueTextBox: {padding: 8},
  continueTitle: {fontSize: 14, fontWeight: '500', color: '#2D3B55'},
  continueSubtitle: {fontSize: 12, color: '#888', marginTop: 2},
});
